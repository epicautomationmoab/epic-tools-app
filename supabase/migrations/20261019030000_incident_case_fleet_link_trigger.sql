create or replace function public.set_operational_case_fleet_vehicle()
returns trigger
language plpgsql
as $$
begin
  if new.vehicle_number is not null and btrim(new.vehicle_number) ~ '^[0-9]+$' then
    select id into new.fleet_vehicle_id
    from public.fleet_vehicles
    where vehicle_number = btrim(new.vehicle_number)::integer
    limit 1;
  elsif new.vehicle_number is null then
    new.fleet_vehicle_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists operational_cases_set_fleet_vehicle on public.operational_cases;
create trigger operational_cases_set_fleet_vehicle
before insert or update of vehicle_number
on public.operational_cases
for each row
execute function public.set_operational_case_fleet_vehicle();