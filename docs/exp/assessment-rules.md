# EXP assessment rules

Owner-confirmed October 27, 2026. Applies to the active server assessment and its guest UI.

- 10/10: complete.
- One or two noncritical misses, no critical misses: complete with correct answers and explanations. No retake or rewatch.
- Three or more noncritical misses: offer another full knowledge check or technician at arrival, retaining video credit.
- One or two critical misses: one targeted retry without answer disclosure. Save and resume this retry across page closes.
- A critical miss on that retry: rewatch or technician.
- Three or more critical misses on the initial assessment: rewatch or technician (explicit owner confirmation).
- After a successful critical retry, apply the original noncritical miss count as above.

Completion still requires the existing video, driver acknowledgments and authoritative all-driver paperwork/readiness checks. Assessment completion does not grant final staff checkout.

Run `node scripts/verify-exp-assessment-policy.cjs` for policy regressions. API/database/browser verification must additionally cover persisted retry state and actual readiness; pure policy tests alone do not establish end-to-end acceptance.

## Booking-wide orientation

Owner-confirmed October 28, 2026: one orientation per driver covers the whole booking, including multiple rental items. Persisted session anchors remain unchanged. Only rental items with the same portal token and booking confirmation share orientation; every item retains its required forms, waiver and OHV checks. A newer failed participation supersedes older completion throughout that booking. EXC qualification is reservation-wide. See exc-guest-language-approved.md for approved guest terminology and conditional presentation.
