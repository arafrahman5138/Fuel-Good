from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import date as date_type, timedelta


class NutritionTargetsResponse(BaseModel):
    calories_target: float
    protein_g_target: float
    carbs_g_target: float
    fat_g_target: float
    fiber_g_target: float
    micronutrient_targets: Dict[str, float]


class NutritionTargetsUpdate(BaseModel):
    calories_target: Optional[float] = None
    protein_g_target: Optional[float] = None
    carbs_g_target: Optional[float] = None
    fat_g_target: Optional[float] = None
    fiber_g_target: Optional[float] = None
    micronutrient_targets: Optional[Dict[str, float]] = None


class FoodLogCreate(BaseModel):
    date: Optional[str] = None
    meal_type: str = "meal"
    source_type: str = "manual"
    source_id: Optional[str] = None
    serving_option_id: Optional[str] = None
    grams: Optional[float] = None
    group_id: Optional[str] = None
    group_mes_score: Optional[float] = None
    group_mes_tier: Optional[str] = None
    title: Optional[str] = None
    servings: float = 1.0
    quantity: float = 1.0
    nutrition: Optional[Dict[str, Any]] = None

    @field_validator("date")
    @classmethod
    def validate_date_range(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            parsed = date_type.fromisoformat(v)
        except ValueError:
            raise ValueError("Invalid date format. Use YYYY-MM-DD.")
        today = date_type.today()
        if parsed > today:
            raise ValueError("Cannot log meals for future dates.")
        if parsed < today - timedelta(days=90):
            raise ValueError("Cannot log meals more than 90 days in the past.")
        return v

    @field_validator("servings", "quantity")
    @classmethod
    def validate_positive_amounts(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Must be greater than 0.")
        return v


class FoodLogUpdate(BaseModel):
    meal_type: Optional[str] = None
    title: Optional[str] = None
    servings: Optional[float] = None
    quantity: Optional[float] = None
    nutrition: Optional[Dict[str, Any]] = None
    group_mes_score: Optional[float] = None
    group_mes_tier: Optional[str] = None


class FoodLogResponse(BaseModel):
    id: str
    date: str
    meal_type: str
    source_type: str
    source_id: Optional[str] = None
    group_id: Optional[str] = None
    group_mes_score: Optional[float] = None
    group_mes_tier: Optional[str] = None
    title: Optional[str] = None
    servings: float
    quantity: float
    nutrition_snapshot: Dict[str, Any]
    fuel_score: Optional[float] = None


class DailyNutritionResponse(BaseModel):
    date: str
    totals: Dict[str, float]
    comparison: Dict[str, Dict[str, float | str]]
    daily_score: float
    logs: List[FoodLogResponse]
