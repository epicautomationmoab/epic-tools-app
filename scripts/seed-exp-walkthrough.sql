-- Isolated staging only. Never overwrite a walkthrough already used by the owner.
begin;
set local session_replication_role=replica;
do $seed$
declare item record; cols text; vals text; rowdata jsonb;
begin
 if exists(select 1 from public.operational_reservations where confirmation_code='EXP-WALKTHROUGH-20261027') then raise exception 'Walkthrough exists; refusing to reset progress'; end if;
 for item in select * from (values
 ('operational_reservations','id','ee100000-0000-4000-8000-000000000001',jsonb_build_object('id','ee200000-0000-4000-8000-000000000001','confirmation_code','EXP-WALKTHROUGH-20261027','tripworks_trip_id','EXP-WALKTHROUGH-20261027','guest_portal_token','ee200000-0000-4000-8000-000000000002','customer_name','EXP Walkthrough Party','customer_email','walkthrough@example.invalid','customer_phone','+12025550983','start_time','2026-10-28T16:30:00Z','created_at',now(),'updated_at',now(),'internal_notes','Synthetic owner walkthrough; no guest contact')),
 ('guest_readiness_operational','readiness_id','ee100000-0000-4000-8000-000000000003',jsonb_build_object('readiness_id','ee200000-0000-4000-8000-000000000003','confirmation_code','EXP-WALKTHROUGH-20261027','customer_name','EXP Walkthrough Party','customer_email',null,'customer_phone','+12025550983','visit_start_time','2026-10-28T10:30:00','product_display_name','EXP Walkthrough RZR','epic_document_received_count',0,'epic_document_expected_count',3,'mpwr_document_received_count',3,'mpwr_document_expected_count',3,'mpwr_confirmation_number','EXP-SIM-WALKTHROUGH','ohv_certificate_uploaded',false,'last_refreshed_at',now(),'notes','Synthetic owner walkthrough; Polaris simulated')),
 ('epic_waiver_sessions','id','ee100000-0000-4000-8000-000000000004',jsonb_build_object('id','ee200000-0000-4000-8000-000000000004','operational_reservation_id','ee200000-0000-4000-8000-000000000001','confirmation_code','EXP-WALKTHROUGH-20261027','public_token','exp-walkthrough-waiver-20261027','expected_participant_count',3,'covered_participant_count',0,'adult_signature_count',0,'minor_covered_count',0,'created_at',now(),'updated_at',now(),'expires_at',now()+interval '7 days'))
 ) as fixtures(table_name,key_name,source_id,patch)
 loop
  execute format('select to_jsonb(r)||$1 from public.%I r where %I::text=$2',item.table_name,item.key_name) into rowdata using item.patch,item.source_id;
  if rowdata is null then raise exception 'Missing synthetic source'; end if;
  select string_agg(quote_ident(attname),',' order by attnum),string_agg('x.'||quote_ident(attname),',' order by attnum) into cols,vals from pg_attribute where attrelid=format('public.%I',item.table_name)::regclass and attnum>0 and not attisdropped and attgenerated='';
  execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) x',item.table_name,cols,vals,item.table_name) using rowdata;
 end loop;
end $seed$;
insert into public.scout_mpwr_waivers(readiness_id,confirmation_code,mpwr_confirmation_number,rider_name,waiver_url,last_verified_at,is_minor,is_passenger)
select 'ee200000-0000-4000-8000-000000000003','EXP-WALKTHROUGH-20261027','EXP-SIM-WALKTHROUGH',name,'https://epic-tools-exp-staging.vercel.app/staging/walkthrough#simulated-polaris',now(),false,false from unnest(array['Jordan Trailtest','Morgan Trailtest','Taylor Trailtest']) name;
insert into public.portal_patti_store_visits(store_visit_id,store_visit_key,confirmation_code,operational_reservation_id,customer_name,visit_status,business_line,booking_type,product_display_name,visit_start_time,expected_guest_count,total_vehicle_count,grouping_method,grouping_confidence,amount_due_cents) values('EXP-WALKTHROUGH-VISIT-20261027','EXP-WALKTHROUGH-VISIT-20261027','EXP-WALKTHROUGH-20261027','ee200000-0000-4000-8000-000000000001','EXP Walkthrough Party','active','rental','rental','EXP Walkthrough RZR','2026-10-28 16:30:00+00',3,2,'synthetic_staging','high',0);
update public.epic_waiver_sessions set store_visit_id='EXP-WALKTHROUGH-VISIT-20261027' where id='ee200000-0000-4000-8000-000000000004';
update public.guest_readiness_operational set source_store_visit_id='EXP-WALKTHROUGH-VISIT-20261027' where readiness_id='ee200000-0000-4000-8000-000000000003';
commit;
