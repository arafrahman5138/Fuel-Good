from __future__ import annotations

import base64
import json
import logging
import re
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.nutrition import FoodLog
from app.models.recipe import Recipe
from app.services.metabolic_engine import (
    classify_meal_context,
    compute_meal_mes,
    compute_meal_mes_with_pairing,
    load_budget_for_user,
    should_score_meal,
)
from app.services.whole_food_scoring import analyze_whole_food_product


settings = get_settings()
logger = logging.getLogger(__name__)
MEAL_SCAN_PROMPT_VERSION = "meal_scan_v3_fast"

SNACK_CALORIE_CEILING = 250.0
SNACK_CARB_CEILING = 18.0
SNACK_SUGAR_CEILING = 10.0
SNACK_PROTEIN_FLOOR = 12.0
SNACK_FRUIT_CALORIE_CEILING = 400.0

# Fruit/produce keywords for snack detection
FRUIT_LABEL_KEYWORDS = {"fruit", "berries", "melon", "salad", "produce", "bowl"}
FRUIT_INGREDIENT_KEYWORDS = {
    "apple", "orange", "grape", "berry", "berries", "melon", "watermelon",
    "banana", "mango", "pineapple", "strawberry", "blueberry", "raspberry",
    "kiwi", "peach", "plum", "pear", "cherry", "fig", "papaya", "lychee",
    "pomegranate", "grapefruit", "tangerine", "clementine", "guava",
}

PORTION_MULTIPLIERS = {
    "small": 0.8,
    "medium": 1.0,
    "large": 1.25,
}

COMPONENT_MACROS: dict[str, dict[str, float]] = {
    "chicken": {"calories": 180, "protein": 30, "carbs": 0, "fat": 7, "fiber": 0},
    "chicken thigh": {"calories": 210, "protein": 24, "carbs": 0, "fat": 13, "fiber": 0},
    "beef": {"calories": 240, "protein": 24, "carbs": 0, "fat": 16, "fiber": 0},
    "ground beef": {"calories": 270, "protein": 24, "carbs": 0, "fat": 19, "fiber": 0},
    "lamb": {"calories": 260, "protein": 23, "carbs": 0, "fat": 18, "fiber": 0},
    "salmon": {"calories": 210, "protein": 22, "carbs": 0, "fat": 13, "fiber": 0},
    "tuna": {"calories": 150, "protein": 30, "carbs": 0, "fat": 3, "fiber": 0},
    "turkey": {"calories": 170, "protein": 28, "carbs": 0, "fat": 6, "fiber": 0},
    "eggs": {"calories": 160, "protein": 13, "carbs": 1, "fat": 11, "fiber": 0},
    "egg whites": {"calories": 80, "protein": 17, "carbs": 1, "fat": 0, "fiber": 0},
    "greek yogurt": {"calories": 150, "protein": 20, "carbs": 9, "fat": 5, "fiber": 0},
    "rice": {"calories": 205, "protein": 4, "carbs": 45, "fat": 0, "fiber": 1},
    "brown rice": {"calories": 215, "protein": 5, "carbs": 45, "fat": 2, "fiber": 3},
    "quinoa": {"calories": 220, "protein": 8, "carbs": 39, "fat": 4, "fiber": 5},
    "potatoes": {"calories": 160, "protein": 4, "carbs": 37, "fat": 0, "fiber": 4},
    "sweet potato": {"calories": 180, "protein": 4, "carbs": 41, "fat": 0, "fiber": 6},
    "pasta": {"calories": 220, "protein": 8, "carbs": 43, "fat": 2, "fiber": 3},
    "beans": {"calories": 140, "protein": 8, "carbs": 24, "fat": 1, "fiber": 8},
    "black beans": {"calories": 140, "protein": 8, "carbs": 24, "fat": 1, "fiber": 8},
    "lentils": {"calories": 180, "protein": 12, "carbs": 31, "fat": 1, "fiber": 10},
    "bread": {"calories": 160, "protein": 6, "carbs": 30, "fat": 2, "fiber": 3},
    "bun": {"calories": 170, "protein": 6, "carbs": 31, "fat": 3, "fiber": 2},
    "tortilla": {"calories": 140, "protein": 4, "carbs": 24, "fat": 4, "fiber": 2},
    "cheese": {"calories": 110, "protein": 7, "carbs": 1, "fat": 9, "fiber": 0},
    "feta": {"calories": 80, "protein": 4, "carbs": 1, "fat": 6, "fiber": 0},
    "avocado": {"calories": 120, "protein": 2, "carbs": 6, "fat": 11, "fiber": 5},
    "olive oil": {"calories": 120, "protein": 0, "carbs": 0, "fat": 14, "fiber": 0},
    "salad": {"calories": 70, "protein": 2, "carbs": 10, "fat": 3, "fiber": 4},
    "vegetables": {"calories": 60, "protein": 2, "carbs": 11, "fat": 1, "fiber": 4},
    "broccoli": {"calories": 55, "protein": 4, "carbs": 11, "fat": 1, "fiber": 5},
    "spinach": {"calories": 35, "protein": 4, "carbs": 4, "fat": 0, "fiber": 3},
    "kale": {"calories": 45, "protein": 3, "carbs": 8, "fat": 1, "fiber": 3},
    "berries": {"calories": 45, "protein": 1, "carbs": 11, "fat": 0, "fiber": 3},
    "chia": {"calories": 60, "protein": 2, "carbs": 5, "fat": 4, "fiber": 5},
    "almond butter": {"calories": 100, "protein": 3, "carbs": 3, "fat": 9, "fiber": 2},
}

ALIASES = {
    "shawarma chicken": "chicken",
    "grilled chicken": "chicken",
    "roasted chicken": "chicken",
    "beef patty": "beef",
    "meat patty": "patty",
    "meat patties": "patties",
    "chicken patty": "chicken patties",
    "burger bun": "bun",
    "white rice": "rice",
    "kachumber": "salad",
    "mixed greens": "salad",
    "leafy greens": "salad",
    "plain greek yogurt": "greek yogurt",
    "yogurt sauce": "greek yogurt",
    "chia seeds": "chia",
}

MEAL_SCAN_PROMPT = """You analyze one meal photo for a nutrition app.
Return strict JSON only with this exact shape:
{
  "not_food": false,
  "not_food_reason": "",
  "meal_label": "short dish name",
  "meal_type_guess": "breakfast|lunch|dinner|snack",
  "source_context_guess": "home|restaurant",
  "portion_size": "small|medium|large",
  "preparation_style": "grilled|fried|baked|fresh|mixed|unknown",
  "confidence": 0.0,
  "confidence_breakdown": {
    "extraction": 0.0,
    "portion": 0.0
  },
  "components": [
    {
      "name": "component or ingredient",
      "role": "protein|carb|veg|fat|sauce|dessert|other|fruit",
      "portion_factor": 1.0,
      "visible": true,
      "confidence": 0.0
    }
  ],
  "possible_hidden_ingredients": [
    {
      "name": "ingredient",
      "reason": "short reason",
      "confidence": 0.0
    }
  ]
}

Rules:
- If the image clearly does not contain food (e.g. keys, phone, hands, objects, scenery), set not_food to true and not_food_reason to a short description of what you see. Leave all other fields as defaults.
- prefer concrete food names over vague labels
- use 0.25 to 1.5 for portion_factor
- if uncertain, choose medium confidence and say unknown less often than inventing ingredients
- meal_label should be consumer friendly
- use role "fruit" for fruit components (apple, banana, grapes, berries, melon, etc.)
- keep the response compact and avoid extra explanation text
"""


def _normalize_name(name: str) -> str:
    value = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    value = re.sub(r"\s+", " ", value).strip()
    return ALIASES.get(value, value)


def _titleize_name(value: str) -> str:
    return " ".join(part.capitalize() for part in (value or "").split())


def _estimate_sugar_g(nutrition: dict[str, float]) -> float:
    return max(0.0, round(float(nutrition.get("carbs", 0) or 0) * 0.18, 1))


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


async def _call_gemini_meal_extractor(
    image_bytes: bytes,
    mime_type: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    api_key = settings.google_api_key or settings.gemini_api_key
    if not api_key:
        raise RuntimeError("Gemini API key is not configured.")

    prompt = MEAL_SCAN_PROMPT + "\n\nContext:\n" + json.dumps(context, indent=2)
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.scan_model or settings.gemini_model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("No scan candidate returned.")
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    text_part = next((part.get("text") for part in parts if part.get("text")), None)
    if not text_part:
        raise RuntimeError("No scan payload returned.")
    return _extract_json(text_part)


def _eligible_pairing_recipe(recipe: Recipe | None) -> bool:
    return bool(recipe and getattr(recipe, "pairing_synergy_profile", None))


def _pairing_rank_for_scan(recipe: Recipe, nutrition: dict[str, float]) -> float:
    profile = getattr(recipe, "pairing_synergy_profile", None) or {}
    fiber_class = str(profile.get("fiber_class", "none") or "none").lower()
    veg_density = str(profile.get("veg_density", "none") or "none").lower()
    score = {"none": 0.0, "low": 1.0, "med": 2.0, "high": 3.0}.get(fiber_class, 0.0)
    score += {"none": 0.0, "low": 0.0, "med": 1.0, "high": 2.0}.get(veg_density, 0.0)
    if bool(profile.get("acid")):
        score += 1.5
    if bool(profile.get("healthy_fat")):
        score += 1.0
    if str(profile.get("recommended_timing", "with_meal")).lower() == "before_meal":
        score += 0.5

    fiber = float(nutrition.get("fiber", 0) or 0)
    fat = float(nutrition.get("fat", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    net_carbs = max(0.0, carbs - fiber)
    if fiber < 8:
        score += 1.5
    if fat < 10:
        score += 0.5
    if net_carbs >= 30:
        score += 1.0
    return score


def _find_pairing_candidate(
    db: Session,
    nutrition: dict[str, float],
    matched_recipe: Recipe | None,
    budget: Any,
) -> dict[str, Any] | None:
    candidates: list[Recipe] = []
    if matched_recipe is not None:
        default_ids = [str(v) for v in (getattr(matched_recipe, "default_pairing_ids", None) or []) if v]
        if default_ids:
            defaults = db.query(Recipe).filter(Recipe.id.in_(default_ids)).all()
            candidates.extend([r for r in defaults if _eligible_pairing_recipe(r)])

    if not candidates:
        fallback = db.query(Recipe).filter(
            Recipe.recipe_role.in_(["veg_side", "sauce", "carb_base", "protein_base"])
        ).all()
        candidates.extend([r for r in fallback if _eligible_pairing_recipe(r)])

    if not candidates:
        return None

    ranked = sorted(
        candidates,
        key=lambda recipe: (
            -_pairing_rank_for_scan(recipe, nutrition),
            recipe.total_time_min or 0,
            recipe.title.lower(),
        ),
    )
    chosen = ranked[0]
    current_score = compute_meal_mes(nutrition, budget)
    paired = compute_meal_mes_with_pairing(
        nutrition,
        pairing_recipe=chosen,
        budget=budget,
        pairing_nutrition=chosen.nutrition_info or {},
    )
    if not paired.get("pairing_applied"):
        return None

    projected = float(((paired.get("score") or {}).get("display_score", current_score["display_score"])) or current_score["display_score"])
    delta = round(projected - float(current_score.get("display_score", 0) or 0), 1)
    if delta < 1.0:
        return None

    return {
        "pairing_opportunity": True,
        "pairing_recommended_recipe_id": str(chosen.id),
        "pairing_recommended_title": chosen.title,
        "pairing_projected_mes": round(projected, 1),
        "pairing_projected_delta": delta,
        "pairing_reasons": paired.get("pairing_reasons") or [],
        "pairing_timing": paired.get("pairing_recommended_timing", "with_meal"),
    }


def _stable_visible_components(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stable: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for component in components:
        raw_name = str(component.get("name", "")).strip()
        normalized_name = _normalize_name(raw_name)
        if not normalized_name:
            continue
        confidence = float(component.get("confidence", 0) or 0)
        visible = bool(component.get("visible", True))
        if confidence < 0.4:
            continue
        if not visible and confidence < 0.6:
            continue
        role = str(component.get("role", "other") or "other")
        key = (normalized_name, role)
        if key in seen:
            continue
        seen.add(key)
        stable.append(
            {
                **component,
                "name": normalized_name,
                "role": role,
                "confidence": confidence,
                "visible": visible,
            }
        )
    return stable


def _derive_stable_meal_label(
    raw_label: str,
    components: list[dict[str, Any]],
    matched_recipe: Recipe | None,
    recipe_match_score: float,
) -> str:
    if matched_recipe and recipe_match_score >= 0.6:
        return matched_recipe.title

    cleaned = re.sub(r"\s+", " ", (raw_label or "").strip())
    cleaned = re.sub(r"\b(with|and|in|on|over|under|w)\s*$", "", cleaned, flags=re.I).strip(" ,:-")

    generic_terms = {
        "meal",
        "scanned meal",
        "meat patty",
        "meat patties",
        "patty",
        "patties",
    }
    if cleaned and cleaned.lower() not in generic_terms:
        return cleaned

    ordered_names = [_titleize_name(str(component.get("name", ""))) for component in components if component.get("name")]
    if not ordered_names:
        return "Detected meal"
    if len(ordered_names) == 1:
        return ordered_names[0]
    return f"{ordered_names[0]} with {ordered_names[1]}"


def _lookup_component_macros(name: str) -> dict[str, float] | None:
    normalized = _normalize_name(name)
    for key, macros in COMPONENT_MACROS.items():
        if key in normalized or normalized in key:
            return macros
    return None


def _estimate_from_components(components: list[dict[str, Any]], portion_size: str) -> tuple[dict[str, float], float]:
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    matched = 0
    for component in components:
        macros = _lookup_component_macros(str(component.get("name", "")))
        if not macros:
            continue
        factor = float(component.get("portion_factor", 1.0) or 1.0)
        for key in totals:
            totals[key] += macros.get(key, 0.0) * factor
        matched += 1
    portion_multiplier = PORTION_MULTIPLIERS.get((portion_size or "medium").lower(), 1.0)
    for key in totals:
        totals[key] = round(totals[key] * portion_multiplier, 1)
    grounding_confidence = 0.35 + (0.5 * (matched / max(len(components), 1)))
    return totals, min(0.9, grounding_confidence)


def _blend_nutrition(recipe_nutrition: dict[str, float], heuristic_nutrition: dict[str, float], recipe_confidence: float) -> dict[str, float]:
    recipe_weight = min(0.8, max(0.35, recipe_confidence))
    heuristic_weight = 1.0 - recipe_weight
    blended: dict[str, float] = {}
    for key in {"calories", "protein", "carbs", "fat", "fiber"}:
        blended[key] = round(
            float(recipe_nutrition.get(key, 0) or 0) * recipe_weight
            + float(heuristic_nutrition.get(key, 0) or 0) * heuristic_weight,
            1,
        )
    return blended


def _coerce_recipe_nutrition(nutrition_info: dict[str, Any], portion_size: str) -> dict[str, float]:
    portion_multiplier = PORTION_MULTIPLIERS.get((portion_size or "medium").lower(), 1.0)
    base = {
        "calories": float(nutrition_info.get("calories", 0) or 0),
        "protein": float(nutrition_info.get("protein", 0) or nutrition_info.get("protein_g", 0) or 0),
        "carbs": float(nutrition_info.get("carbs", 0) or nutrition_info.get("carbs_g", 0) or 0),
        "fat": float(nutrition_info.get("fat", 0) or nutrition_info.get("fat_g", 0) or 0),
        "fiber": float(nutrition_info.get("fiber", 0) or nutrition_info.get("fiber_g", 0) or 0),
    }
    return {key: round(value * portion_multiplier, 1) for key, value in base.items()}


def _build_flag_objects(product_result: dict[str, Any], source_context: str, preparation_style: str) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    processing_flags = product_result.get("processing_flags") or {}
    for reason, items in processing_flags.items():
        severity = "high" if reason in {"seed_oils", "artificial_additives", "added_sugars"} else "medium"
        label = reason.rstrip("s").replace("_", " ")
        for item in items or []:
            flags.append({"ingredient": item, "reason": label, "severity": severity, "inferred": False})

    if source_context == "restaurant" and preparation_style == "fried" and not processing_flags.get("seed_oils"):
        flags.append({
            "ingredient": "restaurant frying oil",
            "reason": "likely seed oil fry medium",
            "severity": "medium",
            "inferred": True,
        })
    return flags


def _whole_food_status(product_result: dict[str, Any], flags: list[dict[str, Any]]) -> str:
    tier = product_result.get("tier")
    if tier == "whole_food" and not flags:
        return "pass"
    if tier == "ultra_processed":
        return "fail"
    high_flags = sum(1 for flag in flags if flag.get("severity") == "high")
    if high_flags >= 2:
        return "fail"
    return "warn" if flags or tier in {"solid", "mixed"} else "pass"


def _is_fruit_or_produce_meal(
    meal_label: str,
    normalized_ingredients: list[str],
    components: list[dict[str, Any]],
) -> bool:
    """Return True if the meal is predominantly fruit/produce with no protein source."""
    label_lower = (meal_label or "").lower()
    if any(kw in label_lower for kw in FRUIT_LABEL_KEYWORDS):
        return True

    # Check component roles — if AI tagged items with "fruit" role and no protein
    has_protein_component = any(
        str(c.get("role", "")).lower() == "protein" for c in (components or [])
    )
    fruit_components = sum(
        1 for c in (components or []) if str(c.get("role", "")).lower() == "fruit"
    )
    if fruit_components >= 2 and not has_protein_component:
        return True

    # Check ingredient names
    fruit_ingredient_hits = sum(
        1 for ing in normalized_ingredients
        if any(fw in ing for fw in FRUIT_INGREDIENT_KEYWORDS)
    )
    if fruit_ingredient_hits >= 2 and not has_protein_component:
        return True

    return False


def _classify_scanned_meal_context(
    meal_label: str,
    meal_type: str,
    nutrition: dict[str, float],
    normalized_ingredients: list[str],
    components: list[dict[str, Any]] | None = None,
) -> str:
    calories = float(nutrition.get("calories", 0) or 0)
    protein = float(nutrition.get("protein", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    sugar = _estimate_sugar_g(nutrition)

    if (meal_type or "").lower() == "snack":
        return "snack"

    # Fruit plates and raw produce: high natural sugar passes here even though
    # it would fail the carb/sugar ceiling check below
    if (
        calories <= SNACK_FRUIT_CALORIE_CEILING
        and protein < SNACK_PROTEIN_FLOOR
        and _is_fruit_or_produce_meal(meal_label, normalized_ingredients, components or [])
    ):
        return "snack"

    if calories <= SNACK_CALORIE_CEILING:
        if protein >= SNACK_PROTEIN_FLOOR:
            return "snack"
        if carbs <= SNACK_CARB_CEILING and sugar <= SNACK_SUGAR_CEILING and len(normalized_ingredients) <= 4:
            return "snack"

    return classify_meal_context(meal_label, meal_type, nutrition)


def _snack_profile(
    meal_context: str,
    nutrition: dict[str, float],
    whole_food_status: str,
    flags: list[dict[str, Any]],
    meal_label: str = "",
    normalized_ingredients: list[str] | None = None,
    components: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    if meal_context != "snack":
        return None
    protein = float(nutrition.get("protein", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    sugar = _estimate_sugar_g(nutrition)
    high_flags = any(str(flag.get("severity", "")) == "high" for flag in flags)
    is_fruit = _is_fruit_or_produce_meal(meal_label, normalized_ingredients or [], components or [])
    healthy = (
        whole_food_status in ("pass", "warn")
        and not high_flags
        and (
            protein >= SNACK_PROTEIN_FLOOR
            or (carbs <= SNACK_CARB_CEILING and sugar <= SNACK_SUGAR_CEILING)
            or is_fruit  # whole fruit is inherently a healthy snack
        )
    )
    return {
        "is_snack": True,
        "is_healthy_snack": healthy,
        "label": "Healthy snack" if healthy else "Snack",
    }


def _upgrade_suggestions(
    flags: list[dict[str, Any]],
    nutrition: dict[str, float],
    preparation_style: str,
    mes_score: float | None = None,
    meal_context: str | None = None,
    pairing_recommendation: dict[str, Any] | None = None,
) -> list[str]:
    suggestions: list[str] = []
    reasons = {flag.get("reason", "") for flag in flags}
    protein = float(nutrition.get("protein", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    fat = float(nutrition.get("fat", 0) or 0)
    fiber = float(nutrition.get("fiber", 0) or 0)
    net_carbs = max(0.0, carbs - fiber)

    if meal_context == "snack":
        if "likely seed oil fry medium" in reasons or "seed oil" in reasons or preparation_style == "fried":
            suggestions.append("Pick a less fried snack next time so it stays lighter and less processed.")
        if "added sugar" in reasons:
            suggestions.append("Choose a snack with less added sugar or pair the sweet item with protein.")
        if "refined flour" in reasons:
            suggestions.append("Swap refined snack carbs for fruit, yogurt, nuts, or a more whole-food option.")
        if net_carbs >= 20 and protein < 8:
            suggestions.append("Pair fruit or other quick carbs with yogurt, cottage cheese, eggs, or nuts so the snack lasts longer.")
        elif protein < 8:
            suggestions.append("If you want this snack to hold you longer, add a little protein like yogurt, cheese, or nuts.")
        if fiber < 3 and carbs >= 12:
            suggestions.append("Add a little fiber next time with berries, chia, nuts, or crunchy vegetables.")
        if not suggestions:
            suggestions.append("This works fine as a light snack. No major upgrade needed.")
        return suggestions[:3]

    if pairing_recommendation and meal_context == "full_meal":
        title = pairing_recommendation.get("pairing_recommended_title") or "a fiber-forward side"
        delta = pairing_recommendation.get("pairing_projected_delta")
        timing = pairing_recommendation.get("pairing_timing") or "with_meal"
        timing_copy = "before the meal" if timing == "before_meal" else "with the meal"
        if delta is not None:
            suggestions.append(f"Pair this with {title} {timing_copy} for about +{round(float(delta or 0), 1)} MES.")
        else:
            suggestions.append(f"Pair this with {title} {timing_copy} to improve the MES.")

    if "likely seed oil fry medium" in reasons or "seed oil" in reasons or preparation_style == "fried":
        suggestions.append("Ask for grilled, roasted, or olive-oil based prep instead of fryer oil.")
    if "added sugar" in reasons:
        suggestions.append("Skip sweet sauces or glazes and ask for sauces on the side.")
    if "refined flour" in reasons:
        suggestions.append("Swap refined starches for potatoes, rice, beans, or extra vegetables.")
    if protein < 25:
        suggestions.append("Add a more protein-forward base next time so the meal holds you longer.")
    if fiber < 8:
        suggestions.append("Add a bean, lentil, or vegetable side to raise fiber.")
    if net_carbs >= 30 and fiber < 10:
        suggestions.append("Start with a salad or vegetables before the starch so the meal hits more gently.")
    if mes_score is not None and mes_score < 70:
        if net_carbs >= 35:
            suggestions.append("Cut the starch portion slightly or swap part of it for vegetables to improve the MES.")
        if fiber < 10:
            suggestions.append("Add greens, beans, or chia to raise fiber before repeating this meal.")
        if protein >= 25 and fat < 10 and meal_context != "snack":
            suggestions.append("Pair this with avocado, olive oil, or a whole-food fat so the meal feels steadier.")
    return suggestions[:3]


def _today_totals(db: Session, user_id: str) -> dict[str, float]:
    today = datetime.utcnow().date()
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    logs = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == today).all()
    for log in logs:
        snap = log.nutrition_snapshot or {}
        totals["calories"] += float(snap.get("calories", 0) or 0)
        totals["protein"] += float(snap.get("protein", 0) or snap.get("protein_g", 0) or 0)
        totals["carbs"] += float(snap.get("carbs", 0) or snap.get("carbs_g", 0) or 0)
        totals["fat"] += float(snap.get("fat", 0) or snap.get("fat_g", 0) or 0)
        totals["fiber"] += float(snap.get("fiber", 0) or snap.get("fiber_g", 0) or 0)
    return totals


def _recovery_plan(
    db: Session,
    user_id: str,
    nutrition: dict[str, float],
    whole_food_status: str,
    mes_score: float | None = None,
    meal_context: str | None = None,
    pairing_recommendation: dict[str, Any] | None = None,
) -> list[str]:
    budget = load_budget_for_user(db, user_id)
    today_totals = _today_totals(db, user_id)
    plan: list[str] = []

    protein_remaining = max(0.0, float(getattr(budget, "protein_target_g", 130.0)) - today_totals["protein"])
    fiber_remaining = max(0.0, float(getattr(budget, "fiber_floor_g", 30.0)) - today_totals["fiber"])
    carb_room = max(0.0, float(getattr(budget, "sugar_ceiling_g", 200.0)) - today_totals["carbs"])
    carbs = float(nutrition.get("carbs", 0) or 0)
    fiber = float(nutrition.get("fiber", 0) or 0)
    net_carbs = max(0.0, carbs - fiber)

    if meal_context == "snack":
        if protein_remaining > 20 and float(nutrition.get("protein", 0) or 0) < 10:
            plan.append("Let your next meal do the heavy lifting with a real protein anchor.")
        if fiber_remaining > 6 and fiber < 3:
            plan.append("Use your next meal to catch up on fiber with vegetables, beans, lentils, or chia.")
        if net_carbs >= 20 and float(nutrition.get("protein", 0) or 0) < 8:
            plan.append("If this snack was mostly carbs, keep your next meal steadier with protein, fiber, and slower carbs.")
        if whole_food_status != "pass":
            plan.append(f"Keep the rest of the day a little cleaner so you preserve your remaining {round(carb_room)}g carb room.")
        if not plan:
            plan.append("No real recovery needed. Just keep your next meal balanced.")
        return plan[:3]

    if protein_remaining > 20:
        plan.append(f"Aim for about {min(40, round(protein_remaining))}g protein at your next meal.")
    if fiber_remaining > 6:
        plan.append(f"Add at least {min(12, round(fiber_remaining))}g fiber with vegetables, beans, lentils, or chia.")
    if pairing_recommendation and meal_context == "full_meal":
        title = pairing_recommendation.get("pairing_recommended_title") or "a fiber-rich side"
        timing = pairing_recommendation.get("pairing_timing") or "with_meal"
        timing_copy = "before your next similar meal" if timing == "before_meal" else "with your next similar meal"
        plan.append(f"Use {title} {timing_copy} to soften the glycemic hit.")
    if mes_score is not None and mes_score < 70:
        if net_carbs >= 30:
            plan.append("A 10-minute walk after this meal can help flatten the glycemic hit.")
        if fiber < 8:
            plan.append("Have a salad or fibrous vegetables before your next carb-heavy meal.")
    if net_carbs > 35 or whole_food_status != "pass":
        plan.append(f"Keep your next meal lower-glycemic so you protect the remaining {round(carb_room)}g carb room.")
    elif carbs > 45:
        plan.append("A 10-minute walk after this meal can help smooth out the glucose hit.")
    if mes_score is not None and mes_score < 60 and meal_context != "snack":
        plan.append("Keep your next meal simple: lean protein, greens, and a slower carb if you still need one.")

    if not plan:
        plan.append("You still have room to stay balanced today, so keep the next meal protein- and fiber-forward.")
    return plan[:3]


def _calibrated_guidance(
    upgrade_suggestions: list[str],
    recovery_plan: list[str],
    estimate_mode: str,
) -> tuple[list[str], list[str]]:
    if estimate_mode == "low":
        return (
            [
                "Review the detected ingredients before relying on this estimate.",
                "Adjust the portion size if the scan under- or over-estimated the plate.",
            ],
            [
                "Treat this as a rough estimate until you confirm the ingredients and portion.",
                "After review, rescore so the MES reflects the corrected meal.",
            ],
        )
    if estimate_mode == "medium":
        return (
            ["This looks like a reasonable estimate, but review ingredients and portion before logging."] + upgrade_suggestions[:2],
            recovery_plan[:3],
        )
    return upgrade_suggestions[:3], recovery_plan[:3]


async def analyze_meal_scan(
    db: Session,
    user_id: str,
    image_bytes: bytes,
    mime_type: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    started = datetime.utcnow()
    extracted = await _call_gemini_meal_extractor(image_bytes, mime_type, context)

    # Reject non-food images immediately
    if extracted.get("not_food"):
        return {
            "is_not_food": True,
            "not_food_reason": str(extracted.get("not_food_reason") or "No food detected in image"),
            "meal_label": "Not a food item",
            "confidence": 0.0,
        }

    components = _stable_visible_components(extracted.get("components") or [])
    estimated_ingredients = [_titleize_name(str(component.get("name", "")).strip()) for component in components if component.get("name")]
    normalized_ingredients = [_normalize_name(name) for name in estimated_ingredients]
    hidden_ingredients = [
        str(item.get("name", "")).strip()
        for item in (extracted.get("possible_hidden_ingredients") or [])
        if item.get("name") and float(item.get("confidence", 0) or 0) >= 0.55
    ]

    raw_meal_label = str(extracted.get("meal_label") or "Scanned meal").strip()
    source_context = str(
        context.get("source_context")
        or extracted.get("source_context_guess")
        or "home"
    ).strip().lower()
    meal_type = str(
        context.get("meal_type")
        or extracted.get("meal_type_guess")
        or "lunch"
    ).strip().lower()
    portion_size = str(
        context.get("portion_size")
        or extracted.get("portion_size")
        or "medium"
    ).strip().lower()
    preparation_style = str(extracted.get("preparation_style") or "unknown").strip().lower()

    heuristic_nutrition, heuristic_confidence = _estimate_from_components(components, portion_size)
    nutrition = heuristic_nutrition
    grounding_confidence = heuristic_confidence
    meal_label = _derive_stable_meal_label(raw_meal_label, components, None, 0.0)

    ingredients_text = ", ".join(normalized_ingredients + hidden_ingredients)
    product_result = analyze_whole_food_product(
        {
            "ingredients_text": ingredients_text,
            "calories": nutrition.get("calories", 0),
            "protein_g": nutrition.get("protein", 0),
            "fiber_g": nutrition.get("fiber", 0),
            "carbs_g": nutrition.get("carbs", 0),
            "sugar_g": _estimate_sugar_g(nutrition),
            "sodium_mg": 420 if source_context == "restaurant" else 220,
        }
    )
    flags = _build_flag_objects(product_result, source_context, preparation_style)
    whole_food_status = _whole_food_status(product_result, flags)

    meal_context = _classify_scanned_meal_context(meal_label, meal_type, nutrition, normalized_ingredients, components)
    mes = None
    pairing_recommendation = None
    if should_score_meal(meal_context):
        budget = load_budget_for_user(db, user_id)
        result = compute_meal_mes(nutrition, budget)
        mes = {
            "score": result["display_score"],
            "tier": result["display_tier"],
            "sub_scores": result.get("sub_scores") or {},
        }
        pairing_recommendation = _find_pairing_candidate(db, nutrition, None, budget)

    snack_profile = _snack_profile(meal_context, nutrition, whole_food_status, flags, meal_label, normalized_ingredients, components)

    estimate_mode = "high" if grounding_confidence >= 0.75 else ("medium" if grounding_confidence >= 0.5 else "low")
    confidence_breakdown = {
        "extraction": float((extracted.get("confidence_breakdown") or {}).get("extraction", extracted.get("confidence", 0.72)) or 0.72),
        "portion": float((extracted.get("confidence_breakdown") or {}).get("portion", 0.68) or 0.68),
        "grounding": round(grounding_confidence, 2),
        "nutrition": round(grounding_confidence, 2),
        "estimate_mode": estimate_mode,
        "review_required": estimate_mode == "low",
    }
    confidence = round(
        (
            confidence_breakdown["extraction"] * 0.4
            + confidence_breakdown["portion"] * 0.2
            + confidence_breakdown["nutrition"] * 0.3
            + confidence_breakdown["grounding"] * 0.1
        ),
        2,
    )

    upgrade_suggestions, recovery_plan = _calibrated_guidance(
        _upgrade_suggestions(
            flags,
            nutrition,
            preparation_style,
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        _recovery_plan(
            db,
            user_id,
            nutrition,
            whole_food_status,
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        estimate_mode,
    )

    result = {
        "meal_label": meal_label,
        "meal_type": meal_type,
        "meal_context": meal_context,
        "portion_size": portion_size,
        "source_context": source_context,
        "preparation_style": preparation_style,
        "estimated_ingredients": estimated_ingredients,
        "normalized_ingredients": normalized_ingredients + hidden_ingredients,
        "nutrition_estimate": nutrition,
        "whole_food_status": whole_food_status,
        "whole_food_flags": flags,
        "suggested_swaps": product_result.get("processing_flags") or {},
        "mes": mes,
        "snack_profile": snack_profile,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "upgrade_suggestions": upgrade_suggestions,
        "recovery_plan": recovery_plan,
        "source_model": settings.scan_model or settings.gemini_model,
        "prompt_version": MEAL_SCAN_PROMPT_VERSION,
        "grounding_source": None,
        "grounding_candidates": [],
        "grounding_provider": None,
        "matched_recipe_id": None,
        "matched_recipe_title": None,
        "matched_recipe_confidence": None,
        "whole_food_summary": product_result.get("summary"),
        "pairing_opportunity": bool((pairing_recommendation or {}).get("pairing_opportunity")),
        "pairing_recommended_recipe_id": (pairing_recommendation or {}).get("pairing_recommended_recipe_id"),
        "pairing_recommended_title": (pairing_recommendation or {}).get("pairing_recommended_title"),
        "pairing_projected_mes": (pairing_recommendation or {}).get("pairing_projected_mes"),
        "pairing_projected_delta": (pairing_recommendation or {}).get("pairing_projected_delta"),
        "pairing_reasons": (pairing_recommendation or {}).get("pairing_reasons") or [],
        "pairing_timing": (pairing_recommendation or {}).get("pairing_timing"),
    }
    logger.info(
        "meal_scan.completed bytes=%s extraction_model=%s total_ms=%s",
        len(image_bytes),
        settings.scan_model or settings.gemini_model,
        int((datetime.utcnow() - started).total_seconds() * 1000),
    )
    return result


async def recompute_meal_scan(
    db: Session,
    user_id: str,
    meal_label: str,
    meal_type: str,
    portion_size: str,
    source_context: str,
    ingredients: list[str],
    existing_source_model: str | None = None,
) -> dict[str, Any]:
    normalized_ingredients = [_normalize_name(x) for x in ingredients if x.strip()]
    synthetic_components = [{"name": ingredient, "portion_factor": 1.0} for ingredient in normalized_ingredients]
    heuristic_nutrition, heuristic_confidence = _estimate_from_components(synthetic_components, portion_size)
    nutrition = heuristic_nutrition
    grounding_confidence = heuristic_confidence
    meal_label = _derive_stable_meal_label(meal_label, synthetic_components, None, 0.0)

    product_result = analyze_whole_food_product(
        {
            "ingredients_text": ", ".join(normalized_ingredients),
            "calories": nutrition.get("calories", 0),
            "protein_g": nutrition.get("protein", 0),
            "fiber_g": nutrition.get("fiber", 0),
            "carbs_g": nutrition.get("carbs", 0),
            "sugar_g": _estimate_sugar_g(nutrition),
            "sodium_mg": 420 if source_context == "restaurant" else 220,
        }
    )
    flags = _build_flag_objects(product_result, source_context, "mixed")
    whole_food_status = _whole_food_status(product_result, flags)

    meal_context = _classify_scanned_meal_context(meal_label, meal_type, nutrition, normalized_ingredients, [])
    mes = None
    pairing_recommendation = None
    if should_score_meal(meal_context):
        budget = load_budget_for_user(db, user_id)
        result = compute_meal_mes(nutrition, budget)
        mes = {
            "score": result["display_score"],
            "tier": result["display_tier"],
            "sub_scores": result.get("sub_scores") or {},
        }
        pairing_recommendation = _find_pairing_candidate(db, nutrition, None, budget)

    snack_profile = _snack_profile(meal_context, nutrition, whole_food_status, flags, meal_label, normalized_ingredients, [])

    estimate_mode = "high" if grounding_confidence >= 0.75 else ("medium" if grounding_confidence >= 0.5 else "low")
    confidence_breakdown = {
        "extraction": 0.7,
        "portion": 0.75,
        "grounding": round(grounding_confidence, 2),
        "nutrition": round(grounding_confidence, 2),
        "estimate_mode": estimate_mode,
        "review_required": estimate_mode == "low",
    }
    confidence = round(
        confidence_breakdown["extraction"] * 0.3
        + confidence_breakdown["portion"] * 0.2
        + confidence_breakdown["nutrition"] * 0.4
        + confidence_breakdown["grounding"] * 0.1,
        2,
    )

    upgrade_suggestions, recovery_plan = _calibrated_guidance(
        _upgrade_suggestions(
            flags,
            nutrition,
            "mixed",
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        _recovery_plan(
            db,
            user_id,
            nutrition,
            whole_food_status,
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        estimate_mode,
    )

    return {
        "meal_label": meal_label,
        "meal_type": meal_type,
        "meal_context": meal_context,
        "portion_size": portion_size,
        "source_context": source_context,
        "estimated_ingredients": ingredients,
        "normalized_ingredients": normalized_ingredients,
        "nutrition_estimate": nutrition,
        "whole_food_status": whole_food_status,
        "suggested_swaps": product_result.get("processing_flags") or {},
        "mes": mes,
        "snack_profile": snack_profile,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "upgrade_suggestions": upgrade_suggestions,
        "recovery_plan": recovery_plan,
        "source_model": existing_source_model or settings.scan_model or settings.gemini_model,
        "prompt_version": MEAL_SCAN_PROMPT_VERSION,
        "grounding_source": None,
        "grounding_candidates": [],
        "grounding_provider": None,
        "matched_recipe_id": None,
        "matched_recipe_title": None,
        "matched_recipe_confidence": None,
        "whole_food_summary": product_result.get("summary"),
        "pairing_opportunity": bool((pairing_recommendation or {}).get("pairing_opportunity")),
        "pairing_recommended_recipe_id": (pairing_recommendation or {}).get("pairing_recommended_recipe_id"),
        "pairing_recommended_title": (pairing_recommendation or {}).get("pairing_recommended_title"),
        "pairing_projected_mes": (pairing_recommendation or {}).get("pairing_projected_mes"),
        "pairing_projected_delta": (pairing_recommendation or {}).get("pairing_projected_delta"),
        "pairing_reasons": (pairing_recommendation or {}).get("pairing_reasons") or [],
        "pairing_timing": (pairing_recommendation or {}).get("pairing_timing"),
    }
