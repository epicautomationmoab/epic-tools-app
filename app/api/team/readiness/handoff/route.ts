import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { isIsolatedUui } from "@/lib/uui-internal-writes";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  // The existing RPC can queue settlement, post-visit email and deposit work.
  // Do not bypass the Preview outbound boundary by calling this handler directly.
  const preview = process.env.EPIC_STAGING_NO_OUTBOUND === "true";
  if (preview && !isIsolatedUui(process.env)) {
    return NextResponse.json({ error: "Operational handoffs are disabled in Preview while their automation is isolated." }, { status: 403 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid reservation status request." }, { status: 400 }); }
  const readinessId = body?.readiness_id;
  const status = body?.handoff_status;
  if (typeof readinessId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(readinessId)
    || (status !== null && !["checked_in", "rental_out", "rental_returned"].includes(status))) {
    return NextResponse.json({ error: "Invalid reservation status request." }, { status: 400 });
  }
  try {
    // Keep balance checks, business-line rules and downstream effects in the
    // existing transaction. Never trust caller-supplied employee attribution.
    const clearing = status === null;
    const functionName = preview ? "uui_preview_set_handoff"
      : clearing ? "clear_epic_operational_handoff" : "set_epic_operational_handoff";
    await supabaseRpc(functionName, {
      p_readiness_id: readinessId,
      ...(!clearing || preview ? { p_handoff_status: clearing ? "clear" : status } : {}),
      p_recorded_by: profile?.display_name || "Epic Workstation",
    });
    return NextResponse.json({ ok: true, handoff_status: status });
  } catch (error) {
    console.error("Operational handoff failed", error);
    return NextResponse.json({ error: "Unable to update reservation status. Confirm the balance is paid and retry." }, { status: 500 });
  }
}
