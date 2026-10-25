#!/usr/bin/env bash
set -euo pipefail

# Read-only production schema export. Never exports table rows.
# Requires a direct, read-only-capable PostgreSQL connection in PG* environment
# variables or PGDATABASE connection string. Do not store credentials in Git.
if [[ -z "${PGDATABASE:-}" ]]; then
  echo "PGDATABASE must be set to an approved database connection URI." >&2
  exit 2
fi
command -v pg_dump >/dev/null || { echo "PostgreSQL pg_dump is required." >&2; exit 2; }
mkdir -p "${1:-./staging-schema-export}"
OUT="${1:-./staging-schema-export}"
umask 077
# Separate pre/post sections are not needed: plain pg_dump orders dependencies.
# Retain ACL and RLS policy definitions for least-privilege staging verification.
pg_dump --dbname="$PGDATABASE" --schema-only --schema=public --no-owner \
  --file="$OUT/public-schema.sql"
# Record object listings without customer rows.
pg_dump --dbname="$PGDATABASE" --schema-only --schema=public --section=pre-data \
  --no-owner --file="$OUT/public-predata.sql"
echo "Schema-only export written to $OUT; verify and sanitize before sharing or applying."
echo "DO NOT run this against a production destination or commit unreviewed dump files."
