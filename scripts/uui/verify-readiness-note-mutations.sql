BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','0d0fa277-0c03-43db-b5dc-c81a78452a6c',true);
DO $$ DECLARE original public.epic_unified_notes; edited public.epic_unified_notes; archived public.epic_unified_notes; BEGIN
 SELECT * INTO original FROM public.epic_readiness_note_add('PREVIEW-HISTORY-312','Readiness edit verification');
 PERFORM set_config('uui.test_note',original.note_id::text,true);
 IF original.source<>'readiness' OR NOT original.visible_in_readiness OR original.author_name<>'Team Test' THEN RAISE EXCEPTION 'Add failed'; END IF;
 SELECT * INTO edited FROM public.epic_readiness_note_change(original.note_id,original.updated_at,'Edited verification',false);
 IF edited.note_text<>'Edited verification' OR edited.updated_at<=original.updated_at THEN RAISE EXCEPTION 'Edit failed'; END IF;
 BEGIN PERFORM public.epic_readiness_note_change(original.note_id,original.updated_at,'Stale overwrite',false); RAISE EXCEPTION 'Stale edit accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.epic_readiness_note_change(original.note_id,original.updated_at,null,true); RAISE EXCEPTION 'Stale archive accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT * INTO archived FROM public.epic_readiness_note_change(edited.note_id,edited.updated_at,null,true);
 IF archived.archived_at IS NULL OR archived.note_text<>'Edited verification' THEN RAISE EXCEPTION 'Archive failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.epic_unified_notes_for_reservations(ARRAY['PREVIEW-HISTORY-312']) WHERE note_id=original.note_id) THEN RAISE EXCEPTION 'Archived note still visible'; END IF;
 BEGIN PERFORM public.epic_readiness_note_add('UUI-MISSING-RES','Invalid'); RAISE EXCEPTION 'Unknown reservation accepted'; EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','f24dc053-b9fe-4c8c-864b-4705f2fd940b',true);
DO $$ BEGIN
 BEGIN PERFORM public.epic_readiness_note_add('PREVIEW-HISTORY-312','Workstation'); RAISE EXCEPTION 'Workstation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.epic_readiness_note_change(current_setting('uui.test_note')::uuid,now(),'Workstation',false); RAISE EXCEPTION 'Workstation edit allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.epic_unified_note_audit WHERE note_id=current_setting('uui.test_note')::uuid)<>3 THEN RAISE EXCEPTION 'Incorrect successful action audit count'; END IF;
 IF EXISTS(SELECT 1 FROM public.epic_unified_note_audit WHERE note_id=current_setting('uui.test_note')::uuid AND actor_profile_id IS DISTINCT FROM '0d0fa277-0c03-43db-b5dc-c81a78452a6c'::uuid) THEN RAISE EXCEPTION 'Attribution failed'; END IF;
 IF has_function_privilege('anon','public.epic_readiness_note_change(uuid,timestamptz,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous access'; END IF;
END $$;
ROLLBACK;
