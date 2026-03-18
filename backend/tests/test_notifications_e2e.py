import os
import sys
import unittest
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

TEST_DB_PATH = Path(__file__).with_name("test_notifications_e2e.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["NOTIFICATION_RUNNER_SECRET"] = "test-notification-runner-secret"

from fastapi.testclient import TestClient

from app.auth import create_access_token
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
from app.models.gamification import DailyQuest
from app.models.meal_plan import ChatSession, MealPlan, MealPlanItem
from app.models.notification import NotificationDelivery, NotificationPreference, UserPushToken
from app.models.recipe import Recipe
from app.models.user import User
from app.services.notifications import NotificationCycleResult, process_user_notifications, record_notification_event


class _MockExpoResponse:
    status_code = 200

    @staticmethod
    def json() -> dict:
        return {"data": {"status": "ok"}}


class NotificationE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    def tearDown(self) -> None:
        SessionLocal.remove() if hasattr(SessionLocal, "remove") else None

    def _db(self):
        return SessionLocal()

    def _create_user(self, *, email: str, name: str = "Test User", active_at: datetime | None = None) -> User:
        db = self._db()
        try:
            user = User(
                email=email,
                name=name,
                access_override_level="premium_lifetime",
                last_active_date=active_at,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

        response = self.client.post(
            "/api/notifications/events",
            headers=self._auth_headers(user),
            json={"event_type": "notification_opened", "properties": {"delivery_id": first.id}},
        )
        self.assertEqual(response.status_code, 200, response.text)

        db = self._db()
        try:
            first = db.query(NotificationDelivery).filter(NotificationDelivery.id == first.id).one()
            second = db.query(NotificationDelivery).filter(NotificationDelivery.id == second.id).one()
            self.assertIsNotNone(first.opened_at)
            self.assertIsNone(second.opened_at)
        finally:
            db.close()

    def _auth_headers(self, user: User) -> dict[str, str]:
        token = create_access_token({"sub": user.id})
        return {"Authorization": f"Bearer {token}"}

    def _register_push_token(self, user: User, timezone: str = "America/New_York") -> dict:
        response = self.client.post(
            "/api/notifications/push-token",
            headers=self._auth_headers(user),
            json={
                "expo_push_token": f"ExponentPushToken[{user.id[:8]}]",
                "device_id": f"device-{user.id[:8]}",
                "platform": "ios",
                "app_version": "1.0.0",
                "timezone": timezone,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def _create_token_direct(self, db, user: User) -> UserPushToken:
        token = UserPushToken(
            user_id=user.id,
            expo_push_token=f"ExponentPushToken[{user.id[:8]}]",
            device_id=f"device-{user.id[:8]}",
            platform="ios",
            app_version="1.0.0",
            enabled=True,
        )
        db.add(token)
        pref = NotificationPreference(
            user_id=user.id,
            push_enabled=True,
            timezone="America/New_York",
            max_notifications_per_day=2,
            max_notifications_per_week=3,
        )
        db.add(pref)
        db.commit()
        db.refresh(token)
        return token

    def test_push_token_registration_persists_timezone_and_defaults(self) -> None:
        user = self._create_user(email="push@example.com", active_at=datetime(2026, 3, 13, 12, 0, 0))

        payload = self._register_push_token(user, timezone="America/Chicago")
        self.assertEqual(payload["status"], "registered")
        self.assertTrue(payload["push_enabled"])

        prefs_response = self.client.get("/api/notifications/preferences", headers=self._auth_headers(user))
        self.assertEqual(prefs_response.status_code, 200, prefs_response.text)
        prefs = prefs_response.json()
        self.assertEqual(prefs["timezone"], "America/Chicago")
        self.assertEqual(prefs["max_notifications_per_week"], 3)
        self.assertEqual(prefs["preferred_meal_window_start"], "17:00")
        self.assertEqual(prefs["preferred_meal_window_end"], "19:30")

    def test_notification_open_marks_only_target_delivery(self) -> None:
        user = self._create_user(email="opened@example.com", active_at=datetime(2026, 3, 13, 9, 0, 0))
        self._register_push_token(user)

        db = self._db()
        try:
            token = db.query(UserPushToken).filter(UserPushToken.user_id == user.id).one()
            first = NotificationDelivery(
                user_id=user.id,
                push_token_id=token.id,
                category="plan_kickoff",
                status="sent",
                title="A",
                body="A",
                route="/(tabs)/meals?tab=plan",
                sent_at=datetime(2026, 3, 13, 10, 0, 0),
            )
            second = NotificationDelivery(
                user_id=user.id,
                push_token_id=token.id,
                category="cook_tonight",
                status="sent",
                title="B",
                body="B",
                route="/cook/recipe-1",
                sent_at=datetime(2026, 3, 13, 11, 0, 0),
            )
            db.add_all([first, second])
            db.commit()
            db.refresh(first)
            db.refresh(second)
        finally:
            db.close()

    def test_ingest_event_queues_without_inline_send(self) -> None:
        user = self._create_user(email="queue@example.com", active_at=datetime(2026, 3, 13, 12, 0, 0))
        self._register_push_token(user)

        response = self.client.post(
            "/api/notifications/events",
            headers=self._auth_headers(user),
            json={"event_type": "app_opened", "properties": {"source": "test"}},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertTrue(payload["queued"])
        self.assertEqual(payload["notifications_sent"], 0)

        db = self._db()
        try:
            deliveries = db.query(NotificationDelivery).filter(NotificationDelivery.user_id == user.id).all()
            self.assertEqual(deliveries, [])
        finally:
            db.close()

    def test_internal_notification_run_requires_secret_and_returns_summary(self) -> None:
        forbidden = self.client.post("/api/internal/notifications/run")
        self.assertEqual(forbidden.status_code, 403)

        cycle_result = NotificationCycleResult(
            users_evaluated=3,
            deliveries_attempted=2,
            deliveries_sent=1,
            failures=0,
            duration_seconds=0.123,
        )
        with patch("app.routers.internal.run_notification_cycle", return_value=cycle_result):
            response = self.client.post(
                "/api/internal/notifications/run",
                headers={"x-notification-runner-secret": "test-notification-runner-secret"},
            )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["deliveries_sent"], 1)
        self.assertEqual(payload["deliveries_attempted"], 2)

    def test_grocery_follow_through_sends_once_per_plan(self) -> None:
        user = self._create_user(email="grocery@example.com", active_at=datetime(2026, 3, 13, 9, 0, 0))
        db = self._db()
        try:
            self._create_token_direct(db, user)
            plan = MealPlan(
                user_id=user.id,
                week_start=date(2026, 3, 9),
                created_at=datetime(2026, 3, 12, 7, 0, 0),
            )
            db.add(plan)
            db.commit()
            db.refresh(plan)

            with patch("app.services.notifications.httpx.post", return_value=_MockExpoResponse()):
                deliveries = process_user_notifications(db, user.id, now=datetime(2026, 3, 12, 20, 0, 0))
                self.assertEqual(len(deliveries), 1)
                self.assertEqual(deliveries[0].category, "grocery_follow_through")
                repeat = process_user_notifications(db, user.id, now=datetime(2026, 3, 12, 21, 0, 0))
                self.assertEqual(repeat, [])
        finally:
            db.close()

    def test_healthify_callback_is_suppressed_after_recipe_save(self) -> None:
        user = self._create_user(email="chat@example.com", active_at=datetime(2026, 3, 13, 8, 0, 0))
        db = self._db()
        try:
            self._create_token_direct(db, user)
            session = ChatSession(
                user_id=user.id,
                title="Creamy pasta",
                messages=[{"role": "user", "content": "Creamy pasta"}],
                created_at=datetime(2026, 3, 13, 10, 0, 0),
                updated_at=datetime(2026, 3, 13, 10, 0, 0),
            )
            db.add(session)
            db.commit()
            record_notification_event(
                db,
                user.id,
                "recipe_saved",
                occurred_at=datetime(2026, 3, 13, 11, 0, 0),
            )
            db.commit()

            with patch("app.services.notifications.httpx.post", return_value=_MockExpoResponse()):
                deliveries = process_user_notifications(db, user.id, now=datetime(2026, 3, 13, 16, 0, 0))
            self.assertEqual(deliveries, [])
        finally:
            db.close()

    def test_reactivation_uses_latest_meaningful_route(self) -> None:
        user = self._create_user(email="inactive@example.com", active_at=datetime(2026, 3, 6, 12, 0, 0))
        db = self._db()
        try:
            self._create_token_direct(db, user)
            record_notification_event(
                db,
                user.id,
                "meal_plan_viewed",
                occurred_at=datetime(2026, 3, 5, 12, 0, 0, tzinfo=UTC).replace(tzinfo=None),
            )
            record_notification_event(
                db,
                user.id,
                "saved_recipes_viewed",
                occurred_at=datetime(2026, 3, 6, 11, 30, 0),
            )
            record_notification_event(
                db,
                user.id,
                "healthify_started",
                occurred_at=datetime(2026, 3, 5, 10, 0, 0),
            )
            db.commit()

            with patch("app.services.notifications.httpx.post", return_value=_MockExpoResponse()):
                deliveries = process_user_notifications(db, user.id, now=datetime(2026, 3, 13, 12, 0, 0))

            self.assertEqual(len(deliveries), 1)
            self.assertEqual(deliveries[0].category, "reactivation_7d")
            self.assertEqual(deliveries[0].route, "/saved")
        finally:
            db.close()

    def test_plan_kickoff_is_suppressed_when_plan_was_viewed_this_week(self) -> None:
        user = self._create_user(email="planner@example.com", active_at=datetime(2026, 3, 9, 9, 0, 0))
        db = self._db()
        try:
            self._create_token_direct(db, user)
            pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).one()
            pref.timezone = "America/New_York"
            record_notification_event(
                db,
                user.id,
                "meal_plan_viewed",
                occurred_at=datetime(2026, 3, 10, 9, 0, 0),
            )
            db.commit()

            with patch("app.services.notifications.httpx.post", return_value=_MockExpoResponse()):
                deliveries = process_user_notifications(db, user.id, now=datetime(2026, 3, 15, 22, 0, 0))
            self.assertEqual(deliveries, [])
        finally:
            db.close()

    def test_quest_progress_only_nudges_when_one_action_away(self) -> None:
        user = self._create_user(email="quest@example.com", active_at=datetime(2026, 3, 13, 9, 0, 0))
        db = self._db()
        try:
            self._create_token_direct(db, user)
            quest = DailyQuest(
                user_id=user.id,
                date=date(2026, 3, 13),
                quest_type="general",
                title="Log meals",
                target_value=3,
                current_value=2,
                completed=False,
            )
            db.add(quest)
            db.commit()

            with patch("app.services.notifications.httpx.post", return_value=_MockExpoResponse()):
                deliveries = process_user_notifications(db, user.id, now=datetime(2026, 3, 13, 15, 0, 0))
            self.assertEqual(len(deliveries), 1)
            self.assertEqual(deliveries[0].category, "quest_progress")

            quest.current_value = 0
            db.query(NotificationDelivery).delete()
            db.commit()
            with patch("app.services.notifications.httpx.post", return_value=_MockExpoResponse()):
                deliveries = process_user_notifications(db, user.id, now=datetime(2026, 3, 13, 15, 30, 0))
            self.assertEqual(deliveries, [])
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
