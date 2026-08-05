create extension if not exists pgcrypto;

create table if not exists public.cancellation_agreement_requests (
  id uuid primary key default gen_random_uuid(),
  readiness_id text not null,
  confirmation_code text not null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  visit_summary text not null,
  amount_due_cents bigint,
  tripsafe_status text not null check (tripsafe_status in ('declined', 'purchased')),
  policy_version text not null,
  policy_title text not null,
  policy_summary text not null,
  policy_paragraphs jsonb not null,
  acceptance_statement text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  status text not null default 'created' check (status in ('created', 'sent', 'opened', 'accepted', 'failed', 'expired')),
  sent_by text not null,
  delivery_mode text not null default 'copy' check (delivery_mode in ('sms', 'email', 'both', 'copy')),
  sent_at timestamptz,
  copied_at timestamptz,
  opened_at timestamptz,
  accepted_at timestamptz,
  callrail_conversation_id text,
  callrail_delivery_status text,
  resend_message_id text,
  email_delivery_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cancellation_agreement_requests_readiness_idx
  on public.cancellation_agreement_requests (readiness_id, created_at desc);

create index if not exists cancellation_agreement_requests_confirmation_idx
  on public.cancellation_agreement_requests (confirmation_code, created_at desc);

create table if not exists public.cancellation_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.cancellation_agreement_requests(id),
  readiness_id text not null,
  confirmation_code text not null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  visit_summary text not null,
  amount_due_cents bigint,
  tripsafe_status text not null,
  policy_version text not null,
  policy_title text not null,
  policy_summary text not null,
  policy_paragraphs jsonb not null,
  acceptance_statement text not null,
  signer_name text not null,
  signature_data_url text not null,
  ip_address text,
  user_agent text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.cancellation_agreement_requests enable row level security;
alter table public.cancellation_agreement_acceptances enable row level security;

create or replace function public.prevent_cancellation_acceptance_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Cancellation agreement acceptance records are immutable';
end;
$$;

drop trigger if exists cancellation_acceptance_no_update on public.cancellation_agreement_acceptances;
create trigger cancellation_acceptance_no_update
before update or delete on public.cancellation_agreement_acceptances
for each row execute function public.prevent_cancellation_acceptance_mutation();

create or replace function public.record_cancellation_agreement_acceptance(
  p_token_hash text,
  p_signer_name text,
  p_signature_data_url text,
  p_ip_address text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.cancellation_agreement_requests%rowtype;
  acceptance_id uuid;
  acceptance_time timestamptz := now();
begin
  if length(trim(coalesce(p_signer_name, ''))) < 2 then
    raise exception 'Signer name is required';
  end if;

  if p_signature_data_url is null
     or p_signature_data_url not like 'data:image/png;base64,%'
     or length(p_signature_data_url) > 250000 then
    raise exception 'A valid signature is required';
  end if;

  select * into request_row
  from public.cancellation_agreement_requests
  where token_hash = p_token_hash
  for update;

  if not found then raise exception 'Agreement not found'; end if;
  if request_row.status = 'accepted' then
    select id into acceptance_id
    from public.cancellation_agreement_acceptances
    where request_id = request_row.id;
    return jsonb_build_object('accepted', true, 'acceptanceId', acceptance_id, 'acceptedAt', request_row.accepted_at);
  end if;
  if request_row.expires_at <= acceptance_time then raise exception 'Agreement link has expired'; end if;
  if request_row.status not in ('created', 'sent', 'opened') then raise exception 'Agreement cannot be accepted'; end if;

  insert into public.cancellation_agreement_acceptances (
    request_id, readiness_id, confirmation_code, customer_name, customer_phone, customer_email,
    visit_summary, amount_due_cents, tripsafe_status, policy_version, policy_title,
    policy_summary, policy_paragraphs, acceptance_statement, signer_name,
    signature_data_url, ip_address, user_agent, accepted_at
  ) values (
    request_row.id, request_row.readiness_id, request_row.confirmation_code,
    request_row.customer_name, request_row.customer_phone, request_row.customer_email, request_row.visit_summary,
    request_row.amount_due_cents, request_row.tripsafe_status, request_row.policy_version,
    request_row.policy_title, request_row.policy_summary, request_row.policy_paragraphs,
    request_row.acceptance_statement, trim(p_signer_name), p_signature_data_url,
    nullif(p_ip_address, ''), nullif(p_user_agent, ''), acceptance_time
  ) returning id into acceptance_id;

  update public.cancellation_agreement_requests
  set status = 'accepted', accepted_at = acceptance_time, updated_at = acceptance_time
  where id = request_row.id;

  return jsonb_build_object('accepted', true, 'acceptanceId', acceptance_id, 'acceptedAt', acceptance_time);
end;
$$;

revoke all on function public.record_cancellation_agreement_acceptance(text, text, text, text, text) from public;
grant execute on function public.record_cancellation_agreement_acceptance(text, text, text, text, text) to service_role;
