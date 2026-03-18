#!/usr/bin/env python3
from __future__ import annotations

import uuid

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe


MEAL_TITLE = "Beef Kebab Rice Plate"
PAIRING_TITLE = "Cucumber Tomato Herb Salad"


def build_meal(pairing_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Warm-spiced beef kebab-style strips served over turmeric-garlic brown rice with softened cherry tomatoes.",
        ingredients=[
            {"name": "dry brown rice", "quantity": "1/2", "unit": "cup", "category": "grains"},
            {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "turmeric", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "garlic powder", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "90/10 ground beef", "quantity": "1", "unit": "lb", "category": "protein"},
            {"name": "onion, finely chopped", "quantity": "1", "unit": "small", "category": "produce"},
            {"name": "garlic, minced", "quantity": "1", "unit": "tbsp", "category": "produce"},
            {"name": "whole egg", "quantity": "1", "unit": "", "category": "protein"},
            {"name": "paprika", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "cherry tomatoes", "quantity": "2", "unit": "cups", "category": "produce"},
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
        ],
        steps=[
            "Add the brown rice and water or broth to a pot with salt, turmeric, and garlic powder. Bring it to a boil, then cover and simmer on low until the rice is tender and the liquid is absorbed.",
            "In a bowl, mix the ground beef with the onion, garlic, egg, paprika, turmeric, salt, and black pepper until fully combined.",
            "Heat the olive oil in a skillet over medium heat. Press the beef mixture into the pan in one even layer and cook until the bottom browns.",
            "Flip or break the beef into large sections, add the cherry tomatoes, cover, and cook until the beef is fully cooked and the tomatoes soften.",
            "Slice or break the beef into kebab-style strips and serve over the rice with the tomatoes.",
            "If using the default pairing, have the cucumber tomato herb salad before or alongside the plate.",
        ],
        prep_time_min=10,
        cook_time_min=20,
        total_time_min=30,
        servings=2,
        nutrition_info={
            "calories": 662.5,
            "protein": 54.3,
            "carbs": 44.5,
            "fat": 28.0,
            "fiber": 4.3,
            "sugar": 4.9,
        },
        difficulty="easy",
        tags=["dinner", "stovetop", "high_protein"],
        flavor_profile=["savory", "warm-spiced", "garlicky"],
        dietary_tags=["dairy-free"],
        cuisine="middle_eastern-inspired",
        health_benefits=["muscle_recovery", "satiety", "blood_sugar"],
        protein_type=["beef"],
        carb_type=["brown_rice"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        default_pairing_ids=[pairing_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
    )


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(Recipe).filter(Recipe.title == MEAL_TITLE).first()
        if existing is not None:
            print("Meal already exists. No changes made.")
            return

        pairing = db.query(Recipe).filter(Recipe.title == PAIRING_TITLE).first()
        if pairing is None:
            raise RuntimeError(f"Required default pairing not found: {PAIRING_TITLE}")

        meal = build_meal(str(pairing.id))
        db.add(meal)
        db.commit()
        print(f"Added meal: {meal.title} ({meal.id})")
        print(f"Linked default pairing: {pairing.title} ({pairing.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
