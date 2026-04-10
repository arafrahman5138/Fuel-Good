"""Shared allergen expansion and dietary filtering utilities.

Extracted from meal_planner_fallback.py so browse, meal plan, and other
endpoints can reuse the same logic.
"""

from __future__ import annotations

# ── Allergen expansion: map category allergies to specific ingredient keywords ──
ALLERGEN_EXPANSIONS: dict[str, list[str]] = {
    "nuts": [
        "almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut",
        "macadamia", "brazil nut", "pine nut", "nut butter", "nut milk",
        "praline", "marzipan", "nougat",
    ],
    "tree nuts": [
        "almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut",
        "macadamia", "brazil nut", "pine nut",
    ],
    "peanuts": ["peanut"],
    "wheat": [
        "wheat", " flour", "bread", "pasta", "couscous", "bulgur",
        "farro", "semolina", "naan", "pita", "crouton",
    ],
    "gluten": [
        "wheat", " flour", "bread", "pasta", "couscous", "bulgur",
        "farro", "semolina", "barley", "rye", "naan", "pita",
    ],
    "dairy": [
        "milk", "cheese", "butter", "cream", "yogurt", "whey",
        "casein", "ghee", "sour cream", "ice cream", "kefir",
    ],
    "eggs": ["egg"],
    "soy": ["soy", "tofu", "edamame", "tempeh", "miso"],
    "shellfish": [
        "shrimp", "crab", "lobster", "mussel", "clam", "oyster",
        "scallop", "crawfish", "prawn",
    ],
    "fish": [
        "salmon", "tuna", "cod", "trout", "sardine", "mackerel",
        "anchovy", "tilapia", "halibut", "bass", "mahi", "swordfish",
    ],
    "sesame": ["sesame", "tahini"],
}


def expand_allergies(allergies: list[str]) -> set[str]:
    """Expand category allergies (e.g., 'nuts') into specific ingredient keywords."""
    expanded: set[str] = set()
    for allergy in allergies:
        key = allergy.lower().strip()
        expanded.add(key)
        if key in ALLERGEN_EXPANSIONS:
            expanded.update(ALLERGEN_EXPANSIONS[key])
    return expanded


def recipe_matches_user_preferences(
    recipe_ingredients: list[dict],
    recipe_dietary_tags: list[str],
    recipe_title: str,
    *,
    expanded_allergies: set[str],
    user_dietary: set[str],
    user_disliked: set[str],
) -> bool:
    """Return True if a recipe is safe for the user's preferences.

    Checks allergens in ingredient names, dietary tag compliance, and
    disliked ingredients.  Mirrors the logic in meal_planner_fallback's
    ``_candidate_pool`` so browse and plan endpoints stay consistent.
    """
    ing_text = " ".join(
        (ing.get("name") or "") for ing in (recipe_ingredients or [])
    ).lower()
    combined = f"{(recipe_title or '').lower()} {ing_text}"

    # Allergen check
    if any(a in combined for a in expanded_allergies):
        return False

    # Disliked ingredients check
    if any(d in combined for d in user_disliked):
        return False

    # Dietary preference check via recipe tags
    tags = {t.lower() for t in (recipe_dietary_tags or [])}
    if "vegan" in user_dietary and "vegan" not in tags:
        return False
    if "vegetarian" in user_dietary and not tags & {"vegetarian", "vegan"}:
        return False
    if "gluten-free" in user_dietary and "gluten-free" not in tags:
        return False
    if "dairy-free" in user_dietary and "dairy-free" not in tags:
        return False
    if "keto" in user_dietary and "keto" not in tags:
        return False
    if "paleo" in user_dietary and "paleo" not in tags:
        return False
    if "whole30" in user_dietary and "whole30" not in tags:
        return False

    return True
