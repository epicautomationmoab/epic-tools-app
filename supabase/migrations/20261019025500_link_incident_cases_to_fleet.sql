alter table public.operational_cases
  add column if not exists fleet_vehicle_id uuid references public.fleet_vehicles(id) on delete set null;

update public.operational_cases oc
set fleet_vehicle_id = fv.id
from public.fleet_vehicles fv
where oc.fleet_vehicle_id is null
  and oc.vehicle_number is not null
  and btrim(oc.vehicle_number) ~ '^[0-9]+$'
  and fv.vehicle_number = btrim(oc.vehicle_number)::integer;

create index if not exists operational_cases_fleet_vehicle_idx
  on public.operational_cases (fleet_vehicle_id, opened_at desc)
  where fleet_vehicle_id is not null;