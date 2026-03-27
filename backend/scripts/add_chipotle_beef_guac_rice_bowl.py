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


MEAL_TITLE = "Chipotle Beef & Guac Rice Bowl"
PROTEIN_TITLE = "Chipotle Ground Beef"
GUAC_TITLE = "Tomato Guacamole"
EXISTING_RICE_ID = "edce49c5-21b3-4915-9e75-e9c381ed32fd"
PAIRING_TITLE = "Cilantro Lime Cabbage Slaw"
IMAGE_URL = "/static/meal-images/32b4f5fec3a5.png"

# Shared meal_group_id links the components to the full meal
MEAL_GROUP_ID = "chipotle-beef-guac-rice-bowl"


def build_protein_component() -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=PROTEIN_TITLE,
        description="Crusty, chipotle-seasoned ground beef with softened onions. Meal-prep friendly — makes 4 servings.",
        ingredients=[
            {"name": "90/10 ground beef", "quantity": "2", "unit": "lbs", "category": "protein"},
            {"name": "onion, chopped", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "salt", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "garlic powder", "quantity": "2", "unit": "tsp", "category": "spices"},
            {"name": "chipotle powder", "quantity": "2", "unit": "tsp", "category": "spices"},
            {"name": "cumin", "quantity": "2", "unit": "tsp", "category": "spices"},
            {"name": "cayenne pepper", "quantity": "1/2", "unit": "tsp", "category": "spices"},
            {"name": "oregano", "quantity": "1", "unit": "tsp", "category": "spices"},
        ],
        steps=[
            "Heat a skillet over medium-high heat. Add the ground beef and press it flat into the pan. Let it sit untouched for 3-4 minutes until a deep golden crust forms on the bottom.",
            "Flip the whole slab and let the other side crust up for another 2-3 minutes.",
            "Break the beef apart. Season with salt, garlic powder, chipotle, cumin, cayenne, and oregano. Stir to coat evenly.",
            "Add the chopped onions and cook for 2-3 minutes until softened. Store in airtight containers for up to 4 days.",
        ],
        prep_time_min=5,
        cook_time_min=12,
        total_time_min=17,
        servings=4,
        nutrition_info={
            "calories": 321.0,
            "protein": 38.0,
            "carbs": 3.0,
            "fat": 16.0,
            "fiber": 0.5,
            "sugar": 1.0,
        },
        difficulty="easy",
        tags=["meal_prep", "protein", "stovetop"],
        flavor_profile=["smoky", "spiced", "savory"],
        dietary_tags=["gluten-free", "dairy-free"],
        cuisine="mexican-inspired",
        health_benefits=["muscle_recovery", "satiety"],
        protein_type=["beef"],
        carb_type=[],
        is_ai_generated=False,
        recipe_role="protein_base",
        is_component=True,
        meal_group_id=MEAL_GROUP_ID,
        is_mes_scoreable=False,
    )


def build_guac_component() -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=GUAC_TITLE,
        description="Fresh chunky guacamole with diced tomato, jalapeño, lime, and cilantro. High fiber, high healthy fat.",
        ingredients=[
            {"name": "ripe avocados", "quantity": "4", "unit": "medium", "category": "produce"},
            {"name": "tomato, diced", "quantity": "2", "unit": "medium", "category": "produce"},
            {"name": "jalapeño, minced", "quantity": "1", "unit": "small", "category": "produce"},
            {"name": "lime juice", "quantity": "2", "unit": "tbsp", "category": "produce"},
            {"name": "fresh cilantro, chopped", "quantity": "3", "unit": "tbsp", "category": "produce"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
        ],
        steps=[
            "Halve the avocados and scoop into a bowl. Mash to your preferred texture — chunky works best.",
            "Fold in the diced tomato, jalapeño, lime juice, cilantro, and salt.",
            "Store with plastic wrap pressed directly on the surface to prevent browning. Best within 2 days.",
        ],
        prep_time_min=8,
        cook_time_min=0,
        total_time_min=8,
        servings=4,
        nutrition_info={
            "calories": 256.0,
            "protein": 3.0,
            "carbs": 17.0,
            "fat": 22.0,
            "fiber": 11.0,
            "sugar": 2.0,
        },
        difficulty="easy",
        tags=["meal_prep", "veggie", "no_cook"],
        flavor_profile=["fresh", "creamy", "bright"],
        dietary_tags=["gluten-free", "dairy-free", "vegan"],
        cuisine="mexican-inspired",
        health_benefits=["heart_health", "fiber_rich", "healthy_fats"],
        protein_type=[],
        carb_type=[],
        is_ai_generated=False,
        recipe_role="veg_side",
        is_component=True,
        meal_group_id=MEAL_GROUP_ID,
        is_mes_scoreable=False,
        pairing_synergy_profile={
            "fiber_class": "high",
            "acid": True,
            "healthy_fat": True,
            "veg_density": "medium",
            "recommended_timing": "with_meal",
        },
    )


def build_meal(protein_id: str, guac_id: str, pairing_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Crispy-crusted chipotle-seasoned ground beef over white rice, topped with fresh tomato guacamole, shredded cheese, and sour cream.",
        ingredients=[
            {"name": "Chipotle Ground Beef", "quantity": "1", "unit": "serving", "category": "protein"},
            {"name": "White Rice", "quantity": "1", "unit": "cup", "category": "carbs"},
            {"name": "Tomato Guacamole", "quantity": "1", "unit": "serving", "category": "produce"},
            {"name": "shredded cheddar cheese", "quantity": "1/4", "unit": "cup", "category": "dairy"},
            {"name": "sour cream", "quantity": "2", "unit": "tbsp", "category": "dairy"},
        ],
        steps=[
            "Warm the Chipotle Ground Beef and White Rice — microwave or stovetop both work.",
            "Scoop rice into a bowl. Top with the seasoned beef.",
            "Add a generous portion of Tomato Guacamole.",
            "Finish with shredded cheese and a dollop of sour cream. If using the default pairing, have the Cilantro Lime Cabbage Slaw alongside or before the bowl.",
        ],
        prep_time_min=5,
        cook_time_min=3,
        total_time_min=8,
        servings=1,
        nutrition_info={
            "calories": 960.0,
            "protein": 53.0,
            "carbs": 67.0,
            "fat": 54.0,
            "fiber": 12.0,
            "sugar": 4.0,
        },
        image_url=IMAGE_URL,
        difficulty="easy",
        tags=["dinner", "lunch", "high_protein", "meal_prep", "bowl"],
        flavor_profile=["smoky", "savory", "creamy", "spiced"],
        dietary_tags=["gluten-free"],
        cuisine="mexican-inspired",
        health_benefits=["muscle_recovery", "satiety", "fiber_rich", "healthy_fats"],
        protein_type=["beef"],
        carb_type=["white_rice"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        meal_group_id=MEAL_GROUP_ID,
        default_pairing_ids=[pairing_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
        component_composition={
            "protein_base": protein_id,
            "carb_base": EXISTING_RICE_ID,
            "veg_side": guac_id,
        },
        glycemic_profile={
            "primary_carb_source": "white_rice",
            "processing_level": "minimally_processed",
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


def upsert(db, title: str, builder, *args) -> Recipe:
    existing = db.query(Recipe).filter(Recipe.title == title).first()
    if existing is None:
        record = builder(*args)
        db.add(record)
        return record
    else:
        updated = builder(*args)
        for col in Recipe.__table__.columns:
            if col.name not in ("id", "created_at"):
                val = getattr(updated, col.name)
                if val is not None:
                    setattr(existing, col.name, val)
        return existing


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        # Look up existing pairing
        pairing = db.query(Recipe).filter(Recipe.title == PAIRING_TITLE).first()
        if pairing is None:
            raise RuntimeError(f"Required default pairing not found: {PAIRING_TITLE}")

        # Upsert components
        protein = upsert(db, PROTEIN_TITLE, build_protein_component)
        guac = upsert(db, GUAC_TITLE, build_guac_component)
        db.flush()

        # Upsert full meal
        meal = upsert(db, MEAL_TITLE, build_meal, str(protein.id), str(guac.id), str(pairing.id))
        db.flush()

        # Compute MES
        apply_mes_fields(meal, pairing)

        db.commit()

        print(f"Upserted protein component: {protein.title} ({protein.id})")
        print(f"Upserted guac component: {guac.title} ({guac.id})")
        print(f"Reused carb component: White Rice ({EXISTING_RICE_ID})")
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
