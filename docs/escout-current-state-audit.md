# eScout Current-State Audit

## Non-negotiable guardrail

**Bob is sacred. Rhett is sacred. Patti is sacred.**

Do not modify Bob, Rhett, or Patti code, triggers, behavior, deployment, or data paths without first discussing the proposed change with Jennifer and receiving explicit approval.

This eScout rebuild must be isolated from those agents unless and until an intentional integration change is approved.

## Approved migration plan

The eScout project is a controlled lane-by-lane rebuild. Existing tScout and iScout continue running normally until replacement job sources are shadow-tested and proven.

Target lanes:

- Today -> tScout
- Tomorrow -> iScout
- Next Day -> iScout
- Future -> eScout

Routing operates both by nightly Moab-time reconciliation and immediate event routing for booking/reschedule/cancellation/operational changes.

Retirement rules:

- Rental: `rental_returned`
- Tour: `checked_in`
- Cancelled/ineligible reservations

Future/eScout behavior:

- MPWR link click creates or refreshes Future work.
- Nearby clicks are debounced.
- eScout performs a short follow-up sequence to allow MPWR waiver rendering.
- Expected-count completion does not permanently close a future reservation.
- A later click may wake it again.
- Reservation transfers to iScout when it enters the two-day window.

## Current Scout queue and worker behavior

Primary live queue: `public.scout_mpwr_queue`.

Current queue supports atomic claiming with `claimed_by`, `claimed_at`, `lease_expires_at`, `attempt_count`, `next_check_at`, `status`, and `active`.

Worker repository: `epicautomationmoab/epic-scout-worker`.

Current worker defaults from `scout.js`:

- Empty-queue recheck: 20 seconds.
- Shared queue synchronization: every 5 minutes.
- Claim lease: 15 minutes.
- Lease renewal: every 5 minutes while processing.
- MPWR maintenance/offline window: midnight through 2:00 AM America/Denver.
- Shared queue sync runs at startup and every five minutes.

Database claim modes:

- `today`: current Moab date.
- `immediate` / `near_term`: tomorrow and next day.
- `future`: current date + 3 and later.

The live worker bulk-synchronizes the entire population through `sync_scout_mpwr_queue()`. The eScout rebuild eliminates that behavior for Future work.

## Confirmed legacy issues

### Tour retirement mismatch

Epic Tools records tour handoff status as `checked_in`. Legacy Scout work/retirement logic looks for `tour_returned`.

The shadow router correctly treats `checked_in` as the tour retirement state.

### Waiver first-seen reset

`replace_scout_mpwr_waiver_snapshot(...)` currently deletes and reinserts the entire snapshot, resetting `first_seen_at` every time. Durable waiver identity/upsert behavior remains part of the rebuild before final cutover.

### Worker health

`scout_worker_health` contains stale test-era rows. The current worker source does not maintain live heartbeat rows. Health reporting remains a rebuild item.

## Shadow lane system — implemented

Canonical lane key: `guest_readiness_operational.readiness_id`.

Table: `public.scout_work_lanes_shadow`.

History: `public.scout_work_lane_history_shadow`.

Router: `public.route_scout_readiness_shadow(readiness_id)`.

Immediate shadow routing triggers now run after:

- `guest_readiness_operational` insert/update.
- `epic_operational_handoffs` insert/update.

Nightly reconciliation:

- `public.reconcile_scout_work_lanes_shadow()`.
- Moab-midnight reconciliation check is scheduled independently of live Scout behavior.

Shadow retirement handles:

- archived rows,
- inactive TripWorks operational status,
- non-MPWR eligibility,
- rental `rental_returned`,
- tour `checked_in`,
- past visits.

Current shadow reconciliation has zero structural routing exceptions.

## Append-only MPWR click history — confirmed

Guest MPWR waiver route writes every click into:

- `public.scout_mpwr_observation_events`
- `event_type = 'guest_mpwr_click'`
- `source = 'guest_portal'`

The route also updates legacy mutable fields on `scout_mpwr_queue`, but eScout uses the append-only observation event as its source.

This means eScout does not have to infer click activity from `last_guest_mpwr_click_at` or `mpwr_portal_click_count`.

## eScout Future shadow jobs — implemented

Table: `public.escout_future_jobs_shadow`.

History: `public.escout_future_job_history_shadow`.

Every new append-only `guest_mpwr_click` event automatically passes through:

- `public.wake_escout_future_shadow_from_click(event_id)`.

Only currently active Future-lane readiness rows are eligible.

Current debounce/follow-up settings for shadow testing:

- Click burst debounce: 2 minutes.
- First MPWR check: +2 minutes.
- Second follow-up: +5 minutes after first successful check.
- Third follow-up: +10 minutes after second successful check.
- After the sequence, the job becomes dormant rather than permanently complete.
- A later click wakes it again and starts a new burst.

Moving from Future into Today/Tomorrow/Next Day deactivates the eScout job and marks it `transferred`.

Retirement marks it `retired`.

Atomic eScout claim/lease functions:

- `claim_next_escout_future_shadow_job(...)`
- `renew_escout_future_shadow_job_lease(...)`
- `finish_escout_future_shadow_job(...)`

Structural exception view:

- `public.escout_future_jobs_shadow_exceptions_v`

Current exception count: zero.

## Historical event replay result

Recent append-only click history was replayed into the shadow eScout logic.

Result:

- 17 currently eligible Future eScout jobs were created from real guest MPWR click events.
- Structural exception count remained zero.

This provides a real shadow workload without changing tScout/iScout job sources.

## Dedicated eScout shadow worker — branch ready, not deployed

Repository: `epicautomationmoab/epic-scout-worker`.

Branch: `escout-shadow-worker`.

New entrypoint:

- `escout-shadow.js`

Branch-only script:

- `npm run start:escout-shadow`

Important isolation properties:

- Does not call `sync_scout_mpwr_queue()`.
- Does not claim `scout_mpwr_queue` rows.
- Claims only `escout_future_jobs_shadow`.
- Loads only the readiness row connected to the claimed shadow job.
- Uses a separate browser profile by default.
- Keeps the same MPWR maintenance window.
- Entry point passes `node --check` syntax validation.

The shadow worker currently performs observation-only MPWR checks and records completed-waiver counts into eScout shadow job state. It does not yet replace the production waiver snapshot writer.

The worker has intentionally **not been deployed** yet. Deployment is the boundary where a separate Railway service would begin logging into MPWR and consuming the 17 shadow jobs.

Bob, Rhett, Patti, tScout, and iScout remain unchanged.

## Next guarded step

Deploy `escout-shadow-worker` as a separate Railway service using the branch-only entrypoint, observe real MPWR checks against the shadow queue, and compare:

- click time -> first check latency,
- completed-waiver count changes across the +2/+5/+10 sequence,
- repeat click wake behavior,
- Future -> iScout lane transfer,
- error/retry behavior,
- no interaction with the live Scout queue.

Do not redirect tScout/iScout or retire legacy Future polling until this observation period is clean.
