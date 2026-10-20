/**
 * Manager audit / payment-visibility mutation policy.
 * This module is isolated and does not alter the live mutation endpoint.
 */
export function canChangeGuestPaymentVisibility(profile) {
  return Boolean(profile && profile.active === true &&
    typeof profile.id === 'string' && profile.id.length > 0 &&
    ['agent','manager','admin'].includes(profile.role));
}

export function requireNamedActor(profile) {
  if (!canChangeGuestPaymentVisibility(profile)) {
    return {ok:false,reason:'Named active employee required'};
  }
  return {ok:true,actorProfileId:profile.id};
}

export function visibilityAuditSummary({before,after,actorProfileId,reservationId}) {
  if (typeof before !== 'boolean' || typeof after !== 'boolean') throw new TypeError('Boolean before and after values required');
  if (!actorProfileId || !reservationId) throw new TypeError('Stable actor and reservation identifiers required');
  return {actorProfileId,reservationId,previousHidden:before,newHidden:after,changed:before!==after};
}
