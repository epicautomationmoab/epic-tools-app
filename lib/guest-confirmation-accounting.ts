import type { TripSafeStatus } from "@/lib/cancellation-policy";

export type ConfirmationFinancialRow = {
  amount_paid_cents: number | null;
  amount_due_cents: number | null;
  total_amount_cents: number | null;
  travel_protection_choice: string | null;
  latest_payload: unknown;
};

export type ConfirmationPaymentSummary = {
  total: string;
  paid: string;
  balanceDue: string;
};

const CUSTOMER_BOOKING_FEE_MULTIPLIER = 1.04;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function successfulGuestPaymentsCents(payload: unknown) {
  const record = asRecord(payload);
  const payments = Array.isArray(record?.payments) ? record.payments : [];

  return payments.reduce((sum, payment) => {
    const row = asRecord(payment);
    if (!row) return sum;

    const status = asRecord(row.status)?.name;
    const direction = asRecord(row.direction)?.name;
    const amount = asNumber(row.amount);

    if (status !== "Successful" || direction !== "Payment" || amount === null) return sum;
    return sum + Math.round(amount);
  }, 0);
}

function guestFacingBalanceCents(baseDueCents: number | null) {
  return Math.round(Math.max(baseDueCents ?? 0, 0) * CUSTOMER_BOOKING_FEE_MULTIPLIER);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function buildConfirmationPaymentSummary(row: ConfirmationFinancialRow): ConfirmationPaymentSummary {
  const successfulPayments = successfulGuestPaymentsCents(row.latest_payload);
  const paidFallback = Math.round(Math.max(row.amount_paid_cents ?? 0, 0) * CUSTOMER_BOOKING_FEE_MULTIPLIER);
  const paidCents = successfulPayments > 0 ? successfulPayments : paidFallback;
  const balanceDueCents = guestFacingBalanceCents(row.amount_due_cents);

  // Use actual guest-facing successful charges whenever available. Adding the current
  // guest-facing balance makes this resilient to per-transaction penny rounding.
  const totalCents = paidCents + balanceDueCents;

  return {
    total: formatMoney(totalCents),
    paid: formatMoney(paidCents),
    balanceDue: formatMoney(balanceDueCents),
  };
}

const DECLINED_POLICY = [
  "You have declined TripSafe Itinerary Protection, so our standard cancellation terms apply to your reservation. Guest-requested cancellations received within 48 hours of your scheduled tour departure or rental pick-up time and no-shows are nonrefundable. All amounts paid are nonrefundable, and all outstanding balances become immediately due and will be charged to the credit card provided at the time of booking. This policy applies to all guest cancellations and no-shows, regardless of reason, including illness or injury, travel delays or air travel interruptions, weather, and other emergencies.",
  "Within the 48-hour cancellation period, requests to reschedule or reduce the number of vehicles, seats or tickets are treated as a cancellation of the original reservation and a new booking. The original reservation remains subject to this cancellation policy.",
].join("\n\n");

const PURCHASED_POLICY = "You have purchased TripSafe Itinerary Protection. Cancellation or change requests will be honored for any reason up to one hour before your scheduled start time. Requests received within one hour of the start time are nonrefundable, and all reservation charges remain due. TripSafe Travel Protection fee is nonrefundable.";

const WITHIN_48_POLICY = [
  "Your reservation was confirmed within Epic 4X4 Adventures’ 48-hour cancellation period. Payment is due in full, and the reservation is nonrefundable.",
  "If Epic 4X4 Adventures has agreed to accept cash or split payments for your party upon arrival, the credit card you provided secures the reservation. It will be charged for any unpaid balance remaining at your scheduled tour departure time or rental pickup time.",
].join("\n\n");

const UNKNOWN_POLICY = "Your reservation is subject to Epic 4X4 Adventures cancellation terms. Please review your reservation documents or contact us if you have questions about your TripSafe selection or cancellation terms.";

export function buildCancellationPolicyText(choice: string | null, policyStatus?: TripSafeStatus | null) {
  if (policyStatus === "confirmed_within_48") return WITHIN_48_POLICY;

  const normalized = choice?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("yes")) return PURCHASED_POLICY;
  if (normalized.startsWith("no")) return DECLINED_POLICY;
  return UNKNOWN_POLICY;
}
