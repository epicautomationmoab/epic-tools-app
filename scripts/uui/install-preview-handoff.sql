-- UUI DEVELOPMENT ONLY (jgpihdpcdlqugmqanzfj). Never include in production migrations.
-- Calls the original business transaction; contains its jobs before commit.
create or replace function public.uui_preview_set_handoff(p_readiness_id uuid,p_handoff_status text,p_recorded_by text)
returns public.epic_operational_handoffs
language plpgsql security invoker set search_path = '' as $$
declare result public.epic_operational_handoffs;
begin
  if p_readiness_id is null or p_readiness_id not in (
    '00000000-0000-4000-8000-000000000312'::uuid,
    '00000000-0000-4000-8000-000000000313'::uuid
  ) or p_handoff_status is null or p_handoff_status not in ('rental_out','rental_returned') then
    raise exception 'Preview handoff requires a designated synthetic rental.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_readiness_id::text,0));
  if not exists (select 1 from public.guest_readiness_operational
    where readiness_id=p_readiness_id and confirmation_code='PREVIEW-HISTORY-312'
    and customer_email like '%@example.invalid' and business_line='rental') then
    raise exception 'Synthetic reservation identity check failed.';
  end if;
  -- These reviewed fixtures have already-released synthetic deposits and no Scout work.
  -- Reject any changed fixture state rather than making financial/worker changes.
  if not exists (select 1 from public.rental_damage_deposits
    where readiness_id=p_readiness_id and status='released')
    or exists (select 1 from public.scout_mpwr_queue where confirmation_code='PREVIEW-HISTORY-312')
    or exists (select 1 from public.cassie_mpwr_jobs where readiness_id=p_readiness_id and status='claimed')
    or exists (select 1 from public.post_visit_email_jobs where readiness_id=p_readiness_id and status in ('processing','sent')) then
    raise exception 'Preview fixture has unexpected operational work.';
  end if;
  result := public.set_epic_operational_handoff(p_readiness_id,p_handoff_status,p_recorded_by);
  -- Jobs are never visible outside this transaction in a runnable state.
  update public.cassie_mpwr_jobs set status='needs_review'
    where readiness_id=p_readiness_id and status='queued';
  update public.post_visit_email_jobs set status='cancelled',last_error='UUI synthetic test: delivery suppressed'
    where readiness_id=p_readiness_id and status in ('pending','failed');
  if exists (select 1 from public.scout_mpwr_queue where confirmation_code='PREVIEW-HISTORY-312')
    or exists (select 1 from public.rental_damage_deposits where readiness_id=p_readiness_id and status<>'released') then
    raise exception 'Preview handoff produced unexpected operational work.';
  end if;
  return result;
end;
$$;
revoke all on function public.uui_preview_set_handoff(uuid,text,text) from public,anon,authenticated;
grant execute on function public.uui_preview_set_handoff(uuid,text,text) to service_role;
