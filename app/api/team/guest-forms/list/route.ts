import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";
import { sendWaiverCopyEmail, waiverEmailConfigured } from "@/lib/server/waiver-email";

type TaskRow = {
  id: string;
  readiness_id: string | null;
  confirmation_code: string;
  task_status: string;
  required: boolean;
  assigned_guest_name: string | null;
  assigned_guest_email: string | null;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  template_id: string;
};

type TemplateRow = { id: string; template_key: string; template_name: string; form_title: string };
type SubmissionRow = {
  id: string;
  task_id: string;
  document_id: string;
  signer_name: string | null;
  signed_pdf_storage_path: string | null;
  submitted_at: string;
  copy_email_status: string | null;
};

async function generateSignedPdf(submissionId: string) {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/generate-epic-guest-form-pdf`, {
    method: "POST",
    headers: serverSupabaseHeaders(),
    body: JSON.stringify({ submission_id: submissionId }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`PDF recovery failed: ${text.slice(0, 500)}`);
  return JSON.parse(text) as { storage_path?: string };
}

async function downloadSignedPdf(storagePath: string) {
  const { url } = getServerSupabaseConfig();
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/authenticated/epic-legal-documents/${encodedPath}`, {
    headers: serverSupabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to retrieve recovered PDF: ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

async function recoverDamageDocument(task: TaskRow, submission: SubmissionRow) {
  const pdf = await generateSignedPdf(submission.id);
  const storagePath = pdf.storage_path;
  if (!storagePath) throw new Error("Recovered PDF did not return a storage path.");

  if (submission.copy_email_status !== "sent" && task.assigned_guest_email?.trim() && waiverEmailConfigured()) {
    await supabasePatch("guest_form_submissions", new URLSearchParams({ id: `eq.${submission.id}` }), {
      copy_email_status: "pending",
      copy_email_error: null,
    });
    try {
      const pdfBytes = await downloadSignedPdf(storagePath);
      const result = await sendWaiverCopyEmail({
        email: task.assigned_guest_email.trim(),
        signerName: submission.signer_name?.trim() || task.assigned_guest_name?.trim() || "Guest",
        pdf: pdfBytes,
        idempotencyKey: `damage-acknowledgment-copy/${submission.id}`,
        documentTitle: "Vehicle Damage Acknowledgment and Next Steps",
        filename: `Epic-4X4-Vehicle-Damage-Acknowledgment-${task.confirmation_code}.pdf`,
      });
      await supabasePatch("guest_form_submissions", new URLSearchParams({ id: `eq.${submission.id}` }), {
        copy_email_status: "sent",
        copy_email_sent_at: new Date().toISOString(),
        copy_email_message_id: result.messageId,
        copy_email_error: null,
      });
    } catch (error) {
      await supabasePatch("guest_form_submissions", new URLSearchParams({ id: `eq.${submission.id}` }), {
        copy_email_status: "failed",
        copy_email_error: error instanceof Error ? error.message : "Unable to email recovered signed form.",
      }).catch(() => undefined);
    }
  }

  return storagePath;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
    if (!readinessId) return NextResponse.json({ error: "readinessId is required." }, { status: 400 });

    const tasks = await supabaseSelect<TaskRow>("guest_form_tasks", new URLSearchParams({
      select: "id,readiness_id,confirmation_code,task_status,required,assigned_guest_name,assigned_guest_email,sent_at,opened_at,completed_at,expires_at,template_id",
      readiness_id: `eq.${readinessId}`,
      task_status: "neq.cancelled",
      order: "created_at.asc",
    }));
    if (!tasks.length) return NextResponse.json({ tasks: [] });

    const templateIds = Array.from(new Set(tasks.map((task) => task.template_id)));
    const templates = await supabaseSelect<TemplateRow>("guest_form_templates", new URLSearchParams({
      select: "id,template_key,template_name,form_title",
      id: `in.(${templateIds.join(",")})`,
    }));
    const taskIds = tasks.map((task) => task.id);
    const submissions = await supabaseSelect<SubmissionRow>("guest_form_submissions", new URLSearchParams({
      select: "id,task_id,document_id,signer_name,signed_pdf_storage_path,submitted_at,copy_email_status",
      task_id: `in.(${taskIds.join(",")})`,
    }));
    const templateById = new Map(templates.map((template) => [template.id, template]));
    const submissionByTask = new Map(submissions.map((submission) => [submission.task_id, submission]));

    for (const task of tasks) {
      const template = templateById.get(task.template_id);
      const submission = submissionByTask.get(task.id);
      if (
        template?.template_key === "damage_acknowledgment"
        && task.task_status === "completed"
        && submission
        && !submission.signed_pdf_storage_path
      ) {
        try {
          const storagePath = await recoverDamageDocument(task, submission);
          submission.signed_pdf_storage_path = storagePath;
          submission.copy_email_status = "sent";
        } catch (error) {
          console.error("Unable to recover completed damage acknowledgment", {
            taskId: task.id,
            submissionId: submission.id,
            error,
          });
        }
      }
    }

    return NextResponse.json({
      tasks: tasks.map((task) => {
        const template = templateById.get(task.template_id);
        const submission = submissionByTask.get(task.id);
        return {
          ...task,
          templateKey: template?.template_key ?? null,
          templateName: template?.template_name ?? null,
          formTitle: template?.form_title ?? null,
          submissionId: submission?.id ?? null,
          documentId: submission?.document_id ?? null,
          pdfReady: Boolean(submission?.signed_pdf_storage_path),
          documentUrl: submission?.signed_pdf_storage_path ? `/api/team/guest-forms/document/${submission.id}` : null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load guest form tasks." }, { status: 500 });
  }
}
