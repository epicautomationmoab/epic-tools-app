create or replace function public.sync_readiness_belt_tire_for_store_visit(p_store_visit_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_protection boolean;
begin
  if nullif(trim(p_store_visit_id), '') is null then
    return;
  end if;

  select exists (
    select 1
    from public.portal_patti_store_visit_sources s
    cross join lateral jsonb_array_elements(coalesce(s.source_json->'bookings','[]'::jsonb)) b
    cross join lateral jsonb_array_elements(coalesce(b->'booking_products', b->'bookingProducts', '[]'::jsonb)) prod
    where s.store_visit_id = p_store_visit_id
      and lower(trim(coalesce(prod->>'name',''))) = lower('Tire and Belt Damage Protection')
  ) into v_has_protection;

  update public.guest_readiness_operational r
  set belt_tire_protection = case when v_has_protection then true else null end
  where r.source_store_visit_id = p_store_visit_id
    and r.belt_tire_protection is distinct from (case when v_has_protection then true else null end);
end;
$$;

create or replace function public.sync_readiness_belt_tire_after_source_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'DELETE' then
    perform public.sync_readiness_belt_tire_for_store_visit(new.store_visit_id);
  end if;

  if tg_op = 'DELETE' then
    perform public.sync_readiness_belt_tire_for_store_visit(old.store_visit_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.store_visit_id is distinct from new.store_visit_id then
    perform public.sync_readiness_belt_tire_for_store_visit(old.store_visit_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_readiness_belt_tire_after_source_change on public.portal_patti_store_visit_sources;
create trigger trg_sync_readiness_belt_tire_after_source_change
after insert or delete or update of source_json, store_visit_id
on public.portal_patti_store_visit_sources
for each row
execute function public.sync_readiness_belt_tire_after_source_change();

with desired as (
  select r.readiness_id,
         case when exists (
           select 1
           from public.portal_patti_store_visit_sources s
           cross join lateral jsonb_array_elements(coalesce(s.source_json->'bookings','[]'::jsonb)) b
           cross join lateral jsonb_array_elements(coalesce(b->'booking_products', b->'bookingProducts', '[]'::jsonb)) prod
           where s.store_visit_id = r.source_store_visit_id
             and lower(trim(coalesce(prod->>'name',''))) = lower('Tire and Belt Damage Protection')
         ) then true else null end as belt_tire_protection
  from public.guest_readiness_operational r
  where nullif(trim(r.source_store_visit_id), '') is not null
)
update public.guest_readiness_operational r
set belt_tire_protection = d.belt_tire_protection
from desired d
where r.readiness_id = d.readiness_id
  and r.belt_tire_protection is distinct from d.belt_tire_protection;
