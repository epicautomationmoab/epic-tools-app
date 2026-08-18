import { supabaseSelect } from "@/lib/server/supabase-rest";

export type ReadinessCandidate = {
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

type OperationalReservation = {
  confirmation_code: string;
  reserved_at: string | null;
  latest_payload: Record<string, unknown> | null;
  trip_payload: Record<string, unknown> | null;
};

const POPUP_RECONCILIATION_WINDOW_MS = 30 * 60 * 1000;

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

export async function getCancellationPopupCandidates(tripworksUserId: number, since: Date) {
  // TripWorks can arrive before the normalized Guest Readiness row is available.
  // Keep retrying recent salesperson bookings long enough for normalization to catch up.
  // The browser tracks readiness IDs it has already shown, so this wider reconciliation
  // window repairs missed timing without creating duplicate popups for the user.
  const reconciliationFloor = new Date(Date.now() - POPUP_RECONCILIATION_WINDOW_MS);
  const effectiveSince = since > reconciliationFloor ? since : reconciliationFloor;

  const reservations = await supabaseSelect<OperationalReservation>(
    "operational_reservations",
    new URLSearchParams({
      select: "confirmation_code,reserved_at,latest_payload,trip_payload",
      reserved_at: `gte.${effectiveSince.toISOString()}`,
      order: "reserved_at.asc",
      limit: "250",
    }),
  );

  const matchingConfirmations = [...new Set(
    reservations
      .filter((reservation) => {
        const payload = reservation.latest_payload ?? reservation.trip_payload;
        return creatorId(payload) === tripworksUserId;
      })
      .map((reservation) => reservation.confirmation_code)
      .filter(Boolean),
  )];

  if (!matchingConfirmations.length) return [];

  return supabaseSelect<ReadinessCandidate>(
    "guest_readiness_with_handoff_v",
    new URLSearchParams({
      select: "*",
      confirmation_code: quotedIn(matchingConfirmations),
      order: "visit_start_time.asc",
      limit: "250",
    }),
  );
}
