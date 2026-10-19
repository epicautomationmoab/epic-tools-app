create table if not exists public.fleet_inventory_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  vehicle_number integer not null,
  previous_state text,
  new_state text not null,
  reason text,
  changed_by_profile_id uuid references public.team_profiles(id) on delete set null,
  changed_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists fleet_inventory_events_vehicle_idx
  on public.fleet_inventory_events (vehicle_number, created_at desc);

alter table public.fleet_inventory_events enable row level security;
grant select, insert on public.fleet_inventory_events to service_role;

create or replace view public.iron_jack_vehicle_inventory_v as
select
  id as fleet_vehicle_id,
  vehicle_number,
  model_family,
  model_year,
  booking_inventory_state as inventory_state,
  booking_inventory_reason as inventory_reason,
  on_ride,
  on_ride_trip_order_id,
  on_ride_started_at,
  operational_status,
  active,
  updated_at
from public.fleet_vehicles
where active = true;

grant select on public.iron_jack_vehicle_inventory_v to service_role;