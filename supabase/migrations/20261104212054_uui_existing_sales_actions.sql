-- Restore existing employee-guarded internal Sales actions in UUI only.
do $$
declare sig text;
begin
 foreach sig in array array[
 'public.epic_followup_create(uuid,uuid,text,text,timestamptz,text,uuid)',
 'public.epic_followup_action(uuid,text,text,text,timestamptz,uuid)',
 'public.epic_followup_dismiss(uuid)',
 'public.epic_sales_claim_lead(uuid,boolean)',
 'public.epic_sales_activate_lead(uuid)',
 'public.epic_sales_release_claim(uuid,text,text)',
 'public.epic_sales_close_lead(uuid,text,text,text)',
 'public.epic_sales_add_note(uuid,text)',
 'public.epic_sales_edit_note(uuid,text)'
 ] loop
 execute 'revoke all on function '||sig||' from public, anon';
 execute 'grant execute on function '||sig||' to authenticated';
 end loop;
end $$;
