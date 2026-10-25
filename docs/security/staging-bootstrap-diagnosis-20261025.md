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


## Verified baseline inventory (read-only production checks, 2026-10-25)

- Production currently has **205 public base tables and 70 public views**.
- Supabase migration ledger contains **478 recorded migrations**.
- Later repository migration `supabase/migrations/20260821_post_visit_thank_you.sql` directly references pre-existing `public.guest_readiness_operational` and `public.epic_waiver_signatures`, independently confirming baseline dependencies.
- This is a **historical-schema/bootstrap mismatch**, not a single missing waiver table. Creating just one table to bypass the first error would produce a misleading, incomplete staging system.

## Safe implementation specification

1. Export a **schema-only snapshot** from production with a controlled PostgreSQL dump workflow, preserving objects, functions, triggers, policies, grants, and dependencies but **no table or auth rows**. Do not put production credentials, guest data, or other private records into Git.
2. Build a sanitized baseline in a disposable isolated database. Avoid replaying today's schema on top of 478 already-represented migrations. Either use a separately maintained migration-baseline strategy with a documented version checkpoint, or resolve existing migrations against an earlier verified foundational schema.
3. Validate object parity on an intentionally narrow critical set before use: `epic_waiver_signatures`, `guest_readiness_operational`, `epic_unified_notes`, finance RPCs, auth dependencies, and row-level security.
4. Prove that the app and agents target only nonproduction resources before any state-changing integration checks.
5. Record creation, teardown, cost, test outcomes, and rollback. Do not declare the app staged merely because the database responds to SQL.

## Current execution boundary

The available connected Supabase tools can run read-only schema inspection but **do not expose pg_dump or database credentials**. A trustworthy 205-table/478-migration baseline cannot be safely synthesized from one-table guesses. No second paid branch was created, and no production schema or migration history was altered.


## Vercel preview isolation evidence (2026-10-25)

Read-only metadata inspection across all four linked Vercel projects (`epic-tools-app`, `epic-tools-preview`, `epic-guest-portal`, and `epic-4x4-ambassador`) shows `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` variables assigned to the **preview target without a branch-specific override**. Most are also assigned to production target; sensitive values were not decrypted or copied. This **does not prove a particular preview deployment connects to production**, but it demonstrates that the existing previews cannot be treated as database-isolated staging without further verification. No write-enabled preview integration tests are authorized under these settings.

Before connecting an isolated database, create explicit branch-scoped staging values and verify all external side effects (agents, messaging, payment, reservation processing) are disabled or sandboxed. Do not mutate shared production+preview environment-variable entries or redeploy the live application to accomplish staging.
