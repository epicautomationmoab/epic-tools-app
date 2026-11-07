-- Preserve existing follow-up rules, but reject NULL outcomes explicitly.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.epic_followup_action(uuid,text,text,text,timestamptz,uuid)'::regprocedure);
 definition:=replace(definition,'if p_outcome not in','if p_outcome is null or p_outcome not in');
 execute definition;
end $$;
