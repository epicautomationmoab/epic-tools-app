-- Existing functions derive active employee identity from auth.uid().
-- Restore internal notes/routing/close only; no table grants or outbound triggers.
GRANT EXECUTE ON FUNCTION public.epic_sales_add_inbox_thread_note(text,text), public.epic_route_inbox_thread(text,text,text), public.epic_sales_clean_inbox_thread(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.epic_sales_add_inbox_thread_note(text,text), public.epic_route_inbox_thread(text,text,text), public.epic_sales_clean_inbox_thread(text) FROM anon, PUBLIC;
