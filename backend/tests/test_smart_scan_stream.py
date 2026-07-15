"""Tests for /api/scan/smart/stream (and the shared stream generator).

Regressions covered:
  * Event order for a meal image: quality → components → final.
  * A label image emits a terminal `label` event — pre-refactor the stream
    generator had no label branch and crashed on result["meal_context"].
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

TEST_DB_PATH = Path(__file__).with_name("test_smart_scan_stream.sqlite3")
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
from app.models.product_label_scan import ProductLabelScan
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.services import scan_cache


def _fake_jpeg_bytes(seed: bytes = b"s") -> bytes:
    return b"\xff\xd8\xff\xe0" + seed * 32


_MEAL_RESULT = {
    "scan_type": "meal",
    "is_beverage": False,
    "meal_label": "Grilled Chicken with Quinoa",
    "meal_context": "full_meal",
    "meal_type": "lunch",
    "portion_size": "medium",
    "source_context": "home",
    "components": [
        {"name": "grilled chicken breast", "role": "protein", "mass_fraction": 0.5},
        {"name": "quinoa", "role": "whole_carb", "mass_fraction": 0.5},
    ],
    "estimated_ingredients": ["Grilled Chicken Breast", "Quinoa"],
    "normalized_ingredients": ["grilled chicken breast", "quinoa"],
    "nutrition_estimate": {"calories": 420, "protein": 38, "carbs": 40, "fat": 10, "fiber": 7, "sugar_g": 3},
    "whole_food_status": "pass",
    "whole_food_flags": [],
    "suggested_swaps": {},
    "mes": None,
    "confidence": 0.92,
    "confidence_breakdown": {"extraction": 0.9, "portion": 0.8},
    "upgrade_suggestions": [],
    "recovery_plan": [],
    "source_model": "gemini-2.5-flash",
    "prompt_version": "meal_scan_v5_grams",
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

_LABEL_RESULT = {
    "scan_type": "label",
    "label": {
        "product_name": "Plain Greek Yogurt",
        "raw_product_name": "Plain Greek Yogurt",
        "brand": "Fage",
        "ingredients_text": "Pasteurized milk, live active cultures",
        "confidence": 0.92,
        "confidence_breakdown": {"ocr": 0.9, "ingredients": 0.95, "nutrition": 0.9, "metadata": 0.9},
        "score": 92,
        "tier": "whole_food",
        "verdict": "Great choice",
    },
    "meal_label": "Plain Greek Yogurt",
    "confidence": 0.92,
}


def _parse_sse(body: str) -> list[tuple[str, str]]:
    events: list[tuple[str, str]] = []
    for frame in body.split("\n\n"):
        lines = frame.strip().splitlines()
        if not lines:
            continue
        name = ""
        data = ""
        for line in lines:
            if line.startswith("event: "):
                name = line[len("event: "):]
            elif line.startswith("data: "):
                data = line[len("data: "):]
        if name:
            events.append((name, data))
    return events


class SmartScanStreamTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        scan_cache.clear_all()

    def _token(self) -> str:
        db = SessionLocal()
        try:
            user = User(
                email="stream@example.com",
                name="Stream",
                hashed_password=get_password_hash("Pass1234!"),
                access_override_level="premium",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return create_token_pair(str(user.id))["access_token"]
        finally:
            db.close()

    def _post_stream(self, token: str, seed: bytes) -> list[tuple[str, str]]:
        response = self.client.post(
            "/api/scan/smart/stream",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("food.jpg", _fake_jpeg_bytes(seed), "image/jpeg")},
            data={"source_context": "home"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return _parse_sse(response.text)

    def test_meal_stream_emits_quality_components_final(self) -> None:
        token = self._token()
        with patch(
            "app.routers.scan.analyze_meal_scan",
            new_callable=AsyncMock, return_value=dict(_MEAL_RESULT),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            events = self._post_stream(token, b"m")
        names = [n for n, _ in events]
        self.assertEqual(names, ["quality", "components", "final"])
        db = SessionLocal()
        try:
            self.assertEqual(db.query(ScannedMealLog).count(), 1)
        finally:
            db.close()

    def test_label_stream_emits_label_event_and_persists_label_row(self) -> None:
        token = self._token()
        with patch(
            "app.routers.scan.analyze_meal_scan",
            new_callable=AsyncMock, return_value=dict(_LABEL_RESULT),
        ), patch(
            "app.routers.scan.is_supabase_storage_configured", return_value=False,
        ):
            events = self._post_stream(token, b"l")
        names = [n for n, _ in events]
        self.assertEqual(names, ["quality", "label"])
        db = SessionLocal()
        try:
            self.assertEqual(db.query(ProductLabelScan).count(), 1)
            self.assertEqual(db.query(ScannedMealLog).count(), 0)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
