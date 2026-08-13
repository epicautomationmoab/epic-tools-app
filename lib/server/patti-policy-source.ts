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

type TripWorksBooking = {
  addons?: TripWorksAddon[] | null;
};

type TripWorksTripOrder = {
  id?: number | string | null;
  bookings?: TripWorksBooking[] | null;
  experience_timeslot?: {
    start_time?: string | null;
  } | null;
};

type TripWorksPayload = {
  confirmation_code?: string | null;
  reserved_at?: string | null;
  tripOrders?: TripWorksTripOrder[] | null;
};

type TripSafeSelection = "purchased" | "declined" | "unknown";

const TRIPSAFE_TITLE = "optional travel protection";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[’]/g, "'");
}

function unwrapPayload(value: Record<string, unknown> | null): TripWorksPayload | null {
  if (!value) return null;
  const nested = value.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as TripWorksPayload;
  }
  return value as TripWorksPayload;
}

function collectOrderAddons(order: TripWorksTripOrder) {
  const addons: TripWorksAddon[] = [];
  for (const booking of order.bookings ?? []) {
    addons.push(...(booking.addons ?? []));
  }
  return addons;
}

function tripSafeSelection(addons: TripWorksAddon[]): TripSafeSelection {
  const selections = new Set(
    addons
      .filter((addon) => normalize(addon.experience_addon?.title) === TRIPSAFE_TITLE)
      .map((addon) => normalize(addon.name))
      .map((name) => {
        if (!name.includes("tripsafe")) return "unknown" as const;
        if (name.startsWith("yes")) return "purchased" as const;
        if (name.startsWith("no")) return "declined" as const;
        return "unknown" as const;
      })
      .filter((selection) => selection !== "unknown"),
  );

  if (selections.size !== 1) return "unknown";
  return [...selections][0] as "purchased" | "declined";
}

function sameVisitStart(value: string | null | undefined, activityStartAt: string) {
  if (!value) return false;
  const left = new Date(value).getTime();
  const right = new Date(activityStartAt).getTime();
  return !Number.isNaN(left) && !Number.isNaN(right) && Math.abs(left - right) < 60_000;
}

function ordersForVisit(payload: TripWorksPayload, activityStartAt: string) {
  return (payload.tripOrders ?? []).filter((order) => sameVisitStart(order.experience_timeslot?.start_time, activityStartAt));
}

function visitTripSafeSelection(
  payload: TripWorksPayload,
  activityStartAt: string,
  businessLine?: string | null,
): TripSafeSelection {
  const orders = ordersForVisit(payload, activityStartAt);
  if (!orders.length) return "unknown";

  const selections = orders.map((order) => tripSafeSelection(collectOrderAddons(order)));

  if (normalize(businessLine) === "rental") {
    if (selections.some((selection) => selection === "declined")) return "declined";
    if (selections.every((selection) => selection === "purchased")) return "purchased";
    return "unknown";
  }

  const known = selections.filter((selection) => selection !== "unknown");
  if (!known.length) return "unknown";
  const unique = new Set(known);
  return unique.size === 1 ? known[0] : "unknown";
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

async function getLatestTripSafeSelection(
  confirmationCode: string,
  reservedEvents: WebhookEventRow[],
  activityStartAt: string,
  businessLine?: string | null,
): Promise<TripSafeSelection> {
  const updates = await getEvents(confirmationCode, "trip_updated");
  const events = [...reservedEvents, ...updates].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
  );

  let latest: TripSafeSelection = "unknown";
  for (const event of events) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;
    const selection = visitTripSafeSelection(payload, activityStartAt, businessLine);
    if (selection !== "unknown") latest = selection;
  }

  return latest;
}

function addonsForSelection(selection: "purchased" | "declined"): TripWorksAddon[] {
  return [{
    name: selection === "purchased" ? "Yes, please add TripSafe" : "No, don't add TripSafe",
    experience_addon: { title: "Optional Travel Protection" },
  }];
}

export async function getPattiPolicyDecision(
  confirmationCode: string,
  activityStartAt: string,
  businessLine?: string | null,
): Promise<PattiPolicyDecision> {
  const reservedEvents = await getEvents(confirmationCode, "trip_reserved");
  const latestSelection = await getLatestTripSafeSelection(
    confirmationCode,
    reservedEvents,
    activityStartAt,
    businessLine,
  );

  for (const event of reservedEvents) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;

    const visitOrders = ordersForVisit(payload, activityStartAt);
    const bookingAddons = latestSelection === "unknown"
      ? visitOrders.flatMap((order) => collectOrderAddons(order))
      : addonsForSelection(latestSelection);

    const decision = resolvePattiCancellationPolicy({
      reservationCreatedAt: payload.reserved_at || event.received_at,
      activityStartAt,
      bookingAddons,
    });

    if (decision.status) return decision;
  }

  if (latestSelection !== "unknown") {
    return {
      status: latestSelection,
      source: latestSelection === "purchased" ? "tripsafe_purchased" : "tripsafe_declined",
      hoursBetweenReservationAndStart: null,
      tripSafeSelection: latestSelection,
    };
  }

  return {
    status: null,
    source: "manual_fallback",
    hoursBetweenReservationAndStart: null,
    tripSafeSelection: "unknown",
  };
}
