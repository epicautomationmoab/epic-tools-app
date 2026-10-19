import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabasePatch } from "@/lib/server/supabase-rest";

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

  if ("booking_inventory_state" in (body || {})) {
    if (!allowedStates.has(body.booking_inventory_state)) {
      return NextResponse.json({ error: "Invalid inventory state." }, { status: 400 });
    }
    updates.booking_inventory_state = body.booking_inventory_state;
    updates.booking_sync_status = "pending";
    if (body.booking_inventory_state === "out_for_service") updates.operational_status = "out_of_service";
    else if (body.booking_inventory_state === "available" && body.operational_status !== "repair") updates.operational_status = "available";
  }

  await supabasePatch("fleet_vehicles", new URLSearchParams({ vehicle_number: `eq.${vehicleNumber}` }), updates);
  return NextResponse.json({ ok: true });
}
