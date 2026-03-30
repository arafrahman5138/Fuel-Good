from __future__ import annotations

import asyncio
import json
import logging
import re
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, List, Optional
from datetime import UTC, date, datetime

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agents.llm_provider import get_llm
from app.models.recipe import Recipe
from app.services.recipe_retrieval import retrieve_recipe_candidates
from app.services.metabolic_engine import (
    load_budget_for_user,
    compute_meal_mes,
    compute_daily_mes,
    aggregate_daily_totals,
    remaining_budget,
)
from app.models.metabolic_profile import MetabolicProfile

logger = logging.getLogger(__name__)


@dataclass
class _CachedUserContext:
    """Request-scoped cache: computed once, used everywhere. Eliminates duplicate DB queries."""
    profile: Any = None
    budget: Any = None
    daily_totals: dict = field(default_factory=dict)
    remaining: dict = field(default_factory=dict)
    context_text: str = ""


PROMPT_VERSION = "healthify_v2_rag"
RETRIEVAL_THRESHOLD = 0.62
LEXICAL_RETRIEVAL_THRESHOLD = 0.65


class RecipeIngredientSchema(BaseModel):
    name: str
    quantity: str | int | float | None = ""
    unit: str | None = ""


class RecipeSchema(BaseModel):
    title: str
    description: str = ""
    ingredients: list[RecipeIngredientSchema] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    prep_time_min: int = 0
    cook_time_min: int = 0
    servings: int = 1


GENERATE_PROMPT = """You are Fuel Good Healthify AI. Return JSON only.
Keys: message, recipe, swaps, nutrition.
Healthify meals by replacing ultra-processed ingredients with whole foods. Preserve the dish's spirit.
recipe: {title, description, ingredients:[{name,quantity,unit}], steps:[], prep_time_min, cook_time_min, servings}
nutrition: {original_estimate:{calories,protein,carbs,fat,fiber}, healthified_estimate:{calories,protein,carbs,fat,fiber}}
swaps: [{original, replacement, reason}]
CRITICAL: recipe must NOT be null for food requests. Include 3+ ingredients and 3+ steps. Output valid JSON only.
CRITICAL: If the user has dietary restrictions or allergies listed below, you MUST comply. Every single ingredient must be safe for their diet and allergies. Violations are unacceptable.
IMPORTANT: Silently comply with dietary restrictions and allergies — do NOT mention them in the recipe title, description, or ingredient names. Just use safe ingredients naturally. For example, do NOT write "Nut-Free Turkey Wrap" or "hummus (nut-free)" — just write "Turkey Wrap" and "hummus". The user already knows their restrictions."""

GENERAL_PROMPT = """You are Fuel Good Healthify AI — a friendly nutrition coach inside a food and health app.
Return strict JSON with keys: message, recipe, swaps, nutrition.
For general questions, provide a helpful answer in message and set recipe, swaps, and nutrition to null.

Behavior:
- If the question is about food, nutrition, cooking, health, diet, or wellness — answer helpfully and knowledgeably.
- If the question is completely unrelated to food, nutrition, or health (e.g., weather, math, sports, politics), politely explain that you're a nutrition coach and can help with food-related questions. Suggest something relevant they could ask instead.
- Always be friendly and encouraging.
"""

MODIFY_PROMPT = """You are Fuel Good Healthify AI.

Return strict JSON with keys: message, recipe, swaps, nutrition.

You are updating an existing recipe, not inventing a different meal.
Rules:
- Preserve the same base dish, cuisine, and overall meal identity unless the user explicitly asks to change them.
- Apply only the requested modification to the existing recipe.
- Keep as many original ingredients and steps as possible.
- If the user asks for a direct ingredient swap, update that ingredient throughout the recipe and do not turn the meal into a different dish.
- If you include swaps, every swap must include `original`, `replacement`, and `reason`.
- `recipe` must remain non-null and include non-empty ingredients and steps.
"""

FRIDGE_TO_MEAL_PROMPT = """You are Fuel Good Healthify AI — a kitchen assistant that turns whatever is in the fridge into clean, whole-food meals.

Return strict JSON with keys: message, recipe, swaps, nutrition.

Behavior:
- The user has listed ingredients they have on hand. Generate a complete, Fuel 100-quality recipe using those ingredients plus common pantry staples (salt, pepper, olive oil, garlic, etc.).
- Prioritize whole foods, no seed oils, no refined sugar, no ultra-processed ingredients.
- The recipe should be realistic and easy to make.
- Mention in `message` which provided ingredients you used and any pantry staples assumed.
- Include full nutrition estimates.
- Silently comply with any dietary restrictions or allergies — use safe ingredients naturally without labeling the recipe or ingredients as "free-from" anything.

Recipe schema:
- recipe.title: string
- recipe.description: string
- recipe.ingredients: list of {name, quantity, unit}
- recipe.steps: list of strings
- recipe.prep_time_min: integer
- recipe.cook_time_min: integer
- recipe.servings: integer

Nutrition schema:
- nutrition.original_estimate: null (no "original" for a from-scratch recipe)
- nutrition.healthified_estimate: {calories, protein, carbs, fat, fiber}
"""

SCORE_EXPLAINER_PROMPT = """You are Fuel Good Healthify AI — a nutrition coach who explains food quality scores in plain, motivating language.

Return strict JSON with keys: message, recipe, swaps, nutrition.
Set recipe, swaps, and nutrition to null unless you are also providing a better alternative recipe.

Behavior:
- You will receive the user's current Fuel Score (0-100) and context about their day.
- If the score is high (85+): congratulate them, highlight what they did well, and encourage them to keep it up.
- If the score is moderate (50-84): acknowledge the effort, explain the main factors affecting the score, and suggest the single highest-impact improvement.
- If the score is low (<50): be non-judgmental, explain what affected the score most, and identify the easiest change they can make.
- If no meals are logged yet today, let the user know and offer a suggestion for their next meal.
- If the user asks "what's better", generate a full healthified alternative (set recipe to non-null).
- Be encouraging — the user is trying to improve.
- Keep the explanation under 120 words unless providing a recipe.
"""

PHOTO_ANALYSIS_PROMPT = """You are Fuel Good Healthify AI with vision capabilities.

The user has sent a photo. Analyze it and determine what type of food image it is:
1. **Fridge/pantry** — list all visible ingredients you can identify
2. **Plated meal** — identify the dish name and key ingredients
3. **Grocery item** — identify the product and assess its whole-food quality
4. **Nutrition label** — extract macro information (calories, protein, carbs, fat, fiber)

Based on what you see:
- If fridge/pantry: generate a whole-food Fuel 100-quality recipe using visible ingredients + common pantry staples
- If plated meal: suggest a healthified whole-food version that preserves the dish's spirit
- If grocery item: rate its whole-food quality (1-10) and suggest better alternatives if score < 7
- If nutrition label: assess alignment with the user's metabolic goals

{user_context}

Return strict JSON with keys: message, recipe (null if not applicable), swaps, nutrition, image_analysis.
image_analysis should have: detected_type ("fridge"|"meal"|"grocery"|"label"), identified_items (list of strings).
"""

POST_SCAN_PROMPT = """You are Fuel Good Healthify AI — a food coach helping users understand a meal they just scanned.

Return strict JSON with keys: message, recipe, swaps, nutrition.

Behavior:
- You have been given the scan result: the meal label, its Fuel Score, and any whole-food flags.
- Explain in plain language WHY the score is what it is, referencing the specific flagged ingredients.
- Suggest 2-3 specific, grocery-store-available swaps to improve the score.
- If the user asks for a homemade version, generate a full recipe (set recipe to non-null).
- Be empathetic — acknowledge the food tastes good, focus on the tradeoffs.
- Keep the initial explanation under 100 words.
"""


def _clean_md_line(line: str) -> str:
    return ((line or "").replace("**", "").replace("__", "").strip())


def _recipe_to_payload(recipe: Recipe) -> dict[str, Any]:
    return {
        "id": str(recipe.id),
        "title": recipe.title,
        "description": recipe.description or "",
        "ingredients": recipe.ingredients or [],
        "steps": recipe.steps or [],
        "prep_time_min": recipe.prep_time_min or 0,
        "cook_time_min": recipe.cook_time_min or 0,
        "servings": recipe.servings or 1,
        "nutrition_info": recipe.nutrition_info or {},
        "cuisine": recipe.cuisine or "american",
        "tags": recipe.tags or [],
    }


def _retrieved_response(recipe: Recipe, confidence: float, user_context: str = "") -> dict[str, Any]:
    summary = recipe.description or "I found a close match in the recipe library."
    message = f"{summary} I found a strong match for your request, so I'm using this saved meal instead of generating a new one."
    if user_context:
        message += " I also kept your current metabolic context in mind when choosing it."
    return {
        "message": message,
        "recipe": _recipe_to_payload(recipe),
        "swaps": [],
        "nutrition": {
            "original_estimate": recipe.nutrition_info or {},
            "healthified_estimate": recipe.nutrition_info or {},
        },
        "response_mode": "retrieved",
        "matched_recipe_id": str(recipe.id),
        "retrieval_confidence": round(confidence, 2),
        "prompt_version": PROMPT_VERSION,
    }


def _build_user_context(db: Session, user_id: str | None, chat_context: dict | None = None) -> str:
    """Build a natural-language context block from the user's metabolic profile and daily state."""
    if not user_id:
        return ""
    try:
        from app.models.user import User

        profile = db.query(MetabolicProfile).filter(
            MetabolicProfile.user_id == user_id
        ).first()
        if not profile or not profile.weight_lb:
            return ""

        # Load user for dietary preferences and allergies
        user = db.query(User).filter(User.id == user_id).first()

        budget = load_budget_for_user(db, user_id)
        totals = aggregate_daily_totals(db, user_id, datetime.now(UTC).date())
        rem = remaining_budget(totals, budget)

        lines = []

        # ── MANDATORY dietary and allergy constraints (placed FIRST for maximum LLM attention) ──
        if user:
            dietary_prefs = user.dietary_preferences or []
            allergies = user.allergies or []
            protein_prefs = user.protein_preferences or {}

            if dietary_prefs or allergies:
                lines.append("MANDATORY DIETARY CONSTRAINTS — MUST BE FOLLOWED:")
            if dietary_prefs:
                prefs_str = ", ".join(str(p) for p in dietary_prefs if p)
                lines.append(f"  • User follows a {prefs_str} diet. All ingredients must comply.")
            if allergies:
                allergy_str = ", ".join(str(a) for a in allergies if a)
                lines.append(f"  • User is allergic to: {allergy_str}. Never include these allergens.")
            if dietary_prefs or allergies:
                lines.append("  • Comply silently — do NOT mention restrictions in the recipe title, description, or ingredient names. Just use safe ingredients naturally.")
                lines.append("")

            if isinstance(protein_prefs, dict):
                liked = protein_prefs.get("liked", [])
                disliked = protein_prefs.get("disliked", [])
                if liked:
                    lines.append(f"- Preferred proteins: {', '.join(str(p) for p in liked)}")
                if disliked:
                    lines.append(f"- Avoided proteins: {', '.join(str(p) for p in disliked)}")

        lines.append("User context (tailor the recipe to these constraints):")

        # Time-of-day meal type bias
        hour = datetime.now().hour
        if 5 <= hour < 10:
            meal_time = "breakfast"
        elif 10 <= hour < 15:
            meal_time = "lunch"
        elif 15 <= hour < 18:
            meal_time = "snack"
        else:
            meal_time = "dinner"
        lines.append(f"- Time of day: {meal_time} time — bias suggestions toward a {meal_time} appropriate meal")

        # Goal and activity
        goal_label = (profile.goal or "maintenance").replace("_", " ")
        activity_label = (profile.activity_level or "moderate").replace("_", " ")
        lines.append(f"- Goal: {goal_label} | Activity: {activity_label}")

        # Health conditions
        conditions = []
        if profile.type_2_diabetes:
            conditions.append("type 2 diabetes")
        if profile.insulin_resistant and not profile.type_2_diabetes:
            conditions.append("insulin resistant")
        if profile.prediabetes:
            conditions.append("prediabetes")
        if conditions:
            lines.append(f"- Health: {', '.join(conditions)} — STRICT carb management required")

        # Targets and remaining
        protein_remaining = rem.get("protein_remaining_g", 0)
        fiber_remaining = rem.get("fiber_remaining_g", 0)
        carb_headroom = rem.get("carb_headroom_g", rem.get("sugar_headroom_g", 0))

        lines.append(f"- Protein target: {round(budget.protein_g)}g/day ({round(max(0, protein_remaining))}g remaining today)")
        lines.append(f"- Fiber target: {round(budget.fiber_g)}g/day ({round(max(0, fiber_remaining))}g remaining today)")
        lines.append(f"- Carb ceiling: {round(budget.carb_ceiling_g)}g/day ({round(max(0, carb_headroom))}g headroom remaining)")
        lines.append(f"- Calorie target: ~{round(budget.calorie_target_kcal)} kcal/day")

        # Key constraints as IMPORTANT instructions
        constraints = []

        # Dietary and allergy constraints (already stated above — brief reminder only)
        if user:
            if user.allergies:
                allergy_str = ", ".join(str(a) for a in user.allergies if a)
                constraints.append(f"Avoid {allergy_str} (allergy). Do not label recipe as 'free-from' — just use safe ingredients.")
            if user.dietary_preferences:
                diet_str = ", ".join(str(d) for d in user.dietary_preferences if d)
                constraints.append(f"Follow {diet_str} diet silently — compliant ingredients only, no labeling.")

        if budget.carb_ceiling_g <= 100:
            max_carbs_per_meal = round(budget.carb_ceiling_g / 3 * 0.8)
            constraints.append(f"IMPORTANT: This user has a LOW carb ceiling ({round(budget.carb_ceiling_g)}g/day). Keep carbs under ~{max_carbs_per_meal}g per serving.")
        if carb_headroom < 30:
            constraints.append(f"IMPORTANT: Only {round(carb_headroom)}g carb headroom left today. Minimize carbs in this recipe.")
        if protein_remaining > 40:
            constraints.append(f"Prioritize protein-dense ingredients ({round(protein_remaining)}g still needed today).")
        if profile.goal == "muscle_gain":
            constraints.append("User is building muscle — maximize protein per serving.")
        if profile.goal == "fat_loss":
            constraints.append("User is losing fat — keep calories moderate and protein high.")

        if constraints:
            lines.append("")
            lines.extend(constraints)

        # Inject deep-link context (scan result, flex status, etc.)
        if chat_context:
            scan = chat_context.get("scan_result")
            if scan:
                lines.append("")
                lines.append("Scan context (the user just scanned this meal):")
                if scan.get("meal_label"):
                    lines.append(f"- Scanned meal: {scan['meal_label']}")
                if scan.get("fuel_score") is not None:
                    lines.append(f"- Fuel Score: {scan['fuel_score']}/100")
                flags = scan.get("whole_food_flags") or []
                if flags:
                    flag_names = [f.get("ingredient", "") for f in flags[:5] if f.get("ingredient")]
                    if flag_names:
                        lines.append(f"- Flagged ingredients: {', '.join(flag_names)}")
            flex = chat_context.get("flex_status")
            if flex:
                lines.append("")
                lines.append(f"- Flex budget: {flex.get('earned', 0)} earned, {flex.get('remaining', 0)} remaining")

        return "\n".join(lines)
    except Exception:
        return ""


def _compute_recipe_mes(
    db: Session, user_id: str | None, nutrition_data: dict | None
) -> dict | None:
    """Compute MES score and projected daily score for a recipe's nutrition."""
    if not user_id or not nutrition_data:
        return None
    try:
        budget = load_budget_for_user(db, user_id)
        # Extract healthified_estimate or use as-is
        est = nutrition_data.get("healthified_estimate") or nutrition_data
        meal_nutrition = {
            "protein_g": float(est.get("protein") or est.get("protein_g") or 0),
            "carbs_g": float(est.get("carbs") or est.get("carbs_g") or 0),
            "fiber_g": float(est.get("fiber") or est.get("fiber_g") or 0),
            "fat_g": float(est.get("fat") or est.get("fat_g") or 0),
            "calories": float(est.get("calories") or 0),
        }
        meal_result = compute_meal_mes(meal_nutrition, budget)

        # Projected daily score
        totals = aggregate_daily_totals(db, user_id, datetime.now(UTC).date())
        projected = {
            "protein_g": totals.get("protein_g", 0) + meal_nutrition["protein_g"],
            "fiber_g": totals.get("fiber_g", 0) + meal_nutrition["fiber_g"],
            "carbs_g": totals.get("carbs_g", 0) + meal_nutrition["carbs_g"],
            "fat_g": totals.get("fat_g", 0) + meal_nutrition["fat_g"],
            "calories": totals.get("calories", 0) + meal_nutrition["calories"],
        }
        daily_result = compute_daily_mes(projected, budget)

        return {
            "meal_score": meal_result.get("display_score", meal_result.get("total_score", 0)),
            "meal_tier": meal_result.get("display_tier", meal_result.get("tier", "moderate")),
            "projected_daily_score": daily_result.get("display_score", daily_result.get("total_score", 0)),
            "projected_daily_tier": daily_result.get("display_tier", daily_result.get("tier", "moderate")),
        }
    except Exception:
        return None


def _build_cached_user_context(db: Session, user_id: str | None, chat_context: dict | None = None) -> _CachedUserContext:
    """Single entry point: query DB once, cache everything for the request lifecycle."""
    if not user_id:
        return _CachedUserContext()
    try:
        profile = db.query(MetabolicProfile).filter(
            MetabolicProfile.user_id == user_id
        ).first()
        if not profile or not profile.weight_lb:
            return _CachedUserContext(profile=profile)

        budget = load_budget_for_user(db, user_id, profile=profile)
        totals = aggregate_daily_totals(db, user_id, datetime.now(UTC).date())
        rem = remaining_budget(totals, budget)
        context_text = _build_user_context(db, user_id, chat_context)

        return _CachedUserContext(
            profile=profile,
            budget=budget,
            daily_totals=totals,
            remaining=rem,
            context_text=context_text,
        )
    except Exception:
        return _CachedUserContext()


def _compute_recipe_mes_from_cache(
    cached: _CachedUserContext, nutrition_data: dict | None
) -> dict | None:
    """Compute MES using pre-fetched budget and totals. Zero DB queries."""
    if not cached.budget or not nutrition_data:
        return None
    try:
        est = nutrition_data.get("healthified_estimate") or nutrition_data
        meal_nutrition = {
            "protein_g": float(est.get("protein") or est.get("protein_g") or 0),
            "carbs_g": float(est.get("carbs") or est.get("carbs_g") or 0),
            "fiber_g": float(est.get("fiber") or est.get("fiber_g") or 0),
            "fat_g": float(est.get("fat") or est.get("fat_g") or 0),
            "calories": float(est.get("calories") or 0),
        }
        meal_result = compute_meal_mes(meal_nutrition, cached.budget)
        projected = {
            k: cached.daily_totals.get(k, 0) + meal_nutrition.get(k, 0)
            for k in ("protein_g", "fiber_g", "carbs_g", "fat_g", "calories")
        }
        daily_result = compute_daily_mes(projected, cached.budget)
        return {
            "meal_score": meal_result.get("display_score", meal_result.get("total_score", 0)),
            "meal_tier": meal_result.get("display_tier", meal_result.get("tier", "moderate")),
            "projected_daily_score": daily_result.get("display_score", daily_result.get("total_score", 0)),
            "projected_daily_tier": daily_result.get("display_tier", daily_result.get("tier", "moderate")),
        }
    except Exception:
        return None


# Allergen expansion: maps stored allergy keys → specific ingredient keywords to check
_ALLERGY_EXPANSION: dict[str, set[str]] = {
    "nuts": {"walnut", "almond", "cashew", "pecan", "pistachio", "macadamia", "hazelnut", "brazil nut", "pine nut"},
    "tree nuts": {"walnut", "almond", "cashew", "pecan", "pistachio", "macadamia", "hazelnut", "brazil nut", "pine nut"},
    "peanuts": {"peanut", "peanut butter"},
    "peanut": {"peanut", "peanut butter"},
    "shellfish": {"shrimp", "crab", "lobster", "crayfish", "scallop", "clam", "mussel", "oyster", "crawfish"},
    "fish": {"salmon", "tuna", "cod", "tilapia", "halibut", "anchovy", "sardine", "trout", "bass", "mahi", "swordfish", "catfish"},
    "soy": {"soy", "soybean", "tofu", "tempeh", "edamame", "soy sauce", "miso"},
    "wheat": {"wheat", "flour", "bread", "pasta", "noodle", "couscous", "tortilla", "pita"},
    "eggs": {"egg", "egg white", "egg yolk", "eggs"},
    "egg": {"egg", "egg white", "egg yolk", "eggs"},
    "dairy": {"milk", "cheese", "butter", "cream", "yogurt", "whey", "casein", "ghee", "sour cream", "ice cream"},
    "milk": {"milk", "cheese", "butter", "cream", "yogurt", "whey", "casein", "ghee"},
    "sesame": {"sesame", "tahini"},
    "gluten": {"wheat", "flour", "bread", "pasta", "noodle", "barley", "rye", "couscous"},
}

# Words that look like allergens but aren't (to prevent false positives)
_ALLERGY_FALSE_POSITIVES: dict[str, set[str]] = {
    "nuts": {"coconut", "nutmeg", "butternut", "doughnut", "donut"},
}


def _recipe_conflicts_with_user(recipe, user) -> bool:
    """Check if a retrieved recipe conflicts with user's dietary preferences or allergies.
    Returns True if the recipe should be skipped. Fails safe (returns True) on any error."""
    if not user:
        return False
    has_restrictions = bool((user.allergies or []) or (user.dietary_preferences or []))
    try:
        if not isinstance(recipe.ingredients, list):
            # Can't verify ingredient safety — fail safe if user has any restrictions
            return has_restrictions
        ingredients = recipe.ingredients
        ingredient_text = " ".join(
            str(ing.get("name", "") if isinstance(ing, dict) else ing).lower()
            for ing in ingredients
            if ing is not None
        ).lower()
        title = (getattr(recipe, "title", "") or "").lower()
        full_text = f"{title} {ingredient_text}"

        # Check allergies using expansion map + word-boundary matching
        for allergy in (user.allergies or []):
            allergy_lower = str(allergy).lower()
            keywords = _ALLERGY_EXPANSION.get(allergy_lower, {allergy_lower})
            false_positives = _ALLERGY_FALSE_POSITIVES.get(allergy_lower, set())
            for kw in keywords:
                if re.search(r'\b' + re.escape(kw) + r'(?:s|es)?\b', full_text):
                    # Check it's not a false positive
                    if not any(fp in full_text for fp in false_positives if kw in fp):
                        return True

        # Check dietary preferences
        meat_keywords = {"chicken", "beef", "steak", "pork", "bacon", "ham", "lamb",
                         "turkey", "duck", "veal", "sausage", "salami", "pepperoni",
                         "prosciutto", "chorizo", "ground meat", "meatball"}
        seafood_keywords = {"fish", "salmon", "tuna", "shrimp", "crab", "lobster",
                            "cod", "tilapia", "halibut", "anchovy", "sardine", "scallop",
                            "oyster", "clam", "mussel", "squid", "octopus"}
        animal_keywords = meat_keywords | seafood_keywords | {"egg", "dairy", "milk",
                          "cheese", "butter", "cream", "yogurt", "whey", "honey"}

        for pref in (user.dietary_preferences or []):
            pref_lower = str(pref).lower()
            if "vegan" in pref_lower:
                if any(kw in full_text for kw in animal_keywords):
                    return True
            elif "vegetarian" in pref_lower:
                if any(kw in full_text for kw in (meat_keywords | seafood_keywords)):
                    return True
            elif "pescatarian" in pref_lower:
                if any(kw in full_text for kw in meat_keywords):
                    return True

        # Check disliked proteins
        protein_prefs = user.protein_preferences or {}
        if isinstance(protein_prefs, dict):
            for disliked in (protein_prefs.get("disliked") or []):
                if str(disliked).lower() in full_text:
                    return True
    except Exception as exc:
        logger.error("_recipe_conflicts_with_user failed, assuming conflict for safety: %s", exc)
        return True  # Fail safe: assume conflict if check fails
    return False


# Food-related keywords for intent detection (not exhaustive — just enough to gate the fallback)
_FOOD_KEYWORDS = {
    # Common foods
    "chicken", "beef", "steak", "pork", "lamb", "turkey", "salmon", "fish", "shrimp", "tuna",
    "egg", "eggs", "rice", "pasta", "bread", "noodle", "noodles", "pizza", "burger", "taco",
    "salad", "soup", "sandwich", "wrap", "bowl", "smoothie", "oatmeal", "pancake", "waffle",
    "sushi", "curry", "stir", "fry", "grill", "roast", "bake", "toast",
    "cheese", "yogurt", "milk", "cream", "butter", "tofu", "tempeh", "lentil", "lentils",
    "bean", "beans", "chickpea", "quinoa", "oats", "cereal", "granola",
    "bacon", "ham", "sausage", "meatball", "stew", "chili", "casserole",
    "cake", "cookie", "brownie", "pie", "ice cream", "chocolate", "candy",
    "fries", "nachos", "wings", "ramen", "pho", "mac",
    # Vegetables & fruits
    "broccoli", "spinach", "kale", "avocado", "tomato", "potato", "sweet potato",
    "onion", "garlic", "pepper", "carrot", "zucchini", "mushroom", "corn",
    "apple", "banana", "berry", "berries", "mango", "orange", "lemon",
    "cucumber", "celery", "lettuce", "cabbage", "cauliflower", "peas",
    # Cooking & meal terms
    "recipe", "meal", "dish", "cook", "cooking", "food", "eat", "eating", "snack",
    "breakfast", "lunch", "dinner", "dessert", "appetizer", "ingredient", "ingredients",
    "serve", "serving", "portion", "prep", "minute",
    # Nutrition terms
    "protein", "carb", "carbs", "fat", "fiber", "calorie", "calories", "macro", "macros",
    "vitamin", "mineral", "sodium", "sugar", "cholesterol", "nutrition", "nutrient",
    "healthy", "unhealthy", "whole food", "processed", "organic",
    # Diet & health terms
    "diet", "keto", "paleo", "vegan", "vegetarian", "fasting", "intermittent",
    "weight", "muscle", "energy", "metabolism", "gut", "digestion",
    "fuel", "score", "mes",
    # Healthify terms
    "healthify", "healthier", "clean up", "whole-food",
}


def _looks_food_related(text: str) -> bool:
    """Quick heuristic: does this text look like it's about food, nutrition, cooking, or health?"""
    words = set(re.findall(r"[a-zA-Z][a-zA-Z'-]*", text.lower()))
    return bool(words & _FOOD_KEYWORDS)


def _classify_intent(user_input: str, chat_context: dict | None = None) -> str:
    text = (user_input or "").strip().lower()

    # Empty input — no image context either
    if not text and not (chat_context and chat_context.get("image_base64")):
        return "empty_input"

    # Photo analysis — image attached
    if chat_context and chat_context.get("image_base64"):
        return "photo_analysis"

    # Context-driven overrides — scan source always means post_scan_guidance
    if chat_context and chat_context.get("source") == "scan" and chat_context.get("scan_result"):
        return "post_scan_guidance"

    # Fridge-to-meal: user lists ingredients they have
    if re.search(r"\b(i have|i've got|using|got some|with these|ingredients?:)\b", text) and any(
        token in text for token in ["make", "cook", "what can", "recipe", "meal", "dinner", "lunch", "breakfast"]
    ):
        return "fridge_to_meal"
    if re.search(r"\bwhat (can|should) i (make|cook)\b", text):
        return "fridge_to_meal"

    # Score explainer
    if re.search(r"\b(why|how come|explain|what dragged|what hurt)\b.*(score|mes|fuel)\b", text, re.IGNORECASE):
        return "score_explainer"
    if re.search(r"\b(score|mes|fuel).*(low|bad|why|explain|breakdown|high|good)\b", text, re.IGNORECASE):
        return "score_explainer"

    # Modify prior recipe
    if (
        any(token in text for token in ["change the", "modify", "swap", "instead of", "make it with", "without"])
        or re.search(r"\b(change|replace)\b.+\b(to|with)\b", text)
    ):
        return "modify_prior_recipe"

    # General nutrition / health questions (broader matching)
    if any(token in text for token in ["what is", "how many", "is this healthy", "why is", "should i", "can i",
                                       "how much", "is it", "are there", "do i need", "how does", "what are",
                                       "is intermittent", "what about", "tell me about"]):
        if _looks_food_related(text) or "?" in text:
            return "general_nutrition_question"
    if any(token in text for token in ["protein", "fiber", "calories", "macros", "carbs", "fat",
                                       "nutrition", "diet", "keto", "paleo", "fasting", "weight",
                                       "metabolism", "gut health", "vitamins"]):
        return "general_nutrition_question"

    # Explicit healthify requests
    if any(token in text for token in ["healthy version", "healthify", "clean up", "whole-food", "make this healthier"]):
        return "healthify_unhealthy_meal"

    # If the text looks food-related, treat as a food request (healthify or lookup)
    if _looks_food_related(text):
        words = re.findall(r"[a-zA-Z][a-zA-Z'-]*", text)
        if 1 <= len(words) <= 6:
            return "healthify_unhealthy_meal"
        return "lookup_existing_meal"

    # Not food-related — route to general handler (LLM will politely redirect)
    return "general_nutrition_question"


def _parse_markdown_recipe(raw_text: str) -> dict[str, Any] | None:
    lines = (raw_text or "").splitlines()
    mode = "message"
    saw_recipe = False
    message_lines: list[str] = []
    ingredients: list[dict[str, Any]] = []
    steps: list[str] = []
    swaps: list[dict[str, Any]] = []
    current_swap: dict[str, Any] | None = None
    title = ""
    description = ""
    prep_time = 0
    cook_time = 0
    servings = 1

    def _parse_ingredient(text: str) -> dict[str, Any] | None:
        t = _clean_md_line(text)
        t = re.sub(r"^[-*•]\s*", "", t)
        t = re.sub(r"^\d+[\).\s-]+", "", t)
        if not t:
            return None
        if ":" in t:
            name, qty = t.split(":", 1)
            return {"name": name.strip(), "quantity": qty.strip(), "unit": ""}
        match = re.match(r"^(\d+(?:\/\d+)?(?:\.\d+)?)(?:\s+([a-zA-Z]+))?\s+(.+)$", t)
        if match:
            return {"name": match.group(3).strip(), "quantity": match.group(1).strip(), "unit": (match.group(2) or "").strip()}
        return {"name": t, "quantity": "", "unit": ""}

    for raw in lines:
        line = (raw or "").strip()
        if not line or line.startswith("```") or line.startswith("'''"):
            continue
        clean = re.sub(r"^#+\s*", "", _clean_md_line(line)).strip()

        title_match = re.match(r"^(?:recipe|title)\s*:\s*(.+)$", clean, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
            saw_recipe = True
            continue
        desc_match = re.match(r"^description\s*:\s*(.+)$", clean, re.IGNORECASE)
        if desc_match:
            description = desc_match.group(1).strip()
            saw_recipe = True
            continue
        if re.match(r"^ingredients?\s*:?$", clean, re.IGNORECASE):
            mode = "ingredients"
            saw_recipe = True
            continue
        if re.match(r"^(instructions?|steps?|directions?)\s*:?$", clean, re.IGNORECASE):
            mode = "steps"
            saw_recipe = True
            continue
        if re.match(r"^swaps?\s*:?$", clean, re.IGNORECASE):
            mode = "swaps"
            saw_recipe = True
            continue
        prep_match = re.match(r"^prep\s*time\s*:?\s*(\d+)", clean, re.IGNORECASE)
        if prep_match:
            prep_time = int(prep_match.group(1))
            continue
        cook_match = re.match(r"^cook\s*time\s*:?\s*(\d+)", clean, re.IGNORECASE)
        if cook_match:
            cook_time = int(cook_match.group(1))
            continue
        servings_match = re.match(r"^servings?\s*:?\s*(\d+)", clean, re.IGNORECASE)
        if servings_match:
            servings = int(servings_match.group(1))
            continue

        if mode == "ingredients":
            ing = _parse_ingredient(line)
            if ing:
                ingredients.append(ing)
                saw_recipe = True
            continue
        if mode == "steps":
            step = re.sub(r"^\d+[\).\s-]+", "", clean).strip()
            step = re.sub(r"^[-*•]\s*", "", step).strip()
            if step:
                steps.append(step)
                saw_recipe = True
            continue
        if mode == "swaps":
            line_no_prefix = re.sub(r"^\d+[\).\s-]+", "", clean).strip()
            arrow_match = re.match(r"^(.+?)\s*(?:->|→)\s*(.+?)(?:\s*[—-]\s*(.+))?$", line_no_prefix)
            if arrow_match:
                swaps.append(
                    {
                        "original": arrow_match.group(1).strip(),
                        "replacement": arrow_match.group(2).strip(),
                        "reason": (arrow_match.group(3) or "healthier whole-food alternative").strip(),
                    }
                )
                saw_recipe = True
                continue
            original_match = re.match(r"^original\s*:\s*(.+)$", line_no_prefix, re.IGNORECASE)
            if original_match:
                if current_swap and (current_swap.get("original") or current_swap.get("replacement")):
                    swaps.append(current_swap)
                current_swap = {"original": original_match.group(1).strip()}
                continue
            replacement_match = re.match(r"^replacement\s*:\s*(.+)$", line_no_prefix, re.IGNORECASE)
            if replacement_match:
                current_swap = current_swap or {}
                current_swap["replacement"] = replacement_match.group(1).strip()
                continue
            reason_match = re.match(r"^reason\s*:\s*(.+)$", line_no_prefix, re.IGNORECASE)
            if reason_match:
                current_swap = current_swap or {}
                current_swap["reason"] = reason_match.group(1).strip()
                if current_swap.get("original") or current_swap.get("replacement"):
                    swaps.append(current_swap)
                    current_swap = None
                continue

        message_lines.append(clean)

    if not saw_recipe:
        return None
    if current_swap and (current_swap.get("original") or current_swap.get("replacement")):
        swaps.append(current_swap)
    return {
        "message": "\n".join([m for m in message_lines if m]).strip() or "Here’s a healthified version with cleaner ingredients.",
        "recipe": {
            "title": title or "Healthified Recipe",
            "description": description,
            "ingredients": ingredients,
            "steps": steps,
            "prep_time_min": prep_time,
            "cook_time_min": cook_time,
            "servings": servings,
        },
        "swaps": swaps or None,
        "nutrition": None,
    }


def _try_repair_truncated_json(text: str) -> str | None:
    """Attempt to close truncated JSON by adding missing brackets/braces.
    Uses a stack-based approach to track nesting properly."""
    if not text or not text.strip():
        return None
    stack: list[str] = []  # tracks open delimiters: { or [
    in_string = False
    escape_next = False
    for ch in text:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\':
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ('{', '['):
            stack.append(ch)
        elif ch == '}' and stack and stack[-1] == '{':
            stack.pop()
        elif ch == ']' and stack and stack[-1] == '[':
            stack.pop()
    if not stack:
        return None  # JSON is balanced — not truncated

    # Strip trailing incomplete content
    repaired = text.rstrip()
    if in_string:
        # Close the open string, then remove the incomplete key-value pair
        repaired += '"'
        # Check if this was a value in an object/array — if the last complete structure
        # before this string can be identified, trim to it
    # Remove trailing comma
    repaired = repaired.rstrip().rstrip(',')
    # Close all open delimiters in reverse order
    for opener in reversed(stack):
        repaired += ']' if opener == '[' else '}'
    return repaired


def _extract_payload(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()
    else:
        # Handle incomplete fenced JSON (opening ``` but no closing ```)
        fence_open = re.search(r"```(?:json)?\s*", text, re.IGNORECASE)
        if fence_open:
            text = text[fence_open.end():].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate_slice = text[start : end + 1]
        # Verify this is balanced JSON, not just an inner brace
        try:
            json.loads(candidate_slice)
            text = candidate_slice
        except json.JSONDecodeError:
            # The rfind("}") found an inner brace, not the outer close — treat as truncated
            text = text[start:]
    elif start != -1:
        # JSON starts but never closes — truncated response
        text = text[start:]
    normalized = text.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
    normalized = re.sub(r'("quantity"\s*:\s*)(\d+\s*/\s*\d+)(\s*[,}])', r'\1"\2"\3', normalized)
    normalized = re.sub(r",\s*([}\]])", r"\1", normalized)
    for candidate in (normalized, text):
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return {
                    "message": parsed.get("message", raw_text),
                    "recipe": parsed.get("recipe"),
                    "swaps": parsed.get("swaps"),
                    "nutrition": parsed.get("nutrition"),
                    "mes_score": parsed.get("mes_score"),
                    "response_mode": parsed.get("response_mode"),
                    "matched_recipe_id": parsed.get("matched_recipe_id"),
                    "retrieval_confidence": parsed.get("retrieval_confidence"),
                    "prompt_version": parsed.get("prompt_version"),
                }
        except json.JSONDecodeError:
            pass
    # Attempt to repair truncated JSON before falling back to markdown
    repaired_text = _try_repair_truncated_json(normalized) or _try_repair_truncated_json(text)
    if repaired_text:
        try:
            parsed = json.loads(repaired_text)
            if isinstance(parsed, dict):
                logger.info("healthify.parse.truncated_json_repaired chars=%d", len(text))
                return {
                    "message": parsed.get("message", raw_text),
                    "recipe": parsed.get("recipe"),
                    "swaps": parsed.get("swaps"),
                    "nutrition": parsed.get("nutrition"),
                    "mes_score": parsed.get("mes_score"),
                    "response_mode": parsed.get("response_mode"),
                    "matched_recipe_id": parsed.get("matched_recipe_id"),
                    "retrieval_confidence": parsed.get("retrieval_confidence"),
                    "prompt_version": parsed.get("prompt_version"),
                }
        except json.JSONDecodeError:
            pass
    markdown_payload = _parse_markdown_recipe(raw_text)
    if markdown_payload:
        return markdown_payload
    return {"message": raw_text, "recipe": None, "swaps": None, "nutrition": None, "mes_score": None}


def parse_healthify_response(raw_text: str) -> dict[str, Any]:
    payload = _extract_payload(raw_text)
    payload = _validate_recipe_payload(payload)
    payload["swaps"] = _normalize_swaps(payload.get("swaps"))
    if not _nutrition_is_plausible(payload.get("nutrition")):
        payload["nutrition"] = None
    return payload


def _validate_recipe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    recipe = payload.get("recipe")
    if not recipe:
        return payload
    try:
        normalized = RecipeSchema.model_validate(recipe)
    except ValidationError as exc:
        logger.warning("healthify.validate.schema_error title=%r errors=%s", recipe.get("title"), exc.error_count())
        payload["recipe"] = None
        payload["swaps"] = payload.get("swaps") or []
        payload["nutrition"] = payload.get("nutrition") or None
        return payload

    ingredients = [
        {
            "name": ingredient.name.strip(),
            "quantity": ingredient.quantity if ingredient.quantity is not None else "",
            "unit": ingredient.unit or "",
        }
        for ingredient in normalized.ingredients
        if ingredient.name.strip()
    ]
    steps = [step.strip() for step in normalized.steps if step and step.strip()]
    if not ingredients or not steps:
        logger.warning(
            "healthify.validate.empty_recipe title=%r ingredients=%d steps=%d",
            normalized.title, len(ingredients), len(steps),
        )
        payload["recipe"] = None
        return payload

    recipe_payload = normalized.model_dump()
    recipe_payload["ingredients"] = ingredients
    recipe_payload["steps"] = steps
    recipe_payload["prep_time_min"] = max(0, min(int(recipe_payload.get("prep_time_min") or 0), 240))
    recipe_payload["cook_time_min"] = max(0, min(int(recipe_payload.get("cook_time_min") or 0), 360))
    recipe_payload["servings"] = max(1, min(int(recipe_payload.get("servings") or 1), 12))
    payload["recipe"] = recipe_payload
    return payload


def _nutrition_is_plausible(nutrition: dict[str, Any] | None) -> bool:
    if not nutrition:
        return True
    if not isinstance(nutrition, dict):
        return False
    for branch in ("original_estimate", "healthified_estimate"):
        values = nutrition.get(branch) or {}
        if not isinstance(values, dict):
            return False
        for key in ("calories", "protein", "carbs", "fat", "fiber"):
            value = float(values.get(key, 0) or 0)
            if value < 0 or value > 5000:
                return False
    return True


def _normalize_swaps(swaps: Any) -> list[dict[str, str]]:
    if not isinstance(swaps, list):
        return []

    normalized: list[dict[str, str]] = []
    for swap in swaps:
        if not isinstance(swap, dict):
            continue
        original = str(swap.get("original", "") or "").strip()
        replacement = str(swap.get("replacement", "") or "").strip()
        reason = str(swap.get("reason", "") or "").strip()
        if not original or not replacement:
            continue
        normalized.append(
            {
                "original": original,
                "replacement": replacement,
                "reason": reason or "Cleaner whole-food alternative.",
            }
        )
    return normalized


def _find_last_recipe_message(history: List[dict[str, Any]]) -> dict[str, Any] | None:
    for msg in reversed(history or []):
        if msg.get("role") != "assistant":
            continue
        recipe = msg.get("recipe")
        if isinstance(recipe, dict) and recipe.get("ingredients") and recipe.get("steps"):
            return msg
    return None


def _extract_requested_swap(user_input: str) -> tuple[str, str] | None:
    text = " ".join((user_input or "").strip().split())
    patterns = [
        r"(?:change|swap|replace)\s+(.+?)\s+(?:to|for|with)\s+(.+)$",
        r"(?:make it|make this)\s+with\s+(.+?)\s+instead of\s+(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        if "instead of" in pattern:
            replacement = match.group(1).strip(" .,!?:;")
            original = match.group(2).strip(" .,!?:;")
        else:
            original = match.group(1).strip(" .,!?:;")
            replacement = match.group(2).strip(" .,!?:;")
        if original and replacement and original.lower() != replacement.lower():
            return original, replacement
    return None


def _replace_case_insensitive(value: str, original: str, replacement: str) -> tuple[str, bool]:
    if not value:
        return value, False
    pattern = re.compile(re.escape(original), re.IGNORECASE)
    updated, count = pattern.subn(replacement, value)
    return updated, count > 0


def _apply_direct_recipe_swap(
    recipe: dict[str, Any],
    original: str,
    replacement: str,
) -> tuple[dict[str, Any], bool]:
    updated_recipe = deepcopy(recipe)
    changed = False

    for key in ("title", "description"):
        current = str(updated_recipe.get(key) or "")
        replaced, did_change = _replace_case_insensitive(current, original, replacement)
        if did_change:
            updated_recipe[key] = replaced
            changed = True

    ingredients = []
    for ingredient in list(updated_recipe.get("ingredients") or []):
        item = deepcopy(ingredient)
        name = str(item.get("name") or "")
        replaced_name, did_change = _replace_case_insensitive(name, original, replacement)
        if did_change:
            item["name"] = replaced_name
            changed = True
        ingredients.append(item)
    updated_recipe["ingredients"] = ingredients

    steps = []
    for step in list(updated_recipe.get("steps") or []):
        replaced_step, did_change = _replace_case_insensitive(str(step), original, replacement)
        if did_change:
            changed = True
        steps.append(replaced_step)
    updated_recipe["steps"] = steps

    return updated_recipe, changed


async def _modify_prior_recipe(
    user_input: str,
    history: List[dict],
    user_context: str = "",
) -> dict[str, Any] | None:
    prior_message = _find_last_recipe_message(history)
    if not prior_message:
        return None

    prior_recipe = deepcopy(prior_message.get("recipe") or {})
    prior_nutrition = deepcopy(prior_message.get("nutrition") or None)
    prior_mes = deepcopy(prior_message.get("mes_score") or None)

    requested_swap = _extract_requested_swap(user_input)
    if requested_swap:
        original, replacement = requested_swap
        updated_recipe, changed = _apply_direct_recipe_swap(prior_recipe, original, replacement)
        if changed:
            return {
                "message": f"Updated your {prior_recipe.get('title') or 'recipe'} by swapping {original} for {replacement}. I kept the rest of the meal the same.",
                "recipe": updated_recipe,
                "swaps": [
                    {
                        "original": original,
                        "replacement": replacement,
                        "reason": "Updated based on your request while keeping the same meal.",
                    }
                ],
                "nutrition": None,
                "mes_score": prior_mes,
                "response_mode": "modified",
                "matched_recipe_id": prior_message.get("matched_recipe_id"),
                "retrieval_confidence": None,
                "prompt_version": PROMPT_VERSION,
            }

    llm = get_llm("chat")
    system_prompt = MODIFY_PROMPT
    if user_context:
        system_prompt = f"{MODIFY_PROMPT}\n\n{user_context}"
    messages = [SystemMessage(content=system_prompt)]
    messages.append(
        HumanMessage(
            content=(
                "Existing recipe JSON:\n"
                + json.dumps(prior_recipe, indent=2)
                + "\n\nExisting nutrition JSON:\n"
                + json.dumps(prior_nutrition, indent=2)
                + f"\n\nUser modification request:\n{user_input}\n\nReturn JSON only."
            )
        )
    )
    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)
    if not payload.get("recipe"):
        return None
    payload["response_mode"] = "modified"
    payload["matched_recipe_id"] = prior_message.get("matched_recipe_id")
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def repair_missing_recipe(
    user_input: str,
    user_context: str = "",
    retrieved_context: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """Standalone repair call: asks the LLM to produce a valid recipe when the first attempt failed.
    Returns the repaired payload dict (with recipe, message, swaps, nutrition) or None."""
    logger.warning("healthify.repair.started user_input=%r", user_input[:80])
    try:
        llm = get_llm("chat")
        repair_prompt = """Your previous response did not include a valid recipe object.
Return strict JSON only with keys: message, recipe, swaps, nutrition.
Requirements:
- recipe must be non-null
- recipe.ingredients must contain at least 5 items
- recipe.steps must contain at least 3 concise steps
- keep the dish faithful to the user's request
"""
        system = f"{GENERATE_PROMPT}\n\n{user_context}\n\n{repair_prompt}" if user_context else f"{GENERATE_PROMPT}\n\n{repair_prompt}"
        repair_messages: list = [SystemMessage(content=system)]
        if retrieved_context:
            repair_messages.append(
                HumanMessage(
                    content=(
                        "Closest existing recipe context:\n"
                        + json.dumps(retrieved_context, indent=2)
                        + f"\n\nUser request:\n{user_input}\n\nReturn JSON only."
                    )
                )
            )
        else:
            repair_messages.append(
                HumanMessage(content=f"User request:\n{user_input}\n\nReturn JSON only.")
            )
        repair_response = await llm.ainvoke(repair_messages)
        repaired = parse_healthify_response(repair_response.content)
        if repaired.get("recipe"):
            logger.info("healthify.repair.succeeded user_input=%r title=%r", user_input[:80], repaired["recipe"].get("title"))
            return repaired
        logger.warning("healthify.repair.failed user_input=%r", user_input[:80])
        return None
    except Exception as exc:
        logger.exception("healthify.repair.error user_input=%r error=%s", user_input[:80], exc)
        return None


async def _generate_healthified_payload(
    user_input: str,
    history: List[dict],
    retrieved_context: list[dict[str, Any]],
    user_context: str = "",
) -> dict[str, Any]:
    llm = get_llm("chat")
    system_prompt = GENERATE_PROMPT
    if user_context:
        system_prompt = f"{GENERATE_PROMPT}\n\n{user_context}"
    messages = [SystemMessage(content=system_prompt)]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    context_block = ""
    if retrieved_context:
        context_block = "Closest existing recipe context:\n" + json.dumps(retrieved_context, indent=2)
    messages.append(
        HumanMessage(
            content=f"{context_block}\n\nUser request:\n{user_input}\n\nReturn JSON only."
        )
    )

    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)

    if not payload.get("recipe"):
        repaired = await repair_missing_recipe(user_input, user_context, retrieved_context)
        if repaired:
            if _nutrition_is_plausible(repaired.get("nutrition")):
                payload["nutrition"] = repaired.get("nutrition") or payload.get("nutrition")
            payload["recipe"] = repaired.get("recipe")
            payload["message"] = repaired.get("message") or payload.get("message")
            payload["swaps"] = repaired.get("swaps") or payload.get("swaps")

    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = retrieved_context[0]["id"] if retrieved_context else None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def _answer_general_question(
    user_input: str, history: List[dict], user_context: str = ""
) -> dict[str, Any]:
    llm = get_llm("chat", max_tokens=1024)
    system_prompt = GENERAL_PROMPT
    if user_context:
        system_prompt = f"{GENERAL_PROMPT}\n\n{user_context}"
    messages = [SystemMessage(content=system_prompt)]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=user_input))
    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)
    payload["recipe"] = None
    payload["nutrition"] = payload.get("nutrition") if _nutrition_is_plausible(payload.get("nutrition")) else None
    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def _handle_fridge_to_meal(
    user_input: str,
    history: List[dict],
    user_context: str = "",
) -> dict[str, Any]:
    llm = get_llm("chat")
    system_prompt = FRIDGE_TO_MEAL_PROMPT
    if user_context:
        system_prompt = f"{FRIDGE_TO_MEAL_PROMPT}\n\n{user_context}"
    messages = [SystemMessage(content=system_prompt)]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=f"User's available ingredients:\n{user_input}\n\nReturn JSON only."))
    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)
    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def _handle_score_explainer(
    user_input: str,
    history: List[dict],
    user_context: str = "",
    db: Session | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    llm = get_llm("chat", max_tokens=1024)

    # Inject actual Fuel Score data so the LLM knows the user's current score
    score_context = ""
    if db and user_id:
        try:
            from app.services.fuel_score import get_daily_fuel_scores
            today = datetime.now(UTC).date()
            scores = get_daily_fuel_scores(db, user_id, today)
            if scores:
                avg_score = round(sum(scores) / len(scores))
                score_context = f"\n\nUser's current Fuel Score today: {avg_score}/100 (based on {len(scores)} meal(s) logged today)."
            else:
                score_context = "\n\nUser has not logged any meals today yet. No Fuel Score data available for today."
        except Exception:
            pass

    system_prompt = SCORE_EXPLAINER_PROMPT + score_context
    if user_context:
        system_prompt = f"{system_prompt}\n\n{user_context}"
    messages = [SystemMessage(content=system_prompt)]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=user_input))
    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)
    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def _handle_post_scan(
    user_input: str,
    history: List[dict],
    chat_context: dict,
    user_context: str = "",
) -> dict[str, Any]:
    llm = get_llm("chat")
    system_prompt = POST_SCAN_PROMPT
    if user_context:
        system_prompt = f"{POST_SCAN_PROMPT}\n\n{user_context}"
    messages = [SystemMessage(content=system_prompt)]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    scan = chat_context.get("scan_result") or {}
    scan_summary = (
        f"Scan result:\n"
        f"- Meal: {scan.get('meal_label', 'Unknown')}\n"
        f"- Fuel Score: {scan.get('fuel_score', 'N/A')}/100\n"
    )
    flags = scan.get("whole_food_flags") or []
    if flags:
        flag_lines = [f"  • {f.get('ingredient', '?')}: {f.get('reason', '')}" for f in flags[:6]]
        scan_summary += "- Flagged ingredients:\n" + "\n".join(flag_lines) + "\n"

    messages.append(HumanMessage(content=f"{scan_summary}\nUser message:\n{user_input}\n\nReturn JSON only."))
    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)
    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def _handle_photo_analysis(
    user_input: str,
    history: List[dict],
    chat_context: dict,
    user_context: str = "",
) -> dict[str, Any]:
    """Handle photo-based chat: fridge, plated meal, grocery item, or nutrition label."""
    import base64 as b64mod

    llm = get_llm("chat")
    system_prompt = PHOTO_ANALYSIS_PROMPT.format(user_context=user_context or "")
    messages = [SystemMessage(content=system_prompt)]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    image_b64 = chat_context.get("image_base64", "")
    image_type_hint = chat_context.get("image_type", "auto")

    # Build multimodal message with image + text
    content_parts: list[dict] = []
    if image_b64:
        # Determine mime type (assume jpeg if not specified)
        mime = "image/jpeg"
        if image_b64.startswith("/9j/"):
            mime = "image/jpeg"
        elif image_b64.startswith("iVBOR"):
            mime = "image/png"
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{image_b64}"},
        })

    user_text = user_input or "What do you see in this photo? Help me with food suggestions."
    if image_type_hint != "auto":
        user_text = f"[Image type hint: {image_type_hint}]\n{user_text}"
    content_parts.append({"type": "text", "text": f"{user_text}\n\nReturn JSON only."})

    messages.append(HumanMessage(content=content_parts))
    response = await llm.ainvoke(messages)
    payload = parse_healthify_response(response.content)
    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def healthify_agent(
    db: Session,
    user_input: str,
    history: List[dict],
    stream: bool = False,
    user_id: str | None = None,
    chat_context: dict | None = None,
) -> dict[str, Any] | AsyncIterator[str]:
    intent = _classify_intent(user_input, chat_context)

    # Build cached context once (eliminates all duplicate DB queries)
    cached = _build_cached_user_context(db, user_id, chat_context)
    user_context = cached.context_text

    if intent == "photo_analysis":
        payload = await _handle_photo_analysis(user_input, history, chat_context or {}, user_context)
        mes = _compute_recipe_mes_from_cache(cached, payload.get("nutrition"))
        if mes:
            payload["mes_score"] = mes
        if stream:
            async def _gen():
                yield payload.get("message", "")
                yield "\n\n<!-- PAYLOAD:" + json.dumps(payload) + " -->"
            return _gen()
        return payload

    _STREAM_ERROR_PAYLOAD = json.dumps({
        "message": "Sorry, I hit a snag. Please try again.",
        "recipe": None, "swaps": None, "nutrition": None,
    })

    if intent == "empty_input":
        empty_payload = {
            "message": "Hi! I'm your Fuel Coach. Ask me to healthify a meal, suggest a recipe, or answer any nutrition question.",
            "recipe": None, "swaps": None, "nutrition": None,
            "response_mode": "generated", "matched_recipe_id": None,
            "retrieval_confidence": None, "prompt_version": PROMPT_VERSION,
        }
        if stream:
            async def _empty_stream():
                yield json.dumps(empty_payload)
            return _empty_stream()
        return empty_payload

    if intent == "fridge_to_meal":
        if stream:
            async def _fridge_stream():
                yield ""  # heartbeat: keeps SSE connection alive during LLM processing
                try:
                    payload = await _handle_fridge_to_meal(user_input, history, user_context)
                    mes = _compute_recipe_mes_from_cache(cached, payload.get("nutrition"))
                    if mes:
                        payload["mes_score"] = mes
                    yield json.dumps(payload)
                except Exception as exc:
                    logger.exception("_fridge_stream failed: %s", exc)
                    yield _STREAM_ERROR_PAYLOAD
            return _fridge_stream()
        payload = await _handle_fridge_to_meal(user_input, history, user_context)
        mes = _compute_recipe_mes_from_cache(cached, payload.get("nutrition"))
        if mes:
            payload["mes_score"] = mes
        return payload

    if intent == "score_explainer":
        if stream:
            async def _score_stream():
                yield ""  # heartbeat
                try:
                    payload = await _handle_score_explainer(user_input, history, user_context, db=db, user_id=user_id)
                    yield json.dumps(payload)
                except Exception as exc:
                    logger.exception("_score_stream failed: %s", exc)
                    yield _STREAM_ERROR_PAYLOAD
            return _score_stream()
        payload = await _handle_score_explainer(user_input, history, user_context, db=db, user_id=user_id)
        return payload

    if intent == "post_scan_guidance":
        if stream:
            async def _scan_stream():
                yield ""  # heartbeat
                try:
                    payload = await _handle_post_scan(user_input, history, chat_context or {}, user_context)
                    mes = _compute_recipe_mes_from_cache(cached, payload.get("nutrition"))
                    if mes:
                        payload["mes_score"] = mes
                    yield json.dumps(payload)
                except Exception as exc:
                    logger.exception("_scan_stream failed: %s", exc)
                    yield _STREAM_ERROR_PAYLOAD
            return _scan_stream()
        payload = await _handle_post_scan(user_input, history, chat_context or {}, user_context)
        mes = _compute_recipe_mes_from_cache(cached, payload.get("nutrition"))
        if mes:
            payload["mes_score"] = mes
        return payload

    if intent == "general_nutrition_question":
        if stream:
            async def _general_stream():
                yield ""  # heartbeat
                try:
                    payload = await _answer_general_question(user_input, history, user_context)
                    yield json.dumps(payload)
                except Exception as exc:
                    logger.exception("_general_stream failed: %s", exc)
                    yield _STREAM_ERROR_PAYLOAD
            return _general_stream()
        return await _answer_general_question(user_input, history, user_context)

    if intent == "modify_prior_recipe":
        modified_payload = await _modify_prior_recipe(user_input, history, user_context)
        if modified_payload:
            nutrition = modified_payload.get("nutrition")
            mes = _compute_recipe_mes_from_cache(cached, nutrition)
            if mes:
                modified_payload["mes_score"] = mes
            if stream:
                async def _modified_stream():
                    yield json.dumps(modified_payload)
                return _modified_stream()
            return modified_payload

    retrieval = await retrieve_recipe_candidates(db, user_input, limit=3, recipe_role="full_meal")
    top = (retrieval.get("results") or [None])[0]
    top_score = float((top or {}).get("score") or 0)
    top_lexical = float((top or {}).get("lexical_score") or 0)
    # Validate retrieved recipe against user's dietary constraints before returning
    from app.models.user import User as UserModel
    user_obj = db.query(UserModel).filter(UserModel.id == user_id).first() if user_id else None
    if top and (top_score >= RETRIEVAL_THRESHOLD or top_lexical >= LEXICAL_RETRIEVAL_THRESHOLD):
        recipe = top["recipe"]
        if _recipe_conflicts_with_user(recipe, user_obj):
            logger.info(
                "healthify.retrieval.skipped_conflict user_id=%s recipe=%s",
                user_id, recipe.title,
            )
            # Fall through to LLM generation which respects dietary constraints via system prompt
        else:
            payload = _retrieved_response(recipe, top_score, user_context)
            payload["retrieval_debug"] = retrieval.get("timings_ms")
            nutrition = payload.get("nutrition")
            mes = _compute_recipe_mes_from_cache(cached, nutrition)
            if mes:
                payload["mes_score"] = mes
            if stream:
                async def _retrieved_stream():
                    yield json.dumps(payload)
                return _retrieved_stream()
            return payload

    retrieved_context = [_recipe_to_payload(item["recipe"]) for item in (retrieval.get("results") or [])[:3]]
    if stream:
        llm = get_llm("chat")
        system_prompt = GENERATE_PROMPT
        if user_context:
            system_prompt = f"{GENERATE_PROMPT}\n\n{user_context}"
        messages = [SystemMessage(content=system_prompt)]
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        context_block = ""
        if retrieved_context:
            context_block = "Reference recipes:\n" + json.dumps(retrieved_context, separators=(",", ":"))
        messages.append(HumanMessage(content=f"{context_block}\n\nUser request:\n{user_input}\n\nReturn JSON only."))

        async def stream_response():
            async for chunk in llm.astream(messages):
                if chunk.content:
                    yield chunk.content

        return stream_response()

    payload = await _generate_healthified_payload(user_input, history, retrieved_context, user_context)
    if top:
        payload["matched_recipe_id"] = str(top["recipe"].id)
        payload["retrieval_confidence"] = float(top.get("score") or 0)
    payload["retrieval_debug"] = retrieval.get("timings_ms")
    nutrition = payload.get("nutrition")
    mes = _compute_recipe_mes_from_cache(cached, nutrition)
    if mes:
        payload["mes_score"] = mes
    return payload
