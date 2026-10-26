import { NextRequest, NextResponse } from "next/server";
import { supabaseSelect, getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

type PortalActivity = { readiness_id: string; business_line: string };
type Session = { id: string; readiness_id: string; outcome: string; mode: string };
type ParticipantInput = { fullName: string; initials: string };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function cleanName(value: string) { return value.trim().replace(/\s+/g, " "); }
function validInitials(value: string) {
  // Drawn initials are transmitted as a bounded PNG data URL from the canvas.
  // Never trust a typed initial or arbitrary remote image URL as an acknowledgment.
  return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 150 && value.length <= 120_000;
}

/**
 * Records participation, NOT verified EXP completion.
 * Guest-supplied names can only be reconciled with actual signed waiver
 * identities later, using an authenticated staff or deterministic exact match.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (process.env.EXP_ASSESSMENT_SERVER_ENABLED !== "true") return bad("EXP participant recording is not enabled.", 503);
  try {
    const { token } = await context.params;
    const body = await request.json() as {
      readinessId?: string; sessionId?: string;
      participants?: ParticipantInput[];
      allDriversWatched?: boolean;
    };
    if (!token || !body.readinessId || !body.sessionId) return bad("Reservation and session are required.");
    if (body.allDriversWatched !== true) return bad("All participating drivers must confirm watching the orientation.");
    if (!Array.isArray(body.participants) || body.participants.length < 1 || body.participants.length > 20) {
      return bad("Enter between 1 and 20 participating drivers.");
    }
    const normalized = body.participants.map(p => ({
      display_name: cleanName(String(p.fullName ?? "")), initials: String(p.initials ?? "").trim(),
    }));
    if (normalized.some(p => p.display_name.length < 3 || p.display_name.length > 120 || !validInitials(p.initials))) {
      return bad("Each driver needs a full name and drawn initials.");
    }
    if (new Set(normalized.map(p => p.display_name.toLowerCase())).size !== normalized.length) {
      return bad("Each participating driver must be listed once.");
    }
    const [reservation] = await supabaseSelect<PortalActivity>("guest_portal_v", new URLSearchParams({
      select: "readiness_id,business_line",
      guest_portal_token: `eq.${token}`, readiness_id: `eq.${body.readinessId}`, limit: "1",
    }));
    if (!reservation || reservation.business_line?.toLowerCase() !== "rental") return bad("Rental reservation not found.", 404);
    const [session] = await supabaseSelect<Session>("exp_sessions", new URLSearchParams({
      select: "id,readiness_id,outcome,mode", id: `eq.${body.sessionId}`, readiness_id: `eq.${body.readinessId}`, limit: "1",
    }));
    if (!session) return bad("Assessment session not found.", 404);
    if (session.outcome !== "in_progress") return bad("Participants must be confirmed before submitting the assessment.", 409);
    const existing = await supabaseSelect<{ id: string }>("exp_participants", new URLSearchParams({
      select: "id", session_id: `eq.${session.id}`, limit: "1",
    }));
    if (existing.length) return bad("Participants already recorded for this session.", 409);
    // One bulk insert is atomic: a failure cannot leave a partial group recorded.
    // A unique (session_id, normalized-name) index provides duplicate protection.
    const { url } = getServerSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/exp_participants`, {
      method: "POST",
      headers: serverSupabaseHeaders("return=representation"),
      body: JSON.stringify(normalized.map(participant => ({
        session_id: session.id,
        readiness_id: reservation.readiness_id,
        ...participant,
        acknowledgement_at: new Date().toISOString(),
        reconciliation_status: "unmatched",
      }))),
      cache: "no-store",
    });
    if (response.status === 409) return bad("These drivers have already been recorded for this assessment.", 409);
    if (!response.ok) throw new Error(`Unable to record participants (${response.status})`);
    const rows = await response.json() as Array<{ id: string }>;
    if (rows.length !== normalized.length) throw new Error("Unexpected number of saved participants.");
    return NextResponse.json({ ok: true, recorded: normalized.length, verifiedDrivers: 0, completionRecorded: false },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("EXP participant recording failed", error);
    return bad("Unable to record EXP participants.", 500);
  }
}
