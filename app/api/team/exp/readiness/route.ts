import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type ExpSession = { id: string; readiness_id: string; mode: string; outcome: string; completed_at: string | null; video_version: string };
type ExpParticipant = { id: string; session_id: string; display_name: string; initials: string; reconciliation_status: string; waiver_signer_reference: string | null; acknowledgement_at: string | null };
/** Staff-only EXP status projection for the future unified Readiness view. */
export async function GET(request: NextRequest) {
  if (process.env.EXP_ASSESSMENT_SERVER_ENABLED !== "true") return NextResponse.json({ error: "EXP Readiness is not enabled." }, { status: 503 });
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (!readinessId || readinessId.length > 120) return NextResponse.json({ error: "readinessId required." }, { status: 400 });
  try {
    const sessions = await supabaseSelect<ExpSession>("exp_sessions", new URLSearchParams({
      select: "id,readiness_id,mode,outcome,completed_at,video_version",
      readiness_id: `eq.${readinessId}`, order: "created_at.desc", limit: "50",
    }));
    if (!sessions.length) return NextResponse.json({ sessions: [], participants: [], needsReconciliation: 0 }, { headers: { "Cache-Control": "no-store" } });
    const participants = await supabaseSelect<ExpParticipant>("exp_participants", new URLSearchParams({
      select: "id,session_id,display_name,initials,reconciliation_status,waiver_signer_reference,acknowledgement_at",
      session_id: `in.(${sessions.map(s => s.id).join(",")})`,
    }));
    return NextResponse.json({
      sessions,
      participants: participants.map(p => ({
        ...p,
        assessmentAndIdentityVerified: p.reconciliation_status === "verified" && sessions.some(s => s.id === p.session_id && s.outcome === "complete"),
        // Never report EXP Ready without verifying all required forms and waivers.
        // Form/waiver gate integration is not yet enabled in this API.
        expReady: false,
        outstanding: ["Required forms and waiver readiness verification pending"],
      })),
      needsReconciliation: participants.filter(p => p.reconciliation_status !== "verified").length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("EXP Readiness query failed", error);
    return NextResponse.json({ error: "Unable to load EXP Readiness." }, { status: 500 });
  }
}
