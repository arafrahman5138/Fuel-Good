"""Health-flag driven nutrition targets (QA C1) + daily comparison targets (QA E1).

2026-07-11:
- C1: the hypertension sodium ceiling (1500 mg, AHA) must fire on PROFILE SAVE,
  not just on the lazy targets-read path — and the read path must recognize a
  profile whose height was supplied as height_in alone (total inches).
- E1: /nutrition/daily comparison targets must be FULL-DAY targets, matching
  GET /nutrition/targets (the old code divided by meals-logged/3).
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_health_flag_targets.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient

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

CORE_PROFILE = {
    "sex": "male",
    "age": 52,
    # height_in ALONE (total inches) — one of the three documented height
    # shapes; exercises the broadened _profile_has_core_setup (C1 fix 2).
    "height_in": 69,
    "weight_lb": 205,
    "goal": "fat_loss",
    "activity_level": "moderate",
}


class HealthFlagTargetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    def _register(self, email: str) -> dict:
        resp = self.client.post(
            "/api/auth/register",
            json={"email": email, "password": "Pass1234!", "name": "Flag Tester"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    def _save_profile(self, headers: dict, **overrides) -> None:
        payload = {**CORE_PROFILE, **overrides}
        resp = self.client.post("/api/metabolic/profile", headers=headers, json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)

    def _targets(self, headers: dict) -> dict:
        resp = self.client.get("/api/nutrition/targets", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        return resp.json()

    def test_hypertension_caps_sodium_at_1500(self) -> None:
        headers = self._register("htn@example.com")
        self._save_profile(headers, hypertension=True)
        targets = self._targets(headers)
        self.assertEqual(
            float(targets["micronutrient_targets"]["sodium_mg"]),
            1500.0,
            "hypertensive profile must get the AHA 1500 mg sodium ceiling",
        )

    def test_non_hypertensive_keeps_default_sodium(self) -> None:
        headers = self._register("no-htn@example.com")
        self._save_profile(headers)
        targets = self._targets(headers)
        self.assertEqual(
            float(targets["micronutrient_targets"]["sodium_mg"]),
            2300.0,
            "non-hypertensive users keep the generic 2300 mg default",
        )

    def test_height_in_only_profile_syncs_computed_targets(self) -> None:
        # C1 fix 2: a height_in-only profile is "core complete" — targets must
        # come from the computed budget, not the 2200-kcal legacy defaults.
        headers = self._register("height-in@example.com")
        self._save_profile(headers)
        targets = self._targets(headers)
        self.assertNotEqual(float(targets["calories_target"]), 2200.0)
        self.assertNotEqual(float(targets["protein_g_target"]), 130.0)


class DailyComparisonTargetTests(unittest.TestCase):
    """QA E1: /nutrition/daily comparison targets equal the targets endpoint."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        resp = self.client.post(
            "/api/auth/register",
            json={"email": "daily@example.com", "password": "Pass1234!", "name": "Daily"},
        )
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    def test_daily_comparison_uses_full_day_targets(self) -> None:
        # One logged meal used to shrink targets to 1/3 of the day.
        log = self.client.post(
            "/api/nutrition/logs",
            headers=self.headers,
            json={
                "source_type": "manual",
                "meal_type": "lunch",
                "title": "Test lunch",
                "nutrition": {"calories": 500, "protein_g": 30, "carbs_g": 40, "fat_g": 20},
            },
        )
        self.assertEqual(log.status_code, 200, log.text)

        targets = self.client.get("/api/nutrition/targets", headers=self.headers).json()
        daily = self.client.get("/api/nutrition/daily", headers=self.headers).json()

        for macro, target_key in [
            ("calories", "calories_target"),
            ("protein", "protein_g_target"),
            ("carbs", "carbs_g_target"),
            ("fat", "fat_g_target"),
            ("fiber", "fiber_g_target"),
        ]:
            self.assertAlmostEqual(
                float(daily["comparison"][macro]["target"]),
                float(targets[target_key]),
                places=1,
                msg=f"{macro} comparison target must be the full-day target",
            )


if __name__ == "__main__":
    unittest.main()
