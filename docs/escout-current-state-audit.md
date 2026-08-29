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

## Current Scout queue

Primary queue: `public.scout_mpwr_queue`.

Current queue supports atomic claiming with:

- `claimed_by`
- `claimed_at`
- `lease_expires_at`
- `attempt_count`
- `next_check_at`
- `status`
- `active`

It also already contains MPWR click state:

- `last_guest_mpwr_click_at`
- `mpwr_portal_click_count`

Additional pre-email/tScout verification fields:

- `pre_email_check_requested_at`
- `pre_email_check_completed_at`
- `pre_email_communication_id`

## Current worker source and loop cadence

Worker repository: `epicautomationmoab/epic-scout-worker`.

Main worker file: `scout.js`.

Current defaults from the worker source:

- Empty-queue recheck: every 20 seconds (`EMPTY_QUEUE_SLEEP_MS=20000`).
- Shared queue synchronization: every 5 minutes (`SYNC_INTERVAL_MS=300000`).
- Claim lease: 15 minutes (`LEASE_MINUTES=15`).
- Lease renewal while processing: every 5 minutes.
- MPWR maintenance/offline window: midnight through 2:00 AM in `America/Denver` by default.
- Queue synchronization is forced on each fresh browser/login start, then repeated on the sync interval.

The same worker code supports multiple named modes through the `SCOUT_MODE` environment variable. Deployment-specific environment values are not stored in GitHub, but the database claim function defines the operational behavior of each supported mode.

## Current claim behavior

Function: `public.claim_next_scout_mpwr_job(worker_name, worker_mode, lease_minutes)`.

Supported modes:

- `today`
- `immediate`
- `near_term`
- `future`

Current date routing is already Moab-time aware:

- `today`: visit date = current Moab date
- `immediate` / `near_term`: current date + 1 through current date + 2
- `future`: current date + 3 and later

Atomic claim is implemented with `FOR UPDATE SKIP LOCKED` and a default 15-minute lease.

Expired `processing` leases are claimable again.

## Current finish / retry cadence

Function: `public.finish_scout_mpwr_job(...)`.

On success the job returns to `queued`; on failure it becomes `retry`.

Current scheduling after each check:

- Failure: +10 minutes
- Today and within 1 hour: +1 minute
- Other today: +3 minutes
- Tomorrow: +10 minutes
- Future with missing expected waivers: +60 minutes
- Otherwise: +4 hours

Function: `public.release_scout_mpwr_job(...)` sets `retry` and schedules +10 minutes.

Function: `public.renew_scout_mpwr_job_lease(...)` extends the worker lease.

The worker also retries a transient database failure while finishing a successful job up to 5 times with exponential backoff plus jitter, capped at 30 seconds between attempts.

## Current source population / synchronization

Function: `public.sync_scout_mpwr_queue()` bulk-synchronizes the Scout queue from `public.scout_mpwr_waiver_work_v`.

The function:

1. Reads the entire eligible Scout work view.
2. Deduplicates by MPWR confirmation number.
3. Inserts/updates queue rows.
4. Reactivates matching work.
5. Pauses queue rows no longer present in the source view.

The worker itself calls this function every five minutes and at startup. This is the whole-population synchronization behavior that the lane rebuild intends to eliminate from tScout/iScout clones.

## Current work view

View: `public.scout_mpwr_waiver_work_v`.

It is sourced from `guest_readiness_with_handoff_v`, grouped/deduplicated by MPWR confirmation number, and currently excludes handoff statuses:

- `rental_returned`
- `tour_returned`

### Confirmed tour-status mismatch

Epic Tools' operational handoff function only permits tours to be marked:

- `checked_in`

However both the current Scout work view and the Scout retirement trigger look for:

- `tour_returned`

Therefore a tour marked `checked_in` is not excluded/retired by those current Scout mechanisms.

This must be corrected in the eScout lane/router rebuild. It should not be patched independently without considering shadow-routing behavior and rollback.

## Confirmed rental operational values

Epic operational handoff permits rentals:

- `rental_out`
- `rental_returned`

Scout intentionally remains active through `rental_out`.

Scout is intended to stop at `rental_returned`.

## Current Scout retirement trigger

Function: `public.retire_scout_queue_after_epic_handoff()` is triggered from operational handoff changes.

It currently deactivates Scout when:

- rental + `rental_returned`
- tour + `tour_returned`

The rental condition is correct. The tour condition is inconsistent with the actual `checked_in` value.

## Current waiver snapshot behavior

Function: `public.replace_scout_mpwr_waiver_snapshot(...)` currently:

1. Deletes all existing `scout_mpwr_waivers` rows for the MPWR confirmation.
2. Reinserts the current snapshot.
3. Sets both `first_seen_at` and `last_verified_at` to `now()`.

This confirms the known bug: `first_seen_at` is reset on every snapshot refresh and therefore does not represent first observation.

The lane rebuild must replace this with durable per-waiver identity/upsert behavior so `first_seen_at` is preserved while `last_verified_at` advances.

## Supabase cron audit

No Scout worker is scheduled by Supabase cron.

Current Supabase cron jobs are limited to:

- Rhett daily health report
- Rhett stuck-job alert
- guest readiness operational refresh

Rhett jobs are sacred and are out of scope for eScout modifications.

## Worker health

`public.scout_worker_health` contains stale historical tScout heartbeat-test rows from July/August 2026 rather than a reliable current worker picture.

The current `scout.js` worker source does not contain a live heartbeat write path to `scout_worker_health`, which explains why the table is not a reliable current worker monitor.

Worker health reporting should be repaired as part of the Scout rebuild without involving Bob, Rhett, or Patti.

## Current queue shape observed during audit

At audit time, the existing shared queue contained active work across all date ranges, including more than 300 active future reservations. This confirms that Future work is still maintained in the shared polling population rather than being click-created eScout-only work.

The old shared queue must remain available during shadow testing and gradual cutover.

## Step 1 status

The current Scout worker and database contract are now mapped sufficiently to proceed with shadow lane creation.

Known deployment-specific environment values such as the exact `SCOUT_MODE` set on each Railway service are not represented in GitHub. This does not block the shadow build because the claim-function mode behavior is known and no live worker will be redirected until cutover testing.

## Next build step

Create shadow-only separated Scout lanes linked to the canonical Scout queue/reservation identity, then build a single routing function capable of:

- assigning Today / Tomorrow / Next Day / Future,
- moving work immediately on reservation changes,
- retiring cancelled/ineligible/completed operational visits,
- reconciling all routes nightly in America/Denver,
- recording routing reason and history for auditability,
- leaving the existing live Scout source untouched during shadow testing.
