CREATE OR REPLACE FUNCTION public.epic_readiness_note_add(p_confirmation text,p_note_text text)
RETURNS SETOF public.epic_unified_notes LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE employee_name text; code text:=upper(btrim(p_confirmation));
BEGIN
 SELECT display_name INTO employee_name FROM public.team_profiles WHERE user_id=auth.uid() AND active AND role<>'workstation' LIMIT 1;
 IF employee_name IS NULL THEN RAISE EXCEPTION 'Employee login required' USING ERRCODE='42501'; END IF;
 IF code IS NULL OR code !~ '^[A-Z0-9-]{3,25}$' OR p_note_text IS NULL OR btrim(p_note_text)='' OR length(p_note_text)>4000 THEN RAISE EXCEPTION 'Invalid reservation note' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.guest_readiness_with_handoff_v WHERE confirmation_code=code)
 AND NOT EXISTS(SELECT 1 FROM public.guest_readiness_history_search_v WHERE confirmation_code=code)
 THEN RAISE EXCEPTION 'Reservation not found' USING ERRCODE='P0002'; END IF;
 RETURN QUERY INSERT INTO public.epic_unified_notes(confirmation_code,note_text,note_scope,source,visible_in_readiness,author_name)
 VALUES(code,btrim(p_note_text),'reservation','readiness',true,employee_name) RETURNING *;
END $$;
CREATE OR REPLACE FUNCTION public.epic_readiness_note_change(p_note_id uuid,p_expected_updated_at timestamptz,p_note_text text,p_archive boolean)
RETURNS SETOF public.epic_unified_notes LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_note public.epic_unified_notes;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.team_profiles WHERE user_id=auth.uid() AND active AND role<>'workstation') THEN RAISE EXCEPTION 'Employee login required' USING ERRCODE='42501'; END IF;
 SELECT * INTO current_note FROM public.epic_unified_notes WHERE note_id=p_note_id AND archived_at IS NULL AND note_scope='reservation' AND source IN ('readiness','c360') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Note unavailable or read-only' USING ERRCODE='P0002'; END IF;
 IF p_expected_updated_at IS NULL OR current_note.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'This note changed since you opened it. Close and reopen the reservation before saving again.' USING ERRCODE='40001'; END IF;
 IF NOT coalesce(p_archive,false) AND (p_note_text IS NULL OR btrim(p_note_text)='' OR length(p_note_text)>4000) THEN RAISE EXCEPTION 'Note must contain 1 to 4000 characters' USING ERRCODE='22023'; END IF;
 RETURN QUERY UPDATE public.epic_unified_notes SET
 note_text=CASE WHEN p_archive THEN note_text ELSE btrim(p_note_text) END,
 archived_at=CASE WHEN p_archive THEN clock_timestamp() ELSE NULL END,
 updated_at=clock_timestamp()
 WHERE note_id=p_note_id RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.epic_readiness_note_add(text,text), public.epic_readiness_note_change(uuid,timestamptz,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.epic_readiness_note_add(text,text), public.epic_readiness_note_change(uuid,timestamptz,text,boolean) TO authenticated;
