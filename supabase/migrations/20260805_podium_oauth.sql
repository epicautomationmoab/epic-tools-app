create table if not exists public.podium_oauth_connections (
  id text primary key default 'primary' check (id = 'primary'),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text,
  location_uid uuid not null,
  location_name text,
  podium_phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.podium_oauth_connections enable row level security;
revoke all on table public.podium_oauth_connections from anon, authenticated;
grant select, insert, update on table public.podium_oauth_connections to service_role;

alter table public.cancellation_agreement_requests
  add column if not exists podium_message_uid text,
  add column if not exists podium_delivery_status text;

grant select, insert, update on table public.cancellation_agreement_requests to service_role;
