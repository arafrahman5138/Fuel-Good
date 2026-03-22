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
        )
    else:
        return _score_manual(
            nutrition=nutrition,
            ingredients_text=ingredients_text,
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
) -> FuelScoreResult:
    ctx = (source_context or "").lower()
    # Starting point depends on where the meal came from
    if ctx in ("home", "homemade"):
        score = 85.0
        reasoning = ["Homemade meals start with a high base score."]
    elif ctx in ("restaurant", "takeout", "fast_food"):
        score = 65.0
        reasoning = ["Restaurant and takeout meals tend to use more processed ingredients."]
    else:
        score = 75.0
        reasoning = ["Scored as a general meal."]

    flags: list[str] = []
    components = components or []

    # ── Component-level adjustments ──
    has_dessert_component = False
    for comp in components:
        name = (comp.get("name") or "").lower()
        role = (comp.get("role") or "").lower()

        # Dessert/sweet components signal an indulgent meal
        if role == "dessert":
            has_dessert_component = True

        # Cooking method quality
        has_negative = False
        for method in NEGATIVE_METHODS:
            if method in name:
                score -= 8
                flags.append(f"Fried/breaded: {name}")
                reasoning.append(f"Fried or breaded preparation lowers ingredient quality.")
                has_negative = True
                break
        if not has_negative:
            for method in POSITIVE_METHODS:
                if method in name:
                    score += 3
                    reasoning.append(f"Healthy cooking method like grilling or baking.")
                    break

        # Refined vs whole carb source
        if role == "carb":
            if any(hint in name for hint in REFINED_CARB_HINTS):
                score -= 6
                flags.append(f"Refined carb: {name}")
                reasoning.append(f"Contains refined carbs like white bread or pasta.")
            elif any(hint in name for hint in WHOLE_CARB_HINTS):
                score += 4
                reasoning.append(f"Includes whole-grain or complex carb sources.")

    # Dessert/sweet penalty — these are flex meals by design
    if has_dessert_component:
        score -= 15
        score = min(score, 65)
        flags.append("Dessert / sweet treat")
        reasoning.append("This is a sweet treat — desserts and sweets are heavily processed by nature.")

    # ── Whole-food flag penalties (from scan pipeline) ──
    if whole_food_flags:
        high_flags = [f for f in whole_food_flags if str((f or {}).get("severity", "")) == "high"]
        med_flags = [f for f in whole_food_flags if str((f or {}).get("severity", "")) == "medium"]
        if high_flags:
            penalty = min(20, len(high_flags) * 8)
            score -= penalty
            flags.extend(str(f.get("label", "Unknown flag")) for f in high_flags[:3])
            reasoning.append(f"Contains {len(high_flags)} heavily processed ingredient{'s' if len(high_flags) > 1 else ''} like seed oils or artificial additives.")
        if med_flags:
            penalty = min(10, len(med_flags) * 3)
            score -= penalty
            reasoning.append(f"Some moderately processed ingredients detected (gums, emulsifiers, etc.).")

    # ── Whole-food status shortcut ──
    if whole_food_status == "fail":
        score = min(score, 45)
        reasoning.append("Too many processed ingredients — this isn't a whole-food meal.")
    elif whole_food_status == "warn":
        score = min(score, 70)
        reasoning.append("Some processed ingredients bring this below whole-food standards.")

    # ── Nutrition-based adjustments ──
    if nutrition:
        sugar = float(nutrition.get("sugar_g", 0) or nutrition.get("sugar", 0) or 0)
        fiber = float(nutrition.get("fiber_g", 0) or nutrition.get("fiber", 0) or 0)
        protein = float(nutrition.get("protein_g", 0) or nutrition.get("protein", 0) or 0)

        if sugar > 20:
            score -= 8
            flags.append("High sugar")
            reasoning.append(f"High sugar content ({sugar:.0f}g) — this spikes blood sugar and adds empty calories.")
        elif sugar > 12:
            score -= 4
            reasoning.append(f"Moderate sugar ({sugar:.0f}g) — more than ideal for a single meal.")

        if fiber >= 8:
            score += 4
            reasoning.append(f"Good fiber content ({fiber:.0f}g) helps slow digestion.")
        elif fiber >= 4:
            score += 2
            reasoning.append(f"Decent fiber ({fiber:.0f}g) adds some digestive benefit.")

        if protein >= 25:
            score += 3
            reasoning.append(f"Strong protein ({protein:.0f}g) supports satiety and recovery.")

    # Scanned meals never hit 100 (no full ingredient list)
    score = max(0.0, min(95.0, round(score, 1)))
    tier, tier_label = _tier_for_score(score)

    return FuelScoreResult(
        score=score,
        tier=tier,
        tier_label=tier_label,
        flags=flags[:5],
        reasoning=reasoning[:6],
        source_path="scan",
    )


# ── Path 3: Manual / food_db → neutral or estimated ─────────────────

def _score_manual(
    *,
    nutrition: dict[str, Any] | None,
    ingredients_text: str | None,
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
    # Legacy fields kept for backward compat
    flex_points_total: float
    flex_points_used: float
    flex_points_remaining: float
    flex_meals_remaining: int     # alias for flex_available
    target_met: bool
    projected_weekly_avg: float
    week_start: str
    week_end: str


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

def _scores_from_logs(logs) -> list[float]:
    """
    Convert a list of FoodLog ORM objects into one fuel score per meal.
    Logs sharing the same group_id are treated as a single meal whose score
    is the average of all logs in that group.
    """
    groups: dict[str, list[float]] = {}
    ungrouped: list[float] = []
    for log in logs:
        score = float(log.fuel_score) if log.fuel_score is not None else None
        if score is None:
            continue
        if log.group_id:
            groups.setdefault(log.group_id, []).append(score)
        else:
            ungrouped.append(score)
    return ungrouped + [sum(v) / len(v) for v in groups.values()]


def get_weekly_meal_scores(
    db: Session,
    user_id: str,
    week_start: date,
) -> list[float]:
    """Fetch one fuel score per meal for a given week (grouped meals count once)."""
    from app.models.nutrition import FoodLog

    week_end = week_start + timedelta(days=6)
    logs = (
        db.query(FoodLog)
        .filter(
            FoodLog.user_id == user_id,
            FoodLog.date >= week_start,
            FoodLog.date <= week_end,
            FoodLog.fuel_score.isnot(None),
        )
        .all()
    )
    return _scores_from_logs(logs)


def get_daily_fuel_scores(
    db: Session,
    user_id: str,
    day: date,
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
    return _scores_from_logs(logs)


def compute_fuel_streak(
    db: Session,
    user_id: str,
    fuel_target: int,
    ref_date: date | None = None,
) -> dict:
    """Count consecutive + longest past weeks where average fuel score met the target."""
    if ref_date is None:
        ref_date = datetime.now(UTC).date()

    # Collect weekly pass/fail for up to 52 weeks back
    check_date = ref_date - timedelta(days=ref_date.weekday() + 7)
    weekly_results: list[bool] = []

    for _ in range(52):
        week_start, _ = get_week_bounds(check_date)
        scores = get_weekly_meal_scores(db, user_id, week_start)
        if not scores:
            break
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

    return {"current_streak": current, "longest_streak": longest}
