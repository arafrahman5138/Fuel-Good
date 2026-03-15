#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

DB_CONTAINER="${DB_CONTAINER:-realfood-postgres}"
DB_NAME="${DB_NAME:-fuelgood}"
DB_USER="${DB_USER:-realfood}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="$BACKUP_DIR/local-db-$timestamp.sql"

echo "Creating backup at $outfile"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$outfile"

if [[ ! -s "$outfile" ]]; then
  echo "Backup failed: $outfile is empty" >&2
  exit 1
fi

echo "Backup complete: $outfile"
