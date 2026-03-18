#!/usr/bin/env python3
"""
Backfill fuel_score for existing recipes, food logs, and scanned meals.

Rules:
- Recipes (from DB): fuel_score = 100  (whole-food by definition)
- Scanned meals: recompute via compute_fuel_score heuristic
- Food logs: propagate from linked source (recipe or scan)

Usage:
  cd backend
  PYTHONPATH=. python3 scripts/backfill_fuel_scores.py           # dry run
  PYTHONPATH=. python3 scripts/backfill_fuel_scores.py --apply   # commit
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
from app.models.nutrition import FoodLog
from app.models.scanned_meal import ScannedMealLog
from app.services.fuel_score import compute_fuel_score


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill fuel_score on existing data")
    parser.add_argument("--apply", action="store_true", help="Commit changes (default is dry run)")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()

    try:
        # ── 1. Recipes → 100 ──
        recipes = db.query(Recipe).filter(Recipe.fuel_score.is_(None)).all()
        print(f"Recipes missing fuel_score: {len(recipes)}")
        for r in recipes:
            r.fuel_score = 100.0

        # ── 2. Scanned meals → heuristic ──
        scans = db.query(ScannedMealLog).filter(ScannedMealLog.fuel_score.is_(None)).all()
        print(f"Scanned meals missing fuel_score: {len(scans)}")
        for s in scans:
            ingredients = []
            if s.ingredients and isinstance(s.ingredients, list):
                ingredients = [str(i) for i in s.ingredients]
            cooking_method = None
            if s.nutrition_snapshot and isinstance(s.nutrition_snapshot, dict):
                cooking_method = s.nutrition_snapshot.get("cooking_method")
            score = compute_fuel_score(
                source_type="scan",
                ingredients=ingredients,
                cooking_method=cooking_method,
            )
            s.fuel_score = score

        # ── 3. Food logs → propagate from source ──
        logs = db.query(FoodLog).filter(FoodLog.fuel_score.is_(None)).all()
        print(f"Food logs missing fuel_score: {len(logs)}")
        for log in logs:
            if log.source_type == "recipe" and log.source_id:
                recipe = db.query(Recipe).filter(Recipe.id == log.source_id).first()
                log.fuel_score = recipe.fuel_score if recipe else 100.0
            elif log.source_type == "scan" and log.source_id:
                scan = db.query(ScannedMealLog).filter(ScannedMealLog.id == log.source_id).first()
                log.fuel_score = scan.fuel_score if scan else 50.0
            else:
                log.fuel_score = compute_fuel_score(source_type="manual")

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
