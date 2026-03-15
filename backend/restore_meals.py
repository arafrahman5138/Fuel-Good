"""
Restore recipes from a JSON export into the configured database.
Run:
  python restore_meals.py
  python restore_meals.py official_meals.json
  python restore_meals.py seed_meals_backup.json
"""
import json
import sys
from pathlib import Path

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe

# Import all models so relationships resolve
from app.models import (  # noqa: F401
    gamification,
    grocery,
    local_food,
    meal_plan,
    notification,
    nutrition,
    recipe,
    saved_recipe,
    user,
)


def load_entries(source_path: Path):
    raw = json.loads(source_path.read_text())
    if isinstance(raw, dict):
        return raw.get("meals", [])
    if isinstance(raw, list):
        return raw
    raise ValueError(f"Unsupported JSON structure in {source_path}")


def build_recipe(entry: dict) -> Recipe:
    return Recipe(
        id=entry["id"],
        title=entry["title"],
        description=entry.get("description"),
        ingredients=entry.get("ingredients", []),
        steps=entry.get("steps", []),
        prep_time_min=entry.get("prep_time_min", 0),
        cook_time_min=entry.get("cook_time_min", 0),
        total_time_min=entry.get("total_time_min", 0),
        servings=entry.get("servings", 1),
        nutrition_info=entry.get("nutrition_info", {}),
        difficulty=entry.get("difficulty", "easy"),
        tags=entry.get("tags", []),
        flavor_profile=entry.get("flavor_profile", []),
        dietary_tags=entry.get("dietary_tags", []),
        cuisine=entry.get("cuisine", "american"),
        health_benefits=entry.get("health_benefits", []),
        protein_type=entry.get("protein_type", []),
        carb_type=entry.get("carb_type", []),
        is_ai_generated=entry.get("is_ai_generated", True),
        image_url=entry.get("image_url"),
        recipe_role=entry.get("recipe_role", "full_meal"),
        is_component=entry.get("is_component", False),
        meal_group_id=entry.get("meal_group_id"),
        default_pairing_ids=entry.get("default_pairing_ids", []),
        needs_default_pairing=entry.get("needs_default_pairing"),
        component_composition=entry.get("component_composition"),
        is_mes_scoreable=entry.get("is_mes_scoreable", True),
        pairing_synergy_profile=entry.get("pairing_synergy_profile"),
    )


def restore(source_name: str = "official_meals.json"):
    init_db()
    db = SessionLocal()
    source_path = Path(source_name)
    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")

    data = load_entries(source_path)
    existing_ids = {row[0] for row in db.query(Recipe.id).all()}
    added = 0

    try:
        for entry in data:
            if entry["id"] in existing_ids:
                continue
            db.add(build_recipe(entry))
            added += 1

        db.commit()
        total = db.query(Recipe).count()
        print(
            f"Restored {added} recipes from {source_path} "
            f"({len(data) - added} already existed). Total in DB: {total}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    restore(sys.argv[1] if len(sys.argv) > 1 else "official_meals.json")
