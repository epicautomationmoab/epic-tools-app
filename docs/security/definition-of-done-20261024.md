# Epic Tools security hardening — definition of done

This is a finite release project, not a perpetual health audit. Anything outside the following exit criteria is a separate backlog item unless a confirmed critical vulnerability requires immediate containment.

## Release acceptance gates

1. **Authentication:** every staff-facing privileged route accepts only a validated, active individual employee identity; no shared workstation, PIN-only, preview-token-only, or generic actor fallback. Protected reads and writes both covered.
2. **Authorization:** manager/admin functions have explicit role checks; mutations validate identifiers, input values, and business permissions. Guest/public routes retain only explicitly scoped, token-validated actions.
3. **Database least privilege:** all identified exposed sensitive views and operational SECURITY DEFINER RPCs have documented allowed callers, with public grants revoked or narrowly controlled where appropriate. The previously found nine views and high-risk mutator RPCs are a fixed priority set; do not demand elimination of all 310 SECURITY DEFINER functions without evidence.
4. **Preview isolation:** preview cannot write to production through proxies or shared database credentials; prove this in tests.
5. **Audit provenance:** state-changing employee actions have durable, non-user-supplied actor identity, timestamp, target record, action, and outcome. Where suitable, preserve before/after values. A full UUI Audit Center user interface is a **separate delivery**, not a reason to indefinitely hold this security release.
6. **Regression:** authentication positive and negative tests, manager/agent permissions, tour check-in, rental out/returned, deposits/Victor, waivers, guest contact updates, people overrides, no-show, manual MPWR, courtesy calls, C360, agent automations; verify no data leaks or broken workflows.
7. **Production rollout:** reviewed merge, approved targeted SQL changes, explicit rollback plan, and post-deployment denial and smoke tests. Fix blockers before declaring completion.

## Status definitions

- DONE: built, tested with evidence in staging, deployed, postdeployment validation passed.
- BLOCKED: failed build, absent test environment, unverified caller, or unsafe preview to prod route.
- BACKLOG: noncritical cleanup, broad style refactoring, new UI components, entire UUI Audit Center screen, recurring health reviews.

## Finish-line deliverable

One release report listing each acceptance gate with PASS/FAIL, tested routes, effective Postgres grants, production deploy SHA, rollback reference, and any consciously accepted residual risks. Close the security hardening project after all release gates pass; open remaining enhancements as independent tickets. Never represent a green build alone as security assurance.

## Current outstanding blocking issues as of 2026-10-24

- Latest admin access-control commits failed TypeScript build due to deleted config and row type in TripWorks lookup; restoration committed in 6b2eafb4 and requires new build verification.
- Privileged Postgres grants have not been revoked.
- Functional access-control test coverage and isolated staging database not established.
- Preview-to-production isolation incompletely inventoried.
- Durable audit provenance coverage not yet complete.
