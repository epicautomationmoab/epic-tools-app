import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc, supabaseSelect } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type RosterRow = {
  store_visit_id: string;
  readiness_id: string | null;
  confirmation_code: string;
  mpwr_confirmation_number: string;
  vehicle_slot: number;
  visit_date: string;
};

type QueueResult = {
  dispatch_id: string;
  job_id: string;
  checkout_status: string;
};

function mountainDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function numericVehicleNumber(label: string) {
  const match = label.match(/\d+/);
  return match?.[0] ?? null;
}

async function triggerAxelOut(jobId: string) {
  const url = process.env.AXEL_OUT_TRIGGER_URL?.trim();
  const secret = process.env.AXEL_OUT_TRIGGER_SECRET?.trim();
  if (!url || !secret) throw new Error("Axel Out trigger is not configured.");

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
    throw new Error(payload?.error || `Axel Out trigger failed (${response.status}).`);
  }
  return payload;
}

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
    const vehicleLabel = String(body?.vehicle_label ?? "").trim();
    const checkoutMileage = Number(body?.checkout_mileage);
    const checkoutEngineHours = Number(body?.checkout_engine_hours);
    const vehicleNumber = numericVehicleNumber(vehicleLabel);

    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }
    if (!vehicleLabel || !vehicleNumber) {
      return NextResponse.json({ error: "Enter a valid car number." }, { status: 400 });
    }
    if (!Number.isFinite(checkoutMileage) || checkoutMileage < 0) {
      return NextResponse.json({ error: "Enter valid mileage." }, { status: 400 });
    }
    if (!Number.isFinite(checkoutEngineHours) || checkoutEngineHours < 0) {
      return NextResponse.json({ error: "Enter valid engine hours." }, { status: 400 });
    }

    const rosterParams = new URLSearchParams({
      select: "store_visit_id,readiness_id,confirmation_code,mpwr_confirmation_number,vehicle_slot,visit_date",
      store_visit_id: `eq.${storeVisitId}`,
      vehicle_slot: `eq.${vehicleSlot}`,
      visit_date: `eq.${mountainDateString()}`,
      limit: "1",
    });
    const [roster] = await supabaseSelect<RosterRow>("tour_vehicle_dispatch_roster_v", rosterParams);
    if (!roster?.mpwr_confirmation_number) {
      return NextResponse.json({ error: "This is not an active MPWR tour vehicle for today." }, { status: 409 });
    }

    const assignedByName = profile?.display_name ?? "Epic Workstation";
    const result = await supabaseRpc<QueueResult[]>("queue_tour_vehicle_checkout", {
      p_store_visit_id: storeVisitId,
      p_vehicle_slot: vehicleSlot,
      p_readiness_id: roster.readiness_id,
      p_confirmation_code: roster.confirmation_code,
      p_mpwr_confirmation_number: roster.mpwr_confirmation_number,
      p_vehicle_label: vehicleLabel,
      p_vehicle_number: vehicleNumber,
      p_checkout_mileage: checkoutMileage,
      p_checkout_engine_hours: checkoutEngineHours,
      p_assigned_by_profile_id: profile?.id ?? null,
      p_assigned_by_name: assignedByName,
    });

    const queued = result?.[0];
    if (!queued?.job_id || !queued?.dispatch_id) {
      throw new Error("Checkout job was not created.");
    }

    const checkinJobId = await supabaseRpc<string>("prepare_tour_vehicle_checkin_shadow", {
      p_dispatch_id: queued.dispatch_id,
    });

    await triggerAxelOut(queued.job_id);

    return NextResponse.json({
      ok: true,
      dispatch_id: queued.dispatch_id,
      checkout_job_id: queued.job_id,
      checkin_job_id: checkinJobId,
      checkout_status: queued.checkout_status,
      checkin_status: "prepared",
      axel_triggered: true,
    });
  } catch (error) {
    console.error("Tour dispatch checkout queue failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to queue vehicle checkout." },
      { status: 500 },
    );
  }
}
