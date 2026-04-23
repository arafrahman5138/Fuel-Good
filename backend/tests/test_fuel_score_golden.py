"""Golden fixtures for Fuel Score calibration.

Derived from the 2026-04-22 scan audit (see
``tasks/scan-audit-and-plan.md``). Each fixture asserts a plausible
score range rather than a single value — the goal is to catch
regressions where a well-known meal's score drifts outside the
honest-scoring band we calibrated against. Component shapes mirror
what the upgraded meal-scan prompt produces.

Run directly:
    python -m pytest backend/tests/test_fuel_score_golden.py -v
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.fuel_score import compute_fuel_score
from app.services.whole_food_scoring import analyze_whole_food_product


# ── Meal scan golden set ──────────────────────────────────────────────
# Each tuple: (id, components, kwargs, (min_score, max_score))

MEAL_GOLDEN = [
    (
        "healthy_plate",
        [
            {"name": "grilled chicken breast", "role": "protein", "mass_fraction": 0.4, "methods": ["grilled"]},
            {"name": "quinoa", "role": "whole_carb", "mass_fraction": 0.35},
            {"name": "broccoli", "role": "veg", "mass_fraction": 0.25, "methods": ["steamed"]},
        ],
        {"meal_label": "Grilled Chicken with Quinoa and Broccoli", "source_context": "home", "confidence": 0.9},
        (90, 100),
    ),
    (
        "diner_burger_fries",
        [
            {"name": "beef patty", "role": "protein", "mass_fraction": 0.25, "methods": ["grilled"]},
            {"name": "hamburger bun", "role": "carb", "mass_fraction": 0.25},
            {"name": "american cheese", "role": "other", "mass_fraction": 0.1},
            {"name": "french fries", "role": "carb", "mass_fraction": 0.4, "methods": ["fried"]},
        ],
        {"meal_label": "Cheeseburger and Fries", "source_context": "restaurant", "confidence": 0.9},
        (20, 45),
    ),
    (
        "burrito_bowl",
        [
            {"name": "white rice", "role": "carb", "mass_fraction": 0.3},
            {"name": "black beans", "role": "protein", "mass_fraction": 0.2},
            {"name": "grilled chicken", "role": "protein", "mass_fraction": 0.2},
            {"name": "cheese", "role": "other", "mass_fraction": 0.1},
            {"name": "sour cream", "role": "fat", "mass_fraction": 0.1},
            {"name": "salsa", "role": "sauce", "mass_fraction": 0.1},
        ],
        {"meal_label": "Chipotle Burrito Bowl", "source_context": "restaurant", "confidence": 0.9},
        (55, 90),
    ),
    (
        "pasta_carbonara",
        [
            {"name": "spaghetti", "role": "carb", "mass_fraction": 0.55},
            {"name": "guanciale", "role": "protein", "mass_fraction": 0.15},
            {"name": "eggs", "role": "protein", "mass_fraction": 0.2},
            {"name": "pecorino", "role": "other", "mass_fraction": 0.1},
        ],
        {"meal_label": "Spaghetti Carbonara", "source_context": "restaurant", "confidence": 0.85},
        (25, 55),
    ),
    (
        "yogurt_bowl",
        [
            {"name": "greek yogurt", "role": "protein", "mass_fraction": 0.5},
            {"name": "berries", "role": "fruit", "mass_fraction": 0.2},
            {"name": "granola", "role": "carb", "mass_fraction": 0.2},
            {"name": "honey", "role": "other", "mass_fraction": 0.1},
        ],
        {"meal_label": "Greek Yogurt Bowl", "source_context": "home", "confidence": 0.9},
        (60, 85),
    ),
    (
        "pepperoni_pizza",
        [
            {"name": "pizza dough", "role": "carb", "mass_fraction": 0.5},
            {"name": "mozzarella", "role": "other", "mass_fraction": 0.2},
            {"name": "pepperoni", "role": "protein", "mass_fraction": 0.15},
            {"name": "tomato sauce", "role": "sauce", "mass_fraction": 0.15},
        ],
        {"meal_label": "Pepperoni Pizza", "source_context": "restaurant", "confidence": 0.9},
        (15, 40),
    ),
    (
        "cheese_pizza",
        [
            {"name": "pizza dough", "role": "carb", "mass_fraction": 0.55},
            {"name": "mozzarella", "role": "other", "mass_fraction": 0.25},
            {"name": "tomato sauce", "role": "sauce", "mass_fraction": 0.2},
        ],
        {"meal_label": "Cheese Pizza", "source_context": "restaurant", "confidence": 0.9},
        (25, 55),
    ),
    (
        "salmon_white_rice",
        [
            {"name": "grilled salmon", "role": "protein", "mass_fraction": 0.4, "methods": ["grilled"]},
            {"name": "white rice", "role": "carb", "mass_fraction": 0.35},
            {"name": "bok choy", "role": "veg", "mass_fraction": 0.25, "methods": ["steamed"]},
        ],
        {"meal_label": "Grilled Salmon with Rice and Bok Choy", "source_context": "home", "confidence": 0.9},
        (70, 95),
    ),
    (
        "salmon_brown_rice",
        [
            {"name": "grilled salmon", "role": "protein", "mass_fraction": 0.4, "methods": ["grilled"]},
            {"name": "brown rice", "role": "whole_carb", "mass_fraction": 0.35},
            {"name": "bok choy", "role": "veg", "mass_fraction": 0.25, "methods": ["steamed"]},
        ],
        {"meal_label": "Grilled Salmon with Brown Rice", "source_context": "home", "confidence": 0.9},
        (88, 100),
    ),
    (
        "overnight_oats_berries",
        [
            {"name": "rolled oats", "role": "whole_carb", "mass_fraction": 0.4},
            {"name": "blueberries", "role": "fruit", "mass_fraction": 0.2},
            {"name": "raspberries", "role": "fruit", "mass_fraction": 0.1},
            {"name": "peanut butter", "role": "fat", "mass_fraction": 0.15},
            {"name": "almond milk", "role": "other", "mass_fraction": 0.15},
        ],
        {"meal_label": "Overnight Oats with Berries and Peanut Butter", "source_context": "home", "confidence": 0.9},
        (80, 100),
    ),
    (
        "cafeteria_tray",
        [
            {"name": "macaroni", "role": "carb", "mass_fraction": 0.3},
            {"name": "american cheese", "role": "other", "mass_fraction": 0.1},
            {"name": "chicken nuggets", "role": "protein", "mass_fraction": 0.2},
            {"name": "corn", "role": "carb", "mass_fraction": 0.2},
            {"name": "pudding", "role": "dessert", "mass_fraction": 0.2},
        ],
        {"meal_label": "Cafeteria Tray", "source_context": "restaurant", "confidence": 0.9},
        (10, 35),
    ),
    (
        "sugary_cereal_with_milk",
        [
            {"name": "sugary cereal", "role": "carb", "mass_fraction": 0.7},
            {"name": "whole milk", "role": "other", "mass_fraction": 0.3},
        ],
        {"meal_label": "Kids Cereal with Milk", "source_context": "home", "confidence": 0.9,
         "nutrition": {"sugar_g": 22}},
        (10, 30),
    ),
    (
        "latte_beverage",
        [{"name": "latte", "role": "other", "mass_fraction": 1.0}],
        {"meal_label": "Cafe Latte", "source_context": "restaurant", "confidence": 0.9,
         "is_beverage": True, "nutrition": {"sugar_g": 10}},
        (45, 70),
    ),
]


# ── Product label golden set ──────────────────────────────────────────

LABEL_GOLDEN = [
    (
        "greek_yogurt_clean",
        {
            "product_name": "Plain Greek Yogurt",
            "ingredients_text": "Pasteurized milk, live active cultures",
            "protein_g": 18, "fiber_g": 0, "sugar_g": 4, "carbs_g": 6, "sodium_mg": 60, "calories": 120,
        },
        (85, 100),
    ),
    (
        "sugary_cereal_ultra",
        {
            "product_name": "Kids Cereal",
            "ingredients_text": "Corn flour, sugar, high fructose corn syrup, red 40, yellow 5, bht",
            "protein_g": 2, "fiber_g": 1, "sugar_g": 18, "carbs_g": 30, "sodium_mg": 150, "calories": 140,
        },
        (0, 40),
    ),
    (
        "protein_bar_isolates",
        {
            "product_name": "Protein Bar",
            "ingredients_text": "Soy protein isolate, whey protein isolate, vegetable glycerin, sucralose, natural flavors",
            "protein_g": 20, "fiber_g": 3, "sugar_g": 2, "carbs_g": 18, "sodium_mg": 180, "calories": 220,
        },
        (25, 65),
    ),
    (
        "protein_bar_ocr_garble",  # Phase 1 Bug D fix — fuzzy match
        {
            "product_name": "Protein Bar",
            "ingredients_text": "Soy Wey Protein Isolate, Vegetable Glyciate, Sucralose, Natural Flavors",
            "protein_g": 20, "fiber_g": 3, "sugar_g": 2, "carbs_g": 18, "sodium_mg": 180, "calories": 220,
        },
        (25, 65),
    ),
    (
        "healthwashed_granola_bar",
        {
            "product_name": "Granola Bar",
            "ingredients_text": "Oats, cane sugar, canola oil, rice flour, soy lecithin, natural flavor",
            "protein_g": 4, "fiber_g": 2, "sugar_g": 9, "carbs_g": 22, "sodium_mg": 85, "calories": 160,
        },
        (15, 65),
    ),
    (
        "tortilla_chips_simple",
        {
            "product_name": "Corn Tortilla Chips",
            "ingredients_text": "Corn, sunflower oil, sea salt",
            "protein_g": 2, "fiber_g": 2, "sugar_g": 0, "carbs_g": 18, "sodium_mg": 160, "calories": 140,
        },
        (50, 75),
    ),
]


@pytest.mark.parametrize("fixture_id,components,kwargs,score_range", MEAL_GOLDEN,
                         ids=[t[0] for t in MEAL_GOLDEN])
def test_meal_scan_score_in_range(fixture_id, components, kwargs, score_range):
    result = compute_fuel_score(source_type="scan", components=components, **kwargs)
    lo, hi = score_range
    assert lo <= result.score <= hi, (
        f"{fixture_id}: Fuel={result.score} outside expected [{lo},{hi}]. "
        f"tier={result.tier} flags={result.flags} reasoning={result.reasoning}"
    )


@pytest.mark.parametrize("fixture_id,payload,score_range", LABEL_GOLDEN,
                         ids=[t[0] for t in LABEL_GOLDEN])
def test_label_scan_score_in_range(fixture_id, payload, score_range):
    result = analyze_whole_food_product(payload)
    lo, hi = score_range
    assert lo <= result["score"] <= hi, (
        f"{fixture_id}: Fuel={result['score']} outside expected [{lo},{hi}]. "
        f"tier={result['tier']} concerns={result['concerns']}"
    )


def test_honest_100_requires_every_component_whole_food():
    """The clean-meal 100 ceiling must not fire when any component is NOVA ≥ 3."""
    result = compute_fuel_score(
        source_type="scan",
        meal_label="Chicken with Pasta",
        components=[
            {"name": "grilled chicken breast", "role": "protein", "mass_fraction": 0.5},
            {"name": "spaghetti", "role": "carb", "mass_fraction": 0.5},  # NOVA 3, refined_flour
        ],
        source_context="home",
        confidence=0.95,
    )
    assert result.score < 95, f"NOVA 3 component should prevent 100-ceiling, got {result.score}"


def test_ocr_fuzzy_catches_misspelled_isolate():
    """Audit bug D: 'Soy Wey Protein Isolate' must still be detected as an isolate."""
    result = analyze_whole_food_product({
        "product_name": "Bar",
        "ingredients_text": "Soy Wey Protein Isolate, Sucralose",
        "protein_g": 20, "fiber_g": 0, "sugar_g": 1, "carbs_g": 10, "sodium_mg": 100, "calories": 150,
    })
    assert result["processing_flags"]["protein_isolates"], (
        "OCR-garbled 'Soy Wey Protein Isolate' was not caught by fuzzy match"
    )


def test_beverage_never_reaches_100():
    """A latte, cappuccino, or smoothie must never score Fuel 100 even with clean components."""
    result = compute_fuel_score(
        source_type="scan",
        is_beverage=True,
        components=[{"name": "latte", "role": "other", "mass_fraction": 1.0}],
        source_context="restaurant",
        confidence=0.95,
    )
    assert result.score <= 70, f"Beverage ceiling breached: got {result.score}"
