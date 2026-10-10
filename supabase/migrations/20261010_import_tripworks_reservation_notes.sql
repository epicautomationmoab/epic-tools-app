-- Import note arrays only when TripWorks supplies them. Empty arrays NEVER delete records.
create or replace function public.import_tripworks_notes_from_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
declare n jsonb; code text; rid uuid; noteid text; author text; 
begin
 if new.event_type not in ('trip_updated','trip_reserved') or jsonb_typeof(new.payload->'notes') <> 'array' then return new; end if;
 code := new.payload->>'confirmation_code';
 if code is null then return new; end if;
 select readiness_id into rid from public.guest_readiness_operational where confirmation_code=code limit 1;
 for n in select value from jsonb_array_elements(new.payload->'notes') loop
  noteid:=n->>'id'; 
  if noteid is null or nullif(btrim(coalesce(n->>'text','')),'') is null then continue; end if;
  author:=n->'user_avatar'->>'full_name';
  insert into public.epic_unified_notes (confirmation_code,readiness_id,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id,created_at,updated_at)
  values(code,rid,n->>'text','reservation','tripworks',false,author,noteid,coalesce(nullif(n->>'created_at','')::timestamptz,new.received_at),new.received_at)
  on conflict (source,source_note_id) where source_note_id is not null
  do update set note_text=excluded.note_text, author_name=excluded.author_name,
    readiness_id=coalesce(public.epic_unified_notes.readiness_id,excluded.readiness_id),
    updated_at=case when public.epic_unified_notes.note_text is distinct from excluded.note_text then excluded.updated_at else public.epic_unified_notes.updated_at end;
 end loop;
 return new;
end $$;
drop trigger if exists trigger_import_tripworks_notes on public.webhook_events;
create trigger trigger_import_tripworks_notes after insert on public.webhook_events
 for each row execute function public.import_tripworks_notes_from_webhook();
-- Idempotent historical import, preserving source-note identity.
do $$
declare w record;
begin
 for w in select event_type,payload,received_at from public.webhook_events
  where event_type in ('trip_updated','trip_reserved') and jsonb_typeof(payload->'notes')='array'
  order by received_at asc
 loop
  -- Replay through the same ingestion logic without altering historical rows.
  insert into public.epic_unified_notes (confirmation_code,readiness_id,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id,created_at,updated_at)
  select w.payload->>'confirmation_code',r.readiness_id,n.value->>'text','reservation','tripworks',false,
         n.value->'user_avatar'->>'full_name',n.value->>'id',
         coalesce(nullif(n.value->>'created_at','')::timestamptz,w.received_at),w.received_at
  from jsonb_array_elements(w.payload->'notes') n
  left join public.guest_readiness_operational r on r.confirmation_code=w.payload->>'confirmation_code'
  where w.payload->>'confirmation_code' is not null and n.value->>'id' is not null
    and nullif(btrim(coalesce(n.value->>'text','')),'') is not null
  on conflict (source,source_note_id) where source_note_id is not null
  do update set note_text=excluded.note_text,updated_at=excluded.updated_at;
 end loop;
end $$;
