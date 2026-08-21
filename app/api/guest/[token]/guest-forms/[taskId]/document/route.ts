import { NextResponse } from "next/server";
import { getServerSupabaseConfig, serverSupabaseHeaders, supabaseSelect } from "@/lib/server/supabase-rest";

type PortalRow = { readiness_id: string };
type TaskRow = { id: string; readiness_id: string | null; task_status: string };
type SubmissionRow = { document_id: string; signed_pdf_storage_path: string | null };

async function resolvePortalReadinessIds(token: string) {
  const rows = await supabaseSelect<PortalRow>("guest_portal_v", new URLSearchParams({
    select: "readiness_id",
    guest_portal_token: `eq.${token}`,
  }));
  return Array.from(new Set(rows.map((row) => row.readiness_id).filter(Boolean)));
}

export async function GET(_request: Request, context: { params: Promise<{ token: string; taskId: string }> }) {
  try {
    const { token, taskId } = await context.params;
    if (!token || !taskId) return NextResponse.json({ error: "Signed form not found." }, { status: 404 });

    const readinessIds = await resolvePortalReadinessIds(token);
    if (!readinessIds.length) return NextResponse.json({ error: "Guest portal not found." }, { status: 404 });

    const tasks = await supabaseSelect<TaskRow>("guest_form_tasks", new URLSearchParams({
      select: "id,readiness_id,task_status",
      id: `eq.${taskId}`,
      readiness_id: `in.(${readinessIds.join(",")})`,
      task_status: "eq.completed",
      limit: "1",
    }));
    if (!tasks[0]) return NextResponse.json({ error: "Signed form not found." }, { status: 404 });

    const submissions = await supabaseSelect<SubmissionRow>("guest_form_submissions", new URLSearchParams({
      select: "document_id,signed_pdf_storage_path",
      task_id: `eq.${taskId}`,
      order: "submitted_at.desc",
      limit: "1",
    }));
    const submission = submissions[0];
    if (!submission?.signed_pdf_storage_path) return NextResponse.json({ error: "Signed PDF is not ready yet." }, { status: 409 });

    const { url } = getServerSupabaseConfig();
    const encodedPath = submission.signed_pdf_storage_path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${url}/storage/v1/object/authenticated/epic-legal-documents/${encodedPath}`, {
      headers: serverSupabaseHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Unable to retrieve signed document." }, { status: response.status });

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${submission.document_id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve signed form." }, { status: 500 });
  }
}
