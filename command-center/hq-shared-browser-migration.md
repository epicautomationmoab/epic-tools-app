# HQ shared-computer identity retirement — implementation checklist
Status: IN PROGRESS / PREVIEW ONLY, 2026-10-20
Owner direction: HQ main computer uses Safari and Chrome as separate employee work contexts. Access is by named employee and individual PIN. Lock each browser after **20 minutes idle**. The generic "HQ Reception" actor is to be removed.

## Verified behavior and danger zones
- `app/team/readiness/LogoutButton.tsx` currently implements a browser-side idle overlay using localStorage; this branch changes 30 to 20 minutes. The overlay alone is **not** a secure server-side session timeout.
- `lib/server/action-identity.ts` already supports actorDisplayName + actorPin for shared/preview sessions, verifies PIN against active employee profile, but returns only an actor name and sharedSession indicator. Some consumers may need the actor's stable profile id.
- `lib/workstation-auth.ts` and `lib/server/workstation-auth.ts` still support legacy workstation authentication tied to `EPIC_HQ_RECEPTION_PASSWORD`.
- `middleware.ts` currently accepts `epic_workstation_access` for /team access. Middleware checks existence of employee cookie rather than verifying it; server endpoints must continue validating sessions.
- `lib/workstation-auth.ts` resolves an HQ Reception fallback actor with null actorId; actual callers include guest forms, guest-payment visibility, post-visit communication preferences and document retrieval. Remove only after mapping callers and replacing server-side checks.
- Browser storage/cookies are independently scoped in Safari and Chrome; do not silently share or switch one browser's employee identity to another.
- The login and PIN pathways must be verified in each browser with distinct employees.

## Safe migration contract
1. Confirm each employee has active team profile, configured individual PIN, and appropriate permissions; do not expose PIN values.
2. Inventory all workstation-cookie and `getGuestFormsActor` consumers, their GET/POST actions and the exact fallback behavior.
3. Build named-staff PIN unlock flow with server-side expiry/verification and stable actor profile id recorded for each write, with workstation/browser metadata if permitted.
4. Make the 20-minute *inactivity* period explicit; a locked or expired browser must not permit write APIs through an old token. Avoid confusing idle lock with full sign-out; define refresh window separately.
5. Test concurrent Safari and Chrome sessions, tab reuse, sleep/wake, midnight transition, PIN change and revocation, employee handoff, expired token, and untrusted direct API request.
6. Stage replacement of HQ Reception fallback behind isolated preview. Verify guest forms, document delivery, waiver retrieval, Readiness, C360, arrival and guest portal.
7. Retire legacy password/cookie paths and remove HQ Reception user-facing label only when migration tests pass and old session traces are understood. Retain historical audit names as immutable facts rather than rewriting the past.
8. Confirm independent actor attribution and manager audit page filtering. Include staff quick reference and manager recovery runbook.

## Employee job aid draft
- Open Safari or Chrome on the HQ computer. Sign in with your own Epic employee identity.
- Work normally; after 20 minutes with no activity, your browser locks.
- Enter **your own PIN** to unlock; do not use another employee's PIN.
- To change employees in a browser, use Log Out and sign in under the next employee. Opening Chrome does not log out Safari.
- If your PIN fails or the wrong name appears, stop and ask a manager; do not conduct customer or payment actions under another person.

No production credential, role, or database change is authorized by this checklist.
