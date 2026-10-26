-- EXP training sessions and participant-level reconciliation.
-- Design migration only; do not run on production until quiz, kiosk and waiver
-- reconciliation paths are tested together.
create table if not exists public.exp_sessions (
  id uuid primary key default gen_random_uuid(),
  readiness_id text not null,
  video_version text not null,
  mode text not null check (mode in ('individual','group','kiosk_group')),
  assessment_version text not null,
  outcome text not null default 'in_progress' check (outcome in ('in_progress','complete','critical_retry','retry_or_technician','technician_required')),
  result_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists exp_sessions_readiness_idx on public.exp_sessions(readiness_id);

create table if not exists public.exp_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exp_sessions(id) on delete cascade,
  readiness_id text not null,
  display_name text not null,
  initials text not null,
  acknowledgement_at timestamptz,
  waiver_signer_reference text,
  reconciliation_status text not null default 'unmatched'
    check (reconciliation_status in ('unmatched','suggested','verified','rejected')),
  reconciliation_method text check (reconciliation_method in ('exact_unique','staff_verified','waiver_reference')),
  reconciled_at timestamptz,
  reconciled_by text,
  created_at timestamptz not null default now(),
  constraint exp_participants_name_not_blank check (length(trim(display_name)) > 0),
  constraint exp_participants_initials_not_blank check (length(trim(initials)) > 0),
  constraint exp_participants_verified_reference check (
    reconciliation_status <> 'verified' or waiver_signer_reference is not null
  )
);
create index if not exists exp_participants_readiness_idx on public.exp_participants(readiness_id);
create unique index if not exists exp_verified_waiver_unique
  on public.exp_participants(readiness_id,waiver_signer_reference)
  where reconciliation_status = 'verified' and waiver_signer_reference is not null;

create table if not exists public.exp_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.exp_participants(id) on delete cascade,
  previous_status text,
  new_status text not null,
  waiver_signer_reference text,
  actor text not null,
  reason text,
  created_at timestamptz not null default now()
);
-- NOTE: Secure RLS/service-role authorization, signer-reference mapping, and
-- transactional writes are required before exposing any guest-facing POST.

-- EXP records are never directly available to browser Supabase roles.
alter table public.exp_sessions enable row level security;
alter table public.exp_participants enable row level security;
alter table public.exp_reconciliation_events enable row level security;
revoke all on public.exp_sessions, public.exp_participants, public.exp_reconciliation_events from anon, authenticated;
-- Server endpoints use the backend secret role and must validate the portal
-- reservation on every request. Never expose the secret key to the browser.
