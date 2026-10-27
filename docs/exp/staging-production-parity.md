# Epic Tools: Staging / Production parity gate (2026-10-26)

Production: `kbuxcvqzicnydqllyong` (Epic Tools Operations).
Staging: `cchsrkhpvvrvcuepkqdu` (Epic Tools Security Staging).
Do not run EXP schema or write tests against production. RezTech is a separate project.

## Read-only comparison findings

| Object | Production | Staging |
| --- | ---: | ---: |
| Public tables | 205 | 205 |
| Public columns | 4,641 | 4,641 |
| Public functions | 340 | 339 |
| User-defined triggers | 152 | 150 |
| RLS policies | 18 | 18 |
| Supabase migration-history rows | 478 | 23 |

A definition-hash inventory found one production-only public function:
`mirror_guest_email_to_c360()` and its trigger
`guest_communications.trg_mirror_guest_email_to_c360`.

Functions with differing definitions:
- dispatch_tripworks_webhook_inbox_row
- epic_send_cancellation_booking_push
- get_epic_c360_readiness_docs
- get_staff_booking_draft
- manual_override_mpwr_information
- notify_slack_when_mpwr_completed
- notify_slack_when_mpwr_failed
- portal_patti_reconcile_after_mpwr_queue_ready
- queue_added_mpwr_trip_orders
- queue_day_before_portal_reminders
- reconcile_mpwr_after_move
- reconcile_tripworks_webhook_inbox
- refresh_guest_readiness_for_trip
- refresh_guest_readiness_operational
- run_bob_for_trip_reserved
- run_mpwr_queue_after_reservation_change
- save_manual_mpwr_identity
- send_rhett_daily_health_report
- send_rhett_stuck_job_alert
- sync_mpwr_job_to_guest_readiness

The equal table counts do NOT establish schema parity. The migration count gap may
be a baseline-history artifact. Review changed function SQL, grants, dependencies,
trigger bodies, cron and outbound integrations before applying changes.

## Release policy

1. Production is the baseline. Sync approved production fixes to staging
   using reviewed, repeatable migrations. Keep staging-only test data and keys.
2. Ensure outbound integrations are mocked or disabled in staging (email,
   SMS, Slack, webhooks, third-party booking agents). Test no external side effects.
3. Each EXP release must pass in staging before a separately authorized
   production migration and deploy. EXP features may be *ahead* of production
   only in staging, and must not share a production secret key.
4. Check function/trigger/table/column/policy definitions, grants and migration
   identity. Do not force migrations or fake schema-migration history.
5. Use a dedicated Vercel test deployment connected only to staging; do not
   change shared Preview environment variables and accidentally repoint
   Jenna and Joe's reviewer deployment or production.

## EXP launch blockers

- EXP foundation migration exists in the feature branch but has NOT been applied.
  The attempt through Supabase MCP was blocked, not completed.
- EXP checkpoint APIs are disabled; video and quiz UI are not connected to
  persistent server checkpoints.
- Server video-completion verification, assessment retry state, group identity
  reconciliation, document gates, and real Readiness/Arrival integration
  require staging end-to-end tests.

An EXP video successfully completed once should retain its credit across
ordinary resume. Only the approved quiz-failure replay rule or mandatory new
safety-video version should invalidate credit.

## Staging hardening verified October 26, 2026

- The dedicated Vercel EXP staging deployment is READY. Its assessment server flag remains off and its server credential is not configured.
- On staging project `cchsrkhpvvrvcuepkqdu` only, migration `isolate_staging_outbound_dispatch_triggers` disabled four trigger hooks: `mpwr_agent_queue.trg_notify_slack_when_mpwr_completed`, `mpwr_agent_queue.trg_notify_slack_when_mpwr_failed`, `operational_reservations.epic_cancellation_booking_push`, and `tripworks_webhook_inbox.trg_dispatch_tripworks_webhook_inbox`.
- Verified all four have PostgreSQL trigger state `D` (disabled). Regular webhook data-processing triggers were NOT disabled.
- These changes are staging-only intentionally; production trigger states must not be overwritten in parity checks.
- Staging requires additional review of direct function calls, other webhook providers, external agents and secret storage before claiming globally guaranteed outbound isolation.
- The connector can retrieve staging publishable keys, but cannot provision or retrieve a server secret key. Do not substitute a production key or enable assessment writes until a staging-only server credential is configured securely.
