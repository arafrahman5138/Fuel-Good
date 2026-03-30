"""Safety-critical tests for allergen detection, dietary filtering, and edge cases."""

import pytest
from app.agents.healthify import _classify_intent, _recipe_conflicts_with_user
from app.routers.chat import _filter_suggestions, _ALLERGY_TAG_MAP


class _MockUser:
    def __init__(self, dietary_preferences=None, allergies=None, protein_preferences=None):
        self.dietary_preferences = dietary_preferences or []
        self.allergies = allergies or []
        self.protein_preferences = protein_preferences or {}


class _MockRecipe:
    def __init__(self, title="Test Recipe", ingredients=None):
        self.title = title
        self.ingredients = ingredients or []


# ── Fail-Safe Exception Handling ──


class TestConflictCheckFailSafe:
    """_recipe_conflicts_with_user must return True (assume conflict) on any error."""

    def test_none_ingredients_returns_true(self):
        """recipe.ingredients=None should fail safe, not silently pass."""
        recipe = _MockRecipe()
        recipe.ingredients = None  # type: ignore
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_string_ingredients_returns_true(self):
        """recipe.ingredients='string' should fail safe."""
        recipe = _MockRecipe()
        recipe.ingredients = "chicken, rice, broccoli"  # type: ignore
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_missing_title_attribute(self):
        """Recipe without title attribute should not crash."""
        class BareRecipe:
            ingredients = [{"name": "rice"}]
        user = _MockUser(allergies=["nuts"])
        # Should not raise; should either return True (safe) or False (no conflict)
        result = _recipe_conflicts_with_user(BareRecipe(), user)
        assert isinstance(result, bool)

    def test_malformed_ingredient_items(self):
        """Ingredients containing non-dict/non-str items should not crash."""
        recipe = _MockRecipe(ingredients=[123, None, True])
        user = _MockUser(allergies=["nuts"])
        # Non-dict items are stringified; no crash, no allergen match → returns False
        result = _recipe_conflicts_with_user(recipe, user)
        assert isinstance(result, bool)  # Must not raise


# ── Allergen Expansion Map Tests ──


class TestAllergenExpansion:
    """Verify allergen matching uses expansion map for accurate detection."""

    # Tree nuts
    def test_nuts_allergy_matches_walnut(self):
        recipe = _MockRecipe(ingredients=[{"name": "walnut pieces"}, {"name": "oats"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_nuts_allergy_matches_almond(self):
        recipe = _MockRecipe(ingredients=[{"name": "almond flour"}, {"name": "sugar"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_nuts_allergy_matches_cashew(self):
        recipe = _MockRecipe(ingredients=[{"name": "cashew cream"}, {"name": "garlic"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_nuts_allergy_matches_pecan(self):
        recipe = _MockRecipe(ingredients=[{"name": "pecans"}, {"name": "maple syrup"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_nuts_allergy_does_not_match_coconut(self):
        """Coconut is NOT a tree nut — should not trigger nut allergy."""
        recipe = _MockRecipe(ingredients=[{"name": "coconut milk"}, {"name": "rice"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is False

    def test_nuts_allergy_does_not_match_nutmeg(self):
        """Nutmeg is NOT a nut — should not trigger nut allergy."""
        recipe = _MockRecipe(ingredients=[{"name": "nutmeg"}, {"name": "cinnamon"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is False

    def test_nuts_allergy_does_not_match_butternut_squash(self):
        """Butternut squash is NOT a nut — should not trigger nut allergy."""
        recipe = _MockRecipe(ingredients=[{"name": "butternut squash"}, {"name": "olive oil"}])
        user = _MockUser(allergies=["nuts"])
        assert _recipe_conflicts_with_user(recipe, user) is False

    # Peanuts
    def test_peanuts_allergy_matches_peanut_butter(self):
        recipe = _MockRecipe(ingredients=[{"name": "peanut butter"}, {"name": "banana"}])
        user = _MockUser(allergies=["peanuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    # Shellfish
    def test_shellfish_allergy_matches_shrimp(self):
        recipe = _MockRecipe(ingredients=[{"name": "shrimp"}, {"name": "garlic"}])
        user = _MockUser(allergies=["shellfish"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_shellfish_allergy_matches_crab(self):
        recipe = _MockRecipe(ingredients=[{"name": "crab meat"}, {"name": "lemon"}])
        user = _MockUser(allergies=["shellfish"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    # Soy
    def test_soy_allergy_matches_tofu(self):
        recipe = _MockRecipe(ingredients=[{"name": "firm tofu"}, {"name": "sesame oil"}])
        user = _MockUser(allergies=["soy"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_soy_allergy_matches_edamame(self):
        recipe = _MockRecipe(ingredients=[{"name": "edamame"}, {"name": "salt"}])
        user = _MockUser(allergies=["soy"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_soy_allergy_matches_tempeh(self):
        recipe = _MockRecipe(ingredients=[{"name": "tempeh"}, {"name": "rice"}])
        user = _MockUser(allergies=["soy"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    # Eggs
    def test_eggs_allergy_matches_egg_white(self):
        recipe = _MockRecipe(ingredients=[{"name": "egg whites"}, {"name": "spinach"}])
        user = _MockUser(allergies=["eggs"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    # Wheat
    def test_wheat_allergy_matches_flour(self):
        recipe = _MockRecipe(ingredients=[{"name": "all-purpose flour"}, {"name": "butter"}])
        user = _MockUser(allergies=["wheat"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    def test_wheat_allergy_matches_pasta(self):
        recipe = _MockRecipe(ingredients=[{"name": "pasta"}, {"name": "tomato sauce"}])
        user = _MockUser(allergies=["wheat"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    # Sesame
    def test_sesame_allergy_matches_tahini(self):
        recipe = _MockRecipe(ingredients=[{"name": "tahini"}, {"name": "lemon"}])
        user = _MockUser(allergies=["sesame"])
        assert _recipe_conflicts_with_user(recipe, user) is True

    # No conflict
    def test_no_allergen_present(self):
        recipe = _MockRecipe(ingredients=[{"name": "chicken breast"}, {"name": "rice"}, {"name": "broccoli"}])
        user = _MockUser(allergies=["nuts", "shellfish"])
        assert _recipe_conflicts_with_user(recipe, user) is False

    # Title-based detection
    def test_allergen_in_title(self):
        recipe = _MockRecipe(title="Peanut Butter Smoothie", ingredients=[{"name": "banana"}])
        user = _MockUser(allergies=["peanuts"])
        assert _recipe_conflicts_with_user(recipe, user) is True


# ── _ALLERGY_TAG_MAP Completeness ──


class TestAllergyTagMap:
    """Verify _ALLERGY_TAG_MAP has entries for all onboarding allergy values."""

    def test_nuts_key_exists(self):
        """Onboarding stores 'nuts' — must be in the map."""
        assert "nuts" in _ALLERGY_TAG_MAP

    def test_peanuts_key_exists(self):
        assert "peanuts" in _ALLERGY_TAG_MAP

    def test_shellfish_key_exists(self):
        assert "shellfish" in _ALLERGY_TAG_MAP

    def test_soy_key_exists(self):
        assert "soy" in _ALLERGY_TAG_MAP

    def test_eggs_key_exists(self):
        assert "eggs" in _ALLERGY_TAG_MAP

    def test_wheat_key_exists(self):
        assert "wheat" in _ALLERGY_TAG_MAP

    def test_fish_key_exists(self):
        assert "fish" in _ALLERGY_TAG_MAP

    def test_sesame_key_exists(self):
        assert "sesame" in _ALLERGY_TAG_MAP


# ── Suggestion Fallback Tests ──


class TestSuggestionFallback:
    """Verify suggestions are never empty, even for heavily restricted diets."""

    def test_vegan_muscle_gain_gets_suggestions(self):
        """Vegan user with muscle_gain goal should get plant-based fallback items."""
        user = _MockUser(dietary_preferences=["vegan"])
        # Simulate what happens: all MUSCLE_GAIN items filtered out
        from app.routers.chat import _MUSCLE_GAIN
        result = _filter_suggestions(list(_MUSCLE_GAIN), user)
        # Even if goal pool is empty, the endpoint has a fallback mechanism
        # But we verify the filter itself works correctly
        assert len(result) == 0  # All meat-based items filtered

        # Now test the plant-based pool survives vegan filter
        from app.routers.chat import _PLANT_BASED
        plant_result = _filter_suggestions(list(_PLANT_BASED), user)
        assert len(plant_result) > 0, "Plant-based fallback must have vegan-safe items"

    def test_all_allergies_still_gets_plant_suggestions(self):
        """User with many allergies should still get some plant-based suggestions."""
        user = _MockUser(
            dietary_preferences=["vegan"],
            allergies=["nuts", "soy", "gluten"],
        )
        from app.routers.chat import _PLANT_BASED
        result = _filter_suggestions(list(_PLANT_BASED), user)
        # Should have at least Black Bean Tacos, Quinoa Power Bowl, Veggie Curry, Sweet Potato Black Bean Bowl
        assert len(result) >= 2, f"Expected >=2 suggestions, got {len(result)}: {result}"

    def test_keto_dairy_free_gets_suggestions(self):
        """Keto + dairy-free user should have available suggestions."""
        user = _MockUser(
            dietary_preferences=["keto", "dairy-free"],
            allergies=["dairy"],
        )
        from app.routers.chat import _FAT_LOSS, _LOW_CARB_FUN
        fat_result = _filter_suggestions(list(_FAT_LOSS), user)
        low_carb_result = _filter_suggestions(list(_LOW_CARB_FUN), user)
        total = len(fat_result) + len(low_carb_result)
        assert total > 0, "Keto+dairy-free user should have some suggestions available"


# ── Empty Input Handling ──


class TestEmptyInputHandling:
    """Verify empty/blank input is handled without hitting the LLM."""

    def test_empty_string(self):
        assert _classify_intent("") == "empty_input"

    def test_whitespace_only(self):
        assert _classify_intent("   ") == "empty_input"

    def test_empty_with_image_context(self):
        """Empty text but with image should go to photo_analysis, not empty_input."""
        ctx = {"image_base64": "abc123"}
        assert _classify_intent("", ctx) == "photo_analysis"

    def test_non_empty_not_classified_as_empty(self):
        assert _classify_intent("hello") != "empty_input"
