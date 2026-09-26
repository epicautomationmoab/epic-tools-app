# Rental Agreement V2 Launch Plan

Status: PREVIEW BUILD ONLY. Nothing in production has been cut over. Current live rental forms, readiness, Guest Portal readiness language, reminders, and production PDF flow remain unchanged.

Last updated: 2026-09-23

## Current Decision Summary

Jennifer is satisfied with the V2 agreement direction for internal purposes and plans to have counsel review it before production launch.

The intended role of Epic's agreement is supplemental to the Polaris / MPWR agreement: Polaris provides the primary rental/waiver framework, while Epic's V2 adds Epic-specific operating rules, Moab-specific terrain language, recovery terms, collection language, and operational expectations.

The V2 adult role model remains intentionally simple:

- Driver
- Passenger

There is no separate Responsible Party or Reserving Party signer role in the V2 form.

There is no attempt to infer legal responsibility from MPWR's checkout-driver field, a name match, the booking contact, or the person who supplied a security deposit.

## Core Driver Rule

A Driver is any person who operates an Epic vehicle during the rental.

By signing the Driver agreement, that person accepts the operating, financial, and contractual responsibilities applicable to their own operation or use of an Epic vehicle, regardless of which individual is listed as the checkout driver in Epic's or Polaris's systems.

Driver responsibility follows actual operation, not system assignment.

The agreement should use direct second-person language ("you") for the signer wherever practical rather than repeatedly using third-person phrases such as "the Driver whose...".

The final signature acknowledgment may use first-person language ("I acknowledge", "I understand", etc.).

## Payment and Collection Rule

Epic should not try to determine or adjudicate the group's internal reimbursement arrangement before collecting amounts properly due.

The V2 agreement now states that Epic may collect using authorized payment sources associated with the rental in this order:

1. Any applicable security deposit or deposit authorization on file.
2. An authorized payment method associated with the reservation.
3. Another payment method provided or authorized by a member of the rental group.

Any remaining balance is due immediately.

Members of the rental group may decide among themselves how charges are ultimately divided or reimbursed. Those private arrangements do not delay, reduce, or eliminate amounts due to Epic.

If the group wants a different payment arrangement, Epic must be notified and agree to it before payment is processed. Otherwise, Epic may proceed using the authorized payment sources available under the agreement.

The person who supplied a security deposit may be different from the booking contact and different from the Driver. The contract does not create a special "security deposit holder" signer role.

## Terrain and Responsibility Philosophy

Epic's customer-facing language should continue to follow these principles:

- OHV use is inherently risky.
- Epic provides operating requirements, restrictions, terrain information, and warnings.
- Drivers are responsible for operating within their own skill and experience.
- Drivers are responsible for route selection, current conditions, vehicle control, and deciding whether to proceed.
- High-Consequence Terrain is informational; Epic recommends avoiding it.
- High-Consequence does not mean permitted, approved, or prohibited.
- The High-Consequence list is not exhaustive.
- Absence from the list does not mean a trail, obstacle, or area is safe, easy, suitable, or appropriate.
- Prohibited Terrain and prohibited uses remain black-and-white.
- Avoid paternalistic language implying Epic decides what a competent adult may or may not attempt on public terrain outside the explicit prohibited list.

Current content includes:

- Kane Creek Canyon naming
- prohibited Sand Dunes use at White Wash, Behind the Rocks, and Poison Spider
- prohibited roads / trails / obstacles
- High-Consequence Terrain language
- recovery pricing beginning at $2,500 for Prohibited or High-Consequence Terrain
- damage-protection review language
- payment / collection order above

## V2 Form Logic

### Adult role

Signer chooses exactly one:

1. Driver
2. Passenger

### Driver

A Driver will operate an Epic vehicle during the rental and signs the full Driver version of the Epic rental agreement.

### Passenger

A Passenger will not operate an Epic vehicle during the rental.

The Passenger path includes participation, inherent-risk, terrain, and parent/minor acknowledgments without imposing Driver operating or financial obligations solely because the person is participating as a Passenger.

### Minor participants

Every adult signer answers whether they are the parent or legal guardian of any minor participants on the reservation.

If yes, the signer may add one or more minors to the same agreement.

Each minor record captures:

- first name
- last name
- date of birth
- relationship to signer

The same adult signature covers that adult's own role plus the parent/legal guardian acknowledgment for the listed minors.

Each listed minor counts toward the reservation's expected participant count but never toward the Driver count.

## Current Preview State

The V2 preview is built on branch:

`rental-agreement-v2-preview`

The public preview form supports:

- Driver / Passenger role choice
- participant information
- full Driver agreement
- Passenger agreement
- minor participant entry
- drawn signature
- typed signature
- typed-signature name validation
- local form validation

The preview remains non-operative. It does not currently create a legal V2 signature, generate a production V2 PDF, email a signed copy, or affect production readiness.

The V2 content is centralized in:

`lib/rental-agreement-v2-content.ts`

The readiness evaluator exists in:

`lib/rental-agreement-v2-readiness.ts`

The staged V2 API, migration, and PDF generator exist in the preview branch but have not been activated for production.

## Readiness V2 Rules

Rental readiness must answer two separate questions:

1. Are all expected participants accounted for?
2. Are there enough signed Drivers for the number of rental vehicles?

Rules:

- each signed adult counts as one participant
- each listed minor counts as one participant
- expected participant count = effective guest count
- only signed adult Drivers count toward Driver coverage
- required Driver count = total rental vehicle count
- extra Drivers are allowed
- a rental is document-ready only when both participant coverage and Driver coverage are complete

Examples:

- 1 vehicle / 4 people / 1 Driver -> `Agreements 4/4 · Drivers 1/1`
- 2 vehicles / 4 people / 2 Drivers -> `Agreements 4/4 · Drivers 2/2`
- 2 vehicles / 4 people / 1 Driver -> `Agreements 4/4 · Drivers 1/2` and not ready
- 4 vehicles / 4 people / 4 Drivers -> `Agreements 4/4 · Drivers 4/4`
- 2 vehicles / 4 people / 4 Drivers -> `Agreements 4/4 · Drivers 4/2` and ready

Identity/dedup exceptions still need to be handled so duplicate or unmatched people do not silently satisfy aggregate counts.

## What Is Already Prepared for Readiness

The V2 readiness helper already calculates:

- participants received
- participants expected
- Drivers received
- Drivers expected
- participant completeness
- Driver completeness
- overall ready state
- overages

It also already formats the intended display as:

`Agreements x/y · Drivers a/b`

The Readiness table preview branch has already been adjusted so rental document expected count uses `expected_guest_count` rather than relying solely on the legacy Epic-document expected count.

## Readiness Integration Status

The V2 readiness plumbing is now wired on the preview branch only. Production remains unchanged.

Completed on the preview branch:

1. Rental dashboard presentation uses the V2 Agreement / Driver count model.
2. Signed V2 adults + listed minors count against effective guest count.
3. Signed V2 Drivers count against total vehicle count.
4. Rental document readiness requires both participant coverage and Driver coverage.
5. Team waiver API exposes V2 Driver / Passenger / Minor role data.
6. Readiness drawer shows Driver, Passenger, and Minor labels.
7. Guest Portal uses the same V2 readiness source.
8. Reminder / communication logic uses the same V2 readiness source.
9. People-count overrides update the V2 agreement denominator.
10. Rental Arrival Board gating uses V2 readiness plus payment, MPWR, and OHV requirements.
11. Duplicate adult/minor submissions are collapsed so they cannot inflate readiness; staff-facing exceptions are surfaced in the readiness drawer.
12. Polaris readiness remains separate and unchanged.
13. Rental Guest Portal document links on the preview branch route into the V2 preview form.

The intended rental dashboard language is:

- `Agreements 4/4 · Drivers 2/2`

None of this has been activated on production yet. The production database still lacks the V2 signer-role fields and V2 writes remain disabled.

## Training Timing

Jennifer has additional staff groups to train on the current live system before the V2 readiness wording should change.

Therefore:

- do not change live readiness wording yet
- do not change live Guest Portal rental-document wording yet
- do not change production readiness completion logic yet
- finish current training first
- make V2 readiness/dashboard/Guest Portal changes as one controlled cutover rather than creating a halfway state

## Staged Backend Work

The preview branch contains staged work for:

- V2 signer role storage (`driver` / `passenger`)
- exact signed agreement HTML snapshot
- exact minor acknowledgment snapshot
- agreement content versioning
- drawn / typed signature handling
- V2 signed PDF generation
- signed PDF hashing / storage
- signed-copy email delivery

The additive V2 database migration has now been applied to the production Supabase database. It adds the V2 signer-role/content snapshot fields and the V2 submission RPC without changing the live V1 rental flow.

The V2 PDF Edge Function `generate-epic-rental-v2-pdf` has now been deployed and is active.

General V2 writes remain disabled on production. The preview branch now has an explicit controlled test mode (`?v2=preview&write=test`) that permits V2 writes only on a Vercel preview deployment so the end-to-end path can be tested before cutover.

## Preview Build Issue Resolved

Adding the Supabase Edge Function source caused Vercel / Next builds to fail because the Next TypeScript project was compiling `supabase/functions`.

The preview branch now excludes:

`supabase/functions`

from the Next TypeScript build.

This restored successful Vercel preview builds while keeping the Edge Function source in the repository.

## Backend Verification Notes

Controlled rollback tests were run against the installed V2 submission RPC before any persistent test submission was allowed.

Those tests exposed and resolved three backend issues:

- PL/pgSQL ambiguity in the manual session-count update.
- An attempted insert into the generated `minor_full_name` column.
- Double-counted session totals because existing database triggers already recalculate signature/minor coverage.

The final V2 RPC now relies on the existing waiver-count triggers for session totals and does not manually increment them.

Rollback verification now passes for:

- one Driver / no minors -> `1 adult · 0 minors · 1 covered`
- one Passenger + one minor -> `1 adult · 1 minor · 2 covered`

All rollback-test rows and counts were confirmed removed afterward.

## Production Safety Rules

- Do not modify the current live rental agreement behavior until launch approval.
- Do not change current live readiness completion rules until launch approval.
- V2 preview must not create legally operative signatures before controlled activation.
- Keep V2 work isolated until production cutover.
- Keep a rollback path to the current V1 rental agreement.
- Attorney review is required before production launch.

## End-to-End Test Matrix Before Launch

At minimum, verify:

- 1 vehicle / 1 Driver / no minors
- 1 vehicle / 1 Driver + adult Passenger
- 1 vehicle / 1 Driver + adult Passenger + 2 minors
- 1 vehicle / 2 Drivers
- 2 vehicles / 2 Drivers
- 2 vehicles / 2 Drivers + adult Passengers + minors
- 2 vehicles / only 1 Driver -> not ready
- 3 vehicles / 3 Drivers / mixed Passengers / minors
- Driver who is also parent/legal guardian of minors
- Passenger who is also parent/legal guardian of minors
- extra Drivers above vehicle count
- signer changes Driver/Passenger selection before signing
- vehicle count changes before readiness evaluation
- guest count / people-count override changes
- typed signature
- drawn signature
- generated PDF content
- signed-copy email
- database role storage
- minor records
- Guest Portal counts
- readiness drawer signer labels
- automated reminder behavior
- Polaris waiver flow remains intact
- duplicate or unmatched signer handling

## Recommended Cutover Sequence

When Jennifer returns and is ready to proceed:

1. Confirm attorney review status and any contract edits.
2. Confirm current training groups are complete.
3. Re-sync the preview branch with current main if main has advanced.
4. Finish V2 readiness plumbing:
   - Agreements x/y
   - Drivers a/b
   - overall readiness gate
   - signer labels
   - Guest Portal
   - reminders / communications
5. [DONE] Apply the additive V2 database migration.
6. [DONE] Deploy the V2 PDF Edge Function.
7. [DONE] Enable V2 writes only in a controlled preview test path.
8. Run real end-to-end test signatures against a safe test reservation.
9. Verify:
   - DB records
   - minors
   - Driver / Passenger role
   - signed PDF
   - hash / storage
   - emailed copy
   - Agreement count
   - Driver count
   - Guest Portal
   - readiness dashboard
   - reminders
   - Polaris unaffected
10. Train staff on the new V2 wording and readiness display.
11. Perform final production cutover.
12. Verify rollback path remains available.

## Launch Gate

Do not launch until all are true:

- [x] V2 agreement direction approved internally for attorney review
- [ ] Attorney review complete
- [x] V2 preview form UI built
- [x] Driver / Passenger role model finalized
- [x] Minor participant flow built
- [x] Typed and drawn signature preview validation built
- [x] V2 readiness rules defined
- [x] Rental expected agreement denominator concept set to guest count
- [ ] V2 signed PDF verified end-to-end
- [x] V2 production schema / submission RPC installed
- [x] V2 PDF Edge Function deployed
- [ ] V2 database writes verified end-to-end through controlled preview submission
- [x] V2 readiness participant-count logic wired on preview branch
- [x] V2 Driver-count logic wired on preview branch
- [ ] Minor participant counting verified end-to-end with real V2 writes
- [x] Guest Portal V2 language updated on preview branch
- [x] Automated reminder logic updated on preview branch
- [ ] Polaris waiver flow verified unchanged
- [ ] Remaining current-system training complete
- [ ] V2 staff training complete
- [ ] Customer-facing education copy finalized
- [ ] Test matrix passes
- [ ] Rollback to V1 verified
- [ ] Jennifer explicitly approves production cutover

## Future-Us Short Version

Nothing is live yet.

The V2 contract and form design are essentially done. Jennifer is satisfied with the current direction pending attorney review.

Do NOT restart the Responsible Party / Reserving Party design discussion. The settled model is:

- every adult chooses Driver or Passenger
- minors attach to a parent/legal guardian
- Driver obligations follow actual operation
- no special Reserving Party signer role
- no name matching
- no security-deposit-holder signer role
- Epic collection order is security deposit -> reservation payment method -> another authorized group payment method
- group reimbursement disputes are not Epic's problem
- readiness is Agreements x/y plus Drivers a/b

The readiness/dashboard/Guest Portal/reminder integration is now implemented on the preview branch. The remaining work is backend activation, end-to-end testing, training confirmation, attorney review, and cutover — not conceptual redesign.
