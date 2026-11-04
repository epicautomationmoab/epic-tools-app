CREATE TABLE public.epic_unified_note_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 note_id uuid NOT NULL,
 actor_profile_id uuid,
 actor_name text NOT NULL,
 action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
 before_value jsonb,
 after_value jsonb
);
ALTER TABLE public.epic_unified_note_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.epic_unified_note_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.epic_unified_note_audit TO service_role;
CREATE INDEX epic_unified_note_audit_created_idx ON public.epic_unified_note_audit(created_at DESC);
CREATE OR REPLACE FUNCTION public.record_epic_unified_note_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id uuid; actor_label text;
BEGIN
 SELECT p.id,p.display_name INTO actor_id,actor_label FROM public.team_profiles p
 WHERE p.user_id=auth.uid() AND p.active AND p.role<>'workstation' LIMIT 1;
 INSERT INTO public.epic_unified_note_audit(note_id,actor_profile_id,actor_name,action,before_value,after_value)
 VALUES (coalesce(NEW.note_id,OLD.note_id),actor_id,coalesce(actor_label,'Unknown / system'),TG_OP,
 CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
 CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
 RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.record_epic_unified_note_audit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER epic_unified_note_audit AFTER INSERT OR UPDATE OR DELETE ON public.epic_unified_notes
FOR EACH ROW EXECUTE FUNCTION public.record_epic_unified_note_audit();
REVOKE EXECUTE ON FUNCTION public.epic_unified_notes_for_reservations(text[]),
 public.epic_unified_notes_add(text,text,boolean), public.epic_unified_notes_set_readiness(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.epic_unified_notes_for_reservations(text[]),
 public.epic_unified_notes_add(text,text,boolean), public.epic_unified_notes_set_readiness(uuid,boolean) TO authenticated;
