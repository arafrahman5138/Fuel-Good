from pydantic import BaseModel, Field
from typing import Optional, List


class FuelScoreResponse(BaseModel):
    score: float
    tier: str
    tier_label: str
    flags: List[str] = []
    reasoning: List[str] = []
    source_path: str


class FuelSettingsResponse(BaseModel):
    fuel_target: int
    expected_meals_per_week: int


class FuelSettingsUpdate(BaseModel):
    fuel_target: Optional[int] = Field(default=None, ge=50, le=100)
    expected_meals_per_week: Optional[int] = Field(default=None, ge=7, le=35)


class DailyFuelResponse(BaseModel):
    date: str
    avg_fuel_score: float
    meal_count: int
    meals: List[dict]  # [{title, fuel_score, tier, source_type}]


class FlexBudgetResponse(BaseModel):
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


class WeeklyFuelResponse(BaseModel):
    week_start: str
    week_end: str
    avg_fuel_score: float
    meal_count: int
    target_met: bool
    flex_budget: FlexBudgetResponse
    daily_breakdown: List[DailyFuelResponse]


class FuelStreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    fuel_target: int


# ── Health Pulse ─────────────────────────────────────────────────────

class HealthPulseDimension(BaseModel):
    score: float
    label: str
    tier: str  # "excellent" | "good" | "fair" | "poor"
    available: bool = True

class HealthPulseResponse(BaseModel):
    date: str
    score: float  # 0-100 composite
    tier: str  # "excellent" | "good" | "fair" | "poor"
    tier_label: str
    fuel: HealthPulseDimension
    metabolic: HealthPulseDimension
    nutrition: HealthPulseDimension
    meal_count: int


# ── Calendar Heat Map ────────────────────────────────────────────────

class CalendarDayEntry(BaseModel):
    date: str
    avg_fuel_score: float
    meal_count: int
    tier: str  # fuel tier key
    is_flex: bool = False  # had a flex meal (below target)

class FuelCalendarResponse(BaseModel):
    month: str  # YYYY-MM
    fuel_target: int
    days: List[CalendarDayEntry]


# ── Smart Flex Suggestions ───────────────────────────────────────────

class FlexSuggestion(BaseModel):
    icon: str
    title: str
    body: str
    accent: str  # color key

class SmartFlexResponse(BaseModel):
    context: str  # "pre_flex" | "post_flex" | "on_track" | "budget_low"
    flex_meals_remaining: int
    suggestions: List[FlexSuggestion]
