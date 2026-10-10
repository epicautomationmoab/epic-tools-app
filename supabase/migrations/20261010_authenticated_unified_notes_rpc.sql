create or replace function public.epic_unified_notes_for_reservations(p_confirmations text[])
returns setof public.epic_unified_notes language sql stable security definer set search_path=public as $$
select n.* from public.epic_unified_notes n
where exists(select 1 from public.team_profiles p where p.user_id=auth.uid() and p.active=true and p.role<>'workstation')
and n.archived_at is null and n.confirmation_code=any(p_confirmations)
order by n.created_at desc limit 250
$$;
create or replace function public.epic_unified_notes_add(p_confirmation text,p_note_text text,p_show_in_readiness boolean)
returns setof public.epic_unified_notes language plpgsql security definer set search_path=public as $$
declare employee_name text;
begin
select p.display_name into employee_name from public.team_profiles p where p.user_id=auth.uid() and p.active=true and p.role<>'workstation' limit 1;
if employee_name is null then raise exception 'Employee login required'; end if;
if p_confirmation is null or btrim(p_confirmation)='' or p_note_text is null or btrim(p_note_text)='' or length(p_note_text)>4000 then raise exception 'Invalid note'; end if;
return query insert into public.epic_unified_notes(confirmation_code,note_text,note_scope,source,visible_in_readiness,author_name)
values(upper(btrim(p_confirmation)),btrim(p_note_text),'reservation','c360',coalesce(p_show_in_readiness,false),employee_name) returning *;
end $$;
create or replace function public.epic_unified_notes_set_readiness(p_note_id uuid,p_visible boolean)
returns setof public.epic_unified_notes language plpgsql security definer set search_path=public as $$
begin
if not exists(select 1 from public.team_profiles p where p.user_id=auth.uid() and p.active=true and p.role<>'workstation') then raise exception 'Employee login required'; end if;
return query update public.epic_unified_notes n set visible_in_readiness=coalesce(p_visible,false),updated_at=now()
where n.note_id=p_note_id and n.note_scope='reservation' and n.source in ('c360','tripworks') returning n.*;
end $$;
revoke all on function public.epic_unified_notes_for_reservations(text[]) from public,anon;
revoke all on function public.epic_unified_notes_add(text,text,boolean) from public,anon;
revoke all on function public.epic_unified_notes_set_readiness(uuid,boolean) from public,anon;
grant execute on function public.epic_unified_notes_for_reservations(text[]) to authenticated;
grant execute on function public.epic_unified_notes_add(text,text,boolean) to authenticated;
grant execute on function public.epic_unified_notes_set_readiness(uuid,boolean) to authenticated;