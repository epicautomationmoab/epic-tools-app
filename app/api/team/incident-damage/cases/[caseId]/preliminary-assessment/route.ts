import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type Assessment = {
  id: string;
  case_id: string;
  damage_item_id: string;
  assessment_status: string;
  recommended_action: string;
  parts_estimate: number | string;
  labor_hours: number | string | null;
  labor_rate: number | string | null;
  labor_estimate: number | string;
  miscellaneous_estimate: number | string;
  confidence: string;
  teardown_required: boolean;
  assessment_notes: string | null;
  assessed_by: string | null;
  assessed_at: string | null;
};

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

function nullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function validateDamageItem(caseId: string, damageItemId: string) {
  const rows = await supabaseSelect<{ id: string }>("operational_case_damage_items", new URLSearchParams({
    select: "id",
    id: `eq.${damageItemId}`,
    case_id: `eq.${caseId}`,
    limit: "1",
  }));
  return Boolean(rows[0]);
}

export async function GET(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { caseId } = await context.params;
    const assessments = await supabaseSelect<Assessment>("operational_case_damage_assessments", new URLSearchParams({
      select: "id,case_id,damage_item_id,assessment_status,recommended_action,parts_estimate,labor_hours,labor_rate,labor_estimate,miscellaneous_estimate,confidence,teardown_required,assessment_notes,assessed_by,assessed_at",
      case_id: `eq.${caseId}`,
      order: "created_at.asc",
    }));
    return NextResponse.json({ assessments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load preliminary assessment." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { caseId } = await context.params;
    const body = await request.json() as {
      damageItemId?: string;
      assessmentStatus?: "unassessed" | "preliminary" | "final";
      recommendedAction?: "inspect" | "repair" | "replace" | "unknown";
      partsEstimate?: number | string;
      laborHours?: number | string | null;
      laborRate?: number | string | null;
      miscellaneousEstimate?: number | string;
      confidence?: "low" | "medium" | "high";
      teardownRequired?: boolean;
      assessmentNotes?: string;
    };

    const damageItemId = String(body.damageItemId || "").trim();
    if (!damageItemId) return NextResponse.json({ error: "Damage area is required." }, { status: 400 });
    if (!(await validateDamageItem(caseId, damageItemId))) return NextResponse.json({ error: "Damage area not found." }, { status: 404 });

    const partsEstimate = money(body.partsEstimate);
    const laborHours = nullableNumber(body.laborHours);
    const laborRate = nullableNumber(body.laborRate);
    const laborEstimate = laborHours !== null && laborRate !== null ? money(laborHours * laborRate) : 0;
    const miscellaneousEstimate = money(body.miscellaneousEstimate);
    const now = new Date().toISOString();

    const existing = await supabaseSelect<Assessment>("operational_case_damage_assessments", new URLSearchParams({
      select: "id,case_id,damage_item_id,assessment_status,recommended_action,parts_estimate,labor_hours,labor_rate,labor_estimate,miscellaneous_estimate,confidence,teardown_required,assessment_notes,assessed_by,assessed_at",
      case_id: `eq.${caseId}`,
      damage_item_id: `eq.${damageItemId}`,
      limit: "1",
    }));

    const values = {
      assessment_status: body.assessmentStatus ?? "preliminary",
      recommended_action: body.recommendedAction ?? "unknown",
      parts_estimate: partsEstimate,
      labor_hours: laborHours,
      labor_rate: laborRate,
      labor_estimate: laborEstimate,
      miscellaneous_estimate: miscellaneousEstimate,
      confidence: body.confidence ?? "low",
      teardown_required: body.teardownRequired ?? false,
      assessment_notes: body.assessmentNotes?.trim() || null,
      assessed_by: actor.actorName,
      assessed_at: now,
      updated_at: now,
    };

    if (existing[0]) {
      await supabasePatch("operational_case_damage_assessments", new URLSearchParams({ id: `eq.${existing[0].id}` }), values);
      return NextResponse.json({ ok: true, assessment: { ...existing[0], ...values } });
    }

    const assessment = await supabaseInsert<Assessment>("operational_case_damage_assessments", {
      case_id: caseId,
      damage_item_id: damageItemId,
      ...values,
    });
    return NextResponse.json({ ok: true, assessment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save preliminary assessment." }, { status: 500 });
  }
}
