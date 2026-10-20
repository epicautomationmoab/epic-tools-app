-- PREVIEW-ONLY PROPOSAL. DO NOT APPLY TO PRODUCTION WITHOUT REVIEW.
-- Atomic change + attributable audit of customer portal payment visibility.
create table if not exists public.guest_payment_visibility_audit (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  confirmation_code text not null,
  actor_profile_id uuid not null references public.team_profiles(id),
  previous_hidden boolean not null,
  new_hidden boolean not null,
  changed_at timestamptz not null default now()
);
create index if not exists guest_payment_visibility_audit_reservation_idx
  on public.guest_payment_visibility_audit(reservation_id, changed_at desc);
alter table public.guest_payment_visibility_audit enable row level security;
revoke all on public.guest_payment_visibility_audit from public, anon, authenticated;
grant select, insert on public.guest_payment_visibility_audit to service_role;

create or replace function public.set_guest_payment_visibility_audited(
  p_confirmation_code text,
  p_hidden boolean,
  p_actor_profile_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.operational_reservations%rowtype;
  v_old boolean;
begin
  if not exists (select 1 from public.team_profiles
      where id = p_actor_profile_id and active is true and role <> 'workstation') then
    raise exception 'Active named employee required';
  end if;
  select * into strict v_reservation from public.operational_reservations
     where confirmation_code = p_confirmation_code for update;
  v_old := coalesce(v_reservation.guest_portal_payment_hidden,false);
  if v_old is distinct from p_hidden then
    update public.operational_reservations
      set guest_portal_payment_hidden = p_hidden
      where id = v_reservation.id;
    insert into public.guest_payment_visibility_audit
      (reservation_id, confirmation_code, actor_profile_id, previous_hidden, new_hidden)
      values (v_reservation.id, p_confirmation_code, p_actor_profile_id, v_old, p_hidden);
  end if;
  return jsonb_build_object('hidden',p_hidden,'changed',v_old is distinct from p_hidden);
end
$$;
revoke all on function public.set_guest_payment_visibility_audited(text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_guest_payment_visibility_audited(text, boolean, uuid) to service_role;
-- REVIEW REQUIRED: check existing triggers, duplicated confirmation codes, actor authority,
-- and permission/rollback tests before migration. This file is NOT applied.
