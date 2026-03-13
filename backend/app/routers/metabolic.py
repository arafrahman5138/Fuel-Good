"""
Metabolic Budget API router.

Endpoints for budget settings, onboarding profile, scores, streak, preview, and remaining budget.
"""
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.metabolic import MetabolicBudget, MetabolicScore, MetabolicStreak
from app.models.metabolic_profile import MetabolicProfile
from app.schemas.metabolic import (
    MetabolicBudgetResponse,
    MetabolicBudgetUpdate,
    MetabolicProfileCreate,
    MetabolicProfileResponse,
    MESScoreResponse,
    DailyMESResponse,
    MealMESResponse,
    ScoreHistoryEntry,
    MetabolicStreakResponse,
    MESPreviewRequest,
    MESPreviewResponse,
    RemainingBudgetResponse,
    MealSuggestionResponse,
    CompositeMESRequest,
    CompositeMESResponse,
    CoachInsight,
    CoachInsightAction,
    CoachInsightsResponse,
)
from app.models.recipe import Recipe
from app.models.nutrition import FoodLog, NutritionTarget
from app.services.metabolic_engine import (
    get_or_create_budget,
    get_or_create_streak,
    compute_meal_mes,
    compute_meal_mes_with_pairing,
    compute_daily_mes,
    remaining_budget,
    aggregate_daily_totals,
    recompute_daily_score,
    derive_target_weight_lb,
    derive_protein_target_g,
    derive_sugar_ceiling,
    to_display_score,
    display_tier,
    classify_meal_context,
    should_score_meal,
    load_budget_for_user,
    sync_budget_from_profile,
    compute_mea_score,
    build_threshold_context,
    BASE_TIER_THRESHOLDS,
)
from app.schemas.metabolic import SubScores, WeightsUsed

router = APIRouter()


def build_threshold_context_from_computed(computed) -> dict | None:
    """Build threshold context from a ComputedBudget's tier_thresholds."""
    if not computed or not computed.tier_thresholds:
        return None
    base_optimal = BASE_TIER_THRESHOLDS["optimal"]
    shift = computed.tier_thresholds.get("optimal", base_optimal) - base_optimal
    if shift == 0:
        return {"shift": str(shift), "reason": "Default thresholds — no metabolic risk adjustments.", "leniency": "standard"}
    elif shift > 0:
        return {"shift": str(shift), "reason": "Metabolic risk detected — thresholds adjusted for your profile.", "leniency": "stricter"}
    else:
        return {"shift": str(shift), "reason": "Athletic profile — thresholds relaxed for metabolic fitness.", "leniency": "more_lenient"}


def _sync_nutrition_targets_from_computed(db: Session, user_id: str, computed) -> None:
    target = db.query(NutritionTarget).filter(NutritionTarget.user_id == user_id).first()
    if not target:
        target = NutritionTarget(user_id=user_id)
        db.add(target)
    target.calories_target = round(float(getattr(computed, "calorie_target_kcal", None) or computed.tdee or 0), 1)
    target.protein_g_target = round(float(computed.protein_g or 0), 1)
    target.carbs_g_target = round(float(computed.carb_ceiling_g or 0), 1)
    target.fat_g_target = round(float(computed.fat_g or 0), 1)
    target.fiber_g_target = round(float(computed.fiber_g or 0), 1)


def _parse_date(value: str | None) -> date:
    if not value:
        return datetime.utcnow().date()
    try:
        return datetime.fromisoformat(value).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")


def _score_from_db(s: MetabolicScore) -> MESScoreResponse:
    """Build MESScoreResponse from a DB MetabolicScore, including sub_scores from details_json."""
    details = s.details_json or {}
    sub = details.get("sub_scores")
    weights = details.get("weights_used")
    return MESScoreResponse(
        protein_score=s.protein_score,
        fiber_score=s.fiber_score,
        sugar_score=s.sugar_score,
        total_score=s.total_score,
        display_score=s.display_score or to_display_score(s.total_score),
        tier=s.tier,
        display_tier=s.display_tier or display_tier(to_display_score(s.total_score)),
        protein_g=s.protein_g,
        fiber_g=s.fiber_g,
        sugar_g=s.sugar_g,
        carbs_g=float(details.get("carbs_g", 0) or 0) if details.get("carbs_g") else s.sugar_g,
        meal_mes=s.total_score,
        sub_scores=SubScores(**sub) if sub else None,
        weights_used=WeightsUsed(**weights) if weights else None,
        net_carbs_g=details.get("net_carbs_g"),
        fat_g=float(details.get("fat_g", 0) or 0) if details.get("fat_g") else None,
        pairing_applied=bool(details.get("pairing_applied")) if details.get("pairing_applied") is not None else None,
        pairing_gis_bonus=details.get("pairing_gis_bonus"),
        pairing_synergy_bonus=details.get("pairing_synergy_bonus"),
        pairing_reasons=details.get("pairing_reasons"),
    )


def _score_with_default_pairing_override(
    score: MESScoreResponse,
    food_log: FoodLog | None,
    db: Session,
    current_user: User,
) -> MESScoreResponse:
    if not food_log or food_log.source_type != "recipe" or not food_log.source_id:
        return score

    recipe = db.query(Recipe).filter(Recipe.id == str(food_log.source_id)).first()
    if not recipe or getattr(recipe, "needs_default_pairing", None) is not True:
        return score

    default_ids = getattr(recipe, "default_pairing_ids", None) or []
    if not default_ids:
        return score

    default_recipes = db.query(Recipe).filter(Recipe.id.in_(default_ids)).all()
    if not default_recipes:
        return score

    role_priority = ["veg_side", "carb_base", "sauce", "dessert", "protein_base", "full_meal"]
    preferred_default = sorted(
        default_recipes,
        key=lambda candidate: (
            role_priority.index(getattr(candidate, "recipe_role", None) or "full_meal")
            if (getattr(candidate, "recipe_role", None) or "full_meal") in role_priority
            else len(role_priority)
        ),
    )[0]

    budget = get_or_create_budget(db, current_user.id)
    source_nutrition = recipe.nutrition_info or {}
    combined_mes = compute_meal_mes_with_pairing(
        source_nutrition,
        pairing_recipe=preferred_default,
        budget=budget,
        pairing_nutrition=preferred_default.nutrition_info or {},
    )
    adjusted = combined_mes.get("score") or {}
    return score.model_copy(update={
        "display_score": round(float(adjusted.get("display_score", score.display_score) or score.display_score), 1),
        "display_tier": str(adjusted.get("display_tier", score.display_tier) or score.display_tier),
        "pairing_applied": bool(combined_mes.get("pairing_applied")),
        "pairing_gis_bonus": combined_mes.get("pairing_gis_bonus"),
        "pairing_synergy_bonus": combined_mes.get("pairing_synergy_bonus"),
        "pairing_reasons": combined_mes.get("pairing_reasons") or [],
    })


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━ Budget ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/budget", response_model=MetabolicBudgetResponse)
async def get_budget(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = get_or_create_budget(db, current_user.id)
    computed = load_budget_for_user(db, current_user.id)
    return _budget_response(budget, computed)


@router.put("/budget", response_model=MetabolicBudgetResponse)
async def update_budget(
    payload: MetabolicBudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = get_or_create_budget(db, current_user.id)
    for field in ("protein_target_g", "fiber_floor_g", "sugar_ceiling_g",
                   "weight_protein", "weight_fiber", "weight_sugar", "weight_fat"):
        val = getattr(payload, field, None)
        if val is not None:
            setattr(budget, field, val)
    db.commit()
    db.refresh(budget)
    computed = load_budget_for_user(db, current_user.id)
    return _budget_response(budget, computed)


def _budget_response(budget: MetabolicBudget, computed=None) -> MetabolicBudgetResponse:
    """Build budget response with both legacy and new fields."""
    return MetabolicBudgetResponse(
        protein_target_g=budget.protein_target_g,
        fiber_floor_g=budget.fiber_floor_g,
        sugar_ceiling_g=budget.sugar_ceiling_g,
        weight_protein=budget.weight_protein,
        weight_fiber=budget.weight_fiber,
        weight_sugar=budget.weight_sugar,
        carb_ceiling_g=computed.carb_ceiling_g if computed else budget.sugar_ceiling_g,
        fat_target_g=computed.fat_g if computed else 0,
        weight_fat=getattr(budget, "weight_fat", 0.15) or 0.15,
        weight_gis=computed.weights.gis if computed else 0.35,
        tdee=computed.tdee if computed else None,
        ism=computed.ism if computed else None,
        tier_thresholds=computed.tier_thresholds if computed else None,
        threshold_context=build_threshold_context_from_computed(computed) if computed else None,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━ Profile / Onboarding ━━━━━━━━━━━━━━━━━━

@router.post("/profile", response_model=MetabolicProfileResponse)
async def save_profile(
    payload: MetabolicProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save (or update) onboarding biometrics and recalculate derived targets."""
    profile = db.query(MetabolicProfile).filter(MetabolicProfile.user_id == current_user.id).first()
    if not profile:
        profile = MetabolicProfile(user_id=current_user.id)
        db.add(profile)

    profile_fields = (
        "sex", "age", "height_cm", "height_ft", "height_in",
        "weight_lb", "body_fat_pct", "body_fat_method",
        "goal", "activity_level", "target_weight_lb",
        "insulin_resistant", "prediabetes", "type_2_diabetes",
        "fasting_glucose_mgdl", "hba1c_pct", "triglycerides_mgdl",
    )
    for field in profile_fields:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(profile, field, val)

    # Auto-derive height_cm from height_ft/height_in if not explicitly provided
    if not profile.height_cm and profile.height_ft:
        h_in = (profile.height_ft * 12) + (profile.height_in or 0)
        profile.height_cm = round(h_in * 2.54, 1)

    # Derive targets
    p_dict = {
        "sex": profile.sex,
        "age": getattr(profile, "age", None),
        "weight_lb": profile.weight_lb,
        "goal": profile.goal,
        "target_weight_lb": profile.target_weight_lb,
        "body_fat_pct": profile.body_fat_pct,
        "height_cm": profile.height_cm,
    }
    profile.target_weight_lb = derive_target_weight_lb(p_dict)
    profile.protein_target_g = derive_protein_target_g(p_dict)

    db.commit()
    db.refresh(profile)

    # Sync all derived targets into the user's metabolic budget
    computed = sync_budget_from_profile(db, current_user.id)
    _sync_nutrition_targets_from_computed(db, current_user.id, computed)
    db.commit()

    return _profile_response(profile)


@router.get("/profile", response_model=MetabolicProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(MetabolicProfile).filter(MetabolicProfile.user_id == current_user.id).first()
    if not profile:
        return MetabolicProfileResponse()
    return _profile_response(profile)


@router.post("/profile/recalculate", response_model=MetabolicProfileResponse)
async def recalculate_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recompute derived targets from existing profile data."""
    profile = db.query(MetabolicProfile).filter(MetabolicProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No metabolic profile found. Complete onboarding first.")

    p_dict = {
        "sex": profile.sex,
        "age": getattr(profile, "age", None),
        "weight_lb": profile.weight_lb,
        "goal": profile.goal,
        "target_weight_lb": profile.target_weight_lb,
        "body_fat_pct": profile.body_fat_pct,
        "height_cm": profile.height_cm,
    }
    profile.target_weight_lb = derive_target_weight_lb(p_dict)
    profile.protein_target_g = derive_protein_target_g(p_dict)
    db.commit()
    db.refresh(profile)

    computed = sync_budget_from_profile(db, current_user.id)
    _sync_nutrition_targets_from_computed(db, current_user.id, computed)
    db.commit()

    return _profile_response(profile)


def _profile_response(profile: MetabolicProfile) -> MetabolicProfileResponse:
    return MetabolicProfileResponse(
        sex=profile.sex,
        age=getattr(profile, "age", None),
        height_cm=profile.height_cm,
        height_ft=getattr(profile, "height_ft", None),
        height_in=getattr(profile, "height_in", None),
        weight_lb=profile.weight_lb,
        body_fat_pct=profile.body_fat_pct,
        body_fat_method=getattr(profile, "body_fat_method", None),
        goal=profile.goal,
        activity_level=profile.activity_level,
        target_weight_lb=profile.target_weight_lb,
        protein_target_g=profile.protein_target_g,
        insulin_resistant=getattr(profile, "insulin_resistant", None),
        prediabetes=getattr(profile, "prediabetes", None),
        type_2_diabetes=getattr(profile, "type_2_diabetes", None),
        fasting_glucose_mgdl=getattr(profile, "fasting_glucose_mgdl", None),
        hba1c_pct=getattr(profile, "hba1c_pct", None),
        triglycerides_mgdl=getattr(profile, "triglycerides_mgdl", None),
        onboarding_step_completed=getattr(profile, "onboarding_step_completed", None),
    )


@router.patch("/profile", response_model=MetabolicProfileResponse)
async def patch_profile(
    payload: MetabolicProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Partial update of metabolic profile (used from Settings page)."""
    profile = db.query(MetabolicProfile).filter(MetabolicProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No metabolic profile found. Complete onboarding first.")

    profile_fields = (
        "sex", "age", "height_cm", "height_ft", "height_in",
        "weight_lb", "body_fat_pct", "body_fat_method",
        "goal", "activity_level", "target_weight_lb",
        "insulin_resistant", "prediabetes", "type_2_diabetes",
        "fasting_glucose_mgdl", "hba1c_pct", "triglycerides_mgdl",
        "onboarding_step_completed",
    )
    for field in profile_fields:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(profile, field, val)

    # Auto-derive height_cm from height_ft/height_in if not explicitly provided
    if profile.height_ft:
        h_in = (profile.height_ft * 12) + (profile.height_in or 0)
        profile.height_cm = round(h_in * 2.54, 1)

    # Derive targets
    p_dict = {
        "sex": profile.sex,
        "age": getattr(profile, "age", None),
        "weight_lb": profile.weight_lb,
        "goal": profile.goal,
        "target_weight_lb": profile.target_weight_lb,
        "body_fat_pct": profile.body_fat_pct,
        "height_cm": profile.height_cm,
    }
    profile.target_weight_lb = derive_target_weight_lb(p_dict)
    profile.protein_target_g = derive_protein_target_g(p_dict)

    db.commit()
    db.refresh(profile)

    # Sync all derived targets into the user's metabolic budget
    computed = sync_budget_from_profile(db, current_user.id)
    _sync_nutrition_targets_from_computed(db, current_user.id, computed)
    db.commit()

    return _profile_response(profile)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━ Scores ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/score/daily", response_model=DailyMESResponse)
async def get_daily_score(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(date_str)
    budget = get_or_create_budget(db, current_user.id)

    # Ensure score is up to date
    daily = recompute_daily_score(db, current_user.id, day, budget)
    totals = aggregate_daily_totals(db, current_user.id, day)
    rem = remaining_budget(totals, budget)
    details = daily.details_json or {}
    treat_impact = details.get("treat_impact") if isinstance(details, dict) else None

    # Compute MEA score
    computed = load_budget_for_user(db, current_user.id)
    mea = None
    if computed and totals.get("calories", 0) > 0:
        mea = compute_mea_score(
            consumed_kcal=totals.get("calories", 0),
            protein_g=totals.get("protein_g", 0),
            carbs_g=totals.get("carbs_g", 0),
            fat_g=totals.get("fat_g", 0),
            daily_mes=daily.total_score,
            budget=computed,
        )

    return DailyMESResponse(
        date=day.isoformat(),
        score=_score_from_db(daily),
        remaining=rem,
        treat_impact=treat_impact,
        mea=mea,
        pairing_synergy_daily_bonus=float(details.get("pairing_synergy_daily_bonus", 0) or 0),
        pairing_synergy_sources=details.get("pairing_synergy_sources") or [],
    )


@router.get("/score/meals", response_model=list[MealMESResponse])
async def get_meal_scores(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(date_str)
    scores = (
        db.query(MetabolicScore)
        .filter(
            MetabolicScore.user_id == current_user.id,
            MetabolicScore.date == day,
            MetabolicScore.scope == "meal",
        )
        .order_by(MetabolicScore.created_at.asc())
        .all()
    )
    results = []
    for s in scores:
        # Try to get meal title and meal_type from the linked food log
        title = None
        meal_type = None
        if s.food_log:
            title = s.food_log.title
            meal_type = s.food_log.meal_type
        ctx = s.meal_context or "full_meal"
        details = s.details_json or {}

        # Unscored items (components, desserts, sauces) — no score card
        if ctx != "full_meal" and ctx != "daily" and s.total_score == 0:
            results.append(MealMESResponse(
                food_log_id=s.food_log_id,
                title=title,
                score=None,
                meal_context=ctx,
                meal_type=meal_type,
                unscored_hint=details.get("unscored_reason", ""),
            ))
            continue

        score_payload = _score_with_default_pairing_override(_score_from_db(s), s.food_log, db, current_user)
        results.append(MealMESResponse(
            food_log_id=s.food_log_id,
            title=title,
            score=score_payload,
            meal_context=ctx,
            meal_type=meal_type,
        ))
    return results


@router.get("/score/history", response_model=list[ScoreHistoryEntry])
async def get_score_history(
    days: int = Query(default=14, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)
    scores = (
        db.query(MetabolicScore)
        .filter(
            MetabolicScore.user_id == current_user.id,
            MetabolicScore.scope == "daily",
            MetabolicScore.date >= start,
            MetabolicScore.date <= today,
        )
        .order_by(MetabolicScore.date.asc())
        .all()
    )
    return [
        ScoreHistoryEntry(
            date=s.date.isoformat(),
            total_score=s.total_score,
            display_score=s.display_score or to_display_score(s.total_score),
            tier=s.tier,
            display_tier=s.display_tier or display_tier(to_display_score(s.total_score)),
        )
        for s in scores
    ]


@router.post("/score/preview", response_model=MESPreviewResponse)
async def preview_meal_score(
    payload: MESPreviewRequest,
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preview MES for a hypothetical meal and its impact on daily score."""
    budget = get_or_create_budget(db, current_user.id)
    day = _parse_date(date_str)

    # Meal score
    effective_carbs = payload.carbs_g or payload.sugar_g
    nutrition = {
        "protein_g": payload.protein_g,
        "fiber_g": payload.fiber_g,
        "carbs_g": effective_carbs,
        "sugar_g": payload.sugar_g,
        "fat_g": payload.fat_g,
    }
    meal_result = compute_meal_mes(nutrition, budget)
    meal_score = MESScoreResponse(**meal_result)

    # Projected daily: current totals + this meal
    totals = aggregate_daily_totals(db, current_user.id, day)
    projected_totals = {
        "protein_g": totals["protein_g"] + payload.protein_g,
        "fiber_g": totals["fiber_g"] + payload.fiber_g,
        "carbs_g": totals.get("carbs_g", totals["sugar_g"]) + effective_carbs,
        "sugar_g": totals["sugar_g"] + (payload.sugar_g or 0),
    }
    daily_result = compute_daily_mes(projected_totals, budget)
    daily_score = MESScoreResponse(**daily_result)

    return MESPreviewResponse(meal_score=meal_score, projected_daily=daily_score)


# ━━━━━━━━━━━━━━━━━━━━━━━━ Composite MES ━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/score/composite", response_model=CompositeMESResponse)
async def compute_composite_score(
    payload: CompositeMESRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compute combined MES for multiple food logs treated as one meal.

    Used when grouping meal-prep components (e.g. protein + carb + veg)
    into a single composite meal event for scoring.
    """
    if not payload.food_log_ids:
        raise HTTPException(status_code=400, detail="food_log_ids must not be empty")

    logs = (
        db.query(FoodLog)
        .filter(
            FoodLog.id.in_(payload.food_log_ids),
            FoodLog.user_id == current_user.id,
        )
        .all()
    )

    if not logs:
        raise HTTPException(status_code=404, detail="No matching food logs found")

    # Aggregate nutrition from all component logs
    agg = {"protein_g": 0.0, "fiber_g": 0.0, "carbs_g": 0.0, "sugar_g": 0.0, "calories": 0.0, "fat_g": 0.0}
    for log in logs:
        snap = log.nutrition_snapshot or {}
        agg["protein_g"] += float(snap.get("protein", 0) or snap.get("protein_g", 0) or 0)
        agg["fiber_g"] += float(snap.get("fiber", 0) or snap.get("fiber_g", 0) or 0)
        agg["carbs_g"] += float(
            snap.get("carbs", 0) or snap.get("carbs_g", 0)
            or snap.get("sugar", 0) or snap.get("sugar_g", 0) or 0
        )
        agg["sugar_g"] += float(snap.get("sugar", 0) or snap.get("sugar_g", 0) or 0)
        agg["calories"] += float(snap.get("calories", 0) or 0)
        agg["fat_g"] += float(snap.get("fat", 0) or snap.get("fat_g", 0) or 0)

    budget = get_or_create_budget(db, current_user.id)
    pairing_recipe = None
    pairing_nutrition = None
    base_nutrition = None
    for log in logs:
        if log.source_type != "recipe" or not log.source_id:
            continue
        recipe = db.query(Recipe).filter(Recipe.id == log.source_id).first()
        if recipe and getattr(recipe, "pairing_synergy_profile", None):
            pairing_recipe = recipe
            pairing_nutrition = log.nutrition_snapshot or {}
            break
    if pairing_recipe is not None:
        base_nutrition = {}
        for log in logs:
            if log.source_type == "recipe" and str(log.source_id) == str(pairing_recipe.id):
                continue
            snap = log.nutrition_snapshot or {}
            for key, value in snap.items():
                if key in {"protein", "protein_g", "fiber", "fiber_g", "carbs", "carbs_g", "sugar", "sugar_g", "calories", "fat", "fat_g"}:
                    base_nutrition[key] = float(base_nutrition.get(key, 0) or 0) + float(value or 0)
    paired_result = (
        compute_meal_mes_with_pairing(base_nutrition or agg, pairing_recipe, budget, pairing_nutrition)
        if pairing_recipe is not None
        else None
    )
    result = (paired_result or {}).get("score") or compute_meal_mes(agg, budget)

    return CompositeMESResponse(
        score=MESScoreResponse(**result),
        component_count=len(logs),
        total_calories=round(agg["calories"], 1),
        total_protein_g=round(agg["protein_g"], 1),
        total_carbs_g=round(agg["carbs_g"], 1),
        total_fat_g=round(agg["fat_g"], 1),
        total_fiber_g=round(agg["fiber_g"], 1),
        macro_only_combined_score=float(((paired_result or {}).get("macro_only_score") or {}).get("total_score", result.get("total_score", 0)) or 0),
        pairing_adjusted_score=float(result.get("total_score", 0) or 0),
        pairing_gis_bonus=(paired_result or {}).get("pairing_gis_bonus"),
        pairing_synergy_bonus=(paired_result or {}).get("pairing_synergy_bonus"),
        pairing_reasons=(paired_result or {}).get("pairing_reasons") or [],
        pairing_applied=bool((paired_result or {}).get("pairing_applied")),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━ Streak ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/streak", response_model=MetabolicStreakResponse)
async def get_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    streak = get_or_create_streak(db, current_user.id)
    return MetabolicStreakResponse(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        threshold=streak.threshold,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━ Remaining Budget ━━━━━━━━━━━━━━━━━━━━━━

@router.get("/remaining-budget", response_model=RemainingBudgetResponse)
async def get_remaining_budget(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = _parse_date(date_str)
    budget = get_or_create_budget(db, current_user.id)
    totals = aggregate_daily_totals(db, current_user.id, day)
    rem = remaining_budget(totals, budget)
    return RemainingBudgetResponse(**rem)


# ━━━━━━━━━━━━━━━━━━━━━━━━ Meal Suggestions ━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/meal-suggestions", response_model=list[MealSuggestionResponse])
async def get_meal_suggestions(
    date_str: str | None = Query(default=None, alias="date"),
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return recipes that fit the user's remaining energy budget.
    Scores each recipe against the remaining budget and returns those
    that would keep the user in 'stable' or 'optimal' territory.
    """
    day = _parse_date(date_str)
    budget = get_or_create_budget(db, current_user.id)
    totals = aggregate_daily_totals(db, current_user.id, day)
    rem = remaining_budget(totals, budget)

    # Fetch all recipes
    recipes = db.query(Recipe).limit(200).all()

    suggestions: list[dict] = []
    for recipe in recipes:
        nutrition = recipe.nutrition_info or {}
        protein_g = float(nutrition.get("protein", 0) or nutrition.get("protein_g", 0) or 0)
        fiber_g = float(nutrition.get("fiber", 0) or nutrition.get("fiber_g", 0) or 0)
        carbs_g = float(nutrition.get("carbs", 0) or nutrition.get("carbs_g", 0) or 0)
        sugar_g = float(nutrition.get("sugar", 0) or nutrition.get("sugar_g", 0) or 0)

        # Compute what daily totals would look like with this meal added
        projected_totals = {
            "protein_g": totals["protein_g"] + protein_g,
            "fiber_g": totals["fiber_g"] + fiber_g,
            "carbs_g": totals.get("carbs_g", totals["sugar_g"]) + carbs_g,
            "sugar_g": totals["sugar_g"] + sugar_g,
        }
        daily_result = compute_daily_mes(projected_totals, budget)
        meal_result = compute_meal_mes(nutrition, budget)

        # Only suggest meals that keep the user at stable (60+) or better
        if daily_result["total_score"] >= 60:
            suggestions.append({
                "recipe_id": recipe.id,
                "title": recipe.title,
                "description": recipe.description,
                "meal_score": meal_result["total_score"],
                "meal_tier": meal_result["tier"],
                "projected_daily_score": daily_result["total_score"],
                "projected_daily_tier": daily_result["tier"],
                "protein_g": protein_g,
                "fiber_g": fiber_g,
                "sugar_g": sugar_g,
                "calories": float(nutrition.get("calories", 0) or 0),
                "cuisine": recipe.cuisine,
                "total_time_min": recipe.total_time_min,
            })

    # Sort by projected daily score descending
    suggestions.sort(key=lambda s: s["projected_daily_score"], reverse=True)
    return suggestions[:limit]


# ━━━━━━━━━━━━━━━━━━━━━━ Coach Insights ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _time_of_day() -> str:
    """Return morning/afternoon/evening based on current hour."""
    from datetime import datetime
    hour = datetime.now().hour
    if hour < 12:
        return "morning"
    elif hour < 17:
        return "afternoon"
    return "evening"


def _generate_coach_insights(
    profile: MetabolicProfile | None,
    computed,
    score_obj,
    totals: dict,
    rem: dict,
    meals_logged: int,
) -> list[CoachInsight]:
    """Generate 3-6 personalized coach insights using full user context."""
    insights: list[CoachInsight] = []

    display_score = getattr(score_obj, "display_score", None) or getattr(score_obj, "total_score", 0) or 0
    tier = getattr(score_obj, "display_tier", None) or getattr(score_obj, "tier", "crash_risk")

    protein_left = rem.get("protein_remaining_g", 0)
    fiber_left = rem.get("fiber_remaining_g", 0)
    carb_headroom = rem.get("carb_headroom_g", rem.get("sugar_headroom_g", 999))
    fat_left = rem.get("fat_remaining_g", 0)

    goal = getattr(profile, "goal", None) or "" if profile else ""
    is_ir = bool(profile and (getattr(profile, "insulin_resistant", False) or getattr(profile, "type_2_diabetes", False)))
    is_t2d = bool(profile and getattr(profile, "type_2_diabetes", False))
    activity = getattr(profile, "activity_level", "") or "" if profile else ""
    time_ctx = _time_of_day()

    protein_target = computed.protein_g if computed else 0
    carb_ceiling = computed.carb_ceiling_g if computed else 130

    # ─── No meals logged ───
    if meals_logged == 0:
        if time_ctx == "morning":
            insights.append(CoachInsight(
                icon="sunny",
                title="Good morning — fuel up right",
                body=f"Start with protein to set your MES trajectory. Aim for 30-40g in your first meal."
                + (" Keep carbs moderate to protect your insulin sensitivity." if is_ir else ""),
                accent="#F59E0B",
                priority=10,
                action=CoachInsightAction(type="chat", query="high protein breakfast"),
            ))
        elif time_ctx == "afternoon":
            insights.append(CoachInsight(
                icon="restaurant",
                title="No meals logged yet today",
                body="It's afternoon and you haven't logged anything. Start with a protein-rich meal to build momentum.",
                accent="#FF9500",
                priority=10,
                action=CoachInsightAction(type="chat", query="quick high protein lunch"),
            ))
        else:
            insights.append(CoachInsight(
                icon="moon",
                title="Late start — make it count",
                body=f"Focus on a balanced dinner with at least {min(40, int(protein_target * 0.3))}g protein and plenty of fiber.",
                accent="#8B5CF6",
                priority=10,
                action=CoachInsightAction(type="chat", query="balanced high protein dinner"),
            ))
        return insights

    # ─── Tier headline ───
    if tier == "optimal":
        headline_body = f"You're at {int(display_score)} MES — elite fuel territory."
        if is_ir:
            headline_body += " Even with insulin resistance, your carb management is on point."
        elif is_t2d:
            headline_body += " Managing T2D nutrition like a pro."
        headline_body += " Keep this momentum."
        insights.append(CoachInsight(
            icon="trophy", title="Optimal fuel day", body=headline_body,
            accent="#34C759", priority=9,
        ))
    elif tier in ("good", "stable"):
        gap = "protein" if protein_left > fiber_left else "fiber"
        insights.append(CoachInsight(
            icon="trending-up",
            title="Strong day — close to optimal",
            body=f"Score is {int(display_score)}. A {gap}-rich meal could push you into the elite zone.",
            accent="#4A90D9", priority=9,
            action=CoachInsightAction(type="chat", query=f"high {gap} meal"),
        ))
    elif tier in ("moderate", "shaky"):
        insights.append(CoachInsight(
            icon="alert-circle",
            title="Energy may fluctuate",
            body=f"MES is {int(display_score)}. Prioritize protein and fiber in your next meal to stabilize."
            + (" Watch your carb intake carefully." if is_ir else ""),
            accent="#FF9500", priority=9,
            action=CoachInsightAction(type="chat", query="balanced meal with protein and fiber"),
        ))
    else:
        insights.append(CoachInsight(
            icon="flash",
            title="Let's turn this around",
            body=f"Score is {int(display_score)} — potential energy crashes ahead. A protein-forward meal with fiber can recover it fast.",
            accent="#FF4444", priority=9,
            action=CoachInsightAction(type="chat", query="high protein recovery meal"),
        ))

    # ─── Protein insight ───
    if protein_left > 40:
        approx = "a chicken breast + a shake" if protein_left > 60 else "a solid portion of lean protein"
        body = f"You still need {int(protein_left)}g protein — roughly {approx}."
        if time_ctx == "evening":
            body += " Don't leave this until bedtime."
        if goal == "muscle_gain":
            body += " Critical for your muscle gain goal."
        insights.append(CoachInsight(
            icon="barbell",
            title=f"{int(protein_left)}g protein to go",
            body=body, accent="#22C55E", priority=7,
            action=CoachInsightAction(type="chat", query=f"meal with at least {int(min(protein_left, 50))}g protein"),
        ))
    elif protein_left > 10:
        insights.append(CoachInsight(
            icon="checkmark-circle",
            title=f"Almost there — {int(protein_left)}g protein left",
            body="A moderate portion of lean protein will close this gap.",
            accent="#22C55E", priority=5,
        ))
    elif protein_left <= 0:
        insights.append(CoachInsight(
            icon="checkmark-done-circle",
            title="Protein target hit!",
            body="You've met your protein target — the biggest factor in a high MES.",
            accent="#34C759", priority=3,
        ))

    # ─── Fiber insight ───
    if fiber_left > 10:
        insights.append(CoachInsight(
            icon="leaf",
            title=f"{int(fiber_left)}g fiber remaining",
            body="Add vegetables, legumes, or whole grains. Fiber supports sustained energy and digestion.",
            accent="#10B981", priority=6,
        ))
    elif fiber_left > 3:
        insights.append(CoachInsight(
            icon="leaf",
            title=f"Fiber almost done — {int(fiber_left)}g left",
            body="A side salad or some fruit will complete your fiber target.",
            accent="#10B981", priority=4,
        ))

    # ─── Carb headroom / IR-specific ───
    if is_ir and carb_headroom < 30 and carb_headroom >= 0:
        insights.append(CoachInsight(
            icon="shield-checkmark",
            title=f"Only {int(carb_headroom)}g carb headroom",
            body=f"Your insulin sensitivity means carbs hit harder. With {int(carb_headroom)}g left of your {int(carb_ceiling)}g ceiling, lean into protein and fats.",
            accent="#F59E0B", priority=8,
            action=CoachInsightAction(type="chat", query=f"low carb dinner under {int(carb_headroom)}g carbs"),
        ))
    elif carb_headroom < 20 and carb_headroom >= 0 and meals_logged > 0:
        insights.append(CoachInsight(
            icon="shield-checkmark",
            title=f"{int(carb_headroom)}g carb headroom left",
            body="You're close to your ceiling. Opt for low-carb sides — leafy greens, lean meats, or eggs.",
            accent="#F59E0B", priority=6,
        ))

    # ─── Goal-specific extras ───
    if goal == "fat_loss" and meals_logged >= 2 and tier in ("optimal", "good", "stable"):
        insights.append(CoachInsight(
            icon="flame",
            title="On track for fat loss",
            body="Your macros support steady energy without excess. Keep meals balanced through the rest of the day.",
            accent="#FF6B35", priority=2,
        ))
    elif goal == "muscle_gain" and protein_left <= 10 and meals_logged >= 2:
        insights.append(CoachInsight(
            icon="barbell",
            title="Muscle fuel locked in",
            body="Protein target met with meals to spare. Distribute remaining carbs and fats to fuel your training.",
            accent="#22C55E", priority=2,
        ))

    # Sort by priority descending, return top 6
    insights.sort(key=lambda x: x.priority, reverse=True)
    return insights[:6]


def _generate_food_suggestions(
    profile: MetabolicProfile | None,
    rem: dict,
) -> list[dict]:
    """Generate categorized food suggestions based on remaining budget and profile."""
    suggestions: list[dict] = []
    protein_left = rem.get("protein_remaining_g", 0)
    fiber_left = rem.get("fiber_remaining_g", 0)
    carb_headroom = rem.get("carb_headroom_g", rem.get("sugar_headroom_g", 999))
    is_ir = bool(profile and (getattr(profile, "insulin_resistant", False) or getattr(profile, "type_2_diabetes", False)))

    if protein_left > 10:
        protein_foods = [
            {"name": "Chicken Breast", "icon": "restaurant", "detail": "31g protein/100g"},
            {"name": "Eggs", "icon": "egg", "detail": "13g protein/2 eggs"},
            {"name": "Greek Yogurt", "icon": "cafe", "detail": "10g protein/100g"},
            {"name": "Salmon", "icon": "fish", "detail": "25g protein/100g"},
            {"name": "Cottage Cheese", "icon": "nutrition", "detail": "11g protein/100g"},
            {"name": "Turkey Breast", "icon": "restaurant", "detail": "29g protein/100g"},
        ]
        suggestions.append({
            "category": "protein",
            "label": "Protein-Rich",
            "subtitle": f"{int(protein_left)}g to go",
            "icon": "barbell",
            "color": "#22C55E",
            "foods": protein_foods[:5],
            "search_query": "high protein",
        })

    if fiber_left > 5:
        fiber_foods = [
            {"name": "Broccoli", "icon": "leaf", "detail": "2.6g fiber/100g"},
            {"name": "Black Beans", "icon": "ellipse", "detail": "8.7g fiber/100g"},
            {"name": "Avocado", "icon": "leaf", "detail": "6.7g fiber/100g"},
            {"name": "Chia Seeds", "icon": "water", "detail": "34g fiber/100g"},
            {"name": "Raspberries", "icon": "nutrition", "detail": "6.5g fiber/100g"},
            {"name": "Almonds", "icon": "ellipse", "detail": "12.5g fiber/100g"},
        ]
        suggestions.append({
            "category": "fiber",
            "label": "Fiber-Rich",
            "subtitle": f"{int(fiber_left)}g to go",
            "icon": "leaf",
            "color": "#10B981",
            "foods": fiber_foods[:5],
            "search_query": "high fiber",
        })

    if carb_headroom < 30 or is_ir:
        low_carb_foods = [
            {"name": "Spinach", "icon": "leaf", "detail": "1.4g carbs/100g"},
            {"name": "Zucchini", "icon": "leaf", "detail": "3.1g carbs/100g"},
            {"name": "Cauliflower", "icon": "leaf", "detail": "3g carbs/100g"},
            {"name": "Mushrooms", "icon": "leaf", "detail": "3.3g carbs/100g"},
            {"name": "Bell Peppers", "icon": "leaf", "detail": "4.6g carbs/100g"},
        ]
        suggestions.append({
            "category": "low_carb",
            "label": "Low-Carb Options",
            "subtitle": f"{int(carb_headroom)}g headroom" if carb_headroom < 30 else "IR-friendly picks",
            "icon": "shield-checkmark",
            "color": "#F59E0B",
            "foods": low_carb_foods[:5],
            "search_query": "low carb vegetables",
        })

    # Fallback balanced mix
    if not suggestions:
        suggestions.append({
            "category": "balanced",
            "label": "Balanced Picks",
            "subtitle": "You're on track",
            "icon": "sparkles",
            "color": "#8B5CF6",
            "foods": [
                {"name": "Salmon", "icon": "fish", "detail": "25g protein/100g"},
                {"name": "Avocado", "icon": "leaf", "detail": "Healthy fats + fiber"},
                {"name": "Sweet Potato", "icon": "nutrition", "detail": "Complex carbs + fiber"},
            ],
            "search_query": "whole food",
        })

    return suggestions


@router.get("/coach-insights", response_model=CoachInsightsResponse)
async def get_coach_insights(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return personalized coach insights based on user profile, budget, and daily state."""
    day = _parse_date(date_str)
    budget = get_or_create_budget(db, current_user.id)
    totals = aggregate_daily_totals(db, current_user.id, day)
    rem = remaining_budget(totals, budget)
    computed = load_budget_for_user(db, current_user.id)

    profile = db.query(MetabolicProfile).filter(
        MetabolicProfile.user_id == current_user.id,
    ).first()

    # Count meals logged today
    meals_logged = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == current_user.id, FoodLog.date == day)
        .count()
    )

    # Get daily score
    score_obj = recompute_daily_score(db, current_user.id, day, budget)

    insights = _generate_coach_insights(profile, computed, score_obj, totals, rem, meals_logged)
    food_suggestions = _generate_food_suggestions(profile, rem)

    return CoachInsightsResponse(insights=insights, suggested_foods=food_suggestions)


# ━━━━━━━━━━━━━━━━━━━━ Pairing Suggestions ━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/pairings/suggestions")
async def get_pairing_suggestions(
    recipe_id: str = Query(..., description="Source recipe ID to find pairings for"),
    limit: int = Query(5, ge=1, le=20),
    side_type: str | None = Query(None, description="Filter by side type: veg_side, carb_base, protein_base, sauce"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return side / pairing suggestions for a recipe, sorted by MES improvement.

    If the source recipe has `default_pairing_ids`, those are returned first.
    Then additional suggestions are ranked by MES delta (how much they improve
    the combined MES when added to the source recipe).
    """
    source = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Recipe not found")

    source_role = getattr(source, 'recipe_role', None) or 'full_meal'
    source_is_component = bool(getattr(source, 'is_component', False))
    source_needs_default_pairing = getattr(source, 'needs_default_pairing', None) is True

    if source_role == 'full_meal' and not source_is_component and not source_needs_default_pairing:
        return []

    budget = get_or_create_budget(db, current_user.id)
    source_nutrition = source.nutrition_info or {}
    source_mes = compute_meal_mes(source_nutrition, budget)

    # Gather candidates: components and sides
    candidates_q = db.query(Recipe).filter(Recipe.id != recipe_id)
    if side_type:
        candidates_q = candidates_q.filter(Recipe.recipe_role == side_type)
    else:
        # Default: look for veg_side, carb_base, protein_base, sauce
        candidates_q = candidates_q.filter(
            Recipe.recipe_role.in_(["veg_side", "carb_base", "protein_base", "sauce"])
        )
    candidates = candidates_q.limit(200).all()

    # Also get explicitly linked pairings
    default_ids = getattr(source, 'default_pairing_ids', None) or []
    default_recipes = {}
    if default_ids:
        defaults = db.query(Recipe).filter(Recipe.id.in_(default_ids)).all()
        default_recipes = {str(r.id): r for r in defaults}

    # Pick one primary default pairing for cleaner UX in the client.
    # Prefer true sides over another protein when a full meal has multiple defaults.
    preferred_default_id = None
    stored_default_pairing_id = (source_nutrition or {}).get("mes_default_pairing_id")
    if stored_default_pairing_id and str(stored_default_pairing_id) in default_recipes:
        preferred_default_id = str(stored_default_pairing_id)
    elif default_recipes:
        role_priority = ["veg_side", "carb_base", "sauce", "dessert", "protein_base", "full_meal"]
        ordered_defaults = sorted(
            default_recipes.values(),
            key=lambda r: (
                role_priority.index(getattr(r, 'recipe_role', None) or "full_meal")
                if (getattr(r, 'recipe_role', None) or "full_meal") in role_priority
                else len(role_priority)
            )
        )
        preferred_default_id = str(ordered_defaults[0].id)

    results = []
    for candidate in candidates:
        if getattr(candidate, "pairing_synergy_profile", None) is None:
            continue
        c_nutrition = candidate.nutrition_info or {}
        is_default_pairing = str(candidate.id) == preferred_default_id

        stored_adjusted = source_nutrition.get("mes_default_pairing_adjusted_score")
        stored_macro_only = source_nutrition.get("mes_score_with_default_pairing")
        stored_delta = source_nutrition.get("mes_default_pairing_delta")
        stored_gis_bonus = source_nutrition.get("mes_default_pairing_gis_bonus")
        stored_synergy_bonus = source_nutrition.get("mes_default_pairing_synergy_bonus")
        stored_reasons = (
            source_nutrition.get("mes_default_pairing_reasons")
            or source_nutrition.get("mes_default_pairing_explanation")
            or []
        )
        stored_pairing_role = source_nutrition.get("mes_default_pairing_role")

        if is_default_pairing and (stored_adjusted is not None or stored_macro_only is not None):
            paired_display_score = float(stored_adjusted if stored_adjusted is not None else stored_macro_only)
            macro_only_score = float(stored_macro_only if stored_macro_only is not None else paired_display_score)
            mes_delta = float(stored_delta if stored_delta is not None else 0)
            results.append({
                "recipe_id": str(candidate.id),
                "title": candidate.title,
                "recipe_role": stored_pairing_role or getattr(candidate, 'recipe_role', 'full_meal') or 'full_meal',
                "cuisine": candidate.cuisine,
                "total_time_min": candidate.total_time_min or 0,
                "nutrition_info": c_nutrition,
                "combined_mes_score": round(paired_display_score, 1),
                "combined_display_score": round(paired_display_score, 1),
                "combined_tier": display_tier(paired_display_score),
                "mes_delta": round(mes_delta, 1),
                "macro_only_combined_score": round(macro_only_score, 1),
                "pairing_adjusted_score": round(paired_display_score, 1),
                "pairing_gis_bonus": float(stored_gis_bonus or 0),
                "pairing_synergy_bonus": float(stored_synergy_bonus or 0),
                "pairing_reasons": stored_reasons,
                "pairing_applied": bool((stored_gis_bonus or 0) or (stored_synergy_bonus or 0) or stored_reasons),
                "pairing_timing": "before_meal" if "eat before meal" in stored_reasons else "with_meal",
                "is_default_pairing": True,
            })
            continue

        combined_mes = compute_meal_mes_with_pairing(
            source_nutrition,
            pairing_recipe=candidate,
            budget=budget,
            pairing_nutrition=c_nutrition,
        )
        score = combined_mes["score"]
        macro_only = combined_mes.get("macro_only_score") or score
        delta = score["total_score"] - source_mes["total_score"]

        results.append({
            "recipe_id": str(candidate.id),
            "title": candidate.title,
            "recipe_role": getattr(candidate, 'recipe_role', 'full_meal') or 'full_meal',
            "cuisine": candidate.cuisine,
            "total_time_min": candidate.total_time_min or 0,
            "nutrition_info": c_nutrition,
            "combined_mes_score": round(score["total_score"], 1),
            "combined_display_score": round(to_display_score(score["total_score"]), 1),
            "combined_tier": display_tier(to_display_score(score["total_score"])),
            "mes_delta": round(delta, 1),
            "macro_only_combined_score": round(float(macro_only["total_score"] or 0), 1),
            "pairing_adjusted_score": round(float(score["total_score"] or 0), 1),
            "pairing_gis_bonus": combined_mes["pairing_gis_bonus"],
            "pairing_synergy_bonus": combined_mes["pairing_synergy_bonus"],
            "pairing_reasons": combined_mes["pairing_reasons"],
            "pairing_applied": bool(combined_mes["pairing_applied"]),
            "pairing_timing": combined_mes.get("pairing_recommended_timing", "with_meal"),
            "is_default_pairing": is_default_pairing,
        })

    # Sort: defaults first, then by MES delta descending
    results.sort(key=lambda r: (not r["is_default_pairing"], -r["mes_delta"]))
    return results[:limit]


# ━━━━━━━━━━━━━━━ Composite MES Preview (by recipe IDs) ━━━━━━━━━━━━

@router.post("/score/preview-composite")
async def preview_composite_score(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preview combined MES for a set of recipes (before logging).

    Body: { "recipe_ids": ["id1", "id2", ...], "servings": [1, 1, ...] }
    """
    recipe_ids = payload.get("recipe_ids", [])
    servings_list = payload.get("servings", [1.0] * len(recipe_ids))

    if not recipe_ids:
        raise HTTPException(status_code=400, detail="recipe_ids must not be empty")

    recipes = db.query(Recipe).filter(Recipe.id.in_(recipe_ids)).all()
    recipe_map = {str(r.id): r for r in recipes}

    agg = {"protein_g": 0.0, "fiber_g": 0.0, "carbs_g": 0.0, "sugar_g": 0.0, "calories": 0.0, "fat_g": 0.0}
    for i, rid in enumerate(recipe_ids):
        r = recipe_map.get(rid)
        if not r:
            continue
        n = r.nutrition_info or {}
        s = float(servings_list[i]) if i < len(servings_list) else 1.0
        agg["protein_g"] += float(n.get("protein", 0) or n.get("protein_g", 0) or 0) * s
        agg["fiber_g"] += float(n.get("fiber", 0) or n.get("fiber_g", 0) or 0) * s
        agg["carbs_g"] += float(n.get("carbs", 0) or n.get("carbs_g", 0) or 0) * s
        agg["sugar_g"] += float(n.get("sugar", 0) or n.get("sugar_g", 0) or 0) * s
        agg["calories"] += float(n.get("calories", 0) or 0) * s
        agg["fat_g"] += float(n.get("fat", 0) or n.get("fat_g", 0) or 0) * s

    budget = get_or_create_budget(db, current_user.id)
    pairing_recipe = None
    pairing_index = None
    for idx, rid in enumerate(recipe_ids):
        recipe = recipe_map.get(rid)
        if recipe is not None and getattr(recipe, "pairing_synergy_profile", None):
            pairing_recipe = recipe
            pairing_index = idx
            break
    base_nutrition = agg
    paired_result = None
    if pairing_recipe is not None and getattr(pairing_recipe, "pairing_synergy_profile", None):
        base_nutrition = {"protein_g": 0.0, "fiber_g": 0.0, "carbs_g": 0.0, "sugar_g": 0.0, "calories": 0.0, "fat_g": 0.0}
        for i, rid in enumerate(recipe_ids):
            r = recipe_map.get(rid)
            if not r or str(r.id) == str(pairing_recipe.id):
                continue
            n = r.nutrition_info or {}
            s = float(servings_list[i]) if i < len(servings_list) else 1.0
            base_nutrition["protein_g"] += float(n.get("protein", 0) or n.get("protein_g", 0) or 0) * s
            base_nutrition["fiber_g"] += float(n.get("fiber", 0) or n.get("fiber_g", 0) or 0) * s
            base_nutrition["carbs_g"] += float(n.get("carbs", 0) or n.get("carbs_g", 0) or 0) * s
            base_nutrition["sugar_g"] += float(n.get("sugar", 0) or n.get("sugar_g", 0) or 0) * s
            base_nutrition["calories"] += float(n.get("calories", 0) or 0) * s
            base_nutrition["fat_g"] += float(n.get("fat", 0) or n.get("fat_g", 0) or 0) * s
        pairing_nutrition = {
            "protein_g": float((pairing_recipe.nutrition_info or {}).get("protein", 0) or (pairing_recipe.nutrition_info or {}).get("protein_g", 0) or 0) * (float(servings_list[pairing_index]) if pairing_index is not None and pairing_index < len(servings_list) else 1.0),
            "fiber_g": float((pairing_recipe.nutrition_info or {}).get("fiber", 0) or (pairing_recipe.nutrition_info or {}).get("fiber_g", 0) or 0) * (float(servings_list[pairing_index]) if pairing_index is not None and pairing_index < len(servings_list) else 1.0),
            "carbs_g": float((pairing_recipe.nutrition_info or {}).get("carbs", 0) or (pairing_recipe.nutrition_info or {}).get("carbs_g", 0) or 0) * (float(servings_list[pairing_index]) if pairing_index is not None and pairing_index < len(servings_list) else 1.0),
            "sugar_g": float((pairing_recipe.nutrition_info or {}).get("sugar", 0) or (pairing_recipe.nutrition_info or {}).get("sugar_g", 0) or 0) * (float(servings_list[pairing_index]) if pairing_index is not None and pairing_index < len(servings_list) else 1.0),
            "calories": float((pairing_recipe.nutrition_info or {}).get("calories", 0) or 0) * (float(servings_list[pairing_index]) if pairing_index is not None and pairing_index < len(servings_list) else 1.0),
            "fat_g": float((pairing_recipe.nutrition_info or {}).get("fat", 0) or (pairing_recipe.nutrition_info or {}).get("fat_g", 0) or 0) * (float(servings_list[pairing_index]) if pairing_index is not None and pairing_index < len(servings_list) else 1.0),
        }
        paired_result = compute_meal_mes_with_pairing(base_nutrition, pairing_recipe, budget, pairing_nutrition)
    result = (paired_result or {}).get("score") or compute_meal_mes(agg, budget)

    return {
        "score": result,
        "display_score": round(to_display_score(result["total_score"]), 1),
        "display_tier": display_tier(to_display_score(result["total_score"])),
        "component_count": len(recipes),
        "total_calories": round(agg["calories"], 1),
        "total_protein_g": round(agg["protein_g"], 1),
        "total_carbs_g": round(agg["carbs_g"], 1),
        "total_fat_g": round(agg["fat_g"], 1),
        "total_fiber_g": round(agg["fiber_g"], 1),
        "macro_only_combined_score": round(float(((paired_result or {}).get("macro_only_score") or {}).get("total_score", result["total_score"]) or result["total_score"]), 1),
        "pairing_adjusted_score": round(float(result["total_score"] or 0), 1),
        "pairing_gis_bonus": (paired_result or {}).get("pairing_gis_bonus"),
        "pairing_synergy_bonus": (paired_result or {}).get("pairing_synergy_bonus"),
        "pairing_reasons": (paired_result or {}).get("pairing_reasons") or [],
        "pairing_applied": bool((paired_result or {}).get("pairing_applied")),
        "pairing_timing": (paired_result or {}).get("pairing_recommended_timing", "with_meal"),
    }
