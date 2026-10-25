-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION without tests of the new authenticated routes.
-- These four currently have effective anon EXECUTE privileges in Epic Tools.
-- Application callers migrated to server-side employee authenticated endpoints.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.set_readiness_no_show(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_readiness_no_show(uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.set_readiness_adventure_assure_override(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.update_guest_contact_override(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;
-- After staging, test authenticated team interface (both no-show directions,
-- both Adventure Assure options, email and phone edits) and anonymous denials.
-- Roll back individual grants only after investigating a failing dependency.
