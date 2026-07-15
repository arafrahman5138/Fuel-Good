"""Personalization guards (2026-07-11):

- QA F1: /nutrition/gaps suggestions respect the user's dietary preferences —
  vegetarians must never be offered chicken/fish staples or meat recipes.
- QA F4: /recipes/browse orders photo-backed recipes first by default.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_gaps_and_browse_personalization.sqlite3")
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

MEAT_FISH_KEYWORDS = (
    "chicken", "beef", "pork", "turkey", "lamb", "fish", "salmon", "shrimp",
    "tuna", "sardine", "bacon", "steak",
)


class GapsDietaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        db = SessionLocal()
        try:
            # A meaty and a vegetarian high-protein recipe for the meal pool.
            db.add(Recipe(
                title="Grilled Chicken Power Bowl",
                ingredients=[{"name": "chicken breast"}, {"name": "rice"}],
                nutrition_info={"calories": 500, "protein": 45},
                health_benefits=["high-protein"],
                recipe_role="full_meal",
            ))
            db.add(Recipe(
                title="Lentil Protein Bowl",
                ingredients=[{"name": "lentils"}, {"name": "spinach"}],
                nutrition_info={"calories": 450, "protein": 24},
                health_benefits=["high-protein"],
                recipe_role="full_meal",
            ))
            db.commit()
        finally:
            db.close()

    def _make_user(self, email: str, dietary: list[str]) -> dict:
        db = SessionLocal()
        try:
            user = User(
                email=email,
                name="Gaps Tester",
                hashed_password=get_password_hash("Pass1234!"),
                dietary_preferences=dietary,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            token = create_token_pair(str(user.id))["access_token"]
            return {"Authorization": f"Bearer {token}"}
        finally:
            db.close()

    def _gap_suggestion_names(self, headers: dict) -> list[str]:
        resp = self.client.get("/api/nutrition/gaps", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        names = [s.get("name") or s.get("title") or "" for s in body["suggestions"]]
        names += [m.get("title") or "" for m in body["recommended_meals"]]
        names += [f.get("name") or "" for f in body["recommended_foods"]]
        return names

    def test_vegetarian_gets_no_meat_or_fish_suggestions(self) -> None:
        headers = self._make_user("veggie@example.com", ["vegetarian"])
        names = self._gap_suggestion_names(headers)
        self.assertTrue(names, "gaps should still produce suggestions for vegetarians")
        for name in names:
            for kw in MEAT_FISH_KEYWORDS:
                self.assertNotIn(
                    kw, name.lower(),
                    f"vegetarian user was offered {name!r}",
                )

    def test_metabolic_meal_suggestions_respect_dietary(self) -> None:
        # F1-extension: /api/metabolic/meal-suggestions (premium) must filter
        # its candidate pool the same way.
        db = SessionLocal()
        try:
            user = User(
                email="veg-premium@example.com",
                name="Veg Premium",
                hashed_password=get_password_hash("Pass1234!"),
                dietary_preferences=["vegetarian"],
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            headers = {"Authorization": f"Bearer {create_token_pair(str(user.id))['access_token']}"}
        finally:
            db.close()

        resp = self.client.get("/api/metabolic/meal-suggestions", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        for item in resp.json():
            self.assertNotIn(
                "chicken", (item["title"] or "").lower(),
                "vegetarian user was suggested a chicken recipe",
            )

    def test_omnivore_suggestions_differ_from_vegetarian(self) -> None:
        omni = self._gap_suggestion_names(self._make_user("omni@example.com", []))
        veg = self._gap_suggestion_names(self._make_user("veg2@example.com", ["vegetarian"]))
        # QA F1 repro was byte-identical suggestions for all users.
        self.assertNotEqual(omni, veg, "suggestions must be personalized by dietary prefs")
        self.assertTrue(any("chicken" in n.lower() for n in omni),
                        "omnivore with a protein gap should still see chicken staples")


class BrowsePhotoFirstTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        db = SessionLocal()
        try:
            db.add(Recipe(title="No Photo Soup", ingredients=[], nutrition_info={}, image_url=None))
            db.add(Recipe(title="Photo Salad", ingredients=[], nutrition_info={}, image_url="https://img/salad.jpg"))
            db.add(Recipe(title="Empty String Stew", ingredients=[], nutrition_info={}, image_url=""))
            db.add(Recipe(title="Photo Curry", ingredients=[], nutrition_info={}, image_url="https://img/curry.jpg"))
            user = User(
                email="browse@example.com",
                name="Browse Tester",
                hashed_password=get_password_hash("Pass1234!"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            self.headers = {"Authorization": f"Bearer {create_token_pair(str(user.id))['access_token']}"}
        finally:
            db.close()

    def test_browse_orders_photo_recipes_first(self) -> None:
        resp = self.client.get("/api/recipes/browse", headers=self.headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        items = resp.json()["items"]
        self.assertEqual(len(items), 4)
        has_photo = [bool(item.get("image_url")) for item in items]
        self.assertEqual(
            has_photo, sorted(has_photo, reverse=True),
            f"photo-backed recipes must come first, got order: {[i['title'] for i in items]}",
        )
        self.assertTrue(has_photo[0] and has_photo[1], "both photo recipes lead the list")


if __name__ == "__main__":
    unittest.main()
