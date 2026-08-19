import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type RosterRow = {
  store_visit_id: string;
  readiness_id: string | null;
  confirmation_code: string;
  mpwr_confirmation_number: string;
  vehicle_slot: number;
  visit_date: string;
};

type DispatchRow = { id: string };

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

    const existingParams = new URLSearchParams({
      select: "id",
      store_visit_id: `eq.${storeVisitId}`,
      vehicle_slot: `eq.${vehicleSlot}`,
      limit: "1",
    });
    const [existing] = await supabaseSelect<DispatchRow>("tour_vehicle_dispatches", existingParams);
    const now = new Date().toISOString();
    const assignment = {
      readiness_id: roster.readiness_id,
      confirmation_code: roster.confirmation_code,
      mpwr_confirmation_number: roster.mpwr_confirmation_number,
      vehicle_label: vehicleLabel,
      vehicle_number: vehicleNumber,
      checkout_mileage: checkoutMileage,
      checkout_engine_hours: checkoutEngineHours,
      checkout_status: "assigned",
      assigned_by_profile_id: profile?.id ?? null,
      assigned_by_name: profile?.display_name ?? "Epic Workstation",
      assigned_at: now,
      updated_at: now,
      last_error: null,
    };

    if (existing) {
      const filters = new URLSearchParams({ id: `eq.${existing.id}` });
      await supabasePatch("tour_vehicle_dispatches", filters, assignment);
    } else {
      await supabaseInsert("tour_vehicle_dispatches", {
        store_visit_id: storeVisitId,
        vehicle_slot: vehicleSlot,
        ...assignment,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Tour dispatch assignment failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save vehicle assignment." },
      { status: 500 },
    );
  }
}
