BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','0d0fa277-0c03-43db-b5dc-c81a78452a6c',true);
DO $$ DECLARE n public.epic_unified_notes; BEGIN
 SELECT * INTO n FROM public.epic_unified_notes_add('UUI-NOTE-CHECK','Synthetic shared-note verification',false);
 PERFORM set_config('uui.test_note_id',n.note_id::text,true);
 IF n.author_name <> 'Team Test' OR n.visible_in_readiness THEN RAISE EXCEPTION 'Incorrect note identity/visibility'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.epic_unified_notes_for_reservations(ARRAY['UUI-NOTE-CHECK']) WHERE note_id=n.note_id) THEN RAISE EXCEPTION 'Read failed'; END IF;
 PERFORM public.epic_unified_notes_set_readiness(n.note_id,true);
 BEGIN PERFORM 1 FROM public.epic_unified_note_audit; RAISE EXCEPTION 'Audit exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.epic_unified_notes SET author_name='Forged' WHERE note_id=n.note_id; RAISE EXCEPTION 'Direct note write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','f24dc053-b9fe-4c8c-864b-4705f2fd940b',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.epic_unified_notes_for_reservations(ARRAY['UUI-NOTE-CHECK'])) THEN RAISE EXCEPTION 'Workstation read allowed'; END IF;
 BEGIN PERFORM public.epic_unified_notes_add('UUI-NOTE-CHECK','Denied',false); RAISE EXCEPTION 'Workstation write allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Employee login required' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.epic_unified_note_audit WHERE note_id=current_setting('uui.test_note_id')::uuid)<>2 THEN RAISE EXCEPTION 'Missing audit'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.epic_unified_note_audit WHERE note_id=current_setting('uui.test_note_id')::uuid AND action='UPDATE' AND before_value->>'visible_in_readiness'='false' AND after_value->>'visible_in_readiness'='true' AND actor_profile_id='0d0fa277-0c03-43db-b5dc-c81a78452a6c') THEN RAISE EXCEPTION 'Incorrect audit'; END IF;
 IF has_function_privilege('anon','public.epic_unified_notes_add(text,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution allowed'; END IF;
END $$;
ROLLBACK;