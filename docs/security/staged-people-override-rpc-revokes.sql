-- REVIEW ONLY; apply after staging regression tests and server-route deployment.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.get_readiness_people_override(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_readiness_people_override(uuid,integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_readiness_people_override(uuid) FROM PUBLIC, anon, authenticated;
COMMIT;
-- Verify effective anon EXECUTE is false for all three.
-- Test GET/SET/CLEAR via the employee-only API, and direct anonymous denial.
