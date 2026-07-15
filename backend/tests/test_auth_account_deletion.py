import os
import sys
import unittest
from datetime import date
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_auth_account_deletion.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient
from sqlalchemy import event

from app.db import Base, SessionLocal, engine
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
from app.achievements_engine import award_xp
from app.models.gamification import XPTransaction
from app.models.nutrition import FoodLog
from app.models.user import User


# SQLite ignores ON DELETE CASCADE unless foreign_keys is switched on per
# connection. The app engine doesn't set it (Postgres in production), so the
# test enables it to exercise the same DB-level cascade path the API relies
# on (User relationships use passive_deletes=True).
@event.listens_for(engine, "connect")
def _enable_sqlite_fks(dbapi_connection, _connection_record) -> None:
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


class AuthAccountDeletionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    def _db(self):
        return SessionLocal()

    def _register(self, email: str) -> tuple[str, dict]:
        response = self.client.post(
            "/api/auth/register",
            json={"email": email, "password": "DeleteMe123!", "name": "Delete Me"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        me = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(me.status_code, 200, me.text)
        return me.json()["id"], headers

    def _seed_food_log_with_xp(self, user_id: str) -> None:
        """Create a food log and award XP for it, mirroring what
        POST /api/nutrition/logs persists. The endpoint itself can't be used
        here: its streak recalc reads dates via func.distinct(FoodLog.date),
        which returns raw strings on SQLite and 500s before responding
        (Postgres returns real dates, so dev/prod are unaffected)."""
        db = self._db()
        try:
            user = db.query(User).filter_by(id=user_id).one()
            db.add(FoodLog(
                user_id=user_id,
                date=date.today(),
                meal_type="lunch",
                title="Chicken and rice",
                nutrition_snapshot={"calories": 550, "protein_g": 42, "carbs_g": 55, "fat_g": 14},
            ))
            # Same call the endpoint makes — commits an xp_transactions row,
            # the FK that made account deletion 500 with ForeignKeyViolation.
            award_xp(db, user, 50, "meal_log")
        finally:
            db.close()

    def test_delete_account_cascades_user_owned_rows(self) -> None:
        user_id, headers = self._register("goodbye@example.com")
        self._seed_food_log_with_xp(user_id)

        db = self._db()
        try:
            self.assertGreater(db.query(FoodLog).filter_by(user_id=user_id).count(), 0)
            self.assertGreater(db.query(XPTransaction).filter_by(user_id=user_id).count(), 0)
        finally:
            db.close()

        response = self.client.delete("/api/auth/account", headers=headers)
        self.assertEqual(response.status_code, 200, response.text)

        db = self._db()
        try:
            self.assertIsNone(db.query(User).filter_by(id=user_id).first())
            self.assertEqual(db.query(FoodLog).filter_by(user_id=user_id).count(), 0)
            self.assertEqual(db.query(XPTransaction).filter_by(user_id=user_id).count(), 0)
        finally:
            db.close()

    def test_deleted_account_token_is_rejected(self) -> None:
        _user_id, headers = self._register("goodbye-again@example.com")

        response = self.client.delete("/api/auth/account", headers=headers)
        self.assertEqual(response.status_code, 200, response.text)

        me = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(me.status_code, 401, me.text)


if __name__ == "__main__":
    unittest.main()
