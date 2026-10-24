-- REVIEW ONLY; NOT APPLIED TO PRODUCTION.
-- Confirm all production RPC callers and test service-role access before applying.
-- These functions currently grant effective anonymous execution.
-- No direct guest workflow should require deposit management RPCs.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.set_rental_damage_deposit_hold(uuid,boolean,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.launch_victor_release_deposit(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_rental_damage_deposit(uuid) FROM PUBLIC, anon, authenticated;
COMMIT;
-- After staging, verify:
-- select has_function_privilege('anon','public.set_rental_damage_deposit_hold(uuid,boolean,text,text)','EXECUTE');
-- select has_function_privilege('anon','public.launch_victor_release_deposit(uuid,text)','EXECUTE');
-- select has_function_privilege('anon','public.get_rental_damage_deposit(uuid)','EXECUTE');
-- Also test hold, manager hold-release, eligible release, and Victor queue behavior.
-- Rollback if required, after investigation:
-- GRANT EXECUTE ON FUNCTION public.set_rental_damage_deposit_hold(uuid,boolean,text,text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.launch_victor_release_deposit(uuid,text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_rental_damage_deposit(uuid) TO PUBLIC;
