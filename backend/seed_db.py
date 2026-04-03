"""
Seed the database with official Fuel Good meals by default.

Default:
  python seed_db.py
    Seeds from backend/official_meals.json

Optional:
  SEED_SOURCE=library python seed_db.py
    Seeds from the broader Python meal library (SEED_MEALS + GLOBAL_MEALS)
"""

import json
import os
import uuid
from pathlib import Path

from app.db import SessionLocal, init_db
from app.models import gamification as _gamification_models  # noqa: F401
from app.models import grocery as _grocery_models  # noqa: F401
from app.models import meal_plan as _meal_plan_models  # noqa: F401
from app.models import metabolic as _metabolic_models  # noqa: F401
from app.models import metabolic_profile as _metabolic_profile_models  # noqa: F401
from app.models import nutrition as _nutrition_models  # noqa: F401
from app.models.recipe import Recipe
from app.models import saved_recipe as _saved_recipe_models  # noqa: F401
from app.models import user as _user_models  # noqa: F401
from app.seed_meals import SEED_MEALS
from app.seed_meals_global import GLOBAL_MEALS
from app.nutrition_tags import compute_health_benefits
from app.services.metabolic_engine import passes_import_gate

BACKEND_DIR = Path(__file__).resolve().parent
OFFICIAL_MEALS_PATH = BACKEND_DIR / "official_meals.json"
SEED_SOURCE = (os.getenv("SEED_SOURCE") or "official").strip().lower()

PROTEIN_KEYWORDS: dict[str, list[str]] = {
    "chicken": ["chicken", "cornish game hen"],
    "beef": ["beef", "ribeye", "flank steak", "short ribs", "stew meat", "bison", "oxtail", "liver"],
    "lamb": ["lamb", "goat"],
    "pork": ["pork", "bacon", "pancetta", "prosciutto", "sausage", "duck"],
    "salmon": ["salmon"],
    "shrimp": ["shrimp", "scallop"],
    "other_fish": ["tuna", "cod", "tilapia", "sole", "sardine", "mackerel", "trout", "fish"],
    "eggs": ["egg"],
    "vegetarian": ["chickpea", "lentil", "bean", "tofu", "edamame"],
}

CARB_KEYWORDS: dict[str, list[str]] = {
    "rice": ["rice"],
    "sweet_potato": ["sweet potato"],
    "potato": ["potato", "russet"],
    "sourdough_bread": ["sourdough", "bread", "rye bread"],
    "oats": ["oats", "steel-cut", "rolled oats"],
    "quinoa": ["quinoa"],
    "tortillas": ["tortilla", "pita"],
    "noodles": ["noodle", "soba", "vermicelli", "glass noodle", "pasta"],
    "plantain": ["plantain"],
}

_NOODLE_HINTS = {"noodle", "vermicelli", "paper", "wrapper"}


def _classify_proteins(ingredients: list[dict]) -> list[str]:
    tags: set[str] = set()
    for ing in ingredients:
        if (ing.get("category") or "").lower() != "protein":
            continue
        name = (ing.get("name") or "").lower()
        for tag, keywords in PROTEIN_KEYWORDS.items():
            if any(kw in name for kw in keywords):
                tags.add(tag)
    return sorted(tags)


def _classify_carbs(ingredients: list[dict]) -> list[str]:
    tags: set[str] = set()
    for ing in ingredients:
        cat = (ing.get("category") or "").lower()
        name = (ing.get("name") or "").lower()
        if cat not in ("grains", "produce"):
            continue
        if cat == "produce":
            if "sweet potato" in name:
                tags.add("sweet_potato")
            elif "potato" in name or "russet" in name:
                tags.add("potato")
            elif "plantain" in name:
                tags.add("plantain")
            continue
        if any(hint in name for hint in _NOODLE_HINTS):
            tags.add("noodles")
            continue
        for tag, keywords in CARB_KEYWORDS.items():
            if any(kw in name for kw in keywords):
                tags.add(tag)
                break
    return sorted(tags)


def _load_official_meals() -> list[dict]:
    payload = json.loads(OFFICIAL_MEALS_PATH.read_text())
    meals = payload.get("meals", []) if isinstance(payload, dict) else payload
    if not isinstance(meals, list):
        raise RuntimeError("official_meals.json does not contain a meals list")
    return meals


def _load_seed_meals() -> list[dict]:
    if SEED_SOURCE == "official":
        return _load_official_meals()
    if SEED_SOURCE == "library":
        return SEED_MEALS + GLOBAL_MEALS
    raise RuntimeError(f"Unsupported SEED_SOURCE={SEED_SOURCE!r}. Use official or library.")


def _build_recipe(meal: dict) -> Recipe:
    health = meal.get("health_benefits") or compute_health_benefits(meal.get("ingredients", []))
    return Recipe(
        id=meal.get("id") or str(uuid.uuid4()),
        title=meal["title"],
        description=meal.get("description", ""),
        ingredients=meal.get("ingredients", []),
        steps=meal.get("steps", []),
        prep_time_min=meal.get("prep_time_min", 0),
        cook_time_min=meal.get("cook_time_min", 0),
        total_time_min=meal.get("total_time_min", meal.get("prep_time_min", 0) + meal.get("cook_time_min", 0)),
        servings=meal.get("servings", 1),
        nutrition_info=meal.get("nutrition_info", meal.get("nutrition_estimate", {})),
        difficulty=meal.get("difficulty", "easy"),
        tags=meal.get("tags", [meal.get("meal_type", ""), meal.get("category", "")]),
        flavor_profile=meal.get("flavor_profile", []),
        dietary_tags=meal.get("dietary_tags", []),
        cuisine=meal.get("cuisine", "american"),
        health_benefits=health,
        is_ai_generated=meal.get("is_ai_generated", False),
        image_url=meal.get("image_url"),
        protein_type=meal.get("protein_type") or _classify_proteins(meal.get("ingredients", [])),
        carb_type=meal.get("carb_type") or _classify_carbs(meal.get("ingredients", [])),
        recipe_role=meal.get("recipe_role", "full_meal"),
        is_component=meal.get("is_component", False),
        meal_group_id=meal.get("meal_group_id"),
        default_pairing_ids=meal.get("default_pairing_ids", []),
        needs_default_pairing=meal.get("needs_default_pairing"),
        component_composition=meal.get("component_composition"),
        is_mes_scoreable=meal.get("is_mes_scoreable", True),
        pairing_synergy_profile=meal.get("pairing_synergy_profile"),
        glycemic_profile=meal.get("glycemic_profile"),
        created_at=meal.get("created_at"),
        fuel_score=meal.get("fuel_score", 100.0),
    )


def seed_recipes() -> None:
    init_db()
    db = SessionLocal()
    meals = _load_seed_meals()
    try:
        added = 0
        updated = 0
        skipped_mes = 0
        for meal in meals:
            existing = db.query(Recipe).filter(Recipe.title == meal["title"]).first()
            if existing:
                existing.description = meal.get("description", existing.description)
                existing.ingredients = meal.get("ingredients", existing.ingredients)
                existing.steps = meal.get("steps", existing.steps)
                existing.prep_time_min = meal.get("prep_time_min", existing.prep_time_min)
                existing.cook_time_min = meal.get("cook_time_min", existing.cook_time_min)
                existing.total_time_min = meal.get("total_time_min", existing.total_time_min)
                existing.servings = meal.get("servings", existing.servings)
                existing.nutrition_info = meal.get("nutrition_info", meal.get("nutrition_estimate", existing.nutrition_info))
                existing.difficulty = meal.get("difficulty", existing.difficulty)
                existing.tags = meal.get("tags", existing.tags)
                existing.flavor_profile = meal.get("flavor_profile", existing.flavor_profile)
                existing.dietary_tags = meal.get("dietary_tags", existing.dietary_tags)
                existing.cuisine = meal.get("cuisine", existing.cuisine)
                existing.health_benefits = meal.get("health_benefits", existing.health_benefits)
                existing.is_ai_generated = meal.get("is_ai_generated", existing.is_ai_generated)
                existing.image_url = meal.get("image_url", existing.image_url)
                existing.protein_type = meal.get("protein_type") or _classify_proteins(meal.get("ingredients", []))
                existing.carb_type = meal.get("carb_type") or _classify_carbs(meal.get("ingredients", []))
                existing.recipe_role = meal.get("recipe_role", existing.recipe_role)
                existing.is_component = meal.get("is_component", existing.is_component)
                existing.meal_group_id = meal.get("meal_group_id", existing.meal_group_id)
                existing.default_pairing_ids = meal.get("default_pairing_ids", existing.default_pairing_ids)
                existing.needs_default_pairing = meal.get("needs_default_pairing", existing.needs_default_pairing)
                existing.component_composition = meal.get("component_composition", existing.component_composition)
                existing.is_mes_scoreable = meal.get("is_mes_scoreable", existing.is_mes_scoreable)
                existing.pairing_synergy_profile = meal.get("pairing_synergy_profile", existing.pairing_synergy_profile)
                existing.glycemic_profile = meal.get("glycemic_profile", existing.glycemic_profile)
                updated += 1
                continue

            nutrition = meal.get("nutrition_info", meal.get("nutrition_estimate", {}))
            if SEED_SOURCE == "library" and nutrition and not passes_import_gate(nutrition):
                skipped_mes += 1
                continue

            db.add(_build_recipe(meal))
            added += 1

        db.commit()
        print(
            f"Seeded {added} new + updated {updated} existing, skipped {skipped_mes} "
            f"({len(meals)} total definitions, source={SEED_SOURCE})."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed_recipes()
