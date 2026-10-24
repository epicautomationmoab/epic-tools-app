-- STAGING ONLY. DO NOT RUN IN PRODUCTION before dependency verification.
-- These views include customer email, phone, financial status and operational notes.
-- All are non-security-invoker views and presently expose SELECT to anon.
BEGIN;
REVOKE SELECT ON TABLE public.guest_readiness_app_v FROM anon, authenticated;
REVOKE SELECT ON TABLE public.guest_readiness_fast_v FROM anon, authenticated;
REVOKE SELECT ON TABLE public.guest_readiness_with_handoff_v FROM anon, authenticated;
REVOKE SELECT ON TABLE public.dashboard_guest_readiness_sot FROM anon, authenticated;
COMMIT;
-- IMPORTANT: verify all other applications, especially Arrival Board, before applying.
-- lib/supabase.ts getArrivalBoardRows currently calls guest_readiness_with_handoff_v
-- through anonymous fetchView. Migrate it to least-privilege, authenticated/server-only
-- or an explicitly sanitized public view before applying the above.
-- Confirm anon denial and legitimate Readiness, Arrival Board and guest workflows.
