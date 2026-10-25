# Security release candidate — evidence and release decision (2026-10-25)

## Verified

- Commit `05ceb65f`: 22/22 automated regressions passed in Vercel logs.
- All four Vercel preview builds for the commit are READY.
- Mocked route execution covers employee authentication, workstation denial, manager access, finance, no-show, contact, coverage, guest counts, courtesy calls, MPWR, notes and unified-note ownership.
- Read-only production schema inspection confirms `epic_unified_notes` has the author and note identifier fields used in the new access control.
- No production SQL grants, app deployments, or reservation records changed.

## Release blockers — still open

1. No functioning isolated integration database with production-equivalent policies has been established for the security release. Do not test financial or operational mutations against live reservations.
2. Preview-to-production write isolation remains unproven across the app and its other connected services.
3. Targeted sensitive view and RPC grants remain unchanged in production. Caller compatibility and policy regressions have not been verified after staging revocations.
4. End-to-end guest readiness, rental checkout/return, deposit/release and agent workflows have not been tested against an isolated environment.
5. Durable mutation audit coverage and release rollback/post-deploy smoke plan still require verification.

## Decision

**NO-GO for production merge.** The 22 passing tests prove mocked code behavior, not operational integration safety. Do not expand the unit-test count instead of resolving the infrastructure and integration gates. No new branch or production mutation without owner authorization.

## Next bounded work

- Inventory preview environment targets without revealing credentials and block unsafe write paths before allowing integration requests.
- Establish a safe disposable integration database using an explicit, non-production configuration and representative synthetic data.
- Apply only staged targeted REVOKE changes in that disposable environment, verify effective grants, and execute essential operational tests.
- Prepare exact rollback steps and request the owner's approval before any production rollout.

## Staging integration update — October 25, 2026

- Dedicated Supabase staging project `cchsrkhpvvrvcuepkqdu` restored: 205 tables, 70 views, 339 functions, 18 RLS policies; all 205 tables have RLS enabled.
- Staging `anon` and `authenticated` roles denied application schema access pending narrow test-specific permissions.
- Vercel projects `epic-tools-app` and `epic-tools-preview` received **security-branch-only** preview overrides for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` targeting staging, plus disabled placeholders for `SUPABASE_SECRET_KEY` and `RESEND_API_KEY`.
- Staging-safe build does **not** imply authenticated end-to-end workflows work; server-side staging service credentials and synthetic employee fixtures still required.
- Other external side-effect integrations must remain disabled or separately isolated before running write tests. Production unchanged.

## Preview isolation — all four Vercel projects

Security-branch-scoped overrides installed in `epic-tools-app`, `epic-tools-preview`, `epic-guest-portal`, and `epic-4x4-ambassador` for staging Supabase URL and anon key. Branch overrides set deliberately invalid server secret and email API key while operational mutation tests remain prohibited. Shared production and other-branch variables left untouched. Four-preview deployment verification to follow this commit.

## External integration isolation

For security branch only, `epic-tools-app` preview overrides now disable CallRail, Podium, Resend webhook, push, cron and VAPID private credentials; guest emails disabled in Epic Tools App and Guest Portal previews. These are intentionally inert credentials, not substitutes for controlled integration test credentials. Shared production settings are unchanged. Run authorized end-to-end tests only after synthetic identity and explicit staging-only service role are configured.
