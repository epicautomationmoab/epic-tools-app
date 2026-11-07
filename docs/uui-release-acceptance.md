# UUI release acceptance — fixed scope

Updated November 5, 2026. This checklist replaces open-ended feature milestones. Existing EpicTools Readiness and imported Sales/C360 are the application; login/Home provide the gateway. No Readiness rebuild. Production release still requires Jennifer's approval.

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
| Roles and audit | Team/manager/owner route denials; Jennifer/Joe-only audit; requested action coverage, older search and denied actions | Notes history works. Source-level pagination and employee filtering across older records are implemented and tested; follow-up events are included. Failed-action recording and full source coverage remain incomplete. Legacy unmigrated notes read-only. |
| Operational dependencies | Extension availability; MPWR document access; preserved Slack/Joe maintenance routing with no real test sends | Chrome extension unavailable for testing; MPWR drawer retrieval passed browser verification on November 4. Maintenance handlers previously compared unchanged; no delivery claim. |
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

## EXC browser checkpoint — November 4, 15:08 Mountain
- Deployed code cd7a5b9784c19d44fb8a58d3cd67b06cd676d2e1; deployment dpl_FzfSV7JAarCfAhSk2mL6UgMWCJyS READY, protected UUI Preview.
- Portal auth repair confirmed in browser: itinerary, driver agreements, verified Polaris and OHV requirements display.
- Temporarily moved only PREVIEW-HISTORY-312 synthetic readiness/store-visit dates from Nov 4 to Nov 5 with transaction-local fixture trigger suppression (no operational automation). Restored both tables to original Nov 4 dates afterward.
- Guest portal EXC entry, welcome, driver selection and drawn test initial passed. Synthetic session 3eebd03d-4e1f-40f0-a202-35d944c848f1 persisted with one participant and outcome in_progress, zero watched seconds, no qualification.
- Vimeo 1239550688 displays: "Because of its privacy settings, this video cannot be played here." The stable UUI domain needs to be allowed for this video: epic-uui-development-automation-4515s-projects.vercel.app. Do not make video public or bypass tracking.
- Knowledge check correctly remains disabled. Full playback, resume and assessment-to-Arrival/Exceptions still require browser verification after video access is corrected.
- Evidence: /workspace/scratch/uui-exc-vimeo-domain-block-20261104.jpg.

## Revised EXC availability — owner direction November 4
- Supersedes the 30-minute cutoff: opens at 8 AM Moab time prior day, stays open until actual rental_out (Checked Out); rental_returned also closed. Scheduled time passing does not close EXC.
- Existing handoff records drive the decision. No new parallel status or database schema.
- Guest portal receives per-item handoff status; new/resumed orientation and participant/progress/inquiry saves check current checkout status server-side. Completed/history reads remain available.
- Multi-item selection favors items not checked out. Guest page refresh closes an open orientation when that item's checkout arrives.
- Tests verify late and multi-day starts, opening/DST, and API rejection after checkout without creating a new session.

## EXC late-arrival browser acceptance — November 4
- Rule deployed to protected UUI Preview at 7ace6c2062bf2be4b796f29fa8355e1c92495a7a (dpl_9cSEGjtDP3MeEqpcJDEfCCi84UMo READY).
- Vimeo domain correction verified: video 1239550688 loads and plays normally in the stable Preview portal. Actual player duration is 702 rounded seconds; real playback checkpoints persisted to the existing synthetic session. No manufactured viewing credit or qualification.
- Existing saved driver session opened after scheduled pickup when unit A was not checked out. Unit B remained returned throughout.
- Restoring unit A's original returned handoff automatically closed the active orientation on the portal refresh and removed the Continue Orientation button. Server start/progress guards also pass focused tests.
- Temporary fixture change was limited to removing/restoring handoff 19ba941c-c99a-416d-8e7b-847cf01333a8 with transaction-local trigger suppression. Original ID, timestamps, attribution and status restored and verified; reservation dates unchanged. No operational notifications sent.
- Closed-card copy no longer invites the guest to finish an unavailable orientation. Typecheck and availability regression pass.
- Full uninterrupted video completion and knowledge-check-to-Arrival/Exceptions browser journey remain unverified. This checkpoint proves video playback/persistence and checkout availability, not full EXC qualification or release readiness.

## Cancellation policy acknowledgement — required combined-release acceptance
- Owner explicitly reconfirmed this existing C360 workflow must be preserved. Imported C360 reservation panel, automatic popup, policy selection, guest acknowledgement page, acceptance history and Readiness panel are present.
- Found imported Sales proxy pointing at nonexistent /api/sales/team/cancellation-agreements; replaced it with a direct call to the existing EpicTools handler. Candidate lookup also shares the existing local handler without HTTP forwarding.
- Isolated UUI reads no longer use the legacy Preview-to-production forwarding path. Preview GET does not silently restore expired records. Employee auth remains required and Sales workstation access is denied.
- Preview create/reset/delivery remain explicitly blocked in the handler and middleware; no guest email/SMS is sent. Existing policy language and production behavior unchanged.
- Isolated acknowledgement request and acceptance tables exist but are empty. Presence of imported code is not full workflow acceptance.
- Required before combined release: test synthetic copy-link creation, correct policy selection, guest acceptance evidence/version/time, accepted/replaced/expired behavior, and the same status/history visible in C360 and Readiness. Delivery integration must remain disabled during synthetic testing. Legal acceptance requires owner-controlled test submission or an explicitly approved nonbinding fixture flow.
- Focused regression verifies local reservation-scoped lookup, employee/workstation boundaries, blocked Preview delivery/reset and zero live forwarding. Typecheck passed.

## Full EXC playback findings — November 4
- Real full-length playback reached the Vimeo end event and unlocked the knowledge check. All ten answers persisted, but final submission correctly refused qualification because server-side Vimeo metadata was unavailable.
- Verified Vimeo's own Progress Bar DOM reports max=701 and duration label 11:41 for video 1239550688. Configured EXP_VIDEO_DURATION_SECONDS=701 only in UUI Preview/Development. Fractional player checkpoints round to 702; existing one-second representation tolerance retained. Reverify when replacing the video.
- Found resumed participants could advance without awaiting the final playback checkpoint. Continue now requires a successful final save before showing the assessment; failures remain visible and retryable. Full-viewing and end-event checks remain enforced.
- Employee browser currently idle-locked; do not bypass its PIN. Staff-side visual acceptance needs an unlocked session.

## EXC successful guest acceptance — November 4, 15:50 Mountain
- Corrected build 0d17c91311c8b35e4681d80881393fa06a7a1327 deployed READY as dpl_FprKJJbVwon2w3gvrazBA8BDWgy1 in protected UUI Preview.
- Replayed the final previously-unsaved segment through Vimeo UI; no manufactured viewing credit. Final awaited save persisted all 702 seconds and video_ended=true.
- Resumed all ten saved answers, submitted successfully. Existing synthetic session 3eebd03d-4e1f-40f0-a202-35d944c848f1 now outcome=complete, completed_at=2026-11-04T22:50:02.840Z, attemptCount=1, participantCount=1, verifiedForCheckout=false.
- Browser displays Synthetic Document Signer — Orientation Complete and existing optional Belt & Tire information prompt. No purchase, request or outbound message submitted. Missing Polaris/OHV and party paperwork correctly prevent full EXC qualification.
- Original Unit A returned handoff restored again with original identity/timestamps/attribution; Unit B and reservation dates unchanged. Completed session is retained as synthetic acceptance evidence.
- Evidence: /workspace/scratch/uui-exc-orientation-complete-20261104.jpg.
- Remaining acceptance: staff Readiness/Arrival/Exceptions visual propagation with unlocked employee session, full qualifying-party scenario, group/other-driver browser coverage, and cancellation acknowledgement creation/acceptance/history workflow. Saved video coverage resumes, but automatic player seek to the saved position remains a usability gap.

## Renewed employee-session verification — November 4, 16:03 Mountain
- Jennifer signed in again. Verified Home -> existing Readiness without a second login or PIN prompt.
- Actual Readiness drawer for PREVIEW-HISTORY-312 unit A shows Synthetic Document Signer — Orientation complete; other requirements pending. Missing Polaris waiver and OHV certificate remain explicit, and 0/1 verified prevents false full qualification.
- Cancellation acknowledgement dialog reads successfully in Readiness, shows the existing three policy choices and Jennifer Test attribution. No copy link, SMS, email, or acceptance submitted.
- Arrival Board loads without error but has no waiting arrivals in the restored returned test data. Do not count this as qualification-badge acceptance.
- Exceptions page has no EXC section. Read-only comparison with feature/exp-vimeo-preview-20261026 found the same absence in its Exceptions page, so this is an outstanding integration requirement rather than a recovered section ready to copy. Original feature branch untouched.
- Staff evidence: /workspace/scratch/uui-exc-readiness-verified-20261104.jpg. No fixture or production changes in this pass.

## November 5 integration closure
- Audit reader now queries employee/area filters before pagination, merges up to 50 events per page, and preserves per-source offsets plus an upper timestamp bound. Sources with errors remain visible and block advancing the incomplete page. Notes retain before/after text; Sales follow-up events are now included with current profile names and original actor IDs.
- Seven isolated audit history checks passed across 532 synthetic events, including older search, concurrent new events, malformed cursors, filter changes and partial-source failure. This does not establish comprehensive audit coverage; denied actions and other unconnected categories remain open.
- Cancellation Copy Link is now allowed only with the exact UUI project, Preview/Development environment, isolated database URL and outbound suppression enabled. Active employee identity is required; workstation/legacy preview alone cannot create links. Links remain on the current Preview origin. SMS/email/reset remain blocked. Accepted acknowledgements cannot be hidden by creating a new copy link unless the existing guest-name replacement condition applies.
- Cancellation route tests and 97 internal-write boundary checks passed. No schema changes; development request table has no custom outbound triggers. Live copy-link/guest-view checks pending deployment.
- On-site kiosk acknowledgement code is deployed at 1e5923823ca9a1160b8ed571d7293cc99f157e4c. Detailed evidence and the outstanding open-rental browser test are in uui-onsite-assessment-2026-11-05.md.
- EXC Exceptions now includes late pickup items from the operational source; earlier November 5 browser verification confirmed active synthetic issue appears and disappears on returned status. Original fixture restored. Employee inactivity lock is now eight hours, as requested; normal session refresh retained.

## November 5 browser integration acceptance — continued release candidate
- Audit browser verification: 39 total operational events; employee filter `Jennifer` returns eight correctly attributed note/follow-up events. Fixed direct PostgREST `ilike` quoting found during browser testing. Older-history pagination has seven focused checks over 532 events.
- Readiness cancellation Copy Link succeeded for PREVIEW-HISTORY-312 Unit A, using the correct 48-hour declined-TripSafe policy and Jennifer Test attribution. Historical reservation lookup now uses the operational view, not the daily-only view. C360 shows the same Created acknowledgement in lifetime history. No SMS/email or legal acceptance submitted. Guest-page acceptance remains open; browser clipboard export did not yield the created URL.
- Shared CallRail host browser acceptance: one synthetic unknown-call popup in Admin opened the imported Guided Lead Sheet with caller name/phone; recognized synthetic call opened local `/sales/customers` and the correct customer's C360. Two additional synthetic calls were dismissed together from Sales; per-profile database seen records share the same timestamp and no popup reappeared after navigation to universal Ping. No real calls occurred. Ping navigation/recipient loading passed; this is not a new live Ping send/acknowledgement test.
- Lead Sheet saves were still blocked by the Preview middleware and stripped database permissions. Restored exact isolated-route POST allowance; isolated draft/read storage uses the existing guarded server helper only after active employee validation. Finalization retains the imported authenticated transaction and auth.uid()-derived employee attribution. Anonymous execution and direct authenticated table insertion remain denied.
- Transactional database finalization created the contact/opportunity/claim and then rolled back completely; workstation invocation rejected. Route tests verify login/workstation rejection, caller attribution cannot be supplied by the request, isolated storage, existing employee-authenticated finalizer, invalid-phone rejection and unchanged non-UUI transport. 104 middleware boundary checks and TypeScript passed.
- Live browser draft and Save & Open C360 passed: sheet `cafecc0a-f95a-460b-834c-452c56476508`, contact `4162d3fc-85e7-4fad-a901-2e8472ab3133`, opportunity `5749285b-1c17-4e32-9b01-860212add57a`, claimed by Jennifer Test. Synthetic test only, no outbound messages.
- Browser caught imported Lead Sheet lifecycle insertion after an unconditional return. Moved insertion before sorting/return and refresh its data when contact identity changes or the editing sheet closes. Regression verifies saved discovery text and chronological ordering; final deployed reopen/edit check pending below.
- Preserved concurrent waiver-link/source-color correction from the other thread (`e1de6dce`) in the shared branch. No force pushes or branch cleanup. Production and original EXC project remain unchanged.
- Final deployed verification PASSED: code `2d027b8626aaeb8a6c63ec4dbff72cb8a9de308d`, protected Preview `dpl_6yiutoZse7L7swCeqaUhDuDQgnMa` READY. C360 shows Guided Lead Sheet discovery text, opens persisted fields, and refreshes the edited text on Save. Database confirms the same saved sheet and exactly one linked opportunity, attributed to Jennifer Test.
- No launch-readiness claim: outstanding gates remain the operational Readiness/Admin writes, open-rental on-site/group EXC and qualified Arrival Board, cancellation guest acceptance/version/replacement, complete audit coverage, extension availability and production configuration/rollback approval. The next independent work is existing internal Readiness mutations (service inbox handoff/close, guide assignment, observations, deposits/handoffs), with outbound effects kept suppressed.

## November 5 inbox and internal administration closure (recovered checkpoint)
- Deployed code 08aa579e2ae7ffc0c7dc0fa20770469978ec5ef0, deployment dpl_HrEjxSyCSVQGRpJL82MWfvnxXsLk confirmed READY on November 6.
- Browser verified synthetic Tour Inbox note -> Send to Sales -> same note in Sales -> Send to Service -> both employee-attributed transfers in Tour Inbox -> Close Conversation. Database confirmed close and retained history. No outbound reply was sent.
- Existing internal guide assignment, MPWR observation, deposit hold/manual reconciliation and Admin creation/archive routes are allowed only inside the exact UUI Preview boundary. Transaction tests for guide/observation/deposit rolled back. Admin and Readiness route tests pass; browser acceptance for these remaining actions is still open.
- Removed legacy preview-cookie substitution for manager identity in Admin creation/archive. Service history errors now surface instead of silently appearing empty.
- Two synthetic Patti dispatch fixtures preview-dispatch-1 and preview-dispatch-2 were temporarily moved from November 3 09:30 UTC to November 5 09:30 UTC for a browser test that did not finish. Inspect and restore those exact original dates before further fixture use. No live reservation was changed.

## November 6 continuation
- Recovered source from GitHub after temporary workspace cleanup. No user files were deleted by the user and no saved source was lost.
- Merged current main 96c0971 into the integration branch cleanly. Preserves both waiver/source-color correction #112 and the original application's unfinished-return visibility #113. No Axel In implementation change was made here. The earlier mergeability warning did not reproduce as a Git conflict.
- Both existing handoff surfaces (Readiness and Held-Over Rentals) now use one same-origin server endpoint instead of calling the database anonymously. The endpoint verifies the existing employee/workstation session, validates the request, derives attribution on the server, and invokes the existing set_epic_operational_handoff transaction. No business rules were reimplemented.
- Handoff remains blocked in Preview: the original transaction can launch Cassie settlement, schedule post-visit email, and alter deposit eligibility/Scout work. Read-only trigger inspection confirms these effects. No cron.job table exists in this database, but that alone does not prove external consumers are disconnected. Do not mark the handoff workflow accepted until isolated side effects and end-to-end persistence are verified.
- Focused handoff tests passed authentication denial, valid statuses, spoofed attribution rejection, malformed input, existing workstation attribution, direct-handler Preview denial, and sanitized failures. Existing 153 boundary checks, Admin route checks, Readiness internal route checks, and TypeScript passed.
- The browser currently redirects Admin to unified employee sign-in. Remaining authenticated browser tests need a renewed session; no password reset or PIN bypass was attempted.
- Full Next.js production build passed (existing CSS compatibility warnings remain). Exact source tree b6446f3b2bcc82c94bf46c2f2cb4bcfccc639ddd was saved remotely in commit 0e9bcbe5e0d37fe534a6215083b843ec87fc6352, including current main as a merge parent. Preview deployment dpl_5pBbuqi7UoUQhijqDfsmF8VvfPro started for that exact commit.
- Restored both temporary dispatch fixture dates to November 3 09:30 UTC, with null end times; database RETURNING verified both original values. Guarded update touched only the two named synthetic rows at their known temporary timestamps.

## November 6 renewed-session browser acceptance
- Jennifer renewed the test session. Home -> Admin -> Readiness worked without a second login.
- Created Synthetic Admin Acceptance (agent, example.invalid address), then archived through the normal confirmation. Active count returned from seven to six; All shows Archived / access disabled. Database verified profile e4714a1d-d463-4078-808c-fdf9077c20ab, active=false, user_id=null. No invitation or password-reset email was sent; no login credential was created.
- Tour Dispatch guide assignment saved Synthetic Guide Acceptance Nov 6 through the existing UI; full reload retained it. Database confirmed updated_by_name Jennifer Test. Only preview-dispatch-1 was temporarily dated November 6; it was restored to November 3 09:30 UTC and verified afterward. Original November 3 guide rows unchanged; November 6 synthetic assignment remains as evidence. No checkout, return or notification was triggered.
- Deposits page loads without error but has no active deposits; do not count this as browser mutation acceptance.
- Reservation Lookup recovered both units sharing PREVIEW-HISTORY-312. Unit A retained the created 48-hour declined-TripSafe acknowledgement and Jennifer Test attribution. Existing created-request UI exposes Reset only; no resend/reset or guest acceptance was performed. The previously copied token is not recoverable from the saved hash.
- EXC drawer still shows the completed orientation and correctly requires missing Polaris/OHV verification. This is not full qualifying-party acceptance.
- Deployment dpl_5pBbuqi7UoUQhijqDfsmF8VvfPro was READY before these tests. Remaining: handoff outbound isolation, deposit browser mutation, complete EXC/onsite/group qualification, cancellation guest acceptance, audit coverage and extension/release validation.

## November 6 handoff containment
- Development-only uui_preview_set_handoff wraps the existing transaction for exactly the two named synthetic rental IDs. Confirms example.invalid identity, released deposit, absent Scout work and no claimed settlement/processing email. Settlement jobs become needs_review and email jobs cancelled before commit; unexpected operational state aborts the transaction. No worker or production function is modified.
- Installed only on jgpihdpcdlqugmqanzfj; installer lives under scripts/uui, not production migrations. SECURITY INVOKER, service_role-only execution; anonymous/authenticated execution denied.
- Transactional rollback verified rental_out -> rental_returned, zero runnable settlement/email jobs and unchanged released deposit. Service-role invocation also passed. Route selects this function only with outbound suppression and exact UUI project/environment/database match; other staging remains denied. Non-preview uses original function.
- Handoff route tests, 153 existing boundary checks and TypeScript passed. Browser persistence verification follows deployment.
- Browser acceptance PASSED on READY deployment dpl_H5DNhcuSFeqDb7LbXiSUqYU1kEL7 (code 12d0466e88f551d5e9b05d674f018e6eb49459cc): synthetic Unit A was prepared as rental_out through the contained wrapper; Held-Over Rentals displayed it. Rental Returned saved through the browser, removed its card, and stayed removed after full reload (count three -> two).
- Database verified rental_returned, recorded_by Jennifer Test, zero queued/claimed Cassie jobs, zero pending/processing email jobs and deposit still released. Original returned status is restored by the tested action; its new employee/timestamp remain as acceptance evidence. No production/EXC-original changes or actual outbound operation.
- This proves the existing handoff persistence path on the designated fixture. It does not validate live worker execution or Scout-present returns. Read-only inspection found the cloned return function assigns Scout status completed although this clone's constraint allows queued/processing/retry/paused; investigate compatibility separately before enabling Scout-present acceptance. No worker/constraint was modified.
