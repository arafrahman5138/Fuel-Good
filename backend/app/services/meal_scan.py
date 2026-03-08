from __future__ import annotations

import base64
import difflib
import json
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
    get_or_create_budget,
    should_score_meal,
)
from app.services.whole_food_scoring import analyze_whole_food_product


settings = get_settings()

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
      "role": "protein|carb|veg|fat|sauce|dessert|other",
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
- prefer concrete food names over vague labels
- use 0.25 to 1.5 for portion_factor
- if uncertain, choose medium confidence and say unknown less often than inventing ingredients
- meal_label should be consumer friendly
"""


def _normalize_name(name: str) -> str:
    value = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    value = re.sub(r"\s+", " ", value).strip()
    return ALIASES.get(value, value)


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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={api_key}"
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


def _recipe_signature(recipe: Recipe) -> set[str]:
    tokens = set(re.findall(r"[a-z]{3,}", (recipe.title or "").lower()))
    for ingredient in recipe.ingredients or []:
        tokens.update(re.findall(r"[a-z]{3,}", str((ingredient or {}).get("name", "")).lower()))
    return tokens


def _match_recipe(db: Session, meal_label: str, ingredients: list[str]) -> tuple[Recipe | None, float]:
    recipes = (
        db.query(Recipe)
        .filter(Recipe.recipe_role == "full_meal", Recipe.is_component.is_(False))
        .all()
    )
    label = (meal_label or "").lower().strip()
    wanted = set(re.findall(r"[a-z]{3,}", label))
    for ingredient in ingredients:
        wanted.update(re.findall(r"[a-z]{3,}", ingredient))

    best_recipe = None
    best_score = 0.0
    for recipe in recipes:
        title_similarity = difflib.SequenceMatcher(None, label, (recipe.title or "").lower()).ratio()
        signature = _recipe_signature(recipe)
        overlap = len(signature & wanted) / max(len(wanted), 1)
        score = (title_similarity * 0.6) + (overlap * 0.4)
        if score > best_score:
            best_recipe = recipe
            best_score = score
    return best_recipe, best_score


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


def _upgrade_suggestions(flags: list[dict[str, Any]], nutrition: dict[str, float], preparation_style: str) -> list[str]:
    suggestions: list[str] = []
    reasons = {flag.get("reason", "") for flag in flags}
    if "likely seed oil fry medium" in reasons or "seed oil" in reasons or preparation_style == "fried":
        suggestions.append("Ask for grilled, roasted, or olive-oil based prep instead of fryer oil.")
    if "added sugar" in reasons:
        suggestions.append("Skip sweet sauces or glazes and ask for sauces on the side.")
    if "refined flour" in reasons:
        suggestions.append("Swap refined starches for potatoes, rice, beans, or extra vegetables.")
    if nutrition.get("protein", 0) < 25:
        suggestions.append("Add a more protein-forward base next time so the meal holds you longer.")
    if nutrition.get("fiber", 0) < 8:
        suggestions.append("Add a bean, lentil, or vegetable side to raise fiber.")
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


def _recovery_plan(db: Session, user_id: str, nutrition: dict[str, float], whole_food_status: str) -> list[str]:
    budget = get_or_create_budget(db, user_id)
    today_totals = _today_totals(db, user_id)
    plan: list[str] = []

    protein_remaining = max(0.0, float(getattr(budget, "protein_target_g", 130.0)) - today_totals["protein"])
    fiber_remaining = max(0.0, float(getattr(budget, "fiber_floor_g", 30.0)) - today_totals["fiber"])
    carb_room = max(0.0, float(getattr(budget, "sugar_ceiling_g", 200.0)) - today_totals["carbs"])

    if protein_remaining > 20:
        plan.append(f"Aim for about {min(40, round(protein_remaining))}g protein at your next meal.")
    if fiber_remaining > 6:
        plan.append(f"Add at least {min(12, round(fiber_remaining))}g fiber with vegetables, beans, lentils, or chia.")
    if nutrition.get("carbs", 0) - nutrition.get("fiber", 0) > 35 or whole_food_status != "pass":
        plan.append(f"Keep your next meal lower-glycemic so you protect the remaining {round(carb_room)}g carb room.")
    elif nutrition.get("carbs", 0) > 45:
        plan.append("A 10-minute walk after this meal can help smooth out the glucose hit.")

    if not plan:
        plan.append("You still have room to stay balanced today, so keep the next meal protein- and fiber-forward.")
    return plan[:3]


async def analyze_meal_scan(
    db: Session,
    user_id: str,
    image_bytes: bytes,
    mime_type: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    extracted = await _call_gemini_meal_extractor(image_bytes, mime_type, context)

    components = extracted.get("components") or []
    estimated_ingredients = [str(component.get("name", "")).strip() for component in components if component.get("name")]
    normalized_ingredients = [_normalize_name(name) for name in estimated_ingredients]
    hidden_ingredients = [
        str(item.get("name", "")).strip()
        for item in (extracted.get("possible_hidden_ingredients") or [])
        if item.get("name") and float(item.get("confidence", 0) or 0) >= 0.55
    ]

    meal_label = str(extracted.get("meal_label") or "Scanned meal").strip()
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

    matched_recipe, recipe_match_score = _match_recipe(db, meal_label, normalized_ingredients)
    if matched_recipe and recipe_match_score >= 0.66:
        nutrition = _coerce_recipe_nutrition(matched_recipe.nutrition_info or {}, portion_size)
        grounding_source = "recipe_match"
        grounding_confidence = min(0.95, 0.55 + recipe_match_score * 0.4)
    else:
        nutrition, grounding_confidence = _estimate_from_components(components, portion_size)
        grounding_source = "heuristic_components"

    ingredients_text = ", ".join(normalized_ingredients + hidden_ingredients)
    product_result = analyze_whole_food_product(
        {
            "ingredients_text": ingredients_text,
            "calories": nutrition.get("calories", 0),
            "protein_g": nutrition.get("protein", 0),
            "fiber_g": nutrition.get("fiber", 0),
            "carbs_g": nutrition.get("carbs", 0),
            "sugar_g": max(0.0, nutrition.get("carbs", 0) * 0.18),
            "sodium_mg": 420 if source_context == "restaurant" else 220,
        }
    )
    flags = _build_flag_objects(product_result, source_context, preparation_style)
    whole_food_status = _whole_food_status(product_result, flags)

    meal_context = classify_meal_context(meal_label, meal_type, nutrition)
    mes = None
    if should_score_meal(meal_context):
        budget = get_or_create_budget(db, user_id)
        result = compute_meal_mes(nutrition, budget)
        mes = {
            "score": result["display_score"],
            "tier": result["display_tier"],
            "sub_scores": result.get("sub_scores") or {},
        }

    confidence_breakdown = {
        "extraction": float((extracted.get("confidence_breakdown") or {}).get("extraction", extracted.get("confidence", 0.72)) or 0.72),
        "portion": float((extracted.get("confidence_breakdown") or {}).get("portion", 0.68) or 0.68),
        "nutrition": round(grounding_confidence, 2),
    }
    confidence = round(
        (
            confidence_breakdown["extraction"] * 0.4
            + confidence_breakdown["portion"] * 0.2
            + confidence_breakdown["nutrition"] * 0.4
        ),
        2,
    )

    return {
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
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "upgrade_suggestions": _upgrade_suggestions(flags, nutrition, preparation_style),
        "recovery_plan": _recovery_plan(db, user_id, nutrition, whole_food_status),
        "source_model": settings.gemini_model,
        "grounding_source": grounding_source,
        "matched_recipe_id": str(matched_recipe.id) if matched_recipe else None,
        "matched_recipe_title": matched_recipe.title if matched_recipe else None,
        "matched_recipe_confidence": round(recipe_match_score, 2) if matched_recipe else 0,
        "whole_food_summary": product_result.get("summary"),
    }


def recompute_meal_scan(
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
    matched_recipe, recipe_match_score = _match_recipe(db, meal_label, normalized_ingredients)
    if matched_recipe and recipe_match_score >= 0.66:
        nutrition = _coerce_recipe_nutrition(matched_recipe.nutrition_info or {}, portion_size)
        grounding_source = "recipe_match"
        grounding_confidence = min(0.95, 0.55 + recipe_match_score * 0.4)
    else:
        synthetic_components = [{"name": ingredient, "portion_factor": 1.0} for ingredient in normalized_ingredients]
        nutrition, grounding_confidence = _estimate_from_components(synthetic_components, portion_size)
        grounding_source = "heuristic_components"

    product_result = analyze_whole_food_product(
        {
            "ingredients_text": ", ".join(normalized_ingredients),
            "calories": nutrition.get("calories", 0),
            "protein_g": nutrition.get("protein", 0),
            "fiber_g": nutrition.get("fiber", 0),
            "carbs_g": nutrition.get("carbs", 0),
            "sugar_g": max(0.0, nutrition.get("carbs", 0) * 0.18),
            "sodium_mg": 420 if source_context == "restaurant" else 220,
        }
    )
    flags = _build_flag_objects(product_result, source_context, "mixed")
    whole_food_status = _whole_food_status(product_result, flags)

    meal_context = classify_meal_context(meal_label, meal_type, nutrition)
    mes = None
    if should_score_meal(meal_context):
        budget = get_or_create_budget(db, user_id)
        result = compute_meal_mes(nutrition, budget)
        mes = {
            "score": result["display_score"],
            "tier": result["display_tier"],
            "sub_scores": result.get("sub_scores") or {},
        }

    confidence_breakdown = {
        "extraction": 0.7,
        "portion": 0.75,
        "nutrition": round(grounding_confidence, 2),
    }
    confidence = round(
        confidence_breakdown["extraction"] * 0.3
        + confidence_breakdown["portion"] * 0.2
        + confidence_breakdown["nutrition"] * 0.5,
        2,
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
        "whole_food_flags": flags,
        "suggested_swaps": product_result.get("processing_flags") or {},
        "mes": mes,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "upgrade_suggestions": _upgrade_suggestions(flags, nutrition, "mixed"),
        "recovery_plan": _recovery_plan(db, user_id, nutrition, whole_food_status),
        "source_model": existing_source_model or settings.gemini_model,
        "grounding_source": grounding_source,
        "matched_recipe_id": str(matched_recipe.id) if matched_recipe else None,
        "matched_recipe_title": matched_recipe.title if matched_recipe else None,
        "matched_recipe_confidence": round(recipe_match_score, 2) if matched_recipe else 0,
        "whole_food_summary": product_result.get("summary"),
    }
