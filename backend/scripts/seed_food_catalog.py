"""
Seed or refresh the owned food catalog.

Run:
  PYTHONPATH=. python3 scripts/seed_food_catalog.py
"""

from app.db import SessionLocal, init_db
from app.models import local_food as _local_food_models  # noqa: F401
from app.services.food_catalog import seed_food_catalog


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seeded = seed_food_catalog(db)
        print(f"Food catalog upserted. New rows: {seeded}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
