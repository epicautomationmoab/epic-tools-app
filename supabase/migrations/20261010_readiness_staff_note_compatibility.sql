-- Keep writes made through older Readiness code paths in the canonical record.
create or replace function public.mirror_readiness_staff_note() returns trigger
language plpgsql security definer set search_path=public as $$
declare code text;
begin
 select confirmation_code into code from public.guest_readiness_operational where readiness_id=new.readiness_id limit 1;
 insert into public.epic_unified_notes
 (note_id,confirmation_code,readiness_id,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id,created_at,updated_at,archived_at)
 values(new.note_id,code,new.readiness_id,new.note_text,'reservation','readiness',true,new.created_by,new.note_id::text,new.created_at,new.updated_at,new.archived_at)
 on conflict (note_id) do update set note_text=excluded.note_text,updated_at=excluded.updated_at,archived_at=excluded.archived_at;
 return new;
end $$;
drop trigger if exists mirror_readiness_staff_note on public.guest_readiness_staff_notes;
create trigger mirror_readiness_staff_note after insert or update on public.guest_readiness_staff_notes
for each row execute function public.mirror_readiness_staff_note();
