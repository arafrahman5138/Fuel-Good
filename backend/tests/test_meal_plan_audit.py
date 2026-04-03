"""
Comprehensive Meal Plan Audit

Tests meal plan generation across 8 diverse user profiles,
validating: budget accuracy, plan structure, MES scoring,
nutritional compliance, dietary restrictions, and edge cases.

Run:  python -m pytest tests/test_meal_plan_audit.py -v -s
"""
import os
import sys
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_meal_plan_audit.sqlite3")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient

from app.auth import get_password_hash
from app.db import Base, SessionLocal
from app.main import app
from app.models import (  # noqa: F401 — ensure all tables are registered
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
from app.services.metabolic_engine import (
    ActivityLevel,
    Goal,
    MetabolicProfileInput,
    build_metabolic_budget,
    calc_tdee,
    calc_protein_target_g,
    calc_carb_ceiling_g,
    calc_fat_target_g,
    calc_macro_calorie_target_kcal,
    compute_meal_mes,
)

# ── seed helpers ────────────────────────────────────────────────
from seed_db import _build_recipe, _load_seed_meals

ALL_MEALS = _load_seed_meals()


# ═══════════════════════════════════════════════════════════════
#  TEST PROFILE DEFINITIONS
# ═══════════════════════════════════════════════════════════════

PROFILES = {
    "baseline_male": {
        "label": "Baseline 30M maintenance moderate",
        "profile": {
            "sex": "male", "age": 30, "height_ft": 5, "height_in": 7,
            "weight_lb": 165, "goal": "maintenance", "activity_level": "moderate",
        },
        "preferences": {},
    },
    "young_female_fat_loss": {
        "label": "25F 130lb fat_loss active",
        "profile": {
            "sex": "female", "age": 25, "height_ft": 5, "height_in": 4,
            "weight_lb": 130, "goal": "fat_loss", "activity_level": "active",
        },
        "preferences": {},
    },
    "older_diabetic_male": {
        "label": "55M 250lb fat_loss sedentary + type_2_diabetes",
        "profile": {
            "sex": "male", "age": 55, "height_ft": 6, "height_in": 0,
            "weight_lb": 250, "goal": "fat_loss", "activity_level": "sedentary",
            "type_2_diabetes": True,
        },
        "preferences": {},
    },
    "athletic_muscle_gain": {
        "label": "22M 180lb muscle_gain athletic",
        "profile": {
            "sex": "male", "age": 22, "height_ft": 6, "height_in": 1,
            "weight_lb": 180, "goal": "muscle_gain", "activity_level": "athletic",
        },
        "preferences": {},
    },
    "prediabetic_female": {
        "label": "45F 160lb metabolic_reset moderate + prediabetes + high trig",
        "profile": {
            "sex": "female", "age": 45, "height_ft": 5, "height_in": 6,
            "weight_lb": 160, "goal": "metabolic_reset", "activity_level": "moderate",
            "prediabetes": True, "triglycerides_mgdl": 180,
        },
        "preferences": {},
    },
    "elderly_male": {
        "label": "70M 150lb maintenance sedentary",
        "profile": {
            "sex": "male", "age": 70, "height_ft": 5, "height_in": 5,
            "weight_lb": 150, "goal": "maintenance", "activity_level": "sedentary",
        },
        "preferences": {},
    },
    "small_frame_ir_female": {
        "label": "28F 120lb fat_loss active + insulin_resistant",
        "profile": {
            "sex": "female", "age": 28, "height_ft": 5, "height_in": 2,
            "weight_lb": 120, "goal": "fat_loss", "activity_level": "active",
            "insulin_resistant": True,
        },
        "preferences": {},
    },
    "active_muscle_male": {
        "label": "35M 200lb muscle_gain active",
        "profile": {
            "sex": "male", "age": 35, "height_ft": 5, "height_in": 10,
            "weight_lb": 200, "goal": "muscle_gain", "activity_level": "active",
        },
        "preferences": {},
    },
}

WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MEAL_TYPES = ["breakfast", "lunch", "dinner"]

MEAT_KEYWORDS = [
    "chicken", "beef", "pork", "lamb", "turkey", "duck", "bacon",
    "steak", "sausage", "prosciutto", "bison", "oxtail",
    "liver", "shrimp", "salmon", "tuna", "cod", "tilapia", "fish",
    "sole", "sardine", "mackerel", "trout", "scallop", "crab",
    "lobster", "anchovies", "mahi", "snapper",
]
# "goat" excluded from meat keywords -- "goat cheese" is vegetarian (dairy)
DAIRY_KEYWORDS = [
    "milk", "cheese", "cream", "butter", "yogurt", "whey", "ghee",
    "ricotta", "mozzarella", "parmesan", "feta", "gouda", "brie",
    "cheddar", "goat cheese", "sour cream", "cream cheese",
]
GLUTEN_KEYWORDS = [
    "wheat", "flour", "bread", "pasta", "tortilla", "rye",
    "barley", "couscous", "soy sauce", "panko", "crouton",
    "pita", "naan", "biscuit", "cracker",
]


class MealPlanAudit(unittest.TestCase):
    """End-to-end audit of meal plan generation across diverse profiles."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Fresh DB every run
        Base.metadata.drop_all(bind=SessionLocal.kw["bind"])
        Base.metadata.create_all(bind=SessionLocal.kw["bind"])
        cls._seed_recipes()
        cls._user_counter = 0
        cls._generated_plans = {}
        cls._budgets = {}
        cls._findings = []  # collects all findings for summary

    @classmethod
    def _seed_recipes(cls):
        db = SessionLocal()
        try:
            count = 0
            for meal in ALL_MEALS:
                existing = db.query(recipe.Recipe).filter(recipe.Recipe.title == meal["title"]).first()
                if not existing:
                    r = _build_recipe(meal)
                    db.add(r)
                    count += 1
            db.commit()
            print(f"\n[SEED] Inserted {count} recipes, {len(ALL_MEALS)} total in catalogue")
        finally:
            db.close()

    # ── Helper: create user + profile + generate plan ──────────
    def _create_user_and_plan(self, key: str, extra_prefs: dict | None = None):
        import json
        cache_key = f"{key}:{json.dumps(extra_prefs, sort_keys=True)}" if extra_prefs else key
        if cache_key in self._generated_plans:
            return self._generated_plans[cache_key]

        cfg = PROFILES[key]
        self.__class__._user_counter += 1
        email = f"audit_{key}_{self._user_counter}@test.com"

        # Register
        resp = self.client.post("/api/auth/register", json={
            "email": email, "password": "AuditPass123", "name": cfg["label"],
        })
        self.assertEqual(resp.status_code, 200, f"Registration failed for {key}: {resp.text}")
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Set metabolic profile
        resp = self.client.post("/api/metabolic/profile", json=cfg["profile"], headers=headers)
        self.assertEqual(resp.status_code, 200, f"Profile failed for {key}: {resp.text}")

        # Get budget
        resp = self.client.get("/api/metabolic/budget", headers=headers)
        self.assertEqual(resp.status_code, 200, f"Budget failed for {key}: {resp.text}")
        budget_data = resp.json()

        # Generate meal plan
        prefs = {**cfg.get("preferences", {}), **(extra_prefs or {})}
        body = {"preferences": {"household_size": 1, "meals_per_day": 3, **prefs}}
        resp = self.client.post("/api/meal-plans/generate", json=body, headers=headers)
        self.assertEqual(resp.status_code, 200, f"Meal plan generation failed for {key}: {resp.text}")
        plan = resp.json()

        self._generated_plans[cache_key] = plan
        self._budgets[cache_key] = budget_data
        return plan

    def _finding(self, severity: str, profile: str, msg: str):
        entry = f"[{severity}] {profile}: {msg}"
        self._findings.append(entry)
        print(f"  FINDING: {entry}")

    # ═══════════════════════════════════════════════════════════
    #  A. BUDGET ACCURACY
    # ═══════════════════════════════════════════════════════════

    def test_A_budget_accuracy_all_profiles(self):
        """Verify computed budgets match engine formulas for all 8 profiles."""
        print("\n" + "=" * 70)
        print("A. BUDGET ACCURACY TESTS")
        print("=" * 70)

        for key, cfg in PROFILES.items():
            with self.subTest(profile=key):
                plan = self._create_user_and_plan(key)
                budget = self._budgets[key]
                p = cfg["profile"]

                # Build reference budget from engine
                profile_input = MetabolicProfileInput(
                    weight_lb=p["weight_lb"],
                    height_ft=p["height_ft"],
                    height_in=p["height_in"],
                    age=p["age"],
                    sex=p["sex"],
                    activity_level=ActivityLevel(p["activity_level"]),
                    goal=Goal(p["goal"]),
                    insulin_resistant=p.get("insulin_resistant", False),
                    prediabetes=p.get("prediabetes", False),
                    type_2_diabetes=p.get("type_2_diabetes", False),
                    triglycerides_mgdl=p.get("triglycerides_mgdl"),
                )
                ref = build_metabolic_budget(profile_input)

                print(f"\n  [{key}] TDEE={ref.tdee} | Protein={ref.protein_g}g | Carbs={ref.carb_ceiling_g}g | Fat={ref.fat_g}g | Cal={ref.calorie_target_kcal}")

                # Protein >= weight_lb * floor_ratio
                floor_ratio = 1.2 if p["goal"] == "muscle_gain" else 1.0
                protein_floor = p["weight_lb"] * floor_ratio
                api_protein = float(budget.get("protein_target_g", 0))
                self.assertGreaterEqual(
                    api_protein, protein_floor - 1,
                    f"{key}: Protein {api_protein}g < floor {protein_floor}g"
                )

                # Fat in practical band
                api_fat = float(budget.get("fat_target_g", 0))
                fat_lo = p["weight_lb"] * 0.35
                fat_hi = p["weight_lb"] * 0.65
                if not (fat_lo - 1 <= api_fat <= fat_hi + 1):
                    self._finding("WARN", key, f"Fat {api_fat}g outside band [{fat_lo:.0f}-{fat_hi:.0f}]")

                # Carb ceiling for insulin resistance
                api_carbs = float(budget.get("sugar_ceiling_g", 0))
                if p.get("type_2_diabetes") or p.get("insulin_resistant"):
                    self.assertLessEqual(
                        api_carbs, 100,
                        f"{key}: IR/T2D carbs {api_carbs}g should be <= 100g"
                    )

                # Verify reference matches API within tolerance
                self.assertAlmostEqual(api_protein, ref.protein_g, delta=2,
                    msg=f"{key}: API protein {api_protein} != engine {ref.protein_g}")

                print(f"    API budget: protein={api_protein}g carbs={api_carbs}g fat={api_fat}g")

    # ═══════════════════════════════════════════════════════════
    #  B. MEAL PLAN STRUCTURE
    # ═══════════════════════════════════════════════════════════

    def test_B_plan_structure_all_profiles(self):
        """Verify structural integrity: 21 items, all days/slots covered, no same-day duplicates."""
        print("\n" + "=" * 70)
        print("B. PLAN STRUCTURE TESTS")
        print("=" * 70)

        for key in PROFILES:
            with self.subTest(profile=key):
                plan = self._create_user_and_plan(key)
                items = plan["items"]
                warnings = plan.get("warnings", [])

                if warnings:
                    for w in warnings:
                        self._finding("WARN", key, f"Generation warning: {w}")

                # Count items
                total = len(items)
                print(f"\n  [{key}] Items: {total}, Warnings: {len(warnings)}")

                # Should have 21 items (allow fewer only if warnings about missing slots)
                if total < 21:
                    self._finding("HIGH", key, f"Only {total}/21 meal items generated")
                self.assertGreater(total, 0, f"{key}: Zero items generated!")

                # Check each day has all meal types
                day_meals = {}
                for item in items:
                    day = item["day_of_week"]
                    mt = item["meal_type"]
                    day_meals.setdefault(day, set()).add(mt)

                for day in WEEK_DAYS:
                    if day not in day_meals:
                        self._finding("HIGH", key, f"Missing day: {day}")
                        continue
                    for mt in MEAL_TYPES:
                        if mt not in day_meals[day]:
                            self._finding("HIGH", key, f"{day} missing {mt}")

                # No same-day duplicate recipe
                for day in WEEK_DAYS:
                    day_items = [i for i in items if i["day_of_week"] == day]
                    titles = [i.get("recipe_title") or i.get("recipe_data", {}).get("title", "") for i in day_items]
                    seen = set()
                    for t in titles:
                        if t and t in seen:
                            self._finding("MEDIUM", key, f"Duplicate recipe on {day}: {t}")
                        seen.add(t)

                # Recipe variety: count unique titles per meal type
                for mt in MEAL_TYPES:
                    mt_items = [i for i in items if i["meal_type"] == mt]
                    unique = len(set(i.get("recipe_title", "") for i in mt_items))
                    print(f"    {mt}: {unique} unique recipes across 7 days")
                    if unique < 2:
                        self._finding("MEDIUM", key, f"Only {unique} unique {mt} recipe(s)")

    # ═══════════════════════════════════════════════════════════
    #  C. MES SCORE ACCURACY
    # ═══════════════════════════════════════════════════════════

    def test_C_mes_scoring_accuracy(self):
        """Recompute MES from nutrition data and compare to returned scores."""
        print("\n" + "=" * 70)
        print("C. MES SCORING ACCURACY TESTS")
        print("=" * 70)

        for key in PROFILES:
            with self.subTest(profile=key):
                plan = self._create_user_and_plan(key)
                items = plan["items"]
                cfg = PROFILES[key]
                p = cfg["profile"]

                # Build reference budget
                profile_input = MetabolicProfileInput(
                    weight_lb=p["weight_lb"],
                    height_ft=p["height_ft"],
                    height_in=p["height_in"],
                    age=p["age"],
                    sex=p["sex"],
                    activity_level=ActivityLevel(p["activity_level"]),
                    goal=Goal(p["goal"]),
                    insulin_resistant=p.get("insulin_resistant", False),
                    prediabetes=p.get("prediabetes", False),
                    type_2_diabetes=p.get("type_2_diabetes", False),
                    triglycerides_mgdl=p.get("triglycerides_mgdl"),
                )
                ref_budget = build_metabolic_budget(profile_input)

                scores = []
                mismatches = 0
                for item in items:
                    rd = item.get("recipe_data", {})
                    nutrition = rd.get("nutrition_estimate") or rd.get("nutrition_info") or {}
                    if not nutrition:
                        self._finding("WARN", key, f"Missing nutrition for: {rd.get('title', '?')}")
                        continue

                    returned_score = float(rd.get("mes_display_score") or rd.get("composite_display_score") or 0)
                    returned_tier = rd.get("mes_display_tier") or rd.get("composite_display_tier") or ""

                    # Recompute MES from per-serving nutrition (not scaled total)
                    item_servings = item.get("servings", 1) or 1
                    per_serving_nutrition = {k: v / item_servings for k, v in nutrition.items()} if item_servings > 1 else nutrition
                    recomputed = compute_meal_mes(per_serving_nutrition, ref_budget)
                    recomp_score = recomputed.get("display_score", 0)

                    scores.append(returned_score)

                    # Allow small tolerance for rounding
                    if abs(returned_score - recomp_score) > 3.0:
                        mismatches += 1
                        self._finding("HIGH", key,
                            f"MES mismatch for '{rd.get('title', '?')}': returned={returned_score:.1f} vs recomputed={recomp_score:.1f}")

                    # Score in valid range
                    self.assertGreaterEqual(returned_score, 0,
                        f"{key}: Negative MES for {rd.get('title')}")
                    self.assertLessEqual(returned_score, 110,
                        f"{key}: MES > 110 for {rd.get('title')}: {returned_score}")

                avg = sum(scores) / len(scores) if scores else 0
                print(f"\n  [{key}] Avg MES: {avg:.1f}, Mismatches: {mismatches}/{len(items)}")

                # Verify quality summary
                qs = plan.get("quality_summary", {})
                if qs:
                    reported_avg = qs.get("actual_weekly_average_daily_display_mes", 0)
                    qualifying = qs.get("qualifying_meal_count", 0)
                    total = qs.get("total_meal_count", 0)
                    print(f"    Quality: avg={reported_avg}, qualifying={qualifying}/{total}")

                    # Count qualifying ourselves
                    our_qualifying = sum(1 for s in scores if s >= 70)
                    if abs(qualifying - our_qualifying) > 1:
                        self._finding("MEDIUM", key,
                            f"Qualifying count mismatch: reported={qualifying} vs counted={our_qualifying}")

    # ═══════════════════════════════════════════════════════════
    #  D. NUTRITIONAL COMPLIANCE
    # ═══════════════════════════════════════════════════════════

    def test_D_nutritional_compliance(self):
        """Validate per-meal and daily macro bounds."""
        print("\n" + "=" * 70)
        print("D. NUTRITIONAL COMPLIANCE TESTS")
        print("=" * 70)

        for key in PROFILES:
            with self.subTest(profile=key):
                plan = self._create_user_and_plan(key)
                items = plan["items"]
                budget = self._budgets[key]

                daily_protein = budget.get("protein_target_g", 130)
                per_meal_protein_target = daily_protein / 3

                for item in items:
                    rd = item.get("recipe_data", {})
                    title = rd.get("title", "?")
                    nutr = rd.get("nutrition_estimate") or rd.get("nutrition_info") or {}
                    if not nutr:
                        continue

                    cals = float(nutr.get("calories", 0))
                    protein = float(nutr.get("protein", 0))
                    carbs = float(nutr.get("carbs", 0))
                    fat = float(nutr.get("fat", 0))
                    fiber = float(nutr.get("fiber", 0))

                    # Sanity: no zero-calorie or absurd meals
                    if cals < 50:
                        self._finding("HIGH", key, f"Suspiciously low calories ({cals}) for '{title}'")
                    if cals > 2000:
                        self._finding("HIGH", key, f"Suspiciously high calories ({cals}) for '{title}'")

                    # Breakfast: should respect carb/cal limits
                    if item["meal_type"] == "breakfast":
                        # Check sweet filter
                        flavor = rd.get("flavor_profile", [])
                        if isinstance(flavor, list) and "sweet" in [f.lower() if isinstance(f, str) else "" for f in flavor]:
                            self._finding("HIGH", key, f"Sweet breakfast slipped through: '{title}'")

                # Daily totals
                print(f"\n  [{key}] Daily nutrition totals:")
                for day in WEEK_DAYS:
                    day_items = [i for i in items if i["day_of_week"] == day]
                    total_cals = 0
                    total_protein = 0
                    total_carbs = 0
                    total_fat = 0
                    total_fiber = 0
                    for item in day_items:
                        nutr = item.get("recipe_data", {}).get("nutrition_estimate") or item.get("recipe_data", {}).get("nutrition_info") or {}
                        total_cals += float(nutr.get("calories", 0))
                        total_protein += float(nutr.get("protein", 0))
                        total_carbs += float(nutr.get("carbs", 0))
                        total_fat += float(nutr.get("fat", 0))
                        total_fiber += float(nutr.get("fiber", 0))

                    print(f"    {day}: {total_cals:.0f}cal, P={total_protein:.0f}g, C={total_carbs:.0f}g, F={total_fat:.0f}g, Fiber={total_fiber:.0f}g")

                    # Check daily totals are in reasonable range of budget
                    cal_target = float(budget.get("calorie_target_kcal", 0) or budget.get("tdee", 2000) or 2000)
                    if cal_target > 0:
                        ratio = total_cals / cal_target
                        if ratio < 0.5:
                            self._finding("HIGH", key, f"{day}: total cals {total_cals:.0f} is only {ratio:.0%} of target {cal_target:.0f}")
                        elif ratio > 1.5:
                            self._finding("MEDIUM", key, f"{day}: total cals {total_cals:.0f} is {ratio:.0%} of target {cal_target:.0f}")

                    # Protein check
                    if total_protein < daily_protein * 0.5:
                        self._finding("HIGH", key, f"{day}: Protein {total_protein:.0f}g is <50% of target {daily_protein:.0f}g")

    # ═══════════════════════════════════════════════════════════
    #  E. DIETARY RESTRICTION TESTS
    # ═══════════════════════════════════════════════════════════

    def test_E1_vegetarian_restriction(self):
        """Vegetarian plans should contain no meat/fish recipes."""
        print("\n" + "=" * 70)
        print("E1. VEGETARIAN RESTRICTION TEST")
        print("=" * 70)

        plan = self._create_user_and_plan("baseline_male",
            extra_prefs={"dietary_restrictions": ["vegetarian"]})
        items = plan["items"]

        violations = []
        for item in items:
            rd = item.get("recipe_data", {})
            title = (rd.get("title") or "").lower()
            ingredients = rd.get("ingredients", [])

            for ing in ingredients:
                name = (ing.get("name") or "").lower() if isinstance(ing, dict) else str(ing).lower()
                for kw in MEAT_KEYWORDS:
                    if kw in name:
                        violations.append(f"{rd.get('title')}: contains '{name}'")
                        break

        if violations:
            for v in violations:
                self._finding("CRITICAL", "vegetarian", v)
        print(f"  Vegetarian violations: {len(violations)}")
        self.assertEqual(len(violations), 0, f"Vegetarian violations: {violations[:5]}")

    def test_E2_dairy_gluten_allergies(self):
        """Plans with dairy+gluten allergies should exclude those ingredients."""
        print("\n" + "=" * 70)
        print("E2. DAIRY + GLUTEN ALLERGY TEST")
        print("=" * 70)

        plan = self._create_user_and_plan("baseline_male",
            extra_prefs={"allergies": ["dairy", "gluten"]})
        items = plan["items"]

        dairy_violations = []
        gluten_violations = []
        for item in items:
            rd = item.get("recipe_data", {})
            ingredients = rd.get("ingredients", [])
            title = rd.get("title", "?")

            for ing in ingredients:
                name = (ing.get("name") or "").lower() if isinstance(ing, dict) else str(ing).lower()
                for kw in DAIRY_KEYWORDS:
                    if kw in name:
                        dairy_violations.append(f"{title}: '{name}'")
                        break
                for kw in GLUTEN_KEYWORDS:
                    if kw in name:
                        gluten_violations.append(f"{title}: '{name}'")
                        break

        if dairy_violations:
            for v in dairy_violations[:5]:
                self._finding("CRITICAL", "dairy_allergy", v)
        if gluten_violations:
            for v in gluten_violations[:5]:
                self._finding("CRITICAL", "gluten_allergy", v)

        print(f"  Dairy violations: {len(dairy_violations)}")
        print(f"  Gluten violations: {len(gluten_violations)}")

    # ═══════════════════════════════════════════════════════════
    #  F. EDGE CASES
    # ═══════════════════════════════════════════════════════════

    def test_F1_minimal_preferences(self):
        """Plan generation with minimal preferences should still work."""
        print("\n" + "=" * 70)
        print("F1. MINIMAL PREFERENCES TEST")
        print("=" * 70)

        plan = self._create_user_and_plan("baseline_male", extra_prefs={})
        self.assertGreater(len(plan["items"]), 0)
        print(f"  Generated {len(plan['items'])} items with minimal prefs")

    def test_F2_prep_heavy_variety(self):
        """Prep-heavy mode: fewer unique recipes, more bulk cooking."""
        print("\n" + "=" * 70)
        print("F2. PREP HEAVY VARIETY MODE")
        print("=" * 70)

        plan = self._create_user_and_plan("active_muscle_male",
            extra_prefs={"variety_mode": "prep_heavy"})
        items = plan["items"]

        for mt in MEAL_TYPES:
            mt_items = [i for i in items if i["meal_type"] == mt]
            unique = len(set(i.get("recipe_title", "") for i in mt_items))
            bulk = sum(1 for i in mt_items if i.get("is_bulk_cook"))
            print(f"  {mt}: {unique} unique, {bulk} bulk-cook")
            # Prep heavy should have <= 4 unique per slot
            if unique > 4:
                self._finding("MEDIUM", "prep_heavy", f"{mt} has {unique} unique recipes (expected <= 4)")

    def test_F3_variety_heavy_mode(self):
        """Variety-heavy mode: more unique recipes."""
        print("\n" + "=" * 70)
        print("F3. VARIETY HEAVY MODE")
        print("=" * 70)

        plan = self._create_user_and_plan("young_female_fat_loss",
            extra_prefs={"variety_mode": "variety_heavy"})
        items = plan["items"]

        for mt in MEAL_TYPES:
            mt_items = [i for i in items if i["meal_type"] == mt]
            unique = len(set(i.get("recipe_title", "") for i in mt_items))
            print(f"  {mt}: {unique} unique recipes")
            if unique < 4:
                self._finding("MEDIUM", "variety_heavy", f"{mt} only {unique} unique (expected >= 4)")

    def test_F4_household_size_4(self):
        """Household size 4: servings should reflect household."""
        print("\n" + "=" * 70)
        print("F4. HOUSEHOLD SIZE 4")
        print("=" * 70)

        plan = self._create_user_and_plan("baseline_male",
            extra_prefs={"household_size": 4})
        items = plan["items"]

        servings = [i.get("servings", 1) for i in items]
        min_s, max_s = min(servings), max(servings)
        avg_s = sum(servings) / len(servings)
        print(f"  Servings: min={min_s}, max={max_s}, avg={avg_s:.1f}")
        # Most servings should be >= 4 for household of 4
        under_four = sum(1 for s in servings if s < 4)
        if under_four > len(servings) * 0.5:
            self._finding("HIGH", "household_size_4",
                f"{under_four}/{len(servings)} items have <4 servings for household of 4")

    def test_F5_meals_per_day_2(self):
        """Two meals per day should produce 14 items."""
        print("\n" + "=" * 70)
        print("F5. MEALS PER DAY = 2")
        print("=" * 70)

        plan = self._create_user_and_plan("elderly_male",
            extra_prefs={"meals_per_day": 2})
        items = plan["items"]
        total = len(items)
        print(f"  Total items with meals_per_day=2: {total}")
        # Should have 14 items (7 days x 2 meals) or possibly 21 if not supported
        if total == 21:
            self._finding("INFO", "meals_per_day_2", "Still generated 21 items (3 meals/day) despite meals_per_day=2")
        elif total == 14:
            print("  Correctly generated 14 items for 2 meals/day")

    # ═══════════════════════════════════════════════════════════
    #  G. CROSS-PROFILE MES COMPARISON
    # ═══════════════════════════════════════════════════════════

    def test_G_cross_profile_mes_comparison(self):
        """Compare MES scores across profiles to ensure personalization works."""
        print("\n" + "=" * 70)
        print("G. CROSS-PROFILE MES COMPARISON")
        print("=" * 70)

        profile_avgs = {}
        for key in PROFILES:
            plan = self._create_user_and_plan(key)
            items = plan["items"]
            scores = []
            for item in items:
                rd = item.get("recipe_data", {})
                s = float(rd.get("mes_display_score") or rd.get("composite_display_score") or 0)
                scores.append(s)
            avg = sum(scores) / len(scores) if scores else 0
            profile_avgs[key] = avg
            qs = plan.get("quality_summary", {})
            print(f"  {key}: avg MES = {avg:.1f}, qualifying = {qs.get('qualifying_meal_count', 0)}/{qs.get('total_meal_count', 0)}")

        # Diabetic profiles should have different scoring than baseline
        # (not necessarily lower -- just different due to stricter GIS weights)
        baseline = profile_avgs.get("baseline_male", 0)
        diabetic = profile_avgs.get("older_diabetic_male", 0)
        print(f"\n  Baseline avg MES: {baseline:.1f}")
        print(f"  Diabetic avg MES: {diabetic:.1f}")
        print(f"  Difference: {abs(baseline - diabetic):.1f}")

    # ═══════════════════════════════════════════════════════════
    #  H. PREP TIMELINE VALIDATION
    # ═══════════════════════════════════════════════════════════

    def test_H_prep_timeline_integrity(self):
        """Validate prep timeline references valid recipes and days."""
        print("\n" + "=" * 70)
        print("H. PREP TIMELINE VALIDATION")
        print("=" * 70)

        for key in PROFILES:
            with self.subTest(profile=key):
                plan = self._create_user_and_plan(key)
                prep = plan.get("prep_timeline", [])
                items = plan["items"]

                if not prep:
                    print(f"  [{key}] No prep timeline")
                    continue

                print(f"  [{key}] {len(prep)} prep entries")
                item_titles = {i.get("recipe_title") or i.get("recipe_data", {}).get("title", "") for i in items}

                for entry in prep:
                    title = entry.get("recipe_title", "?")
                    prep_day = entry.get("prep_day", "")
                    covers = entry.get("covers_days", [])
                    servings = entry.get("servings_to_make", 0)

                    # Prep day should be valid
                    self.assertIn(prep_day, WEEK_DAYS + [""],
                        f"{key}: Invalid prep day '{prep_day}'")

                    # Covers days should be valid
                    for d in covers:
                        self.assertIn(d, WEEK_DAYS,
                            f"{key}: Invalid covers_day '{d}' for '{title}'")

                    # Recipe should exist in plan
                    if title not in item_titles and title != "?":
                        self._finding("MEDIUM", key, f"Prep timeline recipe '{title}' not in plan items")

                    print(f"    Prep {prep_day}: {title} -> {covers} ({servings} servings)")

    # ═══════════════════════════════════════════════════════════
    #  SUMMARY
    # ═══════════════════════════════════════════════════════════

    @classmethod
    def tearDownClass(cls):
        print("\n" + "=" * 70)
        print("AUDIT SUMMARY")
        print("=" * 70)
        if cls._findings:
            # Group by severity
            critical = [f for f in cls._findings if "[CRITICAL]" in f]
            high = [f for f in cls._findings if "[HIGH]" in f]
            medium = [f for f in cls._findings if "[MEDIUM]" in f]
            warn = [f for f in cls._findings if "[WARN]" in f]
            info = [f for f in cls._findings if "[INFO]" in f]

            print(f"\nTotal findings: {len(cls._findings)}")
            print(f"  CRITICAL: {len(critical)}")
            print(f"  HIGH:     {len(high)}")
            print(f"  MEDIUM:   {len(medium)}")
            print(f"  WARN:     {len(warn)}")
            print(f"  INFO:     {len(info)}")

            if critical:
                print("\nCRITICAL FINDINGS:")
                for f in critical:
                    print(f"  {f}")
            if high:
                print("\nHIGH FINDINGS:")
                for f in high:
                    print(f"  {f}")
            if medium:
                print("\nMEDIUM FINDINGS:")
                for f in medium[:20]:
                    print(f"  {f}")
            if warn:
                print("\nWARNINGS:")
                for f in warn[:20]:
                    print(f"  {f}")
        else:
            print("\nNo findings - all checks passed!")

        # Clean up test DB
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
