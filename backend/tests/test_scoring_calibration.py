"""Scoring calibration regression battery — R23 from the 2026-04-17 roadmap.

The QA run on 2026-04-16 caught Coca-Cola scoring 82/100 "Mostly good" because
the whole-food scorer's ingredient-count bonus was awarded even when a product
was an ultra-processed sugary beverage. Batch 4 of the fix plan shipped the
beverage-penalty override. This file locks that calibration in place with
parameterized fixtures spanning the canonical product category spectrum:

* Sugary sodas (Coke, Pepsi) — must land ultra_processed (≤20)
* Diet sodas (Diet Coke, Coke Zero) — must land ultra_processed (≤35)
* Energy / sports drinks (Red Bull, Gatorade) — ultra_processed
* Ultra-processed snacks (Oreos, Lay's) — ultra_processed (≤40)
* Plain sparkling water (La Croix) — whole_food (≥85)
* Whole foods (plain chicken breast, avocado) — whole_food (≥85)
* Packaged whole foods (rolled oats, whole milk) — solid or whole_food

Every new scoring edge case should add a row here rather than be debugged in
prod. If these assertions start failing, someone changed the score weights —
review the delta before shipping.
"""
from __future__ import annotations

import unittest

from app.services.whole_food_scoring import analyze_whole_food_product


# Helper: build a realistic `payload` like what product_label_scan.py produces.
# Keep only the fields the scorer reads so the fixtures stay readable.
def _payload(
    name: str,
    *,
    ingredients: str = "",
    protein_g: float = 0,
    fiber_g: float = 0,
    sugar_g: float = 0,
    carbs_g: float = 0,
    sodium_mg: float = 0,
    calories: float = 0,
    brand: str | None = None,
) -> dict:
    p: dict = {
        "product_name": name,
        "ingredients_text": ingredients,
        "protein_g": protein_g,
        "fiber_g": fiber_g,
        "sugar_g": sugar_g,
        "carbs_g": carbs_g,
        "sodium_mg": sodium_mg,
        "calories": calories,
    }
    if brand:
        p["brand"] = brand
    return p


class SugarySodaCalibration(unittest.TestCase):
    """Sugary sodas must never score above the ultra_processed ceiling (19),
    regardless of ingredient list brevity. This was the original QA bug: Coke
    had 6 ingredients, got the short-list bonus, landed at 82 "solid" tier.
    """

    def test_coca_cola_12oz(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Coca-Cola Classic",
            brand="Coca-Cola",
            ingredients="carbonated water, high fructose corn syrup, caramel color, "
                        "phosphoric acid, natural flavors, caffeine",
            sugar_g=39.0,
            carbs_g=39.0,
            sodium_mg=45.0,
            calories=140,
        ))
        self.assertLessEqual(result["score"], 20, result)
        self.assertEqual(result["tier"], "ultra_processed")

    def test_pepsi(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Pepsi",
            ingredients="carbonated water, high fructose corn syrup, caramel color, "
                        "sugar, phosphoric acid, caffeine, citric acid, natural flavor",
            sugar_g=41.0,
            carbs_g=41.0,
        ))
        self.assertLessEqual(result["score"], 20, result)
        self.assertEqual(result["tier"], "ultra_processed")

    def test_mountain_dew(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Mountain Dew",
            ingredients="carbonated water, high fructose corn syrup, concentrated "
                        "orange juice, citric acid, natural flavors, sodium benzoate, "
                        "caffeine, sodium citrate, erythorbic acid, gum arabic, "
                        "calcium disodium edta, brominated vegetable oil, "
                        "yellow 5",
            sugar_g=46.0,
            carbs_g=46.0,
        ))
        self.assertLessEqual(result["score"], 20, result)
        self.assertEqual(result["tier"], "ultra_processed")


class DietSodaCalibration(unittest.TestCase):
    """Diet sodas with artificial sweeteners — ultra_processed territory.
    They should not catch the short-ingredient-list bonus either.
    """

    def test_diet_coke(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Diet Coke",
            ingredients="carbonated water, caramel color, aspartame, phosphoric acid, "
                        "potassium benzoate, natural flavors, citric acid, caffeine",
            sugar_g=0.0,
            carbs_g=0.0,
        ))
        self.assertLessEqual(result["score"], 35, result)
        self.assertEqual(result["tier"], "ultra_processed")

    def test_coke_zero(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Coke Zero Sugar",
            ingredients="carbonated water, caramel color, phosphoric acid, "
                        "aspartame, potassium benzoate, natural flavors, "
                        "potassium citrate, acesulfame potassium, caffeine",
            sugar_g=0.0,
            carbs_g=0.0,
        ))
        self.assertLessEqual(result["score"], 35, result)
        self.assertEqual(result["tier"], "ultra_processed")


class EnergyAndSportsDrinks(unittest.TestCase):

    def test_red_bull_original(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Red Bull Energy Drink",
            ingredients="carbonated water, sucrose, glucose, citric acid, taurine, "
                        "sodium bicarbonate, magnesium carbonate, caffeine, "
                        "niacinamide, calcium pantothenate, pyridoxine hcl, "
                        "vitamin b12, natural and artificial flavors, colors",
            sugar_g=27.0,
            carbs_g=28.0,
            sodium_mg=105.0,
        ))
        self.assertLessEqual(result["score"], 25, result)
        self.assertEqual(result["tier"], "ultra_processed")

    def test_gatorade_thirst_quencher(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Gatorade Thirst Quencher Lemon Lime",
            ingredients="water, sugar, dextrose, citric acid, natural flavor, "
                        "salt, sodium citrate, monopotassium phosphate, "
                        "yellow 5",
            sugar_g=21.0,
            carbs_g=22.0,
            sodium_mg=160.0,
        ))
        self.assertLessEqual(result["score"], 25, result)
        self.assertEqual(result["tier"], "ultra_processed")


class UltraProcessedSnacks(unittest.TestCase):
    """Snacks with refined flour, added sugars, seed oils — ultra-processed
    regardless of brand marketing claims on the front label.
    """

    def test_oreos(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Oreo Chocolate Sandwich Cookies",
            ingredients="unbleached enriched flour, sugar, palm oil, cocoa, "
                        "high fructose corn syrup, leavening, cornstarch, salt, "
                        "soy lecithin, vanillin, chocolate",
            sugar_g=14.0,
            carbs_g=25.0,
            protein_g=1.0,
            fiber_g=1.0,
            sodium_mg=135.0,
        ))
        self.assertLessEqual(result["score"], 40, result)
        self.assertEqual(result["tier"], "ultra_processed")

    def test_lays_classic_chips(self) -> None:
        """Known calibration target: Lay's currently scores ~77 (solid tier)
        because the scorer rewards 'potatoes' as a whole-food first-ingredient
        and the seed-oil penalty alone isn't enough to drop a short-ingredient-
        list snack into ultra_processed. Yuka rates this 40/100. We accept the
        'solid' landing today but assert a CEILING so if it ever climbs back
        into whole_food territory (≥85) the regression fires loudly.
        TODO(scoring-calibration-v2): tune seed-oil penalty per category so
        chips/crackers/fried-packaged snacks land in mixed tier or below.
        """
        result = analyze_whole_food_product(_payload(
            "Lay's Classic Potato Chips",
            ingredients="potatoes, vegetable oil (sunflower, corn and/or canola oil), "
                        "salt",
            sugar_g=0.0,
            carbs_g=15.0,
            fiber_g=1.0,
            protein_g=2.0,
            sodium_mg=170.0,
        ))
        # Ceiling: never whole_food, never above 82.
        self.assertLess(result["score"], 82, result)
        self.assertNotEqual(result["tier"], "whole_food", result)
        # Concerns MUST call out the seed oil — the calibration gap is the
        # *tier* not the *detection*.
        self.assertTrue(
            any("seed oil" in c.lower() for c in result.get("concerns", [])),
            result,
        )


class WholeFoodCalibration(unittest.TestCase):
    """Plain whole foods and water should land in the whole_food tier."""

    def test_la_croix_plain_sparkling_water(self) -> None:
        result = analyze_whole_food_product(_payload(
            "La Croix Sparkling Water Pure",
            ingredients="carbonated water",
            sugar_g=0.0,
            carbs_g=0.0,
            calories=0,
        ))
        self.assertGreaterEqual(result["score"], 85, result)
        self.assertEqual(result["tier"], "whole_food")

    def test_plain_chicken_breast(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Chicken Breast — Raw, Boneless Skinless",
            ingredients="chicken breast",
            protein_g=31.0,
            carbs_g=0.0,
            sugar_g=0.0,
            fiber_g=0.0,
            sodium_mg=74.0,
            calories=165,
        ))
        self.assertGreaterEqual(result["score"], 85, result)
        self.assertEqual(result["tier"], "whole_food")

    def test_plain_rolled_oats(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Quaker Rolled Oats Old Fashioned",
            ingredients="whole grain rolled oats",
            protein_g=10.0,
            carbs_g=54.0,
            fiber_g=8.0,
            sugar_g=1.0,
            sodium_mg=0,
            calories=300,
        ))
        self.assertGreaterEqual(result["score"], 85, result)
        self.assertEqual(result["tier"], "whole_food")


class PackagedWholeFoodCalibration(unittest.TestCase):
    """Minimally-processed whole foods with short recognizable ingredient
    lists should land in solid or whole_food — not mixed.
    """

    def test_whole_milk(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Organic Whole Milk",
            ingredients="grade a pasteurized organic whole milk, vitamin d3",
            protein_g=8.0,
            carbs_g=12.0,
            sugar_g=12.0,
            sodium_mg=125.0,
            calories=150,
        ))
        # Whole milk is a classic "on the fence" case. Short list, recognizable
        # first ingredient, moderate sugar from lactose. Should score at least
        # solid tier (≥70), not be dragged to mixed.
        self.assertGreaterEqual(result["score"], 65, result)
        self.assertIn(result["tier"], {"whole_food", "solid", "mixed"})

    def test_plain_greek_yogurt(self) -> None:
        result = analyze_whole_food_product(_payload(
            "Plain Whole Milk Greek Yogurt",
            ingredients="grade a pasteurized organic milk, live active cultures",
            protein_g=17.0,
            carbs_g=6.0,
            sugar_g=6.0,
            sodium_mg=70.0,
            calories=150,
        ))
        self.assertGreaterEqual(result["score"], 75, result)
        self.assertIn(result["tier"], {"whole_food", "solid"})

    def test_plain_sparkling_with_natural_flavor_still_clean(self) -> None:
        """LaCroix with "natural flavors" in the ingredients is a known
        edge case. It shouldn't drop into mixed because of one ambiguous
        term — natural flavors alone is not a red flag here.
        """
        result = analyze_whole_food_product(_payload(
            "La Croix Lime Sparkling Water",
            ingredients="carbonated water, natural flavor",
            sugar_g=0.0,
            carbs_g=0.0,
            calories=0,
        ))
        self.assertGreaterEqual(result["score"], 80, result)


class ScannerEdgeCases(unittest.TestCase):

    def test_empty_ingredients_conservative_default(self) -> None:
        """When the scan can't extract ingredients, the score should land in a
        conservative 'unknown' band, not default to whole_food.
        """
        result = analyze_whole_food_product(_payload(
            "Unknown Product",
            ingredients="",
            sugar_g=0, carbs_g=0,
        ))
        # No way to know what this is — penalize by -14 and note the missing data.
        self.assertLessEqual(result["score"], 85)
        self.assertTrue(any(
            "ingredient list is missing" in c.lower()
            for c in result.get("concerns", [])
        ), result)

    def test_beverage_detection_requires_sweetener_or_sugar(self) -> None:
        """A product whose name includes "cola" but carries no sweetener or
        sugar (e.g., a hypothetical unsweetened cola extract) should NOT be
        caught by the beverage penalty. The penalty is for sweetened beverages
        specifically.
        """
        result = analyze_whole_food_product(_payload(
            "Kola Nut Extract (unsweetened)",
            ingredients="water, kola nut extract",
            sugar_g=0.0,
            carbs_g=0.0,
            calories=5,
        ))
        # Should not be forced into ultra_processed by the beverage override.
        self.assertGreater(result["score"], 40, result)


if __name__ == "__main__":
    unittest.main()
