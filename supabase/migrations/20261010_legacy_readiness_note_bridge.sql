-- Preserve legacy single-field Readiness notes in the canonical history.
-- These are distinct from guest_readiness_staff_notes records.
insert into public.epic_unified_notes
 (confirmation_code,readiness_id,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id)
select r.confirmation_code,r.readiness_id,btrim(r.notes),'reservation','readiness',true,
       'Readiness (legacy)', 'legacy:'||r.readiness_id::text
from public.guest_readiness_operational r
where nullif(btrim(coalesce(r.notes,'')),'') is not null
on conflict (source,source_note_id) where source_note_id is not null
do update set note_text=excluded.note_text,updated_at=now();
-- Keep existing legacy saves visible while the editor is transitioned.
create or replace function public.mirror_legacy_readiness_notes() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.notes is not distinct from old.notes then return new; end if;
 if nullif(btrim(coalesce(new.notes,'')),'') is null then
   update public.epic_unified_notes set archived_at=now(),updated_at=now()
   where source='readiness' and source_note_id='legacy:'||new.readiness_id::text;
 else
   insert into public.epic_unified_notes
   (confirmation_code,readiness_id,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id)
   values(new.confirmation_code,new.readiness_id,btrim(new.notes),'reservation','readiness',true,
          'Readiness (legacy)','legacy:'||new.readiness_id::text)
   on conflict (source,source_note_id) where source_note_id is not null
   do update set note_text=excluded.note_text,archived_at=null,updated_at=now();
 end if;
 return new;
end $$;
drop trigger if exists mirror_legacy_readiness_notes on public.guest_readiness_operational;
create trigger mirror_legacy_readiness_notes after update of notes on public.guest_readiness_operational
for each row execute function public.mirror_legacy_readiness_notes();
