# Security integration staging — bootstrap diagnosis (2026-10-25)

## What was attempted
With owner approval of $0.01344/hour, created Supabase database branch `security-integration-20261025` (project ref `rgvijxshujiszlzuocph`) off Epic Tools production. No production SQL writes were made.

## Verified state
- Branch status is `MIGRATIONS_FAILED`; database query finds **0 public base tables**.
- Migration history on the branch shows only `20260814170908 add_ip_capture_to_epic_waiver_submission`; replay then fails.
- Branch PostgreSQL log identifies the concrete error: **relation public.epic_waiver_signatures does not exist** during migration `add_signer_middle_initial_to_epic_waivers` (`ALTER TABLE public.epic_waiver_signatures ADD COLUMN ...`).
- Read-only check confirms `public.epic_waiver_signatures` **does exist in production**.
- Root cause: migration replay expects a preexisting foundational production schema that is not reconstructed by the recorded migrations. It is not an application auth-test failure.
- Previous `unified-notes-testing` branch has the same general `MIGRATIONS_FAILED` status. Production is unaffected.

## Safe resolution
Create a versioned, vetted **baseline schema migration** derived from production *schema only* (no guest, financial, auth, or reservation rows), resolving ordering/dependency conflicts against the existing migration history. Verify that a completely fresh branch can replay baseline + later migrations. Keep service integrations disabled until separate preview environment variables, callbacks, and worker effects are reviewed. Do not edit production migration history, patch in an ad hoc single table, or repeatedly create billed broken branches.

## Release status
No application preview may point to this incomplete database. Production security release remains **NO-GO** until isolated integration testing and staged grant revocations can be performed successfully.
