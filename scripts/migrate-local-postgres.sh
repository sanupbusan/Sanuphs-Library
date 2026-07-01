#!/usr/bin/env bash
set -euo pipefail

database_url="${DATABASE_URL:-}"
enable_pg_cron="false"

usage() {
  cat <<'EOF'
Usage: ./scripts/migrate-local-postgres.sh [options]

Options:
  -d, --database-url URL   PostgreSQL connection URL. Defaults to DATABASE_URL.
      --enable-pg-cron    Also apply the optional pg_cron schedule migration.
  -h, --help              Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--database-url)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        exit 1
      fi
      database_url="$2"
      shift 2
      ;;
    --enable-pg-cron)
      enable_pg_cron="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$database_url" ]]; then
  database_url="postgres://postgres:postgres@localhost:5432/library"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql was not found. Install PostgreSQL client tools and make sure psql is on PATH." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
init_file="$repo_root/database/local-postgres-init.sql"
migration_dir="$repo_root/supabase/migrations"

echo "Applying local PostgreSQL compatibility init..."
psql "$database_url" -v ON_ERROR_STOP=1 -f "$init_file"

while IFS= read -r -d '' migration_file; do
  migration_name="$(basename "$migration_file")"

  if [[ "$enable_pg_cron" != "true" && "$migration_name" == "20260612100000_schedule_annual_loan_reset.sql" ]]; then
    echo "Skipping $migration_name because pg_cron is optional on local PostgreSQL."
    continue
  fi

  echo "Applying $migration_name..."
  psql "$database_url" -v ON_ERROR_STOP=1 -f "$migration_file"
done < <(find "$migration_dir" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

echo "Local PostgreSQL migrations completed."
