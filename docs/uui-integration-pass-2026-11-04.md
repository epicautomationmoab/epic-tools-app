# UUI integration verification pass

Scope: existing EpicTools Readiness plus existing Sales/C360, shared tools, Admin/Management, EXC copy in isolated UUI Preview. No production or EXC staging mutations.

Completed:
- Fourteen existing Sales support readers restored to authenticated after reviewing employee/ownership checks. 42 SQL role tests passed (owner, team, workstation); anonymous denied on all fourteen. Covers phone history, call origins, cancellation timeline, thread notes, linked social history, Readiness documents, follow-up list/members/history/dismissals, and activity.
- Existing Sales activity function referenced a missing sales_activity_baselines table. Created the two-column dependency, initialized repeat_shopping at migration time, enabled RLS, and denied direct employee/anonymous access. Security advisor's no-policy notice for this table is intentional deny-all; existing authorized function reads it as definer.
- Existing open-lead function now rejects workstation profiles before reading. Employee result validated; workstation and anonymous denied. No other query behavior changed.
- Existing shared incoming-call POST allowed only in verified UUI development/preview, on exact root and Sales alias paths. Handler tests verify authentication, actor ownership, upper timestamp cutoff, single/all dismissal and invalid-input handling with mocked transport. No actual guest calls/messages sent.
- 25 isolation-boundary checks, 10 workspace authorization checks (mocked profile lookup), and Next production build passed.
- Audit restriction copy corrected to Jennifer and Joe; existing exact-profile authorization unchanged.

Remaining acceptance gaps:
- Signed-in deployed browser journey is not yet verified; cloud browser remains at login. User's separate Chrome session is not shared.
- Mixed read/write customer contact manager, missed-call queue materializer, note/lead/follow-up mutations still require full integration checks. Read-only checks do not prove save workflows.
- External communications remain blocked in Preview. Maintenance Slack/SMS and Axel In code were preserved, not live-send tested.
- Audit reader is still a recent-history pilot of two sources; complete cross-system audit coverage is not implemented.
- Existing Readiness/EXC full browser workflow and Admin/Reports acceptance remain outstanding. No production release approval requested.
