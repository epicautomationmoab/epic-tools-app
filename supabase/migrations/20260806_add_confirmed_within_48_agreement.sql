alter table public.cancellation_agreement_requests
  drop constraint if exists cancellation_agreement_requests_tripsafe_status_check;

alter table public.cancellation_agreement_requests
  add constraint cancellation_agreement_requests_tripsafe_status_check
  check (tripsafe_status in ('declined', 'purchased', 'confirmed_within_48'));
