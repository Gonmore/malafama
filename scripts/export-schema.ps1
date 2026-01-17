Param(
  [string]$DB_HOST = "localhost",
  [int]$DB_PORT = 5432,
  [string]$DB_NAME = "malafama",
  [string]$DB_USER = "postgres",
  [string]$DB_PASSWORD = "",
  [string]$OUT_FILE = "database/schema.sql"
)

if ([string]::IsNullOrWhiteSpace($DB_PASSWORD)) {
  Write-Error "DB_PASSWORD is required"
  exit 1
}

$outDir = Split-Path -Parent $OUT_FILE
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

# Uses a postgres image to run pg_dump so you don't need pg_dump installed locally.
# Note: On Windows, host networking is not supported the same way as Linux.
# Prefer running this against a reachable host/IP, or run it inside the same Docker network.

docker run --rm `
  -e PGPASSWORD=$DB_PASSWORD `
  postgres:16-alpine `
  pg_dump `
    -h $DB_HOST `
    -p $DB_PORT `
    -U $DB_USER `
    -d $DB_NAME `
    --schema-only `
    --no-owner `
    --no-privileges `
    --if-exists `
    --clean `
  | Out-File -FilePath $OUT_FILE -Encoding utf8

Write-Host "Wrote schema to $OUT_FILE"