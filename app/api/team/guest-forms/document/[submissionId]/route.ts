import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders, supabaseSelect } from "@/lib/server/supabase-rest";

export async function GET(request: NextRequest, context: { params: Promise<{ submissionId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { submissionId } = await context.params;
    const rows = await supabaseSelect<{ document_id: string; signed_pdf_storage_path: string | null }>(
      "guest_form_submissions",
      new URLSearchParams({ select: "document_id,signed_pdf_storage_path", id: `eq.${submissionId}`, limit: "1" }),
    );
    const submission = rows[0];
    if (!submission) return NextResponse.json({ error: "Signed document not found." }, { status: 404 });
    if (!submission.signed_pdf_storage_path) return NextResponse.json({ error: "Signed PDF has not been generated yet." }, { status: 409 });

    const { url } = getServerSupabaseConfig();
    const encodedPath = submission.signed_pdf_storage_path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${url}/storage/v1/object/authenticated/epic-legal-documents/${encodedPath}`, {
      headers: serverSupabaseHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Unable to retrieve signed document." }, { status: response.status });

    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${submission.document_id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve signed document." }, { status: 500 });
  }
}
