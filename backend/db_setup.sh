#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# db_setup.sh — Bootstrap or reset the local PostgreSQL DB
# Usage:  ./db_setup.sh          (first time / normal)
#         ./db_setup.sh --reset  (drop & recreate everything)
# ─────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

# Ensure Docker binary is on PATH (macOS Docker Desktop)
if ! command -v docker &>/dev/null; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

DB_CONTAINER="fuelgood-postgres"
DB_USER="fuelgood"
DB_PASSWORD="fuelgood_local"
PRIMARY_DB="fuelgood"
LEGACY_DB="fuelgood"
RESET_DB=false
RUN_BACKUP=true
RUN_SEED=true
RUN_EMBEDDINGS=false

for arg in "$@"; do
  case "$arg" in
    --reset) RESET_DB=true ;;
    --skip-backup) RUN_BACKUP=false ;;
    --skip-seed) RUN_SEED=false ;;
    --backfill-embeddings) RUN_EMBEDDINGS=true ;;
  esac
done

ensure_db() {
  local db_name="$1"
  local exists
  exists=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" 2>/dev/null | tr -d '[:space:]')
  if [[ "$exists" != "1" ]]; then
    echo "🛠  Creating PostgreSQL database '${db_name}'..."
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${db_name};" > /dev/null
  fi
}

# ── 1. Start Docker Compose ────────────────────────────
echo "🐘 Starting PostgreSQL via Docker Compose..."
docker compose -f ../docker-compose.yml up -d

# Wait for DB to accept connections
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  docker exec "$DB_CONTAINER" pg_isready -U fuelgood > /dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB_CONTAINER" pg_isready -U fuelgood > /dev/null 2>&1 || {
  echo "❌ PostgreSQL did not start in time"; exit 1;
}
ensure_db "$PRIMARY_DB"
ensure_db "$LEGACY_DB"
echo "✅ PostgreSQL is ready"

# ── 2. Optional reset ──────────────────────────────────
if [[ "$RUN_BACKUP" == true ]]; then
  ./scripts/backup_local_db.sh
fi

if [[ "$RESET_DB" == true ]]; then
  echo "🗑  Resetting database..."
  for db_name in "$PRIMARY_DB" "$LEGACY_DB"; do
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$db_name" -c \
      "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  done
  echo "✅ Database reset"
fi

# ── 3. Activate venv & run migrations ──────────────────
if [[ -f "../.venv311/bin/activate" ]]; then
  source "../.venv311/bin/activate"
elif [[ -f "../.venv/bin/activate" ]]; then
  source "../.venv/bin/activate"
fi

echo "📦 Running Alembic migrations..."
PYTHONPATH=. alembic upgrade head
LEGACY_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${LEGACY_DB}"
if [[ "${DATABASE_URL:-}" != "$LEGACY_DATABASE_URL" ]]; then
  PYTHONPATH=. DATABASE_URL="$LEGACY_DATABASE_URL" alembic upgrade head
fi
python - <<'PY'
from sqlalchemy import create_engine, text
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url)

with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    checks = {
        "pgvector extension": "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
        "embedding column": (
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'recipe_embeddings' AND column_name = 'embedding'"
        ),
        "embedding index": (
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'recipe_embeddings' AND indexdef ILIKE '%embedding%'"
        ),
    }
    for label, query in checks.items():
        if not conn.execute(text(query)).scalar():
            raise SystemExit(f"Missing required database feature: {label}")
PY

# ── 4. Seed data ───────────────────────────────────────
if [[ "$RUN_SEED" == true ]]; then
  echo "🌱 Seeding database..."
  python seed_db.py 2>/dev/null || echo "  (seed_db.py skipped or not needed)"
fi

if [[ "$RUN_EMBEDDINGS" == true ]]; then
  echo "🧠 Backfilling recipe embeddings..."
  python scripts/backfill_recipe_embeddings.py
fi

echo ""
echo "🎉 Local database is ready!"
echo "   Connection: postgresql://fuelgood:fuelgood_local@localhost:5432/fuelgood"
