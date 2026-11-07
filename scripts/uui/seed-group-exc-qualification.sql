-- Run ONLY in Epic UUI Development (jgpihdpcdlqugmqanzfj).
-- Entirely fictional evidence, not legal signatures or real certificates.
-- No orientation/video/assessment credit is seeded. Never reset used progress.
begin;
set local session_replication_role=replica;
do $$ begin
 if exists(select 1 from operational_reservations where confirmation_code='UUI-EXC-GROUP-TEST') then
 raise exception 'Group fixture already exists; refusing to overwrite'; end if;
end $$;
insert into operational_reservations(id,tripworks_trip_id,confirmation_code,customer_name,customer_email,customer_phone,guest_portal_token,business_line,start_time,internal_notes)
values('ee300000-0000-4000-8000-000000000001','UUI-EXC-GROUP-TEST','UUI-EXC-GROUP-TEST','Synthetic EXC Group','exc-group@example.invalid','+12025550731','ee300000-0000-4000-8000-000000000002','rental','2026-11-06 09:00:00+00','Fictional isolated qualification fixture. No external booking or messages.');
insert into portal_patti_store_visits(store_visit_id,store_visit_key,confirmation_code,operational_reservation_id,customer_name,visit_status,business_line,booking_type,product_display_name,visit_start_time,expected_guest_count,total_vehicle_count,grouping_method,grouping_confidence,amount_due_cents)
values('uui-exc-group-test','uui-exc-group-test','UUI-EXC-GROUP-TEST','ee300000-0000-4000-8000-000000000001','Synthetic EXC Group','active','rental','rental','Synthetic two-vehicle group','2026-11-06 09:00:00+00',4,2,'synthetic_staging','high',0);
insert into guest_readiness_operational(readiness_id,source_store_visit_id,confirmation_code,customer_name,customer_email,customer_phone,business_line,product_display_name,visit_start_time,expected_guest_count,total_vehicle_count,epic_document_received_count,epic_document_expected_count,mpwr_document_received_count,mpwr_document_expected_count,ohv_required,ohv_certificate_uploaded,amount_due_cents,notes)
values('ee300000-0000-4000-8000-000000000003','uui-exc-group-test','UUI-EXC-GROUP-TEST','Synthetic EXC Group','exc-group@example.invalid','+12025550731','rental','Synthetic two-vehicle group','2026-11-06 09:00:00',4,2,4,4,4,4,true,false,0,'Fictional group qualification test. No real legal or driving evidence.');
insert into epic_waiver_sessions(id,operational_reservation_id,confirmation_code,public_token,business_line,store_visit_id,expected_participant_count,rental_vehicle_count,expires_at)
values('ee300000-0000-4000-8000-000000000004','ee300000-0000-4000-8000-000000000001','UUI-EXC-GROUP-TEST','uui-exc-group-synthetic-only','rental','uui-exc-group-test',4,2,now()+interval '7 days');
insert into epic_waiver_signatures(id,waiver_session_id,confirmation_code,signer_first_name,signer_last_name,signer_email,signer_dob,signature_method,typed_signature_name,business_line,rental_role,acknowledged_terms,electronic_signature_consent,acknowledged_minor_authority,signed_minor_ack_html,agreement_content_version,signed_at,signer_user_agent)
select ('ee300000-0000-4000-8000-00000000000'||n)::uuid,'ee300000-0000-4000-8000-000000000004','UUI-EXC-GROUP-TEST',name,'Synthetic',lower(name)||'@example.invalid','1988-01-01','typed','SYNTHETIC FIXTURE NOT A SIGNATURE','rental',role,true,true,n=5,case when n=5 then 'SYNTHETIC TEST FIXTURE — NOT A LEGAL ACKNOWLEDGMENT' else null end,'rental-v2-synthetic-test',now(),'Isolated synthetic database fixture'
from (values(5,'Jordan','driver'),(6,'Morgan','driver'),(7,'Taylor','passenger')) s(n,name,role);
insert into epic_waiver_minors(adult_signature_id,waiver_session_id,confirmation_code,minor_first_name,minor_last_name,minor_dob,relationship_to_signer)
values('ee300000-0000-4000-8000-000000000005','ee300000-0000-4000-8000-000000000004','UUI-EXC-GROUP-TEST','Casey','Synthetic','2016-01-01','Synthetic parent');
insert into scout_mpwr_waivers(readiness_id,confirmation_code,mpwr_confirmation_number,rider_name,waiver_url,last_verified_at,is_minor,is_passenger)
select 'ee300000-0000-4000-8000-000000000003','UUI-EXC-GROUP-TEST','SYNTHETIC-ONLY',name||' Synthetic','https://example.invalid/synthetic-not-a-waiver',now(),name='Casey',name='Taylor'
from unnest(array['Jordan','Morgan','Taylor','Casey']) name;
commit;
