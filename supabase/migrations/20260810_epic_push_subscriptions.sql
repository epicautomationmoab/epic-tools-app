create table if not exists public.epic_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_profile_id uuid not null references public.team_profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);

create index if not exists epic_push_subscriptions_team_profile_idx
  on public.epic_push_subscriptions(team_profile_id)
  where active = true;

alter table public.epic_push_subscriptions enable row level security;
