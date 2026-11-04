BEGIN;
DO $test$
DECLARE a uuid; b uuid; r jsonb;
BEGIN
perform set_config('request.jwt.claim.sub','64eb0331-d16a-4ab8-81a1-7aaefe578944',true);
r:=public.epic_ping_action('send','a5b67859-e7c5-4f27-b78c-e9e48df4f59b','UUI transaction-only verification'); a:=(r->>'id')::uuid;
if a is null then raise exception 'send failed'; end if;
r:=public.epic_ping_action('send','a5b67859-e7c5-4f27-b78c-e9e48df4f59b','UUI dismiss verification'); b:=(r->>'id')::uuid;
perform set_config('request.jwt.claim.sub','0d0fa277-0c03-43db-b5dc-c81a78452a6c',true);
r:=public.epic_ping_action('acknowledged',null,null,a);
if (r->>'updated')::int <> 0 then raise exception 'unrelated employee acknowledged'; end if;
r:=public.epic_ping_action('delete',null,null,a);
if (r->>'deleted')::int <> 0 then raise exception 'unrelated employee deleted'; end if;
perform set_config('request.jwt.claim.sub','a5b67859-e7c5-4f27-b78c-e9e48df4f59b',true);
r:=public.epic_ping_action('acknowledged',null,null,a);
if (r->>'updated')::int <> 1 then raise exception 'recipient acknowledge failed'; end if;
r:=public.epic_ping_action('dismissed',null,null,b);
if (r->>'updated')::int <> 1 then raise exception 'recipient dismiss failed'; end if;
r:=public.epic_ping_action('dismissed',null,null,a);
if (r->>'updated')::int <> 0 then raise exception 'existing response overwritten'; end if;
perform set_config('request.jwt.claim.sub','f24dc053-b9fe-4c8c-864b-4705f2fd940b',true);
begin
 perform public.epic_ping_action('send','a5b67859-e7c5-4f27-b78c-e9e48df4f59b','must reject');
 raise exception 'workstation accepted';
exception when others then
 if SQLERRM <> 'Active employee required' then raise; end if;
end;
END $test$;
ROLLBACK;
SELECT '8 assertions passed; test messages rolled back' as verification;
