import os
import sys
import unittest
from pathlib import Path

from sqlalchemy.orm import close_all_sessions

TEST_DB_PATH = Path(__file__).with_name("test_recipe_detail_composition.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.db import Base, SessionLocal
from app.models import (  # noqa: F401
    chat_usage,
    fuel,
    gamification,
    grocery,
    local_food,
    meal_plan,
    metabolic,
    metabolic_profile,
    notification,
    nutrition,
    product_label_scan,
    recipe as recipe_model,
    recipe_embedding,
    saved_recipe,
    scanned_meal,
    user,
)
from app.models.recipe import Recipe
from app.routers.recipes import _serialize_recipe_full


class RecipeDetailCompositionTests(unittest.TestCase):
    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    def tearDown(self) -> None:
        close_all_sessions()

    def _db(self):
        return SessionLocal()

    def test_default_pairings_do_not_appear_as_components(self) -> None:
        db = self._db()
        try:
            slaw = Recipe(
                id="slaw-1",
                title="Cilantro Lime Cabbage Slaw",
                recipe_role="veg_side",
                is_component=True,
                ingredients=[{"name": "cabbage", "quantity": "1", "unit": "cup"}],
                steps=["Mix slaw."],
            )
            bowl = Recipe(
                id="bowl-1",
                title="Smoky Tomato Chicken Burrito Bowl",
                recipe_role="full_meal",
                is_component=False,
                needs_default_pairing=True,
                default_pairing_ids=["slaw-1"],
                ingredients=[{"name": "chicken", "quantity": "1", "unit": "serving"}],
                steps=["Build the bowl."],
            )
            db.add_all([slaw, bowl])
            db.commit()

            payload = _serialize_recipe_full(bowl, db=db)

            self.assertNotIn("components", payload)
            self.assertEqual([item["title"] for item in payload["default_pairings"]], ["Cilantro Lime Cabbage Slaw"])
        finally:
            db.close()

    def test_component_composition_resolves_real_components_in_order(self) -> None:
        db = self._db()
        try:
            protein = Recipe(
                id="protein-1",
                title="Smoky Burrito Chicken",
                recipe_role="protein_base",
                is_component=True,
                ingredients=[{"name": "chicken", "quantity": "1", "unit": "lb"}],
                steps=["Cook chicken."],
            )
            carb = Recipe(
                id="carb-1",
                title="Tomato Brown Rice",
                recipe_role="carb_base",
                is_component=True,
                ingredients=[{"name": "rice", "quantity": "1", "unit": "cup"}],
                steps=["Cook rice."],
            )
            slaw = Recipe(
                id="slaw-1",
                title="Cilantro Lime Cabbage Slaw",
                recipe_role="veg_side",
                is_component=True,
                ingredients=[{"name": "cabbage", "quantity": "1", "unit": "cup"}],
                steps=["Mix slaw."],
            )
            bowl = Recipe(
                id="bowl-1",
                title="Smoky Tomato Chicken Burrito Bowl",
                recipe_role="full_meal",
                is_component=False,
                needs_default_pairing=True,
                default_pairing_ids=["slaw-1"],
                component_composition={
                    "protein_component_title": "Smoky Burrito Chicken",
                    "carb_component_title": "Tomato Brown Rice",
                    "default_pairing_title": "Cilantro Lime Cabbage Slaw",
                    "component_titles": ["Smoky Burrito Chicken", "Tomato Brown Rice"],
                },
                ingredients=[{"name": "bowl", "quantity": "1", "unit": "serving"}],
                steps=["Assemble bowl."],
            )
            db.add_all([protein, carb, slaw, bowl])
            db.commit()

            payload = _serialize_recipe_full(bowl, db=db)

            self.assertEqual(
                [item["title"] for item in payload["components"]],
                ["Smoky Burrito Chicken", "Tomato Brown Rice"],
            )
            self.assertEqual(
                [item["title"] for item in payload["default_pairings"]],
                ["Cilantro Lime Cabbage Slaw"],
            )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
