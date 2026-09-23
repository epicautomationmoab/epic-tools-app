alter table public.epic_waiver_signatures
  add column if not exists rental_role text,
  add column if not exists signed_agreement_html text,
  add column if not exists signed_minor_ack_html text,
  add column if not exists agreement_content_version text;

alter table public.epic_waiver_signatures
  drop constraint if exists epic_waiver_signatures_rental_role_check;

alter table public.epic_waiver_signatures
  add constraint epic_waiver_signatures_rental_role_check
  check (rental_role is null or rental_role in ('driver','passenger'));

create or replace function public.submit_epic_rental_terms_v2(
  p_confirmation_code text,
  p_public_token text,
  p_signer_first_name text,
  p_signer_middle_initial text,
  p_signer_last_name text,
  p_signer_email text,
  p_signer_phone text,
  p_signer_dob date,
  p_rental_role text,
  p_has_minors boolean,
  p_minors jsonb,
  p_signature_method text,
  p_typed_signature_name text,
  p_drawn_signature_storage_path text,
  p_electronic_signature_consent boolean,
  p_agreement_html text,
  p_minor_ack_html text,
  p_agreement_content_version text,
  p_signer_ip_address text default null,
  p_signer_user_agent text default null
)
returns table(
  signature_id uuid,
  waiver_session_id uuid,
  confirmation_code text,
  adult_signature_count integer,
  minor_covered_count integer,
  covered_participant_count integer,
  rental_role text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session record;
  v_middle text;
  v_legal_name text;
  v_typed_normalized text;
  v_legal_normalized text;
  v_signature_id uuid;
  v_minor jsonb;
  v_minor_count integer := 0;
  v_age integer;
begin
  select s.*, t.template_version, t.business_line as template_business_line
  into v_session
  from public.epic_waiver_sessions s
  join public.epic_waiver_templates t on t.id = s.waiver_template_id
  where s.confirmation_code = p_confirmation_code
    and s.public_token = p_public_token
    and s.session_status = 'active'
    and s.expires_at >= now()
    and t.is_active = true
  limit 1;

  if v_session.id is null then
    raise exception 'This agreement link is invalid, inactive, or expired.';
  end if;
  if coalesce(v_session.template_business_line, '') <> 'rental' then
    raise exception 'This agreement session is not a rental agreement.';
  end if;

  if p_rental_role not in ('driver','passenger') then
    raise exception 'Select Driver or Passenger.';
  end if;

  if nullif(trim(p_signer_first_name), '') is null or nullif(trim(p_signer_last_name), '') is null then
    raise exception 'First and last name are required.';
  end if;
  if nullif(trim(p_signer_email), '') is null then
    raise exception 'Email address is required.';
  end if;
  if p_signer_dob is null then
    raise exception 'Date of birth is required.';
  end if;
  v_age := date_part('year', age(current_date, p_signer_dob));
  if v_age < 18 then
    raise exception 'Signer must be at least 18 years old.';
  end if;
  if p_electronic_signature_consent is not true then
    raise exception 'Electronic signature consent is required.';
  end if;
  if p_signature_method not in ('typed','drawn') then
    raise exception 'Signature method must be typed or drawn.';
  end if;
  if nullif(trim(p_agreement_html), '') is null or nullif(trim(p_agreement_content_version), '') is null then
    raise exception 'Signed agreement snapshot and version are required.';
  end if;

  v_middle := nullif(upper(trim(p_signer_middle_initial)), '');
  if v_middle is not null and char_length(v_middle) <> 1 then
    raise exception 'Middle initial must be one letter.';
  end if;

  v_legal_name := trim(concat_ws(' ', trim(p_signer_first_name), v_middle, trim(p_signer_last_name)));

  if p_signature_method = 'typed' then
    if nullif(trim(p_typed_signature_name), '') is null then
      raise exception 'Typed signature is required.';
    end if;
    v_typed_normalized := lower(regexp_replace(regexp_replace(trim(p_typed_signature_name), '\\.', '', 'g'), '\\s+', ' ', 'g'));
    v_legal_normalized := lower(regexp_replace(regexp_replace(v_legal_name, '\\.', '', 'g'), '\\s+', ' ', 'g'));
    if v_typed_normalized <> v_legal_normalized then
      raise exception 'Typed signature must match the participant legal name.';
    end if;
  elsif nullif(trim(p_drawn_signature_storage_path), '') is null then
    raise exception 'Drawn signature is required.';
  end if;

  if coalesce(p_has_minors,false) then
    if jsonb_typeof(coalesce(p_minors,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_minors,'[]'::jsonb)) = 0 then
      raise exception 'At least one minor participant is required.';
    end if;
    if nullif(trim(p_minor_ack_html), '') is null then
      raise exception 'Minor acknowledgment snapshot is required.';
    end if;
  end if;

  insert into public.epic_waiver_signatures (
    waiver_session_id,
    operational_reservation_id,
    confirmation_code,
    signer_first_name,
    signer_middle_initial,
    signer_last_name,
    signer_email,
    signer_phone,
    signer_dob,
    is_adult,
    signature_method,
    typed_signature_name,
    drawn_signature_storage_path,
    acknowledged_terms,
    acknowledged_minor_authority,
    waiver_template_id,
    waiver_template_version,
    signer_ip_address,
    signer_user_agent,
    electronic_signature_consent,
    electronic_signature_consent_text,
    electronic_signature_consent_version,
    business_line,
    will_drive,
    rental_role,
    rental_responsibility_scope,
    rental_vehicle_coverage_count,
    rental_vehicle_count_at_signing,
    signed_agreement_html,
    signed_minor_ack_html,
    agreement_content_version
  ) values (
    v_session.id,
    v_session.operational_reservation_id,
    p_confirmation_code,
    trim(p_signer_first_name),
    v_middle,
    trim(p_signer_last_name),
    trim(p_signer_email),
    nullif(trim(p_signer_phone), ''),
    p_signer_dob,
    true,
    p_signature_method,
    case when p_signature_method = 'typed' then trim(p_typed_signature_name) else null end,
    case when p_signature_method = 'drawn' then trim(p_drawn_signature_storage_path) else null end,
    true,
    coalesce(p_has_minors,false),
    v_session.waiver_template_id,
    v_session.template_version,
    case when nullif(trim(p_signer_ip_address), '') is not null then trim(p_signer_ip_address)::inet else null end,
    nullif(trim(p_signer_user_agent), ''),
    true,
    'By checking the "I AGREE" box and signing electronically below, I expressly consent to conduct this transaction electronically. I agree that my electronic signature, whether created by touchscreen signature or typed name, is intended by me to have the same legal validity, enforceability, and binding effect as my handwritten signature on a paper agreement.',
    'v2.0',
    'rental',
    (p_rental_role = 'driver'),
    p_rental_role,
    null,
    null,
    null,
    p_agreement_html,
    case when coalesce(p_has_minors,false) then p_minor_ack_html else null end,
    p_agreement_content_version
  ) returning id into v_signature_id;

  if coalesce(p_has_minors,false) then
    for v_minor in select * from jsonb_array_elements(p_minors)
    loop
      if nullif(trim(v_minor->>'firstName'), '') is null
         or nullif(trim(v_minor->>'lastName'), '') is null
         or nullif(trim(v_minor->>'dob'), '') is null
         or nullif(trim(v_minor->>'relationship'), '') is null then
        raise exception 'Each minor participant requires first name, last name, date of birth, and relationship.';
      end if;

      insert into public.epic_waiver_minors (
        adult_signature_id,
        waiver_session_id,
        operational_reservation_id,
        confirmation_code,
        minor_first_name,
        minor_last_name,
        minor_full_name,
        minor_dob,
        relationship_to_signer
      ) values (
        v_signature_id,
        v_session.id,
        v_session.operational_reservation_id,
        p_confirmation_code,
        trim(v_minor->>'firstName'),
        trim(v_minor->>'lastName'),
        trim(concat_ws(' ', v_minor->>'firstName', v_minor->>'lastName')),
        (v_minor->>'dob')::date,
        trim(v_minor->>'relationship')
      );
      v_minor_count := v_minor_count + 1;
    end loop;
  end if;

  update public.epic_waiver_sessions
  set adult_signature_count = adult_signature_count + 1,
      minor_covered_count = minor_covered_count + v_minor_count,
      covered_participant_count = covered_participant_count + 1 + v_minor_count,
      updated_at = now()
  where id = v_session.id;

  return query
  select
    v_signature_id,
    v_session.id,
    p_confirmation_code,
    s.adult_signature_count,
    s.minor_covered_count,
    s.covered_participant_count,
    p_rental_role
  from public.epic_waiver_sessions s
  where s.id = v_session.id;
end;
$function$;
