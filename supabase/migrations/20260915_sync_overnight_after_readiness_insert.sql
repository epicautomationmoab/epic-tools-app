create or replace function public.sync_readiness_overnight_after_readiness_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(new.source_store_visit_id), '') is not null then
    perform public.sync_readiness_overnight_for_store_visit(new.source_store_visit_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_readiness_overnight_after_readiness_change on public.guest_readiness_operational;
create trigger trg_sync_readiness_overnight_after_readiness_change
after insert or update of source_store_visit_id
on public.guest_readiness_operational
for each row
execute function public.sync_readiness_overnight_after_readiness_change();

select public.sync_readiness_overnight_for_store_visit(source_store_visit_id)
from public.guest_readiness_operational
where nullif(trim(source_store_visit_id), '') is not null;
