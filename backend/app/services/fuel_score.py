"""
Fuel Score — Whole Food Quality Scoring Engine

Assigns a 0–100 score to any meal based on how "whole food" it is.

Three scoring paths:
  1. In-app recipes (curated whole food) → default 100
  2. Scanned meals → AI-estimated from components, context, flags
  3. Manual / food_db logs → neutral default (50), or estimated if data present

Flex Budget math converts scores into "flex meals remaining" per week.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.services.whole_food_scoring import (
    SEED_OILS,
    ADDED_SUGARS,
    REFINED_FLOURS,
    ARTIFICIAL_ADDITIVES,
    EMULSIFIERS_AND_GUMS,
    PROTEIN_ISOLATES,
)
from app.services.nova import NOVA_PENALTY, resolve_nova
from app.services.dish_classifier import classify_dish


# ── Tier definitions ─────────────────────────────────────────────────
FUEL_TIERS = [
    ("whole_food", 85, "Whole Food"),
    ("mostly_clean", 70, "Mostly Clean"),
    ("mixed", 50, "Mixed"),
    ("processed", 30, "Processed"),
    ("ultra_processed", 0, "Ultra-Processed"),
]


def _tier_for_score(score: float) -> tuple[str, str]:
    for key, threshold, label in FUEL_TIERS:
        if score >= threshold:
            return key, label
    return "ultra_processed", "Ultra-Processed"


# ── Cooking-method quality signals ───────────────────────────────────
POSITIVE_METHODS = {"grilled", "baked", "steamed", "roasted", "poached", "sauteed", "sautéed", "air-fried", "air fried"}
NEGATIVE_METHODS = {"fried", "deep-fried", "deep fried", "battered", "breaded", "crispy"}

# Refined carb signals in component names
REFINED_CARB_HINTS = {"white rice", "white bread", "pasta", "noodles", "tortilla", "wrap", "bun", "pita", "naan"}
WHOLE_CARB_HINTS = {"brown rice", "quinoa", "sweet potato", "oats", "lentils", "beans", "chickpeas", "farro", "barley", "cauliflower rice"}

# Ingredient-level red-flag sets (reused from whole_food_scoring)
ALL_RED_FLAGS = SEED_OILS | ADDED_SUGARS | REFINED_FLOURS | ARTIFICIAL_ADDITIVES | EMULSIFIERS_AND_GUMS | PROTEIN_ISOLATES


# ── Result container ─────────────────────────────────────────────────
@dataclass
class FuelScoreResult:
    score: float
    tier: str
    tier_label: str
    flags: list[str]
    reasoning: list[str]
    source_path: str  # "recipe" | "scan" | "manual"


# ── Public API ───────────────────────────────────────────────────────

def compute_fuel_score(
    *,
    source_type: str,
    nutrition: dict[str, Any] | None = None,
    ingredients: list[dict[str, Any]] | None = None,
    components: list[dict[str, Any]] | None = None,
    source_context: str | None = None,
    whole_food_status: str | None = None,
    whole_food_flags: list[dict[str, Any]] | None = None,
    ingredients_text: str | None = None,
    title: str | None = None,
    meal_label: str | None = None,
    dishes: list[dict[str, Any]] | None = None,
    confidence: float | None = None,
    source_model: str | None = None,
    is_beverage: bool = False,
    normalized_ingredients: list[str] | None = None,
) -> FuelScoreResult:
    """Compute a Fuel Score (0–100) for a meal.

    Parameters mirror data available at different logging paths:
    - ``source_type``: recipe | meal_plan | cook_mode | scan | manual | food_db
    - ``nutrition``: macro dict (protein_g, carbs_g, fat_g, fiber_g, calories, sugar_g …)
    - ``ingredients``: recipe-style ingredient list [{"name": …, "quantity": …}]
    - ``components``: scan-extracted components [{"name": …, "role": …, "confidence": …}]
    - ``source_context``: "home" | "restaurant" | "packaged" — scan context hint
    - ``whole_food_status`` / ``whole_food_flags``: from existing scan pipeline
    - ``ingredients_text``: raw comma-separated ingredient text (for manual / food_db)
    - ``meal_label`` / ``dishes``: used by the dish-classifier to inject implicit flags
    - ``confidence`` / ``source_model``: gate the honest 100-ceiling
    - ``is_beverage``: drinks score on a separate truncated scale
    """
    if source_type in ("recipe", "meal_plan", "cook_mode"):
        return _score_recipe(ingredients)
    elif source_type == "scan":
        return _score_scan(
            components=components,
            source_context=source_context,
            nutrition=nutrition,
            whole_food_status=whole_food_status,
            whole_food_flags=whole_food_flags,
            meal_label=meal_label,
            dishes=dishes,
            confidence=confidence,
            source_model=source_model,
            is_beverage=is_beverage,
            normalized_ingredients=normalized_ingredients,
        )
    else:
        return _score_manual(
            nutrition=nutrition,
            ingredients_text=ingredients_text,
            title=title,
        )


# ── Path 1: In-app recipes → 100 by default ─────────────────────────

def _score_recipe(ingredients: list[dict[str, Any]] | None) -> FuelScoreResult:
    return FuelScoreResult(
        score=100.0,
        tier="whole_food",
        tier_label="Whole Food",
        flags=[],
        reasoning=["Curated whole-food recipe."],
        source_path="recipe",
    )


# ── Path 2: Scanned meals → heuristic scoring ───────────────────────

def _score_scan(
    *,
    components: list[dict[str, Any]] | None,
    source_context: str | None,
    nutrition: dict[str, Any] | None,
    whole_food_status: str | None,
    whole_food_flags: list[dict[str, Any]] | None,
    meal_label: str | None = None,
    dishes: list[dict[str, Any]] | None = None,
    confidence: float | None = None,
    source_model: str | None = None,
    is_beverage: bool = False,
    normalized_ingredients: list[str] | None = None,
) -> FuelScoreResult:
    ctx = (source_context or "").lower()
    components = list(components or [])
    whole_food_flags = list(whole_food_flags or [])
    reasoning: list[str] = []
    flags: list[str] = []

    # ── Beverage path: caffeinated / sweetened drinks on a separate scale ──
    if is_beverage:
        return _score_beverage(components=components, nutrition=nutrition)

    # ── Components missing → synthesize from normalized_ingredients ──
    #    Some live analyze_meal_scan outputs (especially from the fallback
    #    Gemini model) leave ``components`` empty but do emit a flat
    #    ``normalized_ingredients`` list. Build equal-weight synthetic
    #    components so the scorer can still work — the NOVA dict will
    #    infer roles from the ingredient names.
    if not components and normalized_ingredients:
        clean = [n for n in normalized_ingredients if isinstance(n, str) and n.strip()]
        if clean:
            share = 1.0 / len(clean)
            components = [
                {"name": name, "role": None, "mass_fraction": share, "confidence": 0.6}
                for name in clean
            ]

    if not components:
        return FuelScoreResult(
            score=55.0,
            tier="mixed",
            tier_label="Mixed",
            flags=[],
            reasoning=["Not enough detail to score this meal accurately."],
            source_path="scan",
        )

    # ── Dish-type implicit flag injection ──
    dish_info = classify_dish(meal_label=meal_label, dishes=dishes)
    nova_floor_by_role = dish_info["nova_floor_by_role"]
    for implicit in dish_info["flags"]:
        already = any(
            (existing or {}).get("tag") == implicit.get("tag")
            for existing in whole_food_flags
        )
        if not already:
            whole_food_flags.append(implicit)

    # ── Resolve NOVA per component ──
    #    Components may already carry `nova` from Gemini — accept it as a hint
    #    but let the dictionary and role-floor win when they're stricter.
    resolved: list[dict[str, Any]] = []
    has_dessert_component = False
    for comp in components:
        role = (comp.get("role") or "").lower() or None
        # If the component arrived without a role, infer one from the NOVA
        # dictionary (e.g. "peanut butter" → fat, "oats" → whole_carb).
        lookup = resolve_nova(comp)
        if role is None and lookup.get("role"):
            role = str(lookup["role"]).lower()
        if role == "dessert":
            has_dessert_component = True

        model_nova = _coerce_nova(comp.get("nova"))
        dict_nova = lookup["nova"]
        role_floor = nova_floor_by_role.get(role or "", 0)
        final_nova = max(model_nova or 0, dict_nova, role_floor) if (model_nova or dict_nova) else (role_floor or dict_nova)
        final_nova = max(1, min(4, final_nova or 1))

        weight_raw = comp.get("mass_fraction")
        try:
            weight = float(weight_raw) if weight_raw not in (None, "") else None
        except (TypeError, ValueError):
            weight = None

        resolved.append({
            **comp,
            "role": role,  # reflect any inferred role back into the component
            "_nova": final_nova,
            "_tags": lookup["tags"],
            "_weight": weight,
            "_matched": lookup["matched"],
        })

    # ── Convert component tags into whole_food_flags ──
    #    HIGH severity only when the offending ingredient dominates the plate
    #    (>= 30% weight). Garnish-level presence gets MEDIUM.
    _TAG_LABELS = {
        "seed_oil_fried": "Fried in seed oil",
        "cured_meat": "Cured / processed meat",
        "added_sugar": "Added sugar",
        "protein_isolate": "Protein isolate",
        "refined_flour": "Refined flour",
        "processed_cheese": "Processed cheese",
        "seed_oil": "Seed oil",
        "sodium_high": "High sodium / ultra-processed base",
    }
    # Refined flour on its own is a common feature of okay meals (white rice
    # next to salmon and greens). It becomes a cheat-meal signal only when it
    # combines with other red flags — which the tier-cap logic handles via
    # flag count, so we keep refined_flour at MEDIUM severity.
    _ALWAYS_HIGH = {"seed_oil_fried", "cured_meat", "protein_isolate"}
    _WEIGHT_SCALED_HIGH = {"added_sugar", "processed_cheese"}
    seen_flag_tags = {(f or {}).get("tag") for f in whole_food_flags if (f or {}).get("tag")}
    for c in resolved:
        for tag in c.get("_tags") or []:
            if tag in seen_flag_tags:
                continue
            label = _TAG_LABELS.get(tag)
            if not label:
                continue
            weight = c.get("_weight") or 0.0
            if tag in _ALWAYS_HIGH:
                severity = "high"
            elif tag in _WEIGHT_SCALED_HIGH:
                severity = "high" if weight >= 0.35 else "medium"
            else:
                severity = "medium"
            seen_flag_tags.add(tag)
            whole_food_flags.append({"label": label, "severity": severity, "tag": tag, "source": "nova_dict"})

    # Equal-weight fallback when mass_fractions are missing/zero
    declared_weights = [c["_weight"] for c in resolved if isinstance(c["_weight"], (int, float)) and c["_weight"] > 0]
    if resolved and sum(declared_weights) >= 0.5:
        # Normalize to sum to 1.0
        total = sum(declared_weights) or 1.0
        for c in resolved:
            w = c["_weight"]
            c["_weight"] = (float(w) / total) if isinstance(w, (int, float)) and w > 0 else 0.0
        # Give any zero-weight components a token share
        zero_count = sum(1 for c in resolved if c["_weight"] == 0.0)
        if zero_count:
            slack = 0.1
            for c in resolved:
                if c["_weight"] == 0.0:
                    c["_weight"] = slack / zero_count
            # Re-normalize
            total = sum(c["_weight"] for c in resolved) or 1.0
            for c in resolved:
                c["_weight"] = c["_weight"] / total
    elif resolved:
        share = 1.0 / len(resolved)
        for c in resolved:
            c["_weight"] = share

    # ── NOVA-weighted base score ──
    score = 100.0
    nova_penalty_total = 0.0
    for c in resolved:
        nova_penalty_total += c["_weight"] * NOVA_PENALTY.get(c["_nova"], 0.0)

        # Cooking-method modifiers (per component, weighted)
        name_lower = (c.get("name") or "").lower()
        methods = [m.lower() for m in (c.get("methods") or []) if isinstance(m, str)]
        fried = any(m in ("fried", "deep-fried", "deep fried") for m in methods) or any(m in name_lower for m in NEGATIVE_METHODS)
        battered = any(m in ("battered", "breaded") for m in methods) or "battered" in name_lower or "breaded" in name_lower
        if fried:
            score -= 6 * c["_weight"]
        elif battered:
            score -= 4 * c["_weight"]
        else:
            healthy = any(m in POSITIVE_METHODS for m in methods) or any(m in name_lower for m in POSITIVE_METHODS)
            if healthy:
                score += 2 * c["_weight"]

    score -= nova_penalty_total
    if nova_penalty_total >= 15:
        reasoning.append(f"Contains heavily processed components (NOVA-weighted penalty −{nova_penalty_total:.0f}).")
    elif nova_penalty_total >= 5:
        reasoning.append(f"Some processed components bring the score down (−{nova_penalty_total:.0f}).")

    # ── Balance bonus: protein + veg + whole_carb trio ──
    roles_present = {c.get("role") or "" for c in resolved}
    if {"protein", "veg"}.issubset(roles_present) and ("whole_carb" in roles_present or "fruit" in roles_present):
        score += 3
        reasoning.append("Balanced plate (protein + vegetables + whole carb).")

    # ── Dessert penalty — only when dessert is processed ──
    if has_dessert_component:
        processed_dessert = any(c.get("role") == "dessert" and c["_nova"] >= 3 for c in resolved)
        if processed_dessert:
            score -= 10
            flags.append("Processed dessert")
            reasoning.append("Contains a processed sweet component.")

    # ── Whole-food flag surfacing (for UI) ──
    high_flags = [f for f in whole_food_flags if str((f or {}).get("severity", "")) == "high"]
    med_flags = [f for f in whole_food_flags if str((f or {}).get("severity", "")) == "medium"]
    if high_flags:
        flags.extend(str(f.get("label", "Unknown flag")) for f in high_flags[:3])
    if med_flags and len(flags) < 4:
        flags.extend(str(f.get("label", "")) for f in med_flags[:2])

    # ── Nutrition-based adjustments (smaller now that NOVA does the heavy lifting) ──
    if nutrition:
        sugar = float(nutrition.get("sugar_g", 0) or nutrition.get("sugar", 0) or 0)
        fiber = float(nutrition.get("fiber_g", 0) or nutrition.get("fiber", 0) or 0)
        protein = float(nutrition.get("protein_g", 0) or nutrition.get("protein", 0) or 0)

        if sugar > 20:
            score -= 6
            flags.append("High sugar")
        elif sugar > 12:
            score -= 3

        if fiber >= 8:
            score += 3
        elif fiber >= 4:
            score += 1

        if protein >= 25:
            score += 2

    # ── Tier caps (severity + count + ultra-processed majority) ──
    high_count = len(high_flags)
    med_count = len(med_flags)
    any_high_severity = bool(high_count) or whole_food_status == "fail"

    weighted_nova = sum(c["_weight"] * c["_nova"] for c in resolved) if resolved else 0.0

    # A plate is "whole-food dominant" when its weighted NOVA is mostly 1-2
    # AND no NOVA ≥3 component exceeds a small mass share. Trace processed
    # ingredients (a splash of soy sauce, a bit of honey, a teaspoon of
    # sugar in a marinade) shouldn't tank an otherwise whole-food plate.
    major_processed_share = sum(
        (c["_weight"] or 0) for c in resolved if c["_nova"] >= 3
    )
    # "Whole-food-dominant" means the bulk of the plate is NOVA 1-2 and
    # processed ingredients are trace or garnish-level. A salmon + rice +
    # veg meal with a glaze of soy sauce qualifies; a cheeseburger + fries
    # does not.
    whole_food_dominant = weighted_nova < 1.8 and major_processed_share < 0.3

    cap = 100
    if high_count >= 2:
        cap = min(cap, 30)
    elif high_count == 1:
        if whole_food_dominant:
            # Trace HIGH-severity ingredient in a mostly-whole-food meal:
            # surface the flag but don't tank the score.
            cap = min(cap, 82)
        elif med_count >= 2:
            cap = min(cap, 35)
        elif med_count == 1:
            cap = min(cap, 50)
        else:
            cap = min(cap, 55)
    elif med_count >= 4:
        cap = min(cap, 50)
    elif med_count == 3:
        cap = min(cap, 60)
    elif med_count == 2:
        cap = min(cap, 70) if not whole_food_dominant else min(cap, 82)
    elif med_count == 1:
        cap = min(cap, 85)
    if weighted_nova >= 3.25:
        cap = min(cap, 28)
    elif weighted_nova >= 2.9:
        cap = min(cap, 40)
    elif weighted_nova >= 2.7:
        cap = min(cap, 48)
    elif weighted_nova >= 2.4:
        cap = min(cap, 60)
    elif weighted_nova >= 2.1:
        cap = min(cap, 75)

    # NOVA-4 majority rule: any single component ≥50% at NOVA 4 (sugary cereal,
    # instant noodles, processed meat on its own) caps severely — the dish is
    # defined by an ultra-processed centerpiece.
    if any((c["_weight"] or 0) >= 0.5 and c["_nova"] == 4 for c in resolved):
        cap = min(cap, 25)

    if whole_food_status == "fail":
        cap = min(cap, 45)
    elif whole_food_status == "warn":
        cap = min(cap, 70)

    if score > cap:
        score = float(cap)
        if any_high_severity:
            reasoning.append("High-severity processing flags cap this below whole-food tier.")

    # ── Honest 100-ceiling (Bug A fix) ──
    #    Require every component NOVA 1, or weighted NOVA ≤ 1.3 with no NOVA ≥ 3.
    all_nova_one = bool(resolved) and all(c["_nova"] == 1 for c in resolved)
    near_all_nova_one = (
        bool(resolved)
        and weighted_nova <= 1.3
        and all(c["_nova"] <= 2 for c in resolved)
    )
    conf_ok = (confidence is None) or (float(confidence) >= 0.75)
    not_degraded = source_model != "degraded_fallback"
    if (
        (all_nova_one or near_all_nova_one)
        and not any_high_severity
        and not has_dessert_component
        and conf_ok
        and not_degraded
        and ctx in ("home", "homemade", "")
    ):
        score = max(score, 100.0)
        reasoning.append("Every component is whole-food grade — honest 100.")

    score = max(0.0, min(100.0, round(score, 1)))
    tier, tier_label = _tier_for_score(score)

    return FuelScoreResult(
        score=score,
        tier=tier,
        tier_label=tier_label,
        flags=flags[:5],
        reasoning=reasoning[:6],
        source_path="scan",
    )


def _coerce_nova(value: Any) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n in (1, 2, 3, 4) else None


def _score_beverage(
    *,
    components: list[dict[str, Any]],
    nutrition: dict[str, Any] | None,
) -> FuelScoreResult:
    """Drinks score on a truncated scale: 0 for soda, ~60 for plain coffee/tea, ~70 for a plain latte.

    Solid-food scoring pushes drinks toward 100 because they appear to have
    "no processed components" — a latte should not outscore a salmon plate.
    """
    nutrition = nutrition or {}
    sugar = float(nutrition.get("sugar_g", 0) or nutrition.get("sugar", 0) or 0)
    name_lower = " ".join((c.get("name") or "").lower() for c in components or [])

    # Base: plain coffee / tea / water = 60. Milk-based = 65. Juice/smoothie = 55.
    if any(tok in name_lower for tok in ("espresso", "black coffee", "americano", "cold brew", "plain tea", "green tea")):
        score = 62.0
        reasoning = ["Plain coffee / tea — scored on the beverage scale."]
    elif any(tok in name_lower for tok in ("latte", "cappuccino", "flat white", "macchiato")):
        score = 65.0
        reasoning = ["Milk-based espresso drink — scored on the beverage scale."]
    elif any(tok in name_lower for tok in ("smoothie", "juice")):
        score = 55.0
        reasoning = ["Liquid fruit drinks lack whole-food satiety signals."]
    elif any(tok in name_lower for tok in ("soda", "cola", "energy drink", "sports drink")):
        score = 12.0
        reasoning = ["Sweetened beverages are the most processed form of calories."]
    else:
        score = 55.0
        reasoning = ["Beverage — scored on a truncated scale."]

    if sugar > 20:
        score -= 15
    elif sugar > 10:
        score -= 8
    elif sugar > 5:
        score -= 3

    # Beverages never earn the solid-food 100 ceiling.
    score = max(0.0, min(70.0, round(score, 1)))
    tier, tier_label = _tier_for_score(score)
    return FuelScoreResult(
        score=score,
        tier=tier,
        tier_label=tier_label,
        flags=[],
        reasoning=reasoning[:3],
        source_path="scan",
    )


# ── Path 3: Manual / food_db → neutral or estimated ─────────────────

_WHOLE_FOOD_TITLE_HINTS = {
    "salmon", "chicken", "beef", "turkey", "shrimp", "tuna", "steak",
    "egg", "omelet", "omelette",
    "quinoa", "brown rice", "sweet potato", "lentil", "chickpea",
    "broccoli", "spinach", "kale", "zucchini", "avocado", "cucumber",
    "greek yogurt", "yogurt bowl", "chia", "oat",
    "salad", "bowl", "grilled", "baked", "roasted", "steamed",
}
_PROCESSED_TITLE_HINTS = {
    "pizza", "burger", "fries", "nugget", "donut", "candy", "soda",
    "chip", "cookie", "cake", "ice cream", "milkshake", "brownie",
    "hot dog", "corn dog", "mozzarella stick", "fried",
}


def _score_manual(
    *,
    nutrition: dict[str, Any] | None,
    ingredients_text: str | None,
    title: str | None = None,
) -> FuelScoreResult:
    # If we have ingredient text, do a lightweight flag check
    if ingredients_text:
        lower = ingredients_text.lower()
        flag_count = sum(1 for term in ALL_RED_FLAGS if re.search(r"\b" + re.escape(term) + r"\b", lower))
        if flag_count == 0:
            score = 70.0
            reasoning = ["Manual entry with clean ingredient text."]
        elif flag_count <= 2:
            score = 55.0
            reasoning = [f"Manual entry with {flag_count} flagged ingredient(s)."]
        else:
            score = 35.0
            reasoning = [f"Manual entry with {flag_count} flagged ingredients — likely processed."]

        tier, tier_label = _tier_for_score(score)
        return FuelScoreResult(
            score=score, tier=tier, tier_label=tier_label,
            flags=[], reasoning=reasoning, source_path="manual",
        )

    # No ingredient data — estimate from nutrition quality if available
    if nutrition:
        cal = float(nutrition.get("calories", 0) or 0)
        protein = float(nutrition.get("protein", 0) or nutrition.get("protein_g", 0) or 0)
        fiber = float(nutrition.get("fiber", 0) or nutrition.get("fiber_g", 0) or 0)
        sugar = float(nutrition.get("sugar", 0) or nutrition.get("sugar_g", 0) or 0)

        # Start at 55 (slightly above neutral) and adjust based on quality signals
        score = 55.0
        reasoning: list[str] = []

        # Title-based inference: boost/penalize if title strongly suggests whole food or processed
        if title:
            title_lower = title.lower()
            wf_hits = sum(1 for h in _WHOLE_FOOD_TITLE_HINTS if h in title_lower)
            pf_hits = sum(1 for h in _PROCESSED_TITLE_HINTS if h in title_lower)
            if wf_hits >= 2 and pf_hits == 0:
                score += 15
                reasoning.append(f"Title suggests whole-food meal (+15).")
            elif wf_hits >= 1 and pf_hits == 0:
                score += 8
                reasoning.append(f"Title suggests a healthy meal (+8).")
            elif pf_hits >= 1 and wf_hits == 0:
                score -= 8
                reasoning.append(f"Title suggests processed food (-8).")

        # Protein density: ≥25g per meal is excellent for whole-food patterns
        if protein >= 25:
            score += 12
            reasoning.append(f"Good protein ({protein:.0f}g) — typical of whole-food meals.")
        elif protein >= 15:
            score += 5
            reasoning.append(f"Moderate protein ({protein:.0f}g).")

        # Fiber: ≥7g per meal suggests vegetables, whole grains
        if fiber >= 7:
            score += 10
            reasoning.append(f"High fiber ({fiber:.1f}g) — suggests whole foods.")
        elif fiber >= 4:
            score += 4
            reasoning.append(f"Moderate fiber ({fiber:.1f}g).")

        # Sugar penalty: >20g per meal suggests processed ingredients
        if sugar > 30:
            score -= 15
            reasoning.append(f"High sugar ({sugar:.0f}g) — likely processed components.")
        elif sugar > 20:
            score -= 8
            reasoning.append(f"Elevated sugar ({sugar:.0f}g).")

        # Calorie reasonableness: 200-700 is typical for a real meal
        if 200 <= cal <= 700:
            score += 3
        elif cal > 1000:
            score -= 5
            reasoning.append(f"Very high calories ({cal:.0f}) for a single meal.")

        if not reasoning:
            reasoning.append("Estimated from nutrition profile (no ingredient data).")

        score = max(25.0, min(90.0, round(score, 1)))
        tier, tier_label = _tier_for_score(score)
        return FuelScoreResult(
            score=score, tier=tier, tier_label=tier_label,
            flags=[], reasoning=reasoning, source_path="manual_estimated",
        )

    # Truly no data at all → neutral default
    return FuelScoreResult(
        score=50.0,
        tier="mixed",
        tier_label="Mixed",
        flags=[],
        reasoning=["No ingredient or nutrition data available — defaulting to 50."],
        source_path="manual",
    )


# ══════════════════════════════════════════════════════════════════════
# Flex Budget Engine
# ══════════════════════════════════════════════════════════════════════

DEFAULT_FUEL_TARGET = 80
DEFAULT_MEALS_PER_WEEK = 21
DEFAULT_CLEAN_PCT = 80           # 80% clean eating goal
AVG_CHEAT_MEAL_SCORE = 35
WEEK_RESET_DAY = 0  # Monday

# Preset clean-eating tiers
CLEAN_PCT_PRESETS = {
    70: {"label": "Relaxed", "description": "Flexible lifestyle"},
    80: {"label": "Balanced", "description": "Sweet spot (recommended)"},
    90: {"label": "Strict", "description": "Maximum results"},
}


def get_week_bounds(ref_date: date | None = None) -> tuple[date, date]:
    """Return (monday, sunday) for the week containing *ref_date*."""
    if ref_date is None:
        ref_date = datetime.now(UTC).date()
    monday = ref_date - timedelta(days=ref_date.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


@dataclass
class FlexBudget:
    fuel_target: int
    expected_meals: int
    meals_logged: int
    total_score_points: float
    avg_fuel_score: float
    # Credit-based flex fields
    clean_pct: int                # user's clean eating goal (70/80/90)
    clean_meals_target: int       # how many clean meals needed per week
    clean_meals_logged: int       # how many clean meals logged so far
    flex_budget: int              # total flex meals per week
    flex_used: int                # flex meals consumed (meals below target)
    flex_available: int           # flex meals currently available
    # Snack/dessert tracking (excluded from main meal count)
    snacks_logged: int = 0
    snack_avg_score: float = 0.0
    # Legacy fields kept for backward compat
    flex_points_total: float = 0.0
    flex_points_used: float = 0.0
    flex_points_remaining: float = 0.0
    flex_meals_remaining: int = 0     # alias for flex_available
    target_met: bool = False
    projected_weekly_avg: float = 0.0
    week_start: str = ""
    week_end: str = ""


def compute_flex_budget(
    *,
    fuel_target: int,
    expected_meals: int,
    meal_scores: list[float],
    week_start: date,
    clean_pct: int = DEFAULT_CLEAN_PCT,
) -> FlexBudget:
    """Compute the live flex budget using credit-based percentage model.

    Credit model:
      - User starts the week with full flex budget (projected from clean_pct).
      - Each clean meal (score >= fuel_target) confirms the budget.
      - Each cheat meal (score < fuel_target) spends 1 flex meal.
      - If remaining unlogged meals can't sustain the budget, it shrinks.

    Example (80% / 21 meals):
      - clean_meals_target = ceil(21 * 0.80) = 17
      - flex_budget = 21 - 17 = 4
      - User starts with 4 available, cheat meals spend them.
    """
    meals_logged = len(meal_scores)
    total_points = sum(meal_scores)
    avg_score = total_points / meals_logged if meals_logged else 0.0

    # Percentage-based budget
    clean_meals_target = math.ceil(expected_meals * clean_pct / 100)
    flex_budget_total = expected_meals - clean_meals_target

    # Count clean vs cheat meals logged
    clean_meals_logged = sum(1 for s in meal_scores if s >= fuel_target)
    flex_used = sum(1 for s in meal_scores if s < fuel_target)

    # How many meals left to log this week
    meals_remaining = max(0, expected_meals - meals_logged)

    # Budget shrinkage: if remaining meals can't cover clean target deficit
    clean_still_needed = max(0, clean_meals_target - clean_meals_logged)
    # If user needs more clean meals than they have remaining, budget shrinks
    if meals_remaining < clean_still_needed:
        shortfall = clean_still_needed - meals_remaining
        effective_budget = max(0, flex_budget_total - shortfall)
    else:
        effective_budget = flex_budget_total

    flex_available = max(0, effective_budget - flex_used)

    # Legacy points-based fields (backward compat)
    earned = sum(max(0, s - fuel_target) for s in meal_scores)
    spent = sum(max(0, fuel_target - s) for s in meal_scores)
    projected_remaining_earned = meals_remaining * max(0, 95 - fuel_target)
    flex_total = earned + projected_remaining_earned
    flex_remaining = max(0.0, flex_total - spent)

    # Projected weekly average
    projected_total = total_points + (meals_remaining * 95)
    projected_avg = projected_total / expected_meals if expected_meals else 0

    week_end = week_start + timedelta(days=6)

    return FlexBudget(
        fuel_target=fuel_target,
        expected_meals=expected_meals,
        meals_logged=meals_logged,
        total_score_points=round(total_points, 1),
        avg_fuel_score=round(avg_score, 1),
        clean_pct=clean_pct,
        clean_meals_target=clean_meals_target,
        clean_meals_logged=clean_meals_logged,
        flex_budget=flex_budget_total,
        flex_used=flex_used,
        flex_available=flex_available,
        flex_points_total=round(flex_total, 1),
        flex_points_used=round(spent, 1),
        flex_points_remaining=round(flex_remaining, 1),
        flex_meals_remaining=flex_available,
        target_met=avg_score >= fuel_target if meals_logged else False,
        projected_weekly_avg=round(projected_avg, 1),
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
    )


# ── DB helpers ───────────────────────────────────────────────────────

_SNACK_MEAL_TYPES = {"snack", "dessert"}
_MAIN_MEAL_TYPES = {"breakfast", "lunch", "dinner", "meal"}


def _scores_from_logs(logs, *, exclude_snacks: bool = False) -> list[float]:
    """
    Convert a list of FoodLog ORM objects into one fuel score per meal.
    Logs sharing the same group_id are treated as a single meal whose score
    is the average of all logs in that group.

    If *exclude_snacks* is True, logs with meal_type in ('snack', 'dessert')
    are omitted — used for flex budget meal counting (desserts shouldn't count
    as one of the 21 expected meals per week).
    """
    groups: dict[str, list[float]] = {}
    ungrouped: list[float] = []
    for log in logs:
        score = float(log.fuel_score) if log.fuel_score is not None else None
        if score is None:
            continue
        if exclude_snacks and (getattr(log, "meal_type", "") or "").lower() in _SNACK_MEAL_TYPES:
            continue
        if log.group_id:
            groups.setdefault(log.group_id, []).append(score)
        else:
            ungrouped.append(score)
    return ungrouped + [sum(v) / len(v) for v in groups.values()]


def _snack_scores_from_logs(logs) -> list[float]:
    """Extract fuel scores for snack/dessert logs only."""
    groups: dict[str, list[float]] = {}
    ungrouped: list[float] = []
    for log in logs:
        score = float(log.fuel_score) if log.fuel_score is not None else None
        if score is None:
            continue
        if (getattr(log, "meal_type", "") or "").lower() not in _SNACK_MEAL_TYPES:
            continue
        if log.group_id:
            groups.setdefault(log.group_id, []).append(score)
        else:
            ungrouped.append(score)
    return ungrouped + [sum(v) / len(v) for v in groups.values()]


def _fetch_weekly_logs(db: Session, user_id: str, week_start: date):
    """Fetch all food logs for a given week."""
    from app.models.nutrition import FoodLog

    week_end = week_start + timedelta(days=6)
    return (
        db.query(FoodLog)
        .filter(
            FoodLog.user_id == user_id,
            FoodLog.date >= week_start,
            FoodLog.date <= week_end,
            FoodLog.fuel_score.isnot(None),
        )
        .all()
    )


def get_weekly_meal_scores(
    db: Session,
    user_id: str,
    week_start: date,
    *,
    exclude_snacks: bool = False,
) -> list[float]:
    """Fetch one fuel score per meal for a given week (grouped meals count once).

    If *exclude_snacks* is True, snack/dessert logs are omitted — used for
    flex budget meal counting where desserts shouldn't count as real meals.
    """
    logs = _fetch_weekly_logs(db, user_id, week_start)
    return _scores_from_logs(logs, exclude_snacks=exclude_snacks)


def get_weekly_snack_scores(
    db: Session,
    user_id: str,
    week_start: date,
) -> list[float]:
    """Fetch fuel scores for snack/dessert logs only in a given week."""
    logs = _fetch_weekly_logs(db, user_id, week_start)
    return _snack_scores_from_logs(logs)


def get_daily_fuel_scores(
    db: Session,
    user_id: str,
    day: date,
    *,
    exclude_snacks: bool = False,
) -> list[float]:
    """Fetch one fuel score per meal for a given day (grouped meals count once)."""
    from app.models.nutrition import FoodLog

    logs = (
        db.query(FoodLog)
        .filter(
            FoodLog.user_id == user_id,
            FoodLog.date == day,
            FoodLog.fuel_score.isnot(None),
        )
        .all()
    )
    return _scores_from_logs(logs, exclude_snacks=exclude_snacks)


def compute_fuel_streak(
    db: Session,
    user_id: str,
    fuel_target: int,
    ref_date: date | None = None,
) -> dict:
    """Count consecutive + longest past weeks where average fuel score met the target."""
    if ref_date is None:
        ref_date = datetime.now(UTC).date()

    # Start from current week's Monday (not 2 weeks back)
    check_date = ref_date - timedelta(days=ref_date.weekday())
    weekly_results: list[bool] = []
    consecutive_empty = 0

    for _ in range(52):
        week_start, _ = get_week_bounds(check_date)
        scores = get_weekly_meal_scores(db, user_id, week_start)
        if not scores:
            # Allow up to 1 gap week (vacation etc), only stop on 2+ consecutive empty weeks
            consecutive_empty += 1
            if consecutive_empty >= 2:
                break
            check_date -= timedelta(days=7)
            continue
        consecutive_empty = 0
        avg = sum(scores) / len(scores)
        weekly_results.append(avg >= fuel_target)
        check_date -= timedelta(days=7)

    # Current streak: consecutive True from index 0
    current = 0
    for met in weekly_results:
        if met:
            current += 1
        else:
            break

    # Longest streak: scan all results
    longest = 0
    run = 0
    for met in weekly_results:
        if met:
            run += 1
            longest = max(longest, run)
        else:
            run = 0

    return {"current_streak": current, "longest_streak": max(longest, current)}
