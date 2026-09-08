# Readiness production timeout — 2026-09-08

## Impact
During the first team rollout of the Readiness / Customer Journey release, `/team/readiness` began returning client-side application errors. Vercel recorded repeated 300-second runtime timeouts for the Readiness RSC route.

## Contributing behavior
`AutoRefresh` calls `router.refresh()` every 10 seconds while the page is visible. It does not track whether the previous refresh is still pending. Under a slow Readiness render, another refresh can be started every 10 seconds. With several staff browsers open during training, those overlapping RSC renders can multiply quickly and create a request pile-up.

The Customer Journey release increased the amount of Readiness UI/client payload being rendered, making the existing aggressive refresh behavior less tolerant of a slow request.

## Remediation plan
1. Never allow more than one Readiness refresh transition at a time.
2. Relax the background refresh cadence from 10 seconds to 30 seconds.
3. Keep immediate refresh on focus/visibility only when no refresh is already pending.
4. Validate the complete Customer Journey release on a preview branch before re-promoting it to production.
5. Do not combine unrelated Tour Dispatch changes with the re-release.

The production rollback commit preserved the failed release in Git history for isolated repair and re-release.
