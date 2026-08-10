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
};

type TripWorksPayload = {
  confirmation_code?: string | null;
  reserved_at?: string | null;
  tripOrders?: TripWorksTripOrder[] | null;
};

type PattiStoreVisitRow = {
  business_line: string | null;
  visit_start_time: string | null;
  source_trip_order_ids: Array<string | number> | null;
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

function collectBookingAddons(payload: TripWorksPayload, sourceTripOrderIds?: Set<string>) {
  const addons: TripWorksAddon[] = [];
  for (const order of payload.tripOrders ?? []) {
    if (sourceTripOrderIds?.size && !sourceTripOrderIds.has(String(order.id ?? ""))) continue;
    for (const booking of order.bookings ?? []) {
      addons.push(...(booking.addons ?? []));
    }
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

function rentalStoreVisitSelection(payload: TripWorksPayload, sourceTripOrderIds: Set<string>): TripSafeSelection {
  const selections: TripSafeSelection[] = [];

  for (const order of payload.tripOrders ?? []) {
    if (!sourceTripOrderIds.has(String(order.id ?? ""))) continue;
    selections.push(tripSafeSelection(collectBookingAddons({ tripOrders: [order] })));
  }

  if (!selections.length || selections.some((selection) => selection === "unknown")) return "unknown";
  if (selections.some((selection) => selection === "declined")) return "declined";
  return selections.every((selection) => selection === "purchased") ? "purchased" : "unknown";
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

async function getRentalStoreVisitSourceOrderIds(confirmationCode: string, activityStartAt: string) {
  const rows = await supabaseSelect<PattiStoreVisitRow>(
    "portal_patti_store_visits",
    new URLSearchParams({
      select: "business_line,visit_start_time,source_trip_order_ids",
      confirmation_code: `eq.${confirmationCode}`,
      business_line: "eq.rental",
      limit: "20",
    }),
  );

  const target = new Date(activityStartAt).getTime();
  if (Number.isNaN(target)) return null;

  const match = rows.find((row) => {
    if (normalize(row.business_line) !== "rental" || !row.visit_start_time) return false;
    const start = new Date(row.visit_start_time).getTime();
    return !Number.isNaN(start) && Math.abs(start - target) < 60_000;
  });

  if (!match?.source_trip_order_ids?.length) return null;
  return new Set(match.source_trip_order_ids.map((id) => String(id)));
}

async function getLatestTripSafeSelection(
  confirmationCode: string,
  reservedEvents: WebhookEventRow[],
  rentalSourceTripOrderIds: Set<string> | null,
): Promise<TripSafeSelection> {
  const updates = await getEvents(confirmationCode, "trip_updated");
  const events = [...reservedEvents, ...updates].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
  );

  let latest: TripSafeSelection = "unknown";
  for (const event of events) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;
    const selection = rentalSourceTripOrderIds?.size
      ? rentalStoreVisitSelection(payload, rentalSourceTripOrderIds)
      : tripSafeSelection(collectBookingAddons(payload));
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
): Promise<PattiPolicyDecision> {
  const reservedEvents = await getEvents(confirmationCode, "trip_reserved");
  const rentalSourceTripOrderIds = await getRentalStoreVisitSourceOrderIds(confirmationCode, activityStartAt);
  const latestSelection = await getLatestTripSafeSelection(
    confirmationCode,
    reservedEvents,
    rentalSourceTripOrderIds,
  );

  for (const event of reservedEvents) {
    const payload = unwrapPayload(event.payload);
    if (!payload || payload.confirmation_code !== confirmationCode) continue;

    const bookingAddons = latestSelection === "unknown"
      ? collectBookingAddons(payload, rentalSourceTripOrderIds ?? undefined)
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
