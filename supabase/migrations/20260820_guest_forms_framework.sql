create extension if not exists pgcrypto;

create table if not exists public.guest_form_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_name text not null,
  template_version text not null,
  business_line text,
  form_title text not null,
  form_description text,
  agreement_html text not null,
  fields_schema jsonb not null default '[]'::jsonb,
  requires_signature boolean not null default true,
  pdf_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_form_tasks (
  id uuid primary key default gen_random_uuid(),
  readiness_id uuid references public.guest_readiness_operational(readiness_id) on delete set null,
  operational_reservation_id uuid references public.operational_reservations(id) on delete set null,
  store_visit_id text references public.portal_patti_store_visits(store_visit_id) on delete set null,
  confirmation_code text not null,
  template_id uuid not null references public.guest_form_templates(id),
  task_status text not null default 'created' check (task_status = any (array['created','sent','opened','completed','expired','cancelled'])),
  required boolean not null default true,
  public_token_hash text not null unique,
  expires_at timestamptz,
  assigned_guest_name text,
  assigned_guest_email text,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_form_tasks_confirmation_idx on public.guest_form_tasks(confirmation_code);
create index if not exists guest_form_tasks_readiness_idx on public.guest_form_tasks(readiness_id);
create index if not exists guest_form_tasks_store_visit_idx on public.guest_form_tasks(store_visit_id);
create index if not exists guest_form_tasks_status_idx on public.guest_form_tasks(task_status);

create table if not exists public.guest_form_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.guest_form_tasks(id) on delete restrict,
  document_id text not null unique,
  form_data jsonb not null default '{}'::jsonb,
  signer_name text,
  signature_data_url text,
  signed_pdf_storage_path text,
  signed_pdf_sha256 text,
  signer_ip_address inet,
  signer_user_agent text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.guest_form_templates enable row level security;
alter table public.guest_form_tasks enable row level security;
alter table public.guest_form_submissions enable row level security;

create or replace view public.guest_form_task_status_by_readiness as
select readiness_id,
  count(*) filter (where required and task_status <> 'cancelled') as required_task_count,
  count(*) filter (where required and task_status = 'completed') as completed_task_count,
  count(*) filter (where required and task_status not in ('completed','cancelled')) as outstanding_task_count
from public.guest_form_tasks
where readiness_id is not null
group by readiness_id;
