-- STAGING / REVIEW ONLY. Do not apply to production without full caller inventory.
-- All nine views below were confirmed to grant effective anon SELECT on 2026-10-24.
-- None of the nine reported security_invoker=true at inspection time.
BEGIN;
REVOKE SELECT ON TABLE public.dashboard_guest_readiness_sot FROM anon;
REVOKE SELECT ON TABLE public.guest_arrival_board_v FROM anon;
REVOKE SELECT ON TABLE public.guest_arrival_board_with_handoff_v FROM anon;
REVOKE SELECT ON TABLE public.guest_readiness_app_v FROM anon;
REVOKE SELECT ON TABLE public.guest_readiness_dashboard_scan_document_links_v3 FROM anon;
REVOKE SELECT ON TABLE public.guest_readiness_dashboard_scan_document_links_v4 FROM anon;
REVOKE SELECT ON TABLE public.guest_readiness_fast_v FROM anon;
REVOKE SELECT ON TABLE public.guest_readiness_with_handoff_v FROM anon;
REVOKE SELECT ON TABLE public.scout_mpwr_waiver_work_v FROM anon;
COMMIT;
-- Important:
-- guest-facing Arrival Board now uses server-side credentials on the branch.
-- Its public route passes only explicitly allowlisted display fields to the browser.
-- Confirm other repositories, integrations, Scout agent, waivers and kiosks before REVOKE.
-- Repeat has_table_privilege('anon',oid,'SELECT') across all views after staging apply.
-- Do not treat an anonymous view permission as an exploitable data leak without
-- testing effective row filtering, but do treat broad guest PII access as high risk.
