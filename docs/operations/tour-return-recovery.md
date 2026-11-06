# Tour return failure visibility and recovery follow-up

This branch adds read-only failure classification to Tour Dispatch and Exceptions. A released check-in with a recorded job error is immediately actionable; an unreconciled or actively processing check-in older than five minutes needs review. Prepared, unreleased jobs are excluded. Unresolved returns remain visible across dates, and completed dispatches clear automatically. The latest job determines health. No database schema or worker behavior changes are included.

Validation: run `node scripts/test-tour-return-health.mjs` (Node 24). Tests cover the observed MPWR error, completion, unreleased work, missing jobs, five-minute boundaries, active retries, stalled claims, and job/dispatch disagreement.

Automatic retry is intentionally not enabled. Inspection of epic-scout-worker/main/axel-in-training.js found `signOne` drawing synthetic customer and employee signatures, invoked by `completeSignatures` during `processJob`. The checked-in Docker patches do not replace this behavior. The live service build and launch overrides have not been verified. Before adding unattended retries, establish a supported completion path using genuine captured signatures or a documented staff-only MPWR process.

Remaining recovery implementation:
- Verify the specific vehicle's MPWR return state before any retry; reconcile an already-completed return without resubmitting.
- Persist attempt history, retry due time, and atomic worker claims; back off at one and three minutes with a bounded attempt budget.
- An independent watchdog must detect abandoned claims without overlapping a still-running browser worker.
- Classify missing genuine input as human review rather than fabricate values.
- Wire persistent terminal failures to an agreed staff notification destination. No notifications were sent or configured in this change.
- Test worker crashes, duplicate triggers, successful MPWR submission with failed local acknowledgement, multiple vehicles, and retry exhaustion in isolation before release.

Production is unchanged. The existing 11 PM recovery sweep is unchanged. This branch is a partial visibility fix, not the completed automatic recovery system.
