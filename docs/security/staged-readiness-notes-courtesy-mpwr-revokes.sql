-- REVIEW ONLY; NOT APPLIED to production.
-- Test authenticated UI routes and all guest/agent callers on staging first.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.save_guest_readiness_note(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_courtesy_call(uuid,text,text,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_courtesy_call(uuid,text,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.manual_override_mpwr_information(uuid,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;
-- Verify direct anonymous denial, successful staff legacy-note save/clear,
-- courtesy-call completion (both function overloads), manual MPWR override.
-- Review other client repositories and scheduled jobs before applying.
