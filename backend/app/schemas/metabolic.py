"""Pydantic schemas for Metabolic Budget endpoints."""
from pydantic import BaseModel, Field
from typing import Any, Optional, List, Dict


# ──────────────────── Sub-score detail ──────────

class SubScores(BaseModel):
    gis: float = 0
    pas: float = 0
    fs: float = 0
    fas: float = 0


class WeightsUsed(BaseModel):
    gis: float = 0.24
    protein: float = 0.34
    fiber: float = 0.24
    fat: float = 0.18


# ──────────────────── Budget ────────────────────

class MetabolicBudgetResponse(BaseModel):
    protein_target_g: float
    fiber_floor_g: float
    sugar_ceiling_g: float
    weight_protein: float
    weight_fiber: float
    weight_sugar: float  # Legacy alias for weight_gis — kept for backward compat
    # ── New fields ──
    carb_ceiling_g: float = 130.0
    fat_target_g: float = 0
    weight_fat: float = 0.18
    weight_gis: float = 0.24
    tdee: Optional[float] = None
    ism: Optional[float] = None
    is_personalized: bool = True
    # ── Phase 6: Threshold context ──
    tier_thresholds: Optional[Dict[str, int]] = None
    threshold_context: Optional[Dict[str, str]] = None
    # ── Bonus transparency ──
    ingredient_gis_daily_bonus: Optional[float] = None
    pairing_synergy_daily_bonus: Optional[float] = None


class MetabolicBudgetUpdate(BaseModel):
    protein_target_g: Optional[float] = None
    fiber_floor_g: Optional[float] = None
    sugar_ceiling_g: Optional[float] = None
    weight_protein: Optional[float] = None
    weight_fiber: Optional[float] = None
    weight_sugar: Optional[float] = None
    weight_fat: Optional[float] = None


# ──────────────────── Profile / Onboarding ──────

class MetabolicProfileCreate(BaseModel):
    sex: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[float] = None
    height_ft: Optional[int] = None
    height_in: Optional[float] = None
    weight_lb: Optional[float] = Field(default=None, alias=None)
    weight_lbs: Optional[float] = Field(default=None, exclude=True)  # Common typo alias
    weight_kg: Optional[float] = None

    def model_post_init(self, __context: Any) -> None:
        # Accept weight_lbs as an alias for weight_lb
        if self.weight_lbs is not None and self.weight_lb is None:
            self.weight_lb = self.weight_lbs
    body_fat_pct: Optional[float] = None
    body_fat_method: Optional[str] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    target_weight_lb: Optional[float] = None
    insulin_resistant: Optional[bool] = None
    prediabetes: Optional[bool] = None
    type_2_diabetes: Optional[bool] = None
    fasting_glucose_mgdl: Optional[float] = None
    hba1c_pct: Optional[float] = None
    triglycerides_mgdl: Optional[float] = None
    # Batch 2 safety flags (QA findings N1–N4) — physiological + life-stage
    # states that require bespoke calorie / sodium / fiber targeting and/or
    # suppression of restriction-adjacent UI. Defaulting to None so existing
    # clients that don't send these are unchanged.
    lactating: Optional[bool] = None
    months_postpartum: Optional[int] = None
    hypertension: Optional[bool] = None
    systolic_mmhg: Optional[int] = None
    diastolic_mmhg: Optional[int] = None
    ibd_active_flare: Optional[bool] = None
    low_residue_required: Optional[bool] = None
    eating_disorder_recovery: Optional[bool] = None
    onboarding_step_completed: Optional[int] = None


class MetabolicProfileResponse(BaseModel):
    sex: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[float] = None
    height_ft: Optional[int] = None
    height_in: Optional[float] = None
    weight_lb: Optional[float] = None
    body_fat_pct: Optional[float] = None
    body_fat_method: Optional[str] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    target_weight_lb: Optional[float] = None
    protein_target_g: Optional[float] = None
    insulin_resistant: Optional[bool] = None
    prediabetes: Optional[bool] = None
    type_2_diabetes: Optional[bool] = None
    fasting_glucose_mgdl: Optional[float] = None
    hba1c_pct: Optional[float] = None
    triglycerides_mgdl: Optional[float] = None
    # Batch 2 safety flags — mirrored on response
    lactating: Optional[bool] = None
    months_postpartum: Optional[int] = None
    hypertension: Optional[bool] = None
    systolic_mmhg: Optional[int] = None
    diastolic_mmhg: Optional[int] = None
    ibd_active_flare: Optional[bool] = None
    low_residue_required: Optional[bool] = None
    eating_disorder_recovery: Optional[bool] = None
    onboarding_step_completed: Optional[int] = None


# ──────────────────── Scores ────────────────────

class MESScoreResponse(BaseModel):
    protein_score: float
    fiber_score: float
    sugar_score: float
    total_score: float  # raw MES (backend logic, gating)
    display_score: float = 0  # same as total_score (no inflation)
    tier: str
    display_tier: str = ""  # tier derived from display_score
    protein_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    carbs_g: float = 0
    # ── New fields ──
    meal_mes: Optional[float] = None
    sub_scores: Optional[SubScores] = None
    weights_used: Optional[WeightsUsed] = None
    net_carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    ingredient_gis_adjustment: Optional[float] = None
    ingredient_gis_reasons: Optional[List[str]] = None
    rs3_g: Optional[float] = None
    effective_fiber_g: Optional[float] = None
    pairing_applied: Optional[bool] = None
    pairing_gis_bonus: Optional[float] = None
    pairing_synergy_bonus: Optional[float] = None
    pairing_reasons: Optional[List[str]] = None


class DailyMESResponse(BaseModel):
    date: str
    score: MESScoreResponse
    remaining: Optional[dict] = None
    treat_impact: Optional[dict] = None
    mea: Optional[dict] = None
    ingredient_gis_daily_bonus: Optional[float] = None
    ingredient_gis_sources: Optional[List[Dict[str, Any]]] = None
    pairing_synergy_daily_bonus: Optional[float] = None
    pairing_synergy_sources: Optional[List[Dict[str, Any]]] = None


class MealMESResponse(BaseModel):
    food_log_id: Optional[str] = None
    title: Optional[str] = None
    score: Optional[MESScoreResponse] = None
    meal_context: str = "full_meal"
    meal_type: Optional[str] = None  # breakfast/lunch/dinner/snack from the food log
    unscored_hint: Optional[str] = None


class ScoreHistoryEntry(BaseModel):
    date: str
    total_score: float
    display_score: float = 0
    tier: str
    display_tier: str = ""


# ──────────────────── Streak ────────────────────

class MetabolicStreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    threshold: float


# ──────────────────── Preview ───────────────────

class MESPreviewRequest(BaseModel):
    protein_g: float = 0
    fiber_g: float = 0
    carbs_g: float = 0
    sugar_g: float = 0
    fat_g: float = 0
    calories: float = 0


class MESPreviewResponse(BaseModel):
    meal_score: MESScoreResponse
    projected_daily: Optional[MESScoreResponse] = None


# ──────────────────── Remaining budget ──────────

class RemainingBudgetResponse(BaseModel):
    protein_remaining_g: float
    fiber_remaining_g: float
    sugar_remaining_g: float = 0  # Alias for sugar_headroom_g for frontend clarity
    sugar_headroom_g: float
    carb_headroom_g: float = 0
    fat_remaining_g: float = 0


# ──────────────────── Composite MES ─────────────

class CompositeMESRequest(BaseModel):
    """Request to compute combined MES for multiple food logs."""
    food_log_ids: List[str]


class CompositeMESResponse(BaseModel):
    """Combined MES score for a group of food logs (composite meal)."""
    score: MESScoreResponse
    component_count: int
    total_calories: float = 0
    total_protein_g: float = 0
    total_carbs_g: float = 0
    total_fat_g: float = 0
    total_fiber_g: float = 0
    macro_only_combined_score: Optional[float] = None
    pairing_adjusted_score: Optional[float] = None
    pairing_gis_bonus: Optional[float] = None
    pairing_synergy_bonus: Optional[float] = None
    pairing_reasons: Optional[List[str]] = None
    pairing_applied: Optional[bool] = None


# ──────────────────── Meal suggestions ──────────

class MealSuggestionResponse(BaseModel):
    recipe_id: str
    title: str
    description: Optional[str] = None
    meal_score: float
    meal_tier: str
    projected_daily_score: float
    projected_daily_tier: str
    protein_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    calories: float = 0
    cuisine: Optional[str] = None
    total_time_min: int = 0


# ──────────────────── MEA (Metabolic Energy Adequacy) ─────

class MEAScoreResponse(BaseModel):
    mea_score: float = 0
    caloric_adequacy: float = 0
    macro_balance: float = 0
    daily_mes: float = 0
    energy_prediction: str = "adequate"
    tier: str = "moderate"


# ──────────────────── Coach Insights ──────────────────────

class CoachInsightAction(BaseModel):
    type: str  # "chat" | "browse" | "scan"
    query: Optional[str] = None

class CoachInsight(BaseModel):
    icon: str
    title: str
    body: str
    accent: str
    priority: int = 0
    action: Optional[CoachInsightAction] = None

class CoachInsightsResponse(BaseModel):
    insights: List[CoachInsight]
    suggested_foods: Optional[List[Dict[str, Any]]] = None
