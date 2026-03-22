"""
One-time migration: add 'lunch' tag to dinner recipes suitable for lunch.

These recipes are all full_meal, non-component, ≤600 cal, and appropriate
for midday eating.  Run once against the live DB, then update
official_meals.json to keep the source of truth in sync.
"""

import json
import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.db import SessionLocal

RECIPES_TO_TAG = [
    "Air Fryer Gochujang Chicken Skewers",
    "Bang Bang Chicken Skewers",
    "Beef and Broccoli Stir-Fry",
    "Beef and Cheese Borek Rolls",
    "Butter Chicken Bowl",
    "Butter Chicken Bowl Plus",
    "Chicken Shawarma Bowl",
    "Chickpea Mac N' Beef",
    "Creamy Corn Salmon Chickpea Pasta",
    "Creamy Red Pepper Chicken Rice Bowl",
    "Skillet Chicken Fajita Rice Bowl",
]


def main() -> None:
    db = SessionLocal()
    updated = 0

    for title in RECIPES_TO_TAG:
        row = db.execute(
            text("SELECT id, tags FROM recipes WHERE title = :title"),
            {"title": title},
        ).fetchone()

        if row is None:
            print(f"  SKIP  {title} — not found in DB")
            continue

        tags = list(row[1]) if row[1] else []
        if "lunch" in tags:
            print(f"  OK    {title} — already has 'lunch' tag")
            continue

        tags.append("lunch")
        db.execute(
            text("UPDATE recipes SET tags = cast(:tags AS json) WHERE id = :id"),
            {"tags": json.dumps(tags), "id": row[0]},
        )
        updated += 1
        print(f"  ADDED {title} — now tagged {tags}")

    db.commit()
    db.close()

    # Verify
    db = SessionLocal()
    result = db.execute(
        text("SELECT count(*) FROM recipes WHERE tags::text LIKE '%lunch%'")
    ).fetchone()
    print(f"\nDone. {updated} recipes updated. Total lunch-tagged recipes: {result[0]}")
    db.close()


if __name__ == "__main__":
    main()
