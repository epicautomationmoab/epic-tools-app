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

type TripWorksPayload = {
  confirmation_code?: string | null;
  reserved_at?: string | null;
  tripOrders?: Array<{
    bookings?: Array<{
      addons?: TripWorksAddon[] | null;
    }> | null;
  }> | null;
};

const TRIPSAFE_ADDON_ID = 6451;
const PURCHASED = "Yes, please add TripSafe";
const DECLINED = "No, do not add TripSafe";

function unwrapPayload(value: Record<string, unknown> | null): TripWorksPayload | null {
  if (!value) return null;
  const nested = value.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as TripWorksPayload;
  }
  return value as TripWorksPayload;
}

function collectBookingAddons(payload: TripWorksPayload) {
  const addons: TripWorksAddon[] = [];
  for (const order of payload.tripOrders ?? []) {
    for (const booking of order.bookings ?? []) {
      addons.push(...(booking.addons ?? []));
    }
  }
  return addons;
}

function tripSafeSelection(addons: TripWorksAddon[]): "purchased" | "declined" | "unknown" {
  const selections = new Set(
    addons
      .filter((addon) => addon.experience_addon?.id === TRIPSAFE_ADDON_ID)
      .map((addon) => addon.name)
      .filter((name): name is string => name === PURCHASED || name === DECLINED),
  );
  if (selections.size !== 1) return "unknown";
  return selections.has(PURCHASED) ? "purchased" : "declined";
}

async function queryEvents(confirmationCode: string, eventType: "trip_reserved" | "trip_updated", wrapped: boolean) {
  const params = new URLSearchParams({
    select: "id,received_at,payload",
    event_type: `eq.${eventType}`,
    order: "received_at.asc",
    limit: "100",
  });
  params.set(
    wrapped ? "payload->payload->>confirmation_code" : "payload->>confirmation_code",
    `eq.${confirmationCode}`,
  );
  return supabaseSelect<WebhookEventRow>("webhook_events", params);
}

async function getEvents(confirmationCode: string, eventType: "trip_reserved" | "trip_updated") {
  let events = await queryEvents(confirmationCode, eventType, false);
  if (!events.length) events = await queryEvents(confirmationCode, eventType, true);
  return events;
}

async function recoverTripSafeFromUpdates(confirmationCode: string) {
  const events = await getEvents(confirmationCode, "trip_updated");
  let recovered: "purchased" | "declined" | "unknown" = "unknown";

  for (const event of events) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;
    const selection = tripSafeSelection(collectBookingAddons(payload));
    if (selection === "unknown") continue;
    if (recovered !== "unknown" && recovered !== selection) return "unknown";
    recovered = selection;
  }

  return recovered;
}

function addonsForSelection(selection: "purchased" | "declined") : TripWorksAddon[] {
  return [{
    name: selection === "purchased" ? PURCHASED : DECLINED,
    experience_addon: { id: TRIPSAFE_ADDON_ID, title: "Optional Travel Protection" },
  }];
}

export async function getPattiPolicyDecision(
  confirmationCode: string,
  activityStartAt: string,
): Promise<PattiPolicyDecision> {
  const reservedEvents = await getEvents(confirmationCode, "trip_reserved");

  for (const event of reservedEvents) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;

    let bookingAddons = collectBookingAddons(payload);
    let selection = tripSafeSelection(bookingAddons);

    if (selection === "unknown") {
      selection = await recoverTripSafeFromUpdates(confirmationCode);
      if (selection !== "unknown") bookingAddons = addonsForSelection(selection);
    }

    const decision = resolvePattiCancellationPolicy({
      reservationCreatedAt: payload.reserved_at || event.received_at,
      activityStartAt,
      bookingAddons,
    });

    if (decision.status) return decision;
  }

  // Older reservations may predate our trip_reserved webhook history. For future
  // active reservations in that group, the original booking was made well outside
  // the cancellation window, so only TripSafe yes/no needs to be recovered.
  const recoveredSelection = await recoverTripSafeFromUpdates(confirmationCode);
  if (recoveredSelection !== "unknown") {
    return {
      status: recoveredSelection,
      source: recoveredSelection === "purchased" ? "tripsafe_purchased" : "tripsafe_declined",
      hoursBetweenReservationAndStart: null,
      tripSafeSelection: recoveredSelection,
    };
  }

  return {
    status: null,
    source: "manual_fallback",
    hoursBetweenReservationAndStart: null,
    tripSafeSelection: "unknown",
  };
}
