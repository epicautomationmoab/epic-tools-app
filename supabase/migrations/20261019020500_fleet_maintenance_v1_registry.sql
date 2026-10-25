create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_number integer not null unique check (vehicle_number between 1 and 999),
  model_family text not null,
  model_year integer not null default 2027,
  vin text unique,
  mpwr_vehicle_reference text,
  current_mileage integer check (current_mileage is null or current_mileage >= 0),
  current_engine_hours numeric(10,1) check (current_engine_hours is null or current_engine_hours >= 0),
  last_service_mileage integer check (last_service_mileage is null or last_service_mileage >= 0),
  last_service_at timestamptz,
  service_interval_miles integer not null default 1000 check (service_interval_miles > 0),
  last_weekly_inspection_at timestamptz,
  operational_status text not null default 'setup_needed'
    check (operational_status in ('setup_needed','available','in_service','repair','waiting_for_parts','out_of_service')),
  status_reason text,
  in_service_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_vehicles_status_idx
  on public.fleet_vehicles (operational_status, vehicle_number);
create index if not exists fleet_vehicles_model_idx
  on public.fleet_vehicles (model_family, vehicle_number);

alter table public.fleet_vehicles enable row level security;
grant select, insert, update, delete on public.fleet_vehicles to service_role;

insert into public.fleet_vehicles (vehicle_number, model_family, model_year)
select n,
  case
    when n between 1 and 6 then 'Pro R Boost'
    when n between 7 and 18 then 'Xpedition'
    when n between 19 and 35 then 'XP S'
    when n between 36 and 52 then 'XP S4'
    when n between 53 and 62 then 'Pro S'
    when n between 63 and 72 then 'Pro S4'
  end,
  2027
from generate_series(1,72) as n
on conflict (vehicle_number) do update
set model_family = excluded.model_family,
    model_year = excluded.model_year,
    updated_at = now();

create or replace view public.fleet_maintenance_dashboard_v as
select
  fv.*,
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

grant select on public.fleet_maintenance_dashboard_v to service_role;
