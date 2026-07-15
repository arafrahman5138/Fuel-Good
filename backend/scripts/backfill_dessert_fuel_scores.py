#!/usr/bin/env python3
"""
Backfill fuel_score for dessert recipes (2026-07-11 honest-scoring fix).

Dessert recipes historically inherited the vetted-100 recipe shortcut. They
are now scored from their actual ingredients via the NOVA dictionary
(compute_fuel_score with recipe_role="dessert") — "100 only if all
real-food/unprocessed ingredients, else scored accurately."

Idempotent: recomputes every recipe_role='dessert' row from its current
ingredients; re-running produces the same scores.

Usage:
  cd backend
  PYTHONPATH=. python3 scripts/backfill_dessert_fuel_scores.py           # dry run
  PYTHONPATH=. python3 scripts/backfill_dessert_fuel_scores.py --apply   # commit
"""

from __future__ import annotations

import argparse

from app.db import SessionLocal, init_db

# Import all model modules so SQLAlchemy relationships resolve cleanly.
from app.models import user, meal_plan, grocery, gamification  # noqa: F401
from app.models import saved_recipe, nutrition, local_food  # noqa: F401
from app.models import metabolic, metabolic_profile, notification, scanned_meal as sm_module, recipe_embedding  # noqa: F401
from app.models import fuel as fuel_model  # noqa: F401

from app.models.recipe import Recipe
from app.services.fuel_score import compute_fuel_score


def main() -> None:
    parser = argparse.ArgumentParser(description="Recompute fuel_score for dessert recipes")
    parser.add_argument("--apply", action="store_true", help="Commit changes (default is dry run)")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()

    try:
        desserts = (
            db.query(Recipe)
            .filter(Recipe.recipe_role == "dessert")
            .order_by(Recipe.title)
            .all()
        )
        print(f"Dessert recipes found: {len(desserts)}")

        changed = 0
        for r in desserts:
            result = compute_fuel_score(
                source_type="recipe",
                recipe_role="dessert",
                ingredients=r.ingredients or [],
                nutrition=r.nutrition_info or {},
                title=r.title,
            )
            before = float(r.fuel_score) if r.fuel_score is not None else None
            after = result.score
            marker = " " if before == after else "*"
            print(f"{marker} {r.title!r}: {before} -> {after} (tier={result.tier})")
            if before != after:
                r.fuel_score = after
                changed += 1

        print(f"\n{changed} of {len(desserts)} dessert recipes changed.")

        if args.apply:
            db.commit()
            print("Changes committed.")
        else:
            db.rollback()
            print("Dry run — no changes committed. Use --apply to commit.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
