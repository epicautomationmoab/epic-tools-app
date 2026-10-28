-- guest_readiness_operational is Moab wall time; store visits use timestamptz.
-- Preserve the existing view's columns, grants and owner; fix only the time comparison.
do $migration$
declare definition text;
begin
 definition:=pg_get_viewdef('public.guest_portal_v'::regclass,true);
 if position('ps.visit_start_time IS DISTINCT FROM r.visit_start_time' in definition)>0 then
  definition:=replace(definition,'ps.visit_start_time IS DISTINCT FROM r.visit_start_time','ps.visit_start_time IS DISTINCT FROM (r.visit_start_time AT TIME ZONE ''America/Denver'')');
  execute 'create or replace view public.guest_portal_v as '||definition;
 elsif position('America/Denver' in definition)=0 then
  raise exception 'Unexpected guest_portal_v time comparison; review before migration';
 end if;
end $migration$;
