## October 28, 2026 — handoff for team review (release not approved)

**Do not merge or deploy yet.** The isolated EXC staging deployment passed its build and remains the only target for tomorrow's team review. Production and its Supabase database remain unchanged.

### Confirmed guest-facing candidate
- Driver selection and drawn initials collected on the same screen for new orientations; previously started sessions may follow the old path.
- Saved group sessions display **Resume**, not **Resume Together**.
- Restored official Vimeo SDK tracking after the postMessage regression. Staging uses a 10% viewing threshold; production must require the full video.
- The optional Belt & Tire interest question appears after the knowledge check, does not charge guests or affect qualification, and does not display group driver names.
- The in-person exit link says: **Prefer to complete orientation with a member of our team? Close This Window.**
- Completion treatment distinguishes qualified status (subtle green), driver records (blue-gray), and Epic's confidence commitment (warm neutral/orange).

### Hard release gates (reviewer's approval is not deployment authorization)
1. **Review the full code diff and scope.** This feature branch currently contains far more than EXC UI and must not be blindly merged wholesale into `main`. Check whether to stage a smaller, reviewed release PR that includes only required EXC functionality, dependencies, and migrations.
2. **Enforce production video completion.** The 10% testing shortcut is currently tied to the isolated staging Supabase URL and `EPIC_STAGING_NO_OUTBOUND`; verify the production build uses 98% tracked viewing plus video-end evidence, and server rules agree. Confirm no staging credentials, mock records, testing shortcuts, or test-only routes become available to live guests.
3. **Complete a real team end-to-end walkthrough** with a fresh staged reservation: signed waiver driver(s) -> names + drawn initials -> video and saved playback -> knowledge check and critical/noncritical retry paths -> optional Belt & Tire response -> completed guest readiness -> staff Readiness and Arrival Board. Confirm in-person bail-out and resume. A READY build alone is not this verification.
4. **Review pre-video initials semantics** added October 28: the `exp_participants` endpoint records drawn initials before video is watched. Confirm the backend does not interpret these as watched-video credit or qualification before server-verified playback and assessment. Confirm legacy sessions resume correctly.
5. **Verify database migration and config parity** against live production before any changes; establish backup and rollback points. Production migrations, flag changes, sends and deployment each require explicit owner authorization.
6. **Check all reviewer-facing post-tour/rental messaging** is still gated correctly; EXC must not unintentionally activate new reminder templates or outbound integration behavior.
7. After team approval, prepare exact release commit and target/rollback plan and obtain separate **explicit go-live authorization** before merging, migrating, or deploying.

---

# Epic Xpress Checkout — production approval checklist

PR #107 targets main. Production deployment and merge require Jennifer's approval.

## Scope and operational standards

Guest language and styling are approved. Qualification is reservation-wide; one operator orientation per driver covers the booking's rental items. All driver/passenger agreements, applicable signed guardian acknowledgment and child details, Polaris observations and accepted OHV uploads remain required. OHV follows the existing accepted-upload standard; there is no new manual approval step.

Final staging reservation: EXC-FINAL-20261028, two drivers, one adult passenger and one minor. This uses real staging submissions, private stored files, video checkpoints and assessment outcomes. Polaris observations are explicitly seeded in isolated staging; no live integrations or guests are contacted.

## Deploy after approval

1. Record the current production deployment and flags for rollback. Take the normal database backup/snapshot. Keep EXC flags off during migration.
2. Apply `20261026_exp_foundation.sql` (sessions, participants, audit records, indexes and RLS) and `20261027_guest_portal_moab_agreement_link.sql` (Moab time comparison). Also apply `20261028_exp_belt_tire_inquiry.sql` for optional, service-only per-driver information preferences. It has no charge or eligibility effects. Also apply `20261028_exp_driver_sessions.sql` for the service-only, atomic session-start function. It adds no guest-progress columns and preserves existing sessions. The existing guardian/child columns already exist in production; this fix needs no additional guardian schema migration.
3. At the approved launch time, configure the new production build with `EXP_ASSESSMENT_SERVER_ENABLED=true` and `NEXT_PUBLIC_EXP_VIDEO_PREVIEW=true`, then deploy the reviewed PR. Vercel environment changes require a new deployment, and the public flag is compiled into the client bundle. Keep the current production deployment in place until that approved deployment is ready. Use the existing production service configuration. Never copy staging fixtures, staging credentials, disabled-trigger state, or `EPIC_STAGING_NO_OUTBOUND` into production.
4. Confirm the actual guest portal hostname is approved for Vimeo video 1239550688. Technical EXP names remain for compatibility.
5. If launching the rental reminder at the same time, publish the separately approved rental template and set `RESEND_RENTAL_REMINDER_TEMPLATE_ID` to its ID. Rental-only routing must preserve the existing tours/mixed-booking path. Do not send a test to a real guest without authorization. The existing C360 sent-record mirror remains in place; exact rendered-body archival is a separate existing limitation, not a new EXC approval workflow.
6. Smoke-check an authorized test booking: guest/staff/Arrival Board agreement; incomplete requirements block qualification; completed drivers remain listed; full qualification and confidence box require all checks; in-person orientation stays available; kiosk and saved progress work. Check runtime errors and the existing communication history.

## Roll back

1. Turn both EXC flags off and restore the previously recorded production deployment. Disable rental-template selection if it was activated.
2. Keep additive EXP tables and records in place; do not drop guest progress, signatures, uploaded files or audit evidence.
3. Recheck ordinary guest forms, OHV uploads, staff Readiness, Arrival Board, kiosk and existing reminders. Retain the previously working view definition in the release snapshot if the time-comparison change needs reversal.

## Preview isolation

Main-project production credentials are excluded from its Preview environment. The EXC feature branch is disabled for automatic Git deployments; isolated staging is deployed explicitly. A main-project Preview runtime guard rejects EXC branch traffic before operational APIs. No deployment history is deleted and no account authentication settings change. Production values, domains and deployment remain unchanged until approval.
