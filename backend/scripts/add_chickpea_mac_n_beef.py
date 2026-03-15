#!/usr/bin/env python3
from __future__ import annotations

import uuid

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe


MEAL_TITLE = "Chickpea Mac N' Beef"
SIDE_TITLE = "Lemon Garlic Zucchini and Mushrooms"


def build_side() -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=SIDE_TITLE,
        description="Simple zucchini and mushrooms sauteed with garlic, olive oil, and lemon as a savory veggie side.",
        ingredients=[
            {"name": "zucchini, diced", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "mushrooms, sliced", "quantity": "1", "unit": "cup", "category": "produce"},
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
            {"name": "garlic, minced", "quantity": "1", "unit": "clove", "category": "produce"},
            {"name": "lemon juice", "quantity": "2", "unit": "tsp", "category": "produce"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
        ],
        steps=[
            "Heat the olive oil in a skillet over medium heat.",
            "Add the mushrooms and zucchini with a pinch of salt and cook for 5 to 7 minutes, until tender and lightly golden.",
            "Stir in the garlic and cook for 30 seconds, just until fragrant.",
            "Turn off the heat, add the lemon juice, and finish with black pepper. Serve warm.",
        ],
        prep_time_min=10,
        cook_time_min=8,
        total_time_min=18,
        servings=2,
        nutrition_info={
            "calories": 46.0,
            "protein": 1.8,
            "carbs": 5.0,
            "fat": 2.6,
            "fiber": 1.6,
            "sugar": 2.6,
        },
        difficulty="easy",
        tags=["dinner", "side", "quick"],
        flavor_profile=["savory", "bright", "garlicky"],
        dietary_tags=["dairy-free", "gluten-free"],
        cuisine="american",
        health_benefits=["gut_health", "blood_sugar", "heart_health"],
        protein_type=[],
        carb_type=[],
        is_ai_generated=False,
        recipe_role="veg_side",
        is_component=False,
        needs_default_pairing=False,
        is_mes_scoreable=False,
        pairing_synergy_profile={
            "fiber_class": "low",
            "acid": True,
            "healthy_fat": True,
            "veg_density": "high",
            "recommended_timing": "before_meal",
        },
    )


def build_meal(side_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="A one-pan beef and chickpea pasta skillet simmered in crushed tomatoes with onion, garlic, and paprika for a high-protein comfort meal.",
        ingredients=[
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
            {"name": "onion, chopped", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "90/10 ground beef", "quantity": "1", "unit": "lb", "category": "protein"},
            {"name": "garlic powder", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "paprika", "quantity": "1", "unit": "tsp", "category": "spices"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "crushed tomatoes", "quantity": "1", "unit": "cup", "category": "produce"},
            {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"},
            {"name": "dry chickpea pasta", "quantity": "85", "unit": "g", "category": "grains"},
            {"name": "spinach, chopped (optional)", "quantity": "to taste", "unit": "", "category": "produce"},
        ],
        steps=[
            "Warm the olive oil in a large skillet or saute pan over medium heat. Add the chopped onion and cook for 2 to 3 minutes until it starts to soften.",
            "Add the 90/10 ground beef, garlic powder, paprika, salt, and black pepper. Cook for 6 to 8 minutes, breaking it up as it browns, until the beef is fully cooked and lightly browned.",
            "Stir in the crushed tomatoes, water or broth, and dry chickpea pasta. Mix well and bring everything to a gentle boil.",
            "Lower the heat, cover, and simmer for about 18 to 20 minutes, stirring once or twice, until the pasta is tender and the sauce has thickened.",
            "If you want extra greens, stir in chopped spinach at the end and let it wilt for 1 to 2 minutes.",
            "Serve hot. Eat the lemon garlic zucchini and mushrooms before or with the skillet.",
        ],
        prep_time_min=10,
        cook_time_min=20,
        total_time_min=30,
        servings=2,
        nutrition_info={
            "calories": 507.2,
            "protein": 43.8,
            "carbs": 36.7,
            "fat": 21.1,
            "fiber": 6.2,
            "sugar": 5.6,
        },
        difficulty="easy",
        tags=["dinner", "quick", "one_pan"],
        flavor_profile=["savory", "tomato-forward", "comforting"],
        dietary_tags=["dairy-free"],
        cuisine="american",
        health_benefits=["muscle_recovery", "gut_health", "blood_sugar"],
        protein_type=["beef"],
        carb_type=["chickpea_pasta"],
        is_ai_generated=False,
        recipe_role="full_meal",
        is_component=False,
        default_pairing_ids=[side_id],
        needs_default_pairing=True,
        is_mes_scoreable=True,
    )


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing_titles = {
            title for (title,) in db.query(Recipe.title).filter(Recipe.title.in_([MEAL_TITLE, SIDE_TITLE])).all()
        }
        if MEAL_TITLE in existing_titles or SIDE_TITLE in existing_titles:
            print("Meal or side already exists. No changes made.")
            return

        side = build_side()
        meal = build_meal(str(side.id))
        db.add(side)
        db.add(meal)
        db.commit()
        print(f"Added meal: {meal.title} ({meal.id})")
        print(f"Added side: {side.title} ({side.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
