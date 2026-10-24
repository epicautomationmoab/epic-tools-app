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

-- Dependency update (2026-10-24 security branch): Arrival Board now reads
-- guest_readiness_with_handoff_v with server-side secret via fetchView(..., true).
-- /team/arrival-board is intentionally public for the lobby and exempted from
-- employee-only middleware. Review board DISPLAY FIELDS separately so the
-- server-side access doesn't accidentally expose hidden customer information.
-- Also inspect external callers before applying any SQL revoke.
