#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# ── Ensure PostgreSQL is running via Docker ──
DOCKER_BIN="${DOCKER_BIN:-docker}"
if ! command -v "$DOCKER_BIN" &>/dev/null; then
  # Docker Desktop on macOS puts the binary here
  DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
fi

if command -v "$DOCKER_BIN" &>/dev/null; then
  CONTAINER="realfood-postgres"
  echo "🐘 Starting PostgreSQL container..."
  "$DOCKER_BIN" compose -f ../docker-compose.yml up -d
  for i in $(seq 1 30); do
    "$DOCKER_BIN" exec "$CONTAINER" pg_isready -U realfood > /dev/null 2>&1 && break
    sleep 1
  done
  "$DOCKER_BIN" exec "$CONTAINER" pg_isready -U realfood > /dev/null 2>&1
  echo "✅ PostgreSQL is ready"
else
  echo "⚠️  Docker not found — skipping PostgreSQL auto-start (using DATABASE_URL from .env)"
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Prefer the virtualenv Python directly to avoid PATH issues
VENV_PYTHON="venv/bin/python3"
if [ ! -x "$VENV_PYTHON" ]; then
    VENV_PYTHON="python3"
fi

# Install dependencies
echo "Installing dependencies..."
"$VENV_PYTHON" -m pip install -r requirements.txt --quiet

# Create .env from example if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Edit backend/.env to add your API keys (OPENAI_API_KEY or ANTHROPIC_API_KEY)"
fi

# Start the server
echo ""
echo "Starting Fuel Good API..."
echo "Docs: http://localhost:8000/docs"
echo ""
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"
"$VENV_PYTHON" -m alembic upgrade heads
"$VENV_PYTHON" - <<'PY'
from sqlalchemy import create_engine, text
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url)

with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    vector_ok = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()
    if not vector_ok:
        raise SystemExit("pgvector extension is not installed.")
    column_ok = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'recipe_embeddings' AND column_name = 'embedding'"
    )).scalar()
    if not column_ok:
        raise SystemExit("recipe_embeddings.embedding is missing.")
    index_ok = conn.execute(text(
        "SELECT 1 FROM pg_indexes "
        "WHERE tablename = 'recipe_embeddings' AND indexdef ILIKE '%embedding%'"
    )).scalar()
    if not index_ok:
        raise SystemExit("A pgvector index on recipe_embeddings.embedding is missing.")
PY
"$VENV_PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
