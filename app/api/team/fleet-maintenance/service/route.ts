import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

const serviceItems = [
  ["engine_oil_filter","Engine oil and oil filter","Change",null],
  ["front_diff","Front differential oil","Change",null],
  ["rear_diff","Rear differential oil","Change",null],
  ["transmission","Transmission oil","Change",null],
  ["engine_air_filter","Engine air filter","Clean or replace",null],
  ["drive_belt","Drive belt","Inspect and replace as necessary",null],
  ["hvac_cabin_filters","HVAC cabin filters","Clean or replace","Xpedition"],
  ["tires","Tires","Rotate and replace as necessary",null],
] as const;

async function profile(request: NextRequest) {
  return getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
}

export async function POST(request: NextRequest) {
  const actor = await profile(request);
  if (!actor) return NextResponse.json({ error:"Unauthorized." }, { status:401 });
  const body = await request.json().catch(()=>null) as any;
  const action = String(body?.action || "");
  const vehicleNumber = Number(body?.vehicleNumber);
  if (!Number.isInteger(vehicleNumber)) return NextResponse.json({ error:"Vehicle number required." }, { status:400 });

  if (action === "start") {
    const vehicles = await supabaseSelect<any>("fleet_vehicles", new URLSearchParams({ select:"*", vehicle_number:`eq.${vehicleNumber}`, limit:"1" }));
    const vehicle = vehicles[0];
    if (!vehicle) return NextResponse.json({ error:"Vehicle not found." }, { status:404 });

    const open = await supabaseSelect<any>("fleet_service_records", new URLSearchParams({
      select:"*", vehicle_number:`eq.${vehicleNumber}`, status:"in.(open,in_progress)", limit:"1"
    }));
    if (open[0]) return NextResponse.json({ error:"An open 1,000-mile service already exists.", service:open[0] }, { status:409 });

    const dueMileage = vehicle.last_service_mileage == null ? 1000 : Number(vehicle.last_service_mileage) + Number(vehicle.service_interval_miles || 1000);
    const service = await supabaseInsert<any>("fleet_service_records", {
      vehicle_id: vehicle.id,
      vehicle_number: vehicleNumber,
      service_type: "1000_mile",
      status: "in_progress",
      due_mileage: dueMileage,
      start_mileage: vehicle.current_mileage,
      technician_profile_id: actor.id,
      technician_name: actor.display_name,
      started_at: new Date().toISOString(),
      created_by_profile_id: actor.id,
      created_by_name: actor.display_name,
      updated_at: new Date().toISOString(),
    });

    let order = 1;
    for (const [item_code,label,action_text,model_scope] of serviceItems) {
      if (model_scope === "Xpedition" && vehicle.model_family !== "Xpedition") continue;
      await supabaseInsert("fleet_service_record_items", {
        service_record_id: service.id,
        item_code,
        label,
        action_text,
        model_scope,
        status:"pending",
        sort_order:order++,
      });
    }

    return NextResponse.json({ ok:true, service });
  }

  if (action === "update_item") {
    const itemId = String(body?.itemId || "");
    const status = String(body?.status || "");
    const allowed = new Set(["pending","completed","not_applicable","needs_attention"]);
    if (!itemId || !allowed.has(status)) return NextResponse.json({ error:"Valid checklist update required." }, { status:400 });
    await supabasePatch("fleet_service_record_items", new URLSearchParams({ id:`eq.${itemId}` }), {
      status,
      notes: typeof body.notes === "string" ? body.notes : null,
      updated_at:new Date().toISOString(),
    });
    return NextResponse.json({ ok:true });
  }

  if (action === "update_service") {
    const serviceId = String(body?.serviceId || "");
    if (!serviceId) return NextResponse.json({ error:"Service record required." }, { status:400 });
    const patch: Record<string,unknown> = { updated_at:new Date().toISOString() };
    for (const key of ["parts_and_fluids_used","additional_concerns"]) {
      if (key in body) patch[key] = body[key] === "" ? null : body[key];
    }
    for (const key of ["mpwr_documented","full_inspection_completed"]) {
      if (key in body) patch[key] = Boolean(body[key]);
    }
    await supabasePatch("fleet_service_records", new URLSearchParams({ id:`eq.${serviceId}` }), patch);
    return NextResponse.json({ ok:true });
  }

  if (action === "complete") {
    const serviceId = String(body?.serviceId || "");
    const completionMileage = Number(body?.completionMileage);
    if (!serviceId || !Number.isFinite(completionMileage) || completionMileage < 0) {
      return NextResponse.json({ error:"Completion mileage is required." }, { status:400 });
    }
    const services = await supabaseSelect<any>("fleet_service_records", new URLSearchParams({ select:"*", id:`eq.${serviceId}`, limit:"1" }));
    const service = services[0];
    if (!service) return NextResponse.json({ error:"Service record not found." }, { status:404 });
    const items = await supabaseSelect<any>("fleet_service_record_items", new URLSearchParams({ select:"*", service_record_id:`eq.${serviceId}` }));
    if (items.some((x:any)=>x.status === "pending")) return NextResponse.json({ error:"Complete or mark every checklist item before closing service." }, { status:409 });
    if (!service.full_inspection_completed) return NextResponse.json({ error:"The required full mechanical inspection must be completed before closing service." }, { status:409 });
    if (!service.mpwr_documented) return NextResponse.json({ error:"Confirm the service is documented in Polaris M Power before closing." }, { status:409 });

    const at = new Date().toISOString();
    await supabasePatch("fleet_service_records", new URLSearchParams({ id:`eq.${serviceId}` }), {
      status:"completed",
      completion_mileage:completionMileage,
      completed_at:at,
      updated_at:at,
    });
    await supabasePatch("fleet_vehicles", new URLSearchParams({ vehicle_number:`eq.${vehicleNumber}` }), {
      current_mileage:completionMileage,
      last_service_mileage:completionMileage,
      last_service_at:at,
      updated_at:at,
    });
    return NextResponse.json({ ok:true });
  }

  return NextResponse.json({ error:"Unsupported action." }, { status:400 });
}
