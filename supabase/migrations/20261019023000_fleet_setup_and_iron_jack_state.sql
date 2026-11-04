alter table public.fleet_vehicles
  add column if not exists booking_resource_id text,
  add column if not exists booking_resource_name text,
  add column if not exists booking_inventory_state text not null default 'available'
    check (booking_inventory_state in ('available','soft_blackout','hard_blackout','out_for_service')),
  add column if not exists booking_inventory_reason text,
  add column if not exists booking_sync_status text not null default 'not_linked'
    check (booking_sync_status in ('not_linked','pending','synced','error')),
  add column if not exists booking_sync_error text,
  add column if not exists booking_synced_at timestamptz,
  add column if not exists on_ride boolean not null default false,
  add column if not exists on_ride_trip_order_id text,
  add column if not exists on_ride_started_at timestamptz;

create index if not exists fleet_vehicles_booking_resource_idx
  on public.fleet_vehicles (booking_resource_id)
  where booking_resource_id is not null;

create or replace view public.fleet_maintenance_dashboard_v2 as
select
  fv.*,
  (
    fv.vin is null
    or btrim(coalesce(fv.vin,'')) = ''
    or fv.mpwr_vehicle_reference is null
    or btrim(coalesce(fv.mpwr_vehicle_reference,'')) = ''
    or fv.booking_resource_id is null
    or btrim(coalesce(fv.booking_resource_id,'')) = ''
    or fv.current_mileage is null
    or fv.current_engine_hours is null
    or fv.in_service_date is null
  ) as setup_needed,
  case
    when fv.current_mileage is null then null
    when fv.last_service_mileage is null then fv.service_interval_miles - fv.current_mileage
    else fv.service_interval_miles - (fv.current_mileage - fv.last_service_mileage)
  end as miles_until_service,
  case
    when fv.current_mileage is null then 'setup_needed'
    when fv.last_service_mileage is null and fv.current_mileage >= fv.service_interval_miles then 'due'
    when fv.last_service_mileage is null and fv.current_mileage >= fv.service_interval_miles - 200 then 'upcoming'
    when fv.last_service_mileage is null then 'not_due'
    when fv.current_mileage - fv.last_service_mileage >= fv.service_interval_miles then 'due'
    when fv.current_mileage - fv.last_service_mileage >= fv.service_interval_miles - 200 then 'upcoming'
    else 'not_due'
  end as service_status,
  case
    when fv.last_weekly_inspection_at is null then 'due'
    when fv.last_weekly_inspection_at + interval '7 days' < now() then 'overdue'
    when fv.last_weekly_inspection_at + interval '6 days' < now() then 'due_soon'
    else 'current'
  end as inspection_status,
  case
    when fv.last_weekly_inspection_at is null then null
    else fv.last_weekly_inspection_at + interval '7 days'
  end as next_weekly_inspection_due_at
from public.fleet_vehicles fv
where fv.active = true;

grant select on public.fleet_maintenance_dashboard_v2 to service_role;