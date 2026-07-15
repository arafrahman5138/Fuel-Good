"""GET /api/fuel/health-pulse premium gate (QA D3-BE, 2026-07-11).

The metabolic dimension belongs to the premium pillar: free users get
{available: false, score: null, tier: "locked"} and a composite reweighted
over fuel + nutrition only. Premium users are unchanged.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_health_pulse_gate.sqlite3")
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
from app.services import billing


class HealthPulseGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        self._open_premium = billing.settings.allow_open_premium_in_non_production
        billing.settings.allow_open_premium_in_non_production = False

    def tearDown(self) -> None:
        billing.settings.allow_open_premium_in_non_production = self._open_premium

    def _make_user(self, email: str, *, premium: bool) -> dict:
        db = SessionLocal()
        try:
            user = User(
                email=email,
                name="Pulse Tester",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium" if premium else None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            token = create_token_pair(str(user.id))["access_token"]
            return {"Authorization": f"Bearer {token}"}
        finally:
            db.close()

    def _log_meal(self, headers: dict) -> None:
        resp = self.client.post(
            "/api/nutrition/logs",
            headers=headers,
            json={
                "source_type": "manual",
                "meal_type": "lunch",
                "title": "Chicken and rice",
                "nutrition": {"calories": 550, "protein_g": 40, "carbs_g": 45, "fat_g": 18, "fiber_g": 6},
            },
        )
        self.assertEqual(resp.status_code, 200, resp.text)

    def test_free_user_gets_no_metabolic_dimension(self) -> None:
        headers = self._make_user("free-pulse@example.com", premium=False)
        self._log_meal(headers)
        resp = self.client.get("/api/fuel/health-pulse", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertFalse(body["metabolic"]["available"])
        self.assertIsNone(body["metabolic"]["score"])
        self.assertEqual(body["metabolic"]["tier"], "locked")
        # Composite must reweight over fuel + nutrition only — with both
        # available it stays a valid 0-100 score, not dragged down by a
        # phantom 0-score metabolic dimension.
        self.assertTrue(body["fuel"]["available"])
        self.assertGreater(body["score"], 0.0)

    def test_premium_user_keeps_metabolic_dimension(self) -> None:
        headers = self._make_user("prem-pulse@example.com", premium=True)
        self._log_meal(headers)
        resp = self.client.get("/api/fuel/health-pulse", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        # Logging a meal triggers the MES hook, so the daily metabolic score
        # exists and the dimension is present for premium users.
        self.assertTrue(body["metabolic"]["available"])
        self.assertIsNotNone(body["metabolic"]["score"])
        self.assertNotEqual(body["metabolic"]["tier"], "locked")


if __name__ == "__main__":
    unittest.main()
