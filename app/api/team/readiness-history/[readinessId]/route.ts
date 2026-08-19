import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

function hasPreviewAccess(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(previewToken && request.cookies.get("epic_preview_access")?.value === previewToken);
}

async function authorized(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  if (await getAuthenticatedTeamProfile(accessToken)) return true;
  if (verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value)) return true;
  return hasPreviewAccess(request);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ readinessId: string }> },
) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { readinessId } = await context.params;
  if (!readinessId) {
    return NextResponse.json({ error: "readinessId is required." }, { status: 400 });
  }

  try {
    const [requests, acceptances, notes, handoffs] = await Promise.all([
      supabaseSelect<Record<string, unknown>>(
        "cancellation_agreement_requests",
        new URLSearchParams({
          select:
            "id,readiness_id,confirmation_code,customer_name,visit_summary,policy_version,policy_title,policy_summary,status,sent_by,delivery_mode,sent_at,opened_at,accepted_at,podium_delivery_status,email_delivery_status,last_error,created_at",
          readiness_id: `eq.${readinessId}`,
          order: "created_at.desc",
          limit: "10",
        }),
      ),
      supabaseSelect<Record<string, unknown>>(
        "cancellation_agreement_acceptances",
        new URLSearchParams({
          select:
            "id,request_id,readiness_id,confirmation_code,customer_name,visit_summary,policy_version,policy_title,policy_summary,acceptance_statement,signer_name,accepted_at,created_at",
          readiness_id: `eq.${readinessId}`,
          order: "accepted_at.desc",
          limit: "10",
        }),
      ),
      supabaseSelect<Record<string, unknown>>(
        "guest_readiness_staff_notes",
        new URLSearchParams({
          select: "note_id,note_text,note_category,created_by,created_at,updated_at,archived_at",
          readiness_id: `eq.${readinessId}`,
          order: "created_at.desc",
          limit: "50",
        }),
      ),
      supabaseSelect<Record<string, unknown>>(
        "epic_operational_handoffs",
        new URLSearchParams({
          select: "handoff_status,recorded_at,recorded_by,source,created_at",
          readiness_id: `eq.${readinessId}`,
          order: "recorded_at.desc",
          limit: "50",
        }),
      ),
    ]);

    return NextResponse.json({
      cancellation_requests: requests,
      cancellation_acceptances: acceptances,
      staff_notes: notes,
      handoffs,
    });
  } catch (error) {
    console.error("Historical readiness detail failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load historical details." },
      { status: 500 },
    );
  }
}
