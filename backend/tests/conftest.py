"""Force the whole pytest session onto a throwaway SQLite database.

2026-07-11: pytest imports test modules in collection order, and the first
module that touches app.config primes the lru_cached get_settings() BEFORE
later modules get a chance to set DATABASE_URL at import time. In a full-suite
run that meant the engine silently bound to the developer database from .env
(postgres://...fuelgood), and every TestClient module's drop_all/create_all
setUp then wiped it — the exact incident recorded in tasks/lessons.md.

conftest.py is imported before ANY test module, so setting the env var here
guarantees the settings cache and the engine only ever see a local SQLite
file. Test modules that set their own sqlite path for standalone runs keep
working: standalone, their env assignment happens before app.db is imported;
in a combined run everything shares this file, and per-test drop_all/create_all
keeps modules isolated.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

_current = os.environ.get("DATABASE_URL", "")
if not _current.startswith("sqlite"):
    # Never let a pytest session near a real database, even if .env or the
    # shell exports one.
    os.environ["DATABASE_URL"] = (
        f"sqlite:///{Path(__file__).with_name('test_suite_shared.sqlite3')}"
    )
