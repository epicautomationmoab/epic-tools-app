-- Isolated UUI: restore the imported finalizer's authenticated execution.
-- The function requires an active non-workstation profile derived from auth.uid().
-- Direct table grants and anonymous execution remain denied.
GRANT EXECUTE ON FUNCTION public.finalize_and_claim_epicc360_lead_sheet(uuid,jsonb,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_and_claim_epicc360_lead_sheet(uuid,jsonb,uuid) FROM anon, PUBLIC;
