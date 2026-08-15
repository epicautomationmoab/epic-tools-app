create table if not exists public.kiosk_handoffs (
  id uuid primary key default gen_random_uuid(),
  target_kiosk text not null check (target_kiosk in (
    'kiosk-1', 'kiosk-2', 'kiosk-3', 'kiosk-4', 'kiosk-5', 'kiosk-6', 'kiosk-7'
  )),
  readiness_id text not null,
  confirmation_code text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  delivered_at timestamptz,
  failure_reason text
);

create index if not exists kiosk_handoffs_pending_kiosk_idx
  on public.kiosk_handoffs(target_kiosk, created_at)
  where status = 'pending';

alter table public.kiosk_handoffs enable row level security;
