import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendWaiverCopyEmail, waiverEmailConfigured } from "@/lib/server/waiver-email";
import { getServerSupabaseConfig, serverSupabaseHeaders, supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type Template = {
  id: string;
  template_key: string;
  template_name: string;
  template_version: string;
  form_title: string;
  form_description: string | null;
  agreement_html: string;
  fields_schema: Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }>;
  requires_signature: boolean;
};

type Task = {
  id: string;
  readiness_id: string | null;
  confirmation_code: string;
  task_status: string;
  expires_at: string | null;
  assigned_guest_name: string | null;
  assigned_guest_email: string | null;
  template_id: string;
  opened_at: string | null;
};

type ReservationContext = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  visit_start_time: string;
  product_display_name: string;
  adventure_assure_level: string | null;
  vehicle_breakdown: Array<{ model?: string; quantity?: number }> | null;
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

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function denverDateOnly() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function ageOnDate(dob: Date, asOf: Date) {
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = asOf.getUTCMonth() < dob.getUTCMonth()
    || (asOf.getUTCMonth() === dob.getUTCMonth() && asOf.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function validateTemplateFields(template: Template, formData: Record<string, string>) {
  if (template.template_key !== "minor_driver_authorization") return null;

  const dob = parseDateOnly(String(formData.minor_dob || ""));
  const expiration = parseDateOnly(String(formData.license_expiration_date || ""));
  const today = parseDateOnly(denverDateOnly());

  if (!dob || !today) return "Please enter a valid date of birth.";
  if (dob.getTime() > today.getTime()) return "Date of birth cannot be in the future.";

  const age = ageOnDate(dob, today);
  if (age < 16) return "Teen drivers must be at least 16 years old.";
  if (age >= 18) return "Teen Driver Authorization is only for drivers age 16 or 17.";

  if (!expiration) return "Please enter a valid driver's license expiration date.";
  if (expiration.getTime() < today.getTime()) return "The driver's license is expired. A current driver's license is required.";

  return null;
}

async function loadTask(token: string) {
  const rows = await supabaseSelect<Task>("guest_form_tasks", new URLSearchParams({
    select: "id,readiness_id,confirmation_code,task_status,expires_at,assigned_guest_name,assigned_guest_email,template_id,opened_at",
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

async function loadReservationContext(readinessId: string | null) {
  if (!readinessId) return null;
  const rows = await supabaseSelect<ReservationContext>("guest_readiness_operational", new URLSearchParams({
    select: "customer_name,customer_email,customer_phone,visit_start_time,product_display_name,adventure_assure_level,vehicle_breakdown",
    readiness_id: `eq.${readinessId}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function generateSignedPdf(submissionId: string) {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/generate-epic-guest-form-pdf`, {
    method: "POST",
    headers: serverSupabaseHeaders(),
    body: JSON.stringify({ submission_id: submissionId }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) return { ok: false as const, error: text.slice(0, 500) };
  return { ok: true as const, result: JSON.parse(text) as { storage_path?: string; sha256?: string; bytes?: number } };
}

async function downloadSignedPdf(storagePath: string) {
  const { url } = getServerSupabaseConfig();
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/authenticated/epic-legal-documents/${encodedPath}`, {
    headers: serverSupabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to retrieve signed form PDF: ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

async function emailDamageAcknowledgmentCopy(input: {
  submissionId: string;
  task: Task;
  signerName: string;
  storagePath: string;
}) {
  await supabasePatch("guest_form_submissions", new URLSearchParams({ id: `eq.${input.submissionId}` }), {
    copy_email_status: "pending",
    copy_email_error: null,
  });

  try {
    if (!waiverEmailConfigured()) throw new Error("Signed form email delivery is not configured.");
    const email = input.task.assigned_guest_email?.trim();
    if (!email) throw new Error("Guest email address is missing.");
    const pdfBytes = await downloadSignedPdf(input.storagePath);
    const emailResult = await sendWaiverCopyEmail({
      email,
      signerName: input.signerName,
      pdf: pdfBytes,
      idempotencyKey: `damage-acknowledgment-copy/${input.submissionId}`,
      documentTitle: "Vehicle Damage Acknowledgment and Next Steps",
      filename: `Epic-4X4-Vehicle-Damage-Acknowledgment-${input.task.confirmation_code}.pdf`,
    });
    await supabasePatch("guest_form_submissions", new URLSearchParams({ id: `eq.${input.submissionId}` }), {
      copy_email_status: "sent",
      copy_email_sent_at: new Date().toISOString(),
      copy_email_message_id: emailResult.messageId,
      copy_email_error: null,
    });
    return { status: "sent" as const, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to email signed form copy.";
    await supabasePatch("guest_form_submissions", new URLSearchParams({ id: `eq.${input.submissionId}` }), {
      copy_email_status: "failed",
      copy_email_error: message,
    }).catch(() => undefined);
    return { status: "failed" as const, error: message };
  }
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
    const reservation = template.template_key === "damage_acknowledgment" ? await loadReservationContext(task.readiness_id) : null;
    return NextResponse.json({ task, template, reservation });
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

    const validationError = validateTemplateFields(template, formData);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    if (body.agreed !== true) return NextResponse.json({ error: "You must acknowledge the agreement before signing." }, { status: 400 });
    if (template.requires_signature && !body.signatureDataUrl?.startsWith("data:image/png;base64,")) return NextResponse.json({ error: "Please sign in the signature box." }, { status: 400 });
    const signerName = body.signerName?.trim()
      || String(formData.renter_full_name || `${formData.guardian_first_name || ""} ${formData.guardian_last_name || ""}`).trim()
      || task.assigned_guest_name?.trim()
      || "";
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

    if (template.template_key === "damage_acknowledgment") {
      await supabasePatch(
        "guest_form_attachments",
        new URLSearchParams({ task_id: `eq.${task.id}`, submission_id: "is.null" }),
        { submission_id: submission.id },
      );
    }

    const now = new Date().toISOString();
    await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), { task_status: "completed", completed_at: now, updated_at: now });
    if (task.readiness_id) {
      try {
        await supabaseInsert("epic_reservation_events", {
          readiness_id: task.readiness_id,
          event_type: "guest_form_completed",
          event_notes: `${template.template_name} completed`,
          event_data: { task_id: task.id, template_key: template.template_key, submission_id: submission.id, document_id: submission.document_id },
          recorded_by: "guest_portal",
        });
      } catch (eventError) {
        console.error("Unable to write guest form reservation event", eventError);
      }
    }

    const pdf = await generateSignedPdf(submission.id);
    if (!pdf.ok) {
      console.error("Guest form PDF generation failed", { submissionId: submission.id, documentId: submission.document_id, error: pdf.error });
    }

    let copyEmailStatus: "sent" | "failed" | null = null;
    let copyEmailError: string | null = null;
    if (template.template_key === "damage_acknowledgment" && pdf.ok && pdf.result.storage_path) {
      const copy = await emailDamageAcknowledgmentCopy({
        submissionId: submission.id,
        task,
        signerName,
        storagePath: pdf.result.storage_path,
      });
      copyEmailStatus = copy.status;
      copyEmailError = copy.error;
    }

    return NextResponse.json({
      ok: true,
      documentId: submission.document_id,
      submissionId: submission.id,
      pdfGenerated: pdf.ok,
      pdf: pdf.ok ? pdf.result : null,
      pdfError: pdf.ok ? null : pdf.error,
      copyEmailStatus,
      copyEmailError,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit form." }, { status: 500 });
  }
}
