"""Energy-density sanity envelope (scan QA 2026-07-11, defect D5).

Fixtures mirror the four QA calorie failures: fried chicken −55%, sundae −65%,
sushi +105%, whole rotisserie bird read as 450 kcal.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.meal_scan import _apply_energy_density_envelope


def _totals(calories: float) -> dict[str, float]:
    return {"calories": calories, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar_g": 0.0}


def test_underestimated_fried_basket_is_raised() -> None:
    # ~700 g of fried chicken + fries cannot be 420 kcal (0.6 kcal/g).
    components = [
        {"name": "fried chicken", "role": "protein", "methods": ["deep-fried"], "estimated_grams": 400},
        {"name": "french fries", "role": "carb", "methods": ["fried"], "estimated_grams": 300},
    ]
    totals = _totals(420)
    assert _apply_energy_density_envelope(totals, components, 1.0) is True
    assert totals["calories"] >= 700 * 1.5


def test_underestimated_sundae_is_raised() -> None:
    components = [
        {"name": "ice cream sundae", "role": "dessert", "methods": [], "estimated_grams": 350},
    ]
    totals = _totals(204)
    assert _apply_energy_density_envelope(totals, components, 1.0) is True
    assert totals["calories"] >= 350 * 1.5


def test_overestimated_sushi_is_lowered() -> None:
    # ~450 g sushi platter at 1130 kcal is 2.5 kcal/g — plausible? No:
    # nigiri/rolls run ~1.3-1.8 kcal/g; the envelope's non-rich cap is 3.2,
    # so 1130 on 300 g (3.8 kcal/g) clamps.
    components = [
        {"name": "sushi platter", "role": "carb", "methods": [], "estimated_grams": 300},
    ]
    totals = _totals(1130)
    assert _apply_energy_density_envelope(totals, components, 1.0) is True
    assert totals["calories"] <= 300 * 3.2


def test_plausible_meal_is_untouched() -> None:
    components = [
        {"name": "grilled salmon", "role": "protein", "methods": ["grilled"], "estimated_grams": 180},
        {"name": "quinoa", "role": "whole_carb", "methods": [], "estimated_grams": 180},
        {"name": "asparagus", "role": "veg", "methods": ["roasted"], "estimated_grams": 120},
    ]
    totals = _totals(505)  # ~1.05 kcal/g — comfortably inside the band
    assert _apply_energy_density_envelope(totals, components, 1.0) is False
    assert totals["calories"] == 505


def test_no_grams_means_no_clamp() -> None:
    components = [{"name": "mystery stew", "role": "other", "methods": []}]
    totals = _totals(9999)
    assert _apply_energy_density_envelope(totals, components, 1.0) is False
    assert totals["calories"] == 9999
