"""
Synchronize recipes from a JSON export into the configured database.

Default:
  python restore_meals.py
    Upserts from official_meals.json without deleting extra recipes.

Exact sync:
  python restore_meals.py official_meals.json --prune
    Makes the recipes table match the file exactly, deleting non-official recipes
    and dependent rows that reference them.
"""
import json
import sys
from pathlib import Path

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe
from app.models.recipe_embedding import RecipeEmbedding
from app.models.saved_recipe import SavedRecipe
from app.models.meal_plan import MealPlanItem

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

BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_SOURCE_PATH = BACKEND_DIR / "official_meals.json"

RECIPE_FIELDS = [
    "title",
    "description",
    "ingredients",
    "steps",
    "prep_time_min",
    "cook_time_min",
    "total_time_min",
    "servings",
    "nutrition_info",
    "difficulty",
    "tags",
    "flavor_profile",
    "dietary_tags",
    "cuisine",
    "health_benefits",
    "protein_type",
    "carb_type",
    "is_ai_generated",
    "image_url",
    "recipe_role",
    "is_component",
    "meal_group_id",
    "default_pairing_ids",
    "needs_default_pairing",
    "component_composition",
    "is_mes_scoreable",
    "pairing_synergy_profile",
    "glycemic_profile",
    "fuel_score",
]


def load_entries(source_path: Path):
    raw = json.loads(source_path.read_text())
    if isinstance(raw, dict):
        return raw.get("meals", [])
    if isinstance(raw, list):
        return raw
    raise ValueError(f"Unsupported JSON structure in {source_path}")


def _entry_to_fields(entry: dict) -> dict:
    return {
        "title": entry["title"],
        "description": entry.get("description", ""),
        "ingredients": entry.get("ingredients", []),
        "steps": entry.get("steps", []),
        "prep_time_min": entry.get("prep_time_min", 0),
        "cook_time_min": entry.get("cook_time_min", 0),
        "total_time_min": entry.get("total_time_min", 0),
        "servings": entry.get("servings", 1),
        "nutrition_info": entry.get("nutrition_info", {}),
        "difficulty": entry.get("difficulty", "easy"),
        "tags": entry.get("tags", []),
        "flavor_profile": entry.get("flavor_profile", []),
        "dietary_tags": entry.get("dietary_tags", []),
        "cuisine": entry.get("cuisine", "american"),
        "health_benefits": entry.get("health_benefits", []),
        "protein_type": entry.get("protein_type", []),
        "carb_type": entry.get("carb_type", []),
        "is_ai_generated": entry.get("is_ai_generated", True),
        "image_url": entry.get("image_url"),
        "recipe_role": entry.get("recipe_role", "full_meal"),
        "is_component": entry.get("is_component", False),
        "meal_group_id": entry.get("meal_group_id"),
        "default_pairing_ids": entry.get("default_pairing_ids", []),
        "needs_default_pairing": entry.get("needs_default_pairing"),
        "component_composition": entry.get("component_composition"),
        "is_mes_scoreable": entry.get("is_mes_scoreable", True),
        "pairing_synergy_profile": entry.get("pairing_synergy_profile"),
        "glycemic_profile": entry.get("glycemic_profile"),
        "fuel_score": entry.get("fuel_score", 100.0),
    }


def build_recipe(entry: dict) -> Recipe:
    return Recipe(id=entry["id"], **_entry_to_fields(entry))


def _apply_entry(existing: Recipe, entry: dict) -> bool:
    changed = False
    fields = _entry_to_fields(entry)
    for field in RECIPE_FIELDS:
        new_value = fields[field]
        if getattr(existing, field) != new_value:
            setattr(existing, field, new_value)
            changed = True
    return changed


def sync(source_name: str = "official_meals.json", prune: bool = False, init_schema: bool = True):
    if init_schema:
        init_db()

    db = SessionLocal()
    source_path = Path(source_name)
    if not source_path.is_absolute():
        source_path = (Path.cwd() / source_path).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")

    data = load_entries(source_path)
    source_by_id = {entry["id"]: entry for entry in data}

    added = 0
    updated = 0
    pruned = 0

    try:
        existing_rows = db.query(Recipe).all()
        existing_by_id = {row.id: row for row in existing_rows}

        for recipe_id, entry in source_by_id.items():
            existing = existing_by_id.get(recipe_id)
            if existing is None:
                db.add(build_recipe(entry))
                added += 1
                continue
            if _apply_entry(existing, entry):
                updated += 1

        if prune:
            source_ids = set(source_by_id)
            existing_ids = set(existing_by_id)
            ids_to_delete = sorted(existing_ids - source_ids)
            if ids_to_delete:
                db.query(RecipeEmbedding).filter(RecipeEmbedding.recipe_id.in_(ids_to_delete)).delete(synchronize_session=False)
                db.query(SavedRecipe).filter(SavedRecipe.recipe_id.in_(ids_to_delete)).delete(synchronize_session=False)
                db.query(MealPlanItem).filter(MealPlanItem.recipe_id.in_(ids_to_delete)).delete(synchronize_session=False)
                pruned = db.query(Recipe).filter(Recipe.id.in_(ids_to_delete)).delete(synchronize_session=False)

        db.commit()
        total = db.query(Recipe).count()
        print(
            f"Synced {source_path.name}: added={added}, updated={updated}, pruned={pruned}, total={total}, source_count={len(data)}"
        )
    finally:
        db.close()


def restore(source_name: str = "official_meals.json"):
    sync(source_name=source_name, prune=False, init_schema=True)


def sync_official_meals(prune: bool = True, init_schema: bool = False):
    sync(source_name=str(DEFAULT_SOURCE_PATH), prune=prune, init_schema=init_schema)


if __name__ == "__main__":
    args = sys.argv[1:]
    prune = False
    source_name = "official_meals.json"
    for arg in args:
        if arg == "--prune":
            prune = True
        else:
            source_name = arg
    sync(source_name=source_name, prune=prune, init_schema=True)
