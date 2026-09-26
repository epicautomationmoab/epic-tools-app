import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseInsert, supabaseSelect } from "@/lib/server/supabase-rest";

type Reservation = {
  id: string;
  confirmation_code: string;
  business_line: string | null;
};

type CaseRow = { id: string };

export async function POST(request: NextRequest) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json() as {
      confirmationCode?: string;
      caseType?: "returned_damage" | "trail_response" | "beacon_activation";
      vehicleNumber?: string;
      note?: string;
    };

    const caseType = body.caseType;
    if (!caseType) return NextResponse.json({ error: "Case type is required." }, { status: 400 });

    const confirmationCode = body.confirmationCode?.trim().toUpperCase() || null;
    let reservation: Reservation | null = null;

    if (confirmationCode) {
      const rows = await supabaseSelect<Reservation>("operational_reservations", new URLSearchParams({
        select: "id,confirmation_code,business_line",
        confirmation_code: `eq.${confirmationCode}`,
        limit: "1",
      }));
      reservation = rows[0] ?? null;
      if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    } else if (caseType !== "beacon_activation") {
      return NextResponse.json({ error: "A reservation is required for this case type." }, { status: 400 });
    }

    const vehicleNumber = body.vehicleNumber?.trim() || null;
    if (caseType === "returned_damage" && !vehicleNumber) {
      return NextResponse.json({ error: "Vehicle number is required for a returned damage case." }, { status: 400 });
    }

    const existing = reservation ? await supabaseSelect<{ id: string }>("operational_cases", new URLSearchParams({
      select: "id",
      operational_reservation_id: `eq.${reservation.id}`,
      case_type: `eq.${caseType}`,
      status: "neq.closed",
      vehicle_number: vehicleNumber ? `eq.${vehicleNumber}` : "is.null",
      limit: "1",
    })) : [];

    if (existing[0]) return NextResponse.json({ ok: true, caseId: existing[0].id, existing: true });

    const created = await supabaseInsert<CaseRow>("operational_cases", {
      operational_reservation_id: reservation?.id ?? null,
      confirmation_code: reservation?.confirmation_code ?? null,
      business_line: reservation?.business_line ?? null,
      case_type: caseType,
      status: caseType === "beacon_activation" ? "active_response" : "open",
      vehicle_number: vehicleNumber,
      opened_by: actor.actorName,
      opened_by_profile_id: actor.actorId,
      metadata: body.note?.trim() ? { opening_note: body.note.trim() } : {},
    });

    if (caseType === "returned_damage") {
      await supabaseInsert("operational_case_workflows", {
        case_id: created.id,
        workflow_type: "damage_documentation",
        workflow_status: "in_progress",
        started_by: actor.actorName,
        started_at: new Date().toISOString(),
        metadata: {
          vehicle_status: "hold_for_inspection",
          mileage: null,
          engine_hours: null,
        },
      });
    }

    return NextResponse.json({ ok: true, caseId: created.id, existing: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create case." }, { status: 500 });
  }
}
