import logging
from datetime import UTC, date, datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.nutrition import FoodLog
from app.schemas.fuel import (
    FuelSettingsResponse,
    FuelSettingsUpdate,
    DailyFuelResponse,
    WeeklyFuelResponse,
    FlexBudgetResponse,
    FuelStreakResponse,
    HealthPulseResponse,
    HealthPulseDimension,
    CalendarDayEntry,
    FuelCalendarResponse,
    SmartFlexResponse,
    FlexSuggestion,
    ManualFlexLogRequest,
    ManualFlexLogResponse,
)
from app.services.fuel_score import (
    DEFAULT_FUEL_TARGET,
    DEFAULT_MEALS_PER_WEEK,
    DEFAULT_CLEAN_PCT,
    AVG_CHEAT_MEAL_SCORE,
    get_week_bounds,
    get_weekly_meal_scores,
    get_weekly_snack_scores,
    get_daily_fuel_scores,
    compute_flex_budget,
    compute_fuel_streak,
    _tier_for_score,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Grouping helpers ──────────────────────────────────────────────────

def _group_scores(logs) -> list[float]:
    """
    One fuel score per meal. Logs sharing a group_id (meal + default pairing)
    are collapsed into a single score (average of the group).
    """
    groups: dict[str, list[float]] = {}
    ungrouped: list[float] = []
    for log in logs:
        fs = float(log.fuel_score) if log.fuel_score is not None else None
        if fs is None:
            continue
        if log.group_id:
            groups.setdefault(log.group_id, []).append(fs)
        else:
            ungrouped.append(fs)
    return ungrouped + [sum(v) / len(v) for v in groups.values()]


def _dedup_meals(logs) -> list:
    """
    Return one log per meal. For grouped logs only the first (by created_at)
    is kept; side/pairing entries are dropped.
    """
    seen: set[str] = set()
    result = []
    for log in logs:
        if log.group_id:
            if log.group_id in seen:
                continue
            seen.add(log.group_id)
        result.append(log)
    return result


# ── Settings ─────────────────────────────────────────────────────────

@router.get("/settings", response_model=FuelSettingsResponse)
async def get_fuel_settings(
    current_user: User = Depends(get_current_user),
):
    return FuelSettingsResponse(
        fuel_target=current_user.fuel_target or DEFAULT_FUEL_TARGET,
        expected_meals_per_week=current_user.expected_meals_per_week or DEFAULT_MEALS_PER_WEEK,
        clean_eating_pct=current_user.clean_eating_pct or DEFAULT_CLEAN_PCT,
    )


@router.put("/settings", response_model=FuelSettingsResponse)
async def update_fuel_settings(
    payload: FuelSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.fuel_target is not None:
        current_user.fuel_target = payload.fuel_target
    if payload.expected_meals_per_week is not None:
        current_user.expected_meals_per_week = payload.expected_meals_per_week
    if payload.clean_eating_pct is not None:
        current_user.clean_eating_pct = payload.clean_eating_pct
    db.commit()
    db.refresh(current_user)
    return FuelSettingsResponse(
        fuel_target=current_user.fuel_target or DEFAULT_FUEL_TARGET,
        expected_meals_per_week=current_user.expected_meals_per_week or DEFAULT_MEALS_PER_WEEK,
        clean_eating_pct=current_user.clean_eating_pct or DEFAULT_CLEAN_PCT,
    )


# ── Daily ────────────────────────────────────────────────────────────

@router.get("/daily", response_model=DailyFuelResponse)
async def get_daily_fuel(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if date_str:
        try:
            day = datetime.fromisoformat(date_str).date()
        except Exception:
            day = datetime.now(UTC).date()
    else:
        day = datetime.now(UTC).date()

    logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == current_user.id, FoodLog.date == day)
        .order_by(FoodLog.created_at.asc())
        .all()
    )

    scores = _group_scores(logs)
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0

    meals = []
    for log in _dedup_meals(logs):
        fs = float(log.fuel_score) if log.fuel_score is not None else None
        tier_key, tier_label = _tier_for_score(fs) if fs is not None else ("unknown", "Unknown")
        meals.append({
            "id": str(log.id),
            "title": log.title,
            "fuel_score": fs,
            "tier": tier_key,
            "tier_label": tier_label,
            "source_type": log.source_type,
            "meal_type": log.meal_type,
        })

    return DailyFuelResponse(
        date=day.isoformat(),
        avg_fuel_score=avg,
        meal_count=len(scores),
        meals=meals,
    )


# ── Weekly + Flex Budget ─────────────────────────────────────────────

@router.get("/weekly", response_model=WeeklyFuelResponse)
async def get_weekly_fuel(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if date_str:
        try:
            ref = datetime.fromisoformat(date_str).date()
        except Exception:
            ref = datetime.now(UTC).date()
    else:
        ref = datetime.now(UTC).date()

    week_start, week_end = get_week_bounds(ref)
    fuel_target = current_user.fuel_target or DEFAULT_FUEL_TARGET
    expected_meals = current_user.expected_meals_per_week or DEFAULT_MEALS_PER_WEEK
    clean_pct = current_user.clean_eating_pct or DEFAULT_CLEAN_PCT

    # Main meal scores (excluding snacks/desserts) for flex budget counting
    main_meal_scores = get_weekly_meal_scores(db, current_user.id, week_start, exclude_snacks=True)
    # Snack/dessert scores tracked separately
    snack_scores = get_weekly_snack_scores(db, current_user.id, week_start)
    # All scores (meals + snacks) for weekly fuel average
    all_scores = get_weekly_meal_scores(db, current_user.id, week_start, exclude_snacks=False)

    budget = compute_flex_budget(
        fuel_target=fuel_target,
        expected_meals=expected_meals,
        meal_scores=main_meal_scores,  # Only main meals count toward flex budget
        week_start=week_start,
        clean_pct=clean_pct,
    )
    # Attach snack stats to budget
    budget.snacks_logged = len(snack_scores)
    budget.snack_avg_score = round(sum(snack_scores) / len(snack_scores), 1) if snack_scores else 0.0

    # Build daily breakdown
    logs = (
        db.query(FoodLog)
        .filter(
            FoodLog.user_id == current_user.id,
            FoodLog.date >= week_start,
            FoodLog.date <= week_end,
        )
        .order_by(FoodLog.date.asc(), FoodLog.created_at.asc())
        .all()
    )

    by_day: dict[date, list] = defaultdict(list)
    for log in logs:
        by_day[log.date].append(log)

    daily_breakdown = []
    for d in range(7):
        day = week_start + timedelta(days=d)
        day_logs = by_day.get(day, [])
        day_scores = _group_scores(day_logs)
        day_meals = []
        for log in _dedup_meals(day_logs):
            fs = float(log.fuel_score) if log.fuel_score is not None else None
            tier_key, tier_label = _tier_for_score(fs) if fs is not None else ("unknown", "Unknown")
            day_meals.append({
                "id": str(log.id),
                "title": log.title,
                "fuel_score": fs,
                "tier": tier_key,
                "source_type": log.source_type,
                "meal_type": log.meal_type,
            })
        daily_breakdown.append(DailyFuelResponse(
            date=day.isoformat(),
            avg_fuel_score=round(sum(day_scores) / len(day_scores), 1) if day_scores else 0.0,
            meal_count=len(day_scores),
            meals=day_meals,
        ))

    # Weekly average includes ALL scores (meals + snacks) for transparency
    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0

    return WeeklyFuelResponse(
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
        avg_fuel_score=avg_score,
        meal_count=len(all_scores),
        target_met=avg_score >= fuel_target if all_scores else False,
        flex_budget=FlexBudgetResponse(**budget.__dict__),
        daily_breakdown=daily_breakdown,
    )


# ── Streak ───────────────────────────────────────────────────────────

@router.get("/streak", response_model=FuelStreakResponse)
async def get_fuel_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fuel_target = current_user.fuel_target or DEFAULT_FUEL_TARGET
    streak_data = compute_fuel_streak(db, current_user.id, fuel_target)
    return FuelStreakResponse(
        current_streak=streak_data["current_streak"],
        longest_streak=streak_data["longest_streak"],
        fuel_target=fuel_target,
    )


# ── Health Pulse (composite dashboard) ───────────────────────────────

def _pulse_tier(score: float) -> tuple[str, str]:
    if score >= 82:
        return "excellent", "Excellent"
    if score >= 65:
        return "good", "Good"
    if score >= 45:
        return "fair", "Fair"
    return "poor", "Needs Work"


@router.get("/health-pulse", response_model=HealthPulseResponse)
async def get_health_pulse(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _safe_parse_date(date_str)

    # ── 1. Fuel Score (food quality) ─────────────────────────────────
    fuel_logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == current_user.id, FoodLog.date == day)
        .all()
    )
    # If no date was explicitly provided and today (UTC) has no data,
    # fall back to the most recent date with logged meals so the health
    # pulse doesn't show a misleading 0 for timezone differences.
    if not date_str and not fuel_logs:
        from sqlalchemy import func as sa_func
        latest_date = (
            db.query(sa_func.max(FoodLog.date))
            .filter(FoodLog.user_id == current_user.id)
            .scalar()
        )
        if latest_date:
            day = latest_date
            fuel_logs = (
                db.query(FoodLog)
                .filter(FoodLog.user_id == current_user.id, FoodLog.date == day)
                .all()
            )
    fuel_scores = _group_scores(fuel_logs)
    fuel_avg = round(sum(fuel_scores) / len(fuel_scores), 1) if fuel_scores else 0.0
    fuel_tier_key, fuel_tier_label = _pulse_tier(fuel_avg)
    fuel_dim = HealthPulseDimension(
        score=fuel_avg,
        label="Fuel Score",
        tier=fuel_tier_key,
        available=len(fuel_scores) > 0,
    )

    # ── 2. MES (metabolic optimization) ──────────────────────────────
    mes_score = 0.0
    mes_available = False
    try:
        from app.models.metabolic import MetabolicScore
        daily_mes = (
            db.query(MetabolicScore)
            .filter(
                MetabolicScore.user_id == current_user.id,
                MetabolicScore.date == day,
                MetabolicScore.scope == "daily",
            )
            .first()
        )
        if daily_mes and daily_mes.total_score is not None:
            mes_score = round(float(daily_mes.total_score), 1)
            mes_available = True
    except Exception:
        pass
    mes_tier_key, mes_tier_label = _pulse_tier(mes_score)
    metabolic_dim = HealthPulseDimension(
        score=mes_score,
        label="Metabolic Score",
        tier=mes_tier_key,
        available=mes_available,
    )

    # ── 3. Nutrition Score (macro/micro coverage) ────────────────────
    nutrition_score = 0.0
    nutrition_available = False
    try:
        from app.models.nutrition import DailyNutritionSummary
        summary = (
            db.query(DailyNutritionSummary)
            .filter(
                DailyNutritionSummary.user_id == current_user.id,
                DailyNutritionSummary.date == day,
            )
            .first()
        )
        if summary and summary.daily_score is not None:
            nutrition_score = round(float(summary.daily_score), 1)
            nutrition_available = True
    except Exception:
        pass
    nut_tier_key, nut_tier_label = _pulse_tier(nutrition_score)
    nutrition_dim = HealthPulseDimension(
        score=nutrition_score,
        label="Nutrition Score",
        tier=nut_tier_key,
        available=nutrition_available,
    )

    # ── Composite: weighted average (only available dimensions) ──────
    weights = []
    if fuel_dim.available:
        weights.append((fuel_avg, 0.35))
    if metabolic_dim.available:
        weights.append((mes_score, 0.35))
    if nutrition_dim.available:
        weights.append((nutrition_score, 0.30))

    if weights:
        total_weight = sum(w for _, w in weights)
        composite = sum(s * w for s, w in weights) / total_weight
    else:
        composite = 0.0
    composite = round(composite, 1)
    comp_tier, comp_label = _pulse_tier(composite)

    return HealthPulseResponse(
        date=day.isoformat(),
        score=composite,
        tier=comp_tier,
        tier_label=comp_label,
        fuel=fuel_dim,
        metabolic=metabolic_dim,
        nutrition=nutrition_dim,
        meal_count=len(fuel_scores),
    )


# ── Calendar Heat Map ────────────────────────────────────────────────

@router.get("/calendar", response_model=FuelCalendarResponse)
async def get_fuel_calendar(
    month: str | None = Query(default=None, description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
        except Exception:
            today_utc = datetime.now(UTC).date()
            year, mon = today_utc.year, today_utc.month
    else:
        today_utc = datetime.now(UTC).date()
        year, mon = today_utc.year, today_utc.month

    # Build date range for the month
    month_start = date(year, mon, 1)
    if mon == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, mon + 1, 1) - timedelta(days=1)

    fuel_target = current_user.fuel_target or DEFAULT_FUEL_TARGET

    logs = (
        db.query(FoodLog)
        .filter(
            FoodLog.user_id == current_user.id,
            FoodLog.date >= month_start,
            FoodLog.date <= month_end,
        )
        .order_by(FoodLog.date.asc())
        .all()
    )

    by_day: dict[date, list] = defaultdict(list)
    for log in logs:
        by_day[log.date].append(log)

    days = []
    d = month_start
    while d <= month_end:
        day_logs = by_day.get(d, [])
        scores = _group_scores(day_logs)
        avg = round(sum(scores) / len(scores), 1) if scores else 0.0
        tier_key, _ = _tier_for_score(avg) if scores else ("unknown", "Unknown")
        has_flex = any(s < fuel_target for s in scores) if scores else False
        days.append(CalendarDayEntry(
            date=d.isoformat(),
            avg_fuel_score=avg,
            meal_count=len(scores),
            tier=tier_key,
            is_flex=has_flex,
        ))
        d += timedelta(days=1)

    return FuelCalendarResponse(
        month=f"{year:04d}-{mon:02d}",
        fuel_target=fuel_target,
        days=days,
    )


# ── Smart Flex Suggestions ───────────────────────────────────────────

@router.get("/flex-suggestions", response_model=SmartFlexResponse)
async def get_flex_suggestions(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _safe_parse_date(date_str)
    fuel_target = current_user.fuel_target or DEFAULT_FUEL_TARGET
    expected_meals = current_user.expected_meals_per_week or DEFAULT_MEALS_PER_WEEK
    clean_pct = current_user.clean_eating_pct or DEFAULT_CLEAN_PCT
    week_start, _ = get_week_bounds(day)

    # Use main meal scores only (exclude snacks/desserts) for flex budget
    main_scores = get_weekly_meal_scores(db, current_user.id, week_start, exclude_snacks=True)
    budget = compute_flex_budget(
        fuel_target=fuel_target,
        expected_meals=expected_meals,
        meal_scores=main_scores,
        week_start=week_start,
        clean_pct=clean_pct,
    )

    # Today's scores
    today_logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == current_user.id, FoodLog.date == day)
        .all()
    )
    today_scores = _group_scores(today_logs)
    today_avg = sum(today_scores) / len(today_scores) if today_scores else 0.0
    had_flex_today = any(s < fuel_target for s in today_scores)

    # Determine context
    flex_remaining = budget.flex_available
    suggestions: list[FlexSuggestion] = []

    if had_flex_today and today_avg < fuel_target:
        # Post-flex: recovery suggestions
        context = "post_flex"
        suggestions = [
            FlexSuggestion(
                icon="leaf",
                title="Get Back on Track",
                body="Your next meal can make up the difference — aim for a whole-food plate with lean protein, veggies, and complex carbs.",
                accent="#22C55E",
            ),
            FlexSuggestion(
                icon="water",
                title="Hydrate & Reset",
                body="Drink water and skip sugary drinks for the rest of the day. A clean dinner can pull your daily average back up.",
                accent="#3B82F6",
            ),
            FlexSuggestion(
                icon="restaurant",
                title="Scan Before You Eat",
                body="Use the meal scanner on your next meal to stay aware of what you're eating. Knowledge is power!",
                accent="#8B5CF6",
            ),
        ]
    elif flex_remaining <= 0:
        # Budget exhausted
        context = "budget_low"
        suggestions = [
            FlexSuggestion(
                icon="alert-circle",
                title="Flex Budget Spent",
                body=f"You've used all your flex room this week. Stick to whole-food meals (Fuel Score {fuel_target}+) for the rest of the week.",
                accent="#EF4444",
            ),
            FlexSuggestion(
                icon="home",
                title="Cook at Home",
                body="Home-cooked meals consistently score 85+. Browse our recipes for quick whole-food options.",
                accent="#22C55E",
            ),
            FlexSuggestion(
                icon="trending-up",
                title="Protect Your Streak",
                body="You're close to finishing the week strong. A few more whole-food meals and you'll hit your target!",
                accent="#F59E0B",
            ),
        ]
    elif flex_remaining >= 2 and budget.avg_fuel_score >= fuel_target:
        # On track with room to spare
        context = "on_track"
        day_of_week = day.weekday()
        weekend_note = "Perfect timing for a weekend treat!" if day_of_week >= 4 else "Save one for the weekend if you want."
        suggestions = [
            FlexSuggestion(
                icon="checkmark-circle",
                title=f"{flex_remaining} Flex Meals Available",
                body=f"You're ahead of your target — enjoy a flex meal guilt-free. {weekend_note}",
                accent="#22C55E",
            ),
            FlexSuggestion(
                icon="swap-horizontal",
                title="Smart Swap Tip",
                body="Craving takeout? Pick a restaurant option and scan it. Many score 60-70 — cheaper on your flex budget than fast food (30-40).",
                accent="#3B82F6",
            ),
        ]
    else:
        # Pre-flex: some room but need to be careful
        context = "pre_flex"
        suggestions = [
            FlexSuggestion(
                icon="calculator",
                title=f"{flex_remaining} Flex Meal{'s' if flex_remaining != 1 else ''} Left",
                body=f"You have room for {flex_remaining} lower-scoring meal{'s' if flex_remaining != 1 else ''} and still hit your {fuel_target} target this week.",
                accent="#F59E0B",
            ),
            FlexSuggestion(
                icon="restaurant",
                title="Make It Count",
                body="If you're going to flex, choose something you really enjoy. A 60-score restaurant meal costs half the flex points of a 30-score fast food meal.",
                accent="#8B5CF6",
            ),
            FlexSuggestion(
                icon="flash",
                title="Earn More Flex",
                body="Every whole-food meal (90+) earns extra flex points. Cook one more clean meal and you might unlock another flex slot.",
                accent="#22C55E",
            ),
        ]

    return SmartFlexResponse(
        context=context,
        flex_meals_remaining=flex_remaining,
        suggestions=suggestions,
    )


# ── Manual Flex Log ─────────────────────────────────────────────────

FLEX_TAG_TITLES = {
    "pizza": "Pizza night",
    "burger": "Burger",
    "takeout": "Takeout",
    "dessert": "Dessert",
    "drinks": "Drinks",
    "other": "Cheat meal",
}


@router.post("/flex-log", response_model=ManualFlexLogResponse)
async def log_manual_flex_meal(
    payload: ManualFlexLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One-tap cheat meal logging without scanning."""
    import uuid

    day = _safe_parse_date(payload.date)
    title = FLEX_TAG_TITLES.get(payload.tag or "", "Cheat meal")
    if payload.tag and payload.tag not in FLEX_TAG_TITLES:
        title = payload.tag.capitalize()

    log = FoodLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        date=day,
        meal_type=payload.meal_type or "snack",
        source_type="manual_flex",
        title=title,
        fuel_score=float(AVG_CHEAT_MEAL_SCORE),
        nutrition_snapshot={"manual_flex": True, "tag": payload.tag},
    )
    db.add(log)
    db.commit()

    # Recompute budget for response
    fuel_target = current_user.fuel_target or DEFAULT_FUEL_TARGET
    expected_meals = current_user.expected_meals_per_week or DEFAULT_MEALS_PER_WEEK
    clean_pct = current_user.clean_eating_pct or DEFAULT_CLEAN_PCT
    week_start, _ = get_week_bounds(day)
    # Use main meal scores only (exclude snacks) for flex budget
    main_scores = get_weekly_meal_scores(db, current_user.id, week_start, exclude_snacks=True)
    budget = compute_flex_budget(
        fuel_target=fuel_target,
        expected_meals=expected_meals,
        meal_scores=main_scores,
        week_start=week_start,
        clean_pct=clean_pct,
    )

    # ── Flex Snack Transparency ──
    meal_type_val = payload.meal_type or "snack"
    flex_counted = meal_type_val in {"breakfast", "lunch", "dinner", "meal"}
    if flex_counted:
        flex_note = "This meal counts toward your weekly flex budget."
    else:
        flex_note = f"Snacks and desserts are tracked but don't count against your flex budget."

    return ManualFlexLogResponse(
        id=log.id,
        date=day.isoformat(),
        title=title,
        fuel_score=float(AVG_CHEAT_MEAL_SCORE),
        flex_available=budget.flex_available,
        weekly_avg=budget.projected_weekly_avg,
        flex_counted=flex_counted,
        flex_note=flex_note,
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _safe_parse_date(date_str: str | None) -> date:
    if date_str:
        try:
            return datetime.fromisoformat(date_str).date()
        except Exception:
            raise HTTPException(status_code=422, detail=f"Invalid date format: {date_str!r}")
    return datetime.now(UTC).date()
