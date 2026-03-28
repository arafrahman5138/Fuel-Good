#!/usr/bin/env python3
"""
Backfill dietary_tags for existing recipes with keto/paleo compatibility.

Analyzes each recipe's nutrition_info and ingredients to determine if it qualifies
as keto or paleo compatible, and appends the relevant tags.

Usage:
  cd backend
  PYTHONPATH=. python3 scripts/backfill_dietary_tags.py
"""

from __future__ import annotations

from app.db import SessionLocal, init_db

# Import ALL models so SQLAlchemy resolves relationships
from app.models import user, meal_plan, recipe as recipe_mod, grocery, gamification  # noqa: F401
from app.models import saved_recipe, nutrition, local_food  # noqa: F401
from app.models import metabolic, metabolic_profile  # noqa: F401

from app.models.recipe import Recipe


# ── Ingredient blacklists ────────────────────────────────────────────

KETO_BLACKLIST = {
    "rice", "bread", "pasta", "oats", "oatmeal", "potato", "potatoes",
    "flour", "sugar", "honey", "maple syrup", "corn", "beans", "lentils",
    "quinoa", "couscous", "noodles", "tortilla", "pita", "naan",
    "sweet potato", "banana", "mango", "pineapple", "chickpeas",
}

PALEO_GRAINS = {
    "rice", "oats", "oatmeal", "wheat", "bread", "pasta", "flour",
    "corn", "quinoa", "couscous", "noodles", "tortilla", "pita", "naan",
}

PALEO_LEGUMES = {
    "beans", "lentils", "chickpeas", "peanut", "edamame",
}

PALEO_DAIRY = {
    "milk", "yogurt", "cheese", "butter", "cream", "sour cream", "whey",
}

PALEO_REFINED_SUGAR = {
    "sugar", "corn syrup",
}

PALEO_BLACKLIST = PALEO_GRAINS | PALEO_LEGUMES | PALEO_DAIRY | PALEO_REFINED_SUGAR


def _ingredient_names(recipe: Recipe) -> list[str]:
    """Extract lowercased ingredient name strings from a recipe."""
    ingredients = recipe.ingredients or []
    names: list[str] = []
    for item in ingredients:
        if isinstance(item, dict):
            names.append(item.get("name", "").lower())
        elif isinstance(item, str):
            names.append(item.lower())
    return names


def _contains_blacklisted(ingredient_names: list[str], blacklist: set[str]) -> bool:
    """Check if any ingredient name contains a blacklisted term."""
    for name in ingredient_names:
        for term in blacklist:
            if term in name:
                return True
    return False


def _is_keto(recipe: Recipe, ingredient_names: list[str]) -> bool:
    """Determine if a recipe is keto compatible."""
    nutrition = recipe.nutrition_info or {}
    carbs = nutrition.get("carbs") or nutrition.get("carbs_g")
    if carbs is None:
        return False
    try:
        carbs = float(carbs)
    except (ValueError, TypeError):
        return False
    if carbs > 20:
        return False
    if _contains_blacklisted(ingredient_names, KETO_BLACKLIST):
        return False
    return True


def _is_paleo(recipe: Recipe, ingredient_names: list[str]) -> bool:
    """Determine if a recipe is paleo compatible."""
    if _contains_blacklisted(ingredient_names, PALEO_BLACKLIST):
        return False
    return True


def backfill() -> None:
    init_db()
    db = SessionLocal()

    recipes = db.query(Recipe).all()
    print(f"Analyzing {len(recipes)} recipes for dietary tags...\n")

    keto_count = 0
    paleo_count = 0
    already_keto = 0
    already_paleo = 0

    for r in recipes:
        ingredient_names = _ingredient_names(r)
        existing_tags = list(r.dietary_tags or [])
        new_tags = list(existing_tags)

        # Keto check
        if "keto" in existing_tags:
            already_keto += 1
        elif _is_keto(r, ingredient_names):
            new_tags.append("keto")
            keto_count += 1
            print(f"  + keto: '{r.title}'")

        # Paleo check
        if "paleo" in existing_tags:
            already_paleo += 1
        elif _is_paleo(r, ingredient_names):
            new_tags.append("paleo")
            paleo_count += 1
            print(f"  + paleo: '{r.title}'")

        if new_tags != existing_tags:
            r.dietary_tags = new_tags

    db.commit()

    print(f"\n--- Summary ---")
    print(f"Total recipes analyzed: {len(recipes)}")
    print(f"Newly tagged keto:  {keto_count}  (already had keto: {already_keto})")
    print(f"Newly tagged paleo: {paleo_count}  (already had paleo: {already_paleo})")

    db.close()


if __name__ == "__main__":
    backfill()
