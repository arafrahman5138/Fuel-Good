"""Regression coverage for the Batch 2 safety flags (QA findings N1–N4).

Each test encodes the physiological rule the onboarding schema must respect:

  * lactation           → +350 kcal on top of TDEE, overrides fat_loss deficit
  * hypertension        → sodium ceiling 1500 mg (applied at the nutrition
                           router; tested separately in the API-level tests)
  * IBD active flare    → fiber floor drops to 5 g (the one case where we
                           *invert* the body-weight fiber derivation)
  * ED recovery         → flag propagates into the engine input so downstream
                           consumers can toggle off restriction-adjacent UI

The engine is pure math; the router glue is covered elsewhere.
"""
import unittest

from app.models import (  # noqa: F401 ensure mappers configured
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
    LACTATION_CALORIE_BONUS_KCAL,
    LOW_RESIDUE_FIBER_FLOOR_G,
    MetabolicProfileInput,
    build_metabolic_budget,
)


def _elena() -> MetabolicProfileInput:
    return MetabolicProfileInput(
        weight_lb=158, height_ft=5, height_in=4, age=34, sex="female",
        activity_level=ActivityLevel.MODERATE, goal=Goal.FAT_LOSS,
    )


def _meg() -> MetabolicProfileInput:
    return MetabolicProfileInput(
        weight_lb=138, height_ft=5, height_in=5, age=67, sex="female",
        activity_level=ActivityLevel.SEDENTARY, goal=Goal.MAINTENANCE,
    )


class Batch2SafetyFlags(unittest.TestCase):
    """The four safety-critical gaps from the 2026-04-16 QA report."""

    def test_lactation_calorie_bonus_overrides_fat_loss_deficit(self) -> None:
        """QA N1: breastfeeding mom on a fat-loss goal must eat above TDEE."""
        base = _elena()
        lactating = MetabolicProfileInput(**{**base.__dict__, "lactating": True, "months_postpartum": 5})
        base_budget = build_metabolic_budget(base)
        lactating_budget = build_metabolic_budget(lactating)

        # Without the flag, fat-loss deficit puts target under TDEE.
        self.assertLess(base_budget.calorie_target_kcal, base_budget.tdee)
        # With the flag, target must be at least TDEE + bonus.
        self.assertGreaterEqual(
            lactating_budget.calorie_target_kcal,
            lactating_budget.tdee + LACTATION_CALORIE_BONUS_KCAL,
        )
        # And above TDEE, not below — the whole point of the fix.
        self.assertGreater(lactating_budget.calorie_target_kcal, lactating_budget.tdee)

    def test_low_residue_inverts_fiber_floor(self) -> None:
        """QA N3: active IBD flare must drop fiber floor to 5 g (not 25+)."""
        base = _meg()
        flare = MetabolicProfileInput(**{**base.__dict__, "ibd_active_flare": True, "low_residue_required": True})

        base_budget = build_metabolic_budget(base)
        flare_budget = build_metabolic_budget(flare)

        # Baseline assumes healthy whole-food user; fiber is high.
        self.assertGreater(base_budget.fiber_g, 15)
        # With the flag, fiber floor is clinical low-residue.
        self.assertEqual(flare_budget.fiber_g, LOW_RESIDUE_FIBER_FLOOR_G)

    def test_ibd_flag_alone_also_inverts_fiber(self) -> None:
        """A user who toggled `ibd_active_flare` but not `low_residue_required`
        still gets the safer fiber floor. Either flag is sufficient."""
        base = _meg()
        ibd_only = MetabolicProfileInput(**{**base.__dict__, "ibd_active_flare": True})
        budget = build_metabolic_budget(ibd_only)
        self.assertEqual(budget.fiber_g, LOW_RESIDUE_FIBER_FLOOR_G)

    def test_safety_flags_default_false(self) -> None:
        """Existing profiles without the new fields behave exactly as before."""
        profile = _elena()
        # All four safety flags should default to False/None on a fresh dataclass.
        self.assertFalse(profile.lactating)
        self.assertFalse(profile.hypertension)
        self.assertFalse(profile.ibd_active_flare)
        self.assertFalse(profile.low_residue_required)
        self.assertFalse(profile.eating_disorder_recovery)
        self.assertIsNone(profile.months_postpartum)

    def test_lactation_does_not_clamp_below_existing_surplus(self) -> None:
        """If a user is already on a surplus goal (muscle_gain) and flips on
        lactation, the target stays at whichever is higher, never drops."""
        base = MetabolicProfileInput(
            weight_lb=160, height_ft=5, height_in=6, age=30, sex="female",
            activity_level=ActivityLevel.ATHLETIC, goal=Goal.MUSCLE_GAIN,
        )
        lactating = MetabolicProfileInput(**{**base.__dict__, "lactating": True})
        self.assertGreaterEqual(
            build_metabolic_budget(lactating).calorie_target_kcal,
            build_metabolic_budget(base).calorie_target_kcal,
        )


if __name__ == "__main__":
    unittest.main()
