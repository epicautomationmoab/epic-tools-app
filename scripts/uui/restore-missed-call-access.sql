-- Epic UUI Development only (jgpihdpcdlqugmqanzfj).
-- Existing function and customer_work_items trigger reviewed: only internal queue writes.
-- Active named employee guard remains; no anonymous or direct table grants.
REVOKE EXECUTE ON FUNCTION public.get_epic_sales_missed_calls() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_epic_sales_missed_calls() TO authenticated;
