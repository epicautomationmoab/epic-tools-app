-- Optional informational preferences only. No purchase, charges or readiness gates.
create table if not exists public.exp_belt_tire_inquiries (
 booking_token uuid not null,
 confirmation_code text not null,
 driver_key text not null,
 driver_name text not null,
 response text not null check(response in ('information_requested','declined')),
 source_session_id uuid not null references public.exp_sessions(id),
 price_shown integer not null check(price_shown in (39,59)),
 responded_at timestamptz not null default now(),
 primary key(booking_token,confirmation_code,driver_key)
);
create index if not exists exp_belt_tire_inquiry_session_idx on public.exp_belt_tire_inquiries(source_session_id);
alter table public.exp_belt_tire_inquiries enable row level security;
revoke all on public.exp_belt_tire_inquiries from public,anon,authenticated;
grant select,insert on public.exp_belt_tire_inquiries to service_role;
