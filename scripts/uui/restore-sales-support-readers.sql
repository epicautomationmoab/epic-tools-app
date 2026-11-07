-- Epic UUI Development only: jgpihdpcdlqugmqanzfj.
BEGIN;
GRANT EXECUTE ON FUNCTION public.c360_callrail_sms_numbers(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_employee_call_origins(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_inbound_caller_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.epic_followup_dismissed_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.epic_followup_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.epic_followup_list(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.epic_followup_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_c360_linked_social_messages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_c360_readiness_docs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_cancellation_timeline(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_inbound_call_sessions_for_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_inbox_thread_notes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_outbound_calls_for_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_sales_activity() TO authenticated;
COMMIT;

