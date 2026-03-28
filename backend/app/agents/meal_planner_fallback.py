"""
Deterministic weekly meal-plan generator built from Recipe rows.
"""
from __future__ import annotations

import random
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.recipe import Recipe
from app.services.metabolic_engine import (
    compute_meal_mes,
    compute_meal_mes_with_pairing,
    display_tier,
    load_budget_for_user,
)


DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MEAL_SLOTS = ["breakfast", "lunch", "dinner"]
TARGET_DISPLAY_MES = 70.0
BREAKFAST_MAX_CARBS_DEFAULT = 15.0
BREAKFAST_MAX_CALORIES_DEFAULT = 500.0
MEALS_PER_DAY = 3
VARIETY_LIMITS = {
    "prep_heavy": {"breakfast": 3, "lunch": 3, "dinner": 3},
    "balanced": {"breakfast": 4, "lunch": 5, "dinner": 5},
    "variety_heavy": {"breakfast": 5, "lunch": 7, "dinner": 7},
}
PAIRING_ROLE_PRIORITY = ["veg_side", "carb_base", "sauce", "dessert", "protein_base", "full_meal"]
_BULK_COOK_UNSUITABLE_TAGS = {"salad"}


def _is_bulk_cook_suitable(recipe: Recipe) -> bool:
    """Check if a recipe is suitable for batch cooking based on its tags."""
    tags_lower = {t.lower() for t in (recipe.tags or [])}
    if tags_lower.intersection(_BULK_COOK_UNSUITABLE_TAGS):
        return False
    return True


def _recipe_nutrition(recipe: Recipe) -> dict[str, float]:
    nutrition = recipe.nutrition_info or {}
    return {
        "calories": float(nutrition.get("calories", 0) or 0),
        "protein": float(nutrition.get("protein", 0) or nutrition.get("protein_g", 0) or 0),
        "carbs": float(nutrition.get("carbs", 0) or nutrition.get("carbs_g", 0) or nutrition.get("sugar", 0) or nutrition.get("sugar_g", 0) or 0),
        "fat": float(nutrition.get("fat", 0) or nutrition.get("fat_g", 0) or 0),
        "fiber": float(nutrition.get("fiber", 0) or nutrition.get("fiber_g", 0) or 0),
        "sugar": float(nutrition.get("sugar", 0) or nutrition.get("sugar_g", 0) or 0),
    }


def _combine_nutrition(*items: dict[str, float]) -> dict[str, float]:
    combined = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0}
    for item in items:
        for key in combined:
            combined[key] += float(item.get(key, 0) or 0)
    return combined


def _pick_default_pairing(recipe: Recipe, recipe_index: dict[str, Recipe]) -> Recipe | None:
    default_ids = getattr(recipe, "default_pairing_ids", None) or []
    if getattr(recipe, "needs_default_pairing", None) is not True or not default_ids:
        return None

    pairing_candidates = [recipe_index.get(str(recipe_id)) for recipe_id in default_ids]
    pairing_candidates = [candidate for candidate in pairing_candidates if candidate is not None]
    if not pairing_candidates:
        return None

    return sorted(
        pairing_candidates,
        key=lambda item: (
            PAIRING_ROLE_PRIORITY.index((getattr(item, "recipe_role", None) or "full_meal"))
            if (getattr(item, "recipe_role", None) or "full_meal") in PAIRING_ROLE_PRIORITY
            else len(PAIRING_ROLE_PRIORITY)
        ),
    )[0]


def _meal_display_mes(recipe: Recipe, budget: Any, recipe_index: dict[str, Recipe]) -> dict[str, Any]:
    nutrition = _recipe_nutrition(recipe)
    paired_recipe = _pick_default_pairing(recipe, recipe_index)
    stored_adjusted = (recipe.nutrition_info or {}).get("mes_default_pairing_adjusted_score")
    stored_macro_paired = (recipe.nutrition_info or {}).get("mes_score_with_default_pairing")

    if paired_recipe:
        paired = compute_meal_mes_with_pairing(
            nutrition,
            pairing_recipe=paired_recipe,
            budget=budget,
            pairing_nutrition=paired_recipe.nutrition_info or {},
        )
        mes = paired["score"]
        macro_only_mes = paired.get("macro_only_score") or mes
    else:
        mes = compute_meal_mes(nutrition, budget)
        macro_only_mes = mes

    display_score = float(mes.get("display_score", 0) or 0)
    composite_display_score = None
    if stored_adjusted is not None:
        composite_display_score = float(stored_adjusted)
    elif stored_macro_paired is not None:
        composite_display_score = float(stored_macro_paired)

    if composite_display_score is None and paired_recipe:
        composite_display_score = display_score

    return {
        **mes,
        "display_score": display_score,
        "display_tier": mes.get("display_tier", "critical"),
        "composite_display_score": round(composite_display_score, 1) if composite_display_score is not None else None,
        "composite_display_tier": display_tier(composite_display_score) if composite_display_score is not None else None,
        "macro_only_display_score": float(macro_only_mes.get("display_score", 0) or 0),
        "paired_recipe_id": str(paired_recipe.id) if paired_recipe else None,
        "paired_recipe_title": paired_recipe.title if paired_recipe else None,
    }


# Lifestyle preferences that are NOT dietary restrictions — skip them in filtering
_NON_RESTRICTIVE_DIETS = {"balanced", "none", "everything", "flexible", "standard", "moderate"}

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


def _expand_allergies(allergies: list[str]) -> set[str]:
    """Expand category allergies (e.g., 'nuts') into specific ingredient keywords."""
    expanded: set[str] = set()
    for allergy in allergies:
        key = allergy.lower().strip()
        expanded.add(key)
        if key in ALLERGEN_EXPANSIONS:
            expanded.update(ALLERGEN_EXPANSIONS[key])
    return expanded


# ── Dietary inference keywords ──
_KETO_EXCLUDED_INGREDIENTS = {
    "rice", "bread", "pasta", "oats", "oatmeal", "potato", "potatoes",
    "flour", "sugar", "honey", "maple syrup", "corn", "beans", "lentils",
    "quinoa", "couscous", "noodles", "tortilla", "pita", "naan",
    "sweet potato", "banana", "mango", "pineapple", "chickpeas",
}

_PALEO_EXCLUDED_INGREDIENTS = {
    "rice", "oats", "oatmeal", "wheat", "bread", "pasta", "flour", "corn",
    "quinoa", "couscous", "noodles", "tortilla", "pita", "naan",
    "beans", "lentils", "chickpeas", "peanut", "edamame",
    "milk", "yogurt", "cheese", "butter", "cream", "sour cream", "whey",
    "sugar", "corn syrup",
}


def _recipe_ingredient_text(recipe: Recipe) -> str:
    """Join all ingredient names into one lowercase string for keyword matching."""
    return " ".join(
        ing.get("name", "") for ing in (recipe.ingredients or [])
    ).lower()


def _infer_dietary_compatibility(recipe: Recipe, diet: str) -> bool:
    """Check if a recipe is compatible with a diet based on macros and ingredients."""
    ingredient_text = _recipe_ingredient_text(recipe)
    nutrition = _recipe_nutrition(recipe)

    if diet == "keto":
        if nutrition.get("carbs", 999) > 20:
            return False
        return not any(kw in ingredient_text for kw in _KETO_EXCLUDED_INGREDIENTS)

    if diet == "paleo":
        return not any(kw in ingredient_text for kw in _PALEO_EXCLUDED_INGREDIENTS)

    if diet in ("gluten-free", "gluten_free"):
        gluten_kw = {"wheat", "flour", "bread", "pasta", "couscous", "bulgur", "farro", "semolina", "barley", "rye"}
        return not any(kw in ingredient_text for kw in gluten_kw)

    if diet == "dairy-free":
        dairy_kw = {"milk", "cheese", "butter", "cream", "yogurt", "whey", "ghee", "sour cream"}
        return not any(kw in ingredient_text for kw in dairy_kw)

    # Unknown diet — can't infer, so fail safe (don't include)
    return False


def _matches_dietary(recipe: Recipe, dietary: list[str]) -> bool:
    required = {item.lower() for item in dietary if item and item.lower() not in _NON_RESTRICTIVE_DIETS}
    if not required:
        return True
    recipe_tags = {item.lower() for item in (recipe.dietary_tags or [])}
    for diet in required:
        if diet not in recipe_tags and not _infer_dietary_compatibility(recipe, diet):
            return False
    return True


def _is_breakfast_safe(recipe: Recipe, context: dict | None = None) -> bool:
    if "breakfast" not in (recipe.tags or []):
        return False
    if (recipe.recipe_role or "full_meal") != "full_meal" or bool(recipe.is_component):
        return False
    if recipe.is_mes_scoreable is False:
        return False

    # Derive limits from personalized budget when available
    budget = context.get("budget") if context else None
    if budget:
        carb_ceiling = getattr(budget, "carb_ceiling_g", 0) or getattr(budget, "sugar_ceiling_g", 0) or 0
        cal_target = getattr(budget, "calorie_target_kcal", 0) or 0
        if carb_ceiling > 0 and cal_target > 0:
            max_carbs = round(carb_ceiling / MEALS_PER_DAY * 0.4)
            max_cals = round(cal_target / MEALS_PER_DAY * 0.85)
        else:
            max_carbs = BREAKFAST_MAX_CARBS_DEFAULT
            max_cals = BREAKFAST_MAX_CALORIES_DEFAULT
    else:
        max_carbs = BREAKFAST_MAX_CARBS_DEFAULT
        max_cals = BREAKFAST_MAX_CALORIES_DEFAULT

    nutrition = _recipe_nutrition(recipe)
    if nutrition["carbs"] > max_carbs or nutrition["calories"] > max_cals:
        return False

    flavor_tags = {tag.lower() for tag in (recipe.flavor_profile or [])}
    if "sweet" in flavor_tags:
        return False
    return True


def _preference_alignment_score(
    recipe: Recipe,
    dietary: list[str],
    flavor_preferences: list[str],
    liked_ingredients: list[str],
    liked_proteins: list[str],
    preferred_recipe_ids: set[str],
) -> int:
    score = 0
    ingredient_names = " ".join(ing.get("name", "") for ing in (recipe.ingredients or [])).lower()
    dietary_tags = {tag.lower() for tag in (recipe.dietary_tags or [])}
    flavor_tags = {tag.lower() for tag in (recipe.flavor_profile or [])}

    if str(recipe.id) in preferred_recipe_ids:
        score += 6
    if dietary and dietary_tags.intersection({tag.lower() for tag in dietary if tag.lower() != "none"}):
        score += 2
    if flavor_preferences and flavor_tags.intersection({tag.lower() for tag in flavor_preferences}):
        score += 2
    if liked_ingredients and any(item.lower() in ingredient_names for item in liked_ingredients):
        score += 2
    if liked_proteins and any(item.lower() in ingredient_names for item in liked_proteins):
        score += 3

    return score


def _budget_alignment_score(recipe: Recipe, budget: Any) -> float:
    """Score 0‑1 for how well a recipe's macros align with per‑meal budget targets."""
    if not budget:
        return 0.5
    nutrition = _recipe_nutrition(recipe)
    per_meal = MEALS_PER_DAY
    score, checks = 0.0, 0

    protein_target = (getattr(budget, "protein_floor_g", 0) or 0) / per_meal
    if protein_target > 0:
        checks += 1
        score += min(nutrition["protein"] / protein_target, 1.5) / 1.5

    carb_ceiling = (
        getattr(budget, "carb_ceiling_g", 0) or getattr(budget, "sugar_ceiling_g", 0) or 0
    ) / per_meal
    if carb_ceiling > 0:
        checks += 1
        score += 1.0 if nutrition["carbs"] <= carb_ceiling else max(0, 1 - (nutrition["carbs"] / carb_ceiling - 1))

    fiber_target = (getattr(budget, "fiber_floor_g", 0) or 0) / per_meal
    if fiber_target > 0:
        checks += 1
        score += min(nutrition["fiber"] / fiber_target, 1.5) / 1.5

    cal_target = (getattr(budget, "calorie_target_kcal", 0) or 0) / per_meal
    if cal_target > 0:
        checks += 1
        score += max(0, 1 - abs(nutrition["calories"] / cal_target - 1))

    return score / checks if checks > 0 else 0.5


def _time_class(recipe: Recipe) -> str:
    """Classify recipe by total cook time."""
    total = (recipe.total_time_min or 0) or (
        (recipe.prep_time_min or 0) + (recipe.cook_time_min or 0)
    )
    if total <= 20:
        return "quick"
    if total <= 35:
        return "medium"
    return "long"


def _candidate_pool(
    all_recipes: list[Recipe],
    recipe_index: dict[str, Recipe],
    meal_type: str,
    dietary: list[str],
    allergies: list[str],
    disliked_ingredients: list[str],
    liked_ingredients: list[str],
    flavor_preferences: list[str],
    liked_proteins: list[str],
    disliked_proteins: list[str],
    preferred_recipe_ids: set[str],
    avoided_recipe_ids: set[str],
    budget: Any,
    cooking_time_budget: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    allergy_lower = _expand_allergies(allergies)
    disliked_ingredients_lower = {d.lower() for d in disliked_ingredients}
    disliked_proteins_lower = {p.lower() for p in disliked_proteins}

    ranked: list[dict[str, Any]] = []
    for recipe in all_recipes:
        if meal_type not in (recipe.tags or []):
            continue
        if (recipe.recipe_role or "full_meal") != "full_meal" or bool(recipe.is_component):
            continue
        if recipe.is_mes_scoreable is False:
            continue
        if not _matches_dietary(recipe, dietary):
            continue
        if str(recipe.id) in avoided_recipe_ids:
            continue
        if meal_type == "breakfast" and not _is_breakfast_safe(recipe, {"budget": budget}):
            continue

        ingredient_names = " ".join(ing.get("name", "") for ing in (recipe.ingredients or [])).lower()
        if any(a in ingredient_names for a in allergy_lower):
            continue
        if any(d in ingredient_names for d in disliked_ingredients_lower):
            continue
        if any(d in ingredient_names for d in disliked_proteins_lower):
            continue

        mes = _meal_display_mes(recipe, budget, recipe_index)
        preference_score = _preference_alignment_score(
            recipe=recipe,
            dietary=dietary,
            flavor_preferences=flavor_preferences,
            liked_ingredients=liked_ingredients,
            liked_proteins=liked_proteins,
            preferred_recipe_ids=preferred_recipe_ids,
        )
        display_score = float(mes.get("display_score", 0) or 0)
        budget_score = _budget_alignment_score(recipe, budget)

        # Cooking time preference (soft signal, not a hard filter)
        ctb = cooking_time_budget or {}
        total_time_slots = sum(ctb.values()) or 7
        time_bonus = (ctb.get(_time_class(recipe), 0) or 0) / total_time_slots

        ranked.append(
            {
                "recipe": recipe,
                "mes": mes,
                "display_score": display_score,
                "display_tier": mes.get("display_tier", "critical"),
                "meets_target": display_score >= TARGET_DISPLAY_MES,
                "preferred": str(recipe.id) in preferred_recipe_ids,
                "preference_score": preference_score,
                "budget_score": budget_score,
                "time_bonus": time_bonus,
                "random_tiebreak": random.random(),
            }
        )

    ranked.sort(
        key=lambda item: (
            1 if item["preferred"] else 0,
            1 if item["meets_target"] else 0,
            item["display_score"],
            item["preference_score"],
            item["budget_score"],
            item["time_bonus"],
            item["random_tiebreak"],
        ),
        reverse=True,
    )
    return ranked


def _top_unique_candidates(
    candidates: list[dict[str, Any]],
    limit: int,
    exclude_recipe_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    exclude = exclude_recipe_ids or set()
    picked: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in candidates:
        recipe_id = str(candidate["recipe"].id)
        if recipe_id in exclude or recipe_id in seen:
            continue
        picked.append(candidate)
        seen.add(recipe_id)
        if len(picked) >= limit:
            break
    return picked


def _block_lengths(unique_count: int) -> list[int]:
    """Distribute 7 days across unique recipes via round-robin."""
    if unique_count <= 0:
        return [7]
    base, remainder = divmod(7, unique_count)
    return [base + (1 if i < remainder else 0) for i in range(unique_count)]


def _prep_day_for_block(start_index: int) -> str:
    if start_index <= 2:
        return "Sunday"
    if start_index <= 5:
        return "Wednesday"
    return "Saturday"


def _meal_category_for_block(day: str, meal_type: str, repeated: bool) -> tuple[str, bool]:
    if repeated:
        return "bulk_cook", True
    if meal_type == "dinner" and day in ("Saturday", "Sunday"):
        return "sit_down", False
    return "quick", False


def _prep_summary_text(prep_day: str, recipe_title: str, covers_days: list[str], meal_type: str) -> str:
    meal_label = {
        "breakfast": "breakfasts",
        "lunch": "lunches",
        "dinner": "dinners",
    }.get(meal_type, meal_type)
    day_range = covers_days[0] if len(covers_days) == 1 else f"{covers_days[0]}-{covers_days[-1]}"
    return f"Prep {prep_day}: {recipe_title} for {day_range} {meal_label}"


def _shortlist_recipe(recipe: Recipe, mes: dict[str, Any], meal_type: str) -> dict[str, Any]:
    effective_display_score = float(mes.get("composite_display_score") or mes.get("display_score", 0) or 0)
    effective_display_tier = mes.get("composite_display_tier") or mes.get("display_tier", "critical")
    return {
        "id": str(recipe.id),
        "title": recipe.title,
        "description": recipe.description or "",
        "meal_type": meal_type,
        "total_time_min": (recipe.total_time_min or 0) or ((recipe.prep_time_min or 0) + (recipe.cook_time_min or 0)),
        "difficulty": recipe.difficulty or "easy",
        "mes_display_score": effective_display_score,
        "mes_display_tier": effective_display_tier,
        "composite_display_score": mes.get("composite_display_score"),
        "composite_display_tier": mes.get("composite_display_tier"),
        "paired_recipe_id": mes.get("paired_recipe_id"),
        "paired_recipe_title": mes.get("paired_recipe_title"),
        "meets_mes_target": effective_display_score >= TARGET_DISPLAY_MES,
        "image_url": recipe.image_url,
    }


def _recipe_to_meal_data(
    recipe: Recipe,
    meal_type: str,
    category: str,
    servings: int,
    mes: dict[str, Any],
    prep_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    display_score = float(mes.get("display_score", 0) or 0)
    effective_display_score = float(mes.get("composite_display_score") or display_score or 0)
    effective_display_tier = mes.get("composite_display_tier") or mes.get("display_tier", "critical")
    prep_meta = prep_meta or {}
    prep_group_id = prep_meta.get("prep_group_id")
    repeat_index = int(prep_meta.get("repeat_index", 0) or 0)
    return {
        "meal_type": meal_type,
        "category": category,
        "is_bulk_cook": category == "bulk_cook",
        "servings": servings if category == "bulk_cook" else recipe.servings or 1,
        "recipe": {
            "id": str(recipe.id),
            "title": recipe.title,
            "description": recipe.description or "",
            "ingredients": recipe.ingredients or [],
            "steps": recipe.steps or [],
            "prep_time_min": recipe.prep_time_min or 0,
            "cook_time_min": recipe.cook_time_min or 0,
            "servings": recipe.servings or 1,
            "difficulty": recipe.difficulty or "easy",
            "flavor_profile": recipe.flavor_profile or [],
            "dietary_tags": recipe.dietary_tags or [],
            "nutrition_estimate": _recipe_nutrition(recipe),
            "image_url": recipe.image_url,
            "mes_display_score": effective_display_score,
            "mes_display_tier": effective_display_tier,
            "composite_display_score": mes.get("composite_display_score"),
            "composite_display_tier": mes.get("composite_display_tier"),
            "paired_recipe_id": mes.get("paired_recipe_id"),
            "paired_recipe_title": mes.get("paired_recipe_title"),
            "meets_mes_target": effective_display_score >= TARGET_DISPLAY_MES,
            "prep_group_id": prep_group_id,
            "prep_day": prep_meta.get("prep_day"),
            "prep_label": prep_meta.get("prep_label"),
            "prep_window_start_day": prep_meta.get("prep_window_start_day"),
            "prep_window_end_day": prep_meta.get("prep_window_end_day"),
            "is_prep_day": bool(prep_meta.get("is_prep_day", False)),
            "is_reheat": bool(prep_meta.get("is_reheat", False)),
            "repeat_index": repeat_index,
            "prep_status": prep_meta.get("prep_status"),
        },
    }


def _day_average_display_mes(meals: list[dict[str, Any]]) -> float:
    if not meals:
        return 0.0
    total = sum(float(meal.get("recipe", {}).get("mes_display_score", 0) or 0) for meal in meals)
    return round(total / len(meals), 1)


def _quality_summary(days: list[dict[str, Any]]) -> dict[str, Any]:
    daily_averages = [_day_average_display_mes(day.get("meals", [])) for day in days]
    all_meals = [meal for day in days for meal in day.get("meals", [])]
    qualifying_meals = [meal for meal in all_meals if meal.get("recipe", {}).get("meets_mes_target")]
    days_meeting_target = sum(1 for avg in daily_averages if avg >= TARGET_DISPLAY_MES)
    weekly_average = round(sum(daily_averages) / len(daily_averages), 1) if daily_averages else 0.0

    return {
        "target_meal_display_mes": TARGET_DISPLAY_MES,
        "target_daily_average_display_mes": TARGET_DISPLAY_MES,
        "actual_weekly_average_daily_display_mes": weekly_average,
        "qualifying_meal_count": len(qualifying_meals),
        "total_meal_count": len(all_meals),
        "days_meeting_target": days_meeting_target,
        "total_days": len(days),
    }


def _preferences_context(preferences: dict[str, Any], db: Session, user_id: str | None) -> dict[str, Any]:
    protein_preferences = preferences.get("protein_preferences", {}) or {}
    return {
        "dietary": preferences.get("dietary_restrictions", []) or [],
        "allergies": preferences.get("allergies", []) or [],
        "disliked_ingredients": preferences.get("disliked_ingredients", []) or [],
        "liked_ingredients": preferences.get("liked_ingredients", []) or [],
        "flavor_preferences": preferences.get("flavor_preferences", []) or [],
        "liked_proteins": protein_preferences.get("liked", []) if isinstance(protein_preferences, dict) else [],
        "disliked_proteins": protein_preferences.get("disliked", []) if isinstance(protein_preferences, dict) else [],
        "preferred_recipe_ids": {str(item) for item in (preferences.get("preferred_recipe_ids", []) or [])},
        "avoided_recipe_ids": {str(item) for item in (preferences.get("avoided_recipe_ids", []) or [])},
        "household": int(preferences.get("household_size", 1) or 1),
        "variety_mode": preferences.get("variety_mode", "balanced") or "balanced",
        "budget": load_budget_for_user(db, user_id) if user_id else None,
        "cooking_time_budget": preferences.get("cooking_time_budget") or {},
    }


def get_shortlist_candidates(db: Session, preferences: dict, user_id: str | None = None, per_slot: int = 4) -> dict[str, Any]:
    context = _preferences_context(preferences, db, user_id)
    all_recipes = db.query(Recipe).all()
    recipe_index = {str(recipe.id): recipe for recipe in all_recipes}
    sections: list[dict[str, Any]] = []

    for slot in MEAL_SLOTS:
        candidates = _candidate_pool(
            all_recipes=all_recipes,
            recipe_index=recipe_index,
            meal_type=slot,
            dietary=context["dietary"],
            allergies=context["allergies"],
            disliked_ingredients=context["disliked_ingredients"],
            liked_ingredients=context["liked_ingredients"],
            flavor_preferences=context["flavor_preferences"],
            liked_proteins=context["liked_proteins"],
            disliked_proteins=context["disliked_proteins"],
            preferred_recipe_ids=context["preferred_recipe_ids"],
            avoided_recipe_ids=context["avoided_recipe_ids"],
            budget=context["budget"],
            cooking_time_budget=context["cooking_time_budget"],
        )
        items = [
            _shortlist_recipe(candidate["recipe"], candidate["mes"], slot)
            for candidate in _top_unique_candidates(candidates, per_slot)
        ]
        sections.append({"meal_type": slot, "items": items})

    return {"sections": sections}


def get_replacement_candidates(
    db: Session,
    preferences: dict,
    meal_type: str,
    user_id: str | None = None,
    exclude_recipe_ids: set[str] | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    context = _preferences_context(preferences, db, user_id)
    all_recipes = db.query(Recipe).all()
    recipe_index = {str(recipe.id): recipe for recipe in all_recipes}
    candidates = _candidate_pool(
        all_recipes=all_recipes,
        recipe_index=recipe_index,
        meal_type=meal_type,
        dietary=context["dietary"],
        allergies=context["allergies"],
        disliked_ingredients=context["disliked_ingredients"],
        liked_ingredients=context["liked_ingredients"],
        flavor_preferences=context["flavor_preferences"],
        liked_proteins=context["liked_proteins"],
        disliked_proteins=context["disliked_proteins"],
        preferred_recipe_ids=context["preferred_recipe_ids"],
        avoided_recipe_ids=context["avoided_recipe_ids"],
        budget=context["budget"],
        cooking_time_budget=context["cooking_time_budget"],
    )
    return _top_unique_candidates(candidates, limit, exclude_recipe_ids=exclude_recipe_ids)


_KETO_DIETS = {"keto", "ketogenic", "low-carb", "low carb"}
_PALEO_DIETS = {"paleo", "primal"}

# Carb components that are paleo-safe (tubers, not grains/legumes)
_PALEO_SAFE_CARB_KEYWORDS = {"sweet potato", "plantain", "squash", "yam", "cassava", "taro"}


def _compose_component_meals(
    all_recipes: list[Recipe],
    recipe_index: dict[str, Recipe],
    dietary: list[str],
    allergies: list[str],
    disliked_ingredients: list[str],
    disliked_proteins: list[str],
    budget: Any,
    meal_type: str,
) -> list[dict[str, Any]]:
    """Build composed meals from protein_base + veg_side (+ optional carb for paleo).

    Used as a fallback when full_meal candidates are insufficient for keto/paleo.
    """
    dietary_lower = {d.lower() for d in dietary if d}
    is_keto = bool(dietary_lower & _KETO_DIETS)
    is_paleo = bool(dietary_lower & _PALEO_DIETS)

    if not is_keto and not is_paleo:
        return []

    allergy_expanded = _expand_allergies(allergies)
    disliked_lower = {d.lower() for d in disliked_ingredients}
    disliked_p_lower = {p.lower() for p in disliked_proteins}

    def _passes_filters(recipe: Recipe) -> bool:
        ingredient_text = _recipe_ingredient_text(recipe)
        if any(a in ingredient_text for a in allergy_expanded):
            return False
        if any(d in ingredient_text for d in disliked_lower):
            return False
        if any(d in ingredient_text for d in disliked_p_lower):
            return False
        # Check dietary compatibility (keto/paleo) on each component
        for diet in dietary_lower:
            if diet in _NON_RESTRICTIVE_DIETS:
                continue
            if diet not in {t.lower() for t in (recipe.dietary_tags or [])}:
                if not _infer_dietary_compatibility(recipe, diet):
                    return False
        return True

    # Collect protein bases and veg sides
    proteins = [r for r in all_recipes if r.recipe_role == "protein_base" and _passes_filters(r)]
    vegs = [r for r in all_recipes if r.recipe_role == "veg_side" and _passes_filters(r)]

    # For paleo, also collect paleo-safe carb components
    paleo_carbs: list[Recipe] = []
    if is_paleo:
        for r in all_recipes:
            if r.recipe_role != "carb_base":
                continue
            if not _passes_filters(r):
                continue
            ing_text = _recipe_ingredient_text(r)
            if any(kw in ing_text for kw in _PALEO_SAFE_CARB_KEYWORDS):
                paleo_carbs.append(r)

    composed: list[dict[str, Any]] = []
    random.shuffle(proteins)
    random.shuffle(vegs)

    for protein in proteins:
        for veg in vegs:
            p_nutr = _recipe_nutrition(protein)
            v_nutr = _recipe_nutrition(veg)
            combined_nutr = _combine_nutrition(p_nutr, v_nutr)

            # For keto, skip if combined carbs > 20g
            if is_keto and combined_nutr.get("carbs", 0) > 20:
                continue

            # For paleo with carb, combine all three
            if is_paleo and paleo_carbs:
                carb = random.choice(paleo_carbs)
                c_nutr = _recipe_nutrition(carb)
                combined_nutr = _combine_nutrition(p_nutr, v_nutr, c_nutr)
                combined_title = f"{protein.title} + {veg.title} + {carb.title}"
                component_ids = [str(protein.id), str(veg.id), str(carb.id)]
                combined_ingredients = (protein.ingredients or []) + (veg.ingredients or []) + (carb.ingredients or [])
            else:
                combined_title = f"{protein.title} + {veg.title}"
                component_ids = [str(protein.id), str(veg.id)]
                combined_ingredients = (protein.ingredients or []) + (veg.ingredients or [])

            # Compute MES for combined nutrition
            mes_result = compute_meal_mes(combined_nutr, budget) if budget else {}
            display_score = float(mes_result.get("display_score", 0) or 0)

            composed.append({
                "recipe": protein,  # primary recipe for metadata
                "mes": {
                    **mes_result,
                    "display_score": display_score,
                    "display_tier": mes_result.get("display_tier", "critical"),
                    "composite_display_score": display_score,
                    "composite_display_tier": display_tier(display_score),
                    "paired_recipe_id": str(veg.id),
                    "paired_recipe_title": veg.title,
                },
                "preference_score": 0,
                "budget_alignment": 0,
                "time_bonus": 0,
                "tiebreak": random.random(),
                "is_composed": True,
                "composed_title": combined_title,
                "component_ids": component_ids,
                "composed_nutrition": combined_nutr,
                "composed_ingredients": combined_ingredients,
            })

    # Sort by MES score descending
    composed.sort(key=lambda c: float(c["mes"].get("display_score", 0) or 0), reverse=True)
    return composed


def generate_fallback_meal_plan(db: Session, preferences: dict, user_id: str | None = None) -> dict[str, Any]:
    """Build a 7-day plan from DB recipes without LLMs or substitutions."""
    context = _preferences_context(preferences, db, user_id)
    all_recipes = db.query(Recipe).all()
    recipe_index = {str(recipe.id): recipe for recipe in all_recipes}

    dietary_lower = {d.lower() for d in context["dietary"] if d}
    needs_composition = bool(dietary_lower & (_KETO_DIETS | _PALEO_DIETS))

    slot_pools: dict[str, list[dict[str, Any]]] = {}
    for slot in MEAL_SLOTS:
        pool = _candidate_pool(
            all_recipes=all_recipes,
            recipe_index=recipe_index,
            meal_type=slot,
            dietary=context["dietary"],
            allergies=context["allergies"],
            disliked_ingredients=context["disliked_ingredients"],
            liked_ingredients=context["liked_ingredients"],
            flavor_preferences=context["flavor_preferences"],
            liked_proteins=context["liked_proteins"],
            disliked_proteins=context["disliked_proteins"],
            preferred_recipe_ids=context["preferred_recipe_ids"],
            avoided_recipe_ids=context["avoided_recipe_ids"],
            budget=context["budget"],
            cooking_time_budget=context["cooking_time_budget"],
        )

        # If pool is too small and user needs keto/paleo, supplement with composed meals
        if needs_composition and len(pool) < 3:
            composed = _compose_component_meals(
                all_recipes=all_recipes,
                recipe_index=recipe_index,
                dietary=context["dietary"],
                allergies=context["allergies"],
                disliked_ingredients=context["disliked_ingredients"],
                disliked_proteins=context["disliked_proteins"],
                budget=context["budget"],
                meal_type=slot,
            )
            pool.extend(composed)

        slot_pools[slot] = pool

    days_map: dict[str, list[dict[str, Any]]] = {day: [] for day in DAYS}
    prep_timeline: list[dict[str, Any]] = []
    warnings: list[str] = []

    for slot in MEAL_SLOTS:
        unique_limit = VARIETY_LIMITS.get(context["variety_mode"], VARIETY_LIMITS["balanced"]).get(slot, 3)
        selected_candidates = _top_unique_candidates(slot_pools[slot], unique_limit)
        if not selected_candidates:
            warnings.append(f"No {slot} recipes could be selected for this plan.")
            continue

        # Round-robin assignment: spread each recipe across non-consecutive days
        day_assignments: list[tuple[dict, list[str]]] = []
        for idx, candidate in enumerate(selected_candidates):
            assigned_days = [DAYS[d] for d in range(idx, 7, len(selected_candidates))]
            day_assignments.append((candidate, assigned_days))

        for candidate, covers_days in day_assignments:
            recipe = candidate["recipe"]
            mes = candidate["mes"]
            block_length = len(covers_days)
            repeated = (
                block_length > 1
                and context["variety_mode"] in {"prep_heavy", "balanced"}
                and _is_bulk_cook_suitable(recipe)
            )

            prep_meta_base: dict[str, Any] = {}
            if repeated and covers_days:
                prep_group_id = str(uuid.uuid4())
                prep_day = _prep_day_for_block(DAYS.index(covers_days[0]))
                prep_meta_base = {
                    "prep_group_id": prep_group_id,
                    "prep_day": prep_day,
                    "prep_label": f"Prep {prep_day}",
                    "prep_window_start_day": covers_days[0],
                    "prep_window_end_day": covers_days[-1],
                }
                pairing_title = mes.get("paired_recipe_title") if recipe.needs_default_pairing else None
                display_title = f"{recipe.title} + {pairing_title}" if pairing_title else recipe.title
                prep_entry: dict[str, Any] = {
                    "prep_group_id": prep_group_id,
                    "recipe_id": str(recipe.id),
                    "recipe_title": recipe.title,
                    "meal_type": slot,
                    "prep_day": prep_day,
                    "covers_days": covers_days,
                    "servings_to_make": context["household"] * len(covers_days),
                    "summary_text": _prep_summary_text(prep_day, display_title, covers_days, slot),
                }
                if pairing_title:
                    prep_entry["pairing_title"] = pairing_title
                prep_timeline.append(prep_entry)

            for offset, day in enumerate(covers_days):
                category, is_bulk = _meal_category_for_block(day, slot, repeated)
                prep_meta = {
                    **prep_meta_base,
                    "is_prep_day": False,
                    "is_reheat": repeated and offset > 0,
                    "repeat_index": offset,
                    "prep_status": "reheat" if repeated and offset > 0 else ("prepped" if repeated else None),
                }
                meal_data = _recipe_to_meal_data(
                    recipe=recipe,
                    meal_type=slot,
                    category=category,
                    servings=context["household"],
                    mes=mes,
                    prep_meta=prep_meta,
                )
                meal_data["is_bulk_cook"] = is_bulk

                # Handle composed meals (keto/paleo component combinations)
                if candidate.get("is_composed"):
                    meal_data["recipe"]["title"] = candidate["composed_title"]
                    meal_data["recipe"]["ingredients"] = candidate.get("composed_ingredients", [])
                    meal_data["recipe"]["nutrition_estimate"] = candidate.get("composed_nutrition", {})
                    meal_data["recipe"]["component_ids"] = candidate.get("component_ids", [])
                    meal_data["recipe"]["is_composed"] = True
                # Embed pairing ingredients for grocery list
                elif recipe.needs_default_pairing and recipe.default_pairing_ids:
                    pairing_id = recipe.default_pairing_ids[0] if recipe.default_pairing_ids else None
                    if pairing_id:
                        pairing_recipe = db.query(Recipe).filter(Recipe.id == pairing_id).first()
                        if pairing_recipe:
                            meal_data["recipe"]["pairing_ingredients"] = pairing_recipe.ingredients or []

                days_map[day].append(meal_data)

    days_list: list[dict[str, Any]] = []
    for day in DAYS:
        meals = sorted(days_map.get(day, []), key=lambda meal: MEAL_SLOTS.index(meal["meal_type"]))
        days_list.append({"day": day, "meals": meals})

    quality_summary = _quality_summary(days_list)
    if quality_summary["qualifying_meal_count"] < quality_summary["total_meal_count"]:
        warnings.append("Some meal slots could not reach the 70+ MES target with the current recipe library.")
    if quality_summary["days_meeting_target"] < quality_summary["total_days"]:
        warnings.append("Some days fell below the 70+ average MES target; best available meals were used.")

    deduped_warnings = list(dict.fromkeys(warnings))
    return {
        "days": days_list,
        "quality_summary": quality_summary,
        "warnings": deduped_warnings,
        "prep_timeline": prep_timeline,
    }
