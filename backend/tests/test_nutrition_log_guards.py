"""POST /nutrition/logs guards: dedup by meal_type, input bounds, dessert scoring.

2026-07-11 scoring-integrity fixes:
- B1: dessert recipes are fuel-scored from real ingredients, not vetted-100
- B4: the 30s dedup guard must respect meal_type (same recipe logged as
  lunch AND dinner within 30s is legitimate)
- B5: servings/quantity bounded to (0, 20]; long titles truncated to 200
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_nutrition_log_guards.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient

from app.auth import create_token_pair, get_password_hash
from app.db import Base, SessionLocal
from app.main import app
from app.models import (  # noqa: F401
    gamification,
    grocery,
    local_food,
    meal_plan,
    metabolic,
    metabolic_profile,
    notification,
    nutrition,
    recipe,
    recipe_embedding,
    saved_recipe,
    scanned_meal,
)
from app.models.recipe import Recipe
from app.models.user import User


class NutritionLogGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        self.headers = {"Authorization": f"Bearer {self._token()}"}

    def _token(self) -> str:
        db = SessionLocal()
        try:
            user = User(
                email="guards@example.com",
                name="Guards",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return create_token_pair(str(user.id))["access_token"]
        finally:
            db.close()

    def _seed_recipe(self, **overrides) -> str:
        db = SessionLocal()
        try:
            fields = {
                "title": "Grilled Chicken Plate",
                "ingredients": [
                    {"name": "chicken breast", "quantity": "1", "unit": "pound"},
                    {"name": "broccoli", "quantity": "2", "unit": "cups"},
                ],
                "nutrition_info": {"calories": 400, "protein": 40, "carbs": 20, "fat": 12},
                "recipe_role": "full_meal",
            }
            fields.update(overrides)
            r = Recipe(**fields)
            db.add(r)
            db.commit()
            db.refresh(r)
            return str(r.id)
        finally:
            db.close()

    def _log(self, **overrides):
        payload = {"source_type": "recipe", "meal_type": "lunch"}
        payload.update(overrides)
        return self.client.post("/api/nutrition/logs", headers=self.headers, json=payload)

    # ── B4: dedup respects meal_type ──────────────────────────────────

    def test_dedup_blocks_same_meal_type_within_30s(self) -> None:
        recipe_id = self._seed_recipe()
        first = self._log(source_id=recipe_id, meal_type="lunch")
        self.assertEqual(first.status_code, 200, first.text)
        second = self._log(source_id=recipe_id, meal_type="lunch")
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json()["id"], second.json()["id"], "duplicate lunch log was not deduped")

    def test_dedup_allows_same_recipe_different_meal_type(self) -> None:
        recipe_id = self._seed_recipe()
        lunch = self._log(source_id=recipe_id, meal_type="lunch")
        dinner = self._log(source_id=recipe_id, meal_type="dinner")
        self.assertEqual(lunch.status_code, 200, lunch.text)
        self.assertEqual(dinner.status_code, 200, dinner.text)
        self.assertNotEqual(lunch.json()["id"], dinner.json()["id"], "dinner log was wrongly deduped against lunch")

    # ── B5: input bounds ──────────────────────────────────────────────

    def test_servings_over_20_rejected(self) -> None:
        recipe_id = self._seed_recipe()
        resp = self._log(source_id=recipe_id, servings=25)
        self.assertEqual(resp.status_code, 422, resp.text)

    def test_quantity_zero_rejected(self) -> None:
        recipe_id = self._seed_recipe()
        resp = self._log(source_id=recipe_id, quantity=0)
        self.assertEqual(resp.status_code, 422, resp.text)

    def test_long_title_truncated_to_200(self) -> None:
        resp = self._log(
            source_type="manual",
            meal_type="lunch",
            title="x" * 500,
            nutrition={"calories": 300, "protein_g": 20, "carbs_g": 30, "fat_g": 10},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(len(resp.json()["title"]), 200)

    # ── B1: dessert recipes score from real ingredients ───────────────

    def test_dessert_recipe_log_not_vetted_100(self) -> None:
        dessert_id = self._seed_recipe(
            title="Chocolate Chip Cookies",
            recipe_role="dessert",
            ingredients=[
                {"name": "cassava flour", "quantity": "1", "unit": "cup"},
                {"name": "sugar", "quantity": "0.5", "unit": "cup"},
                {"name": "butter", "quantity": "4", "unit": "tablespoons"},
                {"name": "chocolate chips", "quantity": "0.5", "unit": "cup"},
            ],
        )
        resp = self._log(source_id=dessert_id, meal_type="dessert")
        self.assertEqual(resp.status_code, 200, resp.text)
        fuel = resp.json()["fuel_score"]
        self.assertIsNotNone(fuel)
        self.assertLess(fuel, 100.0, "sugary dessert recipe still got the vetted-100 shortcut")

    def test_full_meal_recipe_log_keeps_100(self) -> None:
        recipe_id = self._seed_recipe()
        resp = self._log(source_id=recipe_id, meal_type="dinner")
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(float(resp.json()["fuel_score"]), 100.0)


if __name__ == "__main__":
    unittest.main()
