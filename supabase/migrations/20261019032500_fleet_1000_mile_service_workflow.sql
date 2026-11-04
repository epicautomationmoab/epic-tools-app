create table if not exists public.fleet_service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  vehicle_number integer not null,
  service_type text not null default '1000_mile' check (service_type in ('1000_mile')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  due_mileage integer,
  start_mileage integer,
  completion_mileage integer,
  technician_profile_id uuid references public.team_profiles(id) on delete set null,
  technician_name text,
  started_at timestamptz,
  completed_at timestamptz,
  parts_and_fluids_used text,
  additional_concerns text,
  mpwr_documented boolean not null default false,
  full_inspection_completed boolean not null default false,
  created_by_profile_id uuid references public.team_profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_service_records_vehicle_idx
  on public.fleet_service_records (vehicle_id, created_at desc);
create index if not exists fleet_service_records_status_idx
  on public.fleet_service_records (status, created_at desc);

create table if not exists public.fleet_service_record_items (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.fleet_service_records(id) on delete cascade,
  item_code text not null,
  label text not null,
  action_text text not null,
  model_scope text,
  status text not null default 'pending'
    check (status in ('pending','completed','not_applicable','needs_attention')),
  notes text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_record_id, item_code)
);

create index if not exists fleet_service_items_record_idx
  on public.fleet_service_record_items (service_record_id, sort_order);

alter table public.fleet_service_records enable row level security;
alter table public.fleet_service_record_items enable row level security;
grant select, insert, update, delete on public.fleet_service_records to service_role;
grant select, insert, update, delete on public.fleet_service_record_items to service_role;