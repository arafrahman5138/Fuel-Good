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


MEAL_TITLE = "Crispy Beef Tacos"
PAIRING_TITLE = "Cilantro Lime Cabbage Slaw"
IMAGE_URL = "/static/meal-images/crispy-beef-tacos-draft.png"


def build_meal(pairing_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Crispy pan-toasted corn tacos filled with seasoned beef, peppers, cheddar, lettuce, tomato, and a creamy salsa-yogurt drizzle.",
        ingredients=[
            {"name": "90/10 ground beef", "quantity": "1", "unit": "lb", "category": "protein"},
            {"name": "onion, finely diced", "quantity": "1", "unit": "large", "category": "produce"},
            {"name": "jalapeno, finely diced", "quantity": "1", "unit": "", "category": "produce"},
            {"name": "bell pepper, diced", "quantity": "1/2", "unit": "", "category": "produce"},
            {"name": "chili powder", "quantity": "2", "unit": "tsp", "category": "spices"},
            {"name": "paprika", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "cumin", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "garlic powder", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "oregano", "quantity": "1/2", "unit": "tsp", "category": "spices"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "water", "quantity": "2-3", "unit": "tbsp", "category": "other"},
            {"name": "corn tortillas", "quantity": "6", "unit": "", "category": "carbs"},
            {"name": "shredded cheddar cheese", "quantity": "2", "unit": "oz", "category": "dairy"},
            {"name": "olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"},
            {"name": "shredded lettuce", "quantity": "1", "unit": "cup", "category": "produce"},
            {"name": "tomato, diced", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "plain Greek yogurt", "quantity": "1/3", "unit": "cup", "category": "dairy"},
            {"name": "salsa or taco-style hot sauce", "quantity": "2", "unit": "tbsp", "category": "sauces"},
        ],
        steps=[
            "Heat a lightly oiled skillet over medium-high heat. Add the ground beef and press it into a flat layer so it can brown well before you break it apart.",
            "Once the beef has good color on the bottom, break it up with a spoon. Add the onion, jalapeno, and bell pepper and cook for a few minutes until the vegetables soften.",
            "Add the chili powder, paprika, cumin, garlic powder, oregano, salt, and black pepper. Pour in a small splash of water, stir, and let everything simmer briefly until the beef is well coated and flavorful.",
            "In a small bowl, mix the Greek yogurt with the salsa or hot sauce to make the creamy taco drizzle.",
            "Heat a shallow layer of oil in another skillet. Warm each corn tortilla just until it softens and starts to bubble, then sprinkle on a little cheese.",
            "Add a generous spoonful of the beef mixture, fold the tortilla in half, and press gently. Toast until the outside is crisp and golden, then flip and crisp the second side.",
            "Finish the tacos with shredded lettuce, diced tomato, and the yogurt-salsa sauce. If using the default pairing, have the cilantro lime cabbage slaw before or alongside the tacos.",
        ],
        prep_time_min=10,
        cook_time_min=20,
        total_time_min=30,
        servings=2,
        nutrition_info={
            "calories": 656.0,
            "protein": 42.5,
            "carbs": 38.5,
            "fat": 34.0,
            "fiber": 5.9,
            "sugar": 4.5,
        },
        image_url=IMAGE_URL,
        difficulty="easy",
        tags=["dinner", "stovetop", "high_protein"],
        flavor_profile=["savory", "crispy", "spiced"],
        dietary_tags=["gluten-free"],
        cuisine="mexican-inspired",
        health_benefits=["muscle_recovery", "satiety", "blood_sugar_support"],
        protein_type=["beef"],
        carb_type=["corn_tortilla"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        default_pairing_ids=[pairing_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
        glycemic_profile={
            "primary_carb_source": "other",
            "processing_level": "minimally_processed",
            "resistant_starch_prep": "none",
            "override_inference": False,
            "notes": "Corn tortillas do not receive ingredient-aware GIS relief in v1.",
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
    finally:
        db.close()


if __name__ == "__main__":
    main()
