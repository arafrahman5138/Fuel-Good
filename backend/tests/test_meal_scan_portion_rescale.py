"""PATCH /scan/meal/{id} portion-only updates must rescale, not rebuild.

Regression for 2026-07-11: the portion-confirm chip PATCHes with unchanged
ingredients; the old path rebuilt nutrition from bare ingredient names via
COMPONENT_MACROS, collapsing a grounded 1170 kcal scan to 137 kcal. With
unchanged ingredients the stored nutrition is now scaled by the
portion-multiplier ratio and components are preserved.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

TEST_DB_PATH = Path(__file__).with_name("test_meal_scan_portion_rescale.sqlite3")
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
from app.models.user import User
from app.services import scan_cache


def _fake_jpeg_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0" + b"p" * 64


_EXTRACTION = {
    "scan_type": "meal",
    "not_food": False,
    "is_beverage": False,
    "meal_label": "Fried Chicken Basket",
    "portion_size": "medium",
    "source_context_guess": "restaurant",
    "meal_type_guess": "dinner",
    "preparation_style": "fried",
    "components": [
        {"name": "fried chicken", "role": "protein", "mass_fraction": 0.6, "estimated_grams": 400,
         "nova": 3, "methods": ["deep-fried"], "visible": True, "confidence": 0.95, "portion_factor": 1.0},
        {"name": "french fries", "role": "carb", "mass_fraction": 0.4, "estimated_grams": 300,
         "nova": 3, "methods": ["fried"], "visible": True, "confidence": 0.95, "portion_factor": 1.0},
    ],
    "possible_hidden_ingredients": [],
    "multi_dish": False,
    "dishes": [],
    "confidence": 0.9,
}


class PortionRescaleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        scan_cache.clear_all()

    def _token(self) -> str:
        db = SessionLocal()
        try:
            user = User(
                email="portion@example.com",
                name="Portion",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return create_token_pair(str(user.id))["access_token"]
        finally:
            db.close()

    def test_portion_only_patch_rescales_grounded_nutrition(self) -> None:
        token = self._token()
        headers = {"Authorization": f"Bearer {token}"}

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
            scan_resp = self.client.post(
                "/api/scan/smart",
                headers=headers,
                files={"image": ("food.jpg", _fake_jpeg_bytes(), "image/jpeg")},
                data={"source_context": "restaurant"},
            )
        self.assertEqual(scan_resp.status_code, 200, scan_resp.text)
        meal = scan_resp.json()["meal"]
        base_kcal = float(meal["nutrition_estimate"]["calories"])
        self.assertGreater(base_kcal, 0)

        # The chip echoes the estimated ingredients verbatim and changes only
        # the portion size.
        patch_resp = self.client.patch(
            f"/api/scan/meal/{meal['id']}",
            headers=headers,
            json={
                "meal_label": meal["meal_label"],
                "meal_type": "dinner",
                "portion_size": "large",
                "source_context": "restaurant",
                "ingredients": meal["estimated_ingredients"],
            },
        )
        self.assertEqual(patch_resp.status_code, 200, patch_resp.text)
        updated = patch_resp.json()

        self.assertEqual(updated["portion_size"], "large")
        # medium (x1.0) -> large (x1.25)
        self.assertAlmostEqual(
            float(updated["nutrition_estimate"]["calories"]), base_kcal * 1.25, delta=1.0,
        )
        # The grounded components survive the update.
        self.assertEqual(len(updated["components"]), len(meal["components"]))
        self.assertEqual(updated["fuel_score"], meal["fuel_score"])

    def test_changed_ingredients_still_recompute(self) -> None:
        token = self._token()
        headers = {"Authorization": f"Bearer {token}"}

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
            scan_resp = self.client.post(
                "/api/scan/smart",
                headers=headers,
                files={"image": ("food.jpg", _fake_jpeg_bytes(), "image/jpeg")},
                data={"source_context": "restaurant"},
            )
        meal = scan_resp.json()["meal"]

        # Editing the ingredient list is a real edit — the rebuild path applies.
        patch_resp = self.client.patch(
            f"/api/scan/meal/{meal['id']}",
            headers=headers,
            json={
                "meal_label": meal["meal_label"],
                "meal_type": "dinner",
                "portion_size": "medium",
                "source_context": "restaurant",
                "ingredients": ["Grilled Chicken Breast", "Side Salad"],
            },
        )
        self.assertEqual(patch_resp.status_code, 200, patch_resp.text)
        updated = patch_resp.json()
        self.assertIn("grilled chicken breast", [i.lower() for i in updated["normalized_ingredients"]])


if __name__ == "__main__":
    unittest.main()
