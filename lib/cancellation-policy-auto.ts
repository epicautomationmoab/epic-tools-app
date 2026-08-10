import type { TripSafeStatus } from "@/lib/cancellation-policy";

export type TripSafeAddonSelection = "purchased" | "declined" | "unknown";

export type PattiPolicyDecision = {
  status: TripSafeStatus | null;
  source: "inside_48_hours" | "tripsafe_purchased" | "tripsafe_declined" | "manual_fallback";
  hoursBetweenReservationAndStart: number | null;
  tripSafeSelection: TripSafeAddonSelection;
};

type TripWorksAddon = {
  name?: string | null;
  experience_addon?: {
    id?: number | null;
    title?: string | null;
  } | null;
};

const TRIPSAFE_EXPERIENCE_ADDON_TITLE = "optional travel protection";
const CANCELLATION_WINDOW_HOURS = 48;

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[’]/g, "'");
}

function selectionFromName(value: string | null | undefined): TripSafeAddonSelection {
  const name = normalize(value);
  if (!name.includes("tripsafe")) return "unknown";
  if (name.startsWith("yes")) return "purchased";
  if (name.startsWith("no")) return "declined";
  return "unknown";
}

export function getTripSafeSelection(addons: TripWorksAddon[] | null | undefined): TripSafeAddonSelection {
  const selections = new Set(
    (addons ?? [])
      .filter((addon) => normalize(addon.experience_addon?.title) === TRIPSAFE_EXPERIENCE_ADDON_TITLE)
      .map((addon) => selectionFromName(addon.name))
      .filter((selection) => selection !== "unknown"),
  );

  if (selections.size !== 1) return "unknown";
  return [...selections][0] as TripSafeAddonSelection;
}

export function resolvePattiCancellationPolicy(input: {
  reservationCreatedAt?: string | null;
  activityStartAt?: string | null;
  bookingAddons?: TripWorksAddon[] | null;
}): PattiPolicyDecision {
  const reservedAt = input.reservationCreatedAt ? new Date(input.reservationCreatedAt) : null;
  const activityStart = input.activityStartAt ? new Date(input.activityStartAt) : null;
  const validReservedAt = reservedAt && !Number.isNaN(reservedAt.getTime()) ? reservedAt : null;
  const validActivityStart = activityStart && !Number.isNaN(activityStart.getTime()) ? activityStart : null;
  const tripSafeSelection = getTripSafeSelection(input.bookingAddons);

  if (validReservedAt && validActivityStart) {
    const hoursBetweenReservationAndStart =
      (validActivityStart.getTime() - validReservedAt.getTime()) / (60 * 60 * 1000);

    if (hoursBetweenReservationAndStart >= 0 && hoursBetweenReservationAndStart < CANCELLATION_WINDOW_HOURS) {
      return {
        status: "confirmed_within_48",
        source: "inside_48_hours",
        hoursBetweenReservationAndStart,
        tripSafeSelection,
      };
    }

    if (hoursBetweenReservationAndStart >= CANCELLATION_WINDOW_HOURS) {
      if (tripSafeSelection === "purchased") {
        return {
          status: "purchased",
          source: "tripsafe_purchased",
          hoursBetweenReservationAndStart,
          tripSafeSelection,
        };
      }
      if (tripSafeSelection === "declined") {
        return {
          status: "declined",
          source: "tripsafe_declined",
          hoursBetweenReservationAndStart,
          tripSafeSelection,
        };
      }
    }

    return {
      status: null,
      source: "manual_fallback",
      hoursBetweenReservationAndStart,
      tripSafeSelection,
    };
  }

  return {
    status: null,
    source: "manual_fallback",
    hoursBetweenReservationAndStart: null,
    tripSafeSelection,
  };
}
