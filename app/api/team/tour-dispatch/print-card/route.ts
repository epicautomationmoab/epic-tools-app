import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);

  if (!profile && !workstation) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const storeVisitId = String(body?.store_visit_id ?? "").trim();
    const vehicleSlot = Number(body?.vehicle_slot);

    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }

    const requestedBy = profile?.display_name ?? "Epic Workstation";
    const jobId = await supabaseRpc<string>("queue_manual_tour_windshield_print", {
      p_store_visit_id: storeVisitId,
      p_vehicle_slot: vehicleSlot,
      p_requested_by: requestedBy,
    });

    if (!jobId) throw new Error("Print job was not created.");

    return NextResponse.json({ ok: true, job_id: jobId });
  } catch (error) {
    console.error("Manual windshield card print queue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to queue windshield card." },
      { status: 500 },
    );
  }
}
