"""
Metabolic Engine – core MES scoring, target derivation, and budget helpers.

All scoring logic is isolated here, away from the router layer.

Sub-scores (4):
  GIS  — Glycemic Impact Score   (35%)
  PAS  — Protein Adequacy Score  (30%)
  FS   — Fiber Score             (20%)
  FAS  — Fat Adequacy Score      (15%)

Units:
  User-facing biometrics: U.S. (lbs, ft/in)
  Macros: grams everywhere
  Engine internals: converts to metric for BMR/TDEE (Mifflin-St Jeor)
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.metabolic import MetabolicBudget, MetabolicScore, MetabolicStreak
from app.models.metabolic_profile import MetabolicProfile
from app.models.nutrition import FoodLog
from app.models.recipe import Recipe

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════
#  ENUMS & DATACLASSES
# ═══════════════════════════════════════════════════════════════════════


class Goal(str, Enum):
    FAT_LOSS = "fat_loss"
    MUSCLE_GAIN = "muscle_gain"
    MAINTENANCE = "maintenance"
    METABOLIC_RESET = "metabolic_reset"


class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    MODERATE = "moderate"
    ACTIVE = "active"
    ATHLETIC = "athletic"


@dataclass
class MetabolicProfileInput:
    """Engine-internal profile (distinct from ORM MetabolicProfile)."""

    weight_lb: float
    height_ft: int
    height_in: float
    age: int
    sex: str  # "male" | "female"
    activity_level: ActivityLevel = ActivityLevel.MODERATE
    goal: Goal = Goal.MAINTENANCE
    body_fat_pct: Optional[float] = None
    body_fat_method: Optional[str] = None
    insulin_resistant: bool = False
    prediabetes: bool = False
    type_2_diabetes: bool = False
    fasting_glucose_mgdl: Optional[float] = None
    hba1c_pct: Optional[float] = None
    triglycerides_mgdl: Optional[float] = None

    @property
    def weight_kg(self) -> float:
        return round(self.weight_lb * 0.4536, 2)

    @property
    def height_cm(self) -> float:
        return round((self.height_ft * 12 + self.height_in) * 2.54, 1)


@dataclass
class ScoreWeights:
    gis: float
    protein: float
    fiber: float
    fat: float

    def normalized(self) -> "ScoreWeights":
        """Ensure weights always sum to exactly 1.0."""
        total = self.gis + self.protein + self.fiber + self.fat
        if total == 0:
            return ScoreWeights(gis=0.35, protein=0.30, fiber=0.20, fat=0.15)
        return ScoreWeights(
            gis=self.gis / total,
            protein=self.protein / total,
            fiber=self.fiber / total,
            fat=self.fat / total,
        )


@dataclass
class ComputedBudget:
    """Engine-internal budget (distinct from ORM MetabolicBudget)."""

    tdee: float
    calorie_target_kcal: float
    protein_g: float
    carb_ceiling_g: float
    fiber_g: float
    fat_g: float
    weights: ScoreWeights
    ism: float
    tier_thresholds: dict = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════════════

MEALS_PER_DAY = 3

# ── Base weights (before ISM adjustment) ──
BASE_WEIGHT_GIS = 0.35
BASE_WEIGHT_PROTEIN = 0.30
BASE_WEIGHT_FIBER = 0.20
BASE_WEIGHT_FAT = 0.15

# ── Carb ceiling defaults (g/day) ──
CARB_CEILING_DEFAULT_G = 130
CARB_CEILING_IR_G = 90
CARB_CEILING_ATHLETIC_G = 175

# ── Protein targets (g per lb per day — U.S. units) ──
PROTEIN_RATIO_MAINTENANCE = 0.73   # ~1.6 g/kg
PROTEIN_RATIO_FAT_LOSS = 0.82     # ~1.8 g/kg
PROTEIN_RATIO_MUSCLE_GAIN = 1.00  # ~2.2 g/kg
PROTEIN_RATIO_METABOLIC = 0.82    # ~1.8 g/kg

# ── Fiber target ──
FIBER_TARGET_G_PER_LB = 0.18  # ~30g for 165 lb person
FIBER_FLOOR_MINIMUM_G = 25.0

# ── Fat target model ──
FAT_RATIO_FAT_LOSS = 0.40
FAT_RATIO_MAINTENANCE = 0.50
FAT_RATIO_MUSCLE_GAIN = 0.55
FAT_RATIO_METABOLIC = 0.52
FAT_RATIO_ACTIVE_BONUS = 0.03
FAT_RATIO_ATHLETIC_BONUS = 0.06
FAT_RATIO_AGE_BONUS = 0.03
FAT_RATIO_INSULIN_BONUS = 0.04
FAT_RATIO_MIN = 0.35
FAT_RATIO_MAX = 0.65
FAT_SHARE_FAT_LOSS = 0.26
FAT_SHARE_MAINTENANCE = 0.30
FAT_SHARE_MUSCLE_GAIN = 0.33
FAT_SHARE_METABOLIC = 0.32
FAT_SHARE_ACTIVE_BONUS = 0.01
FAT_SHARE_ATHLETIC_BONUS = 0.02
FAT_SHARE_AGE_BONUS = 0.01
FAT_SHARE_INSULIN_BONUS = 0.02
FAT_SHARE_MIN = 0.25
FAT_SHARE_MAX = 0.38

# ── Tier thresholds (base) ──
TIER_OPTIMAL = 85
TIER_GOOD = 70
TIER_MODERATE = 55
TIER_LOW = 40

BASE_TIER_THRESHOLDS: dict[str, int] = {
    "optimal": TIER_OPTIMAL,
    "good": TIER_GOOD,
    "moderate": TIER_MODERATE,
    "low": TIER_LOW,
}

# ── Import gate ──
MIN_IMPORT_MES = 75.0

# ── Default profile (U.S. units) ──
DEFAULT_PROFILE = MetabolicProfileInput(
    weight_lb=165,
    height_ft=5,
    height_in=7,
    age=30,
    sex="male",
    activity_level=ActivityLevel.MODERATE,
    goal=Goal.MAINTENANCE,
)

# Legacy compat: old dict format still referenced indirectly
DEFAULT_BUDGET_DICT: dict[str, float] = {
    "protein_target_g": 130.0,
    "fiber_floor_g": 30.0,
    "sugar_ceiling_g": 130.0,  # was 200 — now 130
    "weight_protein": 0.30,
    "weight_fiber": 0.20,
    "weight_sugar": 0.35,
}

PAIRING_GIS_CAP = 8.0
PAIRING_SYNERGY_CAP = 1.5
DAILY_PAIRING_BONUS_CAP = 8.0

PAIRING_FIBER_GIS = {"none": 0.0, "low": 1.0, "med": 2.0, "high": 3.0}
PAIRING_FIBER_BONUS = {"none": 0.0, "low": 0.0, "med": 0.5, "high": 1.0}
PAIRING_VEG_GIS = {"none": 0.0, "low": 0.0, "med": 1.0, "high": 2.0}
PAIRING_VEG_BONUS = {"none": 0.0, "low": 0.0, "med": 0.5, "high": 0.75}


# ═══════════════════════════════════════════════════════════════════════
#  TIER HELPERS
# ═══════════════════════════════════════════════════════════════════════

def score_to_tier(score: float, thresholds: dict[str, int] | None = None) -> str:
    """Map a 0-100 MES to a tier label.

    Accepts optional dynamic thresholds; falls back to BASE_TIER_THRESHOLDS.
    """
    t = thresholds or BASE_TIER_THRESHOLDS
    if score >= t["optimal"]:
        return "optimal"
    if score >= t["good"]:
        return "good"
    if score >= t["moderate"]:
        return "moderate"
    if score >= t["low"]:
        return "low"
    return "critical"


TIER_LABELS = {
    "critical": "Critical",
    "low": "Low Energy",
    "moderate": "Moderate",
    "good": "Good",
    "optimal": "Optimal",
    # Legacy aliases
    "crash_risk": "Low Energy",
    "shaky": "Moderate",
    "stable": "Good",
}

TIER_COLORS = {
    "critical": "#DC2626",
    "low": "#FF4444",
    "moderate": "#FF9500",
    "good": "#4A90D9",
    "optimal": "#34C759",
    # Legacy aliases
    "crash_risk": "#FF4444",
    "shaky": "#FF9500",
    "stable": "#4A90D9",
}

TIER_META = {
    "optimal": {
        "label": "Optimal",
        "emoji": "🟢",
        "energy": "Sustained, stable energy all day",
    },
    "good": {
        "label": "Good",
        "emoji": "🟡",
        "energy": "Good energy, minor dips possible",
    },
    "moderate": {
        "label": "Moderate",
        "emoji": "🟠",
        "energy": "Moderate energy, afternoon slump likely",
    },
    "low": {
        "label": "Low",
        "emoji": "🔴",
        "energy": "Low energy, crashes likely",
    },
    "critical": {
        "label": "Critical",
        "emoji": "⛔",
        "energy": "Significant fatigue / metabolic stress",
    },
}


# ── Display-score helpers (identity — no +10 inflation) ────────────

def to_display_score(raw_score: float) -> float:
    """Convert raw MES to display score. Identity — no inflation."""
    return round(raw_score, 1)


def display_tier(raw_score: float) -> str:
    """Tier label from a display score (same as raw now)."""
    return score_to_tier(raw_score)


# ═══════════════════════════════════════════════════════════════════════
#  SUB-SCORE FUNCTIONS (each returns 0–100)
# ═══════════════════════════════════════════════════════════════════════

def calc_gis(net_carbs_g: float) -> float:
    """Glycemic Impact Score — linear degradation based on net carbs.

    Replaces old sugar_score cliff formula.
    Net carbs = total carbs - fiber.
    """
    if net_carbs_g <= 10:
        return 100.0
    if net_carbs_g <= 20:
        return 100.0 - ((net_carbs_g - 10) / 10) * 20
    if net_carbs_g <= 35:
        return 80.0 - ((net_carbs_g - 20) / 15) * 25
    if net_carbs_g <= 55:
        return 55.0 - ((net_carbs_g - 35) / 20) * 30
    if net_carbs_g <= 80:
        return 25.0 - ((net_carbs_g - 55) / 25) * 20
    return max(0.0, 5.0 - ((net_carbs_g - 80) / 20) * 5)


def calc_pas(protein_g: float, target_g: float) -> float:
    """Protein Adequacy Score — smooth bracket curve."""
    if target_g <= 0:
        return 0.0
    ratio = protein_g / target_g
    if ratio >= 1.0:
        return 100.0
    if ratio >= 0.75:
        return 70.0 + ((ratio - 0.75) / 0.25) * 30
    if ratio >= 0.5:
        return 40.0 + ((ratio - 0.5) / 0.25) * 30
    if ratio >= 0.25:
        return 10.0 + ((ratio - 0.25) / 0.25) * 30
    return max(0.0, ratio / 0.25 * 10)


def calc_fs(fiber_g: float) -> float:
    """Fiber Score — diminishing returns above 15g per meal."""
    if fiber_g <= 0:
        return 0.0
    if fiber_g <= 2:
        return (fiber_g / 2) * 20
    if fiber_g <= 6:
        return 20.0 + ((fiber_g - 2) / 4) * 45
    if fiber_g <= 10:
        return 65.0 + ((fiber_g - 6) / 4) * 25
    if fiber_g <= 15:
        return 90.0 + ((fiber_g - 10) / 5) * 10
    return 100.0


def calc_fas(fat_g: float) -> float:
    """Fat Adequacy Score — inverted-U: penalizes both <5g and >60g.

    Sweet spot: 15-40g per meal.
    """
    if fat_g < 0:
        return 0.0
    if fat_g < 5:
        return (fat_g / 5) * 30
    if fat_g <= 15:
        return 30.0 + ((fat_g - 5) / 10) * 50
    if fat_g <= 40:
        return 80.0 + ((fat_g - 15) / 25) * 20
    if fat_g <= 60:
        return 100.0 - ((fat_g - 40) / 20) * 15
    return max(50.0, 85.0 - ((fat_g - 60) / 20) * 35)


# ═══════════════════════════════════════════════════════════════════════
#  BUDGET BUILDER HELPERS
# ═══════════════════════════════════════════════════════════════════════

def calc_tdee(profile: MetabolicProfileInput) -> float:
    """Mifflin-St Jeor BMR x activity multiplier.

    Converts lbs->kg, ft/in->cm internally.
    """
    w_kg = profile.weight_kg
    h_cm = profile.height_cm

    if profile.sex == "male":
        bmr = 10 * w_kg + 6.25 * h_cm - 5 * profile.age + 5
    else:
        bmr = 10 * w_kg + 6.25 * h_cm - 5 * profile.age - 161

    multipliers = {
        ActivityLevel.SEDENTARY: 1.2,
        ActivityLevel.MODERATE: 1.55,
        ActivityLevel.ACTIVE: 1.725,
        ActivityLevel.ATHLETIC: 1.9,
    }
    return round(bmr * multipliers.get(profile.activity_level, 1.55), 1)


def calc_protein_target_g(profile: MetabolicProfileInput) -> float:
    """Daily protein target in grams (g per lb x weight_lb)."""
    ratios = {
        Goal.FAT_LOSS: PROTEIN_RATIO_FAT_LOSS,
        Goal.MUSCLE_GAIN: PROTEIN_RATIO_MUSCLE_GAIN,
        Goal.MAINTENANCE: PROTEIN_RATIO_MAINTENANCE,
        Goal.METABOLIC_RESET: PROTEIN_RATIO_METABOLIC,
    }
    base_ratio = ratios.get(profile.goal, PROTEIN_RATIO_MAINTENANCE)

    # Older users have anabolic resistance — increase protein
    age_bonus = 0.07 if profile.age >= 50 else (0.02 if profile.age >= 40 else 0)

    target = profile.weight_lb * (base_ratio + age_bonus)
    floor_ratio = 1.2 if profile.goal == Goal.MUSCLE_GAIN else 1.0
    floor = profile.weight_lb * floor_ratio
    return round(max(target, floor), 1)


def calc_carb_ceiling_g(profile: MetabolicProfileInput) -> float:
    """Daily net carb ceiling in grams."""
    if profile.type_2_diabetes or profile.insulin_resistant:
        base = CARB_CEILING_IR_G
    elif profile.activity_level == ActivityLevel.ATHLETIC:
        base = CARB_CEILING_ATHLETIC_G
    elif profile.activity_level == ActivityLevel.ACTIVE:
        base = CARB_CEILING_DEFAULT_G + 25
    else:
        base = CARB_CEILING_DEFAULT_G

    if profile.prediabetes:
        base = min(base, 110)

    if profile.triglycerides_mgdl and profile.triglycerides_mgdl > 150:
        base = round(base * 0.80)

    if profile.goal == Goal.FAT_LOSS:
        base = round(base * 0.85)

    return float(base)


def calc_fat_target_g(
    tdee: float,
    carb_g: float,
    protein_g: float,
    profile: MetabolicProfileInput | None = None,
) -> float:
    """Return a practical daily fat target.

    The old "fill all remaining calories" model inflated fat targets for lower-carb
    profiles. This keeps fat moderate and body-size aware instead.
    """
    if profile is None:
        weight_lb = max(120.0, protein_g)
        target_ratio = FAT_RATIO_MAINTENANCE
        target_share = FAT_SHARE_MAINTENANCE
    else:
        weight_lb = max(0.0, profile.weight_lb)
        goal_ratio_map = {
            Goal.FAT_LOSS: FAT_RATIO_FAT_LOSS,
            Goal.MAINTENANCE: FAT_RATIO_MAINTENANCE,
            Goal.MUSCLE_GAIN: FAT_RATIO_MUSCLE_GAIN,
            Goal.METABOLIC_RESET: FAT_RATIO_METABOLIC,
        }
        goal_share_map = {
            Goal.FAT_LOSS: FAT_SHARE_FAT_LOSS,
            Goal.MAINTENANCE: FAT_SHARE_MAINTENANCE,
            Goal.MUSCLE_GAIN: FAT_SHARE_MUSCLE_GAIN,
            Goal.METABOLIC_RESET: FAT_SHARE_METABOLIC,
        }
        target_ratio = goal_ratio_map.get(profile.goal, FAT_RATIO_MAINTENANCE)
        target_share = goal_share_map.get(profile.goal, FAT_SHARE_MAINTENANCE)
        if profile.activity_level == ActivityLevel.ACTIVE:
            target_ratio += FAT_RATIO_ACTIVE_BONUS
            target_share += FAT_SHARE_ACTIVE_BONUS
        elif profile.activity_level == ActivityLevel.ATHLETIC:
            target_ratio += FAT_RATIO_ATHLETIC_BONUS
            target_share += FAT_SHARE_ATHLETIC_BONUS
        if profile.age >= 50:
            target_ratio += FAT_RATIO_AGE_BONUS
            target_share += FAT_SHARE_AGE_BONUS
        if profile.insulin_resistant or profile.prediabetes or profile.type_2_diabetes:
            target_ratio += FAT_RATIO_INSULIN_BONUS
            target_share += FAT_SHARE_INSULIN_BONUS

    target_ratio = max(FAT_RATIO_MIN, min(FAT_RATIO_MAX, target_ratio))
    target_share = max(FAT_SHARE_MIN, min(FAT_SHARE_MAX, target_share))
    weight_based_fat_g = weight_lb * target_ratio
    calorie_capped_fat_g = (tdee * target_share) / 9 if tdee > 0 else weight_based_fat_g
    remaining_calorie_fat_g = max(25.0, (tdee - (protein_g * 4) - (carb_g * 4)) / 9) if tdee > 0 else weight_based_fat_g
    fat_g = min(weight_based_fat_g, calorie_capped_fat_g, remaining_calorie_fat_g)
    return round(max(25.0, fat_g), 1)


def calc_macro_calorie_target_kcal(protein_g: float, carb_g: float, fat_g: float) -> float:
    """Calorie target implied by the macro targets."""
    return round((protein_g * 4) + (carb_g * 4) + (fat_g * 9), 1)


def calc_ism(profile: MetabolicProfileInput) -> float:
    """Insulin Sensitivity Modifier for GIS weight adjustment."""
    if profile.type_2_diabetes:
        return 1.35
    if profile.insulin_resistant:
        return 1.25
    if profile.prediabetes:
        return 1.15

    if profile.body_fat_pct is None:
        return 1.0

    lean_threshold = 18.0 if profile.sex == "male" else 25.0
    overfat_threshold = 25.0 if profile.sex == "male" else 33.0

    if profile.body_fat_pct <= lean_threshold:
        return 0.85
    if profile.body_fat_pct <= overfat_threshold:
        return 1.0
    return 1.20


def calc_tier_thresholds(profile: MetabolicProfileInput) -> dict[str, int]:
    """Personalized tier thresholds based on metabolic fitness.

    Positive shift = stricter. Negative = more lenient.
    """
    base = dict(BASE_TIER_THRESHOLDS)

    if profile.type_2_diabetes:
        shift = 10
    elif profile.insulin_resistant:
        shift = 8
    elif profile.prediabetes:
        shift = 5
    elif (
        profile.body_fat_pct is not None
        and (
            (profile.sex == "male" and profile.body_fat_pct > 25)
            or (profile.sex == "female" and profile.body_fat_pct > 33)
        )
    ):
        shift = 4
    elif (
        profile.activity_level == ActivityLevel.ATHLETIC
        and profile.body_fat_pct is not None
        and (
            (profile.sex == "male" and profile.body_fat_pct < 15)
            or (profile.sex == "female" and profile.body_fat_pct < 22)
        )
    ):
        shift = -8
    elif profile.activity_level == ActivityLevel.ACTIVE:
        shift = -4
    elif profile.activity_level == ActivityLevel.SEDENTARY:
        shift = 2
    else:
        shift = 0

    return {
        "optimal": min(95, max(75, base["optimal"] + shift)),
        "good": min(82, max(60, base["good"] + shift)),
        "moderate": min(68, max(45, base["moderate"] + shift)),
        "low": min(52, max(30, base["low"] + shift)),
    }


def build_metabolic_budget(profile: MetabolicProfileInput) -> ComputedBudget:
    """Derive all scoring targets and weights from a profile.

    Replaces all hardcoded default values with profile-aware computation.
    """
    tdee = calc_tdee(profile)
    protein_g = calc_protein_target_g(profile)
    carb_g = calc_carb_ceiling_g(profile)
    fiber_g = max(FIBER_FLOOR_MINIMUM_G, profile.weight_lb * FIBER_TARGET_G_PER_LB)
    fat_g = calc_fat_target_g(tdee, carb_g, protein_g, profile)
    calorie_target_kcal = calc_macro_calorie_target_kcal(protein_g, carb_g, fat_g)
    if tdee > 0:
        calorie_target_kcal = min(calorie_target_kcal, round(tdee, 1))
    ism = calc_ism(profile)

    # Adjust GIS weight via ISM, cap at 0.50
    gis_weight = min(0.50, BASE_WEIGHT_GIS * ism)
    protein_weight = BASE_WEIGHT_PROTEIN + (0.05 if profile.goal == Goal.MUSCLE_GAIN else 0)
    fiber_weight = BASE_WEIGHT_FIBER
    fat_weight = BASE_WEIGHT_FAT

    weights = ScoreWeights(
        gis=gis_weight,
        protein=protein_weight,
        fiber=fiber_weight,
        fat=fat_weight,
    ).normalized()

    tier_thresholds = calc_tier_thresholds(profile)

    return ComputedBudget(
        tdee=tdee,
        calorie_target_kcal=calorie_target_kcal,
        protein_g=protein_g,
        carb_ceiling_g=carb_g,
        fiber_g=fiber_g,
        fat_g=fat_g,
        weights=weights,
        ism=ism,
        tier_thresholds=tier_thresholds,
    )


# Pre-built default budget for users without a profile
DEFAULT_COMPUTED_BUDGET = build_metabolic_budget(DEFAULT_PROFILE)


def _normalize_budget(
    budget: MetabolicBudget | ComputedBudget | dict[str, float] | None,
) -> ComputedBudget:
    """Convert any budget input to a ComputedBudget.

    Handles: ComputedBudget (pass-through), ORM MetabolicBudget, plain dict, None.
    """
    if budget is None:
        return DEFAULT_COMPUTED_BUDGET
    if isinstance(budget, ComputedBudget):
        return budget

    def _g(key: str, default: float = 0) -> float:
        if isinstance(budget, dict):
            return float(budget.get(key, default))
        return float(getattr(budget, key, default))

    protein_g = _g("protein_target_g", 130.0)
    carb_ceiling_g = _g("sugar_ceiling_g", CARB_CEILING_DEFAULT_G)
    fiber_g = _g("fiber_floor_g", FIBER_FLOOR_MINIMUM_G)

    # Read stored computed fields (populated by sync_budget_from_profile)
    tdee = _g("tdee", 0)
    calorie_target_kcal = _g("calorie_target_kcal", 0)
    fat_g = _g("fat_target_g", 0)
    stored_ism = _g("ism", 0)

    # Derive missing values for pre-migration rows
    if tdee <= 0:
        tdee = 2000.0
    if fat_g <= 0:
        fat_g = calc_fat_target_g(tdee, carb_ceiling_g, protein_g)
    if calorie_target_kcal <= 0:
        calorie_target_kcal = calc_macro_calorie_target_kcal(protein_g, carb_ceiling_g, fat_g)
    if tdee > 0:
        calorie_target_kcal = min(calorie_target_kcal, round(tdee, 1))

    # Use stored ISM if available, otherwise default to 1.0
    ism = stored_ism if stored_ism > 0 else 1.0

    # Use stored weights (which include ISM adjustments) if they look personalized
    stored_gis_w = _g("weight_sugar", 0)
    stored_protein_w = _g("weight_protein", 0)
    stored_fiber_w = _g("weight_fiber", 0)
    stored_fat_w = _g("weight_fat", 0)
    if stored_gis_w > 0 and stored_protein_w > 0 and stored_fiber_w > 0 and stored_fat_w > 0:
        weights = ScoreWeights(
            gis=stored_gis_w,
            protein=stored_protein_w,
            fiber=stored_fiber_w,
            fat=stored_fat_w,
        ).normalized()
    else:
        weights = ScoreWeights(
            gis=BASE_WEIGHT_GIS,
            protein=BASE_WEIGHT_PROTEIN,
            fiber=BASE_WEIGHT_FIBER,
            fat=BASE_WEIGHT_FAT,
        ).normalized()

    # Use stored tier thresholds if available
    stored_tiers = None
    if isinstance(budget, dict):
        stored_tiers = budget.get("tier_thresholds_json")
    else:
        stored_tiers = getattr(budget, "tier_thresholds_json", None)
    tier_thresholds = stored_tiers if stored_tiers else dict(BASE_TIER_THRESHOLDS)

    return ComputedBudget(
        tdee=tdee,
        calorie_target_kcal=calorie_target_kcal,
        protein_g=protein_g,
        carb_ceiling_g=carb_ceiling_g,
        fiber_g=fiber_g,
        fat_g=fat_g,
        weights=weights,
        ism=ism,
        tier_thresholds=tier_thresholds,
    )


# ═══════════════════════════════════════════════════════════════════════
#  MEAL CONTEXT CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════

_COMPONENT_PROTEIN_KW = {"chicken", "salmon", "tuna", "steak", "tofu", "eggs", "turkey", "beef", "shrimp", "tempeh", "skewers"}
_COMPONENT_CARB_KW = {"rice", "quinoa", "potato", "sweet potato", "pasta", "bread", "oats", "couscous", "noodles"}
_COMPONENT_VEG_KW = {"salad", "broccoli", "spinach", "kale", "asparagus", "green beans", "roasted vegetables"}
_SAUCE_KW = {"sauce", "dressing", "salsa", "pesto", "marinade", "gravy", "condiment", "hummus", "guacamole"}
_DESSERT_KW = {"dessert", "cake", "cookie", "brownie", "ice cream", "pudding", "pie", "chocolate", "pastry", "pastries", "muffin", "donut", "cupcake", "cheesecake", "tiramisu", "scone", "scones", "baklava", "beignet", "loaf", "fudge", "truffle"}
_FULL_MEAL_HINT_KW = {
    "ziti", "lasagna", "curry", "stir fry", "stir-fry", "bowl", "sandwich", "burger",
    "taco", "burrito", "pizza", "casserole", "chili", "soup", "omelet", "omelette", "wrap",
    "plate", "platter",
}

MEAL_CONTEXT_FULL = "full_meal"
MEAL_CONTEXT_COMPONENT_PROTEIN = "meal_component_protein"
MEAL_CONTEXT_COMPONENT_CARB = "meal_component_carb"
MEAL_CONTEXT_COMPONENT_VEG = "meal_component_veg"
MEAL_CONTEXT_SAUCE = "sauce_condiment"
MEAL_CONTEXT_DESSERT = "dessert"


def classify_meal_context(title: str | None, meal_type: str | None, nutrition: dict[str, Any] | None = None) -> str:
    """Classify a food log entry's context for scoring purposes."""
    if meal_type and meal_type.lower() == "dessert":
        return MEAL_CONTEXT_DESSERT

    lower_title = (title or "").lower().strip()
    if not lower_title:
        return MEAL_CONTEXT_FULL

    for kw in _DESSERT_KW:
        if kw in lower_title:
            return MEAL_CONTEXT_DESSERT

    for kw in _SAUCE_KW:
        if kw in lower_title:
            return MEAL_CONTEXT_SAUCE

    cals = float((nutrition or {}).get("calories", 0) or 0)
    protein_g = float((nutrition or {}).get("protein", 0) or (nutrition or {}).get("protein_g", 0) or 0)
    fiber_g = float((nutrition or {}).get("fiber", 0) or (nutrition or {}).get("fiber_g", 0) or 0)
    word_count = len([w for w in lower_title.split() if w])

    if any(kw in lower_title for kw in _FULL_MEAL_HINT_KW):
        return MEAL_CONTEXT_FULL

    has_protein_kw = any(kw in lower_title for kw in _COMPONENT_PROTEIN_KW)
    has_carb_kw = any(kw in lower_title for kw in _COMPONENT_CARB_KW)
    has_veg_kw = any(kw in lower_title for kw in _COMPONENT_VEG_KW)
    component_hits = int(has_protein_kw) + int(has_carb_kw) + int(has_veg_kw)

    if component_hits >= 2:
        return MEAL_CONTEXT_FULL

    if word_count >= 5 and (" with " in lower_title or " and " in lower_title):
        return MEAL_CONTEXT_FULL

    likely_component = (
        component_hits == 1
        and (
            word_count <= 3
            or cals <= 300
            or (protein_g <= 15 and fiber_g <= 6)
        )
    )

    if not likely_component:
        return MEAL_CONTEXT_FULL

    if has_protein_kw:
        return MEAL_CONTEXT_COMPONENT_PROTEIN
    if has_carb_kw:
        return MEAL_CONTEXT_COMPONENT_CARB
    if has_veg_kw:
        return MEAL_CONTEXT_COMPONENT_VEG

    return MEAL_CONTEXT_FULL


def should_score_meal(context: str) -> bool:
    """Whether a meal context should receive a per-meal MES score."""
    return context in (MEAL_CONTEXT_FULL,)


def includes_in_daily_mes(context: str) -> bool:
    """Whether a meal context contributes macros to daily MES.

    Desserts contribute to daily totals. Sauces/condiments are excluded.
    """
    return context != MEAL_CONTEXT_SAUCE


# ═══════════════════════════════════════════════════════════════════════
#  SCORING — MEAL MES
# ═══════════════════════════════════════════════════════════════════════

def _extract_nutrition(nutrition: dict[str, Any]) -> tuple[float, float, float, float]:
    """Extract (protein_g, fiber_g, carbs_g, fat_g) with legacy fallbacks."""
    protein_g = float(nutrition.get("protein_g", 0) or nutrition.get("protein", 0) or 0)
    fiber_g = float(nutrition.get("fiber_g", 0) or nutrition.get("fiber", 0) or 0)
    carbs_g = float(
        nutrition.get("carbs_g", 0)
        or nutrition.get("carbs", 0)
        or nutrition.get("sugar_g", 0)
        or nutrition.get("sugar", 0)
        or 0
    )
    fat_g = float(nutrition.get("fat_g", 0) or nutrition.get("fat", 0) or 0)
    return protein_g, fiber_g, carbs_g, fat_g


def _combine_nutrition(a: dict[str, Any] | None, b: dict[str, Any] | None) -> dict[str, float]:
    combined: dict[str, float] = {}
    for key in (
        "protein",
        "protein_g",
        "fiber",
        "fiber_g",
        "carbs",
        "carbs_g",
        "sugar",
        "sugar_g",
        "calories",
        "fat",
        "fat_g",
    ):
        combined[key] = float((a or {}).get(key, 0) or 0) + float((b or {}).get(key, 0) or 0)
    return combined


def _sanitize_pairing_profile(profile: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(profile, dict):
        return None
    fiber_class = str(profile.get("fiber_class", "none") or "none").strip().lower()
    veg_density = str(profile.get("veg_density", "none") or "none").strip().lower()
    recommended_timing = str(profile.get("recommended_timing", "with_meal") or "with_meal").strip().lower()
    if fiber_class not in PAIRING_FIBER_GIS:
        fiber_class = "none"
    if veg_density not in PAIRING_VEG_GIS:
        veg_density = "none"
    if recommended_timing not in {"with_meal", "before_meal"}:
        recommended_timing = "with_meal"
    return {
        "fiber_class": fiber_class,
        "acid": bool(profile.get("acid", False)),
        "healthy_fat": bool(profile.get("healthy_fat", False)),
        "veg_density": veg_density,
        "recommended_timing": recommended_timing,
    }


def _pairing_profile_from_recipe(pairing_recipe: Recipe | dict[str, Any] | None) -> dict[str, Any] | None:
    if pairing_recipe is None:
        return None
    if isinstance(pairing_recipe, dict):
        profile = pairing_recipe.get("pairing_synergy_profile")
    else:
        profile = getattr(pairing_recipe, "pairing_synergy_profile", None)
    return _sanitize_pairing_profile(profile)


def _score_to_result_dict(
    *,
    raw_mes: float,
    gis: float,
    pas: float,
    fs: float,
    fas: float,
    protein_g: float,
    fiber_g: float,
    carbs_g: float,
    fat_g: float,
    weights: ScoreWeights,
    thresholds: dict[str, int] | None,
) -> dict[str, Any]:
    tier = score_to_tier(raw_mes, thresholds)
    net_carbs_g = max(0.0, carbs_g - fiber_g)
    return {
        "protein_score": round(pas, 1),
        "fiber_score": round(fs, 1),
        "sugar_score": round(gis, 1),
        "total_score": round(raw_mes, 1),
        "display_score": round(raw_mes, 1),
        "tier": tier,
        "display_tier": tier,
        "protein_g": round(protein_g, 1),
        "fiber_g": round(fiber_g, 1),
        "sugar_g": round(carbs_g, 1),
        "carbs_g": round(carbs_g, 1),
        "meal_mes": round(raw_mes, 1),
        "sub_scores": {
            "gis": round(gis, 1),
            "pas": round(pas, 1),
            "fs": round(fs, 1),
            "fas": round(fas, 1),
        },
        "weights_used": {
            "gis": round(weights.gis, 3),
            "protein": round(weights.protein, 3),
            "fiber": round(weights.fiber, 3),
            "fat": round(weights.fat, 3),
        },
        "net_carbs_g": round(net_carbs_g, 1),
        "fat_g": round(fat_g, 1),
    }


def compute_meal_mes(
    nutrition: dict[str, Any],
    budget: MetabolicBudget | ComputedBudget | dict[str, float] | None = None,
) -> dict[str, Any]:
    """Score a single meal against a metabolic budget.

    Returns dict with BOTH legacy keys (for backward compat) AND new sub_scores.
    """
    b = _normalize_budget(budget)
    protein_g, fiber_g, carbs_g, fat_g = _extract_nutrition(nutrition)

    # Per-meal targets
    protein_target = b.protein_g / MEALS_PER_DAY
    net_carbs_g = max(0.0, carbs_g - fiber_g)

    # Sub-scores
    gis = calc_gis(net_carbs_g)
    pas = calc_pas(protein_g, protein_target)
    fs = calc_fs(fiber_g)
    fas = calc_fas(fat_g)

    # Weighted composite
    w = b.weights
    raw_mes = round(w.gis * gis + w.protein * pas + w.fiber * fs + w.fat * fas, 1)

    return _score_to_result_dict(
        raw_mes=raw_mes,
        gis=gis,
        pas=pas,
        fs=fs,
        fas=fas,
        protein_g=protein_g,
        fiber_g=fiber_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        weights=w,
        thresholds=b.tier_thresholds,
    )


def compute_pairing_synergy(
    pairing_recipe: Recipe | dict[str, Any] | None,
    base_meal: dict[str, Any] | None = None,
    pairing_nutrition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    del base_meal, pairing_nutrition
    profile = _pairing_profile_from_recipe(pairing_recipe)
    if not profile:
        return {
            "pairing_applied": False,
            "profile": None,
            "gis_bonus": 0.0,
            "synergy_bonus": 0.0,
            "reasons": [],
            "recommended_timing": "with_meal",
        }

    gis_bonus = PAIRING_FIBER_GIS[profile["fiber_class"]]
    synergy_bonus = PAIRING_FIBER_BONUS[profile["fiber_class"]]
    reasons: list[str] = []

    if profile["fiber_class"] in {"med", "high"}:
        reasons.append("fiber-rich side")
    if profile["acid"]:
        gis_bonus += 1.0
        synergy_bonus += 0.5
        reasons.append("acidic element")
    if profile["healthy_fat"]:
        gis_bonus += 1.0
        synergy_bonus += 0.5
        reasons.append("healthy fat")
    gis_bonus += PAIRING_VEG_GIS[profile["veg_density"]]
    synergy_bonus += PAIRING_VEG_BONUS[profile["veg_density"]]
    if profile["veg_density"] in {"med", "high"}:
        reasons.append("vegetable-forward side")
    if profile["recommended_timing"] == "before_meal":
        gis_bonus += 1.0
        synergy_bonus += 0.25
        reasons.append("eat before meal")

    gis_bonus = min(PAIRING_GIS_CAP, round(gis_bonus, 1))
    synergy_bonus = min(PAIRING_SYNERGY_CAP, round(synergy_bonus, 2))
    pairing_applied = bool(gis_bonus > 0 or synergy_bonus > 0)
    return {
        "pairing_applied": pairing_applied,
        "profile": profile,
        "gis_bonus": gis_bonus,
        "synergy_bonus": synergy_bonus,
        "reasons": reasons,
        "recommended_timing": profile["recommended_timing"],
    }


def compute_meal_mes_with_pairing(
    base_meal: dict[str, Any],
    pairing_recipe: Recipe | dict[str, Any] | None,
    budget: MetabolicBudget | ComputedBudget | dict[str, float] | None = None,
    pairing_nutrition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    combined = _combine_nutrition(base_meal, pairing_nutrition if pairing_nutrition is not None else getattr(pairing_recipe, "nutrition_info", None) if pairing_recipe is not None and not isinstance(pairing_recipe, dict) else (pairing_recipe or {}).get("nutrition_info"))
    macro_result = compute_meal_mes(combined, budget)
    synergy = compute_pairing_synergy(pairing_recipe, base_meal=base_meal, pairing_nutrition=pairing_nutrition)
    if not synergy["pairing_applied"]:
        return {
            "score": macro_result,
            "macro_only_score": macro_result,
            "pairing_applied": False,
            "pairing_gis_bonus": 0.0,
            "pairing_synergy_bonus": 0.0,
            "pairing_reasons": [],
            "pairing_recommended_timing": "with_meal",
        }

    b = _normalize_budget(budget)
    protein_g, fiber_g, carbs_g, fat_g = _extract_nutrition(combined)
    protein_target = b.protein_g / MEALS_PER_DAY
    pas = calc_pas(protein_g, protein_target)
    fs = calc_fs(fiber_g)
    fas = calc_fas(fat_g)
    base_gis = float((macro_result.get("sub_scores") or {}).get("gis", 0) or 0)
    adjusted_gis = min(100.0, base_gis + synergy["gis_bonus"])
    raw_mes = round(
        b.weights.gis * adjusted_gis
        + b.weights.protein * pas
        + b.weights.fiber * fs
        + b.weights.fat * fas
        + synergy["synergy_bonus"],
        1,
    )
    adjusted_score = _score_to_result_dict(
        raw_mes=raw_mes,
        gis=adjusted_gis,
        pas=pas,
        fs=fs,
        fas=fas,
        protein_g=protein_g,
        fiber_g=fiber_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        weights=b.weights,
        thresholds=b.tier_thresholds,
    )
    return {
        "score": adjusted_score,
        "macro_only_score": macro_result,
        "pairing_applied": True,
        "pairing_gis_bonus": synergy["gis_bonus"],
        "pairing_synergy_bonus": synergy["synergy_bonus"],
        "pairing_reasons": synergy["reasons"],
        "pairing_recommended_timing": synergy["recommended_timing"],
        "pairing_profile": synergy["profile"],
    }


# ═══════════════════════════════════════════════════════════════════════
#  SCORING — DAILY MES
# ═══════════════════════════════════════════════════════════════════════

def _empty_daily_mes_result(b: Any) -> dict[str, Any]:
    """Return a zero-score result for days with no logged meals."""
    w = b.weights
    return {
        "protein_score": 0.0,
        "fiber_score": 0.0,
        "sugar_score": 0.0,
        "total_score": 0.0,
        "display_score": 0.0,
        "tier": "no_data",
        "display_tier": "no_data",
        "protein_g": 0.0,
        "fiber_g": 0.0,
        "sugar_g": 0.0,
        "carbs_g": 0.0,
        "treat_impact": {},
        "base_daily_mes": 0.0,
        "daily_mes": 0.0,
        "sub_scores": {"gis": 0.0, "pas": 0.0, "fs": 0.0, "fas": 0.0},
        "weights_used": {
            "gis": round(w.gis, 3),
            "protein": round(w.protein, 3),
            "fiber": round(w.fiber, 3),
            "fat": round(w.fat, 3),
        },
        "net_carbs_g": 0.0,
        "fat_g": 0.0,
    }


def compute_daily_mes(
    daily_totals: dict[str, Any],
    budget: MetabolicBudget | ComputedBudget | dict[str, float] | None = None,
) -> dict[str, Any]:
    """Score a full day's totals against the metabolic budget."""
    b = _normalize_budget(budget)

    protein_g, fiber_g, carbs_g, fat_g = _extract_nutrition(daily_totals)
    calories = float(daily_totals.get("calories", 0) or 0)

    # No meals logged yet — 0g of everything means GIS would default to 100
    # (0g net carbs ≤ 10g optimal range), producing a misleading ~31 MES.
    # Return a neutral zero state instead.
    if calories == 0 and protein_g == 0 and carbs_g == 0 and fat_g == 0:
        return _empty_daily_mes_result(b)

    # Also accept sugar_g fallback for carbs at the daily totals level
    if carbs_g == 0:
        carbs_g = float(daily_totals.get("sugar_g", 0) or 0)

    dessert_carbs_g = float(
        daily_totals.get("dessert_carbs_g", 0)
        or daily_totals.get("dessert_sugar_g", 0)
        or 0
    )
    dessert_calories = float(daily_totals.get("dessert_calories", 0) or 0)

    net_carbs_g = max(0.0, carbs_g - fiber_g)

    # Sub-scores: normalize GIS/FS/FAS to per-meal equivalents for curve consistency
    net_carbs_per_meal = net_carbs_g / MEALS_PER_DAY
    gis = calc_gis(net_carbs_per_meal)

    # PAS scored against full daily protein target
    pas = calc_pas(protein_g, b.protein_g)

    fs = calc_fs(fiber_g / MEALS_PER_DAY)
    fas = calc_fas(fat_g / MEALS_PER_DAY)

    w = b.weights
    base_total = round(w.gis * gis + w.protein * pas + w.fiber * fs + w.fat * fas, 1)

    # Treat impact
    treat_impact = _compute_treat_impact(
        protein_g=protein_g,
        fiber_g=fiber_g,
        carbs_g=carbs_g,
        dessert_carbs_g=dessert_carbs_g,
        dessert_calories=dessert_calories,
        protein_target=b.protein_g,
        fiber_floor=b.fiber_g,
        carb_ceiling=b.carb_ceiling_g,
    )
    penalty = float(treat_impact.get("mes_penalty_points", 0))
    adjusted_total = max(0.0, base_total - penalty)
    raw = round(adjusted_total, 1)

    tier = score_to_tier(raw, b.tier_thresholds)

    return {
        # ── Legacy keys ──
        "protein_score": round(pas, 1),
        "fiber_score": round(fs, 1),
        "sugar_score": round(gis, 1),
        "total_score": raw,
        "display_score": raw,
        "tier": tier,
        "display_tier": tier,
        "protein_g": round(protein_g, 1),
        "fiber_g": round(fiber_g, 1),
        "sugar_g": round(carbs_g, 1),
        "carbs_g": round(carbs_g, 1),
        "treat_impact": treat_impact,
        # ── New keys ──
        "base_daily_mes": base_total,
        "daily_mes": raw,
        "sub_scores": {
            "gis": round(gis, 1),
            "pas": round(pas, 1),
            "fs": round(fs, 1),
            "fas": round(fas, 1),
        },
        "weights_used": {
            "gis": round(w.gis, 3),
            "protein": round(w.protein, 3),
            "fiber": round(w.fiber, 3),
            "fat": round(w.fat, 3),
        },
        "net_carbs_g": round(net_carbs_g, 1),
        "fat_g": round(fat_g, 1),
    }


# ═══════════════════════════════════════════════════════════════════════
#  TREAT IMPACT
# ═══════════════════════════════════════════════════════════════════════

def _compute_treat_impact(
    *,
    protein_g: float,
    fiber_g: float,
    carbs_g: float,
    dessert_carbs_g: float,
    dessert_calories: float,
    protein_target: float,
    fiber_floor: float,
    carb_ceiling: float,
) -> dict[str, Any]:
    """Context-aware dessert/treat MES impact for a day.

    Updated weights: 0.40/0.30/0.30 (was 0.45/0.35/0.20).
    Max penalty: min(15, net * 0.40) (was min(12, net * 0.35)).
    """
    has_treat = dessert_carbs_g > 0 or dessert_calories > 0
    if not has_treat:
        return {
            "has_treats": False,
            "dessert_carbs_g": 0.0,
            "dessert_calories": 0.0,
            "protection_score": 0.0,
            "protection_buffer_g": 0.0,
            "treat_load_g": 0.0,
            "net_treat_load_g": 0.0,
            "mes_penalty_points": 0.0,
            "impact_level": "none",
        }

    protein_coverage = min(max(protein_g / max(1.0, protein_target), 0.0), 1.0)
    fiber_coverage = min(max(fiber_g / max(1.0, fiber_floor), 0.0), 1.0)
    carb_headroom_g = max(0.0, carb_ceiling - carbs_g)
    carb_headroom_coverage = min(carb_headroom_g / max(1.0, carb_ceiling), 1.0)

    # Updated protection weights (was 0.45/0.35/0.20)
    protection_score = (
        (protein_coverage * 0.40)
        + (fiber_coverage * 0.30)
        + (carb_headroom_coverage * 0.30)
    )
    protection_buffer_g = 8.0 + (28.0 * protection_score)

    calorie_over_baseline = max(0.0, dessert_calories - 120.0)
    treat_load_g = max(0.0, dessert_carbs_g) + (calorie_over_baseline * 0.05)
    net_treat_load_g = max(0.0, treat_load_g - protection_buffer_g)

    # Updated penalty: min(15, net * 0.40) — was min(12, net * 0.35)
    mes_penalty_points = min(15.0, net_treat_load_g * 0.40)
    if mes_penalty_points <= 0.2:
        impact_level = "protected"
    elif mes_penalty_points <= 2.0:
        impact_level = "light"
    else:
        impact_level = "impactful"

    return {
        "has_treats": True,
        "dessert_carbs_g": round(max(0.0, dessert_carbs_g), 1),
        "dessert_calories": round(max(0.0, dessert_calories), 1),
        "protection_score": round(protection_score, 3),
        "protection_buffer_g": round(protection_buffer_g, 1),
        "treat_load_g": round(treat_load_g, 1),
        "net_treat_load_g": round(net_treat_load_g, 1),
        "mes_penalty_points": round(mes_penalty_points, 1),
        "impact_level": impact_level,
    }


# ═══════════════════════════════════════════════════════════════════════
#  REMAINING BUDGET
# ═══════════════════════════════════════════════════════════════════════

def remaining_budget(
    daily_totals: dict[str, Any],
    budget: MetabolicBudget | ComputedBudget | dict[str, float] | None = None,
) -> dict[str, Any]:
    """What's left to eat today to stay on target."""
    b = _normalize_budget(budget)

    protein_g, fiber_g, carbs_g, fat_g = _extract_nutrition(daily_totals)
    if carbs_g == 0:
        carbs_g = float(daily_totals.get("sugar_g", 0) or 0)
    if fat_g == 0:
        fat_g = float(daily_totals.get("fat_g", 0) or 0)

    protein_remaining = max(0.0, b.protein_g - protein_g)
    fiber_remaining = max(0.0, b.fiber_g - fiber_g)
    carb_headroom = max(0.0, b.carb_ceiling_g - carbs_g)
    fat_remaining = max(0.0, b.fat_g - fat_g)

    return {
        "protein_remaining_g": round(protein_remaining, 1),
        "fiber_remaining_g": round(fiber_remaining, 1),
        "sugar_headroom_g": round(carb_headroom, 1),  # compat
        "carb_headroom_g": round(carb_headroom, 1),
        "fat_remaining_g": round(fat_remaining, 1),
    }


# ═══════════════════════════════════════════════════════════════════════
#  ONBOARDING DERIVATION (Legacy — kept for router backward compat)
# ═══════════════════════════════════════════════════════════════════════

def derive_target_weight_lb(profile: dict[str, Any]) -> float:
    """Derive target bodyweight from onboarding data."""
    explicit = profile.get("target_weight_lb")
    if explicit:
        return float(explicit)

    current_weight = profile.get("weight_lb")
    if not current_weight:
        return 162.5

    current_weight = float(current_weight)
    goal = (profile.get("goal") or "maintain").lower()

    if goal in ("lose", "fat-loss", "cut", "fat_loss"):
        return round(current_weight * 0.90, 1)
    elif goal in ("gain", "bulk", "muscle_gain"):
        return round(current_weight * 1.05, 1)
    else:
        return round(current_weight, 1)


def derive_protein_target_g(profile: dict[str, Any]) -> float:
    """Protein target mirrors the profile-aware engine with a 1 g/lb floor."""
    current_weight = float(profile.get("weight_lb") or 0)
    if current_weight <= 0:
        return round(DEFAULT_PROFILE.weight_lb, 1)
    age = int(profile.get("age") or DEFAULT_PROFILE.age)
    goal = (profile.get("goal") or "maintain").lower()
    if goal in ("lose", "fat-loss", "cut", "fat_loss"):
        ratio = PROTEIN_RATIO_FAT_LOSS
    elif goal in ("gain", "bulk", "muscle_gain"):
        ratio = PROTEIN_RATIO_MUSCLE_GAIN
    elif goal in ("metabolic_reset",):
        ratio = PROTEIN_RATIO_METABOLIC
    else:
        ratio = PROTEIN_RATIO_MAINTENANCE
    age_bonus = 0.07 if age >= 50 else (0.02 if age >= 40 else 0)
    floor_ratio = 1.2 if goal in ("gain", "bulk", "muscle_gain") else 1.0
    return round(max(current_weight * (ratio + age_bonus), current_weight * floor_ratio), 1)


def derive_sugar_ceiling(profile: dict[str, Any]) -> float:
    """Profile-aware carb ceiling mirroring calc_carb_ceiling_g() logic."""
    goal = (profile.get("goal") or "maintain").lower()
    activity = (profile.get("activity_level") or "moderate").lower()
    insulin_resistant = bool(profile.get("insulin_resistant"))
    type_2_diabetes = bool(profile.get("type_2_diabetes"))
    prediabetes = bool(profile.get("prediabetes"))
    triglycerides = profile.get("triglycerides_mgdl")

    if type_2_diabetes or insulin_resistant:
        base = float(CARB_CEILING_IR_G)
    elif activity in ("athletic", "high"):
        base = float(CARB_CEILING_ATHLETIC_G)
    elif activity == "active":
        base = float(CARB_CEILING_DEFAULT_G + 25)
    else:
        base = float(CARB_CEILING_DEFAULT_G)

    if prediabetes:
        base = min(base, 110.0)

    if triglycerides and float(triglycerides) > 150:
        base = round(base * 0.80)

    if goal in ("lose", "fat-loss", "cut", "fat_loss"):
        base = round(base * 0.85)

    return float(base)


# ═══════════════════════════════════════════════════════════════════════
#  DB HELPERS
# ═══════════════════════════════════════════════════════════════════════

def get_or_create_budget(db: Session, user_id: str) -> MetabolicBudget:
    """Return budget synced from the user's metabolic profile.

    Always re-syncs from profile so that budget stays fresh when the user
    changes their goal, activity level, or health markers.
    """
    # Check if user has a metabolic profile for full personalization
    profile = db.query(MetabolicProfile).filter(MetabolicProfile.user_id == user_id).first()
    if profile and profile.weight_lb:
        # Full sync — updates (or creates) the ORM row with all computed values
        sync_budget_from_profile(db, user_id)
        budget = db.query(MetabolicBudget).filter(MetabolicBudget.user_id == user_id).first()
        if budget:
            return budget

    # No profile — return existing row or create with defaults
    budget = db.query(MetabolicBudget).filter(MetabolicBudget.user_id == user_id).first()
    if budget:
        return budget

    budget = MetabolicBudget(user_id=user_id)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def get_or_create_streak(db: Session, user_id: str) -> MetabolicStreak:
    """Return existing streak or auto-create."""
    streak = db.query(MetabolicStreak).filter(MetabolicStreak.user_id == user_id).first()
    if streak:
        return streak
    streak = MetabolicStreak(user_id=user_id)
    db.add(streak)
    db.commit()
    db.refresh(streak)
    return streak


def load_budget_for_user(db: Session, user_id: str) -> ComputedBudget:
    """Read DB profile -> MetabolicProfileInput -> ComputedBudget.

    Falls back to DEFAULT_PROFILE if no profile exists.
    """
    orm_profile = db.query(MetabolicProfile).filter(
        MetabolicProfile.user_id == user_id,
    ).first()
    if not orm_profile or not orm_profile.weight_lb:
        return DEFAULT_COMPUTED_BUDGET

    # Map activity level string to enum
    activity_map = {
        "sedentary": ActivityLevel.SEDENTARY,
        "light": ActivityLevel.MODERATE,
        "moderate": ActivityLevel.MODERATE,
        "active": ActivityLevel.ACTIVE,
        "high": ActivityLevel.ATHLETIC,
        "athletic": ActivityLevel.ATHLETIC,
    }
    activity = activity_map.get(
        (orm_profile.activity_level or "moderate").lower(),
        ActivityLevel.MODERATE,
    )

    # Map goal string to enum
    goal_map = {
        "lose": Goal.FAT_LOSS,
        "fat-loss": Goal.FAT_LOSS,
        "fat_loss": Goal.FAT_LOSS,
        "cut": Goal.FAT_LOSS,
        "gain": Goal.MUSCLE_GAIN,
        "bulk": Goal.MUSCLE_GAIN,
        "muscle_gain": Goal.MUSCLE_GAIN,
        "maintain": Goal.MAINTENANCE,
        "maintenance": Goal.MAINTENANCE,
        "metabolic_reset": Goal.METABOLIC_RESET,
    }
    goal = goal_map.get(
        (orm_profile.goal or "maintain").lower(),
        Goal.MAINTENANCE,
    )

    # Height: prefer ft/in if available, else convert from cm
    height_ft = getattr(orm_profile, "height_ft", None)
    height_in = getattr(orm_profile, "height_in", None)
    if height_ft is not None and height_ft > 0:
        h_ft = int(height_ft)
        h_in = float(height_in or 0)
    elif orm_profile.height_cm and orm_profile.height_cm > 0:
        total_in = orm_profile.height_cm / 2.54
        h_ft = int(total_in // 12)
        h_in = round(total_in % 12, 1)
    else:
        h_ft = DEFAULT_PROFILE.height_ft
        h_in = DEFAULT_PROFILE.height_in

    age = getattr(orm_profile, "age", None) or DEFAULT_PROFILE.age

    profile_input = MetabolicProfileInput(
        weight_lb=orm_profile.weight_lb,
        height_ft=h_ft,
        height_in=h_in,
        age=int(age),
        sex=orm_profile.sex or DEFAULT_PROFILE.sex,
        activity_level=activity,
        goal=goal,
        body_fat_pct=orm_profile.body_fat_pct,
        insulin_resistant=getattr(orm_profile, "insulin_resistant", False) or False,
        prediabetes=getattr(orm_profile, "prediabetes", False) or False,
        type_2_diabetes=getattr(orm_profile, "type_2_diabetes", False) or False,
        triglycerides_mgdl=getattr(orm_profile, "triglycerides_mgdl", None),
    )

    return build_metabolic_budget(profile_input)


def sync_budget_from_profile(db: Session, user_id: str) -> ComputedBudget:
    """Recompute full budget from profile and persist to ORM MetabolicBudget.

    This is the single authoritative way to keep the DB budget in sync with
    the user's metabolic profile.  Returns the fresh ComputedBudget.
    """
    computed = load_budget_for_user(db, user_id)

    budget = db.query(MetabolicBudget).filter(MetabolicBudget.user_id == user_id).first()
    if not budget:
        budget = MetabolicBudget(user_id=user_id)
        db.add(budget)

    # Sync all guardrail targets
    budget.protein_target_g = computed.protein_g
    budget.fiber_floor_g = computed.fiber_g
    budget.sugar_ceiling_g = computed.carb_ceiling_g
    budget.fat_target_g = computed.fat_g

    # Sync computed fields
    budget.tdee = computed.tdee
    budget.calorie_target_kcal = computed.calorie_target_kcal
    budget.ism = computed.ism

    # Sync personalized weights (include ISM adjustment)
    budget.weight_sugar = computed.weights.gis
    budget.weight_protein = computed.weights.protein
    budget.weight_fiber = computed.weights.fiber
    budget.weight_fat = computed.weights.fat

    # Sync tier thresholds
    budget.tier_thresholds_json = computed.tier_thresholds

    db.commit()
    db.refresh(budget)
    return computed


def _group_logs_by_pairing_candidate(logs: list[FoodLog]) -> dict[str, list[FoodLog]]:
    grouped: dict[str, list[FoodLog]] = {}
    for log in logs:
        if not log.group_id:
            continue
        grouped.setdefault(str(log.group_id), []).append(log)
    return grouped


def compute_pairing_adjusted_daily_bonus(
    db: Session,
    user_id: str,
    day: date,
    budget: MetabolicBudget | ComputedBudget | dict[str, float] | None = None,
) -> dict[str, Any]:
    logs = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == day).all()
    group_map = _group_logs_by_pairing_candidate(logs)
    sources: list[dict[str, Any]] = []
    total_bonus = 0.0

    for group_id, group_logs in group_map.items():
        if len(group_logs) < 2:
            continue

        pairing_log: FoodLog | None = None
        pairing_recipe: Recipe | None = None
        for log in group_logs:
            if str(log.source_type or "") != "recipe" or not log.source_id:
                continue
            recipe = db.query(Recipe).filter(Recipe.id == log.source_id).first()
            if recipe and _pairing_profile_from_recipe(recipe):
                pairing_log = log
                pairing_recipe = recipe
                break

        if pairing_log is None or pairing_recipe is None:
            continue

        base_nutrition: dict[str, float] = {}
        for log in group_logs:
            if log.id == pairing_log.id:
                continue
            base_nutrition = _combine_nutrition(base_nutrition, log.nutrition_snapshot or {})
        if not base_nutrition:
            continue

        paired = compute_meal_mes_with_pairing(
            base_nutrition,
            pairing_recipe=pairing_recipe,
            budget=budget,
            pairing_nutrition=pairing_log.nutrition_snapshot or {},
        )
        if not paired["pairing_applied"]:
            continue

        macro_score = float((paired.get("macro_only_score") or {}).get("total_score", 0) or 0)
        adjusted_score = float((paired.get("score") or {}).get("total_score", 0) or 0)
        delta = round(max(0.0, adjusted_score - macro_score), 1)
        if delta <= 0:
            continue

        total_bonus += delta
        sources.append({
            "group_id": group_id,
            "pairing_recipe_id": str(pairing_recipe.id),
            "pairing_title": pairing_recipe.title,
            "pairing_gis_bonus": paired["pairing_gis_bonus"],
            "pairing_synergy_bonus": paired["pairing_synergy_bonus"],
            "pairing_reasons": paired["pairing_reasons"],
            "pairing_delta": delta,
        })

    capped = min(DAILY_PAIRING_BONUS_CAP, round(total_bonus, 1))
    if capped < total_bonus and sources:
        running = 0.0
        trimmed: list[dict[str, Any]] = []
        for source in sorted(sources, key=lambda item: float(item.get("pairing_delta", 0)), reverse=True):
            remaining = round(DAILY_PAIRING_BONUS_CAP - running, 1)
            if remaining <= 0:
                break
            delta = min(float(source.get("pairing_delta", 0) or 0), remaining)
            trimmed.append({**source, "pairing_delta": round(delta, 1)})
            running += delta
        sources = trimmed

    return {
        "pairing_synergy_daily_bonus": capped,
        "pairing_synergy_sources": sources,
    }


def aggregate_daily_totals(db: Session, user_id: str, day: date) -> dict[str, float]:
    """Sum all food logs for a user on a given date.

    Sauces/condiments are excluded from MES daily totals.
    Desserts ARE included.
    """
    logs = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == day).all()
    totals: dict[str, float] = {
        "protein_g": 0, "fiber_g": 0, "sugar_g": 0,
        "carbs_g": 0, "fat_g": 0, "calories": 0,
    }
    dessert_sugar_g: float = 0.0
    dessert_calories: float = 0.0

    for log in logs:
        snap = log.nutrition_snapshot or {}
        ctx = classify_meal_context(log.title, log.meal_type, snap)

        if not includes_in_daily_mes(ctx):
            continue

        p = float(snap.get("protein", 0) or snap.get("protein_g", 0) or 0)
        f = float(snap.get("fiber", 0) or snap.get("fiber_g", 0) or 0)
        carb = float(
            snap.get("carbs", 0) or snap.get("carbs_g", 0)
            or snap.get("sugar", 0) or snap.get("sugar_g", 0) or 0
        )
        fat = float(snap.get("fat", 0) or snap.get("fat_g", 0) or 0)
        c = float(snap.get("calories", 0) or 0)

        totals["protein_g"] += p
        totals["fiber_g"] += f
        totals["sugar_g"] += carb
        totals["carbs_g"] += carb
        totals["fat_g"] += fat
        totals["calories"] += c

        if ctx == MEAL_CONTEXT_DESSERT:
            dessert_sugar_g += carb
            dessert_calories += c

    totals["dessert_sugar_g"] = dessert_sugar_g
    totals["dessert_carbs_g"] = dessert_sugar_g
    totals["dessert_calories"] = dessert_calories
    return totals


# ═══════════════════════════════════════════════════════════════════════
#  SCORE PERSISTENCE
# ═══════════════════════════════════════════════════════════════════════

def upsert_meal_score(
    db: Session,
    user_id: str,
    food_log: FoodLog,
    budget: MetabolicBudget | ComputedBudget,
) -> MetabolicScore | None:
    """Compute and persist a per-meal MES score for a food log.

    Returns None for entries that shouldn't receive a per-meal score.
    """
    nutrition = food_log.nutrition_snapshot or {}
    ctx = classify_meal_context(food_log.title, food_log.meal_type, nutrition)

    score = (
        db.query(MetabolicScore)
        .filter(
            MetabolicScore.user_id == user_id,
            MetabolicScore.date == food_log.date,
            MetabolicScore.scope == "meal",
            MetabolicScore.food_log_id == food_log.id,
        )
        .first()
    )

    if not should_score_meal(ctx):
        if not score:
            score = MetabolicScore(
                user_id=user_id,
                date=food_log.date,
                scope="meal",
                food_log_id=food_log.id,
            )
            db.add(score)
        score.total_score = 0
        score.display_score = 0
        score.protein_score = 0
        score.fiber_score = 0
        score.sugar_score = 0
        score.tier = "unscored"
        score.display_tier = "unscored"
        score.meal_context = ctx
        score.protein_g = float(nutrition.get("protein_g", 0) or nutrition.get("protein", 0) or 0)
        score.fiber_g = float(nutrition.get("fiber_g", 0) or nutrition.get("fiber", 0) or 0)
        score.sugar_g = float(
            nutrition.get("carbs_g", 0)
            or nutrition.get("carbs", 0)
            or nutrition.get("sugar_g", 0)
            or nutrition.get("sugar", 0)
            or 0
        )
        score.details_json = {"meal_context": ctx, "unscored_reason": _unscored_hint(ctx)}
        db.commit()
        db.refresh(score)
        return None

    result = compute_meal_mes(nutrition, budget)

    if not score:
        score = MetabolicScore(
            user_id=user_id,
            date=food_log.date,
            scope="meal",
            food_log_id=food_log.id,
        )
        db.add(score)

    score.protein_score = result["protein_score"]
    score.fiber_score = result["fiber_score"]
    score.sugar_score = result["sugar_score"]
    score.total_score = result["total_score"]
    score.display_score = result["display_score"]
    score.tier = result["tier"]
    score.display_tier = result["display_tier"]
    score.protein_g = result["protein_g"]
    score.fiber_g = result["fiber_g"]
    score.sugar_g = result["sugar_g"]
    score.meal_context = ctx
    score.details_json = {
        "meal_context": ctx,
        "sub_scores": result.get("sub_scores"),
        "weights_used": result.get("weights_used"),
        "net_carbs_g": result.get("net_carbs_g"),
    }

    db.commit()
    db.refresh(score)
    return score


def _unscored_hint(ctx: str) -> str:
    """User-facing hint for why a meal isn't scored."""
    return {
        MEAL_CONTEXT_COMPONENT_PROTEIN: "Prep component — add sides to see full MES.",
        MEAL_CONTEXT_COMPONENT_CARB: "Prep component — add protein and veggies to see full MES.",
        MEAL_CONTEXT_COMPONENT_VEG: "Prep component — add protein to see full MES.",
        MEAL_CONTEXT_SAUCE: "Sauces & condiments aren't scored individually.",
        MEAL_CONTEXT_DESSERT: "Treats are tracked for sugar/calories but not scored as meals.",
    }.get(ctx, "")


def recompute_daily_score(
    db: Session,
    user_id: str,
    day: date,
    budget: MetabolicBudget | ComputedBudget | None = None,
) -> MetabolicScore:
    """(Re)compute and persist the daily MES for a given date.

    Always attempts to load a full ComputedBudget from the user's profile
    so ISM-adjusted weights and personalized tier thresholds are used.
    Falls back to _normalize_budget(budget) if no profile exists.
    """
    # Prefer profile-derived ComputedBudget for ISM weights + tier thresholds
    computed = load_budget_for_user(db, user_id)
    if computed is DEFAULT_COMPUTED_BUDGET and budget is not None:
        # No profile found — use whatever the caller passed (ORM or dict)
        computed = _normalize_budget(budget)

    totals = aggregate_daily_totals(db, user_id, day)
    result = compute_daily_mes(totals, computed)
    pairing_daily = compute_pairing_adjusted_daily_bonus(db, user_id, day, computed)
    pairing_bonus = float(pairing_daily.get("pairing_synergy_daily_bonus", 0) or 0)
    adjusted_total = min(100.0, round(float(result.get("total_score", 0) or 0) + pairing_bonus, 1))
    adjusted_tier = score_to_tier(adjusted_total, computed.tier_thresholds)

    score = (
        db.query(MetabolicScore)
        .filter(
            MetabolicScore.user_id == user_id,
            MetabolicScore.date == day,
            MetabolicScore.scope == "daily",
        )
        .first()
    )
    if not score:
        score = MetabolicScore(
            user_id=user_id,
            date=day,
            scope="daily",
            food_log_id=None,
        )
        db.add(score)

    score.protein_score = result["protein_score"]
    score.fiber_score = result["fiber_score"]
    score.sugar_score = result["sugar_score"]
    score.total_score = adjusted_total
    score.display_score = adjusted_total
    score.tier = adjusted_tier
    score.display_tier = adjusted_tier
    score.protein_g = result["protein_g"]
    score.fiber_g = result["fiber_g"]
    score.sugar_g = result["sugar_g"]
    score.meal_context = "daily"

    # Track details for UI + coaching
    dessert_sugar = totals.get("dessert_sugar_g", 0)
    sugar_ceiling = computed.carb_ceiling_g

    overage = max(0, totals.get("carbs_g", totals.get("sugar_g", 0)) - sugar_ceiling)
    score.details_json = {
        "dessert_sugar_g": round(dessert_sugar, 1),
        "sugar_overage_g": round(overage, 1) if overage > 0 else 0,
        "treat_impact": result.get("treat_impact") or {},
        "sub_scores": result.get("sub_scores"),
        "weights_used": result.get("weights_used"),
        "net_carbs_g": result.get("net_carbs_g"),
        "fat_g": result.get("fat_g"),
        "macro_only_total_score": result.get("total_score"),
        "pairing_synergy_daily_bonus": pairing_bonus,
        "pairing_synergy_sources": pairing_daily.get("pairing_synergy_sources") or [],
    }

    db.commit()
    db.refresh(score)
    return score


def update_metabolic_streak(
    db: Session,
    user_id: str,
    daily_mes: float,
    day: date,
) -> MetabolicStreak:
    """Update the metabolic streak after a daily MES recomputation."""
    streak = get_or_create_streak(db, user_id)
    yesterday = day - timedelta(days=1)

    if daily_mes >= streak.threshold:
        if streak.last_qualifying_date == yesterday or streak.current_streak == 0:
            streak.current_streak += 1
        elif streak.last_qualifying_date != day:
            streak.current_streak = 1
        streak.last_qualifying_date = day
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak
    else:
        if streak.last_qualifying_date != day:
            streak.current_streak = 0

    db.commit()
    db.refresh(streak)
    return streak


def on_food_log_created(db: Session, user_id: str, food_log: FoodLog) -> dict[str, Any]:
    """Hook called after a food log is created/updated.

    Computes meal MES, recomputes daily MES, updates streak, awards XP.
    """
    from app.achievements_engine import award_xp
    from app.models.user import User
    from app.models.gamification import XPTransaction
    from datetime import datetime

    budget = get_or_create_budget(db, user_id)

    # Prefer profile-derived ComputedBudget for ISM weights + tier thresholds
    computed = load_budget_for_user(db, user_id)

    meal_context = classify_meal_context(
        food_log.title, food_log.meal_type, food_log.nutrition_snapshot,
    )
    upsert_meal_score(db, user_id, food_log, computed)

    daily = recompute_daily_score(db, user_id, food_log.date, budget)

    # Streak uses raw score
    update_metabolic_streak(db, user_id, daily.total_score, food_log.date)

    # Award metabolic tier XP (once per day)
    tier_xp = 0
    tier_label = None
    TIER_XP_MAP = {
        "critical": 0,
        "low": 0,
        "moderate": 25,
        "good": 75,
        "optimal": 150,
        # Legacy aliases
        "crash_risk": 0,
        "shaky": 25,
        "stable": 75,
    }
    tier_xp = TIER_XP_MAP.get(daily.tier, 0)
    if tier_xp > 0:
        today_start = datetime.combine(food_log.date, datetime.min.time())
        existing = db.query(XPTransaction).filter(
            XPTransaction.user_id == user_id,
            XPTransaction.reason.like("metabolic_tier:%"),
            XPTransaction.created_at >= today_start,
        ).first()
        if not existing:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                tier_label = daily.tier
                award_xp(db, user, tier_xp, f"metabolic_tier:{tier_label}")

    # Dessert / treat feedback
    dessert_feedback = None
    details = daily.details_json or {}
    dessert_sugar = details.get("dessert_sugar_g", 0)
    sugar_overage = details.get("sugar_overage_g", 0)
    treat_impact = details.get("treat_impact") or {}
    treat_penalty = float(treat_impact.get("mes_penalty_points", 0) or 0)
    impact_level = str(treat_impact.get("impact_level", "none"))
    if dessert_sugar > 0 and sugar_overage > 0:
        dessert_feedback = (
            f"You're {int(sugar_overage)}g over carb headroom — "
            "add a high-protein/fiber dinner to stabilize."
        )
    elif treat_penalty > 0 and impact_level == "impactful":
        dessert_feedback = (
            "Treat impact is noticeable today — add protein/fiber to improve protection."
        )
    elif treat_penalty <= 0.2 and dessert_sugar > 0:
        dessert_feedback = (
            "Treat impact stayed low thanks to your protein/fiber coverage."
        )

    return {
        "daily_mes": daily.total_score,
        "daily_display_mes": daily.display_score or to_display_score(daily.total_score),
        "daily_tier": daily.tier,
        "daily_display_tier": daily.display_tier or display_tier(daily.total_score),
        "meal_context": meal_context,
        "metabolic_tier_xp": tier_xp if tier_label else 0,
        "metabolic_tier_label": tier_label,
        "dessert_feedback": dessert_feedback,
    }


# ═══════════════════════════════════════════════════════════════════════
#  IMPORT GATE
# ═══════════════════════════════════════════════════════════════════════

def passes_import_gate(nutrition_info: dict[str, Any]) -> tuple[bool, float]:
    """Check if a recipe's nutrition passes the MES import gate."""
    result = compute_meal_mes(nutrition_info, DEFAULT_COMPUTED_BUDGET)
    total = float(result["total_score"])
    return total >= MIN_IMPORT_MES, total


# ═══════════════════════════════════════════════════════════════════════
#  MEA (Metabolic Energy Adequacy)
# ═══════════════════════════════════════════════════════════════════════

def _caloric_adequacy(consumed_kcal: float, tdee: float) -> float:
    """Score 0-100 for how close consumed kcal are to TDEE.

    100 = exactly at TDEE, linearly drops for under/over-eating.
    Allows ±10% as perfect zone.
    """
    if tdee <= 0:
        return 50.0
    ratio = consumed_kcal / tdee
    if 0.90 <= ratio <= 1.10:
        return 100.0
    if ratio < 0.90:
        # Under-eating: 0 at 0%, 100 at 90%
        return max(0.0, min(100.0, (ratio / 0.90) * 100))
    # Over-eating: 100 at 110%, 0 at 160%
    return max(0.0, min(100.0, (1.60 - ratio) / 0.50 * 100))


def _macro_balance(
    protein_g: float, carbs_g: float, fat_g: float,
    protein_target_g: float, carb_ceiling_g: float, fat_target_g: float,
) -> float:
    """Score 0-100 for how well macros match targets.

    Averages individual macro adequacy scores:
    - Protein: floor (higher is better up to 120% target)
    - Carbs: ceiling (lower is better, penalty above target)
    - Fat: range (sweet spot 80-120% of target)
    """
    # Protein: 0 at 0% of target, 100 at 100%+ up to 120%, mild drop beyond
    if protein_target_g > 0:
        p_ratio = protein_g / protein_target_g
        protein_score = min(100.0, max(0.0, p_ratio * 100)) if p_ratio <= 1.2 else max(70.0, 120 - (p_ratio - 1.2) * 100)
    else:
        protein_score = 50.0

    # Carbs: 100 at ≤100% ceiling, drops linearly to 0 at 200%
    if carb_ceiling_g > 0:
        c_ratio = carbs_g / carb_ceiling_g
        carb_score = 100.0 if c_ratio <= 1.0 else max(0.0, 100 - (c_ratio - 1.0) * 100)
    else:
        carb_score = 50.0

    # Fat: 100 at 80-120% target, drops outside
    if fat_target_g > 0:
        f_ratio = fat_g / fat_target_g
        if 0.80 <= f_ratio <= 1.20:
            fat_score = 100.0
        elif f_ratio < 0.80:
            fat_score = max(0.0, (f_ratio / 0.80) * 100)
        else:
            fat_score = max(0.0, (2.0 - f_ratio) / 0.80 * 100)
    else:
        fat_score = 50.0

    return (protein_score + carb_score + fat_score) / 3.0


def compute_mea_score(
    consumed_kcal: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    daily_mes: float,
    budget: ComputedBudget,
) -> dict[str, Any]:
    """Compute the MEA (Metabolic Energy Adequacy) score.

    Weights:
    - Caloric Adequacy: 40%
    - Macro Balance: 35%
    - Daily MES: 25%

    Returns dict with mea_score, caloric_adequacy, macro_balance, energy_prediction, tier.
    """
    cal_target = getattr(budget, "calorie_target_kcal", None) or budget.tdee
    cal_score = _caloric_adequacy(consumed_kcal, cal_target)
    macro_score = _macro_balance(
        protein_g, carbs_g, fat_g,
        budget.protein_g, budget.carb_ceiling_g, budget.fat_g,
    )

    mea = cal_score * 0.40 + macro_score * 0.35 + daily_mes * 0.25
    mea = max(0.0, min(100.0, mea))

    # Energy prediction label
    if cal_score >= 85:
        energy_prediction = "sustained"
    elif cal_score >= 60:
        energy_prediction = "adequate"
    elif cal_score >= 40:
        energy_prediction = "may_dip"
    else:
        energy_prediction = "likely_fatigued"

    tier = score_to_tier(mea, budget.tier_thresholds)

    return {
        "mea_score": round(mea, 1),
        "caloric_adequacy": round(cal_score, 1),
        "macro_balance": round(macro_score, 1),
        "daily_mes": round(daily_mes, 1),
        "energy_prediction": energy_prediction,
        "tier": tier,
    }


def build_threshold_context(profile: MetabolicProfileInput) -> dict[str, Any]:
    """Build human-readable threshold context for a profile.

    Returns shift, reason text, and leniency level.
    """
    thresholds = calc_tier_thresholds(profile)
    base_optimal = BASE_TIER_THRESHOLDS["optimal"]
    shift = thresholds["optimal"] - base_optimal

    if shift == 0:
        reason = "Default thresholds — no metabolic risk adjustments."
        leniency = "standard"
    elif shift > 0:
        conditions = []
        if profile.type_2_diabetes:
            conditions.append("Type 2 diabetes")
        if profile.insulin_resistant:
            conditions.append("insulin resistance")
        if profile.prediabetes:
            conditions.append("prediabetes")
        if not conditions:
            conditions.append("elevated body fat or sedentary activity")
        reason = f"{', '.join(conditions)} detected — thresholds adjusted for your metabolic risk profile."
        leniency = "stricter"
    else:
        reason = "Athletic profile with low body fat — thresholds relaxed for metabolic fitness."
        leniency = "more_lenient"

    return {
        "shift": shift,
        "reason": reason,
        "leniency": leniency,
    }
