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
                files={"image": ("meal.jpg", b"fake-image-bytes", "image/jpeg")},
                data={"meal_type": "dinner", "portion_size": "large", "source_context": "restaurant"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body.get("is_degraded"))
        self.assertEqual(body.get("meal_type"), "dinner")
        self.assertEqual(body.get("portion_size"), "large")
        self.assertEqual(body.get("source_context"), "restaurant")
        self.assertEqual(body.get("source_model"), "degraded_fallback")
        self.assertEqual(body.get("whole_food_status"), "unknown")
        self.assertEqual(body.get("estimated_ingredients"), [])
        self.assertEqual(body.get("normalized_ingredients"), [])
        self.assertIn("id", body)


if __name__ == "__main__":
    unittest.main()
