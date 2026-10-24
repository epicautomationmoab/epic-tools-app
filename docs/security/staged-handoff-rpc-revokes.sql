-- REVIEW ONLY. NOT APPLIED TO PRODUCTION.
-- Requires successful staging regression tests and approval.
-- Both operational handoff actions have migrated frontend callers to
-- /api/team/readiness/handoff with verified employee-session attribution.
-- IMPORTANT: confirm no remaining direct API / third-party callers before execution.

BEGIN;
REVOKE EXECUTE ON FUNCTION public.set_epic_operational_handoff(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_epic_operational_handoff(uuid,text) FROM PUBLIC, anon, authenticated;
-- The server-side privileged Supabase credential retains access through its
-- elevated role; explicitly confirm role behavior on the staging project.
COMMIT;

-- Verification after applying (both results should be false):
-- SELECT has_function_privilege('anon','public.set_epic_operational_handoff(uuid,text,text)','EXECUTE');
-- SELECT has_function_privilege('authenticated','public.clear_epic_operational_handoff(uuid,text)','EXECUTE');

-- ROLLBACK ONLY IF TESTS FAIL, restore separately after root-cause review:
-- GRANT EXECUTE ON FUNCTION public.set_epic_operational_handoff(uuid,text,text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.clear_epic_operational_handoff(uuid,text) TO PUBLIC;
-- Never execute rollback merely to silence an app failure; investigate.
