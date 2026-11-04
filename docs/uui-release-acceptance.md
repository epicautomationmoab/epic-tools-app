# UUI release acceptance — fixed scope

Updated November 4, 2026. This checklist replaces open-ended feature milestones. Existing EpicTools Readiness and imported Sales/C360 are the application; login/Home provide the gateway. No Readiness rebuild. Production release still requires Jennifer's approval.

## Completed evidence
- Signed-in Home routes to existing Readiness, Sales/C360, Admin and Management. Shared Epic Ping and audit use the gateway shell.
- Existing Readiness reservation drawer, C360 lifetime lookup/history, management report date selection, Admin profile list and Jennifer audit were browser verified. These checks do not establish every write workflow.
- Quote create/edit/reopen persisted the same quote and totals in the browser.
- C360 shared note creation/visibility and Readiness create/edit/reopen/archive passed browser and database checks. Employee attribution and before/after history retained; stale edits rejected.
- Exact UUI-only write allowlist: 83 checks pass. Real outbound operations remain blocked.
- Introduction-history reader corrected: validates active employee/non-workstation before server-only timestamp query. No direct mailbox grants. Route transport tests pass, including errors and denial. Deployed browser verified: the introduction-history error is gone on Preview Lifetime Customer.
- C360 internal history now combines linked phone/contact/email/reservation and active opportunity threads, deduplicates note IDs, preserves chronological order and mention response destinations, and surfaces read failures instead of claiming no messages. Focused tests passed.
- EXC isolated policy/result checks: 23 passed previously. Booking isolation, guardians, batched readiness and deployment boundaries: 21 additional checks passed in this pass after repairing stale test mocks. No EXC runtime policy changed.

- Session renewal defect fixed: exact UUI Preview boundary now permits the existing refresh endpoint; renewal runs across all employee workspaces and restarts on navigation. Login attempts renewal from the existing HttpOnly refresh cookie without requesting another password. Failed/invalid refresh leaves normal sign-in available. Permission/path/cookie tests passed; deployed browser recovery passed: expired access session renewed automatically, returned to Home as Jennifer Test without password entry, and C360 loaded successfully.

## Remaining release gates (close these; do not add features)
| Gate | Required evidence | Current limitation |
| --- | --- | --- |
| Existing operational workflows | Verify Readiness held-over rentals, deposits, dispatch, reservation lookup, rental/tour inboxes and exceptions; Sales lead/follow-up/opportunity/quote actions; Admin user changes | Loading menus is not acceptance. Most mutations still fail closed under Preview outbound isolation. Classify internal saves versus actual outbound actions and enable only reviewed internal operations in UUI. |
| C360 history | Introduction timestamp renders; selected conversation uses correct customer/thread history | Introduction reader fixed. Reproduced phone-thread notes missing from the opportunity-only panel; linked-thread reader fixed and tested. Deployed browser verified seven prior internal notes (four phone-thread notes plus three reservation-thread notes), with original authors and mention acknowledgment. |
| Shared tools | One CallRail popup opens Lead/C360 and dismisses all past calls; one Ping works across workspaces | Earlier function/access checks exist; complete cross-workspace browser acceptance remains. |
| EXC | Guest/kiosk through assessment to Readiness/Arrival/Exceptions with correct dependencies | Combined UUI release includes EXC. Existing EXC implementation enabled only in UUI Preview/Development; full video coverage required. Vimeo access/duration and full guest flow verification pending. Original EXC staging and branch retained unchanged. |
| Roles and audit | Team/manager/owner route denials; Jennifer/Joe-only audit; requested action coverage, older search and denied actions | Notes history works. Existing audit reader still recent-history subset; failed actions, older pagination and full source coverage are incomplete. Legacy unmigrated notes read-only. |
| Operational dependencies | Extension availability; MPWR document access; preserved Slack/Joe maintenance routing with no real test sends | Chrome extension unavailable for testing; MPWR drawer retrieval unresolved. Maintenance handlers previously compared unchanged; no delivery claim. |
| Release | One tested candidate, environment mapping, rollback and explicit owner approval | Not ready for production. Bookings and Ambassador placeholders remain planned; no new booking engine work belongs in this release. |

## Rules
- Only integration/epic-tools-unified, protected epic-uui-development, and jgpihdpcdlqugmqanzfj may change.
- Do not touch production, separate EXC branch/PR/staging/database, Axel In or nightly sweep.
- Do not send real guest/staff email, SMS or Slack in Preview tests.
- Tests and fixtures are evidence, not additional product features. Repair integration defects; reuse existing business logic.
- Do not report an estimated completion date or full readiness without resolving the gates above.

## Verified candidate
- Deployed code: 70d68c61d65f0f30c7935b7c230e9f796d354232.
- Protected Preview deployment: dpl_9QAidurt2zh2MA8PCAKimXk1BS6T, READY.
- Full build and focused introduction/history/session tests passed; 67 boundary checks passed.
- Browser verified session recovery and both C360 history repairs at approximately 2:00 PM America/Phoenix, November 4.
- No database schema or data migrations in this pass. Read-only DB verification confirmed four phone-thread notes versus zero active-opportunity notes, reproducing the original mismatch.

## November 4 Sales actions and Readiness documents
- Restored existing guarded lead/follow-up function grants in UUI only. Anonymous execution remains denied; no direct table grants. Reviewed affected triggers: no outbound sends for these actions.
- Follow-up NULL outcome validation corrected so completion/attempt cannot omit the required outcome.
- Transactional rollback tests passed lead claim/release, note/edit, close/reactivate; follow-up create/attempt/reschedule/complete/dismiss; workstation and unassigned employee denial; premature dismissal and missing outcome denial.
- Browser: created `Preview follow-up acceptance — Nov 4` from C360, assigned Jennifer Test; found it in My Catch-Up, recorded synthetic attempt, completed with explanation, reloaded, inspected created/attempted/completed history, dismissed. Record `441c054e-4e80-490b-b0a5-f48c39470c75` remains in history; no real call or message.
- Browser: claimed Synthetic Inbox 902 as Jennifer and released with explanation; returned to Unclaimed.
- Readiness document detail read moved from anonymous database request to employee-guarded same-origin reader. Fixed fields and one-reservation bound, no-store, generic error, invalid ID/unauthorized/not-found tests pass. Deployment/browser verification pending.
- Security advisor warnings for these existing employee-guarded SECURITY DEFINER functions are intentional; no anonymous execution. Unrelated pre-existing advisor findings remain.
- Lead sheet draft/finalization and other operational writes remain outside this completed subset. Do not mark all Sales or Readiness workflows complete.

## November 4 unified sign-in correction
- Home-to-Readiness verified in Jennifer's renewed session: same employee, no second login.
- Legacy employee-login URL redirects to unified sign-in in the UUI project; session recovery and Readiness logout target unified sign-in.
- Explicit successful password sign-in resets the existing inactivity clock. Credential refresh does not reset it.
- Sales, Home, Admin and Management activity now updates the same clock as Readiness. Truly expired idle clocks remain locked; listeners clean up across navigation.
- Activity/session tests, 83 write-boundary checks and full build passed.
- Previous document-reader deployment 8e4d3a1: browser confirmed unit A shows three MPWR waivers (Driver, Minor, Passenger) without the anonymous retrieval error.

## EXC combined release integration
- Owner clarified EXC belongs in the combined UUI launch, not a separate release.
- Existing EXC tables and start_exp_driver_session service permissions verified in UUI database; no schema rebuild.
- Preview/Development flags EXP_ASSESSMENT_SERVER_ENABLED and NEXT_PUBLIC_EXP_VIDEO_PREVIEW enabled on epic-uui-development only; production unchanged.
- Server and player full viewing threshold corrected from 98% to 100%. No relaxed threshold in UUI. End-of-video requirement retained; progress label cannot claim completion early by rounding.
- Tests now reject 98% coverage, one missing second and missing end event; existing driver, guardian, OHV, booking separation and result presentation tests pass.
- Original separate EXC staging shortcut is not used by UUI; original EXC deployment/branch/database not changed.
- Browser on enabled UUI: Readiness now shows actual EXC driver requirements instead of "not enabled". Incomplete synthetic driver correctly remains pending with missing Polaris/OHV/orientation, not qualified.
- Availability defect repaired: shared browser/server window opens 8 AM prior day and closes exactly 30 minutes before pickup. Tests cover DST and invalid/past timestamps; full build passed.
- Full guest video playback and completed assessment remain unverified; existing synthetic reservation dates are already past pickup. Do not equate mocked qualification tests with a completed browser guest journey.
- Browser found guest portal denied by PostgREST (missing legacy JWT Authorization header). Reused guarded serverSupabaseHeaders for portal and balance reads; no anonymous grant. Database errors sanitized, balance lookup now fails rather than falsely showing zero. Focused auth regression and full build pass.
