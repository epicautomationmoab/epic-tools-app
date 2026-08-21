create table if not exists public.guest_form_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.guest_form_tasks(id) on delete cascade,
  submission_id uuid references public.guest_form_submissions(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  content_type text,
  byte_size bigint,
  sort_order integer not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists guest_form_attachments_task_id_idx on public.guest_form_attachments(task_id);
create index if not exists guest_form_attachments_submission_id_idx on public.guest_form_attachments(submission_id);

alter table public.guest_form_attachments enable row level security;
grant select, insert, update, delete on table public.guest_form_attachments to service_role;

insert into public.guest_form_templates (
  template_key, template_name, template_version, business_line, form_title, form_description, agreement_html, fields_schema, requires_signature, pdf_title
) values (
  'damage_acknowledgment',
  'Vehicle Damage Acknowledgment and Next Steps',
  '2026-08-20',
  'Rentals',
  'Vehicle Damage Acknowledgment and Next Steps',
  'This form documents vehicle damage noted upon return and guides you through the next steps in a clear and transparent process.',
  $$<p>At Epic 4X4 Adventures, we handle every damage situation with fairness, integrity, and transparency. We understand that returning a vehicle with damage can feel uncomfortable or uncertain, and we don’t take that lightly. This process is here to ensure that expectations are clear, documentation is thorough, and that you’re treated with professionalism and respect every step of the way.</p><p>The above vehicle was returned with damage, which has been documented by Epic 4X4 Adventures staff.</p><h3>Here's what to expect:</h3><ul><li>Our team will assess the damage using before and after photos, which will be shared with you.</li><li>Vehicle data including GPS information will be reviewed.</li><li>You will receive a written invoice that outlines the repairs and all associated charges.</li><li>Your invoice will include OEM part numbers and repair times for all applicable items.</li><li>You will have 72 hours to review the invoice and all other documentation. We invite and encourage any questions you may have.</li><li>During this 72 hour period, you may request an alternate form of payment.</li><li>After 72 hours, if no response is received, we will proceed with capturing payment from the authorized damage deposit hold. Any additional amount due above the authorized damage deposit hold will be captured with credit card information on the reservation.</li><li>Any damaged parts replaced during repairs are available upon request. Shipping and handling will be at your expense.</li></ul>$$,
  '[
    {"key":"vehicle_identifier","label":"Vehicle #","type":"text","required":true},
    {"key":"damage_types","label":"Damage noted upon return","type":"multicheck","required":true,"options":["Roll Cage/Frame","Body Panels","Suspension","Tire/Wheel","Bumper","Other"]},
    {"key":"damage_details","label":"What happened?","type":"textarea","required":true},
    {"key":"injuries","label":"Were there any injuries at the time the damage occurred?","type":"select","required":true,"options":["No","Yes"]},
    {"key":"injury_details","label":"Injury details (if applicable)","type":"textarea","required":false},
    {"key":"renter_full_name","label":"Renter Full Name","type":"text","required":true}
  ]'::jsonb,
  true,
  'Vehicle Damage Acknowledgment and Next Steps'
)
on conflict (template_key) do update set
  template_name=excluded.template_name,
  template_version=excluded.template_version,
  business_line=excluded.business_line,
  form_title=excluded.form_title,
  form_description=excluded.form_description,
  agreement_html=excluded.agreement_html,
  fields_schema=excluded.fields_schema,
  requires_signature=excluded.requires_signature,
  pdf_title=excluded.pdf_title,
  is_active=true,
  updated_at=now();