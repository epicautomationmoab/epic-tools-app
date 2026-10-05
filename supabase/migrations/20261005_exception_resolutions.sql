create table if not exists public.operational_exception_resolutions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  confirmation_code text,
  original_status text,
  original_message text,
  resolution_method text not null default 'manual_fixed',
  resolved_by_profile_id uuid,
  resolved_by_name text,
  resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint operational_exception_resolutions_source_type_check
    check (source_type in ('payment','deposit_release','email_delivery')),
  constraint operational_exception_resolutions_method_check
    check (resolution_method in ('manual_fixed'))
);

create unique index if not exists operational_exception_resolutions_source_unique
  on public.operational_exception_resolutions (source_type, source_id);

create index if not exists operational_exception_resolutions_resolved_at_idx
  on public.operational_exception_resolutions (resolved_at desc);

grant select, insert on table public.operational_exception_resolutions to service_role;
