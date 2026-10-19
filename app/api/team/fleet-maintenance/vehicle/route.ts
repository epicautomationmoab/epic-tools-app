import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

async function manager(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || !["admin","manager"].includes(profile.role)) return null;
  return profile;
}

export async function PATCH(request: NextRequest) {
  const profile = await manager(request);
  if (!profile) return NextResponse.json({ error: "Manager access required." }, { status: 403 });

  const body = await request.json().catch(() => null) as any;
  const vehicleNumber = Number(body?.vehicleNumber);
  if (!Number.isInteger(vehicleNumber) || vehicleNumber < 1) {
    return NextResponse.json({ error: "Valid vehicle number required." }, { status: 400 });
  }

  const allowedStates = new Set(["available","soft_blackout","hard_blackout","out_for_service"]);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of ["vin","mpwr_vehicle_reference","booking_resource_id","booking_resource_name","status_reason","booking_inventory_reason","in_service_date"]) {
    if (key in (body || {})) updates[key] = body[key] === "" ? null : body[key];
  }
  for (const key of ["current_mileage","current_engine_hours","last_service_mileage"]) {
    if (key in (body || {})) updates[key] = body[key] === "" || body[key] == null ? null : Number(body[key]);
  }

  let previousInventoryState: string | null = null;
  let vehicleId: string | null = null;
  if ("booking_inventory_state" in (body || {})) {
    const current = await supabaseSelect<{id:string;booking_inventory_state:string}>("fleet_vehicles", new URLSearchParams({ select:"id,booking_inventory_state", vehicle_number:`eq.${vehicleNumber}`, limit:"1" }));
    vehicleId = current[0]?.id ?? null;
    previousInventoryState = current[0]?.booking_inventory_state ?? null;
    if (!allowedStates.has(body.booking_inventory_state)) {
      return NextResponse.json({ error: "Invalid inventory state." }, { status: 400 });
    }
    updates.booking_inventory_state = body.booking_inventory_state;
    updates.booking_sync_status = "pending";
    if (body.booking_inventory_state === "out_for_service") updates.operational_status = "out_of_service";
    else if (body.booking_inventory_state === "available" && body.operational_status !== "repair") updates.operational_status = "available";
  }

  await supabasePatch("fleet_vehicles", new URLSearchParams({ vehicle_number: `eq.${vehicleNumber}` }), updates);

  if ("booking_inventory_state" in (body || {}) && vehicleId && previousInventoryState !== body.booking_inventory_state) {
    await supabaseInsert("fleet_inventory_events", {
      vehicle_id: vehicleId,
      vehicle_number: vehicleNumber,
      previous_state: previousInventoryState,
      new_state: body.booking_inventory_state,
      reason: typeof body.booking_inventory_reason === "string" ? body.booking_inventory_reason : null,
      changed_by_profile_id: profile.id,
      changed_by_name: profile.display_name,
    });
  }

  return NextResponse.json({ ok: true });
}
