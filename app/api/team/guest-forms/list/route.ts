import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";

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
type SubmissionRow = { id: string; task_id: string; document_id: string; signed_pdf_storage_path: string | null; submitted_at: string };

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
    if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
      select: "id,task_id,document_id,signed_pdf_storage_path,submitted_at",
      task_id: `in.(${taskIds.join(",")})`,
    }));
    const templateById = new Map(templates.map((template) => [template.id, template]));
    const submissionByTask = new Map(submissions.map((submission) => [submission.task_id, submission]));

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
