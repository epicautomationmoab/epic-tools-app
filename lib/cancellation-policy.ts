export type TripSafeStatus = "declined" | "purchased" | "confirmed_within_48";

export const CANCELLATION_POLICY_VERSION = "2026-08-06-v2";

export type CancellationPolicy = {
  title: string;
  summary: string;
  paragraphs: string[];
  acceptanceStatement: string;
};

const declinedPolicy: CancellationPolicy = {
  title: "48-Hour Cancellation Policy",
  summary: "TripSafe Travel Protection was declined for this reservation.",
  paragraphs: [
    "Guest-requested cancellations received within 48 hours of the scheduled tour departure or rental pickup time, and no-shows, are nonrefundable.",
    "Within the 48-hour cancellation period, requests to reschedule or reduce the number of guests, vehicles, seats, or tickets are treated as a cancellation of the original reservation and a new booking. Charges for the original reservation remain due.",
    "All amounts paid are nonrefundable, and any unpaid balance will be charged to the credit card on file. This policy applies regardless of the reason, including illness or injury, travel delays or air-travel interruptions, weather, and other emergencies.",
  ],
  acceptanceStatement:
    "I have reviewed and agree to the cancellation and no-show policy for this reservation. I understand that all reservation charges remain due if the reservation is canceled, rescheduled, reduced, or becomes a no-show within the 48-hour cancellation period. I authorize Epic 4X4 Adventures to charge any unpaid balance to the credit card on file and confirm that I am the cardholder or am authorized to accept these terms on the cardholder’s behalf.",
};

const purchasedPolicy: CancellationPolicy = {
  title: "TripSafe Travel Protection Terms",
  summary: "TripSafe Travel Protection was purchased for this reservation.",
  paragraphs: [
    "Cancellation or change requests received at least one hour before the scheduled tour departure or rental pickup time will be honored for any reason.",
    "Requests received less than one hour before the scheduled start time, and no-shows, are nonrefundable. All reservation charges remain due.",
    "The TripSafe Travel Protection fee is nonrefundable.",
  ],
  acceptanceStatement:
    "I have reviewed and agree to the TripSafe Travel Protection terms for this reservation. I understand that requests received less than one hour before the scheduled start time, and no-shows, are nonrefundable; all reservation charges remain due; and the TripSafe Travel Protection fee is nonrefundable. I confirm that I am the cardholder or am authorized to accept these terms on the cardholder’s behalf.",
};

const confirmedWithin48Policy: CancellationPolicy = {
  title: "Your Reservation Is Confirmed",
  summary:
    "Your reservation was confirmed within Epic 4X4 Adventures’ 48-hour cancellation period. Payment is due in full, and the reservation is nonrefundable.",
  paragraphs: [
    "If Epic 4X4 Adventures has agreed to accept cash or split payments for your party upon arrival, the credit card you provided secures the reservation. It will be charged for any unpaid balance remaining at your scheduled tour departure time or rental pickup time.",
  ],
  acceptanceStatement:
    "By signing below, I acknowledge that my reservation is confirmed and nonrefundable, that all reservation charges remain due if I cancel or do not arrive, and that reducing the number of guests, vehicles, seats, or tickets does not reduce the amount due.",
};

export function getCancellationPolicy(status: TripSafeStatus) {
  if (status === "purchased") return purchasedPolicy;
  if (status === "confirmed_within_48") return confirmedWithin48Policy;
  return declinedPolicy;
}
