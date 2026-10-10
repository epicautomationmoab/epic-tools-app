-- Podium phone-channel ingestion, isolated from existing CallRail and cancellation delivery.
create table if not exists public.podium_sms_messages (
  event_key text primary key,
  message_uid text,
  conversation_uid text,
  location_uid uuid not null,
  customer_phone text not null,
  direction text not null check (direction in ('inbound','outbound')),
  event_type text not null check (event_type in ('message.received','message.sent','message.failed')),
  body text,
  failure_reason text,
  message_at timestamptz,
  received_at timestamptz not null default now(),
  raw_payload jsonb not null
);
create index if not exists podium_sms_messages_phone_at_idx on public.podium_sms_messages(customer_phone, message_at desc);
create index if not exists podium_sms_messages_conversation_idx on public.podium_sms_messages(conversation_uid, message_at desc);
alter table public.podium_sms_messages enable row level security;
revoke all on public.podium_sms_messages from anon, authenticated;
comment on table public.podium_sms_messages is 'Podium 2700 SMS webhook event mirror, backend-only; never automatically reopens historical inbox threads.';
