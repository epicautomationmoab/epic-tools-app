-- Epic UUI Development only. Save v6 and recalculation require active named employees.
-- Reviewed v6 -> v5 -> v4 -> v3 and table triggers: internal draft/lead writes only.
REVOKE EXECUTE ON FUNCTION public.save_epic_sales_quote_v6(uuid,text,text,text,date,date,jsonb), public.recalculate_epic_sales_quote_financials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_epic_sales_quote_v6(uuid,text,text,text,date,date,jsonb), public.recalculate_epic_sales_quote_financials(uuid) TO authenticated;
-- Legacy unguarded readers are accessed only by the employee-authenticated server API.
REVOKE EXECUTE ON FUNCTION public.get_recent_epic_sales_quotes(integer), public.get_epic_sales_quote_detail(uuid) FROM PUBLIC, anon, authenticated;
