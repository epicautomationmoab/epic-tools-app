create table if not exists public.tour_manifest_guides (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  experience_key text not null,
  visit_start_time timestamp without time zone not null,
  guide_name text not null default '',
  updated_by_profile_id uuid null,
  updated_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_date, experience_key, visit_start_time)
);

create or replace function public.set_tour_manifest_guide(
  p_visit_date date,
  p_experience_key text,
  p_visit_start_time timestamp without time zone,
  p_guide_name text,
  p_updated_by_profile_id uuid default null,
  p_updated_by_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(p_guide_name, '')), '') is null then
    delete from public.tour_manifest_guides
    where visit_date = p_visit_date
      and experience_key = p_experience_key
      and visit_start_time = p_visit_start_time;
    return;
  end if;

  insert into public.tour_manifest_guides (
    visit_date,
    experience_key,
    visit_start_time,
    guide_name,
    updated_by_profile_id,
    updated_by_name,
    updated_at
  ) values (
    p_visit_date,
    p_experience_key,
    p_visit_start_time,
    btrim(p_guide_name),
    p_updated_by_profile_id,
    p_updated_by_name,
    now()
  )
  on conflict (visit_date, experience_key, visit_start_time)
  do update set
    guide_name = excluded.guide_name,
    updated_by_profile_id = excluded.updated_by_profile_id,
    updated_by_name = excluded.updated_by_name,
    updated_at = now();
end;
$$;

create or replace view public.tour_vehicle_dispatch_roster_v as
select
  sv.store_visit_id,
  gro.readiness_id,
  sv.confirmation_code,
  sv.customer_name,
  sv.product_display_name,
  coalesce(gro.visit_start_time, (sv.visit_start_time at time zone 'UTC'::text)) as visit_start_time,
  coalesce(gro.visit_start_time, (sv.visit_start_time at time zone 'UTC'::text))::date as visit_date,
  sv.business_line,
  sv.requires_mpwr,
  coalesce(gro.mpwr_confirmation_number, sv.mpwr_confirmation_number) as mpwr_confirmation_number,
  greatest(coalesce(sv.total_vehicle_count, 1), 1) as total_vehicle_count,
  slot.vehicle_slot,
  d.id as dispatch_id,
  d.vehicle_label,
  d.vehicle_number,
  d.checkout_mileage,
  d.checkout_engine_hours,
  coalesce(d.checkout_status, 'unassigned'::text) as checkout_status,
  d.checkout_requested_at,
  d.checkout_completed_at,
  d.checkin_mileage,
  d.checkin_engine_hours,
  coalesce(d.checkin_status, 'not_ready'::text) as checkin_status,
  d.checkin_requested_at,
  d.checkin_completed_at,
  d.assigned_by_name,
  d.assigned_at,
  d.last_error,
  d.updated_at,
  d.mpwr_vehicle_number_observed,
  d.mpwr_driver_observation,
  d.mpwr_checkout_notes,
  d.manual_mpwr_checkout_confirmed_at,
  d.manual_mpwr_checkout_confirmed_by,
  d.mpwr_driver_unexpected_names,
  sv.source_experience_ids
from public.portal_patti_store_visits sv
left join public.guest_readiness_operational gro
  on gro.source_store_visit_id = sv.store_visit_id
 and gro.live_dashboard_visible = true
cross join lateral generate_series(1, greatest(coalesce(sv.total_vehicle_count, 1), 1)) slot(vehicle_slot)
left join public.tour_vehicle_dispatches d
  on d.store_visit_id = sv.store_visit_id
 and d.vehicle_slot = slot.vehicle_slot
where sv.business_line = 'tour'::text
  and sv.requires_mpwr = true
  and sv.live_dashboard_visible = true
  and sv.visit_status = 'active'::text;
