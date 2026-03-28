"""
Seed common everyday foods into the local_foods table.

Run:
  PYTHONPATH=. python3 scripts/seed_common_foods.py
"""

import json
from pathlib import Path

from app.db import SessionLocal, init_db
from app.models import local_food as _local_food_models  # noqa: F401
from app.models.local_food import LocalFood
from app.services.food_catalog import build_food_payload


COMMON_FOODS_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "common_foods.json"


def load_common_foods() -> list[dict]:
    with COMMON_FOODS_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def seed_common_foods() -> int:
    init_db()
    db = SessionLocal()
    seeded = 0
    try:
        raw_items = load_common_foods()
        for raw in raw_items:
            payload = build_food_payload(raw)
            row = db.query(LocalFood).filter(LocalFood.id == payload["id"]).first()
            if not row:
                row = db.query(LocalFood).filter(LocalFood.name == payload["name"]).first()
            if not row:
                row = LocalFood(id=payload["id"], name=payload["name"])
                db.add(row)
                seeded += 1

            for key, value in payload.items():
                setattr(row, key, value)
        db.commit()
        print(f"Common foods upserted. New rows: {seeded} (total processed: {len(raw_items)})")
    finally:
        db.close()
    return seeded


if __name__ == "__main__":
    seed_common_foods()
