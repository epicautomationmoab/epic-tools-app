create or replace view public.guest_arrival_board_v as
with board_base as (
  select
    (
      case
        when o.pickup_prior_evening is true then
          date_trunc('day', d.visit_start_time) - interval '1 day' + interval '17 hours'
        else d.visit_start_time
      end
    ) at time zone 'America/Denver' as visit_start_time,
    d.confirmation_code,
    d.customer_name,
    d.business_line,
    d.product_display_name as source_product_display_name,
    coalesce(m.display_product_name, d.product_display_name) as board_product_display_name,
    d.total_vehicle_count,
    d.expected_guest_count,
    d.attention_flags,
    case
      when d.business_line = 'rental' and coalesce(d.total_vehicle_count, 0) > 1
        then coalesce(d.total_vehicle_count, 0)::text || 'x ' || coalesce(m.display_product_name, d.product_display_name)
      else coalesce(m.display_product_name, d.product_display_name)
    end as board_activity_label,
    case
      when coalesce(d.amount_due_cents, 0) = 0
        and coalesce(d.epic_document_received_count, 0) >= coalesce(d.epic_document_expected_count, 0)
        and coalesce(d.mpwr_document_received_count, 0) >= coalesce(d.mpwr_document_expected_count, 0)
        and (
          d.business_line <> 'rental'
          or coalesce(d.ohv_required, false) = false
          or coalesce(d.ohv_certificate_uploaded, false) = true
        )
        then 'See Agent'
      else 'Proceed to Kiosk'
    end as board_action_label,
    case
      when coalesce(d.amount_due_cents, 0) = 0
        and coalesce(d.epic_document_received_count, 0) >= coalesce(d.epic_document_expected_count, 0)
        and coalesce(d.mpwr_document_received_count, 0) >= coalesce(d.mpwr_document_expected_count, 0)
        and (
          d.business_line <> 'rental'
          or coalesce(d.ohv_required, false) = false
          or coalesce(d.ohv_certificate_uploaded, false) = true
        )
        then 'agent'
      else 'kiosk'
    end as board_action_type,
    d.customer_phone_last_four,
    d.handoff_status
  from public.guest_readiness_with_handoff_v d
  left join public.epic_product_display_names m
    on m.active = true
   and m.business_line = d.business_line
   and m.source_product_name = d.product_display_name
  left join public.guest_readiness_operational o
    on o.readiness_id = d.readiness_id
  where d.visit_start_time::date >= (now() at time zone 'America/Denver')::date
    and d.confirmation_code is not null
    and d.customer_name is not null
    and (
      d.business_line <> 'tour'
      or coalesce(d.handoff_status, '') <> all (array['checked_in','tour_returned'])
    )
    and (
      d.business_line <> 'rental'
      or coalesce(d.handoff_status, '') <> all (array['rental_out','rental_returned'])
    )
)
select
  visit_start_time,
  confirmation_code,
  customer_name,
  business_line,
  source_product_display_name,
  board_product_display_name,
  total_vehicle_count,
  expected_guest_count,
  attention_flags,
  board_activity_label,
  board_action_label,
  board_action_type,
  '{}'::text[] as arrival_board_status_names,
  false as has_rental_out_status,
  false as has_checked_in_status,
  customer_phone_last_four,
  handoff_status
from board_base
order by visit_start_time, business_line, customer_name;

create or replace view public.guest_arrival_board_with_handoff_v as
select
  b.visit_start_time,
  b.confirmation_code,
  b.customer_name,
  b.business_line,
  b.source_product_display_name,
  b.board_product_display_name,
  b.total_vehicle_count,
  b.expected_guest_count,
  b.attention_flags,
  b.board_activity_label,
  b.board_action_label,
  b.board_action_type,
  b.arrival_board_status_names,
  b.has_rental_out_status,
  b.has_checked_in_status,
  coalesce(h.handoff_status, b.handoff_status) as handoff_status,
  b.customer_phone_last_four
from public.guest_arrival_board_v b
left join lateral (
  select e.handoff_status
  from public.epic_operational_handoffs e
  where e.confirmation_code = b.confirmation_code
    and e.visit_start_time = b.visit_start_time
    and e.business_line = b.business_line
  order by e.updated_at desc
  limit 1
) h on true
where (
  b.business_line is distinct from 'tour'
  or coalesce(coalesce(h.handoff_status, b.handoff_status), '') <> all (array['checked_in','tour_returned'])
)
and (
  b.business_line is distinct from 'rental'
  or coalesce(coalesce(h.handoff_status, b.handoff_status), '') <> all (array['rental_out','rental_returned'])
);
