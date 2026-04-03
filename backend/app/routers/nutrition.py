import logging
from datetime import UTC, datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.local_food import LocalFood
from app.models.meal_plan import MealPlanItem
from app.models.nutrition import NutritionTarget, FoodLog, DailyNutritionSummary
from app.models.scanned_meal import ScannedMealLog
from app.models.metabolic_profile import MetabolicProfile
from app.schemas.nutrition import (
    NutritionTargetsResponse,
    NutritionTargetsUpdate,
    FoodLogCreate,
    FoodLogUpdate,
    FoodLogResponse,
    DailyNutritionResponse,
)
from app.achievements_engine import award_xp, update_nutrition_streak, check_achievements
from app.services.food_catalog import canonicalize_nutrition, resolve_food_db_nutrition
from app.services.metabolic_engine import (
    build_glycemic_nutrition_input,
    on_food_log_created,
    recompute_daily_score,
    update_metabolic_streak,
    load_budget_for_user,
)
from app.models.metabolic import MetabolicScore
from app.services.notifications import record_notification_event
from app.services.fuel_score import compute_fuel_score

router = APIRouter()


ESSENTIAL_MICROS_DEFAULTS = {
    "vitamin_a_mcg": 900,
    "vitamin_c_mg": 90,
    "vitamin_d_mcg": 20,
    "vitamin_e_mg": 15,
    "vitamin_k_mcg": 120,
    "thiamin_b1_mg": 1.2,
    "riboflavin_b2_mg": 1.3,
    "niacin_b3_mg": 16,
    "vitamin_b6_mg": 1.7,
    "folate_mcg": 400,
    "vitamin_b12_mcg": 2.4,
    "choline_mg": 550,
    "calcium_mg": 1300,
    "iron_mg": 18,
    "magnesium_mg": 420,
    "phosphorus_mg": 1250,
    "potassium_mg": 4700,
    "sodium_mg": 2300,
    "zinc_mg": 11,
    "copper_mg": 0.9,
    "manganese_mg": 2.3,
    "selenium_mcg": 55,
    "iodine_mcg": 150,
    "omega3_g": 1.6,
}


def _clear_scan_log_references(db: Session, log_ids: list[str]) -> None:
    if not log_ids:
        return
    scans = (
        db.query(ScannedMealLog)
        .filter(ScannedMealLog.logged_food_log_id.in_(log_ids))
        .all()
    )
    for scan in scans:
        scan.logged_food_log_id = None
        scan.logged_to_chronometer = False

MACRO_KEYS = ["calories", "protein", "carbs", "fat", "fiber"]


def _default_targets() -> NutritionTarget:
    return NutritionTarget(
        calories_target=2200,
        protein_g_target=130,
        carbs_g_target=250,
        fat_g_target=75,
        fiber_g_target=30,
        micronutrient_targets=ESSENTIAL_MICROS_DEFAULTS,
    )


def _profile_has_core_setup(profile: MetabolicProfile | None) -> bool:
    return bool(
        profile
        and profile.sex
        and profile.goal
        and profile.activity_level
        and profile.weight_lb is not None
        and (profile.height_cm is not None or getattr(profile, "height_ft", None) is not None)
    )


def _target_matches_legacy_defaults(target: NutritionTarget) -> bool:
    return (
        float(target.calories_target or 0) == 2200
        and float(target.protein_g_target or 0) == 130
        and float(target.carbs_g_target or 0) == 250
        and float(target.fat_g_target or 0) == 75
        and float(target.fiber_g_target or 0) == 30
    )


def _sync_targets_from_profile_if_needed(
    db: Session,
    user_id: str,
    target: NutritionTarget,
) -> NutritionTarget:
    profile = db.query(MetabolicProfile).filter(MetabolicProfile.user_id == user_id).first()
    if not _profile_has_core_setup(profile):
        return target

    computed = load_budget_for_user(db, user_id)
    target.calories_target = round(float(getattr(computed, "calorie_target_kcal", None) or computed.tdee or 0), 1)
    target.protein_g_target = round(float(computed.protein_g or 0), 1)
    target.carbs_g_target = round(float(computed.carb_ceiling_g or 0), 1)
    target.fat_g_target = round(float(computed.fat_g or 0), 1)
    target.fiber_g_target = round(float(computed.fiber_g or 0), 1)
    return target


def _get_or_create_targets(db: Session, user_id: str) -> NutritionTarget:
    target = db.query(NutritionTarget).filter(NutritionTarget.user_id == user_id).first()
    if target:
        target = _sync_targets_from_profile_if_needed(db, user_id, target)
        if not target.micronutrient_targets:
            target.micronutrient_targets = ESSENTIAL_MICROS_DEFAULTS
            db.commit()
            db.refresh(target)
            return target
        if db.is_modified(target):
            db.commit()
            db.refresh(target)
        return target

    target = _default_targets()
    target.user_id = user_id
    target = _sync_targets_from_profile_if_needed(db, user_id, target)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def _parse_date(value: str | None) -> date:
    if not value:
        return datetime.now(UTC).date()
    try:
        return datetime.fromisoformat(value).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")


def _scaled_nutrition(nutrition: dict, factor: float) -> dict:
    out = {}
    for k, v in (nutrition or {}).items():
        try:
            out[k] = float(v) * factor
        except Exception:
            continue
    return out


def _merge_nutrition_metadata(base_nutrition: dict | None, nutrition_snapshot: dict | None) -> dict:
    merged = dict(nutrition_snapshot or {})
    for key in ("glycemic_profile", "ingredients", "carb_type"):
        value = (base_nutrition or {}).get(key)
        if value is not None:
            merged[key] = value
    return merged


def _resolve_source_nutrition(db: Session, payload: FoodLogCreate) -> tuple[str, dict]:
    source_type = (payload.source_type or "manual").lower()

    if source_type == "manual":
        if not payload.nutrition:
            raise HTTPException(status_code=400, detail="Manual log requires nutrition payload")
        return payload.title or "Manual Entry", payload.nutrition

    if source_type in {"recipe", "cook_mode"}:
        if not payload.source_id:
            raise HTTPException(status_code=400, detail="source_id is required for recipe/cook_mode")
        recipe = db.query(Recipe).filter(Recipe.id == payload.source_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        return recipe.title, build_glycemic_nutrition_input(recipe.nutrition_info or {}, source=recipe)

    if source_type == "meal_plan":
        if not payload.source_id:
            raise HTTPException(status_code=400, detail="source_id is required for meal_plan")
        item = db.query(MealPlanItem).filter(MealPlanItem.id == payload.source_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Meal plan item not found")
        title = (item.recipe_data or {}).get("title") or "Meal Plan Item"
        nutrition = (item.recipe_data or {}).get("nutrition_info") or {}
        if not nutrition and item.recipe_id:
            recipe = db.query(Recipe).filter(Recipe.id == item.recipe_id).first()
            nutrition = recipe.nutrition_info if recipe else {}
        return title, build_glycemic_nutrition_input(nutrition or {}, source={"nutrition_info": nutrition or {}, "ingredients": (item.recipe_data or {}).get("ingredients"), "carb_type": (item.recipe_data or {}).get("carb_type")})

    if source_type == "food_db":
        if not payload.source_id:
            raise HTTPException(status_code=400, detail="source_id is required for food_db")
        food = db.query(LocalFood).filter(LocalFood.id == payload.source_id, LocalFood.is_active.is_(True)).first()
        if not food:
            raise HTTPException(status_code=404, detail="Food catalog item not found")
        selected = resolve_food_db_nutrition(
            food,
            serving_option_id=payload.serving_option_id,
            grams=payload.grams,
        )
        return food.name, selected

    if source_type == "scan":
        if not payload.source_id:
            raise HTTPException(status_code=400, detail="source_id is required for scan")
        scan = db.query(ScannedMealLog).filter(ScannedMealLog.id == payload.source_id).first()
        if not scan:
            raise HTTPException(status_code=404, detail="Scanned meal not found")
        return scan.meal_label, build_glycemic_nutrition_input(scan.nutrition_estimate or {})

    raise HTTPException(status_code=400, detail="Unsupported source_type")


def _serialize_log(log: FoodLog) -> FoodLogResponse:
    return FoodLogResponse(
        id=str(log.id),
        date=log.date.isoformat(),
        meal_type=log.meal_type,
        source_type=log.source_type,
        source_id=log.source_id,
        group_id=log.group_id,
        group_mes_score=log.group_mes_score,
        group_mes_tier=log.group_mes_tier,
        title=log.title,
        servings=float(log.servings or 1),
        quantity=float(log.quantity or 1),
        nutrition_snapshot=log.nutrition_snapshot or {},
        fuel_score=float(log.fuel_score) if log.fuel_score is not None else None,
    )


def _compute_daily(db: Session, user_id: str, day: date):
    targets = _get_or_create_targets(db, user_id)
    logs = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == day).all()

    totals = {k: 0.0 for k in MACRO_KEYS}
    micros = {k: 0.0 for k in (targets.micronutrient_targets or {}).keys()}

    for log in logs:
        snap = log.nutrition_snapshot or {}
        totals["calories"] += float(snap.get("calories", 0) or 0)
        totals["protein"] += float(snap.get("protein", 0) or snap.get("protein_g", 0) or 0)
        totals["carbs"] += float(snap.get("carbs", 0) or snap.get("carbs_g", 0) or 0)
        totals["fat"] += float(snap.get("fat", 0) or snap.get("fat_g", 0) or 0)
        totals["fiber"] += float(snap.get("fiber", 0) or snap.get("fiber_g", 0) or 0)

        for micro in micros.keys():
            micros[micro] += float(snap.get(micro, 0) or 0)

    # Scale targets based on meals logged vs expected
    main_meal_types_logged = {log.meal_type for log in logs if log.meal_type in {"breakfast", "lunch", "dinner"}}
    meals_logged_count = len(main_meal_types_logged) or (1 if logs else 0)
    target_scale = meals_logged_count / 3.0 if meals_logged_count < 3 else 1.0

    scaled_cal = float(targets.calories_target or 0) * target_scale
    scaled_pro = float(targets.protein_g_target or 0) * target_scale
    scaled_carb = float(targets.carbs_g_target or 0) * target_scale
    scaled_fat = float(targets.fat_g_target or 0) * target_scale
    scaled_fiber = float(targets.fiber_g_target or 0) * target_scale

    comparison = {
        "calories": {
            "consumed": totals["calories"],
            "target": scaled_cal,
            "pct": (totals["calories"] / (scaled_cal or 1)) * 100,
        },
        "protein": {
            "consumed": totals["protein"],
            "target": scaled_pro,
            "pct": (totals["protein"] / (scaled_pro or 1)) * 100,
        },
        "carbs": {
            "consumed": totals["carbs"],
            "target": scaled_carb,
            "pct": (totals["carbs"] / (scaled_carb or 1)) * 100,
        },
        "fat": {
            "consumed": totals["fat"],
            "target": scaled_fat,
            "pct": (totals["fat"] / (scaled_fat or 1)) * 100,
        },
        "fiber": {
            "consumed": totals["fiber"],
            "target": scaled_fiber,
            "pct": (totals["fiber"] / (scaled_fiber or 1)) * 100,
        },
    }

    for micro, target in (targets.micronutrient_targets or {}).items():
        consumed = float(micros.get(micro, 0) or 0)
        comparison[micro] = {
            "consumed": consumed,
            "target": float(target or 1),
            "pct": (consumed / float(target or 1)) * 100,
        }

    macro_pcts = [
        min(100.0, comparison["protein"]["pct"]),
        min(100.0, comparison["carbs"]["pct"]),
        min(100.0, comparison["fat"]["pct"]),
        min(100.0, comparison["fiber"]["pct"]),
    ]
    micro_values = [min(100.0, v["pct"]) for k, v in comparison.items() if k not in {"calories", "protein", "carbs", "fat", "fiber"}]
    micro_score = sum(micro_values) / len(micro_values) if micro_values else 0
    macro_score = sum(macro_pcts) / len(macro_pcts)
    daily_score = round((macro_score * 0.6) + (micro_score * 0.4), 1)

    summary = (
        db.query(DailyNutritionSummary)
        .filter(DailyNutritionSummary.user_id == user_id, DailyNutritionSummary.date == day)
        .first()
    )
    if not summary:
        summary = DailyNutritionSummary(user_id=user_id, date=day)
        db.add(summary)

    summary.totals_json = {**totals, **micros}
    summary.comparison_json = comparison
    summary.daily_score = daily_score
    db.commit()

    return totals, comparison, daily_score, logs


@router.get("/targets", response_model=NutritionTargetsResponse)
async def get_targets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = _get_or_create_targets(db, current_user.id)
    return NutritionTargetsResponse(
        calories_target=float(t.calories_target or 0),
        protein_g_target=float(t.protein_g_target or 0),
        carbs_g_target=float(t.carbs_g_target or 0),
        fat_g_target=float(t.fat_g_target or 0),
        fiber_g_target=float(t.fiber_g_target or 0),
        micronutrient_targets=t.micronutrient_targets or ESSENTIAL_MICROS_DEFAULTS,
    )


@router.put("/targets", response_model=NutritionTargetsResponse)
async def update_targets(
    payload: NutritionTargetsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = _get_or_create_targets(db, current_user.id)

    for field in ["calories_target", "protein_g_target", "carbs_g_target", "fat_g_target", "fiber_g_target"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(t, field, val)

    if payload.micronutrient_targets is not None:
        merged = {**ESSENTIAL_MICROS_DEFAULTS, **payload.micronutrient_targets}
        t.micronutrient_targets = merged

    db.commit()
    db.refresh(t)

    return NutritionTargetsResponse(
        calories_target=float(t.calories_target or 0),
        protein_g_target=float(t.protein_g_target or 0),
        carbs_g_target=float(t.carbs_g_target or 0),
        fat_g_target=float(t.fat_g_target or 0),
        fiber_g_target=float(t.fiber_g_target or 0),
        micronutrient_targets=t.micronutrient_targets or ESSENTIAL_MICROS_DEFAULTS,
    )


@router.post("/logs", response_model=FoodLogResponse)
async def create_log(
    payload: FoodLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(payload.date)

    # ── Dedup guard: prevent duplicate logs within 30 seconds ──
    if payload.source_id:
        cutoff = datetime.utcnow() - timedelta(seconds=30)
        existing = db.query(FoodLog).filter(
            FoodLog.user_id == current_user.id,
            FoodLog.source_id == payload.source_id,
            FoodLog.date == day,
            FoodLog.created_at >= cutoff,
        ).first()
        if existing:
            return _serialize_log(existing)

    title, base_nutrition = _resolve_source_nutrition(db, payload)

    # ── Auto-upgrade manual logs that match a curated recipe ──
    # Only upgrade when the user did NOT provide custom nutrition data.
    # If they sent their own nutrition, they're manually logging — respect that
    # and compute fuel_score from their data instead of giving a flat 100.
    normalized_source_type = (payload.source_type or "manual").lower()
    has_custom_nutrition = payload.nutrition and any(
        payload.nutrition.get(k) for k in ("calories", "protein_g", "carbs_g", "fat_g")
    )
    if normalized_source_type == "manual" and not payload.source_id and payload.title and not has_custom_nutrition:
        matched_recipe = db.query(Recipe).filter(
            Recipe.title.ilike(payload.title.strip())
        ).first()
        if matched_recipe:
            normalized_source_type = "recipe"
            payload.source_type = "recipe"
            payload.source_id = str(matched_recipe.id)
            logger.info(
                "Auto-upgraded manual log '%s' to recipe (id=%s)",
                payload.title, matched_recipe.id,
            )

    factor = max(0.1, float(payload.servings or 1.0)) * max(0.1, float(payload.quantity or 1.0))
    nutrition_snapshot = _merge_nutrition_metadata(
        base_nutrition,
        canonicalize_nutrition(_scaled_nutrition(base_nutrition, factor)),
    )

    # ── Fuel Score ──
    try:
        fuel_result = compute_fuel_score(
            source_type=normalized_source_type,
            nutrition=nutrition_snapshot,
            ingredients_text=(payload.nutrition or {}).get("ingredients_text") if payload.nutrition else None,
            title=payload.title or title,
        )
        fuel_score_val = fuel_result.score
    except Exception:
        logger.warning("Fuel score computation failed", exc_info=True)
        fuel_score_val = None

    log = FoodLog(
        user_id=current_user.id,
        date=day,
        meal_type=payload.meal_type,
        source_type=payload.source_type,
        source_id=payload.source_id,
        group_id=payload.group_id,
        group_mes_score=payload.group_mes_score,
        group_mes_tier=payload.group_mes_tier,
        title=payload.title or title,
        servings=payload.servings,
        quantity=payload.quantity,
        nutrition_snapshot=nutrition_snapshot,
        fuel_score=fuel_score_val,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    _, _, daily_score, _ = _compute_daily(db, current_user.id, day)

    # ── Gamification hooks ──
    # +50 XP for logging a meal
    award_xp(db, current_user, 50, "meal_log")
    # Update nutrition streak based on new daily score
    update_nutrition_streak(db, current_user, daily_score, day)
    # Check achievements (food_log_count, nutrition_streak, tier achievements, etc.)
    check_achievements(db, current_user)

    # ── Metabolic Energy Score hook ──
    try:
        on_food_log_created(db, current_user.id, log)
    except Exception:
        logger.warning("MES scoring failed for food log %s", log.id, exc_info=True)

    record_notification_event(
        db,
        current_user.id,
        "food_logged_today",
        properties={"log_id": str(log.id), "meal_type": log.meal_type, "date": day.isoformat()},
        source="server",
    )
    if payload.source_type == "cook_mode":
        record_notification_event(
            db,
            current_user.id,
            "cook_completed",
            properties={"recipe_id": payload.source_id, "log_id": str(log.id), "date": day.isoformat()},
            source="server",
        )
    record_notification_event(
        db,
        current_user.id,
        "daily_mes_updated",
        properties={"date": day.isoformat(), "daily_score": daily_score},
        source="server",
    )
    db.commit()

    # ── Auto-update daily streak on meal log ──
    # Recalculate streak from actual logged dates instead of tracking incrementally.
    # This handles backdated logs, out-of-order logs, and any data inconsistencies.
    from datetime import date as _date_type
    from sqlalchemy import func as sa_func

    log_date = day if isinstance(day, _date_type) else datetime.strptime(str(day), "%Y-%m-%d").date()

    # Query all unique dates with food logs for this user, ordered descending
    logged_dates = (
        db.query(sa_func.distinct(FoodLog.date))
        .filter(FoodLog.user_id == current_user.id)
        .order_by(FoodLog.date.desc())
        .all()
    )
    unique_dates = sorted([row[0] for row in logged_dates], reverse=True)

    # Calculate streak: count consecutive days from most recent
    streak = 0
    if unique_dates:
        streak = 1
        for i in range(len(unique_dates) - 1):
            if (unique_dates[i] - unique_dates[i + 1]).days == 1:
                streak += 1
            else:
                break

    current_user.current_streak = streak
    if streak > (current_user.longest_streak or 0):
        current_user.longest_streak = streak
    current_user.last_active_date = datetime.combine(
        unique_dates[0] if unique_dates else log_date, datetime.min.time()
    )
    db.commit()

    return _serialize_log(log)


@router.get("/logs", response_model=list[FoodLogResponse])
async def list_logs(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(date_str)
    logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == current_user.id, FoodLog.date == day)
        .order_by(FoodLog.created_at.asc())
        .all()
    )
    return [_serialize_log(x) for x in logs]


@router.patch("/logs/{log_id}", response_model=FoodLogResponse)
async def update_log(
    log_id: str,
    payload: FoodLogUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(FoodLog).filter(FoodLog.id == log_id, FoodLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    if payload.meal_type is not None:
        log.meal_type = payload.meal_type
    if payload.title is not None:
        log.title = payload.title
    if payload.servings is not None:
        log.servings = payload.servings
    if payload.quantity is not None:
        log.quantity = payload.quantity
    if payload.group_mes_score is not None:
        log.group_mes_score = payload.group_mes_score
    if payload.group_mes_tier is not None:
        log.group_mes_tier = payload.group_mes_tier

    if payload.nutrition is not None:
        factor = max(0.1, float(log.servings or 1.0)) * max(0.1, float(log.quantity or 1.0))
        log.nutrition_snapshot = _merge_nutrition_metadata(
            payload.nutrition,
            canonicalize_nutrition(_scaled_nutrition(payload.nutrition, factor)),
        )

    db.commit()
    db.refresh(log)

    _compute_daily(db, current_user.id, log.date)

    return _serialize_log(log)


@router.delete("/logs/group/{group_id}")
async def delete_group_logs(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all food logs that share the given group_id."""
    group_logs = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == current_user.id, FoodLog.group_id == group_id)
        .all()
    )
    if not group_logs:
        raise HTTPException(status_code=404, detail="No logs found for this group")

    day = group_logs[0].date
    group_log_ids = [str(log.id) for log in group_logs]
    _clear_scan_log_references(db, group_log_ids)

    for log in group_logs:
        db.query(MetabolicScore).filter(
            MetabolicScore.user_id == current_user.id,
            MetabolicScore.food_log_id == log.id,
        ).delete(synchronize_session=False)
        db.delete(log)

    db.commit()

    _compute_daily(db, current_user.id, day)

    try:
        budget = load_budget_for_user(db, current_user.id)
        daily = recompute_daily_score(db, current_user.id, day, budget)
        update_metabolic_streak(db, current_user.id, daily.total_score, day)
    except Exception:
        logger.warning("Metabolic streak update failed after group delete", exc_info=True)

    return {"ok": True, "deleted_count": len(group_logs)}


@router.delete("/logs/{log_id}")
async def delete_log(
    log_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(FoodLog).filter(FoodLog.id == log_id, FoodLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    day = log.date
    _clear_scan_log_references(db, [str(log.id)])

    # Remove dependent per-meal MES rows first (metabolic_scores.food_log_id -> food_logs.id)
    # to avoid FK constraint failures when deleting a food log.
    db.query(MetabolicScore).filter(
        MetabolicScore.user_id == current_user.id,
        MetabolicScore.food_log_id == log.id,
    ).delete(synchronize_session=False)

    db.delete(log)
    db.commit()

    _compute_daily(db, current_user.id, day)

    # Keep metabolic daily score + streak in sync after deletion.
    try:
        budget = load_budget_for_user(db, current_user.id)
        daily = recompute_daily_score(db, current_user.id, day, budget)
        update_metabolic_streak(db, current_user.id, daily.total_score, day)
    except Exception:
        logger.warning("Metabolic streak update failed after log delete", exc_info=True)

    return {"ok": True}


@router.get("/daily", response_model=DailyNutritionResponse)
async def get_daily(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(date_str)
    totals, comparison, score, logs = _compute_daily(db, current_user.id, day)

    return DailyNutritionResponse(
        date=day.isoformat(),
        totals=totals,
        comparison=comparison,
        daily_score=score,
        logs=[_serialize_log(x) for x in logs],
    )


@router.get("/gaps")
async def get_nutrition_gaps(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(date_str)
    _, comparison, _, _ = _compute_daily(db, current_user.id, day)

    low_items: list[dict] = []
    for key, values in comparison.items():
        if key == "calories":
            continue
        pct = float(values.get("pct", 0) or 0)
        if pct < 70:
            low_items.append({
                "key": key,
                "pct": round(pct, 1),
                "consumed": float(values.get("consumed", 0) or 0),
                "target": float(values.get("target", 0) or 0),
                "gap": max(0.0, float(values.get("target", 0) or 0) - float(values.get("consumed", 0) or 0)),
            })

    low_items = sorted(low_items, key=lambda x: x["pct"])[:4]

    gap_to_recipe_hint = {
        "protein": ["high-protein", "muscle_recovery"],
        "fiber": ["gut_health"],
        "vitamin_c_mg": ["immune_support"],
        "iron_mg": ["energy_boost"],
        "magnesium_mg": ["muscle_recovery"],
        "potassium_mg": ["heart_health"],
        "omega3_g": ["brain_health", "heart_health"],
        "calcium_mg": ["bone_health"],
        "vitamin_d_mcg": ["immune_support", "bone_health"],
        "vitamin_b12_mcg": ["energy_boost", "brain_health"],
    }

    gap_to_foods = {
        "protein": ["Greek Yogurt", "Chicken Breast", "Lentils"],
        "fiber": ["Chia Seeds", "Black Beans", "Raspberries"],
        "vitamin_c_mg": ["Red Bell Pepper", "Kiwi", "Orange"],
        "iron_mg": ["Spinach", "Lentils", "Pumpkin Seeds"],
        "magnesium_mg": ["Pumpkin Seeds", "Almonds", "Avocado"],
        "potassium_mg": ["Banana", "Potato", "Coconut Water"],
        "omega3_g": ["Salmon", "Sardines", "Chia Seeds"],
        "calcium_mg": ["Sardines", "Yogurt", "Kale"],
        "vitamin_d_mcg": ["Salmon", "Egg Yolk", "Mushrooms UV-exposed"],
        "vitamin_b12_mcg": ["Salmon", "Eggs", "Greek Yogurt"],
    }

    # Seed missing local foods so coach can recommend individual foods from local DB.
    default_food_profiles = {
        "Greek Yogurt": {"protein": 17, "calories": 100, "calcium_mg": 180},
        "Chicken Breast": {"protein": 31, "calories": 165},
        "Lentils": {"protein": 9, "fiber": 8, "iron_mg": 3.3},
        "Chia Seeds": {"fiber": 10, "omega3_g": 5, "protein": 5},
        "Black Beans": {"fiber": 8, "protein": 8, "iron_mg": 2.1},
        "Raspberries": {"fiber": 8, "vitamin_c_mg": 26, "calories": 64},
        "Red Bell Pepper": {"vitamin_c_mg": 95, "fiber": 2},
        "Kiwi": {"vitamin_c_mg": 64, "fiber": 3},
        "Orange": {"vitamin_c_mg": 70, "fiber": 3},
        "Spinach": {"iron_mg": 2.7, "magnesium_mg": 79},
        "Pumpkin Seeds": {"magnesium_mg": 150, "iron_mg": 2.5, "protein": 8},
        "Almonds": {"magnesium_mg": 80, "fiber": 3.5},
        "Avocado": {"potassium_mg": 485, "fiber": 7},
        "Banana": {"potassium_mg": 422, "vitamin_b6_mg": 0.4},
        "Potato": {"potassium_mg": 620, "vitamin_c_mg": 19},
        "Coconut Water": {"potassium_mg": 470, "calories": 45},
        "Salmon": {"omega3_g": 2.2, "protein": 22, "vitamin_d_mcg": 11},
        "Sardines": {"omega3_g": 1.5, "calcium_mg": 325, "vitamin_b12_mcg": 8.9},
        "Yogurt": {"calcium_mg": 200, "protein": 10},
        "Kale": {"calcium_mg": 150, "vitamin_c_mg": 80},
        "Egg Yolk": {"vitamin_d_mcg": 1.1, "vitamin_b12_mcg": 0.3},
        "Mushrooms UV-exposed": {"vitamin_d_mcg": 10, "fiber": 1},
        "Eggs": {"protein": 6, "vitamin_b12_mcg": 0.5},
    }

    suggestions_meals: list[dict] = []
    suggestions_foods: list[dict] = []

    for gap in low_items:
        key = gap["key"]

        # Meal suggestions
        hint_tags = gap_to_recipe_hint.get(key, [])
        if hint_tags:
            all_recipes = db.query(Recipe).limit(180).all()
            filtered = [r for r in all_recipes if any(tag in (r.health_benefits or []) for tag in hint_tags)]
            if filtered:
                candidate_recipe = filtered[0]
                suggestions_meals.append({
                    "for": key,
                    "recipe_id": str(candidate_recipe.id),
                    "title": candidate_recipe.title,
                    "health_benefits": candidate_recipe.health_benefits or [],
                })

        # Food suggestions (ensuring they exist in local DB)
        for food_name in gap_to_foods.get(key, [])[:2]:
            row = db.query(LocalFood).filter(LocalFood.name == food_name).first()
            if not row:
                row = LocalFood(
                    name=food_name,
                    brand=None,
                    category="Coach Staples",
                    source_kind="coach_staple",
                    aliases=[],
                    default_serving_label="1 serving",
                    default_serving_grams=100,
                    serving_options=[],
                    nutrition_per_100g=default_food_profiles.get(food_name, {}),
                    nutrition_per_serving=canonicalize_nutrition(default_food_profiles.get(food_name, {})),
                    mes_ready_nutrition=canonicalize_nutrition(default_food_profiles.get(food_name, {})),
                    micronutrients={},
                    serving="1 serving",
                    nutrition_info=canonicalize_nutrition(default_food_profiles.get(food_name, {})),
                    tags=["coach", key],
                    is_active=True,
                )
                db.add(row)
                db.commit()
                db.refresh(row)

            suggestions_foods.append({
                "for": key,
                "food_id": str(row.id),
                "name": row.name,
                "category": row.category,
                "nutrition_info": row.nutrition_per_serving or row.nutrition_info or {},
            })

    return {
        "date": day.isoformat(),
        "low_nutrients": low_items,
        "suggestions": (suggestions_meals + suggestions_foods)[:8],
        "recommended_meals": suggestions_meals[:4],
        "recommended_foods": suggestions_foods[:6],
    }
