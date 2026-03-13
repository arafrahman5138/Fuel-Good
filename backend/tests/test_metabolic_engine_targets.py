import unittest

from app.services.metabolic_engine import (
    ActivityLevel,
    Goal,
    MetabolicProfileInput,
    build_metabolic_budget,
    calc_macro_calorie_target_kcal,
    calc_protein_target_g,
    derive_protein_target_g,
)


class MetabolicEngineTargetTests(unittest.TestCase):
    def test_protein_target_never_drops_below_body_weight(self) -> None:
        profile = MetabolicProfileInput(
            weight_lb=165,
            height_ft=5,
            height_in=7,
            age=30,
            sex="male",
            activity_level=ActivityLevel.MODERATE,
            goal=Goal.MAINTENANCE,
        )
        self.assertGreaterEqual(calc_protein_target_g(profile), 165.0)

    def test_derived_and_computed_protein_targets_match(self) -> None:
        profile = MetabolicProfileInput(
            weight_lb=220,
            height_ft=6,
            height_in=1,
            age=60,
            sex="female",
            activity_level=ActivityLevel.ACTIVE,
            goal=Goal.MUSCLE_GAIN,
        )
        computed = calc_protein_target_g(profile)
        derived = derive_protein_target_g({
            "sex": "female",
            "age": 60,
            "weight_lb": 220,
            "goal": "muscle_gain",
        })
        self.assertAlmostEqual(computed, derived, places=1)

    def test_fat_target_stays_in_practical_weight_band(self) -> None:
        profile = MetabolicProfileInput(
            weight_lb=110,
            height_ft=4,
            height_in=11,
            age=30,
            sex="male",
            activity_level=ActivityLevel.ATHLETIC,
            goal=Goal.FAT_LOSS,
            insulin_resistant=True,
        )
        budget = build_metabolic_budget(profile)
        self.assertGreaterEqual(budget.fat_g / profile.weight_lb, 0.35)
        self.assertLessEqual(budget.fat_g / profile.weight_lb, 0.65)

    def test_macro_calorie_target_matches_budget(self) -> None:
        profile = MetabolicProfileInput(
            weight_lb=165,
            height_ft=5,
            height_in=7,
            age=30,
            sex="male",
            activity_level=ActivityLevel.ACTIVE,
            goal=Goal.MAINTENANCE,
        )
        budget = build_metabolic_budget(profile)
        expected = calc_macro_calorie_target_kcal(
            budget.protein_g,
            budget.carb_ceiling_g,
            budget.fat_g,
        )
        self.assertAlmostEqual(budget.calorie_target_kcal, expected, places=1)


if __name__ == "__main__":
    unittest.main()
