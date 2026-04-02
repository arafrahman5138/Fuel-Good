#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import uuid

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe
from app.services.food_image import generate_food_image
from app.services.metabolic_engine import (
    DEFAULT_COMPUTED_BUDGET,
    build_glycemic_nutrition_input,
    compute_meal_mes,
)


MEAL_TITLE = "Cheesy Chicken Tacos with Pico"
PICO_TITLE = "Pico de Gallo"


def build_pico() -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=PICO_TITLE,
        description="A bright fresh salsa made with tomato, white onion, jalapeno, cilantro, lime juice, and salt.",
        ingredients=[
            {"name": "Roma tomatoes, diced", "quantity": "2", "unit": "", "category": "produce"},
            {"name": "white onion, finely diced", "quantity": "1/4", "unit": "cup", "category": "produce"},
            {"name": "jalapeno, finely diced", "quantity": "1", "unit": "tbsp", "category": "produce"},
            {"name": "cilantro, chopped", "quantity": "2", "unit": "tbsp", "category": "produce"},
            {"name": "lime juice", "quantity": "1/2", "unit": "lime", "category": "produce"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
        ],
        steps=[
            "Combine the tomatoes, onion, jalapeno, and cilantro in a bowl.",
            "Add the lime juice and a pinch of salt, then stir well.",
            "Let the pico sit for a few minutes so the flavors come together before serving.",
        ],
        prep_time_min=10,
        cook_time_min=0,
        total_time_min=10,
        servings=4,
        nutrition_info={
            "calories": 18.0,
            "protein": 0.6,
            "carbs": 4.0,
            "fat": 0.1,
            "fiber": 1.2,
            "sugar": 2.2,
        },
        difficulty="easy",
        tags=["salsa", "fresh", "quick"],
        flavor_profile=["fresh", "bright", "zesty"],
        dietary_tags=["gluten-free", "dairy-free"],
        cuisine="mexican-inspired",
        health_benefits=["gut_health", "blood_sugar_support"],
        protein_type=[],
        carb_type=["nonstarchy_veg"],
        is_ai_generated=False,
        recipe_role="veg_side",
        is_component=True,
        needs_default_pairing=False,
        is_mes_scoreable=False,
        glycemic_profile={
            "primary_carb_source": "nonstarchy_veg",
            "processing_level": "intact",
            "resistant_starch_prep": "none",
            "override_inference": False,
            "notes": None,
        },
    )


def build_meal(pico_id: str, image_url: str | None) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Crispy corn tacos filled with taco-spiced chicken thigh strips, melted Mexican cheese, and fresh pico de gallo. The seasoning blend uses chili powder, cumin, smoked paprika, garlic powder, onion powder, oregano, salt, and black pepper.",
        ingredients=[
            {"name": "boneless skinless chicken thighs, cut into thin strips", "quantity": "1", "unit": "lb", "category": "protein"},
            {"name": "olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "chili powder", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "cumin", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "smoked paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"},
            {"name": "garlic powder", "quantity": "1/2", "unit": "tsp", "category": "spices"},
            {"name": "onion powder", "quantity": "1/2", "unit": "tsp", "category": "spices"},
            {"name": "oregano", "quantity": "1/4", "unit": "tsp", "category": "spices"},
            {"name": "corn tortillas", "quantity": "6", "unit": "", "category": "carbs"},
            {"name": "shredded Mexican cheese", "quantity": "3/4", "unit": "cup", "category": "dairy"},
            {"name": "butter", "quantity": "2", "unit": "tsp", "category": "fats"},
            {"name": "pico de gallo", "quantity": "1", "unit": "serving", "category": "produce"},
        ],
        steps=[
            "Toss the chicken with olive oil, salt, black pepper, chili powder, cumin, smoked paprika, garlic powder, onion powder, and oregano until evenly coated.",
            "Heat a skillet over medium-high heat and cook the chicken until browned and cooked through, about 6 to 8 minutes.",
            "Make or portion the pico de gallo so it is ready for topping.",
            "Melt a little butter in another skillet and warm the corn tortillas. Add cheese and chicken, fold, and toast until the tacos are crisp on both sides.",
            "Top the tacos with fresh pico and serve right away.",
        ],
        prep_time_min=10,
        cook_time_min=20,
        total_time_min=30,
        servings=2,
        nutrition_info={
            "calories": 680.0,
            "protein": 58.0,
            "carbs": 27.0,
            "fat": 35.0,
            "fiber": 4.8,
            "sugar": 4.2,
        },
        image_url=image_url,
        difficulty="easy",
        tags=["dinner", "stovetop", "high_protein"],
        flavor_profile=["savory", "crispy", "fresh"],
        dietary_tags=["gluten-free"],
        cuisine="mexican-inspired",
        health_benefits=["muscle_recovery", "satiety", "blood_sugar_support"],
        protein_type=["chicken"],
        carb_type=["corn_tortilla"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        component_composition={
            "veg_component_title": PICO_TITLE,
            "veg_component_role": "veg_side",
            "veg_component_id": pico_id,
        },
        needs_default_pairing=False,
        is_mes_scoreable=True,
        glycemic_profile={
            "primary_carb_source": "other",
            "processing_level": "minimally_processed",
            "resistant_starch_prep": "none",
            "override_inference": False,
            "notes": "Corn tortillas do not receive ingredient-aware GIS relief in v1.",
        },
    )


def apply_mes_fields(meal: Recipe) -> None:
    base_nutrition = build_glycemic_nutrition_input(meal.nutrition_info or {}, source=meal)
    base = compute_meal_mes(base_nutrition, DEFAULT_COMPUTED_BUDGET)
    meal.nutrition_info = {
        **(meal.nutrition_info or {}),
        "mes_score": round(float(base.get("total_score", 0) or 0), 1),
        "mes_display_score": round(float(base.get("display_score", 0) or 0), 1),
        "mes_tier": base.get("tier"),
        "mes_display_tier": base.get("display_tier"),
        "mes_sub_scores": base.get("sub_scores") or {},
        "ingredient_gis_adjustment": float(base.get("ingredient_gis_adjustment", 0) or 0),
        "ingredient_gis_reasons": list(base.get("ingredient_gis_reasons") or []),
    }


async def build_image() -> str | None:
    return await generate_food_image(
        title=MEAL_TITLE,
        description="Three crispy corn tacos with taco-spiced chicken thighs, melted Mexican cheese, and fresh pico de gallo on a clean plate.",
        force=True,
    )


def main() -> None:
    init_db()
    image_url = asyncio.run(build_image())
    db = SessionLocal()
    try:
        pico = db.query(Recipe).filter(Recipe.title == PICO_TITLE).first()
        if pico is None:
            pico = build_pico()
            db.add(pico)
            db.flush()

        meal = db.query(Recipe).filter(Recipe.title == MEAL_TITLE).first()
        if meal is None:
            meal = build_meal(str(pico.id), image_url)
            db.add(meal)
        else:
            updated = build_meal(str(pico.id), image_url or meal.image_url)
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
                "component_composition",
                "needs_default_pairing",
                "is_mes_scoreable",
                "glycemic_profile",
            ]:
                setattr(meal, field, getattr(updated, field))

        apply_mes_fields(meal)
        db.commit()
        print(f"Upserted meal: {meal.title} ({meal.id})")
        print(f"Upserted pico: {pico.title} ({pico.id})")
        print(f"Image URL: {meal.image_url}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
