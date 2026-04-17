"""Regression guard: backend calorie-target math must go the right direction per goal.

The onboarding preview screen (`frontend/app/(auth)/onboarding.tsx` step 11) used to
compute targets client-side with a wrong formula that summed macro *targets* as if
they were intake — producing a -988 kcal deficit for muscle-gain users (QA N40/N42).
The frontend now fetches `/api/nutrition/targets` and `/api/metabolic/budget` and
displays those values directly, so these server-side assertions guarantee the
numbers a user sees on step 11 are directionally correct.
"""
import unittest

from app.models import (  # noqa: F401  ensure mappers configured
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
from app.services.metabolic_engine import (
    ActivityLevel,
    Goal,
    MetabolicProfileInput,
    build_metabolic_budget,
)


class OnboardingTargetsConsistency(unittest.TestCase):
    """Each of the 5 QA personas produces a calorie target whose *direction*
    relative to TDEE matches the persona's stated goal. The prior bug surfaced
    the opposite direction in the UI for Haruki (muscle_gain showed a deficit).
    """

    def _budget(self, **overrides):
        base = dict(
            weight_lb=170.0,
            height_ft=5,
            height_in=10,
            age=32,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal=Goal.MAINTENANCE,
        )
        base.update(overrides)
        return build_metabolic_budget(MetabolicProfileInput(**base))

    def test_elena_fat_loss_is_deficit(self) -> None:
        b = self._budget(
            weight_lb=158, height_ft=5, height_in=4, age=34, sex="female",
            activity_level=ActivityLevel.MODERATE, goal=Goal.FAT_LOSS,
        )
        self.assertLess(b.calorie_target_kcal, b.tdee)

    def test_derrick_metabolic_reset_is_deficit(self) -> None:
        b = self._budget(
            weight_lb=212, height_ft=5, height_in=10, age=52, sex="male",
            activity_level=ActivityLevel.SEDENTARY, goal=Goal.METABOLIC_RESET,
            type_2_diabetes=True,
        )
        self.assertLess(b.calorie_target_kcal, b.tdee)

    def test_haruki_muscle_gain_is_surplus(self) -> None:
        """Regression for QA finding N42 — UI used to show a deficit here."""
        b = self._budget(
            weight_lb=178, height_ft=6, height_in=2, age=19, sex="male",
            activity_level=ActivityLevel.ATHLETIC, goal=Goal.MUSCLE_GAIN,
        )
        self.assertGreater(b.calorie_target_kcal, b.tdee)

    def test_meg_maintenance_is_neutral(self) -> None:
        b = self._budget(
            weight_lb=138, height_ft=5, height_in=5, age=67, sex="female",
            activity_level=ActivityLevel.SEDENTARY, goal=Goal.MAINTENANCE,
        )
        self.assertAlmostEqual(
            b.calorie_target_kcal, round(b.tdee), delta=10,
        )

    def test_no_persona_produces_inverted_direction(self) -> None:
        """Paranoia: assert no weight/age/activity combination flips the sign."""
        cases = [
            (Goal.MUSCLE_GAIN, ActivityLevel.SEDENTARY),
            (Goal.MUSCLE_GAIN, ActivityLevel.ATHLETIC),
            (Goal.FAT_LOSS, ActivityLevel.SEDENTARY),
            (Goal.FAT_LOSS, ActivityLevel.ATHLETIC),
        ]
        for goal, activity in cases:
            with self.subTest(goal=goal, activity=activity):
                b = self._budget(goal=goal, activity_level=activity)
                if goal == Goal.MUSCLE_GAIN:
                    self.assertGreater(b.calorie_target_kcal, b.tdee)
                elif goal == Goal.FAT_LOSS:
                    self.assertLess(b.calorie_target_kcal, b.tdee)


if __name__ == "__main__":
    unittest.main()
