create or replace function public.enqueue_post_visit_email_after_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.handoff_status not in ('rental_returned','tour_returned') then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.handoff_status is not distinct from new.handoff_status then
    return new;
  end if;

  perform public.schedule_post_visit_email(
    new.readiness_id,
    new.handoff_status,
    coalesce(new.recorded_at, now())
  );

  return new;
end;
$$;

drop trigger if exists enqueue_post_visit_email_after_return on public.epic_operational_handoffs;
create trigger enqueue_post_visit_email_after_return
after insert or update of handoff_status on public.epic_operational_handoffs
for each row
execute function public.enqueue_post_visit_email_after_return();

create or replace function public.mark_tour_returned_if_all_checkins_released(
  p_store_visit_id text,
  p_recorded_by text default 'Tour Dispatch'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_released integer;
  v_readiness_id uuid;
  v_confirmation_code text;
  v_visit_start_time timestamp without time zone;
begin
  select
    count(*),
    count(*) filter (where checkin_status in ('checkin_queued','completed','checked_in')),
    max(readiness_id),
    max(confirmation_code)
  into v_total, v_released, v_readiness_id, v_confirmation_code
  from public.tour_vehicle_dispatches
  where store_visit_id = p_store_visit_id;

  if coalesce(v_total, 0) = 0 or v_released <> v_total or v_readiness_id is null then
    return false;
  end if;

  select visit_start_time
  into v_visit_start_time
  from public.guest_readiness_operational
  where readiness_id = v_readiness_id;

  if v_visit_start_time is null then
    return false;
  end if;

  insert into public.epic_operational_handoffs (
    readiness_id,
    confirmation_code,
    visit_start_time,
    business_line,
    handoff_status,
    recorded_at,
    recorded_by,
    source,
    updated_at
  ) values (
    v_readiness_id,
    v_confirmation_code,
    v_visit_start_time,
    'tour',
    'tour_returned',
    now(),
    p_recorded_by,
    'tour_dispatch',
    now()
  )
  on conflict (readiness_id)
  do update set
    handoff_status = case
      when public.epic_operational_handoffs.handoff_status = 'tour_returned'
        then public.epic_operational_handoffs.handoff_status
      else 'tour_returned'
    end,
    recorded_at = case
      when public.epic_operational_handoffs.handoff_status = 'tour_returned'
        then public.epic_operational_handoffs.recorded_at
      else now()
    end,
    recorded_by = case
      when public.epic_operational_handoffs.handoff_status = 'tour_returned'
        then public.epic_operational_handoffs.recorded_by
      else excluded.recorded_by
    end,
    source = case
      when public.epic_operational_handoffs.handoff_status = 'tour_returned'
        then public.epic_operational_handoffs.source
      else excluded.source
    end,
    updated_at = now();

  return true;
end;
$$;
