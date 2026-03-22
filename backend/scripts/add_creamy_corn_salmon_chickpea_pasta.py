#!/usr/bin/env python3
from __future__ import annotations

import uuid

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe
from app.services.metabolic_engine import (
    DEFAULT_COMPUTED_BUDGET,
    build_glycemic_nutrition_input,
    compute_meal_mes,
    compute_meal_mes_with_pairing,
)


MEAL_TITLE = "Creamy Corn Salmon Chickpea Pasta"
SIDE_TITLE = "Arugula Cucumber Feta Salad"


def build_side() -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=SIDE_TITLE,
        description="A crisp arugula, cucumber, and feta salad with lemon and olive oil that brightens richer salmon pasta dishes.",
        ingredients=[
            {"name": "arugula", "quantity": "2", "unit": "cups", "category": "produce"},
            {"name": "cucumber, sliced", "quantity": "1", "unit": "cup", "category": "produce"},
            {"name": "feta cheese", "quantity": "1", "unit": "tbsp", "category": "dairy"},
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
            {"name": "lemon juice", "quantity": "1", "unit": "tsp", "category": "produce"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
        ],
        steps=[
            "Add the arugula and cucumber to a bowl.",
            "Top with feta, olive oil, lemon juice, salt, and black pepper.",
            "Toss gently and serve cold or slightly chilled.",
        ],
        prep_time_min=8,
        cook_time_min=0,
        total_time_min=8,
        servings=2,
        nutrition_info={
            "calories": 86.0,
            "protein": 3.1,
            "carbs": 6.4,
            "fat": 5.5,
            "fiber": 2.3,
            "sugar": 2.4,
        },
        difficulty="easy",
        tags=["side", "salad", "quick"],
        flavor_profile=["fresh", "bright", "salty"],
        dietary_tags=["vegetarian", "gluten-free"],
        cuisine="mediterranean-inspired",
        health_benefits=["gut_health", "heart_health", "blood_sugar_support"],
        protein_type=[],
        carb_type=["nonstarchy_veg"],
        is_ai_generated=False,
        recipe_role="veg_side",
        is_component=False,
        needs_default_pairing=False,
        is_mes_scoreable=False,
        pairing_synergy_profile={
            "fiber_class": "med",
            "acid": True,
            "healthy_fat": True,
            "veg_density": "high",
            "recommended_timing": "before_meal",
        },
        glycemic_profile={
            "primary_carb_source": "nonstarchy_veg",
            "processing_level": "intact",
            "resistant_starch_prep": "none",
            "override_inference": False,
            "notes": None,
        },
    )


def build_meal(side_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Chickpea pasta with salmon and a blended corn, onion, garlic, and feta sauce for a creamy, protein-forward dinner.",
        ingredients=[
            {"name": "dry chickpea pasta", "quantity": "85", "unit": "g", "category": "grains"},
            {"name": "salmon fillets", "quantity": "2", "unit": "small", "category": "protein"},
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "paprika", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "corn", "quantity": "1", "unit": "cup", "category": "produce"},
            {"name": "onion, chopped", "quantity": "1", "unit": "small", "category": "produce"},
            {"name": "garlic cloves", "quantity": "3", "unit": "", "category": "produce"},
            {"name": "feta cheese", "quantity": "1/4", "unit": "cup", "category": "dairy"},
            {"name": "pasta water", "quantity": "1/3", "unit": "cup", "category": "other"},
        ],
        steps=[
            "Bring a pot of water to a boil and cook the chickpea pasta until tender. Reserve 1/3 cup of pasta water, then drain.",
            "Heat olive oil in a pan and season the salmon with salt, black pepper, and paprika. Cook for 3 to 4 minutes per side until fully cooked, then flake into pieces.",
            "Add the corn, onion, and garlic to the pan and cook until the onion softens.",
            "Transfer the corn mixture to a blender with feta, salt, pepper, and the reserved pasta water. Blend until mostly smooth.",
            "Combine the chickpea pasta, flaked salmon, and corn sauce in the pan. Mix well and serve hot.",
            "If using the default pairing, eat the arugula cucumber feta salad before or alongside the pasta.",
        ],
        prep_time_min=10,
        cook_time_min=15,
        total_time_min=25,
        servings=2,
        nutrition_info={
            "calories": 430.0,
            "protein": 40.8,
            "carbs": 38.8,
            "fat": 12.9,
            "fiber": 8.2,
            "sugar": 5.2,
        },
        difficulty="easy",
        tags=["dinner", "stovetop", "high_protein"],
        flavor_profile=["creamy", "savory", "bright"],
        dietary_tags=["pescatarian"],
        cuisine="mediterranean-inspired",
        health_benefits=["muscle_recovery", "heart_health", "blood_sugar_support"],
        protein_type=["salmon"],
        carb_type=["chickpeas"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        default_pairing_ids=[side_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
        glycemic_profile={
            "primary_carb_source": "legume",
            "processing_level": "intact",
            "resistant_starch_prep": "none",
            "override_inference": False,
            "notes": None,
        },
    )


def apply_mes_fields(meal: Recipe, pairing: Recipe) -> None:
    base_nutrition = build_glycemic_nutrition_input(meal.nutrition_info or {}, source=meal)
    pairing_nutrition = build_glycemic_nutrition_input(pairing.nutrition_info or {}, source=pairing)
    base = compute_meal_mes(base_nutrition, DEFAULT_COMPUTED_BUDGET)
    paired = compute_meal_mes_with_pairing(base_nutrition, pairing, DEFAULT_COMPUTED_BUDGET, pairing_nutrition)
    adjusted = paired["score"]
    macro_only = paired["macro_only_score"]

    meal.nutrition_info = {
        **(meal.nutrition_info or {}),
        "mes_score": round(float(base.get("total_score", 0) or 0), 1),
        "mes_display_score": round(float(base.get("display_score", 0) or 0), 1),
        "mes_tier": base.get("tier"),
        "mes_display_tier": base.get("display_tier"),
        "mes_sub_scores": base.get("sub_scores") or {},
        "ingredient_gis_adjustment": float(base.get("ingredient_gis_adjustment", 0) or 0),
        "ingredient_gis_reasons": list(base.get("ingredient_gis_reasons") or []),
        "mes_score_with_default_pairing": round(float(macro_only.get("display_score", 0) or 0), 1),
        "mes_default_pairing_adjusted_score": round(float(adjusted.get("display_score", 0) or 0), 1),
        "mes_default_pairing_delta": round(float(adjusted.get("display_score", 0) or 0) - float(base.get("display_score", 0) or 0), 1),
        "mes_default_pairing_synergy_bonus": float(paired.get("pairing_synergy_bonus", 0) or 0),
        "mes_default_pairing_gis_bonus": float(paired.get("pairing_gis_bonus", 0) or 0),
        "mes_default_pairing_id": str(pairing.id),
        "mes_default_pairing_title": pairing.title,
        "mes_default_pairing_role": getattr(pairing, "recipe_role", None) or "veg_side",
        "mes_default_pairing_reasons": list(paired.get("pairing_reasons") or []),
    }


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        side = db.query(Recipe).filter(Recipe.title == SIDE_TITLE).first()
        if side is None:
            side = build_side()
            db.add(side)
            db.flush()

        meal = db.query(Recipe).filter(Recipe.title == MEAL_TITLE).first()
        if meal is None:
            meal = build_meal(str(side.id))
            db.add(meal)
        else:
            meal.default_pairing_ids = [str(side.id)]
            meal.needs_default_pairing = True
            meal.is_mes_scoreable = True
            meal.glycemic_profile = {
                "primary_carb_source": "legume",
                "processing_level": "intact",
                "resistant_starch_prep": "none",
                "override_inference": False,
                "notes": None,
            }
        apply_mes_fields(meal, side)
        db.commit()
        print(f"Upserted meal: {meal.title} ({meal.id})")
        print(f"Upserted side: {side.title} ({side.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
