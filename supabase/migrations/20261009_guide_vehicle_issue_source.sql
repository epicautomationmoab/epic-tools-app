alter table public.tour_vehicle_issue_reports drop constraint if exists tour_vehicle_issue_reports_source_check;
alter table public.tour_vehicle_issue_reports add constraint tour_vehicle_issue_reports_source_check check (source in ('tour_dispatch','rental_readiness','guide_tour'));
