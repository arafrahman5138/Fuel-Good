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


MEAL_TITLE = "Chicken & Shrimp Basil Fried Rice"
PAIRING_TITLE = "Stir-Fried Bok Choy with Ginger"
IMAGE_URL = "/static/meal-images/5a16e2c9af6d.png"


def build_meal(pairing_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="A savory stir-fried rice loaded with seasoned chicken thighs, shrimp, fresh basil, and crispy veggies in a coconut aminos and fish sauce base.",
        ingredients=[
            {"name": "boneless skinless chicken thighs", "quantity": "10", "unit": "oz", "category": "protein"},
            {"name": "shrimp, peeled and deveined", "quantity": "8", "unit": "oz", "category": "protein"},
            {"name": "cooked white rice, day-old", "quantity": "2", "unit": "cups", "category": "carbs"},
            {"name": "bell pepper, diced", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "mushrooms, sliced", "quantity": "1", "unit": "cup", "category": "produce"},
            {"name": "garlic, minced", "quantity": "4", "unit": "cloves", "category": "produce"},
            {"name": "eggs", "quantity": "2", "unit": "", "category": "protein"},
            {"name": "fresh basil leaves", "quantity": "1/4", "unit": "cup", "category": "produce"},
            {"name": "green onions, sliced", "quantity": "3", "unit": "stalks", "category": "produce"},
            {"name": "coconut aminos", "quantity": "2.5", "unit": "tbsp", "category": "sauces"},
            {"name": "fish sauce", "quantity": "1.5", "unit": "tsp", "category": "sauces"},
            {"name": "avocado oil", "quantity": "1.5", "unit": "tbsp", "category": "fats"},
            {"name": "butter", "quantity": "1", "unit": "tbsp", "category": "fats"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "cayenne pepper", "quantity": "1/4", "unit": "tsp", "category": "spices"},
            {"name": "garlic powder", "quantity": "1/2", "unit": "tsp", "category": "spices"},
        ],
        steps=[
            "Slice the chicken thighs into thin strips. Toss with salt, black pepper, cayenne, garlic powder, a drizzle of avocado oil, and a splash of coconut aminos. Let it sit while you prep the veggies.",
            "Heat a large skillet or wok over medium-high heat with a bit of avocado oil. Add the chicken in a single layer and cook undisturbed for 2-3 minutes per side until golden and cooked through. Remove and set aside.",
            "In the same pan, add the shrimp with a pinch of salt and pepper. Sear for about 1-2 minutes per side until pink and curled. Remove and set aside with the chicken.",
            "Push everything aside or use a clean section of the pan. Add butter, crack in the eggs, and scramble until just set. Break into small pieces. Remove and set aside.",
            "Add a touch more avocado oil to the pan. Toss in the bell pepper, mushrooms, and garlic. Season with salt and pepper. Cook for 2-3 minutes until they soften and pick up some color.",
            "Add coconut aminos and fish sauce to the veggies and stir. Add the day-old rice, breaking up any clumps. Toss everything together over high heat for 2-3 minutes.",
            "Add the chicken, shrimp, and scrambled egg back to the pan. Drizzle in the remaining coconut aminos. Toss to combine.",
            "Kill the heat. Fold in the fresh basil and sliced green onions. Serve immediately.",
        ],
        prep_time_min=15,
        cook_time_min=20,
        total_time_min=35,
        servings=2,
        nutrition_info={
            "calories": 824.0,
            "protein": 66.0,
            "carbs": 56.0,
            "fat": 36.0,
            "fiber": 3.0,
            "sugar": 5.0,
        },
        image_url=IMAGE_URL,
        difficulty="easy",
        tags=["dinner", "stovetop", "high_protein", "quick"],
        flavor_profile=["savory", "umami", "spicy", "aromatic"],
        dietary_tags=["gluten-free"],
        cuisine="asian-fusion",
        health_benefits=["muscle_recovery", "satiety", "high_protein"],
        protein_type=["chicken", "shrimp"],
        carb_type=["white_rice"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        default_pairing_ids=[pairing_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
        glycemic_profile={
            "primary_carb_source": "white_rice",
            "processing_level": "minimally_processed",
            "resistant_starch_prep": "cooked_cooled",
            "override_inference": False,
            "notes": "Day-old rice has higher resistant starch than freshly cooked.",
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
            updated = build_meal(str(pairing.id))
            for field in [
                "description",
                "ingredients",
                "steps",
                "prep_time_min",
                "cook_time_min",
                "total_time_min",
                "servings",
                "nutrition_info",
                "image_url",
                "difficulty",
                "tags",
                "flavor_profile",
                "dietary_tags",
                "cuisine",
                "health_benefits",
                "protein_type",
                "carb_type",
                "recipe_role",
                "is_component",
                "default_pairing_ids",
                "needs_default_pairing",
                "is_mes_scoreable",
                "glycemic_profile",
            ]:
                setattr(meal, field, getattr(updated, field))

        apply_mes_fields(meal, pairing)
        db.commit()
        print(f"Upserted meal: {meal.title} ({meal.id})")
        print(f"Linked default pairing: {pairing.title} ({pairing.id})")
        print(f"Image URL: {meal.image_url}")
        ni = meal.nutrition_info or {}
        print(f"MES base score: {ni.get('mes_score')} ({ni.get('mes_tier')})")
        print(f"MES paired score: {ni.get('mes_default_pairing_adjusted_score')} (delta: +{ni.get('mes_default_pairing_delta')})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
