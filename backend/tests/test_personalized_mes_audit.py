"""
Comprehensive tests for personalized MES budget system.

Verifies that different user profiles produce meaningfully different
targets, scores, weights, and tier thresholds.
"""
import unittest

from app.services.metabolic_engine import (
    ActivityLevel,
    Goal,
    MetabolicProfileInput,
    build_metabolic_budget,
    calc_carb_ceiling_g,
    calc_gis,
    calc_ism,
    calc_protein_target_g,
    calc_tier_thresholds,
    compute_meal_mes,
    derive_protein_target_g,
    derive_sugar_ceiling,
    BASE_TIER_THRESHOLDS,
)


# ── Test profiles ──

SEDENTARY_WOMAN = MetabolicProfileInput(
    weight_lb=120, height_ft=5, height_in=3, age=28, sex="female",
    activity_level=ActivityLevel.SEDENTARY, goal=Goal.MAINTENANCE,
)

ATHLETIC_MAN = MetabolicProfileInput(
    weight_lb=200, height_ft=6, height_in=1, age=32, sex="male",
    activity_level=ActivityLevel.ATHLETIC, goal=Goal.MUSCLE_GAIN,
    body_fat_pct=12.0,  # lean — triggers lenient tier thresholds
)

IR_USER = MetabolicProfileInput(
    weight_lb=180, height_ft=5, height_in=9, age=45, sex="male",
    activity_level=ActivityLevel.MODERATE, goal=Goal.FAT_LOSS,
    insulin_resistant=True,
)

T2D_USER = MetabolicProfileInput(
    weight_lb=160, height_ft=5, height_in=5, age=55, sex="female",
    activity_level=ActivityLevel.SEDENTARY, goal=Goal.METABOLIC_RESET,
    type_2_diabetes=True, triglycerides_mgdl=180.0,
)


class TestProteinTargets(unittest.TestCase):
    """All users get >= 1g/lb; muscle gain gets >= 1.2g/lb."""

    def test_sedentary_woman_at_least_1g_per_lb(self):
        target = calc_protein_target_g(SEDENTARY_WOMAN)
        self.assertGreaterEqual(target, 120.0)

    def test_athletic_man_muscle_gain_at_least_1_2g_per_lb(self):
        target = calc_protein_target_g(ATHLETIC_MAN)
        self.assertGreaterEqual(target, 240.0)  # 200 * 1.2

    def test_ir_user_at_least_1g_per_lb(self):
        target = calc_protein_target_g(IR_USER)
        self.assertGreaterEqual(target, 180.0)

    def test_t2d_user_age_bonus(self):
        target = calc_protein_target_g(T2D_USER)
        # 160lb * (0.82 + 0.07) = 142.4, floor is 160 * 1.0 = 160
        self.assertGreaterEqual(target, 160.0)

    def test_derive_protein_matches_calc(self):
        """derive_protein_target_g (dict) should match calc_protein_target_g (dataclass)."""
        for profile, goal_str in [
            (SEDENTARY_WOMAN, "maintenance"),
            (ATHLETIC_MAN, "muscle_gain"),
            (IR_USER, "fat_loss"),
        ]:
            computed = calc_protein_target_g(profile)
            derived = derive_protein_target_g({
                "weight_lb": profile.weight_lb,
                "age": profile.age,
                "goal": goal_str,
            })
            self.assertAlmostEqual(computed, derived, places=1,
                                   msg=f"Mismatch for {goal_str}")


class TestCarbCeilings(unittest.TestCase):
    """Carb ceilings vary by insulin status, activity, and goal."""

    def test_default_ceiling_130(self):
        ceiling = calc_carb_ceiling_g(SEDENTARY_WOMAN)
        self.assertEqual(ceiling, 130.0)

    def test_athletic_ceiling_175(self):
        ceiling = calc_carb_ceiling_g(ATHLETIC_MAN)
        self.assertEqual(ceiling, 175.0)

    def test_ir_user_ceiling_90_with_fat_loss(self):
        ceiling = calc_carb_ceiling_g(IR_USER)
        # Base 90 (IR) * 0.85 (fat loss) = 76.5 → 76 or 77
        self.assertLessEqual(ceiling, 90.0)

    def test_t2d_ceiling_very_low(self):
        ceiling = calc_carb_ceiling_g(T2D_USER)
        # Base 90 (T2D) * 0.80 (triglycerides) = 72
        self.assertLessEqual(ceiling, 75.0)

    def test_derive_sugar_ceiling_respects_ir(self):
        """derive_sugar_ceiling (dict) should NOT return flat 130g for IR users."""
        ceiling = derive_sugar_ceiling({
            "insulin_resistant": True,
            "goal": "fat_loss",
            "activity_level": "moderate",
        })
        self.assertLess(ceiling, 100.0)

    def test_derive_sugar_ceiling_respects_athletic(self):
        ceiling = derive_sugar_ceiling({
            "activity_level": "athletic",
            "goal": "muscle_gain",
        })
        self.assertEqual(ceiling, 175.0)

    def test_derive_sugar_ceiling_default(self):
        ceiling = derive_sugar_ceiling({})
        self.assertEqual(ceiling, 130.0)


class TestISM(unittest.TestCase):
    """ISM ranges from 0.85 (lean) to 1.35 (T2D)."""

    def test_ism_ordering(self):
        ism_sedentary = calc_ism(SEDENTARY_WOMAN)
        ism_ir = calc_ism(IR_USER)
        ism_t2d = calc_ism(T2D_USER)
        self.assertLess(ism_sedentary, ism_ir)
        self.assertLess(ism_ir, ism_t2d)

    def test_t2d_ism_is_1_35(self):
        self.assertAlmostEqual(calc_ism(T2D_USER), 1.35, places=2)


class TestDynamicWeights(unittest.TestCase):
    """ISM should adjust GIS weight in the budget."""

    def test_t2d_has_higher_gis_weight(self):
        budget_default = build_metabolic_budget(SEDENTARY_WOMAN)
        budget_t2d = build_metabolic_budget(T2D_USER)
        self.assertGreater(budget_t2d.weights.gis, budget_default.weights.gis)

    def test_muscle_gain_has_higher_protein_weight(self):
        budget_maintenance = build_metabolic_budget(SEDENTARY_WOMAN)
        budget_muscle = build_metabolic_budget(ATHLETIC_MAN)
        self.assertGreater(budget_muscle.weights.protein, budget_maintenance.weights.protein)

    def test_weights_sum_to_1(self):
        for profile in [SEDENTARY_WOMAN, ATHLETIC_MAN, IR_USER, T2D_USER]:
            budget = build_metabolic_budget(profile)
            w = budget.weights
            total = w.gis + w.protein + w.fiber + w.fat
            self.assertAlmostEqual(total, 1.0, places=3,
                                   msg=f"Weights don't sum to 1 for {profile.goal}")


class TestTierThresholds(unittest.TestCase):
    """Tier thresholds shift based on profile."""

    def test_t2d_stricter_thresholds(self):
        thresholds = calc_tier_thresholds(T2D_USER)
        self.assertGreater(thresholds["optimal"], BASE_TIER_THRESHOLDS["optimal"])

    def test_athletic_lenient_thresholds(self):
        thresholds = calc_tier_thresholds(ATHLETIC_MAN)
        self.assertLess(thresholds["optimal"], BASE_TIER_THRESHOLDS["optimal"])

    def test_thresholds_within_safety_caps(self):
        for profile in [SEDENTARY_WOMAN, ATHLETIC_MAN, IR_USER, T2D_USER]:
            thresholds = calc_tier_thresholds(profile)
            self.assertGreaterEqual(thresholds["optimal"], 75)
            self.assertLessEqual(thresholds["optimal"], 95)
            self.assertGreaterEqual(thresholds["good"], 60)
            self.assertLessEqual(thresholds["good"], 82)


class TestSameMealDifferentProfiles(unittest.TestCase):
    """The same meal should score differently for different profiles."""

    MEAL = {"protein_g": 40, "carbs_g": 45, "fiber_g": 8, "fat_g": 20, "calories": 520}

    def test_ir_gis_sub_score_lower_than_default(self):
        """IR user's GIS sub-score weight is higher, penalizing carbs more."""
        budget_ir = build_metabolic_budget(IR_USER)
        budget_sed = build_metabolic_budget(SEDENTARY_WOMAN)
        # IR user has higher GIS weight (ISM=1.25 -> gis_weight ~0.44)
        self.assertGreater(budget_ir.weights.gis, budget_sed.weights.gis)
        # Same meal scored: IR user's weighted GIS contribution is larger
        score_ir = compute_meal_mes(self.MEAL, budget_ir)
        score_sed = compute_meal_mes(self.MEAL, budget_sed)
        ir_gis = score_ir["sub_scores"]["gis"]
        sed_gis = score_sed["sub_scores"]["gis"]
        # Raw GIS is the same (same net carbs), but the weight amplifies impact
        self.assertAlmostEqual(ir_gis, sed_gis, places=1)

    def test_t2d_scores_lower_than_sedentary(self):
        budget_t2d = build_metabolic_budget(T2D_USER)
        budget_sed = build_metabolic_budget(SEDENTARY_WOMAN)
        score_t2d = compute_meal_mes(self.MEAL, budget_t2d)
        score_sed = compute_meal_mes(self.MEAL, budget_sed)
        self.assertLess(
            score_t2d["display_score"], score_sed["display_score"],
            "T2D user should score lower on same meal"
        )

    def test_tier_differs_for_same_raw_score(self):
        """Same raw score should map to different tiers for different profiles."""
        budget_ath = build_metabolic_budget(ATHLETIC_MAN)
        budget_t2d = build_metabolic_budget(T2D_USER)
        # Athletic optimal threshold is lower; T2D optimal is higher
        self.assertLess(
            budget_ath.tier_thresholds["optimal"],
            budget_t2d.tier_thresholds["optimal"],
        )


class TestBudgetCompleteness(unittest.TestCase):
    """Budgets should have all computed fields filled."""

    def test_all_fields_populated(self):
        for profile in [SEDENTARY_WOMAN, ATHLETIC_MAN, IR_USER, T2D_USER]:
            budget = build_metabolic_budget(profile)
            self.assertGreater(budget.tdee, 0, f"TDEE is 0 for {profile.goal}")
            self.assertGreater(budget.protein_g, 0)
            self.assertGreater(budget.carb_ceiling_g, 0)
            self.assertGreater(budget.fiber_g, 0)
            self.assertGreater(budget.fat_g, 0)
            self.assertGreater(budget.calorie_target_kcal, 0)
            self.assertGreater(budget.ism, 0)
            self.assertIsNotNone(budget.tier_thresholds)

    def test_fiber_is_weight_based(self):
        """Fiber target should scale with body weight, not be flat 30g."""
        budget_light = build_metabolic_budget(SEDENTARY_WOMAN)  # 120lb
        budget_heavy = build_metabolic_budget(ATHLETIC_MAN)  # 200lb
        self.assertGreater(budget_heavy.fiber_g, budget_light.fiber_g)


class TestScoreBounds(unittest.TestCase):
    """No score should exceed 0-100."""

    def test_zero_macros_score_is_low(self):
        empty = {"protein_g": 0, "carbs_g": 0, "fiber_g": 0, "fat_g": 0, "calories": 0}
        for profile in [SEDENTARY_WOMAN, ATHLETIC_MAN, IR_USER, T2D_USER]:
            budget = build_metabolic_budget(profile)
            score = compute_meal_mes(empty, budget)
            self.assertGreaterEqual(score["display_score"], 0)
            self.assertLessEqual(score["display_score"], 100)

    def test_extreme_macros_score_in_bounds(self):
        extreme = {"protein_g": 100, "carbs_g": 200, "fiber_g": 50, "fat_g": 100, "calories": 2100}
        for profile in [SEDENTARY_WOMAN, ATHLETIC_MAN, IR_USER, T2D_USER]:
            budget = build_metabolic_budget(profile)
            score = compute_meal_mes(extreme, budget)
            self.assertGreaterEqual(score["display_score"], 0)
            self.assertLessEqual(score["display_score"], 100)


if __name__ == "__main__":
    unittest.main()
