create table if not exists public.fleet_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  vehicle_number integer not null,
  inspection_type text not null check (inspection_type in ('weekly','during_service')),
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  inspection_date date not null default current_date,
  mileage integer,
  engine_hours numeric,
  inspector_profile_id uuid,
  inspector_name text,
  linked_service_record_id uuid references public.fleet_service_records(id) on delete set null,
  issues_damage_found text,
  action_required text check (action_required in ('no_action','monitor','maintenance_repair','remove_from_service')),
  work_order_reference text,
  assigned_to text,
  target_completion_date date,
  inspection_result text check (inspection_result in ('passed','needs_attention','out_of_service')),
  release_decision_notes text,
  inspector_signature text,
  fleet_manager_review text,
  fleet_manager_profile_id uuid,
  fleet_manager_name text,
  fleet_manager_reviewed_at timestamptz,
  date_closed date,
  completed_at timestamptz,
  slack_notification_status text not null default 'pending' check (slack_notification_status in ('pending','sent','not_configured','failed')),
  slack_notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_inspections_vehicle_number_idx
  on public.fleet_inspections(vehicle_number, inspection_date desc);

create index if not exists fleet_inspections_status_idx
  on public.fleet_inspections(status, inspection_date desc);

create table if not exists public.fleet_inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.fleet_inspections(id) on delete cascade,
  category_code text not null,
  category_label text not null,
  item_code text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending','pass','needs_attention','not_applicable')),
  notes text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspection_id, item_code)
);

create index if not exists fleet_inspection_items_inspection_idx
  on public.fleet_inspection_items(inspection_id, sort_order);

create or replace view public.fleet_inspection_summary_v as
select
  i.id,
  i.vehicle_id,
  i.vehicle_number,
  i.inspection_type,
  i.status,
  i.inspection_date,
  i.mileage,
  i.engine_hours,
  i.inspector_name,
  i.inspection_result,
  i.action_required,
  i.issues_damage_found,
  i.assigned_to,
  i.work_order_reference,
  i.target_completion_date,
  i.completed_at,
  i.fleet_manager_name,
  i.fleet_manager_reviewed_at,
  count(ii.id) filter (where ii.status = 'needs_attention')::integer as needs_attention_count,
  count(ii.id) filter (where ii.status = 'pass')::integer as pass_count,
  count(ii.id) filter (where ii.status = 'not_applicable')::integer as not_applicable_count,
  count(ii.id) filter (where ii.status = 'pending')::integer as pending_count
from public.fleet_inspections i
left join public.fleet_inspection_items ii on ii.inspection_id = i.id
group by i.id;
