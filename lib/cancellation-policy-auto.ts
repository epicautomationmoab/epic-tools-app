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

const TRIPSAFE_EXPERIENCE_ADDON_ID = 6451;
const TRIPSAFE_EXPERIENCE_ADDON_TITLE = "Optional Travel Protection";
const TRIPSAFE_PURCHASED_NAME = "Yes, please add TripSafe";
const TRIPSAFE_DECLINED_NAME = "No, do not add TripSafe";
const CANCELLATION_WINDOW_HOURS = 48;

export function getTripSafeSelection(addons: TripWorksAddon[] | null | undefined): TripSafeAddonSelection {
  const tripSafeAddon = (addons ?? []).find((addon) => {
    const idMatch = addon.experience_addon?.id === TRIPSAFE_EXPERIENCE_ADDON_ID;
    const titleMatch = addon.experience_addon?.title === TRIPSAFE_EXPERIENCE_ADDON_TITLE;
    return idMatch || titleMatch;
  });

  if (!tripSafeAddon) return "unknown";
  if (tripSafeAddon.name === TRIPSAFE_PURCHASED_NAME) return "purchased";
  if (tripSafeAddon.name === TRIPSAFE_DECLINED_NAME) return "declined";
  return "unknown";
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

    // Patti's first and controlling rule: reservations created inside the 48-hour
    // cancellation window use the nonrefundable confirmed-within-48 policy,
    // regardless of whether an ecommerce guest also selected TripSafe.
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
