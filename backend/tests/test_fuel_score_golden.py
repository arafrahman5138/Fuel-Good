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
        (55, 95),  # rice no longer flagged refined_flour; cheese/sour cream NOVA penalty still applies (2026-05-19)
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
        (85, 100),  # white rice no longer carries refined_flour tag (2026-05-19 calibration)
    ),
    (
        "chicken_beef_rice_bowl",
        # Regression test for the 2026-05-16 prod scan that returned 85 on a
        # Whole-Food-Pass meal — plain "rice" was tagged refined_flour in
        # nova_dict.json, triggering the med_count==1 cap at fuel_score.py:430.
        [
            {"name": "grilled chicken", "role": "protein", "mass_fraction": 0.3, "methods": ["grilled"]},
            {"name": "grilled beef", "role": "protein", "mass_fraction": 0.25, "methods": ["grilled"]},
            {"name": "white rice", "role": "carb", "mass_fraction": 0.25},
            {"name": "mixed salad", "role": "veg", "mass_fraction": 0.2},
        ],
        {"meal_label": "Chicken and Beef Rice Bowl with Salad",
         "source_context": "restaurant", "whole_food_status": "pass", "confidence": 0.9},
        (90, 100),
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
    # ---- 2026-07-11 recalibration regression cases (scan QA findings) ----
    (
        "healthwashed_smoothie_juice_concentrates",  # scored a perfect 100 pre-fix
        {
            "product_name": "All Natural Superfood Smoothie",
            "ingredients_text": (
                "Apple Juice Concentrate, Banana Puree, Mango Puree, "
                "White Grape Juice Concentrate, Spinach Powder, Natural Flavors, "
                "Citric Acid, Ascorbic Acid"
            ),
            "protein_g": 2, "fiber_g": 2, "sugar_g": 53, "carbs_g": 64, "sodium_mg": 30, "calories": 270,
        },
        (0, 45),
    ),
    (
        "cola_hfcs",  # scored 34.9 pre-fix; belongs at the bottom
        {
            "product_name": "Cola",
            "ingredients_text": (
                "Carbonated Water, High Fructose Corn Syrup, Caramel Color, "
                "Phosphoric Acid, Natural Flavors, Caffeine"
            ),
            "protein_g": 0, "fiber_g": 0, "sugar_g": 39, "carbs_g": 39, "sodium_mg": 45, "calories": 140,
        },
        (0, 25),
    ),
    (
        "instant_noodles_tbhq",  # scored 34.9 pre-fix
        {
            "product_name": "Instant Noodle Cup",
            "ingredients_text": (
                "Enriched Wheat Flour, Palm Oil, Salt, Monosodium Glutamate, "
                "Hydrolyzed Soy Protein, Sugar, Dehydrated Vegetables, "
                "Disodium Inosinate, Disodium Guanylate, TBHQ, Yellow 6"
            ),
            "protein_g": 6, "fiber_g": 1, "sugar_g": 2, "carbs_g": 40, "sodium_mg": 1160, "calories": 290, "fat_g": 12,
        },
        (0, 25),
    ),
    (
        "clean_bean_can_not_pinned_at_100",  # clean labels spread 74-96, never 100
        {
            "product_name": "Black Beans",
            "ingredients_text": "Prepared Black Beans, Water, Sea Salt",
            "protein_g": 7, "fiber_g": 7, "sugar_g": 0, "carbs_g": 20, "sodium_mg": 130, "calories": 110,
        },
        (74, 96),
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


def test_home_thali_scores_like_home_cooking_not_fast_food():
    """Scan QA 2026-07-10: dal/rice/roti/paneer thali fresh-scanned at 40 —
    the same as a fried-chicken basket — because none of the staples were in
    the NOVA dict. With the South Asian entries they resolve as home cooking."""
    result = compute_fuel_score(
        source_type="scan",
        meal_label="Indian Thali",
        components=[
            {"name": "dal", "role": "protein", "mass_fraction": 0.2},
            {"name": "rice", "role": "carb", "mass_fraction": 0.25},
            {"name": "roti", "role": "carb", "mass_fraction": 0.2},
            {"name": "palak paneer", "role": "protein", "mass_fraction": 0.2},
            {"name": "raita", "role": "sauce", "mass_fraction": 0.1},
            {"name": "onion and tomato salad", "role": "veg", "mass_fraction": 0.05},
        ],
        source_context="home",
        confidence=0.9,
    )
    # The defect was scoring 40 — fried-chicken territory. Home-cooked NOVA 1-2
    # staples should land solidly above the "mixed" tier. (Glycemic load is the
    # Metabolic pillar's job, not Fuel's.)
    assert 55 <= result.score <= 98, (
        f"home thali scored {result.score} (tier={result.tier}) — expected 55-98"
    )


def test_dict_bounds_model_nova_but_processing_methods_keep_authority():
    """The extractor's err-higher NOVA hints are bounded to dict+1 on exact
    dictionary matches (fixes over-classed staples like roti/dal), but a
    component with processing methods (fried chips) keeps the model's class."""
    thali = compute_fuel_score(
        source_type="scan", meal_label="Indian Thali", source_context="home", confidence=0.9,
        components=[
            {"name": "roti", "role": "carb", "mass_fraction": 0.25, "nova": 3, "methods": []},
            {"name": "dal", "role": "protein", "mass_fraction": 0.25, "nova": 3, "methods": []},
            {"name": "rice", "role": "carb", "mass_fraction": 0.25, "nova": 3, "methods": []},
            {"name": "raita", "role": "other", "mass_fraction": 0.25, "nova": 3, "methods": []},
        ],
    )
    # The defect: pre-fix this scored 40 — the same as a fried-chicken basket.
    # dict+1 bounding keeps it clearly above fast food even on this
    # deliberately harsh equal-mass fixture.
    assert thali.score >= 55, f"model nova-3 hints tanked a home thali to {thali.score}"

    nachos = compute_fuel_score(
        source_type="scan", meal_label="Loaded Nachos", source_context="restaurant", confidence=0.85,
        components=[
            {"name": "tortilla chips", "role": "carb", "mass_fraction": 0.35, "nova": 3, "methods": ["fried"]},
            {"name": "nacho cheese sauce", "role": "sauce", "mass_fraction": 0.25, "nova": 4, "methods": []},
            {"name": "ground beef", "role": "protein", "mass_fraction": 0.25, "nova": 3, "methods": ["cooked"]},
            {"name": "sour cream", "role": "sauce", "mass_fraction": 0.15, "nova": 3, "methods": []},
        ],
    )
    assert nachos.score <= 55, f"dict bounding must not lift loaded nachos to {nachos.score}"


def test_rotisserie_chicken_is_not_a_whole_food_pass():
    """Scan QA 2026-07-10: a supermarket rotisserie chicken scored 100 with a
    Whole-Food Pass. Sodium-injected prepared birds are NOVA 3."""
    result = compute_fuel_score(
        source_type="scan",
        meal_label="Rotisserie Chicken",
        components=[{"name": "rotisserie chicken", "role": "protein", "mass_fraction": 1.0}],
        source_context="home",
        confidence=0.9,
    )
    assert result.score <= 85, f"rotisserie chicken scored {result.score} — honest-100 must not fire"


def test_label_scores_are_not_quantized():
    """Scan QA 2026-07-10: every label scored exactly 34.9, 59.0, or 100.0.
    The band-projection recalibration must produce a spread of distinct scores
    across a varied basket of products."""
    scores = {
        analyze_whole_food_product(payload)["score"]
        for _, payload, _ in LABEL_GOLDEN
    }
    assert len(scores) >= 5, f"label scores still quantized: {sorted(scores)}"
    assert 100.0 not in scores, "a label scored a perfect 100 — bonuses must be capped"


# ---- 2026-07-11 honest dessert scoring (recipe_role="dessert") ----

def test_whole_food_dessert_recipe_scores_high():
    """A dessert made of nothing but whole foods keeps an honest 95-100 —
    the NOVA dict, not the vetted-100 recipe shortcut, gets it there."""
    result = compute_fuel_score(
        source_type="recipe",
        recipe_role="dessert",
        title="Creamy Banana Milk",
        ingredients=[
            {"name": "banana", "quantity": "1", "unit": ""},
            {"name": "milk", "quantity": "1", "unit": "cup"},
        ],
    )
    assert result.score >= 90, (
        f"whole-food dessert scored {result.score} (reasoning={result.reasoning}) — expected >= 90"
    )


def test_sugary_baked_dessert_recipe_scores_actual_profile():
    """A sweetened baked dessert must land on its actual ingredient profile,
    not the vetted-100 shortcut."""
    result = compute_fuel_score(
        source_type="recipe",
        recipe_role="dessert",
        title="Banana Cake with Frosting",
        ingredients=[
            {"name": "cassava flour", "quantity": "1", "unit": "cup"},
            {"name": "sugar", "quantity": "0.5", "unit": "cup"},
            {"name": "butter", "quantity": "4", "unit": "tablespoons"},
            {"name": "eggs", "quantity": "2", "unit": ""},
            {"name": "banana", "quantity": "2", "unit": ""},
        ],
    )
    assert 40 <= result.score <= 88, (
        f"sugary baked dessert scored {result.score} (flags={result.flags}) — expected 40-88"
    )


def test_full_meal_recipe_keeps_vetted_100():
    """Non-dessert recipe roles (and missing roles) keep the curated-100 path."""
    for role in (None, "full_meal", "component"):
        result = compute_fuel_score(source_type="recipe", recipe_role=role)
        assert result.score == 100.0, f"recipe_role={role!r} broke the vetted-100 shortcut"


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
