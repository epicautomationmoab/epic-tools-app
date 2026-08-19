# Guest Readiness Architecture

This document is the technical source of truth for the EpicTools Guest Readiness data path.

## Core responsibilities

### Bob
Bob is the TripWorks/Supabase normalization side. Bob turns TripWorks data into operational source-of-truth records used by downstream systems.

Primary operational tables include:
- `operational_reservations`
- `operational_trip_orders`
- `operational_participants`

Bob is not the Guest Readiness dashboard and is not the MPWR browser agent.

### Patti
Patti is the Store Visit grouping and classification layer. Patti decides how TripWorks activity rows become operational Store Visits.

Primary Patti tables include:
- `portal_patti_store_visits`
- `portal_patti_store_visit_sources`
- `portal_patti_vehicle_items`

Patti supplies Store Visit identity and operational classification such as:
- business line
- booking type
- Store Visit start/end
- expected guest count
- vehicle counts/breakdown
- `requires_mpwr`

Patti is not the final frontend data source for the Guest Readiness page.

### Rhett
Rhett is the headless MPWR browser agent. Rhett creates MPWR reservations and writes results to `mpwr_agent_queue`.

Important queue fields include:
- `confirmation_code`
- `source_trip_order_ids`
- `status`
- `action_type`
- `mpwr_confirmation_number`
- `mpwr_waiver_url`

`mpwr_agent_queue` is downstream work/action state. It is not the TripWorks source of truth and it is not the Guest Readiness grouping source.

### Scout / MPWR waiver evidence
`scout_mpwr_waivers` contains MPWR waiver evidence associated with an MPWR confirmation number. Guest Readiness uses this table for actual MPWR waiver detail and counts.

## Live Guest Readiness frontend path

The EpicTools frontend loads readiness rows through `getReadinessRows()` in `lib/supabase.ts`.

The current data path is:

`guest_readiness_with_handoff_v`
→ `guest_readiness_app_v`
→ `guest_readiness_operational`

The dashboard therefore renders its working MPWR state from `guest_readiness_operational`, not directly from `portal_patti_store_visits`.

For MPWR waiver detail, `guest_readiness_app_v` joins `scout_mpwr_waivers` using `guest_readiness_operational.mpwr_confirmation_number`.

## MPWR data flow

Conceptually:

TripWorks
→ Bob operational truth
→ Patti Store Visit grouping/classification
→ Guest Readiness operational row

Rhett / MPWR
→ `mpwr_agent_queue`
→ Guest Readiness MPWR identity/result fields

MPWR waiver scraper/evidence
→ `scout_mpwr_waivers`
→ Guest Readiness waiver detail/counts

Frontend
→ `guest_readiness_with_handoff_v`
→ EpicTools Guest Readiness page

## `requires_mpwr`

`requires_mpwr` is a Store Visit business-rule classification. It determines whether the dashboard expects MPWR documents.

Known non-MPWR cases include:
- Pro Xperience / private ride-along products
- guide-car-passenger-only / guide-car-rider-only visits

When `requires_mpwr = false`, Guest Readiness should expect zero MPWR documents and the UI should render MPWR as N/A.

## Important safety rule

**Do not infer the active architecture from the existence of a Supabase function, trigger function, table, column, or view.**

Before changing production behavior:
1. Verify the live frontend caller.
2. Verify the active view/table path.
3. Verify whether a trigger is actually attached.
4. Verify whether the function is currently called by production code.
5. Prefer observing a recent successful booking before changing working automation.

This rule exists because the database contains remnants of prior iterations of Patti and Guest Readiness.

## Legacy / inactive objects

### `portal_patti_reconcile_after_mpwr_queue_ready()`

This function exists in Supabase and contains logic to push completed Rhett results into Patti and Guest Readiness immediately.

At the time this document was written, no active trigger was attached to `mpwr_agent_queue` to invoke this function.

**Do not attach or reactivate this function merely because it exists.** Its absence may be intentional from prior performance simplification work. Confirm the current production design before changing it.

## Reconciliation functions still in use

`portal_patti_reconcile()` rebuilds Patti Store Visits from current operational TripWorks truth and performs Guest Readiness refresh work.

`refresh_guest_readiness_operational()` and `refresh_guest_readiness_for_trip(...)` synchronize Patti Store Visit classification and expected counts into `guest_readiness_operational`.

These functions may preserve existing MPWR identity already present in Guest Readiness when Patti itself does not currently contain an MPWR confirmation.

## Dashboard UI behavior

`app/team/readiness/ReadinessTable.tsx` explicitly treats `requires_mpwr === false` as MPWR 0/0.

Therefore:
- `requires_mpwr = false` should display N/A.
- A stale nonzero `mpwr_document_expected_count` in `guest_readiness_operational` can make an old/remnant row appear incorrectly until readiness is refreshed or manually corrected.

## Troubleshooting checklist

When a guest appears to be missing or incorrect:

1. Confirm the active TripWorks reservation exists in Bob operational truth.
2. Confirm Patti has the correct Store Visit.
3. Confirm `requires_mpwr` is correct for the business rule.
4. If MPWR is required, check `mpwr_agent_queue` for a completed reservation result.
5. Check `guest_readiness_operational` for the MPWR confirmation and expected/received counts.
6. Check `scout_mpwr_waivers` for waiver evidence.
7. Confirm the frontend view (`guest_readiness_with_handoff_v`) reflects the expected readiness row.
8. Do not replay Rhett or create a new MPWR reservation until MPWR itself has been checked for duplicates.

## Architecture ownership summary

- Bob: normalize TripWorks operational truth.
- Patti: group/classify Store Visits.
- Rhett: perform MPWR browser actions.
- `guest_readiness_operational`: working readiness record consumed by dashboard views.
- `scout_mpwr_waivers`: MPWR waiver evidence/details.
- `guest_readiness_app_v`: assembles app-facing readiness data.
- `guest_readiness_with_handoff_v`: current frontend readiness view including operational handoff state.

Last reviewed: 2026-08-19.
