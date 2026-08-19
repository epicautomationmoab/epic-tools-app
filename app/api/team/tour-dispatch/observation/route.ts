import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const storeVisitId = String(body?.store_visit_id ?? "").trim();
    const vehicleSlot = Number(body?.vehicle_slot);
    const mpwrVehicleNumberObserved = String(body?.mpwr_vehicle_number_observed ?? "").trim();
    const driverObservation = String(body?.mpwr_driver_observation ?? "").trim();
    const notes = String(body?.mpwr_checkout_notes ?? "").trim();

    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }
    if (!mpwrVehicleNumberObserved) {
      return NextResponse.json({ error: "Enter the vehicle number shown in MPWR." }, { status: 400 });
    }
    if (!["expected", "different", "missing"].includes(driverObservation)) {
      return NextResponse.json({ error: "Choose what you found in the Driver field." }, { status: 400 });
    }

    await supabaseRpc("record_tour_vehicle_mpwr_observation", {
      p_store_visit_id: storeVisitId,
      p_vehicle_slot: vehicleSlot,
      p_mpwr_vehicle_number_observed: mpwrVehicleNumberObserved,
      p_mpwr_driver_observation: driverObservation,
      p_mpwr_checkout_notes: notes,
      p_confirmed_by: profile?.display_name ?? "Epic Workstation",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Tour dispatch MPWR observation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save MPWR observation." },
      { status: 500 },
    );
  }
}
