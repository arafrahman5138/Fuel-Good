"""Streak correctness (QA E3, 2026-07-11).

- Metabolic streak: recomputed from the full set of qualifying daily-score
  dates (backdated logs extend a run instead of resetting it to 1), anchored
  to today/yesterday (a run that ended days ago reports current_streak 0).
- Nutrition (User.current_streak): same anchoring — logged dates ending a
  week ago no longer report their full run length as "current".
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_streak_correctness.sqlite3")
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
from app.models.metabolic import MetabolicScore
from app.models.user import User
from app.services.metabolic_engine import update_metabolic_streak


def _today():
    return datetime.now(UTC).date()


class MetabolicStreakTests(unittest.TestCase):
    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        self.db = SessionLocal()
        user = User(
            email="streak@example.com",
            name="Streak",
            hashed_password=get_password_hash("Pass1234!"),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        self.user_id = str(user.id)

    def tearDown(self) -> None:
        self.db.close()

    def _seed_daily_score(self, day, score: float = 75.0) -> None:
        self.db.add(MetabolicScore(
            user_id=self.user_id,
            date=day,
            scope="daily",
            total_score=score,
            tier="good",
        ))
        self.db.commit()

    def test_backdated_qualifying_log_extends_streak(self) -> None:
        today = _today()
        # Qualifying scores exist for today and two days ago — gap at yesterday.
        self._seed_daily_score(today)
        self._seed_daily_score(today - timedelta(days=2))
        streak = update_metabolic_streak(self.db, self.user_id, 75.0, today)
        self.assertEqual(streak.current_streak, 1)

        # Backfill yesterday: the old delta logic reset current_streak to 1;
        # the recompute-from-dates logic must report the full 3-day run.
        self._seed_daily_score(today - timedelta(days=1))
        streak = update_metabolic_streak(self.db, self.user_id, 75.0, today - timedelta(days=1))
        self.assertEqual(streak.current_streak, 3)
        self.assertGreaterEqual(streak.longest_streak, 3)

    def test_stale_run_reports_zero_current_streak(self) -> None:
        today = _today()
        # A 5-day qualifying run that ended 6 days ago.
        for offset in range(6, 11):
            self._seed_daily_score(today - timedelta(days=offset))
        streak = update_metabolic_streak(
            self.db, self.user_id, 75.0, today - timedelta(days=6)
        )
        self.assertEqual(streak.current_streak, 0, "a run ending 6 days ago is not current")
        self.assertEqual(streak.longest_streak, 5, "longest streak still honors the run")

    def test_below_threshold_day_breaks_run(self) -> None:
        today = _today()
        self._seed_daily_score(today)
        self._seed_daily_score(today - timedelta(days=1), score=30.0)  # below threshold
        self._seed_daily_score(today - timedelta(days=2))
        streak = update_metabolic_streak(self.db, self.user_id, 75.0, today)
        self.assertEqual(streak.current_streak, 1)


class NutritionStreakTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        db = SessionLocal()
        try:
            user = User(
                email="nstreak@example.com",
                name="NStreak",
                hashed_password=get_password_hash("Pass1234!"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            self.user_id = str(user.id)
            token = create_token_pair(self.user_id)["access_token"]
            self.headers = {"Authorization": f"Bearer {token}"}
        finally:
            db.close()

    def _log(self, day) -> None:
        resp = self.client.post(
            "/api/nutrition/logs",
            headers=self.headers,
            json={
                "source_type": "manual",
                "meal_type": "lunch",
                "title": f"Meal {day.isoformat()}",
                "date": day.isoformat(),
                "nutrition": {"calories": 500, "protein_g": 35, "carbs_g": 40, "fat_g": 15},
            },
        )
        self.assertEqual(resp.status_code, 200, resp.text)

    def _current_streak(self) -> int:
        db = SessionLocal()
        try:
            return int(db.query(User).filter(User.id == self.user_id).first().current_streak or 0)
        finally:
            db.close()

    def test_backdated_log_fills_gap_and_extends_streak(self) -> None:
        today = _today()
        self._log(today)
        self._log(today - timedelta(days=2))
        self.assertEqual(self._current_streak(), 1)
        self._log(today - timedelta(days=1))
        self.assertEqual(self._current_streak(), 3)

    def test_stale_5_day_run_reports_zero(self) -> None:
        today = _today()
        for offset in range(6, 11):
            self._log(today - timedelta(days=offset))
        self.assertEqual(
            self._current_streak(), 0,
            "a logging run that ended 6 days ago must not report as current",
        )

    def test_fuel_streak_exposes_weekly_drilldown_fields(self) -> None:
        # E3-extension: /fuel/streak carries the weekly weeks-at-goal numbers
        # as fuel_target_streak / fuel_target_longest (week units), while
        # current_streak / longest_streak stay day units.
        self._log(_today())
        resp = self.client.get("/api/fuel/streak", headers=self.headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("fuel_target_streak", body)
        self.assertIn("fuel_target_longest", body)
        self.assertEqual(body["current_streak"], 1)
        self.assertIsInstance(body["fuel_target_streak"], int)


if __name__ == "__main__":
    unittest.main()
