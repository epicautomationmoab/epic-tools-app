# Security hardening release gate (2026-10-24)

**Status: BLOCKED — development-only changes.** No production deployment or SQL revocations authorized by this document.

## Implemented on security branch

- Shared workstation login retired; numerous team routes no longer admit workstation or preview-token bypass.
- Readiness handoff/set/clear, Active Rentals returned, finance deposits, contact edits, Adventure Assure, no-show, people overrides, legacy notes, courtesy calls, manual MPWR override migrated behind employee-authenticated server routes.
- Server-side Readiness loader verifies employee identity and uses a server-only database key.
- Preview cancellation-agreement forwarding verifies active individual employee.
- Targeted signature-specific REVOKE SQL staged in docs/security/; not executed.

## Verification currently complete

- Vercel preview BUILD / READY checks for earlier commits only. **Build success is not functional security assurance.**
- Production metadata query confirms 231 of 310 public SECURITY DEFINER routines still effectively executable by anon. This has NOT been mitigated in production.

## Must pass BEFORE production merge

1. Inspect every route above against business policy and permissions; validate owner/manager-only financial actions.
2. Identify third-party and browser callers in **all repos**, including worker, Scout, booking agent, and guest portal.
3. Obtain staging test environment/database matching production policies. Never test financially mutating production records.
4. Anonymous direct PostgREST negative tests for each staged RPC; verify authenticated-only staff API permitted cases.
5. Verify denial for invalid/stale token, workstation identity, preview-cookie-only, malformed input; verify permitted employees work.
6. Exercise tour checkin, rental out/returned/reversal, readiness guest-count, notes, courtesy calls, coverage, contact, MPWR, deposit hold/release, Victor auto release; check audit attribution.
7. Apply staged REVOKEs on staging ONLY; verify effective grants, rerun all tests and agent workflows.
8. Verify exposed view permissions & browser consumers and stage least privilege policies before revoke.
9. Build durable immutable audit event infrastructure with actor ID and before/after change snapshots; include failed/denied attempts as security events where appropriate.
10. Deploy with rollback plan and owner signoff; confirm denied requests after production release.

## Known concerns requiring explicit review

- Existing unified notes PATCH/DELETE permits an authenticated employee to edit/archive records beyond their own by note ID; assess role/ownership before deployment.
- Preview cancellation-agreement forwarding targets production API for parity. **Preview writes can affect production**; disable or sandbox mutating preview forwarding before security regression tests.
- Staff-facing backend service calls may use a privileged credential: require application-side validation and database-side EXECUTE restriction.
- No automated test script was present in package.json beyond build/lint; a green Vercel build is not an access-control test.
- Retiring workstation access can invalidate intended shared device workflows; confirm individual login setup before production rollout.

## Preview isolation correction

- Cancellation-agreement GET/POST/DELETE preview forwarding to production disabled in branch. Even GET could mutate agreement status.
- Exception resolution POST blocked on Vercel previews until isolated test data is available.
- This is not full preview isolation. Check every project environment target and test negative cases on preview before allowing write-enabled regression testing.
- Test: preview cancellation GET/POST/DELETE and exception POST return 403; production authorized routes still behave correctly.
