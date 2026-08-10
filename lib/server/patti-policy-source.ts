import { resolvePattiCancellationPolicy, type PattiPolicyDecision } from "@/lib/cancellation-policy-auto";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type WebhookEventRow = {
  id: string;
  received_at: string;
  payload: Record<string, unknown> | null;
};

type TripWorksAddon = {
  name?: string | null;
  experience_addon?: {
    id?: number | null;
    title?: string | null;
  } | null;
};

type TripReservedPayload = {
  confirmation_code?: string | null;
  reserved_at?: string | null;
  tripOrders?: Array<{
    bookings?: Array<{
      addons?: TripWorksAddon[] | null;
    }> | null;
  }> | null;
};

function unwrapPayload(value: Record<string, unknown> | null): TripReservedPayload | null {
  if (!value) return null;
  const nested = value.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as TripReservedPayload;
  }
  return value as TripReservedPayload;
}

function collectBookingAddons(payload: TripReservedPayload) {
  const addons: TripWorksAddon[] = [];
  for (const order of payload.tripOrders ?? []) {
    for (const booking of order.bookings ?? []) {
      addons.push(...(booking.addons ?? []));
    }
  }
  return addons;
}

async function queryTripReservedEvents(confirmationCode: string, wrapped: boolean) {
  const params = new URLSearchParams({
    select: "id,received_at,payload",
    event_type: "eq.trip_reserved",
    order: "received_at.asc",
    limit: "20",
  });
  params.set(
    wrapped ? "payload->payload->>confirmation_code" : "payload->>confirmation_code",
    `eq.${confirmationCode}`,
  );
  return supabaseSelect<WebhookEventRow>("webhook_events", params);
}

export async function getPattiPolicyDecision(
  confirmationCode: string,
  activityStartAt: string,
): Promise<PattiPolicyDecision> {
  let events = await queryTripReservedEvents(confirmationCode, false);
  if (!events.length) events = await queryTripReservedEvents(confirmationCode, true);

  for (const event of events) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;

    const decision = resolvePattiCancellationPolicy({
      reservationCreatedAt: payload.reserved_at || event.received_at,
      activityStartAt,
      bookingAddons: collectBookingAddons(payload),
    });

    if (decision.status) return decision;
  }

  return {
    status: null,
    source: "manual_fallback",
    hoursBetweenReservationAndStart: null,
    tripSafeSelection: "unknown",
  };
}
