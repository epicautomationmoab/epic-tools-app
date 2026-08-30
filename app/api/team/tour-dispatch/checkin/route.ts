import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type ReleaseResult = {
  dispatch_id: string;
  job_id: string | null;
  checkin_status: string;
};

async function triggerAxelIn(jobId: string) {
  const url = process.env.AXEL_IN_TRIGGER_URL?.trim();
  const secret = process.env.AXEL_IN_TRIGGER_SECRET?.trim();
  if (!url || !secret) throw new Error("Axel In trigger is not configured.");

  const response = await fetch(url.replace(/\/$/, "") + "/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-axel-secret": secret,
    },
    body: JSON.stringify({ job_id: jobId }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Axel In trigger failed (${response.status}).`);
  }
  return payload;
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const storeVisitId = String(body?.store_visit_id ?? "").trim();
    const vehicleSlot = Number(body?.vehicle_slot);
    const actorName = profile?.display_name ?? "Epic Workstation";

    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }

    const result = await supabaseRpc<ReleaseResult[]>("release_tour_vehicle_checkin_shadow", {
      p_store_visit_id: storeVisitId,
      p_vehicle_slot: vehicleSlot,
      p_released_by: actorName,
    });

    const released = result?.[0];
    if (!released?.dispatch_id || released.checkin_status !== "checkin_queued" || !released.job_id) {
      throw new Error("Vehicle check-in job was not released.");
    }

    await triggerAxelIn(released.job_id);

    const tourReturned = await supabaseRpc<boolean>("mark_tour_returned_if_all_checkins_released", {
      p_store_visit_id: storeVisitId,
      p_recorded_by: actorName,
    });

    return NextResponse.json({
      ok: true,
      ...released,
      axel_ready: true,
      axel_triggered: true,
      tour_returned: Boolean(tourReturned),
    });
  } catch (error) {
    console.error("Tour dispatch vehicle return failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record vehicle return." },
      { status: 500 },
    );
  }
}
