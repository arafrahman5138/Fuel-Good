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
from datetime import date, timedelta
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
        reasoning = ["Homemade meal — starting at 85."]
    elif ctx in ("restaurant", "takeout", "fast_food"):
        score = 65.0
        reasoning = ["Restaurant/takeout meal — starting at 65."]
    else:
        score = 75.0
        reasoning = ["Source context unknown — starting at 75."]

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
                reasoning.append(f"Negative cooking method detected in '{name}' (−8).")
                has_negative = True
                break
        if not has_negative:
            for method in POSITIVE_METHODS:
                if method in name:
                    score += 3
                    reasoning.append(f"Positive cooking method in '{name}' (+3).")
                    break

        # Refined vs whole carb source
        if role == "carb":
            if any(hint in name for hint in REFINED_CARB_HINTS):
                score -= 6
                flags.append(f"Refined carb: {name}")
                reasoning.append(f"Refined carb source '{name}' (−6).")
            elif any(hint in name for hint in WHOLE_CARB_HINTS):
                score += 4
                reasoning.append(f"Whole carb source '{name}' (+4).")

    # Dessert/sweet penalty — these are flex meals by design
    if has_dessert_component:
        score -= 15
        score = min(score, 65)
        flags.append("Dessert / sweet treat")
        reasoning.append("Dessert component detected — penalty (−15) and capped at 65.")

    # ── Whole-food flag penalties (from scan pipeline) ──
    if whole_food_flags:
        high_flags = [f for f in whole_food_flags if str((f or {}).get("severity", "")) == "high"]
        med_flags = [f for f in whole_food_flags if str((f or {}).get("severity", "")) == "medium"]
        if high_flags:
            penalty = min(20, len(high_flags) * 8)
            score -= penalty
            flags.extend(str(f.get("label", "Unknown flag")) for f in high_flags[:3])
            reasoning.append(f"{len(high_flags)} high-severity flag(s) (−{penalty}).")
        if med_flags:
            penalty = min(10, len(med_flags) * 3)
            score -= penalty
            reasoning.append(f"{len(med_flags)} medium-severity flag(s) (−{penalty}).")

    # ── Whole-food status shortcut ──
    if whole_food_status == "fail":
        score = min(score, 45)
        reasoning.append("Whole-food status is 'fail' — capped at 45.")
    elif whole_food_status == "warn":
        score = min(score, 70)
        reasoning.append("Whole-food status is 'warn' — capped at 70.")

    # ── Nutrition-based adjustments ──
    if nutrition:
        sugar = float(nutrition.get("sugar_g", 0) or nutrition.get("sugar", 0) or 0)
        fiber = float(nutrition.get("fiber_g", 0) or nutrition.get("fiber", 0) or 0)
        protein = float(nutrition.get("protein_g", 0) or nutrition.get("protein", 0) or 0)

        if sugar > 20:
            score -= 8
            flags.append("High sugar")
            reasoning.append(f"High sugar ({sugar:.0f}g) — (−8).")
        elif sugar > 12:
            score -= 4
            reasoning.append(f"Moderate sugar ({sugar:.0f}g) — (−4).")

        if fiber >= 8:
            score += 4
            reasoning.append(f"Good fiber ({fiber:.0f}g) — (+4).")
        elif fiber >= 4:
            score += 2
            reasoning.append(f"Decent fiber ({fiber:.0f}g) — (+2).")

        if protein >= 25:
            score += 3
            reasoning.append(f"Strong protein ({protein:.0f}g) — (+3).")

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

    # No ingredient data → neutral default
    return FuelScoreResult(
        score=50.0,
        tier="mixed",
        tier_label="Mixed",
        flags=[],
        reasoning=["No ingredient data available — defaulting to 50."],
        source_path="manual",
    )


# ══════════════════════════════════════════════════════════════════════
# Flex Budget Engine
# ══════════════════════════════════════════════════════════════════════

DEFAULT_FUEL_TARGET = 80
DEFAULT_MEALS_PER_WEEK = 21
AVG_CHEAT_MEAL_SCORE = 35
WEEK_RESET_DAY = 0  # Monday


def get_week_bounds(ref_date: date | None = None) -> tuple[date, date]:
    """Return (monday, sunday) for the week containing *ref_date*."""
    if ref_date is None:
        ref_date = date.today()
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
    flex_points_total: float
    flex_points_used: float
    flex_points_remaining: float
    flex_meals_remaining: int
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
) -> FlexBudget:
    """Compute the live flex budget from this week's meal scores.

    Core math:
      - Each 100-score meal earns ``100 − target`` flex points.
      - Each cheat meal (score < target) costs ``target − score`` points.
      - Remaining points are converted to "flex meals remaining".
    """
    meals_logged = len(meal_scores)
    total_points = sum(meal_scores)
    avg_score = total_points / meals_logged if meals_logged else 0.0

    # Points above/below target for each logged meal
    earned = sum(max(0, s - fuel_target) for s in meal_scores)
    spent = sum(max(0, fuel_target - s) for s in meal_scores)

    # Project remaining meals as whole-food (score = 95 assumed)
    meals_remaining = max(0, expected_meals - meals_logged)
    projected_remaining_earned = meals_remaining * max(0, 95 - fuel_target)

    flex_total = earned + projected_remaining_earned
    flex_remaining = max(0.0, flex_total - spent)

    avg_cheat_cost = max(1, fuel_target - AVG_CHEAT_MEAL_SCORE)
    flex_meals_remaining = math.floor(flex_remaining / avg_cheat_cost)

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
        flex_points_total=round(flex_total, 1),
        flex_points_used=round(spent, 1),
        flex_points_remaining=round(flex_remaining, 1),
        flex_meals_remaining=flex_meals_remaining,
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
        ref_date = date.today()

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
