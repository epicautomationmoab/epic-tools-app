BEGIN; CREATE TEMP TABLE uui_checks(name text, role text, passed boolean, detail text); GRANT ALL ON uui_checks TO authenticated; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','64eb0331-d16a-4ab8-81a1-7aaefe578944',true);
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_callrail_sms_numbers('2025550102') x;
INSERT INTO uui_checks VALUES('c360_callrail_sms_numbers','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_callrail_sms_numbers','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_employee_call_origins(ARRAY[]::text[]) x;
INSERT INTO uui_checks VALUES('c360_employee_call_origins','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_employee_call_origins','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_inbound_caller_name('2025550102') x;
INSERT INTO uui_checks VALUES('c360_inbound_caller_name','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_inbound_caller_name','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_dismissed_ids() x;
INSERT INTO uui_checks VALUES('epic_followup_dismissed_ids','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_dismissed_ids','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_history('00000000-0000-0000-0000-000000000000') x;
INSERT INTO uui_checks VALUES('epic_followup_history','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_history','owner',SQLERRM='Follow-up not accessible',SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_list('mine',null) x;
INSERT INTO uui_checks VALUES('epic_followup_list','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_list','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_members() x;
INSERT INTO uui_checks VALUES('epic_followup_members','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_members','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_c360_linked_social_messages('00000000-0000-0000-0000-000000000000') x;
INSERT INTO uui_checks VALUES('get_c360_linked_social_messages','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_c360_linked_social_messages','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_c360_readiness_docs('TEST-MULTI-001') x;
INSERT INTO uui_checks VALUES('get_epic_c360_readiness_docs','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_c360_readiness_docs','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_cancellation_timeline(ARRAY['TEST-MULTI-001']) x;
INSERT INTO uui_checks VALUES('get_epic_cancellation_timeline','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_cancellation_timeline','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_inbound_call_sessions_for_phone('2025550102') x;
INSERT INTO uui_checks VALUES('get_epic_inbound_call_sessions_for_phone','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_inbound_call_sessions_for_phone','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_inbox_thread_notes('uui-verification-nonexistent') x;
INSERT INTO uui_checks VALUES('get_epic_inbox_thread_notes','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_inbox_thread_notes','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_outbound_calls_for_phone('2025550102') x;
INSERT INTO uui_checks VALUES('get_epic_outbound_calls_for_phone','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_outbound_calls_for_phone','owner',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_sales_activity() x;
INSERT INTO uui_checks VALUES('get_epic_sales_activity','owner',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_sales_activity','owner',false,SQLERRM); END $test$;
SELECT set_config('request.jwt.claim.sub','0d0fa277-0c03-43db-b5dc-c81a78452a6c',true);
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_callrail_sms_numbers('2025550102') x;
INSERT INTO uui_checks VALUES('c360_callrail_sms_numbers','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_callrail_sms_numbers','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_employee_call_origins(ARRAY[]::text[]) x;
INSERT INTO uui_checks VALUES('c360_employee_call_origins','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_employee_call_origins','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_inbound_caller_name('2025550102') x;
INSERT INTO uui_checks VALUES('c360_inbound_caller_name','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_inbound_caller_name','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_dismissed_ids() x;
INSERT INTO uui_checks VALUES('epic_followup_dismissed_ids','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_dismissed_ids','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_history('00000000-0000-0000-0000-000000000000') x;
INSERT INTO uui_checks VALUES('epic_followup_history','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_history','team',SQLERRM='Follow-up not accessible',SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_list('mine',null) x;
INSERT INTO uui_checks VALUES('epic_followup_list','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_list','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_members() x;
INSERT INTO uui_checks VALUES('epic_followup_members','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_members','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_c360_linked_social_messages('00000000-0000-0000-0000-000000000000') x;
INSERT INTO uui_checks VALUES('get_c360_linked_social_messages','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_c360_linked_social_messages','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_c360_readiness_docs('TEST-MULTI-001') x;
INSERT INTO uui_checks VALUES('get_epic_c360_readiness_docs','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_c360_readiness_docs','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_cancellation_timeline(ARRAY['TEST-MULTI-001']) x;
INSERT INTO uui_checks VALUES('get_epic_cancellation_timeline','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_cancellation_timeline','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_inbound_call_sessions_for_phone('2025550102') x;
INSERT INTO uui_checks VALUES('get_epic_inbound_call_sessions_for_phone','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_inbound_call_sessions_for_phone','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_inbox_thread_notes('uui-verification-nonexistent') x;
INSERT INTO uui_checks VALUES('get_epic_inbox_thread_notes','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_inbox_thread_notes','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_outbound_calls_for_phone('2025550102') x;
INSERT INTO uui_checks VALUES('get_epic_outbound_calls_for_phone','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_outbound_calls_for_phone','team',false,SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_sales_activity() x;
INSERT INTO uui_checks VALUES('get_epic_sales_activity','team',true,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_sales_activity','team',false,SQLERRM); END $test$;
SELECT set_config('request.jwt.claim.sub','f24dc053-b9fe-4c8c-864b-4705f2fd940b',true);
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_callrail_sms_numbers('2025550102') x;
INSERT INTO uui_checks VALUES('c360_callrail_sms_numbers','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_callrail_sms_numbers','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_employee_call_origins(ARRAY[]::text[]) x;
INSERT INTO uui_checks VALUES('c360_employee_call_origins','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_employee_call_origins','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.c360_inbound_caller_name('2025550102') x;
INSERT INTO uui_checks VALUES('c360_inbound_caller_name','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('c360_inbound_caller_name','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_dismissed_ids() x;
INSERT INTO uui_checks VALUES('epic_followup_dismissed_ids','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_dismissed_ids','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_history('00000000-0000-0000-0000-000000000000') x;
INSERT INTO uui_checks VALUES('epic_followup_history','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_history','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_list('mine',null) x;
INSERT INTO uui_checks VALUES('epic_followup_list','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_list','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.epic_followup_members() x;
INSERT INTO uui_checks VALUES('epic_followup_members','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('epic_followup_members','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_c360_linked_social_messages('00000000-0000-0000-0000-000000000000') x;
INSERT INTO uui_checks VALUES('get_c360_linked_social_messages','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_c360_linked_social_messages','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_c360_readiness_docs('TEST-MULTI-001') x;
INSERT INTO uui_checks VALUES('get_epic_c360_readiness_docs','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_c360_readiness_docs','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_cancellation_timeline(ARRAY['TEST-MULTI-001']) x;
INSERT INTO uui_checks VALUES('get_epic_cancellation_timeline','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_cancellation_timeline','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_inbound_call_sessions_for_phone('2025550102') x;
INSERT INTO uui_checks VALUES('get_epic_inbound_call_sessions_for_phone','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_inbound_call_sessions_for_phone','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_inbox_thread_notes('uui-verification-nonexistent') x;
INSERT INTO uui_checks VALUES('get_epic_inbox_thread_notes','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_inbox_thread_notes','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_outbound_calls_for_phone('2025550102') x;
INSERT INTO uui_checks VALUES('get_epic_outbound_calls_for_phone','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_outbound_calls_for_phone','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
DO $test$ DECLARE n int; v jsonb; BEGIN
SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM public.get_epic_sales_activity() x;
INSERT INTO uui_checks VALUES('get_epic_sales_activity','workstation',v='[]'::jsonb OR v='[null]'::jsonb OR v='[{}]'::jsonb,'returned');
EXCEPTION WHEN OTHERS THEN INSERT INTO uui_checks VALUES('get_epic_sales_activity','workstation',SQLERRM IN ('Employee login required','Unauthorized','Active Epic employee profile required','Active employee profile required'),SQLERRM); END $test$;
RESET ROLE; SELECT jsonb_build_object('passed',(select count(*) from uui_checks where passed),'total',(select count(*) from uui_checks),'failures',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from uui_checks c where not passed)) as verification; ROLLBACK;
