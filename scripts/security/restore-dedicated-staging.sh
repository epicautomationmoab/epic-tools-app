#!/usr/bin/env bash
set -euo pipefail
# Import a schema-only Epic Tools snapshot into the dedicated staging DB ONLY.
# Not a production script. Supply STAGING_DB_URI privately via environment.
SOURCE="${1:-.local-staging/public-schema.sql}"
EXPECTED_REF="cchsrkhpvvrvcuepkqdu"
if [[ ! -f "$SOURCE" ]]; then echo "Schema export missing: $SOURCE" >&2; exit 2; fi
if [[ -z "${STAGING_DB_URI:-}" ]]; then echo "STAGING_DB_URI must be configured securely" >&2; exit 2; fi
if [[ "$STAGING_DB_URI" != *"$EXPECTED_REF"* || "$STAGING_DB_URI" == *"kbuxcvqzicnydqllyong"* || "$STAGING_DB_URI" == *"wppzfrtvteldslxmpbas"* ]]; then
  echo "REFUSED: connection string is not for approved Epic Tools staging project" >&2; exit 3
fi
if grep -Eq '^(COPY .* FROM stdin;|INSERT INTO )' "$SOURCE"; then
  echo "REFUSED: file contains table-data statements" >&2; exit 4
fi
command -v psql >/dev/null || { echo "PostgreSQL client required" >&2; exit 2; }
# Confirm the session is not accidentally connected to Epic Tools production.
# The ref checked above is a safeguard, not proof of database identity.
# Additionally require an empty staging target before proceeding.
OBJECTS="$(psql "$STAGING_DB_URI" -XAtqc "select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') + (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e')")"
if [[ "$OBJECTS" != "0" ]]; then echo "REFUSED: staging public schema already contains $OBJECTS application objects" >&2; exit 5; fi
# Fresh Supabase projects already create the public schema. Drop it only on the
# confirmed empty staging database within the same transaction as restoration.
# The schema export contains CREATE SCHEMA public, so otherwise restore fails.
echo "Restoring schema only to dedicated staging database."
{ printf "DROP SCHEMA IF EXISTS public CASCADE;\\n"; cat "$SOURCE"; } | psql "$STAGING_DB_URI" -X -v ON_ERROR_STOP=1 -1
echo "Schema restore completed; verify object counts and policies before enabling applications."
