#!/usr/bin/env python3
from __future__ import annotations

import uuid

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe


MEAL_TITLE = "Sweet and Sour Beef Rice Noodles"
SIDE_TITLE = "Ginger Garlic Broccoli"


def build_side() -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=SIDE_TITLE,
        description="Quick broccoli sauteed with garlic, ginger, and a splash of acid for a simple veggie side that pairs naturally with savory stir-fries.",
        ingredients=[
            {"name": "broccoli florets", "quantity": "3", "unit": "cups", "category": "produce"},
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
            {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"},
            {"name": "ginger, grated", "quantity": "1", "unit": "tsp", "category": "produce"},
            {"name": "rice vinegar or lemon juice", "quantity": "1", "unit": "tsp", "category": "produce"},
            {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
        ],
        steps=[
            "Heat the olive oil in a skillet over medium heat.",
            "Add the broccoli with a small splash of water and cook for 4 to 5 minutes, until bright green and just tender.",
            "Stir in the garlic and ginger and cook for 30 seconds, just until fragrant.",
            "Turn off the heat, add the vinegar or lemon juice, and season with salt and black pepper.",
        ],
        prep_time_min=8,
        cook_time_min=6,
        total_time_min=14,
        servings=2,
        nutrition_info={
            "calories": 50.0,
            "protein": 2.8,
            "carbs": 7.7,
            "fat": 2.4,
            "fiber": 2.6,
            "sugar": 1.7,
        },
        difficulty="easy",
        tags=["side", "quick", "vegetables"],
        flavor_profile=["savory", "gingery", "bright"],
        dietary_tags=["dairy-free", "gluten-free"],
        cuisine="asian-inspired",
        health_benefits=["gut_health", "blood_sugar", "heart_health"],
        protein_type=[],
        carb_type=[],
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
    )


def build_meal(side_id: str) -> Recipe:
    return Recipe(
        id=str(uuid.uuid4()),
        title=MEAL_TITLE,
        description="Savory 90/10 beef, rice noodles, onion, and bell pepper tossed in a simple sweet-and-sour sauce made with coconut aminos, tomato paste, apple cider vinegar, garlic, and honey.",
        ingredients=[
            {"name": "dry rice noodles", "quantity": "85", "unit": "g", "category": "grains"},
            {"name": "salt", "quantity": "for boiling water", "unit": "", "category": "spices"},
            {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"},
            {"name": "90/10 ground beef", "quantity": "1", "unit": "lb", "category": "protein"},
            {"name": "onion, chopped", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "bell pepper, sliced", "quantity": "1", "unit": "medium", "category": "produce"},
            {"name": "chili powder", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"},
            {"name": "coconut aminos", "quantity": "2", "unit": "tbsp", "category": "sauces"},
            {"name": "tomato paste", "quantity": "2", "unit": "tbsp", "category": "produce"},
            {"name": "honey", "quantity": "1", "unit": "tbsp", "category": "sweeteners"},
            {"name": "apple cider vinegar", "quantity": "1", "unit": "tbsp", "category": "produce"},
            {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"},
            {"name": "water", "quantity": "2 to 3", "unit": "tbsp", "category": "other"},
        ],
        steps=[
            "Bring a pot of salted water to a boil and cook the rice noodles until tender. Drain and set aside.",
            "In a small bowl, stir together the coconut aminos, tomato paste, honey, apple cider vinegar, garlic, and a splash of water until smooth.",
            "Heat the olive oil in a large skillet over medium heat. Add the onion and bell pepper and cook for 2 to 3 minutes, until they start to soften.",
            "Add the ground beef, chili powder, and black pepper. Cook for 6 to 8 minutes, breaking it up as it browns, until the beef is fully cooked and the vegetables are tender.",
            "Pour in the sauce and stir well. Let it bubble for 1 to 2 minutes so it thickens slightly.",
            "Add the cooked rice noodles and toss until everything is evenly coated.",
            "Serve hot. Eat the ginger garlic broccoli before or alongside the noodles.",
        ],
        prep_time_min=10,
        cook_time_min=15,
        total_time_min=25,
        servings=2,
        nutrition_info={
            "calories": 669.5,
            "protein": 50.3,
            "carbs": 58.8,
            "fat": 24.8,
            "fiber": 3.5,
            "sugar": 15.0,
        },
        difficulty="easy",
        tags=["dinner", "quick", "stovetop"],
        flavor_profile=["sweet-savory", "tangy", "gingery"],
        dietary_tags=["dairy-free"],
        cuisine="asian-inspired",
        health_benefits=["muscle_recovery", "satiety", "blood_sugar"],
        protein_type=["beef"],
        carb_type=["rice_noodles"],
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
