create table if not exists public.operational_cases (
  id uuid primary key default gen_random_uuid(),
  operational_reservation_id uuid references public.operational_reservations(id) on delete set null,
  confirmation_code text not null,
  business_line text,
  case_type text not null check (case_type in ('returned_damage','trail_response','beacon_activation','other')),
  status text not null default 'open' check (status in ('open','active_response','follow_up','closed')),
  vehicle_number text,
  opened_by text,
  opened_by_profile_id uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_cases_confirmation_code_idx
  on public.operational_cases(confirmation_code);
create index if not exists operational_cases_reservation_id_idx
  on public.operational_cases(operational_reservation_id);
create index if not exists operational_cases_status_idx
  on public.operational_cases(status);

create table if not exists public.operational_case_workflows (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operational_cases(id) on delete cascade,
  workflow_type text not null,
  workflow_status text not null default 'not_started' check (workflow_status in ('not_started','in_progress','completed','cancelled')),
  guest_form_task_id uuid references public.guest_form_tasks(id) on delete set null,
  external_document_id text,
  started_by text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_case_workflows_case_id_idx
  on public.operational_case_workflows(case_id);
create index if not exists operational_case_workflows_guest_form_task_id_idx
  on public.operational_case_workflows(guest_form_task_id);

create table if not exists public.operational_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operational_cases(id) on delete cascade,
  workflow_id uuid references public.operational_case_workflows(id) on delete set null,
  guest_form_attachment_id uuid references public.guest_form_attachments(id) on delete set null,
  evidence_type text not null default 'photo',
  source_type text not null,
  stage text,
  vehicle_number text,
  storage_path text,
  original_filename text,
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_case_evidence_case_id_idx
  on public.operational_case_evidence(case_id);
create index if not exists operational_case_evidence_vehicle_number_idx
  on public.operational_case_evidence(vehicle_number);
create index if not exists operational_case_evidence_guest_form_attachment_id_idx
  on public.operational_case_evidence(guest_form_attachment_id);

alter table public.operational_cases enable row level security;
alter table public.operational_case_workflows enable row level security;
alter table public.operational_case_evidence enable row level security;

grant select, insert, update, delete on table public.operational_cases to service_role;
grant select, insert, update, delete on table public.operational_case_workflows to service_role;
grant select, insert, update, delete on table public.operational_case_evidence to service_role;
