import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type OperationalReservation = {
  confirmation_code: string;
  reserved_at: string | null;
  latest_payload: Record<string, unknown> | null;
  trip_payload: Record<string, unknown> | null;
};

type ReadinessCandidate = {
  readiness_id?: string;
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  business_line: string;
  product_display_name: string;
  rental_duration?: string | null;
  expected_guest_count: number | null;
  total_vehicle_count?: number | null;
  vehicle_breakdown?: Array<{ model: string; quantity: number }> | null;
  epic_document_count_label: string;
  epic_document_count_color: string;
  mpwr_confirmation_number: string | null;
  amount_due_cents: number | null;
  is_paid: boolean | null;
  ohv_required: boolean | null;
  ohv_certificate_uploaded: boolean | null;
  attention_flags: string[] | null;
  tripworks_booking_url: string | null;
  mpwr_reservation_url: string | null;
  epic_document_signers: Array<{ name: string }> | null;
  mpwr_waivers: Array<{ name: string }> | null;
};

function creatorId(payload: Record<string, unknown> | null) {
  const creator = payload?.created_by_user_avatar;
  if (!creator || typeof creator !== "object") return null;
  const id = (creator as { id?: unknown }).id;
  if (typeof id === "number") return id;
  if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);
  return null;
}

function quotedIn(values: string[]) {
  return `in.(${values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (profile.role === "workstation" || !profile.tripworks_user_id) {
    return NextResponse.json({ candidates: [] });
  }

  const rawSince = request.nextUrl.searchParams.get("since");
  const since = rawSince ? new Date(rawSince) : new Date(Date.now() - 30_000);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since timestamp." }, { status: 400 });
  }

  try {
    const reservations = await supabaseSelect<OperationalReservation>(
      "operational_reservations",
      new URLSearchParams({
        select: "confirmation_code,reserved_at,latest_payload,trip_payload",
        reserved_at: `gte.${since.toISOString()}`,
        order: "reserved_at.asc",
        limit: "100",
      }),
    );

    const matchingConfirmations = [...new Set(
      reservations
        .filter((reservation) => {
          const payload = reservation.latest_payload ?? reservation.trip_payload;
          return creatorId(payload) === profile.tripworks_user_id;
        })
        .map((reservation) => reservation.confirmation_code)
        .filter(Boolean),
    )];

    if (!matchingConfirmations.length) {
      return NextResponse.json({ candidates: [] });
    }

    const candidates = await supabaseSelect<ReadinessCandidate>(
      "guest_readiness_with_handoff_v",
      new URLSearchParams({
        select: "*",
        confirmation_code: quotedIn(matchingConfirmations),
        order: "visit_start_time.asc",
        limit: "100",
      }),
    );

    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load cancellation popup candidates." },
      { status: 500 },
    );
  }
}
