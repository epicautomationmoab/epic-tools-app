-- Unified Epic note record: one stored note, multiple filtered views.
create table if not exists public.epic_unified_notes (
  note_id uuid primary key default gen_random_uuid(),
  confirmation_code text,
  readiness_id uuid,
  customer_code text,
  note_text text not null check (length(btrim(note_text)) > 0),
  note_scope text not null default 'reservation' check (note_scope in ('customer','reservation')),
  source text not null default 'c360' check (source in ('c360','readiness','tripworks')),
  visible_in_readiness boolean not null default false,
  author_name text,
  source_note_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint readiness_notes_must_be_reservation check (not visible_in_readiness or note_scope = 'reservation'),
  constraint readiness_source_visible check (source <> 'readiness' or visible_in_readiness)
);
create unique index if not exists epic_unified_notes_source_id_unique
  on public.epic_unified_notes(source, source_note_id) where source_note_id is not null;
create index if not exists epic_unified_notes_confirmation_idx
  on public.epic_unified_notes(confirmation_code, created_at desc) where archived_at is null;
create index if not exists epic_unified_notes_readiness_idx
  on public.epic_unified_notes(readiness_id, created_at desc) where archived_at is null and visible_in_readiness;
-- Preserve original Readiness note IDs, authors and timestamps.
insert into public.epic_unified_notes
 (note_id,confirmation_code,readiness_id,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id,created_at,updated_at,archived_at)
select n.note_id,r.confirmation_code,n.readiness_id,n.note_text,'reservation','readiness',true,
       n.created_by,n.note_id::text,n.created_at,n.updated_at,n.archived_at
from public.guest_readiness_staff_notes n
left join public.guest_readiness_operational r on r.readiness_id=n.readiness_id
where nullif(btrim(n.note_text),'') is not null
on conflict (note_id) do nothing;
-- Restrict table operations to server-side service-role access.
alter table public.epic_unified_notes enable row level security;
revoke all on public.epic_unified_notes from anon, authenticated;
