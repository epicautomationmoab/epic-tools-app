-- Staging prerequisite for restricting all nine current anonymous view grants.
-- Validate every external consumer before running.
BEGIN;
GRANT SELECT ON TABLE public.guest_arrival_board_v TO service_role;
GRANT SELECT ON TABLE public.guest_arrival_board_with_handoff_v TO service_role;
GRANT SELECT ON TABLE public.guest_readiness_dashboard_scan_document_links_v3 TO service_role;
GRANT SELECT ON TABLE public.guest_readiness_dashboard_scan_document_links_v4 TO service_role;
COMMIT;
-- Do not revoke anon yet: deployment and caller testing must come first.
-- Recheck has_table_privilege('service_role',oid,'SELECT') for all nine views.
