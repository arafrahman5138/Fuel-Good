"""GET /api/scan/quota — free-tier quota visibility endpoint (QA D1, 2026-07-11).

Contract the frontend codes against: {limit, used_today, remaining, is_premium}.
Premium users: is_premium=true, remaining=null. The endpoint itself is never
quota-enforced. Barcode scans never count toward used_today.
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_scan_quota.sqlite3")
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
from app.models.product_label_scan import ProductLabelScan  # noqa: F401
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.services import billing


class ScanQuotaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        # Dev environments default to open premium; disable it so the free
        # tier is actually exercised. Restored in tearDown.
        self._open_premium = billing.settings.allow_open_premium_in_non_production
        billing.settings.allow_open_premium_in_non_production = False

    def tearDown(self) -> None:
        billing.settings.allow_open_premium_in_non_production = self._open_premium

    def _make_user(self, email: str, *, premium: bool = False) -> tuple[str, dict]:
        db = SessionLocal()
        try:
            user = User(
                email=email,
                name="Quota Tester",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium" if premium else None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            token = create_token_pair(str(user.id))["access_token"]
            return str(user.id), {"Authorization": f"Bearer {token}"}
        finally:
            db.close()

    def _seed_meal_scans(self, user_id: str, count: int) -> None:
        db = SessionLocal()
        try:
            for i in range(count):
                db.add(ScannedMealLog(
                    user_id=user_id,
                    meal_label=f"Scan {i}",
                    nutrition_estimate={"calories": 400},
                    created_at=datetime.now(UTC).replace(tzinfo=None),
                ))
            db.commit()
        finally:
            db.close()

    def test_free_user_with_no_scans_has_full_quota(self) -> None:
        _, headers = self._make_user("free@example.com")
        resp = self.client.get("/api/scan/quota", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(body["limit"], 3)
        self.assertEqual(body["used_today"], 0)
        self.assertEqual(body["remaining"], 3)
        self.assertFalse(body["is_premium"])

    def test_free_user_quota_decrements_and_floors_at_zero(self) -> None:
        user_id, headers = self._make_user("used-up@example.com")
        self._seed_meal_scans(user_id, 3)
        body = self.client.get("/api/scan/quota", headers=headers).json()
        self.assertEqual(body["used_today"], 3)
        self.assertEqual(body["remaining"], 0)
        self.assertFalse(body["is_premium"])

    def test_premium_user_is_unlimited(self) -> None:
        user_id, headers = self._make_user("premium@example.com", premium=True)
        self._seed_meal_scans(user_id, 5)
        body = self.client.get("/api/scan/quota", headers=headers).json()
        self.assertTrue(body["is_premium"])
        self.assertIsNone(body["remaining"])

    def test_quota_endpoint_is_not_quota_enforced(self) -> None:
        # Even a maxed-out free user can still READ their quota.
        user_id, headers = self._make_user("maxed@example.com")
        self._seed_meal_scans(user_id, 10)
        resp = self.client.get("/api/scan/quota", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(resp.json()["remaining"], 0)


if __name__ == "__main__":
    unittest.main()
