-- Epic UUI Development only: jgpihdpcdlqugmqanzfj.
BEGIN;
GRANT EXECUTE ON FUNCTION public.get_epic_customer_360(uuid,uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_linked_phones(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_linked_primary_contact(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_podium_sms(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_telnyx_sms(text) TO authenticated;
COMMIT;