import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

TEST_DB_PATH = Path(__file__).with_name("test_scan_degraded_fallback.sqlite3")
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


class ScanDegradedFallbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    def _db(self):
        return SessionLocal()

    def _create_user(self, email: str = "scan@example.com") -> User:
        db = self._db()
        try:
            user = User(
                email=email,
                name="Scan User",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    @staticmethod
    def _fake_jpeg_bytes() -> bytes:
        return b"\xff\xd8\xff\xe0" + (b"0" * 64)

    @staticmethod
    def _fake_heic_bytes() -> bytes:
        return (b"\x00\x00\x00\x18ftypheic" + (b"0" * 64))

    def test_meal_scan_returns_degraded_payload_when_ai_analysis_fails(self) -> None:
        user = self._create_user()
        tokens = create_token_pair(str(user.id))

        with patch("app.routers.scan.analyze_meal_scan", side_effect=RuntimeError("boom")), patch(
            "app.routers.scan.is_supabase_storage_configured",
            return_value=False,
        ):
            response = self.client.post(
                "/api/scan/meal",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
                files={"image": ("meal.jpg", self._fake_jpeg_bytes(), "image/jpeg")},
                data={"meal_type": "dinner", "portion_size": "large", "source_context": "restaurant"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        # Phase 2 audit fix (Bug H): degraded scans are NOT persisted as
        # "Scanned meal" rows that pollute the Recent carousel. They return a
        # lightweight payload with a retry CTA and the client re-invokes if
        # the user wants to try again.
        self.assertTrue(body.get("is_degraded"))
        self.assertEqual(body.get("meal_type"), "dinner")
        self.assertEqual(body.get("portion_size"), "large")
        self.assertEqual(body.get("source_context"), "restaurant")
        self.assertIn("degraded_reason", body)
        self.assertIn("retry_options", body)
        # No ScannedMealLog row should have been created — the carousel stays honest.
        self.assertNotIn("id", body)

    def test_meal_scan_continues_when_storage_upload_fails(self) -> None:
        user = self._create_user("storage@example.com")
        tokens = create_token_pair(str(user.id))
        ai_result = {
            "meal_label": "Chicken Rice Bowl",
            "meal_context": "full_meal",
            "meal_type": "lunch",
            "portion_size": "medium",
            "source_context": "home",
            "estimated_ingredients": ["Chicken", "Rice"],
            "normalized_ingredients": ["chicken", "rice"],
            "nutrition_estimate": {
                "calories": 520,
                "protein": 34,
                "carbs": 48,
                "fat": 14,
                "fiber": 4,
            },
            "whole_food_status": "pass",
            "whole_food_flags": [],
            "suggested_swaps": {},
            "upgrade_suggestions": [],
            "recovery_plan": [],
            "mes": None,
            "confidence": 0.82,
            "confidence_breakdown": {"extraction": 0.8, "portion": 0.8, "nutrition": 0.8, "grounding": 0.8},
            "source_model": "gemini-2.5-flash",
            "grounding_source": None,
            "grounding_candidates": [],
            "prompt_version": "test",
            "matched_recipe_id": None,
            "matched_recipe_confidence": None,
            "whole_food_summary": "Looks solid.",
            "pairing_opportunity": False,
            "pairing_recommended_recipe_id": None,
            "pairing_recommended_title": None,
            "pairing_projected_mes": None,
            "pairing_projected_delta": None,
            "pairing_reasons": [],
            "pairing_timing": None,
        }

        with patch("app.routers.scan.analyze_meal_scan", return_value=ai_result), patch(
            "app.routers.scan.is_supabase_storage_configured",
            return_value=True,
        ), patch(
            "app.routers.scan._store_scan_image",
            side_effect=RuntimeError("storage failed"),
        ):
            response = self.client.post(
                "/api/scan/meal",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
                files={"image": ("meal.heic", self._fake_heic_bytes(), "image/heic")},
                data={"meal_type": "lunch", "portion_size": "medium", "source_context": "home"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body.get("meal_label"), "Chicken Rice Bowl")
        self.assertIsNone((body.get("image") or {}).get("signed_url") if body.get("image") else None)
        self.assertEqual(body.get("whole_food_status"), "pass")
        self.assertIn("id", body)


if __name__ == "__main__":
    unittest.main()
