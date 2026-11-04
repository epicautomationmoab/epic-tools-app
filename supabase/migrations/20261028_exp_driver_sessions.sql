-- Atomic booking-scoped session selection; service-side authorization precedes this RPC.
create or replace function public.start_exp_driver_session(
 p_booking_key text,p_readiness_ids uuid[],p_readiness_id uuid,p_driver_names text[],p_assessment_version text
) returns setof public.exp_sessions language plpgsql security invoker set search_path=public as $$
declare chosen text[]; s public.exp_sessions; roster text[];
begin
 if not(p_readiness_id=any(p_readiness_ids)) or cardinality(p_driver_names) not between 1 and 20 then raise exception 'Invalid driver selection'; end if;
 select array_agg(n order by n) into chosen from (select distinct lower(regexp_replace(trim(v),'\s+',' ','g')) n from unnest(p_driver_names) v) x;
 if cardinality(chosen)<>cardinality(p_driver_names) or exists(select 1 from unnest(chosen) n where length(n)<3) then raise exception 'Invalid driver selection'; end if;
 perform pg_advisory_xact_lock(hashtextextended('exp-booking:'||p_booking_key,0));
 for s in select * from exp_sessions where readiness_id=any(p_readiness_ids::text[]) and assessment_version=p_assessment_version and outcome in ('in_progress','critical_retry') order by created_at desc loop
  select array_agg(distinct n order by n) into roster from (
   select lower(regexp_replace(trim(value),'\s+',' ','g')) n from jsonb_array_elements_text(coalesce(s.result_summary->'selectedDriverNames','[]'::jsonb))
   union select lower(regexp_replace(trim(display_name),'\s+',' ','g')) from exp_participants where session_id=s.id
  ) x;
  if roster && chosen then
   if roster=chosen then return next s; return; end if;
   raise exception 'A selected driver has a saved orientation. Resume the original driver or group session.';
  end if;
 end loop;
 insert into exp_sessions(readiness_id,video_version,assessment_version,mode,outcome,result_summary)
 values(p_readiness_id::text,'3.2',p_assessment_version,case when cardinality(chosen)>1 then 'group' else 'individual' end,'in_progress',jsonb_build_object('selectedDriverNames',to_jsonb(p_driver_names))) returning * into s;
 return next s;
end $$;
revoke all on function public.start_exp_driver_session(text,uuid[],uuid,text[],text) from public,anon,authenticated;
grant execute on function public.start_exp_driver_session(text,uuid[],uuid,text[],text) to service_role;
