-- Run against an isolated staging database, never mutate production.
-- A successful empty result means the required foundation objects exist.
with required(object_name) as (
 values ('epic_waiver_signatures'),('guest_readiness_operational'),('epic_unified_notes')
)
select required.object_name as missing_public_table
from required
where not exists (
 select 1 from pg_class c
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname=required.object_name
   and c.relkind in ('r','p')
);

-- Diagnostic count of schema objects; compare with the verified production baseline.
select count(*) filter (where c.relkind in ('r','p')) as public_base_tables,
       count(*) filter (where c.relkind='v') as public_views
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public';
