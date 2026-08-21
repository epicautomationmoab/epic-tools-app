create extension if not exists pgcrypto;

create table if not exists public.post_visit_email_preferences (
  readiness_id uuid primary key references public.guest_readiness_operational(readiness_id) on delete cascade,
  confirmation_code text not null,
  send_mode text not null default 'review_request'
    check (send_mode in ('review_request','thank_you_only')),
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.post_visit_email_jobs (
  id uuid primary key default gen_random_uuid(),
  readiness_id uuid not null unique references public.guest_readiness_operational(readiness_id) on delete cascade,
  confirmation_code text not null,
  business_line text not null check (business_line in ('tour','rental')),
  visit_start_time timestamp without time zone not null,
  completion_status text not null check (completion_status in ('tour_returned','rental_returned')),
  completed_at timestamptz not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','cancelled')),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_visit_email_jobs_due_idx
  on public.post_visit_email_jobs(status, scheduled_for);

create table if not exists public.post_visit_email_recipients (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.post_visit_email_jobs(id) on delete cascade,
  waiver_signature_id uuid references public.epic_waiver_signatures(id) on delete set null,
  recipient_name text not null,
  recipient_email text not null,
  normalized_email text not null,
  send_mode text not null check (send_mode in ('review_request','thank_you_only')),
  status text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  resend_message_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, normalized_email)
);

alter table public.post_visit_email_preferences enable row level security;
alter table public.post_visit_email_jobs enable row level security;
alter table public.post_visit_email_recipients enable row level security;

create or replace function public.schedule_post_visit_email(
  p_readiness_id uuid,
  p_completion_status text,
  p_completed_at timestamptz default now()
)
returns public.post_visit_email_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.guest_readiness_operational%rowtype;
  v_scheduled_for timestamptz;
  v_result public.post_visit_email_jobs;
begin
  select * into v_row
  from public.guest_readiness_operational
  where readiness_id = p_readiness_id;

  if not found then
    raise exception 'Readiness reservation not found.';
  end if;

  if v_row.business_line = 'rental' and p_completion_status <> 'rental_returned' then
    raise exception 'Rental post-visit email requires rental_returned.';
  end if;

  if v_row.business_line = 'tour' and p_completion_status <> 'tour_returned' then
    raise exception 'Tour post-visit email requires tour_returned.';
  end if;

  v_scheduled_for := (
    ((p_completed_at at time zone 'America/Denver')::date + 1 + time '10:00')
    at time zone 'America/Denver'
  );

  insert into public.post_visit_email_jobs (
    readiness_id,
    confirmation_code,
    business_line,
    visit_start_time,
    completion_status,
    completed_at,
    scheduled_for,
    status,
    updated_at
  ) values (
    v_row.readiness_id,
    v_row.confirmation_code,
    v_row.business_line,
    v_row.visit_start_time,
    p_completion_status,
    p_completed_at,
    v_scheduled_for,
    'pending',
    now()
  )
  on conflict (readiness_id)
  do update set
    completion_status = excluded.completion_status,
    completed_at = excluded.completed_at,
    scheduled_for = case
      when public.post_visit_email_jobs.status in ('sent','cancelled')
        then public.post_visit_email_jobs.scheduled_for
      else excluded.scheduled_for
    end,
    status = case
      when public.post_visit_email_jobs.status in ('sent','cancelled')
        then public.post_visit_email_jobs.status
      else 'pending'
    end,
    last_error = case
      when public.post_visit_email_jobs.status in ('sent','cancelled')
        then public.post_visit_email_jobs.last_error
      else null
    end,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;
