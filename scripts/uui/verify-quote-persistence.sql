BEGIN;
CREATE TEMP TABLE quote_test(id uuid,total bigint); GRANT ALL ON quote_test TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','0d0fa277-0c03-43db-b5dc-c81a78452a6c',true);
DO $$ DECLARE saved jsonb; recalculated jsonb; qid uuid; BEGIN
saved:=public.save_epic_sales_quote_v6(null,'Preview quote regression',null,null,'2026-11-20','2026-11-22','[{"experienceId":"990002","tickets":[{"ticketTypeId":"990021","quantity":1}]}]');
qid:=(saved->>'quote_id')::uuid;
recalculated:=public.recalculate_epic_sales_quote_financials(qid);
IF (recalculated->>'total_cents')::bigint<>22641 THEN RAISE EXCEPTION 'Initial total mismatch'; END IF;
saved:=public.save_epic_sales_quote_v6(qid,'Preview quote regression edited',null,null,'2026-11-20','2026-11-22','[{"experienceId":"990002","tickets":[{"ticketTypeId":"990021","quantity":2}]}]');
IF (saved->>'quote_id')::uuid<>qid THEN RAISE EXCEPTION 'Update changed quote identity'; END IF;
recalculated:=public.recalculate_epic_sales_quote_financials(qid);
IF (recalculated->>'total_cents')::bigint<>45282 THEN RAISE EXCEPTION 'Updated total mismatch'; END IF;
INSERT INTO quote_test VALUES(qid,45282);
END $$;
SELECT set_config('request.jwt.claim.sub','f24dc053-b9fe-4c8c-864b-4705f2fd940b',true);
DO $$ BEGIN
BEGIN PERFORM public.save_epic_sales_quote_v6(); RAISE EXCEPTION 'Workstation allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Signed-in sales rep required' THEN RAISE; END IF; END;
BEGIN PERFORM public.recalculate_epic_sales_quote_financials((SELECT id FROM quote_test)); RAISE EXCEPTION 'Workstation allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Signed-in sales rep required' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ DECLARE d jsonb; BEGIN
d:=public.get_epic_sales_quote_detail((SELECT id FROM quote_test));
IF d->'quote'->>'customer_name'<>'Preview quote regression edited' OR (d->'activities'->0->'items'->0->>'quantity')::int<>2 OR d->'quote'->>'created_by_profile_id'<>'0d0fa277-0c03-43db-b5dc-c81a78452a6c' THEN RAISE EXCEPTION 'Reopen/attribution mismatch'; END IF;
IF has_function_privilege('anon','public.save_epic_sales_quote_v6(uuid,text,text,text,date,date,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.get_epic_sales_quote_detail(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Unsafe privilege'; END IF;
END $$;
ROLLBACK;
SELECT 'create, recalculate, edit same quote, reopen quantity and employee attribution passed; workstation denied; legacy readers server-only; fixtures rolled back' AS verification;
