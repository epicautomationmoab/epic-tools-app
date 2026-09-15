alter table public.guest_readiness_operational
  add column if not exists pickup_prior_evening boolean;

create or replace function public.sync_readiness_overnight_for_store_visit(p_store_visit_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_overnight boolean;
  v_pickup_prior_evening boolean;
begin
  if nullif(trim(p_store_visit_id), '') is null then
    return;
  end if;

  select
    coalesce(bool_or(
      coalesce(addon->'experience_addon'->>'id','') in (
        '9365','9371','9367','9369','9368',
        '9373','9377','9376','9374','9378'
      )
      or lower(trim(coalesce(addon->>'name',''))) in (
        'overnight add-on','return next morning','pickup prior evening'
      )
      or lower(trim(coalesce(addon->'experience_addon'->>'title',''))) in (
        'overnight add-on','return next morning','return next morning - multi-day','pickup prior evening'
      )
    ), false),
    coalesce(bool_or(
      coalesce(addon->'experience_addon'->>'id','') in (
        '9373','9377','9376','9374','9378'
      )
      or lower(trim(coalesce(addon->>'name',''))) = 'pickup prior evening'
      or lower(trim(coalesce(addon->'experience_addon'->>'title',''))) = 'pickup prior evening'
    ), false)
  into v_has_overnight, v_pickup_prior_evening
  from public.portal_patti_store_visit_sources s
  cross join lateral jsonb_array_elements(coalesce(s.source_json->'bookings','[]'::jsonb)) b
  cross join lateral jsonb_array_elements(coalesce(b->'addons','[]'::jsonb)) addon
  where s.store_visit_id = p_store_visit_id;

  update public.guest_readiness_operational r
  set overnight_addon = case when v_has_overnight then true else null end,
      pickup_prior_evening = case when v_pickup_prior_evening then true else null end
  where r.source_store_visit_id = p_store_visit_id
    and (
      r.overnight_addon is distinct from (case when v_has_overnight then true else null end)
      or r.pickup_prior_evening is distinct from (case when v_pickup_prior_evening then true else null end)
    );
end;
$$;

with desired as (
  select
    r.readiness_id,
    coalesce(bool_or(
      coalesce(addon->'experience_addon'->>'id','') in (
        '9365','9371','9367','9369','9368',
        '9373','9377','9376','9374','9378'
      )
      or lower(trim(coalesce(addon->>'name',''))) in (
        'overnight add-on','return next morning','pickup prior evening'
      )
      or lower(trim(coalesce(addon->'experience_addon'->>'title',''))) in (
        'overnight add-on','return next morning','return next morning - multi-day','pickup prior evening'
      )
    ), false) as has_overnight,
    coalesce(bool_or(
      coalesce(addon->'experience_addon'->>'id','') in (
        '9373','9377','9376','9374','9378'
      )
      or lower(trim(coalesce(addon->>'name',''))) = 'pickup prior evening'
      or lower(trim(coalesce(addon->'experience_addon'->>'title',''))) = 'pickup prior evening'
    ), false) as pickup_prior_evening
  from public.guest_readiness_operational r
  left join public.portal_patti_store_visit_sources s
    on s.store_visit_id = r.source_store_visit_id
  left join lateral jsonb_array_elements(coalesce(s.source_json->'bookings','[]'::jsonb)) b on true
  left join lateral jsonb_array_elements(coalesce(b->'addons','[]'::jsonb)) addon on true
  where nullif(trim(r.source_store_visit_id), '') is not null
  group by r.readiness_id
)
update public.guest_readiness_operational r
set overnight_addon = case when d.has_overnight then true else null end,
    pickup_prior_evening = case when d.pickup_prior_evening then true else null end
from desired d
where r.readiness_id = d.readiness_id
  and (
    r.overnight_addon is distinct from (case when d.has_overnight then true else null end)
    or r.pickup_prior_evening is distinct from (case when d.pickup_prior_evening then true else null end)
  );
