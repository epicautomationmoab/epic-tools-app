import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type Template = {
  id: string;
  template_key: string;
  template_name: string;
  template_version: string;
  form_title: string;
  form_description: string | null;
  agreement_html: string;
  fields_schema: Array<{ key: string; label: string; type: string; required?: boolean }>;
  requires_signature: boolean;
};

type Task = {
  id: string;
  readiness_id: string | null;
  confirmation_code: string;
  task_status: string;
  expires_at: string | null;
  assigned_guest_name: string | null;
  template_id: string;
  opened_at: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || request.headers.get("cf-connecting-ip")
    || null;
}

async function loadTask(token: string) {
  const rows = await supabaseSelect<Task>("guest_form_tasks", new URLSearchParams({
    select: "id,readiness_id,confirmation_code,task_status,expires_at,assigned_guest_name,template_id,opened_at",
    public_token_hash: `eq.${hashToken(token)}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function loadTemplate(id: string) {
  const rows = await supabaseSelect<Template>("guest_form_templates", new URLSearchParams({
    select: "id,template_key,template_name,template_version,form_title,form_description,agreement_html,fields_schema,requires_signature",
    id: `eq.${id}`,
    is_active: "eq.true",
    limit: "1",
  }));
  return rows[0] ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const task = await loadTask(token);
    if (!task) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now() && task.task_status !== "completed") {
      await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), { task_status: "expired", updated_at: new Date().toISOString() });
      return NextResponse.json({ error: "This form link has expired. Please contact Epic 4X4 Adventures." }, { status: 410 });
    }
    const template = await loadTemplate(task.template_id);
    if (!template) return NextResponse.json({ error: "Form template unavailable." }, { status: 404 });
    if (["created", "sent"].includes(task.task_status)) {
      const now = new Date().toISOString();
      await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), { task_status: "opened", opened_at: task.opened_at ?? now, updated_at: now });
      task.task_status = "opened";
    }
    return NextResponse.json({ task, template });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load form." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const task = await loadTask(token);
    if (!task) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    if (task.task_status === "completed") return NextResponse.json({ ok: true, alreadyCompleted: true });
    if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This form link has expired." }, { status: 410 });
    const template = await loadTemplate(task.template_id);
    if (!template) return NextResponse.json({ error: "Form template unavailable." }, { status: 404 });

    const body = await request.json() as { formData?: Record<string, string>; signerName?: string; signatureDataUrl?: string; agreed?: boolean };
    const formData = body.formData ?? {};
    for (const field of template.fields_schema) {
      if (field.required && !String(formData[field.key] ?? "").trim()) return NextResponse.json({ error: `${field.label} is required.` }, { status: 400 });
    }
    if (body.agreed !== true) return NextResponse.json({ error: "You must acknowledge the agreement before signing." }, { status: 400 });
    if (template.requires_signature && !body.signatureDataUrl?.startsWith("data:image/png;base64,")) return NextResponse.json({ error: "Please sign in the signature box." }, { status: 400 });
    const signerName = body.signerName?.trim() || String(formData.renter_full_name || `${formData.guardian_first_name || ""} ${formData.guardian_last_name || ""}`).trim();
    if (!signerName) return NextResponse.json({ error: "Signer name is required." }, { status: 400 });

    const documentId = `EPIC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const submission = await supabaseInsert<{ id: string; document_id: string }>("guest_form_submissions", {
      task_id: task.id,
      document_id: documentId,
      form_data: formData,
      signer_name: signerName,
      signature_data_url: body.signatureDataUrl ?? null,
      signer_ip_address: clientIp(request),
      signer_user_agent: request.headers.get("user-agent") ?? null,
    });

    const now = new Date().toISOString();
    await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), { task_status: "completed", completed_at: now, updated_at: now });
    if (task.readiness_id) {
      await supabaseInsert("epic_reservation_events", {
        readiness_id: task.readiness_id,
        event_type: "guest_form_completed",
        event_notes: `${template.template_name} completed`,
        event_data: { task_id: task.id, template_key: template.template_key, submission_id: submission.id, document_id: submission.document_id },
        recorded_by: "guest_portal",
      });
    }
    return NextResponse.json({ ok: true, documentId: submission.document_id, submissionId: submission.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit form." }, { status: 500 });
  }
}
