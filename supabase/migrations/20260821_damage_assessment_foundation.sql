alter table public.operational_case_damage_items
  add column if not exists category text not null default 'exterior',
  add column if not exists view_key text,
  add column if not exists hotspot_key text;

alter table public.operational_case_damage_items
  drop constraint if exists operational_case_damage_items_category_check;

alter table public.operational_case_damage_items
  add constraint operational_case_damage_items_category_check
  check (category in ('exterior','interior','undercarriage','mechanical','other'));

create index if not exists operational_case_damage_items_category_idx
  on public.operational_case_damage_items(case_id, category);

create table if not exists public.operational_case_damage_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operational_cases(id) on delete cascade,
  damage_item_id uuid not null unique references public.operational_case_damage_items(id) on delete cascade,
  assessment_status text not null default 'unassessed' check (assessment_status in ('unassessed','preliminary','final')),
  recommended_action text not null default 'unknown' check (recommended_action in ('inspect','repair','replace','unknown')),
  parts_estimate numeric(12,2) not null default 0,
  labor_hours numeric(8,2),
  labor_rate numeric(10,2),
  labor_estimate numeric(12,2) not null default 0,
  miscellaneous_estimate numeric(12,2) not null default 0,
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  teardown_required boolean not null default false,
  assessment_notes text,
  assessed_by text,
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_case_damage_assessments_case_id_idx
  on public.operational_case_damage_assessments(case_id);

create table if not exists public.operational_case_assessment_parts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.operational_case_damage_assessments(id) on delete cascade,
  part_number text,
  part_description text not null,
  quantity numeric(8,2) not null default 1,
  unit_price numeric(12,2),
  source_type text not null default 'manual',
  schematic_reference text,
  order_status text not null default 'not_ordered' check (order_status in ('not_ordered','needed','ordered','received','installed','not_needed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_case_assessment_parts_assessment_id_idx
  on public.operational_case_assessment_parts(assessment_id);

alter table public.operational_case_damage_assessments enable row level security;
alter table public.operational_case_assessment_parts enable row level security;

grant select, insert, update, delete on table public.operational_case_damage_assessments to service_role;
grant select, insert, update, delete on table public.operational_case_assessment_parts to service_role;
