import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type Workflow = {
  id: string;
  workflow_status: string;
  metadata: Record<string, unknown> | null;
};

async function loadWorkflow(caseId: string) {
  const rows = await supabaseSelect<Workflow>("operational_case_workflows", new URLSearchParams({
    select: "id,workflow_status,metadata",
    case_id: `eq.${caseId}`,
    workflow_type: "eq.damage_documentation",
    limit: "1",
  }));
  return rows[0] ?? null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { caseId } = await context.params;
    const workflow = await loadWorkflow(caseId);
    if (!workflow) return NextResponse.json({ error: "Damage documentation workflow not found." }, { status: 404 });
    const items = await supabaseSelect("operational_case_damage_items", new URLSearchParams({
      select: "id,item_order,area_component,description,disposition,possible_hidden_damage,internal_notes,created_at,updated_at",
      case_id: `eq.${caseId}`,
      workflow_id: `eq.${workflow.id}`,
      order: "item_order.asc,created_at.asc",
    }));
    return NextResponse.json({ workflow, items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load damage documentation." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { caseId } = await context.params;
    const workflow = await loadWorkflow(caseId);
    if (!workflow) return NextResponse.json({ error: "Damage documentation workflow not found." }, { status: 404 });

    const body = await request.json() as {
      action?: "save_summary" | "add_item" | "update_item" | "complete";
      mileage?: string | number | null;
      engineHours?: string | number | null;
      vehicleStatus?: "rentable" | "hold_for_inspection" | "down";
      generalNotes?: string;
      itemId?: string;
      areaComponent?: string;
      description?: string;
      disposition?: "inspect" | "repair" | "replace" | "unknown";
      possibleHiddenDamage?: boolean;
      internalNotes?: string;
    };

    const now = new Date().toISOString();

    if (body.action === "save_summary") {
      const metadata = {
        ...(workflow.metadata ?? {}),
        mileage: body.mileage === "" ? null : body.mileage ?? null,
        engine_hours: body.engineHours === "" ? null : body.engineHours ?? null,
        vehicle_status: body.vehicleStatus ?? "hold_for_inspection",
        general_notes: body.generalNotes?.trim() || null,
        last_saved_by: actor.actorName,
        last_saved_at: now,
      };
      await supabasePatch("operational_case_workflows", new URLSearchParams({ id: `eq.${workflow.id}` }), {
        workflow_status: "in_progress",
        metadata,
        updated_at: now,
      });
      return NextResponse.json({ ok: true, metadata });
    }

    if (body.action === "add_item") {
      const existing = await supabaseSelect<{ id: string }>("operational_case_damage_items", new URLSearchParams({
        select: "id",
        case_id: `eq.${caseId}`,
        workflow_id: `eq.${workflow.id}`,
      }));
      const item = await supabaseInsert("operational_case_damage_items", {
        case_id: caseId,
        workflow_id: workflow.id,
        item_order: existing.length,
        area_component: body.areaComponent?.trim() || null,
        description: body.description?.trim() || null,
        disposition: body.disposition ?? "unknown",
        possible_hidden_damage: body.possibleHiddenDamage ?? false,
        internal_notes: body.internalNotes?.trim() || null,
        created_by: actor.actorName,
      });
      return NextResponse.json({ ok: true, item });
    }

    if (body.action === "update_item") {
      if (!body.itemId) return NextResponse.json({ error: "Damage item is required." }, { status: 400 });
      const rows = await supabaseSelect<{ id: string }>("operational_case_damage_items", new URLSearchParams({
        select: "id",
        id: `eq.${body.itemId}`,
        case_id: `eq.${caseId}`,
        workflow_id: `eq.${workflow.id}`,
        limit: "1",
      }));
      if (!rows[0]) return NextResponse.json({ error: "Damage item not found." }, { status: 404 });
      await supabasePatch("operational_case_damage_items", new URLSearchParams({ id: `eq.${body.itemId}` }), {
        area_component: body.areaComponent?.trim() || null,
        description: body.description?.trim() || null,
        disposition: body.disposition ?? "unknown",
        possible_hidden_damage: body.possibleHiddenDamage ?? false,
        internal_notes: body.internalNotes?.trim() || null,
        updated_at: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "complete") {
      const metadata = {
        ...(workflow.metadata ?? {}),
        mileage: body.mileage === "" ? null : body.mileage ?? (workflow.metadata?.mileage ?? null),
        engine_hours: body.engineHours === "" ? null : body.engineHours ?? (workflow.metadata?.engine_hours ?? null),
        vehicle_status: body.vehicleStatus ?? workflow.metadata?.vehicle_status ?? "hold_for_inspection",
        general_notes: body.generalNotes?.trim() || workflow.metadata?.general_notes || null,
        completed_by: actor.actorName,
      };
      await supabasePatch("operational_case_workflows", new URLSearchParams({ id: `eq.${workflow.id}` }), {
        workflow_status: "completed",
        metadata,
        completed_at: now,
        updated_at: now,
      });
      await supabasePatch("operational_cases", new URLSearchParams({ id: `eq.${caseId}` }), {
        status: "follow_up",
        updated_at: now,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save damage documentation." }, { status: 500 });
  }
}
