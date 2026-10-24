# Supabase access hardening — implementation gate (2026-10-24)

Status: **Security review / no production changes**. Do not merge permission changes without the checks below.

## Verified active paths

- `lib/supabase.ts` fetches `guest_readiness_fast_v` (fast) and `guest_readiness_with_handoff_v` (standard) with `NEXT_PUBLIC_SUPABASE_ANON_KEY` by default.
- `getArrivalBoardRows()` fetches `guest_arrival_board_with_handoff_v` and `guest_readiness_with_handoff_v` using the same default.
- `app/team/readiness/page.tsx` uses the fast Readiness loader.
- `app/team/arrival-board/page.tsx` uses the Arrival Board loader, including customer identifying fields.
- `middleware.ts` tests the **presence** of `epic_access_token`; it does not validate the value there. It also permits preview-token and workstation-cookie access. **Important:** This alone does not prove session authentication is absent elsewhere, but forbids assuming this middleware supplies verified authorization for a privileged read.

## Nine views currently granted SELECT to anon (production inventory)

1. `dashboard_guest_readiness_sot`
2. `guest_arrival_board_v`
3. `guest_arrival_board_with_handoff_v`
4. `guest_readiness_app_v`
5. `guest_readiness_dashboard_scan_document_links_v3`
6. `guest_readiness_dashboard_scan_document_links_v4`
7. `guest_readiness_fast_v`
8. `guest_readiness_with_handoff_v`
9. `scout_mpwr_waiver_work_v`

All lacked `security_invoker` in the read-only inspection. Several include names, contact details, payment amounts and document/booking URLs. Database grants do not alone prove external retrieval; perform negative access tests without dumping guest records.

## Safe implementation sequence

1. **Authentication boundary first**. Inventory login/session handlers, signed/validated tokens, employee authorization, preview/workstation exceptions, and every server render that returns customer data. Establish a verified shared staff authorization guard for sensitive routes and server components. For the public Arrival Board, explicitly document a sanctioned display policy and return only minimal authorized columns.
2. **Server-side query path**. After the authorization guard is in place, migrate internal Readiness and worker queries away from the anonymous role to a *server-only, appropriately scoped* access mechanism. Avoid using `SUPABASE_SECRET_KEY` without a verified guard. Do not send it through `NEXT_PUBLIC_`, client bundles or client components.
3. **Agent dependencies**. Check Scout, guest communications, kiosk, Guest Portal, old Readiness and C360 references, plus live runtime/deploy logs. Classify each view by consumer and whether it requires an RLS-respecting user path or trusted service-only path.
4. **Controlled DB migration**. After successfully testing new app paths in preview, revoke `anon` from internal-only views and validate whether `authenticated` should also be revoked. Prefer `security_invoker=true` only with designed underlying RLS policies. Where appropriate move internal relations out of Data API exposed schemas. Preserve a rollback SQL plan.
5. **Negative + positive tests**. Anonymous and forged/expired/invalid staff cookies must not retrieve guest details; another guest token must not access another reservation; staff with valid sessions must see their permitted records; the public Arrival Board displays only intended minimal data; kiosk, guest portal, Scout, Rhett and Cassie continue working.
6. **Security gates**. Add CI checks for newly exposed public views, definer functions with broad EXECUTE, unsafe client-side secret usage, and RLS/policy changes. Re-run Supabase advisors; don't eliminate legitimate RLS-no-policy findings just to reduce counts.

## Deployment stop conditions

- No anonymous view revocations until the server consumers are migrated and tests pass.
- No switch to privileged keys while `/team` auth is only assumed from cookie presence.
- No public Arrival Board disclosure of more guest information than explicitly approved.
- No structural UUI split or extra app introduced to implement this hardening.

## Verification evidence required before merge

- Production and preview view grant diff, dependency inventory, redacted authorization test logs, app smoke-test results, build/test pass, and a signed-off rollout/rollback plan.

## October 24 direction: no shared workstation identity

Owner decision: HQ shared workstation authentication is being retired; individual staff identity and attribution are required.

Development-branch changes:
- Readiness guard only accepts a validated active employee profile (excluding the workstation role).
- Team middleware no longer treats the HQ workstation cookie as sufficient for route entry.
- The legacy `getGuestFormsActor` function retains its name for importer compatibility but no longer accepts workstation cookie or returns anonymous HQ Reception attribution.

Remaining work before merge: find every issuance/use of the HQ cookie, remove login/configuration flows, check the preview-token bypass, review server routes that access customer data, smoke-test affected forms and sign-in, and coordinate the employee transition. Do not revoke credential or delete workstation profiles until verified.
