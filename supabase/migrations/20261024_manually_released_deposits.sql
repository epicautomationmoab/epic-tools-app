-- Manager-only server-side manual damage deposit reconciliation.
-- This function never contacts MPWR and never queues Victor.
create or replace function public.manually_release_rental_damage_deposit(p_readiness_id uuid,p_actor text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.rental_damage_deposits%rowtype;
begin
 if length(trim(coalesce(p_actor,''))) < 2 then raise exception 'Actor is required'; end if;
 if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'A reason of at least 5 characters is required'; end if;
 select * into d from public.rental_damage_deposits where readiness_id=p_readiness_id for update;
 if not found then raise exception 'Damage deposit record not found'; end if;
 if d.status='released' then raise exception 'Deposit is already released'; end if;
 if exists(select 1 from public.victor_deposit_jobs where damage_deposit_id=d.id and status in ('queued','claimed')) then
  raise exception 'Victor release is in progress; manual reconciliation blocked';
 end if;
 update public.rental_damage_deposits set status='released',
 released_at=now(),released_by='Manually Released by '||trim(p_actor)||' — '||trim(p_reason),
 hold_by=null,hold_at=null,hold_reason=null,last_error=null,updated_at=now()
 where id=d.id returning * into d;
 return jsonb_build_object('id',d.id,'status',d.status,'released_at',d.released_at,'released_by',d.released_by);
end $$;
revoke all on function public.manually_release_rental_damage_deposit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.manually_release_rental_damage_deposit(uuid,text,text) to service_role;
