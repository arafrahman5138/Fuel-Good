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


MEAL_TITLE = "Beef and Potato Hash"
PAIRING_TITLE = "Cucumber Tomato Herb Salad"


def build_meal(pairing_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Crispy potato hash with seasoned beef, onion, and a spicy garlic avocado-yogurt sauce.",
        ingredients=[
            {"name": "potatoes, cut into small cubes", "quantity": "2", "unit": "large", "category": "produce"},
            {"name": "olive oil", "quantity": "1 1/4", "unit": "tsp", "category": "fats"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "chili powder", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "paprika", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "oregano", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "90/10 ground beef", "quantity": "1", "unit": "lb", "category": "protein"},
            {"name": "onion, chopped", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"},
            {"name": "avocado", "quantity": "1/4", "unit": "small", "category": "produce"},
            {"name": "fat-free plain Greek yogurt", "quantity": "2", "unit": "tbsp", "category": "dairy"},
            {"name": "hot sauce", "quantity": "1-2", "unit": "tsp", "category": "sauces"},
            {"name": "garlic powder", "quantity": "to taste", "unit": "", "category": "spices"},
        ],
        steps=[
            "Wash and cut the potatoes into small cubes. Heat olive oil in a large pan, add the potatoes with salt, black pepper, chili powder, paprika, and oregano, and spread them evenly across the pan.",
            "Cook the potatoes for 5 minutes without stirring, then turn them and cover the pan with a lid so they finish cooking and crisping.",
            "Shift the potatoes to the outside of the pan to make space in the middle. Add the ground beef, onion, garlic, and seasonings, then cook for 6 to 8 minutes until the beef is fully cooked and the onion is soft.",
            "In a small bowl, stir together the avocado, Greek yogurt, hot sauce, and garlic powder until creamy.",
            "Serve the spicy garlic sauce over the beef and potato hash. If using the default pairing, have the cucumber tomato herb salad before or alongside the hash.",
        ],
        prep_time_min=10,
        cook_time_min=15,
        total_time_min=25,
        servings=2,
        nutrition_info={
            "calories": 591.0,
            "protein": 48.8,
            "carbs": 39.2,
            "fat": 29.6,
            "fiber": 5.8,
            "sugar": 5.8,
        },
        difficulty="easy",
        tags=["dinner", "stovetop", "comfort_food"],
        flavor_profile=["savory", "spicy", "hearty"],
        dietary_tags=["gluten-free"],
        cuisine="american",
        health_benefits=["muscle_recovery", "satiety", "blood_sugar_support"],
        protein_type=["beef"],
        carb_type=["potato"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        default_pairing_ids=[pairing_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
        glycemic_profile={
            "primary_carb_source": "potato",
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
        pairing = db.query(Recipe).filter(Recipe.title == PAIRING_TITLE).first()
        if pairing is None:
            raise RuntimeError(f"Required default pairing not found: {PAIRING_TITLE}")

        meal = db.query(Recipe).filter(Recipe.title == MEAL_TITLE).first()
        if meal is None:
            meal = build_meal(str(pairing.id))
            db.add(meal)
        else:
            meal.default_pairing_ids = [str(pairing.id)]
            meal.needs_default_pairing = True
            meal.is_mes_scoreable = True
            meal.glycemic_profile = {
                "primary_carb_source": "potato",
                "processing_level": "intact",
                "resistant_starch_prep": "none",
                "override_inference": False,
                "notes": None,
            }
        apply_mes_fields(meal, pairing)
        db.commit()
        print(f"Upserted meal: {meal.title} ({meal.id})")
        print(f"Linked default pairing: {pairing.title} ({pairing.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
