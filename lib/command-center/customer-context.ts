/**
 * Shared native employee-app context contract.
 * No network calls, no mutations, no assumptions about one confirmation = one visit.
 */
export type CustomerContext = {
  contactId?: string;
  identityKey?: string;
  opportunityId?: string;
  operationalReservationId?: string;
  readinessId?: string;
  storeVisitId?: string;
  tripworksConfirmation?: string;
  mpwrUnitId?: string;
};
export type ContextResolution = "exact-reservation" | "exact-visit" | "contact-only" | "choose-visit" | "unidentified";
const present = (s?: string) => typeof s === "string" && s.trim().length > 0;
export function resolveCustomerContext(ctx: CustomerContext): ContextResolution {
  if (present(ctx.operationalReservationId)) return "exact-reservation";
  if (present(ctx.readinessId) || present(ctx.storeVisitId)) return "exact-visit";
  if (present(ctx.tripworksConfirmation) || present(ctx.mpwrUnitId)) return "choose-visit";
  if (present(ctx.contactId) || present(ctx.identityKey)) return "contact-only";
  return "unidentified";
}
export function hasExactVisitIdentity(ctx: CustomerContext): boolean {
  return present(ctx.operationalReservationId) || present(ctx.readinessId) || present(ctx.storeVisitId);
}
