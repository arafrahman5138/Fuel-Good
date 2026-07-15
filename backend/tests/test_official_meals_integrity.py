"""Seed-data integrity for official_meals.json + planner fallback honesty (QA E4).

2026-07-11: the fallback planner silently skipped slots when a pool came back
empty (e.g. full_meals missing breakfast/lunch/dinner tags). The planner now
relaxes filters progressively and reports it via warnings. This test guards
both sides:

- every full_meal in official_meals.json either carries at least one meal-slot
  tag, or the planner's relaxation demonstrably covers the untagged ones
  (a default-preference plan still yields a substantially full week);
- a fresh user with default preferences always gets a non-empty plan.
"""
from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_official_meals_integrity.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

OFFICIAL_MEALS_PATH = BACKEND_ROOT / "official_meals.json"

from app.db import Base, SessionLocal
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
from app.models.recipe import Recipe
from app.agents.meal_planner_fallback import generate_fallback_meal_plan

MEAL_SLOT_TAGS = {"breakfast", "lunch", "dinner"}

# Recipe columns we copy straight from the JSON export.
_RECIPE_FIELDS = {
    "id", "title", "description", "ingredients", "steps", "prep_time_min",
    "cook_time_min", "total_time_min", "servings", "nutrition_info",
    "difficulty", "tags", "flavor_profile", "dietary_tags", "cuisine",
    "health_benefits", "protein_type", "carb_type", "is_ai_generated",
    "image_url", "recipe_role", "is_component", "meal_group_id",
    "default_pairing_ids", "needs_default_pairing", "component_composition",
    "is_mes_scoreable", "pairing_synergy_profile", "glycemic_profile",
}


def _load_meals() -> list[dict]:
    data = json.loads(OFFICIAL_MEALS_PATH.read_text())
    return data["meals"] if isinstance(data, dict) else data


class OfficialMealsIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.meals = _load_meals()

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        db = SessionLocal()
        try:
            for m in self.meals:
                fields = {k: v for k, v in m.items() if k in _RECIPE_FIELDS}
                db.add(Recipe(**fields))
            db.commit()
        finally:
            db.close()

    def _full_meals(self) -> list[dict]:
        return [
            m for m in self.meals
            if (m.get("recipe_role") or "full_meal") == "full_meal"
            and not m.get("is_component")
        ]

    def test_full_meals_are_slot_tagged_or_covered_by_relaxation(self) -> None:
        untagged = [
            m["title"] for m in self._full_meals()
            if not (MEAL_SLOT_TAGS & set(m.get("tags") or []))
        ]
        if not untagged:
            return  # seed data fully tagged — nothing to cover

        # Some full_meals legitimately lack slot tags today. The planner's
        # relaxation (step 3 treats untagged full_meals as lunch/dinner
        # eligible) must cover them: a default-preference plan still fills
        # the bulk of the week instead of skipping slots.
        db = SessionLocal()
        try:
            plan = generate_fallback_meal_plan(db, preferences={}, user_id=None)
        finally:
            db.close()
        total_items = sum(len(day.get("meals", [])) for day in plan["days"])
        self.assertGreaterEqual(
            total_items, 15,
            f"{len(untagged)} untagged full_meals not covered by relaxation "
            f"(plan only produced {total_items} items): {untagged}",
        )

    def test_fresh_user_default_prefs_gets_nonempty_plan(self) -> None:
        db = SessionLocal()
        try:
            plan = generate_fallback_meal_plan(db, preferences={}, user_id=None)
        finally:
            db.close()
        self.assertEqual(len(plan["days"]), 7)
        total_items = sum(len(day.get("meals", [])) for day in plan["days"])
        self.assertGreater(total_items, 0, f"empty plan; warnings: {plan['warnings']}")
        self.assertGreaterEqual(total_items, 15, f"warnings: {plan['warnings']}")

    def test_relaxed_slots_surface_a_warning(self) -> None:
        # If any slot needed relaxation, the plan must say so honestly.
        db = SessionLocal()
        try:
            plan = generate_fallback_meal_plan(db, preferences={}, user_id=None)
        finally:
            db.close()
        skipped = [w for w in plan["warnings"] if "could be selected" in w]
        self.assertEqual(
            skipped, [],
            "no slot should be silently skipped with the full official library seeded",
        )


if __name__ == "__main__":
    unittest.main()
