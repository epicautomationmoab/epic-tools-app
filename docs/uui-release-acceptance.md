# UUI release acceptance — fixed scope

Updated November 4, 2026. This checklist replaces open-ended feature milestones. Existing EpicTools Readiness and imported Sales/C360 are the application; login/Home provide the gateway. No Readiness rebuild. Production release still requires Jennifer's approval.

## Completed evidence
- Signed-in Home routes to existing Readiness, Sales/C360, Admin and Management. Shared Epic Ping and audit use the gateway shell.
- Existing Readiness reservation drawer, C360 lifetime lookup/history, management report date selection, Admin profile list and Jennifer audit were browser verified. These checks do not establish every write workflow.
- Quote create/edit/reopen persisted the same quote and totals in the browser.
- C360 shared note creation/visibility and Readiness create/edit/reopen/archive passed browser and database checks. Employee attribution and before/after history retained; stale edits rejected.
- Exact UUI-only write allowlist: 67 checks pass. Real outbound operations remain blocked.
- Introduction-history reader corrected: validates active employee/non-workstation before server-only timestamp query. No direct mailbox grants. Route transport tests pass, including errors and denial. Deployed browser acceptance must still be recorded.
- C360 internal history now combines linked phone/contact/email/reservation and active opportunity threads, deduplicates note IDs, preserves chronological order and mention response destinations, and surfaces read failures instead of claiming no messages. Focused tests passed.
- EXC isolated policy/result checks: 23 passed previously. Booking isolation, guardians, batched readiness and deployment boundaries: 21 additional checks passed in this pass after repairing stale test mocks. No EXC runtime policy changed.

- Session renewal defect fixed: exact UUI Preview boundary now permits the existing refresh endpoint; renewal runs across all employee workspaces and restarts on navigation. Login attempts renewal from the existing HttpOnly refresh cookie without requesting another password. Failed/invalid refresh leaves normal sign-in available. Permission/path/cookie tests passed; deployed browser check pending.

## Remaining release gates (close these; do not add features)
| Gate | Required evidence | Current limitation |
| --- | --- | --- |
| Existing operational workflows | Verify Readiness held-over rentals, deposits, dispatch, reservation lookup, rental/tour inboxes and exceptions; Sales lead/follow-up/opportunity/quote actions; Admin user changes | Loading menus is not acceptance. Most mutations still fail closed under Preview outbound isolation. Classify internal saves versus actual outbound actions and enable only reviewed internal operations in UUI. |
| C360 history | Introduction timestamp renders; selected conversation uses correct customer/thread history | Introduction reader fixed. Reproduced phone-thread notes missing from the opportunity-only panel; linked-thread reader fixed and tested. Browser session expired before final deployed acceptance. |
| Shared tools | One CallRail popup opens Lead/C360 and dismisses all past calls; one Ping works across workspaces | Earlier function/access checks exist; complete cross-workspace browser acceptance remains. |
| EXC | Guest/kiosk through assessment to Readiness/Arrival/Exceptions with correct dependencies | Flags absent. Video threshold is 98% in copied code versus requested 100%; reconcile before enabling. Vimeo access/duration and full guest flow not verified. Separate EXC release untouched. |
| Roles and audit | Team/manager/owner route denials; Jennifer/Joe-only audit; requested action coverage, older search and denied actions | Notes history works. Existing audit reader still recent-history subset; failed actions, older pagination and full source coverage are incomplete. Legacy unmigrated notes read-only. |
| Operational dependencies | Extension availability; MPWR document access; preserved Slack/Joe maintenance routing with no real test sends | Chrome extension unavailable for testing; MPWR drawer retrieval unresolved. Maintenance handlers previously compared unchanged; no delivery claim. |
| Release | One tested candidate, environment mapping, rollback and explicit owner approval | Not ready for production. Bookings and Ambassador placeholders remain planned; no new booking engine work belongs in this release. |

## Rules
- Only integration/epic-tools-unified, protected epic-uui-development, and jgpihdpcdlqugmqanzfj may change.
- Do not touch production, separate EXC branch/PR/staging/database, Axel In or nightly sweep.
- Do not send real guest/staff email, SMS or Slack in Preview tests.
- Tests and fixtures are evidence, not additional product features. Repair integration defects; reuse existing business logic.
- Do not report an estimated completion date or full readiness without resolving the gates above.
