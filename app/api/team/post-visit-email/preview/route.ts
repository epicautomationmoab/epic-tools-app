import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { renderPostVisitEmailHtml } from "@/lib/server/post-visit-email";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type JobRow = {
  confirmation_code: string;
  business_line: "tour" | "rental";
  status: string;
};

type PreferenceRow = {
  confirmation_code: string;
  send_mode: "review_request" | "thank_you_only";
};

type SignerRow = {
  signer_full_name: string;
  signer_email: string | null;
  is_adult: boolean | null;
  signed_at: string;
};

export async function GET(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const confirmationCode = request.nextUrl.searchParams.get("confirmationCode")?.trim().toUpperCase();
    if (!confirmationCode) {
      return NextResponse.json({ error: "confirmationCode is required." }, { status: 400 });
    }

    const [jobs, preferences, signers] = await Promise.all([
      supabaseSelect<JobRow>(
        "post_visit_email_jobs",
        new URLSearchParams({
          select: "confirmation_code,business_line,status",
          confirmation_code: `eq.${confirmationCode}`,
          order: "created_at.desc",
          limit: "1",
        }),
      ),
      supabaseSelect<PreferenceRow>(
        "post_visit_email_preferences",
        new URLSearchParams({
          select: "confirmation_code,send_mode",
          confirmation_code: `eq.${confirmationCode}`,
          order: "updated_at.desc",
          limit: "1",
        }),
      ),
      supabaseSelect<SignerRow>(
        "epic_waiver_signatures",
        new URLSearchParams({
          select: "signer_full_name,signer_email,is_adult,signed_at",
          confirmation_code: `eq.${confirmationCode}`,
          is_adult: "eq.true",
          signer_email: "not.is.null",
          order: "signed_at.asc",
          limit: "100",
        }),
      ),
    ]);

    const job = jobs[0];
    if (!job) {
      return NextResponse.json({ error: "No post-visit email job exists for this reservation." }, { status: 404 });
    }

    const signer = signers.find((row) => row.signer_full_name?.trim() && row.signer_email?.trim());
    if (!signer) {
      return NextResponse.json({ error: "No adult waiver signer with an email is available for preview." }, { status: 404 });
    }

    const sendMode = preferences[0]?.send_mode ?? "review_request";
    const html = renderPostVisitEmailHtml({
      signerName: signer.signer_full_name,
      businessLine: job.business_line,
      sendMode,
      brandAssetBase: `${request.nextUrl.origin}/api/brand/post-visit`,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to render post-visit email preview." },
      { status: 500 },
    );
  }
}
