import { NextRequest, NextResponse } from "next/server";
import { supabaseSelect, getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";
import {loadExpReadiness} from "@/lib/server/exp-readiness";
import { loadRentalV2Readiness } from "@/lib/server/rental-v2-readiness";

type PortalActivity = { readiness_id: string; business_line: string; confirmation_code: string; expected_guest_count: number|null; total_vehicle_count: number|null };
type Session = { id: string; readiness_id: string; outcome: string; mode: string; result_summary:Record<string,unknown> };
type ParticipantInput = { fullName: string; initials: string };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function cleanName(value: string) { return value.trim().replace(/\s+/g, " "); }
function validInitials(value: string) {
  // Drawn initials are transmitted as a bounded PNG data URL from the canvas.
  // Never trust a typed initial or arbitrary remote image URL as an acknowledgment.
  if(!value.startsWith("data:image/png;base64,"))return false;
  const bytes=Buffer.from(value.slice(22),"base64");
  if(bytes.length<24||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")return false;
  return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 150 && value.length <= 120_000;
}

/**
 * Records participation, NOT verified EXP completion.
 * Guest-supplied names can only be reconciled with actual signed waiver
 * identities later, using an authenticated staff or deterministic exact match.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (process.env.EXP_ASSESSMENT_SERVER_ENABLED !== "true") return bad("Orientation participant recording is not enabled.", 503);
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
    const activities = await supabaseSelect<PortalActivity>("guest_portal_v", new URLSearchParams({
      select: "readiness_id,business_line,confirmation_code,expected_guest_count,total_vehicle_count",
      guest_portal_token: `eq.${token}`,
    }));
    const reservation=activities.find(a=>a.readiness_id===body.readinessId);
    if (!reservation || reservation.business_line?.toLowerCase() !== "rental") return bad("Rental reservation not found.", 404);
    const booking=activities.filter(a=>a.business_line.toLowerCase()==="rental"&&a.confirmation_code===reservation.confirmation_code);
    // Only known, completed Epic rental driver-agreement signers are eligible.
    // A signed agreement is not proof that Polaris or OHV requirements are met.
    const tasks = await supabaseSelect<{ id: string; template_id: string; task_status: string }>("guest_form_tasks", new URLSearchParams({
      select: "id,template_id,task_status", readiness_id: `in.(${booking.map(a=>'"'+a.readiness_id+'"').join(',')})`, task_status: "eq.completed",
    }));
    const templateIds = [...new Set(tasks.map(t => t.template_id))];
    const templates = templateIds.length ? await supabaseSelect<{ id: string; template_key: string }>("guest_form_templates", new URLSearchParams({
      select: "id,template_key", id: `in.(${templateIds.join(",")})`,
    })) : [];
    const allowedTemplateIds = new Set(templates.filter(t => t.template_key === "rental_v2_driver_terms_targeted").map(t => t.id));
    const allowedTasks = tasks.filter(t => allowedTemplateIds.has(t.template_id));
    const submissions = allowedTasks.length ? await supabaseSelect<{ task_id: string; signer_name: string | null }>("guest_form_submissions", new URLSearchParams({
      select: "task_id,signer_name", task_id: `in.(${allowedTasks.map(t => t.id).join(",")})`,
    })) : [];
    const v2 = await loadRentalV2Readiness(booking.map(a=>({readinessId:a.readiness_id,confirmationCode:a.confirmation_code,expectedGuestCount:a.expected_guest_count,vehicleCount:a.total_vehicle_count})));
    const eligible = new Set([
      ...submissions.map(s => cleanName(s.signer_name ?? "").toLowerCase()).filter(Boolean),
      ...[...v2.values()].flatMap(record=>record.signers).filter(s => s.role === "driver")
        .map(s => cleanName(s.name).toLowerCase()),
    ]);
    if (!eligible.size) return bad("Complete a signed Epic rental driver agreement before starting your orientation.", 409);
    if (normalized.some(p => !eligible.has(p.display_name.toLowerCase()))) {
      return bad("Every driver must first sign the required rental agreement under their own name.", 409);
    }
    const [session] = await supabaseSelect<Session>("exp_sessions", new URLSearchParams({
      select: "id,readiness_id,outcome,mode,result_summary", id: `eq.${body.sessionId}`, readiness_id: `eq.${body.readinessId}`, limit: "1",
    }));
    if (!session) return bad("Assessment session not found.", 404);
    if (session.outcome !== "in_progress") return bad("Participants must be confirmed before submitting the assessment.", 409);
    const existing = await supabaseSelect<{ id: string; display_name: string }>("exp_participants", new URLSearchParams({
      select: "id,display_name", session_id: `eq.${session.id}`, limit: "21",
    }));
    if (existing.length) {
      const known = new Set(existing.map(p => cleanName(p.display_name).toLowerCase()));
      const exactSameRoster = known.size === normalized.length && normalized.every(p => known.has(p.display_name.toLowerCase()));
      if (!exactSameRoster) return bad("An orientation session already exists for a different set of participating drivers.", 409);
      return NextResponse.json({ok:true,recorded:existing.length,resumed:true,verifiedDrivers:0,completionRecorded:false},{headers:{"Cache-Control":"no-store"}});
    }
    const planned=session.result_summary?.selectedDriverNames;
    if(Array.isArray(planned)){
      const expected=new Set(planned.filter((n):n is string=>typeof n==='string').map(n=>cleanName(n).toLowerCase()));
      if(expected.size!==normalized.length||normalized.some(p=>!expected.has(p.display_name.toLowerCase())))return bad("Keep the original selected drivers together in this orientation.",409);
    }
    const readiness=await loadExpReadiness(body.readinessId);
    if(normalized.some(p=>readiness?.drivers.some(d=>d.orientationComplete&&cleanName(d.name).toLowerCase()===p.display_name.toLowerCase())))return bad("A selected driver has already completed orientation. Their completion is saved.",409);
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
    return bad("Unable to record participating drivers.", 500);
  }
}
