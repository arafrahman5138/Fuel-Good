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
    clean_eating_pct: int


class FuelSettingsUpdate(BaseModel):
    fuel_target: Optional[int] = Field(default=None, ge=50, le=100)
    expected_meals_per_week: Optional[int] = Field(default=None, ge=7, le=35)
    clean_eating_pct: Optional[int] = Field(default=None, ge=50, le=100)


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
    # Credit-based flex fields
    clean_pct: int
    clean_meals_target: int
    clean_meals_logged: int
    flex_budget: int
    flex_used: int
    flex_available: int
    # Snack/dessert tracking (excluded from main meal count)
    snacks_logged: int = 0
    snack_avg_score: float = 0.0
    # Real Food Tracker fields
    real_food_meals: int = 0
    real_food_goal: int = 0
    logged_meals: int = 0
    room_total: int = 0
    room_used: int = 0
    room_remaining: int = 0
    room_overflow: int = 0
    # Legacy points fields
    flex_points_total: float = 0.0
    flex_points_used: float = 0.0
    flex_points_remaining: float = 0.0
    flex_meals_remaining: int = 0
    target_met: bool = False
    projected_weekly_avg: float = 0.0
    week_start: str = ""
    week_end: str = ""


class ManualFlexLogRequest(BaseModel):
    meal_type: Optional[str] = Field(default="snack", description="breakfast/lunch/dinner/snack")
    tag: Optional[str] = Field(default=None, description="pizza/burger/takeout/dessert/drinks/other")
    date: Optional[str] = Field(default=None, description="ISO date, defaults to today")


class ManualFlexLogResponse(BaseModel):
    id: str
    date: str
    title: str
    fuel_score: float
    flex_available: int
    weekly_avg: float
    flex_counted: Optional[bool] = None
    flex_note: Optional[str] = None


class WeeklyFuelResponse(BaseModel):
    week_start: str
    week_end: str
    avg_fuel_score: float
    meal_count: int
    target_met: bool
    flex_budget: FlexBudgetResponse
    daily_breakdown: List[DailyFuelResponse]


class FuelStreakResponse(BaseModel):
    # Headline daily streak (User.current_streak) — day units only.
    current_streak: int
    longest_streak: int
    fuel_target: int
    # 2026-07-11 (QA E3): weekly fuel-target drill-down — consecutive WEEKS
    # whose average fuel score met the target (the weekly recap reports the
    # same number as weeks_at_goal_streak). Week units, kept separate from
    # the day-unit headline fields so the two never get max()'d together.
    fuel_target_streak: int = 0
    fuel_target_longest: int = 0


# ── Health Pulse ─────────────────────────────────────────────────────

class HealthPulseDimension(BaseModel):
    # score is null when the dimension is unavailable — e.g. the metabolic
    # dimension for free-tier users (2026-07-11 QA D3 premium gate).
    score: Optional[float] = None
    label: str
    tier: str  # "excellent" | "good" | "fair" | "poor" | "locked"
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


# ── Weekly Recap ─────────────────────────────────────────────────────

class WeeklyRecapResponse(BaseModel):
    """The Sunday proof moment: how last week actually went."""
    week_start: str
    week_end: str
    has_data: bool
    avg_fuel_score: float = 0.0
    tier_label: str = ""              # Elite / Strong / Decent / Mixed / Rebuilding
    real_food_meals: int = 0
    real_food_goal: int = 0
    logged_meals: int = 0
    room_used: int = 0
    room_total: int = 0
    goal_met: bool = False
    weeks_at_goal_streak: int = 0
    headline: str = ""                # "17 real-food meals. Pizza night fit."
    body: str = ""                    # warm interpretation, never shame-coded
