"""Regression: the ingredient-overlap cache must return the SAME fuel score
as the fresh scan it was cached from.

Scan QA 2026-07-10 found an identical thali image scoring 40 fresh and 70 on
the cache hit, because `_check_ingredient_cache` rebuilt the result with
`components: []` and the router recomputed the fuel score from bare
ingredient names (losing nova/methods/mass_fraction). Components are now
persisted on ScannedMealLog and returned verbatim on cache hits.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

TEST_DB_PATH = Path(__file__).with_name("test_scan_cache_consistency.sqlite3")
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
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.services import scan_cache


def _fake_jpeg_bytes(seed: bytes) -> bytes:
    # Valid JPEG magic prefix, unique tail so the image-hash LRU cache misses.
    return b"\xff\xd8\xff\xe0" + seed * 32


# Rich extraction with NOVA-4 components and a fried method — the exact kind
# of detail that was lost when the cache synthesized components from names.
_EXTRACTION = {
    "scan_type": "meal",
    "not_food": False,
    "is_beverage": False,
    "meal_label": "Hot Dogs and Ramen",
    "portion_size": "medium",
    "source_context_guess": "home",
    "meal_type_guess": "dinner",
    "preparation_style": "boiled",
    "components": [
        {
            "name": "instant ramen noodles",
            "role": "carb",
            "mass_fraction": 0.5,
            "nova": 4,
            "methods": ["fried"],
            "visible": True,
            "confidence": 0.95,
            "portion_factor": 1.0,
        },
        {
            "name": "hot dog",
            "role": "protein",
            "mass_fraction": 0.35,
            "nova": 4,
            "methods": ["boiled"],
            "visible": True,
            "confidence": 0.95,
            "portion_factor": 1.0,
        },
        {
            "name": "scallions",
            "role": "veg",
            "mass_fraction": 0.15,
            "nova": 1,
            "methods": ["raw"],
            "visible": True,
            "confidence": 0.9,
            "portion_factor": 1.0,
        },
    ],
    "possible_hidden_ingredients": [],
    "multi_dish": False,
    "dishes": [],
    "nutrition_estimate": {"calories": 610, "protein": 18, "carbs": 62, "fat": 30, "fiber": 3, "sugar_g": 5},
    "confidence": 0.9,
}


class ScanCacheConsistencyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        scan_cache.clear_all()

    def _create_user(self) -> User:
        db = SessionLocal()
        try:
            user = User(
                email="cache@example.com",
                name="Cache",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    def _post(self, token: str, image_seed: bytes) -> dict:
        response = self.client.post(
            "/api/scan/smart",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("food.jpg", _fake_jpeg_bytes(image_seed), "image/jpeg")},
            data={"source_context": "home"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_cache_hit_returns_same_fuel_score_and_components(self) -> None:
        user = self._create_user()
        tokens = create_token_pair(str(user.id))

        with patch(
            "app.services.meal_scan._call_gemini_meal_extractor",
            new=AsyncMock(return_value=dict(_EXTRACTION)),
        ), patch(
            "app.services.meal_scan.settings.usda_grounding_enabled", False,
        ), patch(
            "app.services.meal_scan.settings.hidden_ingredient_model_enabled", False,
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            fresh = self._post(tokens["access_token"], b"a")
            cached = self._post(tokens["access_token"], b"b")

        fresh_meal = fresh["meal"]
        cached_meal = cached["meal"]

        # Second scan must have come from the ingredient-overlap cache.
        self.assertTrue(
            str(cached_meal.get("source_model", "")).endswith("+cached"),
            f"expected cache hit, got source_model={cached_meal.get('source_model')}",
        )

        # The whole point: identical food → identical score.
        self.assertIsNotNone(fresh_meal["fuel_score"])
        self.assertEqual(fresh_meal["fuel_score"], cached_meal["fuel_score"])

        # Components survive persistence and the cache round-trip.
        self.assertTrue(fresh_meal["components"])
        self.assertTrue(cached_meal["components"])
        self.assertEqual(
            [c["name"] for c in fresh_meal["components"]],
            [c["name"] for c in cached_meal["components"]],
        )

        # And the persisted rows carry components for future cache hits.
        db = SessionLocal()
        try:
            rows = db.query(ScannedMealLog).all()
            self.assertEqual(len(rows), 2)
            for row in rows:
                self.assertTrue(row.components)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
