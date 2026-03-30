import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_auth_password_reset.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient

from app.auth import get_password_hash
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


class AuthPasswordResetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])

    def _db(self):
        return SessionLocal()

    def _create_user(self, email: str, password: str = "OldPass123!") -> User:
        db = self._db()
        try:
            user = User(
                email=email,
                name="Reset User",
                hashed_password=get_password_hash(password),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    def test_forgot_password_returns_dev_code_for_existing_user(self) -> None:
        self._create_user("reset@example.com")

        response = self.client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertIn("message", body)
        self.assertRegex(body.get("reset_code") or "", r"^\d{6}$")
        self.assertEqual(body.get("expires_in_minutes"), 30)

    def test_forgot_password_is_generic_for_unknown_user(self) -> None:
        response = self.client.post("/api/auth/forgot-password", json={"email": "missing@example.com"})

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertIn("message", body)
        self.assertIsNone(body.get("reset_code"))

    def test_reset_password_updates_login_credentials(self) -> None:
        self._create_user("reset@example.com", password="OldPass123!")

        forgot = self.client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
        self.assertEqual(forgot.status_code, 200, forgot.text)
        code = forgot.json()["reset_code"]

        reset = self.client.post(
            "/api/auth/reset-password",
            json={"email": "reset@example.com", "code": code, "new_password": "NewPass456!"},
        )
        self.assertEqual(reset.status_code, 200, reset.text)

        old_login = self.client.post(
            "/api/auth/login",
            json={"email": "reset@example.com", "password": "OldPass123!"},
        )
        self.assertEqual(old_login.status_code, 401, old_login.text)

        new_login = self.client.post(
            "/api/auth/login",
            json={"email": "reset@example.com", "password": "NewPass456!"},
        )
        self.assertEqual(new_login.status_code, 200, new_login.text)
        self.assertTrue(new_login.json().get("access_token"))


if __name__ == "__main__":
    unittest.main()
