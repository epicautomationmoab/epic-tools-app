create table if not exists public.referral_partner_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  email text not null,
  role text not null default 'manager' check (role in ('owner','manager','viewer')),
  active boolean not null default true,
  invited_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, email)
);

create index if not exists referral_partner_profiles_partner_idx
  on public.referral_partner_profiles(partner_id);

create index if not exists referral_partner_profiles_email_idx
  on public.referral_partner_profiles(lower(email));

alter table public.referral_partner_profiles enable row level security;

comment on table public.referral_partner_profiles is
  'Authorized users for the Epic 4X4 Ambassador partner portal. Server-side application access only.';
