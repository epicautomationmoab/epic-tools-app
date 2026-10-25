-- Queue-only historical reconciliation; does not alter check-in or send guest messages.
create table if not exists public.held_over_queue_reconciliations (
  readiness_id uuid primary key,
  confirmation_code text not null,
  reason text not null,
  reconciled_by text not null,
  reconciled_at timestamptz not null default now()
);
alter table public.held_over_queue_reconciliations enable row level security;
-- Private server-side use only; no anon or authenticated table grants.
revoke all on table public.held_over_queue_reconciliations from anon, authenticated;

-- The team app queries this through its server-side service-role client.
grant select on table public.held_over_queue_reconciliations to service_role;
