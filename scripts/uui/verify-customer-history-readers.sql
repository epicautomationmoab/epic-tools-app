BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','64eb0331-d16a-4ab8-81a1-7aaefe578944',true);
DO $test$
DECLARE result jsonb;
BEGIN
result:=public.get_epic_customer_360(null,null,null,'2025550102',null);
if not (result ?& array['identity','reservations','calls','texts','emails','notes','quotes','opportunities','drafts']) then raise exception 'Missing customer history sections'; end if;
perform public.c360_linked_phones('2025550102');
perform public.c360_linked_primary_contact('2025550102');
perform public.c360_podium_sms('2025550102');
perform public.c360_telnyx_sms('2025550102');
perform set_config('request.jwt.claim.sub','f24dc053-b9fe-4c8c-864b-4705f2fd940b',true);
if cardinality(public.c360_linked_phones('2025550102'))<>0 then raise exception 'Workstation read linked phones'; end if;
if public.c360_linked_primary_contact('2025550102') is not null then raise exception 'Workstation read primary contact'; end if;
begin
 perform public.get_epic_customer_360(null,null,null,'2025550102',null);
 raise exception 'Workstation read history';
exception when others then if SQLERRM<>'Active Epic employee profile required' then raise; end if; end;
begin
 perform public.c360_podium_sms('2025550102');
 raise exception 'Workstation read Podium';
exception when insufficient_privilege then null; end;
begin
 perform public.c360_telnyx_sms('2025550102');
 raise exception 'Workstation read Telnyx';
exception when others then if SQLERRM<>'Unauthorized' then raise; end if; end;
END $test$;
ROLLBACK;
SELECT bool_and(not has_function_privilege('anon',oid,'EXECUTE')) as anonymous_denied
FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('get_epic_customer_360','c360_linked_phones','c360_linked_primary_contact','c360_podium_sms','c360_telnyx_sms');