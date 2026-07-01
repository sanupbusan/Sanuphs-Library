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

if ! command -v psql >/dev/null 2>&1; then
  echo "psql was not found. Install PostgreSQL client tools and make sure psql is on PATH." >&2
  exit 1
fi

if [[ -z "$database_url" ]]; then
  echo "DATABASE_URL is required. Set DATABASE_URL or pass --database-url." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
init_file="$repo_root/database/local-postgres-init.sql"
migration_dir="$repo_root/supabase/migrations"

if [[ ! -f "$init_file" ]]; then
  echo "Init SQL file was not found: $init_file" >&2
  exit 1
fi

if [[ ! -d "$migration_dir" ]]; then
  echo "Migration directory was not found: $migration_dir" >&2
  exit 1
fi

migration_count="$(find "$migration_dir" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')"
if [[ "$migration_count" -eq 0 ]]; then
  echo "No migration SQL files found in: $migration_dir" >&2
  exit 1
fi

echo "Checking PostgreSQL connection and required compatibility roles..."
connection_info="$(
  psql "$database_url" -v ON_ERROR_STOP=1 -At -F $'\t' -c "
    select
      current_database(),
      current_user,
      coalesce((select rolsuper or rolcreaterole from pg_roles where rolname = current_user), false),
      exists(select 1 from pg_roles where rolname = 'anon'),
      exists(select 1 from pg_roles where rolname = 'authenticated');
  "
)"

IFS=$'\t' read -r current_database current_user can_create_roles has_anon_role has_authenticated_role <<< "$connection_info"

echo "Connected to database '$current_database' as '$current_user'."

if [[ "$has_anon_role" != "t" || "$has_authenticated_role" != "t" ]]; then
  if [[ "$can_create_roles" != "t" ]]; then
    cat >&2 <<EOF
Missing required PostgreSQL roles: anon/authenticated.
The current user '$current_user' cannot create roles.

Run these once with a PostgreSQL superuser, then rerun this migration script:

  psql -U postgres -d "$current_database"
  create role anon;
  create role authenticated;
  \\q

EOF
    exit 1
  fi
fi

echo "Applying local PostgreSQL compatibility init..."
psql "$database_url" -v ON_ERROR_STOP=1 -f "$init_file"

applied_count=0
skipped_count=0
echo "Found $migration_count migration SQL files."

while IFS= read -r -d '' migration_file; do
  migration_name="$(basename "$migration_file")"

  if [[ "$enable_pg_cron" != "true" && "$migration_name" == "20260612100000_schedule_annual_loan_reset.sql" ]]; then
    echo "Skipping $migration_name because pg_cron is optional on local PostgreSQL."
    skipped_count=$((skipped_count + 1))
    continue
  fi

  echo "Applying $migration_name..."
  psql "$database_url" -v ON_ERROR_STOP=1 -f "$migration_file"
  applied_count=$((applied_count + 1))
done < <(find "$migration_dir" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

echo "Applied $applied_count migration SQL files. Skipped $skipped_count."

missing_functions="$(
  psql "$database_url" -v ON_ERROR_STOP=1 -At -c "
    with expected(proname) as (
      values
        ('search_books'),
        ('lookup_student_for_loan'),
        ('create_public_loan'),
        ('get_returnable_loan_by_school_book_code'),
        ('return_loans_by_school_book_codes')
    )
    select expected.proname
    from expected
    where not exists (
      select 1
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and pg_proc.proname = expected.proname
    )
    order by expected.proname;
  "
)"

if [[ -n "$missing_functions" ]]; then
  echo "Migration verification failed. Missing public functions:" >&2
  echo "$missing_functions" >&2
  exit 1
fi

echo "Migration verification passed. Required public functions exist."
echo "Local PostgreSQL migrations completed."
