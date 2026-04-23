"""Tests for the unified /api/scan/smart endpoint.

Verifies that:
  * An image the classifier says is a meal → `scan_type=meal` with a
    persisted ScannedMealLog row (no ProductLabelScan created).
  * An image the classifier says is a label → `scan_type=label`, the label
    pipeline runs, a ProductLabelScan row is created, and NO meal row is.
  * A beverage image → `scan_type=beverage`, no persistence.
  * A not-food image → `scan_type=not_food`, no persistence.
  * ``force_scan_type=label`` bypasses the classifier and goes straight to
    label extraction (the deep-override path).
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

TEST_DB_PATH = Path(__file__).with_name("test_smart_scan.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

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
from app.models.product_label_scan import ProductLabelScan
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.services import scan_cache


def _fake_jpeg_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0" + (b"0" * 64)


_MEAL_RESULT = {
    "scan_type": "meal",
    "is_beverage": False,
    "meal_label": "Grilled Chicken with Quinoa",
    "meal_context": "full_meal",
    "meal_type": "lunch",
    "portion_size": "medium",
    "source_context": "home",
    "preparation_style": "grilled",
    "components": [
        {"name": "grilled chicken breast", "role": "protein", "mass_fraction": 0.4},
        {"name": "quinoa", "role": "whole_carb", "mass_fraction": 0.35},
        {"name": "broccoli", "role": "veg", "mass_fraction": 0.25},
    ],
    "estimated_ingredients": ["Grilled Chicken Breast", "Quinoa", "Broccoli"],
    "normalized_ingredients": ["grilled chicken breast", "quinoa", "broccoli"],
    "nutrition_estimate": {"calories": 420, "protein": 38, "carbs": 40, "fat": 10, "fiber": 7, "sugar_g": 3},
    "whole_food_status": "pass",
    "whole_food_flags": [],
    "suggested_swaps": {},
    "mes": None,
    "snack_profile": None,
    "confidence": 0.92,
    "confidence_breakdown": {"extraction": 0.9, "portion": 0.8},
    "upgrade_suggestions": [],
    "recovery_plan": [],
    "source_model": "gemini-2.5-flash-lite",
    "prompt_version": "meal_scan_v4_consensus",
    "grounding_source": None,
    "grounding_candidates": [],
    "matched_recipe_id": None,
    "matched_recipe_confidence": None,
    "whole_food_summary": "Whole-food plate.",
    "pairing_opportunity": False,
    "pairing_recommended_recipe_id": None,
    "pairing_recommended_title": None,
    "pairing_projected_mes": None,
    "pairing_projected_delta": None,
    "pairing_reasons": [],
    "pairing_timing": None,
}


_LABEL_REDIRECT_RESULT = {
    "scan_type": "label",
    "label": {
        "product_name": "Plain Greek Yogurt",
        "brand": "Fage",
        "ingredients_text": "Pasteurized milk, live active cultures",
        "confidence": 0.92,
        "confidence_breakdown": {"ocr": 0.9, "ingredients": 0.95, "nutrition": 0.9, "metadata": 0.9},
        "score": 100,
        "tier": "whole_food",
        "verdict": "Great choice",
    },
    "meal_label": "Plain Greek Yogurt",
    "confidence": 0.92,
}


_NOT_FOOD_RESULT = {
    "scan_type": "not_food",
    "is_not_food": True,
    "not_food_reason": "A restaurant menu page.",
    "meal_label": "Not a food item",
    "confidence": 0.0,
}


_BEVERAGE_RESULT = {
    **_MEAL_RESULT,
    "scan_type": "beverage",
    "is_beverage": True,
    "meal_label": "Cafe Latte",
    "components": [{"name": "latte", "role": "other", "mass_fraction": 1.0}],
    "nutrition_estimate": {"calories": 180, "sugar_g": 10},
}


class SmartScanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        # Flush the in-memory scan cache between tests so earlier-test mocks
        # don't leak into the next one.
        scan_cache.clear_all()

    def _db(self):
        return SessionLocal()

    def _create_user(self, email: str = "smart@example.com") -> User:
        db = self._db()
        try:
            user = User(
                email=email,
                name="Smart",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    def _post(self, token: str, data: dict | None = None) -> dict:
        response = self.client.post(
            "/api/scan/smart",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("food.jpg", _fake_jpeg_bytes(), "image/jpeg")},
            data=data or {},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_meal_image_returns_scan_type_meal_and_persists_meal_row(self) -> None:
        user = self._create_user("meal@example.com")
        tokens = create_token_pair(str(user.id))

        with patch(
            "app.routers.scan.analyze_meal_scan",
            new_callable=AsyncMock, return_value=dict(_MEAL_RESULT),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            body = self._post(tokens["access_token"])

        self.assertEqual(body["scan_type"], "meal")
        self.assertIn("meal", body)
        self.assertEqual(body["meal"]["meal_label"], "Grilled Chicken with Quinoa")
        self.assertIn("id", body["meal"])
        db = self._db()
        try:
            self.assertEqual(db.query(ScannedMealLog).count(), 1)
            self.assertEqual(db.query(ProductLabelScan).count(), 0)
        finally:
            db.close()

    def test_label_image_routes_to_label_pipeline_and_persists_label_row(self) -> None:
        user = self._create_user("label@example.com")
        tokens = create_token_pair(str(user.id))

        with patch(
            "app.routers.scan.analyze_meal_scan",
            new_callable=AsyncMock, return_value=dict(_LABEL_REDIRECT_RESULT),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            body = self._post(tokens["access_token"])

        self.assertEqual(body["scan_type"], "label")
        self.assertIn("label", body)
        self.assertEqual(body["label"]["product_name"], "Plain Greek Yogurt")
        db = self._db()
        try:
            self.assertEqual(db.query(ProductLabelScan).count(), 1)
            self.assertEqual(db.query(ScannedMealLog).count(), 0, "label must not create a meal row")
        finally:
            db.close()

    def test_not_food_image_returns_scan_type_not_food_no_persistence(self) -> None:
        user = self._create_user("notfood@example.com")
        tokens = create_token_pair(str(user.id))

        with patch(
            "app.routers.scan.analyze_meal_scan",
            new_callable=AsyncMock, return_value=dict(_NOT_FOOD_RESULT),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            body = self._post(tokens["access_token"])

        self.assertEqual(body["scan_type"], "not_food")
        self.assertIn("not_food", body)
        self.assertIn("reason", body["not_food"])
        db = self._db()
        try:
            self.assertEqual(db.query(ScannedMealLog).count(), 0)
            self.assertEqual(db.query(ProductLabelScan).count(), 0)
        finally:
            db.close()

    def test_beverage_image_returns_scan_type_beverage_no_persistence(self) -> None:
        user = self._create_user("bev@example.com")
        tokens = create_token_pair(str(user.id))

        with patch(
            "app.routers.scan.analyze_meal_scan",
            new_callable=AsyncMock, return_value=dict(_BEVERAGE_RESULT),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            body = self._post(tokens["access_token"])

        self.assertEqual(body["scan_type"], "beverage")
        self.assertIn("beverage", body)
        self.assertIn("fuel_score", body["beverage"])
        self.assertLessEqual(body["beverage"]["fuel_score"], 70, "beverage ceiling must hold")
        db = self._db()
        try:
            self.assertEqual(db.query(ScannedMealLog).count(), 0)
            self.assertEqual(db.query(ProductLabelScan).count(), 0)
        finally:
            db.close()

    def test_force_scan_type_meal_keeps_meal_even_when_classifier_says_label(self) -> None:
        """When the user overrides from the product result card ('was this a
        prepared meal?'), the server must run the meal pipeline on the image
        even if the classifier would otherwise route it to label.
        """
        user = self._create_user("force-meal@example.com")
        tokens = create_token_pair(str(user.id))

        captured_contexts: list[dict] = []

        async def fake_meal(**kwargs):
            captured_contexts.append(dict(kwargs.get("context") or {}))
            return dict(_MEAL_RESULT)

        with patch(
            "app.routers.scan.analyze_meal_scan",
            side_effect=fake_meal,
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            body = self._post(tokens["access_token"], data={"force_scan_type": "meal"})

        self.assertEqual(body["scan_type"], "meal")
        self.assertEqual(len(captured_contexts), 1)
        self.assertEqual(captured_contexts[0].get("force_scan_type"), "meal",
                         "force_scan_type must be threaded into analyze_meal_scan's context")

    def test_force_scan_type_label_bypasses_meal_classifier(self) -> None:
        """Deep-override path: the user said 'we read this wrong, treat as label'."""
        user = self._create_user("force@example.com")
        tokens = create_token_pair(str(user.id))

        label_only_result = _LABEL_REDIRECT_RESULT["label"]

        async def fake_label(*args, **kwargs):
            return dict(label_only_result)

        # analyze_meal_scan must NOT be called under force_scan_type=label.
        with patch(
            "app.routers.scan.analyze_product_label_image",
            side_effect=fake_label,
        ), patch(
            "app.routers.scan.analyze_meal_scan",
            side_effect=AssertionError("meal classifier must not run under force=label"),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            body = self._post(tokens["access_token"], data={"force_scan_type": "label"})

        self.assertEqual(body["scan_type"], "label")
        self.assertEqual(body["label"]["product_name"], "Plain Greek Yogurt")
        db = self._db()
        try:
            self.assertEqual(db.query(ProductLabelScan).count(), 1)
            self.assertEqual(db.query(ScannedMealLog).count(), 0)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
