import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import { expTeamStatus } from "@/lib/exp/team-status";

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
    if (!sessions.length) return NextResponse.json({ sessions: [], participants: [], needsReconciliation: 0, assessmentStatus: expTeamStatus(0, 0), checkoutReady: false }, { headers: { "Cache-Control": "no-store" } });
    const participants = await supabaseSelect<ExpParticipant>("exp_participants", new URLSearchParams({
      select: "id,session_id,display_name,initials,reconciliation_status,waiver_signer_reference,acknowledgement_at",
      session_id: `in.(${sessions.map(s => s.id).join(",")})`,
    }));
    // One participant is counted at most once, and only after a complete quiz,
    // recorded video acknowledgment and confirmed waiver identity.
    // This is NOT a checkout clearance: required forms, Epic/Polaris waivers,
    // and OHV certificates still need their authoritative source checks.
    const completedSessionIds = new Set(sessions
      .filter(s => s.outcome === "complete" && Boolean(s.completed_at))
      .map(s => s.id));
    const verifiedParticipants = participants.filter(p =>
      completedSessionIds.has(p.session_id) &&
      p.reconciliation_status === "verified" &&
      Boolean(p.waiver_signer_reference?.trim()) &&
      Boolean(p.acknowledgement_at));
    const distinctQualifiedReferences = new Set(verifiedParticipants.map(p => p.waiver_signer_reference));
    // Driver roster completeness is not yet established. Never emit an allReady
    // status merely because every recorded participant qualified.
    const assessmentStatus = expTeamStatus(0, 0);
    return NextResponse.json({
      sessions,
      participants: participants.map(p => ({
        id: p.id, session_id: p.session_id, display_name: p.display_name,
        reconciliation_status: p.reconciliation_status,
        waiver_signer_reference: p.waiver_signer_reference,
        acknowledgement_at: p.acknowledgement_at,
        assessmentAndIdentityVerified: verifiedParticipants.some(verified => verified.id === p.id),
        expReady: false,
        outstanding: ["Required forms and waiver readiness verification pending"],
      })),
      assessmentStatus,
      verifiedUniqueWaiverReferences: distinctQualifiedReferences.size,
      recordedParticipantCount: participants.length,
      checkoutReady: false,
      readinessVerification: "pending_authoritative_document_checks",
      needsReconciliation: participants.filter(p => p.reconciliation_status !== "verified").length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("EXP Readiness query failed", error);
    return NextResponse.json({ error: "Unable to load EXP Readiness." }, { status: 500 });
  }
}
