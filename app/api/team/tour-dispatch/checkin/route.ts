import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type ReleaseResult = {
  dispatch_id: string;
  job_id: string;
  checkin_status: string;
};

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const storeVisitId = String(body?.store_visit_id ?? "").trim();
    const vehicleSlot = Number(body?.vehicle_slot);

    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }

    const result = await supabaseRpc<ReleaseResult[]>("release_tour_vehicle_checkin_shadow", {
      p_store_visit_id: storeVisitId,
      p_vehicle_slot: vehicleSlot,
      p_released_by: profile?.display_name ?? "Epic Workstation",
    });

    const released = result?.[0];
    if (!released?.job_id) throw new Error("Prepared Axel In package was not released.");

    return NextResponse.json({ ok: true, ...released });
  } catch (error) {
    console.error("Tour dispatch check-in shadow release failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to release Axel In shadow package." },
      { status: 500 },
    );
  }
}
