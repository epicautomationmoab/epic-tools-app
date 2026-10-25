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
