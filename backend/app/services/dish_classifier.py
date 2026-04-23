"""Dish-type implicit-flag classifier.

Some dishes carry processing signals that live-photo extraction misses.
A meal labelled "pepperoni pizza" obviously contains refined flour in
the crust and cured meat on top, even if Gemini only reports "Pizza
Dough, Tomato Sauce, Mozzarella, Pepperoni" as discrete components.
This module reads the extracted ``meal_label`` (and/or the dish array)
and returns implicit whole-food flags that get merged into the scoring
pipeline before ``_score_scan`` runs.

Keep the dictionary surgical — only dishes where omission of the flag
would cause a visibly wrong Fuel score. Fine-grained gradations (e.g.
thin-crust vs thick-crust pizza) are handled in scoring, not here.
"""
from __future__ import annotations

import re
from typing import Any

FLAG_SEED_OIL_FRIED = {"label": "Fried in seed oil", "severity": "high", "tag": "seed_oil_fried"}
FLAG_REFINED_FLOUR = {"label": "Refined flour", "severity": "medium", "tag": "refined_flour"}
FLAG_CURED_MEAT = {"label": "Cured / processed meat", "severity": "high", "tag": "cured_meat"}
FLAG_PROCESSED_CHEESE = {"label": "Processed cheese", "severity": "medium", "tag": "processed_cheese"}
FLAG_ADDED_SUGAR = {"label": "Added sugar", "severity": "high", "tag": "added_sugar"}
FLAG_SODIUM = {"label": "High sodium / ultra-processed base", "severity": "medium", "tag": "sodium_high"}


# Each entry: substring of the meal label → implicit flags (with severity)
# and optional per-component nova floors keyed by role.
_DISH_RULES: list[dict[str, Any]] = [
    {
        "match": ["pepperoni pizza"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE, FLAG_CURED_MEAT],
        "nova_floor_by_role": {"carb": 3, "protein": 4},
    },
    {
        "match": ["sausage pizza", "meat lovers pizza", "meat lover's pizza", "supreme pizza"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE, FLAG_CURED_MEAT],
        "nova_floor_by_role": {"carb": 3, "protein": 3},
    },
    {
        "match": ["cheese pizza", "margherita pizza", "pizza slice", "ny pizza", "pizza"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["carbonara", "spaghetti carbonara", "pasta carbonara"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_CURED_MEAT],
        "nova_floor_by_role": {"carb": 3, "protein": 3},
    },
    {
        "match": ["bolognese", "spaghetti bolognese"],
        "flags": [FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["lasagna", "lasagne"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["mac and cheese", "macaroni and cheese", "mac & cheese"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE],
        "nova_floor_by_role": {"carb": 3, "other": 4},
    },
    {
        "match": ["cheeseburger", "hamburger", "diner burger", "burger and fries", "burger"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE, FLAG_SEED_OIL_FRIED],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["french fries", "fries", "crinkle fries", "curly fries", "waffle fries"],
        "flags": [FLAG_SEED_OIL_FRIED],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["chicken nuggets", "nuggets", "chicken tenders", "chicken fingers"],
        "flags": [FLAG_SEED_OIL_FRIED, FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"protein": 4},
    },
    {
        "match": ["fried chicken"],
        "flags": [FLAG_SEED_OIL_FRIED],
        "nova_floor_by_role": {"protein": 3},
    },
    {
        "match": ["hot dog", "corn dog"],
        "flags": [FLAG_CURED_MEAT, FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"protein": 4, "carb": 3},
    },
    {
        "match": ["ramen"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_SODIUM],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["pad thai"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_ADDED_SUGAR],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["fried rice"],
        "flags": [FLAG_SEED_OIL_FRIED, FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["nachos", "quesadilla"],
        "flags": [FLAG_PROCESSED_CHEESE, FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["burrito", "chipotle bowl", "burrito bowl"],
        "flags": [],  # Depends heavily on fillings — let component scoring handle
        "nova_floor_by_role": {},
    },
    {
        "match": ["taco"],
        "flags": [],
        "nova_floor_by_role": {},
    },
    {
        "match": ["sub sandwich", "hoagie", "club sandwich", "deli sandwich", "sandwich"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_CURED_MEAT],
        "nova_floor_by_role": {"carb": 3, "protein": 3},
    },
    {
        "match": ["grilled cheese"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE],
        "nova_floor_by_role": {"carb": 3, "other": 4},
    },
    {
        "match": ["breakfast burrito", "breakfast sandwich", "egg sandwich"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_CURED_MEAT],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["pancake", "pancakes", "waffle", "waffles", "french toast"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_ADDED_SUGAR],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["donut", "doughnut"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_ADDED_SUGAR, FLAG_SEED_OIL_FRIED],
        "nova_floor_by_role": {"carb": 4},
    },
    {
        "match": ["muffin", "scone", "croissant"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_ADDED_SUGAR],
        "nova_floor_by_role": {"carb": 3},
    },
    {
        "match": ["cereal bowl", "sugary cereal", "kids cereal"],
        "flags": [FLAG_ADDED_SUGAR, FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"carb": 4},
    },
    {
        "match": ["cake", "brownie", "cupcake"],
        "flags": [FLAG_ADDED_SUGAR, FLAG_REFINED_FLOUR],
        "nova_floor_by_role": {"dessert": 4},
    },
    {
        "match": ["ice cream", "milkshake", "frappucc"],
        "flags": [FLAG_ADDED_SUGAR],
        "nova_floor_by_role": {"dessert": 4, "other": 4},
    },
    {
        "match": ["cafeteria tray", "school lunch tray"],
        "flags": [FLAG_REFINED_FLOUR, FLAG_PROCESSED_CHEESE, FLAG_SEED_OIL_FRIED],
        "nova_floor_by_role": {"carb": 3},
    },
]


_WORD_RE = re.compile(r"[^a-z0-9]+")


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    return _WORD_RE.sub(" ", text.lower()).strip()


def classify_dish(
    *,
    meal_label: str | None,
    dishes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return implicit flags + per-role NOVA floors based on the dish label.

    The result is safe to merge into the existing ``whole_food_flags`` list
    and the ``components`` array. Dishes list (for multi-dish photos) is
    also scanned — each dish's implicit rules merge together.
    """
    candidates: list[str] = []
    if meal_label:
        candidates.append(_normalize(meal_label))
    for dish in dishes or []:
        name = (dish.get("name") or dish.get("label") or "") if isinstance(dish, dict) else ""
        n = _normalize(name)
        if n:
            candidates.append(n)

    flags: list[dict[str, Any]] = []
    seen_tags: set[str] = set()
    nova_floor_by_role: dict[str, int] = {}
    matched_dishes: list[str] = []

    for candidate in candidates:
        for rule in _DISH_RULES:
            if any(keyword in candidate for keyword in rule["match"]):
                matched_dishes.append(rule["match"][0])
                for flag in rule["flags"]:
                    if flag["tag"] in seen_tags:
                        continue
                    seen_tags.add(flag["tag"])
                    flags.append({
                        "label": flag["label"],
                        "severity": flag["severity"],
                        "tag": flag["tag"],
                        "source": "dish_classifier",
                    })
                for role, floor in (rule.get("nova_floor_by_role") or {}).items():
                    nova_floor_by_role[role] = max(nova_floor_by_role.get(role, 0), int(floor))
                break  # only one rule per candidate

    return {
        "flags": flags,
        "nova_floor_by_role": nova_floor_by_role,
        "matched_dishes": matched_dishes,
    }
