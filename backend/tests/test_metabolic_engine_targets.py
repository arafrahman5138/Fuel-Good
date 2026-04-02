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
        # Maintenance goal: calorie target should equal TDEE
        self.assertAlmostEqual(budget.calorie_target_kcal, round(budget.tdee), places=0)

    def test_muscle_gain_has_calorie_surplus(self) -> None:
        profile = MetabolicProfileInput(
            weight_lb=185,
            height_ft=6,
            height_in=1,
            age=24,
            sex="male",
            activity_level=ActivityLevel.ATHLETIC,
            goal=Goal.MUSCLE_GAIN,
        )
        budget = build_metabolic_budget(profile)
        # Muscle gain: calorie target should be ~10% above TDEE
        self.assertGreater(budget.calorie_target_kcal, budget.tdee)
        self.assertAlmostEqual(budget.calorie_target_kcal, round(budget.tdee * 1.10), places=0)

    def test_fat_loss_has_calorie_deficit(self) -> None:
        profile = MetabolicProfileInput(
            weight_lb=195,
            height_ft=5,
            height_in=4,
            age=52,
            sex="female",
            activity_level=ActivityLevel.SEDENTARY,
            goal=Goal.FAT_LOSS,
        )
        budget = build_metabolic_budget(profile)
        # Fat loss: calorie target should be ~20% below TDEE
        self.assertLess(budget.calorie_target_kcal, budget.tdee)
        self.assertAlmostEqual(budget.calorie_target_kcal, round(budget.tdee * 0.80), places=0)

    def test_t2d_sugar_ceiling_stricter_than_ir(self) -> None:
        """T2D patients must have a lower carb ceiling than insulin-resistant patients."""
        t2d_profile = MetabolicProfileInput(
            weight_lb=245, height_ft=5, height_in=10, age=62,
            sex="male", activity_level=ActivityLevel.SEDENTARY,
            goal=Goal.METABOLIC_RESET, type_2_diabetes=True,
        )
        ir_profile = MetabolicProfileInput(
            weight_lb=195, height_ft=5, height_in=4, age=52,
            sex="female", activity_level=ActivityLevel.SEDENTARY,
            goal=Goal.FAT_LOSS, insulin_resistant=True, prediabetes=True,
        )
        t2d_budget = build_metabolic_budget(t2d_profile)
        ir_budget = build_metabolic_budget(ir_profile)
        self.assertLessEqual(t2d_budget.carb_ceiling_g, ir_budget.carb_ceiling_g,
            f"T2D ceiling ({t2d_budget.carb_ceiling_g}g) should be <= IR ceiling ({ir_budget.carb_ceiling_g}g)")


if __name__ == "__main__":
    unittest.main()
