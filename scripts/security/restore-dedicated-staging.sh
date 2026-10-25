#!/usr/bin/env bash
set -euo pipefail
# Import a schema-only Epic Tools snapshot into the dedicated staging DB ONLY.
# Not a production script. Supply STAGING_DB_URI privately via environment.
SOURCE="${1:-.local-staging/public-schema.sql}"
EXPECTED_REF="cchsrkhpvvrvcuepkqdu"
if [[ ! -f "$SOURCE" ]]; then echo "Schema export missing: $SOURCE" >&2; exit 2; fi
if [[ -z "${STAGING_DB_URI:-}" ]]; then echo "STAGING_DB_URI must be configured securely" >&2; exit 2; fi
if [[ "$STAGING_DB_URI" != *"$EXPECTED_REF"* ]]; then
  echo "REFUSED: connection string is not for approved Epic Tools staging project" >&2; exit 3
fi
if grep -Eq '^(COPY .* FROM stdin;|INSERT INTO )' "$SOURCE"; then
  echo "REFUSED: file contains table-data statements" >&2; exit 4
fi
command -v psql >/dev/null || { echo "PostgreSQL client required" >&2; exit 2; }
ACTUAL_REF="$(psql "$STAGING_DB_URI" -XAtqc "select current_setting('app.settings.project_ref', true)" 2>/dev/null || true)"
# URL ref check above is necessary, but we additionally require an empty target.
TABLES="$(psql "$STAGING_DB_URI" -XAtqc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
if [[ "$TABLES" != "0" ]]; then echo "REFUSED: staging already contains $TABLES tables" >&2; exit 5; fi
echo "Restoring schema only to dedicated staging database."
psql "$STAGING_DB_URI" -X -v ON_ERROR_STOP=1 -1 -f "$SOURCE"
echo "Schema restore completed; verify object counts and policies before enabling applications."
