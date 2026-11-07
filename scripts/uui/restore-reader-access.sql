-- UUI development ONLY: restore access to existing employee-authorized readers.
-- Target project: jgpihdpcdlqugmqanzfj. No table grants, anonymous grants, or function body changes.
BEGIN;
GRANT EXECUTE ON FUNCTION public.get_epic_routed_inbox_v2(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_sales_blocked_domains() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_phone_report(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_inbox_collaborators() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_inbox_mentions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_c360_podium_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_c360_telnyx_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_c360_social_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_c360_meta_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_c360_instagram_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.epic_catchup_attributed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.epic_ping_inbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epic_known_customer_matches(text[],text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c360_employee_search_phone_links(text[]) TO authenticated;
COMMIT;
