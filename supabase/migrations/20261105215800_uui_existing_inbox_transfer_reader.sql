-- Existing reader checks active non-workstation employee identity.
GRANT EXECUTE ON FUNCTION public.get_epic_inbox_thread_transfers(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_epic_inbox_thread_transfers(text) FROM anon, PUBLIC;
