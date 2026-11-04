import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { sendSlackChannelMessage } from "@/lib/server/slack";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

const checklist = [
  ["general","GENERAL CONDITION","body_panels","Body panels, bumpers and visible crash damage"],
  ["general","GENERAL CONDITION","windshield_mirrors_lights","Windshield, mirrors and lights"],
  ["general","GENERAL CONDITION","hardware_wiring","Loose or missing hardware; exposed or loose wiring"],
  ["tires","TIRES AND WHEELS","tire_condition","Tire condition, damage and tread"],
  ["tires","TIRES AND WHEELS","tire_pressures","Tire pressures"],
  ["tires","TIRES AND WHEELS","wheels_lugs","Wheels, lug nuts and visible damage"],
  ["fluids","FLUIDS, FILTERS AND LEAKS","fluid_levels","Engine oil and other applicable fluid levels"],
  ["fluids","FLUIDS, FILTERS AND LEAKS","fluid_leaks","Fluid leaks"],
  ["fluids","FLUIDS, FILTERS AND LEAKS","air_filter","Air filter and intake condition"],
  ["fluids","FLUIDS, FILTERS AND LEAKS","other_filters","Other applicable filters"],
  ["steering","STEERING, SUSPENSION AND DRIVETRAIN","steering_suspension","Steering and suspension components"],
  ["steering","STEERING, SUSPENSION AND DRIVETRAIN","ball_joints_hubs","Ball joints and hub bearings"],
  ["steering","STEERING, SUSPENSION AND DRIVETRAIN","axles_boots_drivetrain","Axles, boots and visible drivetrain components"],
  ["steering","STEERING, SUSPENSION AND DRIVETRAIN","torque_fasteners","Torque-critical fasteners checked to manufacturer specifications where required"],
  ["safety","SAFETY AND CABIN","seats_mounts","Seats and seat mounts"],
  ["safety","SAFETY AND CABIN","seat_belts","Seat belts and latches"],
  ["safety","SAFETY AND CABIN","brakes","Brakes and parking brake"],
  ["safety","SAFETY AND CABIN","dashboard_alerts","Warning lights and dashboard alerts"],
  ["electronics","ELECTRONICS","navigation","Navigation / GPS"],
  ["electronics","ELECTRONICS","stereo_comms","Stereo / communications"],
  ["electronics","ELECTRONICS","accessories_electrical","Other installed accessories and electrical functions"],
] as const;

async function actor(request: NextRequest) {
  return getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
}

async function postSlack(inspection:any, items:any[]) {
  const channelId = process.env.SLACK_FLEET_INSPECTIONS_CHANNEL_ID?.trim();
  if (!channelId) return { sent:false, method:"not_configured" as const, error:"Fleet inspection Slack channel is not configured." };
  const attention = items.filter((x:any)=>x.status==="needs_attention");
  const resultLabel = inspection.inspection_result === "out_of_service"
    ? "OUT OF SERVICE"
    : inspection.inspection_result === "needs_attention"
      ? "NEEDS ATTENTION"
      : "PASS";
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/,"");
  const url = base ? `${base}/team/fleet-maintenance/${inspection.vehicle_number}` : "";
  const text = [
    `*Vehicle Inspection Complete — Vehicle ${inspection.vehicle_number}*`,
    `Inspector: ${inspection.inspector_name || "Epic team"}`,
    `Type: ${inspection.inspection_type === "during_service" ? "During Service" : "Weekly"}`,
    `Result: *${resultLabel}*`,
    `Needs attention: ${attention.length}`,
    inspection.issues_damage_found ? `Issues / damage: ${inspection.issues_damage_found}` : null,
    inspection.assigned_to ? `Assigned to: ${inspection.assigned_to}` : null,
    url ? `Open inspection: ${url}` : null,
  ].filter(Boolean).join("\n");
  return sendSlackChannelMessage({ channelId, text });
}

export async function POST(request: NextRequest) {
  const p = await actor(request);
  if (!p) return NextResponse.json({ error:"Unauthorized." }, { status:401 });
  const body = await request.json().catch(()=>null) as any;
  const action = String(body?.action || "");
  const vehicleNumber = Number(body?.vehicleNumber);
  if (!Number.isInteger(vehicleNumber)) return NextResponse.json({ error:"Vehicle number required." }, { status:400 });

  if (action === "start") {
    const vehicles = await supabaseSelect<any>("fleet_vehicles", new URLSearchParams({ select:"*", vehicle_number:`eq.${vehicleNumber}`, limit:"1" }));
    const vehicle = vehicles[0];
    if (!vehicle) return NextResponse.json({ error:"Vehicle not found." }, { status:404 });
    const open = await supabaseSelect<any>("fleet_inspections", new URLSearchParams({ select:"*", vehicle_number:`eq.${vehicleNumber}`, status:"eq.in_progress", limit:"1" }));
    if (open[0]) return NextResponse.json({ error:"An inspection is already in progress for this vehicle." }, { status:409 });

    const inspectionType = body?.inspectionType === "during_service" ? "during_service" : "weekly";
    const inspection = await supabaseInsert<any>("fleet_inspections", {
      vehicle_id: vehicle.id,
      vehicle_number: vehicleNumber,
      inspection_type: inspectionType,
      status:"in_progress",
      mileage: vehicle.current_mileage,
      engine_hours: vehicle.current_engine_hours,
      inspector_profile_id:p.id,
      inspector_name:p.display_name,
      linked_service_record_id: typeof body?.serviceRecordId === "string" ? body.serviceRecordId : null,
      updated_at:new Date().toISOString(),
    });

    let order=1;
    for (const [category_code,category_label,item_code,label] of checklist) {
      await supabaseInsert("fleet_inspection_items", {
        inspection_id:inspection.id,
        category_code, category_label, item_code, label,
        status:"pending", sort_order:order++,
      });
    }
    return NextResponse.json({ ok:true, inspection });
  }

  if (action === "update_item") {
    const itemId=String(body?.itemId||"");
    const status=String(body?.status||"");
    if (!itemId || !new Set(["pending","pass","needs_attention","not_applicable"]).has(status)) {
      return NextResponse.json({ error:"Valid inspection item update required." }, { status:400 });
    }
    await supabasePatch("fleet_inspection_items", new URLSearchParams({ id:`eq.${itemId}` }), {
      status,
      notes: typeof body?.notes === "string" ? body.notes : null,
      updated_at:new Date().toISOString(),
    });
    return NextResponse.json({ ok:true });
  }

  if (action === "save") {
    const inspectionId=String(body?.inspectionId||"");
    if (!inspectionId) return NextResponse.json({ error:"Inspection required." }, { status:400 });
    const allowed = ["issues_damage_found","work_order_reference","assigned_to","target_completion_date","release_decision_notes","inspector_signature"];
    const patch:any={updated_at:new Date().toISOString()};
    for (const key of allowed) if (key in body) patch[key]=body[key] || null;
    if ("action_required" in body) patch.action_required=body.action_required || null;
    if ("inspection_result" in body) patch.inspection_result=body.inspection_result || null;
    if ("mileage" in body) patch.mileage=Number.isFinite(Number(body.mileage)) ? Number(body.mileage) : null;
    if ("engine_hours" in body) patch.engine_hours=Number.isFinite(Number(body.engine_hours)) ? Number(body.engine_hours) : null;
    await supabasePatch("fleet_inspections", new URLSearchParams({ id:`eq.${inspectionId}` }), patch);
    return NextResponse.json({ ok:true });
  }

  if (action === "complete") {
    const inspectionId=String(body?.inspectionId||"");
    if (!inspectionId) return NextResponse.json({ error:"Inspection required." }, { status:400 });
    const rows=await supabaseSelect<any>("fleet_inspections",new URLSearchParams({select:"*",id:`eq.${inspectionId}`,limit:"1"}));
    const inspection=rows[0];
    if(!inspection) return NextResponse.json({error:"Inspection not found."},{status:404});
    const items=await supabaseSelect<any>("fleet_inspection_items",new URLSearchParams({select:"*",inspection_id:`eq.${inspectionId}`,order:"sort_order.asc"}));
    if(items.some((x:any)=>x.status==="pending")) return NextResponse.json({error:"Mark every inspection item Pass, Needs Attention, or N/A before completing."},{status:409});

    const result=String(body?.inspectionResult||inspection.inspection_result||"");
    const actionRequired=String(body?.actionRequired||inspection.action_required||"");
    if(!new Set(["passed","needs_attention","out_of_service"]).has(result)) return NextResponse.json({error:"Inspection result is required."},{status:400});
    if(!new Set(["no_action","monitor","maintenance_repair","remove_from_service"]).has(actionRequired)) return NextResponse.json({error:"Action required is required."},{status:400});
    if(result==="needs_attention" && !String(body?.releaseDecisionNotes||inspection.release_decision_notes||"").trim()) {
      return NextResponse.json({error:"Document the release decision before completing a Needs Attention inspection."},{status:409});
    }
    if(result==="out_of_service" && actionRequired!=="remove_from_service") {
      return NextResponse.json({error:"Out of Service inspections must use Remove from service pending repair or safety review."},{status:409});
    }

    const at=new Date().toISOString();
    const patch:any={
      status:"completed",
      inspection_result:result,
      action_required:actionRequired,
      issues_damage_found:String(body?.issuesDamageFound||inspection.issues_damage_found||"").trim()||null,
      work_order_reference:String(body?.workOrderReference||inspection.work_order_reference||"").trim()||null,
      assigned_to:String(body?.assignedTo||inspection.assigned_to||"").trim()||null,
      target_completion_date:body?.targetCompletionDate||inspection.target_completion_date||null,
      release_decision_notes:String(body?.releaseDecisionNotes||inspection.release_decision_notes||"").trim()||null,
      inspector_signature:String(body?.inspectorSignature||p.display_name||"").trim(),
      completed_at:at,
      date_closed: result==="passed" ? at.slice(0,10) : null,
      updated_at:at,
    };
    await supabasePatch("fleet_inspections",new URLSearchParams({id:`eq.${inspectionId}`}),patch);

    const vehiclePatch:any={updated_at:at};
    if(inspection.inspection_type==="weekly") vehiclePatch.last_weekly_inspection_at=at;
    if(result==="out_of_service") {
      vehiclePatch.operational_status="out_of_service";
      vehiclePatch.status_reason="Inspection requires repair or safety review";
    }
    await supabasePatch("fleet_vehicles",new URLSearchParams({vehicle_number:`eq.${vehicleNumber}`}),vehiclePatch);

    const completed={...inspection,...patch};
    const slack=await postSlack(completed,items);
    await supabasePatch("fleet_inspections",new URLSearchParams({id:`eq.${inspectionId}`}),{
      slack_notification_status: slack.sent ? "sent" : slack.method==="not_configured" ? "not_configured" : "failed",
      slack_notification_error: slack.sent ? null : (slack.error || null),
      updated_at:new Date().toISOString(),
    });

    return NextResponse.json({ok:true,slack});
  }

  if (action === "manager_review") {
    if (p.role !== "admin" && p.role !== "manager") return NextResponse.json({error:"Manager access required."},{status:403});
    const inspectionId=String(body?.inspectionId||"");
    const review=String(body?.review||"").trim();
    if(!inspectionId || !review) return NextResponse.json({error:"Manager review note is required."},{status:400});
    const at=new Date().toISOString();
    await supabasePatch("fleet_inspections",new URLSearchParams({id:`eq.${inspectionId}`}),{
      fleet_manager_review:review,
      fleet_manager_profile_id:p.id,
      fleet_manager_name:p.display_name,
      fleet_manager_reviewed_at:at,
      date_closed: body?.close === true ? at.slice(0,10) : null,
      updated_at:at,
    });
    return NextResponse.json({ok:true});
  }

  return NextResponse.json({error:"Unsupported action."},{status:400});
}
