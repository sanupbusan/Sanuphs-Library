param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [switch]$EnablePgCron
)

$ErrorActionPreference = 'Stop'

if (-not $DatabaseUrl) {
  $DatabaseUrl = 'postgres://postgres:postgres@localhost:5432/library'
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw 'psql was not found. Install PostgreSQL client tools and make sure psql is on PATH.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$initFile = Join-Path $repoRoot 'database/local-postgres-init.sql'
$migrationDir = Join-Path $repoRoot 'supabase/migrations'

Write-Host "Applying local PostgreSQL compatibility init..."
& psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $initFile
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Get-ChildItem -Path $migrationDir -Filter '*.sql' | Sort-Object Name | ForEach-Object {
  if (-not $EnablePgCron -and $_.Name -eq '20260612100000_schedule_annual_loan_reset.sql') {
    Write-Host "Skipping $($_.Name) because pg_cron is optional on local PostgreSQL."
  } else {
    Write-Host "Applying $($_.Name)..."
    & psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $_.FullName
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }
}

Write-Host 'Local PostgreSQL migrations completed.'
