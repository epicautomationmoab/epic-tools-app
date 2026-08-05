export type TripSafeStatus = "declined" | "purchased";

export const CANCELLATION_POLICY_VERSION = "2026-08-05-v1";

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
    "Guest-requested cancellations received within 48 hours of the scheduled tour departure or rental pick-up time, and no-shows, are nonrefundable.",
    "Requests made within 48 hours to reschedule or reduce the number of vehicles, seats, or tickets are treated as a cancellation of the original reservation and a new booking.",
    "All amounts paid remain nonrefundable. If the reservation is canceled, rescheduled, reduced, or becomes a no-show within 48 hours, any outstanding balance becomes immediately due and will be charged to the credit card on file. This applies regardless of reason, including illness or injury, travel delays or air-travel interruptions, weather, and other emergencies.",
  ],
  acceptanceStatement:
    "I have reviewed and agree to the cancellation and no-show policy for this reservation. I understand and authorize Epic 4X4 Adventures to charge any outstanding balance to the credit card on file if this reservation is canceled, rescheduled, reduced, or becomes a no-show within the applicable cancellation period. I confirm that I am the cardholder or am authorized to accept these terms on the cardholder’s behalf.",
};

const purchasedPolicy: CancellationPolicy = {
  title: "TripSafe Travel Protection Terms",
  summary: "TripSafe Travel Protection was purchased for this reservation.",
  paragraphs: [
    "Cancellation or change requests will be honored for any reason until one hour before the scheduled start time.",
    "Requests received within one hour of the scheduled start time are nonrefundable, and all reservation charges remain due.",
    "The TripSafe Travel Protection fee is nonrefundable.",
  ],
  acceptanceStatement:
    "I have reviewed and agree to the TripSafe Travel Protection cancellation and change terms for this reservation. I understand that requests received within one hour of the scheduled start time are nonrefundable, all reservation charges remain due, and the TripSafe Travel Protection fee is nonrefundable. I confirm that I am the cardholder or am authorized to accept these terms on the cardholder’s behalf.",
};

export function getCancellationPolicy(status: TripSafeStatus) {
  return status === "purchased" ? purchasedPolicy : declinedPolicy;
}
