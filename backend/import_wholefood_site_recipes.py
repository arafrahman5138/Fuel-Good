#!/usr/bin/env python3
"""
Import recipes from external websites, filtering for whole-food compliance.

Usage:
    cd backend
    python3 import_wholefood_site_recipes.py \
        --start-url https://moribyan.com/recipe-index/ --limit 50

Pipeline:
    1. Crawl recipe pages from the provided start URL
    2. Extract structured recipe data (JSON-LD preferred, HTML fallback)
    3. Screen ingredients against whole-food policy
    4. Substitute disallowed ingredients where possible; reject otherwise
    5. Classify recipes (role, taxonomy, MES scoring)
    6. Insert/update rows in the Recipe table and emit an audit report
"""

from __future__ import annotations

import argparse
import html as html_mod
import json
import logging
import re
import ssl
import uuid
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any
from urllib.error import URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from app.db import SessionLocal, init_db
from app.models.recipe import Recipe, RECIPE_ROLES
from app.nutrition_tags import compute_health_benefits
from app.services.metabolic_engine import (
    classify_meal_context,
    MEAL_CONTEXT_FULL,
    MEAL_CONTEXT_COMPONENT_PROTEIN,
    MEAL_CONTEXT_COMPONENT_CARB,
    MEAL_CONTEXT_COMPONENT_VEG,
    MEAL_CONTEXT_SAUCE,
    MEAL_CONTEXT_DESSERT,
)

logger = logging.getLogger("fuelgood.recipe_importer")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
)

PROTEIN_OPTIONS = [
    "chicken", "beef", "lamb", "pork", "salmon",
    "shrimp", "other_fish", "eggs", "vegetarian",
]
CARB_OPTIONS = [
    "rice", "sweet_potato", "potato", "sourdough_bread", "oats",
    "quinoa", "tortillas", "noodles", "plantain",
]

# Minimum MES (Metabolic Energy Score) to accept a recipe into the database
MIN_IMPORT_MES = 75.0

DEFAULT_MES_BUDGET: dict[str, float] = {
    "protein_target_g": 130.0,
    "fiber_floor_g": 30.0,
    "sugar_ceiling_g": 36.0,
    "weight_protein": 0.50,
    "weight_fiber": 0.25,
    "weight_sugar": 0.25,
}

# Ingredients that trigger automatic substitution (regex -> replacement)
INGREDIENT_SUBSTITUTIONS: dict[str, str] = {
    r"\b(canola|rapeseed) oil\b": "extra virgin olive oil",
    r"\bsoybean oil\b": "extra virgin olive oil",
    r"\bcorn oil\b": "avocado oil",
    r"\bsunflower oil\b": "extra virgin olive oil",
    r"\bsafflower oil\b": "extra virgin olive oil",
    r"\bgrapeseed oil\b": "avocado oil",
    r"\bvegetable oil\b": "extra virgin olive oil",
    r"\bcottonseed oil\b": "extra virgin olive oil",
    r"\brace bran oil\b": "extra virgin olive oil",
    r"\bgranulated sugar\b": "monk fruit sweetener",
    r"\bwhite sugar\b": "monk fruit sweetener",
    r"\bbrown sugar\b": "coconut sugar",
    r"\bpowdered sugar\b": "monk fruit powdered sweetener",
    r"\bconfectioners sugar\b": "monk fruit powdered sweetener",
    r"\bhigh fructose corn syrup\b": "date syrup",
    r"\bcorn syrup\b": "raw honey",
    r"\b(all-purpose|plain|wheat) flour\b": "cassava flour",
    r"\bflour tortillas\b": "cassava tortillas",
    r"\bsoy sauce\b": "coconut aminos",
    r"\bpanko\b": "gluten-free breadcrumbs",
    r"\bbreadcrumbs\b": "gluten-free breadcrumbs",
    r"\bspaghetti\b": "chickpea spaghetti",
    r"\bpasta\b": "brown rice + quinoa pasta",
    r"\bnoodles\b": "brown rice noodles",
    r"\bburger buns\b": "sourdough burger buns",
    r"\bbun\b": "sourdough bun",
}

# Ingredients that cause immediate rejection (no substitution possible)
HARD_REJECT_PATTERNS: list[str] = [
    r"\bshortening\b",
    r"\bmargarine\b",
    r"\bartificial sweetener\b",
    r"\bartificial flavor\b",
    r"\bfood coloring\b",
    r"\b(aspartame|sucralose|acesulfame|saccharin)\b",
]

# Sourdough is the one allowed gluten exception
ALLOWED_GLUTEN_EXCEPTIONS = ["sourdough bread", "sourdough bun", "sourdough buns"]

# Unresolved ingredients that should have been caught by substitution
_UNRESOLVED_SEED_OILS = [
    "canola oil", "soybean oil", "corn oil", "sunflower oil",
    "safflower oil", "grapeseed oil", "vegetable oil",
    "cottonseed oil", "rice bran oil",
]
_UNRESOLVED_REFINED_SUGARS = [
    "white sugar", "granulated sugar", "brown sugar",
    "powdered sugar", "confectioners sugar",
    "corn syrup", "high fructose corn syrup",
]

# Blocked URL path segments (non-recipe pages)
_BLOCKED_URL_SEGMENTS = [
    "/category/", "/tag/", "/shop/", "/contact/", "/about/",
    "/privacy", "/wp-", "/feed/", "/author/", "/page/",
    "/search/", "/cdn-cgi/",
]

# Maps metabolic_engine context -> Recipe model recipe_role
_CONTEXT_TO_ROLE: dict[str, str] = {
    MEAL_CONTEXT_FULL: "full_meal",
    MEAL_CONTEXT_COMPONENT_PROTEIN: "protein_base",
    MEAL_CONTEXT_COMPONENT_CARB: "carb_base",
    MEAL_CONTEXT_COMPONENT_VEG: "veg_side",
    MEAL_CONTEXT_SAUCE: "sauce",
    MEAL_CONTEXT_DESSERT: "dessert",
}
_COMPONENT_ROLES = {"protein_base", "carb_base", "veg_side", "sauce"}
_NON_SCOREABLE_ROLES = {"dessert", "sauce", "veg_side"}

# Default micronutrient baselines (used when JSON-LD lacks nutrition data)
_MICRO_BASELINES: dict[str, float] = {
    "vitamin_a_mcg": 180, "vitamin_c_mg": 20, "vitamin_d_mcg": 1.2,
    "vitamin_e_mg": 3.0, "vitamin_k_mcg": 60, "thiamin_mg": 0.3,
    "riboflavin_mg": 0.3, "niacin_mg": 4.0, "vitamin_b6_mg": 0.5,
    "folate_mcg": 90, "vitamin_b12_mcg": 0.8, "calcium_mg": 120,
    "iron_mg": 3.0, "magnesium_mg": 80, "phosphorus_mg": 220,
    "potassium_mg": 450, "zinc_mg": 2.0, "selenium_mcg": 12,
    "omega3_g": 0.2,
}

# Fallback nutrition per serving when JSON-LD has no data
_DEFAULT_NUTRITION: dict[str, float] = {
    "calories": 460.0, "protein": 28.0, "carbs": 36.0,
    "fat": 20.0, "fiber": 6.0,
}

# Cuisine detection keywords
_CUISINE_KEYWORDS: dict[str, list[str]] = {
    "indian": ["indian", "masala", "tikka", "dal"],
    "thai": ["thai", "lemongrass", "pad thai"],
    "korean": ["korean", "kimchi", "gochujang"],
    "mexican": ["mexican", "taco", "salsa", "enchilada"],
    "japanese": ["japanese", "miso", "teriyaki", "ramen"],
    "chinese": ["chinese", "szechuan", "dumpling"],
    "vietnamese": ["vietnamese", "pho", "banh mi"],
    "mediterranean": ["mediterranean", "tzatziki", "hummus"],
    "middle_eastern": ["middle eastern", "shawarma", "tahini"],
    "american": ["burger", "bbq", "american"],
}

MEALS_PER_DAY = 3
MAX_INSTRUCTIONS = 20
MAX_FLAVORS = 3
FETCH_TIMEOUT_SECONDS = 30


# ---------------------------------------------------------------------------
# Web crawling helpers
# ---------------------------------------------------------------------------

class _LinkParser(HTMLParser):
    """Extracts all <a href="..."> links from an HTML page."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)


def _fetch_html(url: str) -> str:
    """Download a page as UTF-8 text, falling back to unverified SSL if needed."""
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            return response.read().decode("utf-8", "ignore")
    except URLError as exc:
        if "certificate verify failed" not in str(exc).lower():
            raise
        # Some recipe blogs have expired/misconfigured certs
        insecure_context = ssl._create_unverified_context()
        with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS, context=insecure_context) as response:
            return response.read().decode("utf-8", "ignore")


def _normalize_url(base: str, href: str) -> str:
    """Resolve relative URL and strip fragment/query."""
    resolved = urljoin(base, href)
    return resolved.split("#", 1)[0].split("?", 1)[0]


def _is_same_domain(url: str, allowed_domain: str) -> bool:
    try:
        return urlparse(url).netloc.endswith(allowed_domain)
    except Exception:
        return False


def _looks_like_recipe_post(url: str) -> bool:
    """Heuristic: recipe posts are shallow paths without CMS boilerplate."""
    path = urlparse(url).path.lower()
    if any(segment in path for segment in _BLOCKED_URL_SEGMENTS):
        return False
    segments = [s for s in path.split("/") if s]
    return len(segments) <= 2 and len("".join(segments)) > 5


def _extract_page_links(base_url: str, page_html: str, allowed_domain: str) -> list[str]:
    """Pull all same-domain links from a page."""
    parser = _LinkParser()
    parser.feed(page_html)
    return [
        _normalize_url(base_url, href)
        for href in parser.links
        if _is_same_domain(_normalize_url(base_url, href), allowed_domain)
    ]


# ---------------------------------------------------------------------------
# Recipe extraction (JSON-LD + HTML fallback)
# ---------------------------------------------------------------------------

_JSONLD_PATTERN = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S,
)


def _walk_json(obj: Any):
    """Recursively yield all dict nodes in a nested JSON structure."""
    if isinstance(obj, dict):
        yield obj
        for value in obj.values():
            yield from _walk_json(value)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk_json(item)


def _extract_recipe_jsonld(page_html: str) -> dict[str, Any] | None:
    """Find the first JSON-LD Recipe block with ingredients."""
    for raw_block in _JSONLD_PATTERN.findall(page_html):
        block = raw_block.strip()
        if not block:
            continue
        try:
            parsed = json.loads(block)
        except (json.JSONDecodeError, ValueError):
            continue
        for node in _walk_json(parsed):
            node_type = node.get("@type")
            is_recipe = (
                any(str(t).lower() == "recipe" for t in node_type)
                if isinstance(node_type, list)
                else str(node_type).lower() == "recipe"
            )
            if is_recipe and node.get("recipeIngredient"):
                return node
    return None


def _strip_html_tags(text: str) -> str:
    """Remove HTML tags, normalize whitespace, and unescape entities."""
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_mod.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_recipe_fallback(page_html: str) -> dict[str, Any] | None:
    """Extract a recipe from raw HTML when JSON-LD is absent."""
    title = ""
    heading_match = re.search(r"<h1[^>]*>(.*?)</h1>", page_html, flags=re.I | re.S)
    if heading_match:
        title = _strip_html_tags(heading_match.group(1))
    if not title:
        title_match = re.search(r"<title>(.*?)</title>", page_html, flags=re.I | re.S)
        if title_match:
            title = _strip_html_tags(title_match.group(1)).split("|")[0].strip()

    ingredients = [
        _strip_html_tags(li)
        for li in re.findall(r"<li[^>]*>(.*?)</li>", page_html, flags=re.I | re.S)
    ]
    ingredients = [ingredient for ingredient in ingredients if ingredient and len(ingredient) > 2]

    # Require at least 4 list items to consider this a real recipe
    if len(ingredients) < 4:
        return None

    return {
        "@type": "Recipe",
        "name": title or "Untitled Recipe",
        "description": "",
        "recipeIngredient": ingredients[:60],
        "recipeInstructions": [],
        "prepTime": None,
        "cookTime": None,
        "totalTime": None,
        "recipeYield": "2",
        "recipeCategory": [],
    }


# ---------------------------------------------------------------------------
# Ingredient policy (whole-food compliance)
# ---------------------------------------------------------------------------

def _clean_ingredient_text(raw: str) -> str:
    """Normalize whitespace, HTML entities, and stray punctuation."""
    text = html_mod.unescape(raw)
    text = re.sub(r"\s+", " ", text).strip(" -\t\n\r")
    return text.replace("\u00a0", " ")


def _check_hard_rejects(ingredient_lower: str) -> list[str]:
    """Return rejection reasons if ingredient contains banned substances."""
    return [
        f"hard-reject ingredient: {ingredient_lower}"
        for pattern in HARD_REJECT_PATTERNS
        if re.search(pattern, ingredient_lower)
    ]


def _check_unresolved_ingredients(ingredient_lower: str, original: str) -> list[str]:
    """Catch ingredients that should have been substituted but weren't."""
    reasons: list[str] = []

    has_unresolved_gluten = (
        bool(re.search(
            r"\b(all-purpose flour|plain flour|wheat flour|semolina|farina|barley|rye)\b",
            ingredient_lower,
        ))
        and not any(exc in ingredient_lower for exc in ALLOWED_GLUTEN_EXCEPTIONS)
    )
    if has_unresolved_gluten:
        reasons.append(f"unresolved gluten ingredient: {original}")

    if any(oil in ingredient_lower for oil in _UNRESOLVED_SEED_OILS):
        reasons.append(f"unresolved seed oil ingredient: {original}")

    if any(sugar in ingredient_lower for sugar in _UNRESOLVED_REFINED_SUGARS):
        reasons.append(f"unresolved refined sugar ingredient: {original}")

    return reasons


def apply_ingredient_policy(
    ingredients: list[str],
) -> tuple[list[str], list[str], list[str], bool]:
    """Screen and substitute ingredients against whole-food rules.

    Returns:
        (cleaned_ingredients, substitution_log, rejection_reasons, had_substitutions)
    """
    cleaned_ingredients: list[str] = []
    substitution_log: list[str] = []
    rejection_reasons: list[str] = []
    had_substitutions = False

    for raw in ingredients:
        original = _clean_ingredient_text(raw)
        original_lower = original.lower()

        # Check for hard-reject substances
        rejection_reasons.extend(_check_hard_rejects(original_lower))

        # Apply substitutions
        replaced = original
        for pattern, replacement in INGREDIENT_SUBSTITUTIONS.items():
            if re.search(pattern, replaced, flags=re.I):
                replaced = re.sub(pattern, replacement, replaced, flags=re.I)

        # Check for ingredients that slipped through substitution
        rejection_reasons.extend(_check_unresolved_ingredients(replaced.lower(), original))

        if replaced != original:
            had_substitutions = True
            substitution_log.append(f"{original} -> {replaced}")

        cleaned_ingredients.append(replaced)

    return cleaned_ingredients, substitution_log, rejection_reasons, had_substitutions


# ---------------------------------------------------------------------------
# Nutrition estimation
# ---------------------------------------------------------------------------

def _parse_number(value: Any) -> float | None:
    """Extract the first number from a string or return None."""
    if value is None:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", str(value))
    return float(match.group(1)) if match else None


def _estimate_micronutrients(ingredients_text: str) -> dict[str, float]:
    """Rough micronutrient estimates based on ingredient keywords."""
    text = ingredients_text.lower()
    micros = dict(_MICRO_BASELINES)

    # Fatty fish: rich in omega-3, vitamin D, B12
    if any(fish in text for fish in ["salmon", "sardine", "mackerel", "trout"]):
        micros["omega3_g"] = 1.8
        micros["vitamin_d_mcg"] = 8.0
        micros["vitamin_b12_mcg"] = 3.2

    # Dark leafy greens: iron, calcium, vitamin K, folate
    if any(green in text for green in ["spinach", "kale", "broccoli", "chard"]):
        micros["iron_mg"] += 2.5
        micros["calcium_mg"] += 90
        micros["vitamin_k_mcg"] += 120
        micros["folate_mcg"] += 80

    # Legumes: iron, magnesium, zinc
    if any(legume in text for legume in ["lentil", "chickpea", "bean", "quinoa"]):
        micros["iron_mg"] += 1.5
        micros["magnesium_mg"] += 45
        micros["zinc_mg"] += 1.0

    # Vitamin C-rich produce
    if any(fruit in text for fruit in ["citrus", "lemon", "orange", "bell pepper", "kiwi", "berry"]):
        micros["vitamin_c_mg"] += 35

    # Vitamin E-rich foods
    if any(source in text for source in ["almond", "sunflower", "avocado", "olive oil"]):
        micros["vitamin_e_mg"] += 2.5

    return micros


def build_nutrition_estimate(
    recipe_node: dict[str, Any],
    ingredient_lines: list[str],
) -> dict[str, Any]:
    """Build a nutrition dict from JSON-LD data, falling back to defaults."""
    json_nutrition = recipe_node.get("nutrition") or {}

    calories = _parse_number(json_nutrition.get("calories")) or _DEFAULT_NUTRITION["calories"]
    protein = _parse_number(json_nutrition.get("proteinContent")) or _DEFAULT_NUTRITION["protein"]
    carbs = _parse_number(json_nutrition.get("carbohydrateContent")) or _DEFAULT_NUTRITION["carbs"]
    fat = _parse_number(json_nutrition.get("fatContent")) or _DEFAULT_NUTRITION["fat"]
    fiber = _parse_number(json_nutrition.get("fiberContent")) or _DEFAULT_NUTRITION["fiber"]
    sugar = _parse_number(json_nutrition.get("sugarContent"))
    sodium = _parse_number(json_nutrition.get("sodiumContent"))

    return {
        "calories": round(calories),
        "protein": round(protein, 1),
        "carbs": round(carbs, 1),
        "fat": round(fat, 1),
        "fiber": round(fiber, 1),
        "sugar": round(sugar, 1) if sugar is not None else 6.0,
        "sodium_mg": round(sodium) if sodium is not None else 520,
        "micronutrients": _estimate_micronutrients(" ".join(ingredient_lines)),
    }


# ---------------------------------------------------------------------------
# MES (Metabolic Energy Score) gating
# ---------------------------------------------------------------------------

def _compute_meal_mes(
    nutrition: dict[str, Any],
    budget: dict[str, float] | None = None,
) -> dict[str, float]:
    """Calculate per-meal MES based on protein, fiber, and sugar scores."""
    budget = budget or DEFAULT_MES_BUDGET
    protein_target = max(1.0, budget["protein_target_g"] / MEALS_PER_DAY)
    fiber_target = max(1.0, budget["fiber_floor_g"] / MEALS_PER_DAY)
    sugar_ceiling = max(1.0, budget["sugar_ceiling_g"] / MEALS_PER_DAY)

    protein_g = float(nutrition.get("protein", 0) or 0)
    fiber_g = float(nutrition.get("fiber", 0) or 0)
    sugar_g = float(nutrition.get("sugar", 0) or 0)

    protein_score = min(protein_g / protein_target, 1.0) * 100
    fiber_score = min(fiber_g / fiber_target, 1.0) * 100
    sugar_ratio = sugar_g / sugar_ceiling
    sugar_score = max(0.0, 100.0 - max(0.0, (sugar_ratio - 1.0)) * 200.0)

    total = (
        budget["weight_protein"] * protein_score
        + budget["weight_fiber"] * fiber_score
        + budget["weight_sugar"] * sugar_score
    )
    return {
        "protein_score": round(protein_score, 1),
        "fiber_score": round(fiber_score, 1),
        "sugar_score": round(sugar_score, 1),
        "total_score": round(total, 1),
    }


def passes_import_gate(nutrition: dict[str, Any]) -> tuple[bool, float]:
    """Check if a recipe's nutrition meets the minimum MES threshold."""
    mes = _compute_meal_mes(nutrition)
    total = float(mes["total_score"])
    return total >= MIN_IMPORT_MES, total


# ---------------------------------------------------------------------------
# Role classification
# ---------------------------------------------------------------------------

def _classify_recipe_role(
    title: str,
    meal_type: str,
    nutrition: dict[str, Any],
) -> tuple[str, bool, bool]:
    """Determine (recipe_role, is_component, is_mes_scoreable)."""
    context = classify_meal_context(title, meal_type, nutrition)
    role = _CONTEXT_TO_ROLE.get(context, "full_meal")

    if role not in RECIPE_ROLES:
        role = "full_meal"

    is_component = role in _COMPONENT_ROLES
    is_mes_scoreable = role not in _NON_SCOREABLE_ROLES
    return role, is_component, is_mes_scoreable


# ---------------------------------------------------------------------------
# MES rescue via side pairing
# ---------------------------------------------------------------------------

def _combine_nutrition(base: dict[str, Any], side: dict[str, Any]) -> dict[str, Any]:
    """Merge base meal + side nutrition for composite MES scoring."""
    return {
        key: float(base.get(key, 0) or 0) + float(side.get(key, 0) or 0)
        for key in ("protein", "fiber", "sugar", "carbs", "fat", "calories")
    }


def _attempt_mes_rescue(
    nutrition: dict[str, Any],
    db: Any,
    cuisine: str = "global",
    max_pairings: int = 3,
) -> tuple[bool, float, list[str]]:
    """Try to rescue a failing-MES meal by pairing with the side library.

    Returns (rescued, best_combined_mes, top_pairing_ids).
    """
    from seed_side_library import get_side_library_with_nutrition

    sides = get_side_library_with_nutrition(db)
    if not sides:
        return False, 0.0, []

    scored: list[tuple[float, str]] = []
    for side in sides:
        combined = _combine_nutrition(nutrition, side["nutrition_info"])
        mes = _compute_meal_mes(combined)
        score = float(mes["total_score"])
        # Small tie-breaker: prefer sides matching the recipe's cuisine
        if side.get("cuisine") == cuisine and cuisine != "global":
            score += 1.0
        scored.append((score, side["id"]))

    scored.sort(key=lambda pair: -pair[0])
    best_score = scored[0][0] if scored else 0.0
    rescued = best_score >= MIN_IMPORT_MES
    top_ids = [side_id for _, side_id in scored[:max_pairings]]
    return rescued, round(best_score, 1), top_ids


# ---------------------------------------------------------------------------
# Taxonomy inference (protein, carb, flavor, cuisine, dietary tags)
# ---------------------------------------------------------------------------

def _infer_types_from_ingredients(
    ingredients: list[str],
    keyword_map: dict[str, list[str]],
    valid_options: list[str],
) -> list[str]:
    """Generic type inference: match ingredient text against keyword groups."""
    text = " ".join(ingredients).lower()
    inferred = [
        type_name
        for type_name, keywords in keyword_map.items()
        if any(keyword in text for keyword in keywords)
    ]
    return [t for t in inferred if t in valid_options]


_PROTEIN_KEYWORDS: dict[str, list[str]] = {
    "chicken": ["chicken"],
    "beef": ["beef", "bison"],
    "lamb": ["lamb"],
    "pork": ["pork", "ham", "bacon"],
    "salmon": ["salmon"],
    "shrimp": ["shrimp", "prawn"],
    "other_fish": ["cod", "tuna", "mackerel", "sardine", "trout", "fish"],
    "eggs": ["egg", "eggs"],
    "vegetarian": ["tofu", "lentil", "chickpea", "bean", "tempeh"],
}

_CARB_KEYWORDS: dict[str, list[str]] = {
    "rice": ["rice"],
    "sweet_potato": ["sweet potato"],
    "potato": ["potato"],
    "sourdough_bread": ["sourdough"],
    "oats": ["oat"],
    "quinoa": ["quinoa"],
    "tortillas": ["tortilla", "wrap"],
    "noodles": ["noodle", "spaghetti", "pasta"],
    "plantain": ["plantain"],
}


def _infer_protein_types(ingredients: list[str]) -> list[str]:
    """Identify protein sources from ingredient text."""
    text = " ".join(ingredients).lower()
    inferred = _infer_types_from_ingredients(ingredients, _PROTEIN_KEYWORDS, PROTEIN_OPTIONS)
    # "other_fish" only applies when salmon isn't present
    if "salmon" in text and "other_fish" in inferred:
        inferred.remove("other_fish")
    # Vegetarian is a fallback when no animal protein is found
    if not inferred and any(
        keyword in text for keyword in _PROTEIN_KEYWORDS["vegetarian"]
    ):
        return ["vegetarian"]
    return inferred


def _infer_carb_types(ingredients: list[str]) -> list[str]:
    """Identify carb sources from ingredient text."""
    text = " ".join(ingredients).lower()
    inferred = _infer_types_from_ingredients(ingredients, _CARB_KEYWORDS, CARB_OPTIONS)
    # "potato" should not match when "sweet potato" is the actual ingredient
    if "sweet_potato" in inferred and "potato" in inferred and "sweet potato" in text:
        inferred.remove("potato")
    return inferred


def _infer_flavor_profile(title: str, ingredients: list[str], steps: list[str]) -> list[str]:
    """Detect dominant flavors from title, ingredients, and instructions."""
    text = (title + " " + " ".join(ingredients) + " " + " ".join(steps)).lower()
    flavor_keywords: dict[str, list[str]] = {
        "spicy": ["chili", "jalapeno", "cayenne", "spicy"],
        "sweet": ["sweet", "honey", "maple", "coconut sugar", "date syrup"],
        "umami": ["soy", "mushroom", "umami", "parmesan", "miso"],
        "tangy": ["lemon", "lime", "vinegar", "tangy"],
        "savory": ["garlic", "onion", "herb", "savory"],
    }
    flavors = [
        flavor for flavor, keywords in flavor_keywords.items()
        if any(keyword in text for keyword in keywords)
    ]
    if not flavors:
        flavors = ["savory"]
    return flavors[:MAX_FLAVORS]


def _infer_dietary_tags(ingredients: list[str]) -> list[str]:
    """Infer dietary restriction tags from ingredients."""
    text = " ".join(ingredients).lower()
    tags: list[str] = []
    animal_proteins = ["chicken", "beef", "lamb", "fish", "salmon", "shrimp", "turkey", "egg", "pork"]
    dairy_items = ["milk", "cheese", "yogurt", "cream", "butter"]
    gluten_sources = ["flour", "wheat", "semolina", "barley", "rye"]

    if not any(protein in text for protein in animal_proteins):
        tags.append("vegetarian")
    if not any(dairy in text for dairy in dairy_items):
        tags.append("dairy-free")
    if not any(gluten in text for gluten in gluten_sources):
        tags.append("gluten-free")
    return tags


def _infer_cuisine(url: str, title: str) -> str:
    """Detect cuisine from URL and title keywords."""
    text = f"{url} {title}".lower()
    for cuisine, keywords in _CUISINE_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return cuisine
    return "global"


def _infer_meal_type(recipe_node: dict[str, Any], url: str, title: str = "") -> str:
    """Classify recipe as breakfast/lunch/dinner/snack/dessert."""
    raw_category = recipe_node.get("recipeCategory") or []
    category_text = (
        " ".join(raw_category) if isinstance(raw_category, list)
        else str(raw_category)
    )
    text = f"{category_text} {url} {title}".lower()

    meal_type_keywords: dict[str, list[str]] = {
        "breakfast": ["breakfast", "pancake", "oatmeal", "french toast", "egg", "smoothie", "muffin", "granola"],
        "dessert": ["dessert", "cake", "cookie", "brownie", "ice cream", "pie", "beignet", "scone", "baklava", "pastry", "pastries", "loaf", "fudge", "truffle"],
        "snack": ["appetizer", "side", "dip", "salsa", "snack"],
        "lunch": ["lunch", "salad", "sandwich", "wrap", "bowl"],
    }
    for meal_type, keywords in meal_type_keywords.items():
        if any(keyword in text for keyword in keywords):
            return meal_type
    return "dinner"


def _infer_service_tag(total_minutes: int, title: str, steps: list[str]) -> str:
    """Determine cooking style: quick / sit-down / bulk-cook."""
    text = (title + " " + " ".join(steps)).lower()
    if any(keyword in text for keyword in ["meal prep", "freezer", "batch", "marinade"]):
        return "bulk-cook"
    if total_minutes and total_minutes <= 20:
        return "quick"
    if total_minutes and total_minutes >= 50:
        return "sit-down"
    return "quick"


# ---------------------------------------------------------------------------
# Taxonomy quality enforcement
# ---------------------------------------------------------------------------

def _enforce_taxonomy(
    recipe_payload: dict[str, Any],
    role: str,
    ingredient_lines: list[str],
    title: str,
) -> list[str]:
    """Validate and auto-fill taxonomy fields. Returns warnings."""
    warnings: list[str] = []

    # Only enforce strict taxonomy on scoreable full meals
    if role != "full_meal":
        return warnings

    if not recipe_payload.get("protein_type"):
        inferred = _infer_protein_types(ingredient_lines)
        if inferred:
            recipe_payload["protein_type"] = inferred
            warnings.append(f"protein_type auto-filled: {inferred}")
        else:
            warnings.append(f"WARN: empty protein_type for '{title}'")

    if not recipe_payload.get("carb_type"):
        inferred = _infer_carb_types(ingredient_lines)
        if inferred:
            recipe_payload["carb_type"] = inferred
            warnings.append(f"carb_type auto-filled: {inferred}")
        else:
            warnings.append(f"WARN: empty carb_type for '{title}'")

    if not recipe_payload.get("flavor_profile"):
        warnings.append(f"WARN: empty flavor_profile for '{title}'")

    tags = recipe_payload.get("tags", [])
    meal_time_tags = {"breakfast", "lunch", "dinner", "snack", "dessert"}
    service_tags = {"quick", "sit-down", "bulk-cook", "meal-prep"}
    if not any(tag in meal_time_tags for tag in tags):
        warnings.append(f"WARN: no meal-time tag for '{title}'")
    if not any(tag in service_tags for tag in tags):
        warnings.append(f"WARN: no service tag for '{title}'")

    return warnings


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_iso_duration_minutes(iso_duration: str | None) -> int:
    """Convert ISO 8601 duration (e.g. 'PT1H30M') to total minutes."""
    if not iso_duration:
        return 0
    hours_match = re.search(r"(\d+)H", iso_duration)
    minutes_match = re.search(r"(\d+)M", iso_duration)
    return (int(hours_match.group(1)) if hours_match else 0) * 60 + (
        int(minutes_match.group(1)) if minutes_match else 0
    )


def _parse_yield(value: Any) -> int:
    """Extract servings count from various formats."""
    if isinstance(value, int):
        return max(value, 1)
    match = re.search(r"(\d+)", str(value or ""))
    return int(match.group(1)) if match else 2


def _parse_instructions(value: Any) -> list[str]:
    """Extract instruction steps from string or list format."""
    steps: list[str] = []
    if isinstance(value, str):
        steps = [step.strip() for step in re.split(r"\n+|\.\s+", value) if step.strip()]
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, str) and item.strip():
                steps.append(item.strip())
            elif isinstance(item, dict):
                text = item.get("text") or item.get("name")
                if text and str(text).strip():
                    steps.append(str(text).strip())
    return steps[:MAX_INSTRUCTIONS]


def _guess_ingredient_category(name: str) -> str:
    """Categorize an ingredient for display grouping."""
    lower_name = name.lower()
    category_keywords: dict[str, list[str]] = {
        "protein": ["chicken", "beef", "lamb", "salmon", "shrimp", "fish", "tofu", "egg", "turkey", "tuna", "chickpea", "lentil"],
        "grains": ["rice", "potato", "quinoa", "oats", "pasta", "sourdough", "tortilla", "bread", "noodle", "plantain"],
        "fats": ["oil", "butter", "ghee", "avocado oil", "olive oil"],
        "spices": ["salt", "pepper", "paprika", "cumin", "garlic powder", "cinnamon", "oregano", "thyme", "spice"],
        "dairy": ["milk", "yogurt", "cheese", "cream"],
        "sweetener": ["syrup", "honey", "monk fruit", "stevia", "agave", "date syrup", "sugar"],
    }
    for category, keywords in category_keywords.items():
        if any(keyword in lower_name for keyword in keywords):
            return category
    return "produce"


def _to_ingredient_objects(lines: list[str]) -> list[dict[str, str]]:
    """Convert ingredient lines to structured {name, quantity, unit, category} dicts."""
    result: list[dict[str, str]] = []
    for line in lines:
        clean = _clean_ingredient_text(line)
        match = re.match(r"^([\d\/\.\s]+)\s+([a-zA-Z]+)?\s*(.*)$", clean)
        if match and len(match.group(3)) > 1:
            quantity = (match.group(1) or "").strip()
            unit = (match.group(2) or "").strip()
            name = (match.group(3) or "").strip(", ")
        else:
            quantity = ""
            unit = ""
            name = clean
        result.append({
            "name": name,
            "quantity": quantity,
            "unit": unit,
            "category": _guess_ingredient_category(name),
        })
    return result


def _format_title(original: str) -> str:
    """Clean up recipe title (unescape HTML entities)."""
    return html_mod.unescape(original).strip()


def _format_description(original_desc: str, substitution_count: int) -> str:
    """Build recipe description, noting substitutions if any were made."""
    base = (original_desc or "Flavor-forward meal reworked for clean whole-food cooking.").strip()
    base = re.sub(r"\s+", " ", base)
    if substitution_count > 0:
        return f"{base} Built with smarter whole-food swaps while keeping the original flavor profile."
    return base


def _format_steps(steps: list[str]) -> list[str]:
    """Add step numbers and prep/finish framing."""
    formatted: list[str] = []
    for step_number, step_text in enumerate(steps, start=1):
        text = re.sub(r"\s+", " ", step_text.strip())
        if text and not text.endswith("."):
            text += "."
        if step_number == 1:
            formatted.append(f"Step {step_number}: Prep first — {text}")
        elif step_number == len(steps):
            formatted.append(f"Step {step_number}: Finish and serve — {text}")
        else:
            formatted.append(f"Step {step_number}: {text}")
    return formatted


def _extract_image_url(recipe_node: dict[str, Any]) -> str | None:
    """Pull the best image URL from a JSON-LD recipe node."""
    image = recipe_node.get("image")
    if isinstance(image, list) and image:
        return image[0]
    if isinstance(image, str):
        return image
    return None


# ---------------------------------------------------------------------------
# Pipeline result type
# ---------------------------------------------------------------------------

@dataclass
class RecipeImportResult:
    """Outcome of attempting to import a single recipe URL."""
    url: str
    title: str
    accepted: bool
    substitutions: list[str] = field(default_factory=list)
    reject_reasons: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Crawl + import pipeline
# ---------------------------------------------------------------------------

def crawl_recipe_urls(
    start_url: str,
    allowed_domain: str,
    max_pages: int = 400,
) -> list[str]:
    """BFS-crawl a domain and return URLs that contain recipe data."""
    queue = [start_url]
    seen: set[str] = set()
    recipe_urls: set[str] = set()

    while queue and len(seen) < max_pages:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        try:
            page_html = _fetch_html(url)
        except Exception as exc:
            logger.debug("Failed to fetch %s: %s", url, exc)
            continue

        has_jsonld_recipe = bool(
            _extract_recipe_jsonld(page_html)
            and _extract_recipe_jsonld(page_html).get("recipeIngredient")
        )
        has_html_recipe = (
            "recipe-card-details" in page_html
            and "recipe-ingredient" in page_html
            and "recipe-instruction" in page_html
        )

        if (has_jsonld_recipe or has_html_recipe) and _looks_like_recipe_post(url):
            recipe_urls.add(url)

        for linked_url in _extract_page_links(url, page_html, allowed_domain):
            if linked_url not in seen:
                queue.append(linked_url)

    # If the start URL itself is a recipe, include it
    if not recipe_urls and _looks_like_recipe_post(start_url) and _is_same_domain(start_url, allowed_domain):
        recipe_urls.add(start_url)

    return sorted(recipe_urls)


def _process_single_recipe(
    url: str,
    page_html: str,
    start_url: str,
    db: Any,
) -> tuple[RecipeImportResult, dict[str, Any] | None]:
    """Process one recipe URL. Returns (result, recipe_payload_or_None)."""
    node = _extract_recipe_jsonld(page_html) or _extract_recipe_fallback(page_html)
    if not node:
        return RecipeImportResult(url=url, title=url, accepted=False, reject_reasons=["no recipe data found"]), None

    source_title = html_mod.unescape(str(node.get("name") or "Untitled Recipe")).strip()
    source_desc = html_mod.unescape(str(node.get("description") or "")).strip()
    ingredient_lines = [
        _clean_ingredient_text(raw)
        for raw in (node.get("recipeIngredient") or [])
        if str(raw).strip()
    ]

    if not ingredient_lines:
        return RecipeImportResult(url=url, title=source_title, accepted=False, reject_reasons=["no ingredients found"]), None

    # Apply whole-food ingredient policy
    updated_ingredients, substitutions, reject_reasons, _ = apply_ingredient_policy(ingredient_lines)
    if reject_reasons:
        return RecipeImportResult(
            url=url, title=source_title, accepted=False,
            substitutions=substitutions, reject_reasons=sorted(set(reject_reasons)),
        ), None

    # Parse recipe metadata
    steps = _parse_instructions(node.get("recipeInstructions"))
    if not steps:
        steps = ["Gather ingredients.", "Cook using medium heat until done.", "Serve and enjoy."]

    prep_minutes = _parse_iso_duration_minutes(node.get("prepTime"))
    cook_minutes = _parse_iso_duration_minutes(node.get("cookTime"))
    total_minutes = _parse_iso_duration_minutes(node.get("totalTime")) or (prep_minutes + cook_minutes)
    servings = _parse_yield(node.get("recipeYield"))

    # Build enriched recipe data
    title = _format_title(source_title)
    description = _format_description(source_desc, len(substitutions))
    ingredients_obj = _to_ingredient_objects(updated_ingredients)
    formatted_steps = _format_steps(steps)
    meal_type = _infer_meal_type(node, url, source_title)
    service_tag = _infer_service_tag(total_minutes, source_title, formatted_steps)
    dietary_tags = _infer_dietary_tags(updated_ingredients)
    nutrition = build_nutrition_estimate(node, updated_ingredients)

    # Classify role and MES gating
    role, is_component, is_mes_scoreable = _classify_recipe_role(title, meal_type, nutrition)
    default_pairing_ids: list[str] = []
    mes_score = 0.0

    if is_mes_scoreable and role == "full_meal":
        passes_gate, mes_score = passes_import_gate(nutrition)
        if not passes_gate:
            cuisine_hint = _infer_cuisine(url, source_title)
            rescued, rescue_score, pairing_ids = _attempt_mes_rescue(
                nutrition, db, cuisine=cuisine_hint,
            )
            if rescued:
                default_pairing_ids = pairing_ids
                mes_score = rescue_score
            else:
                return RecipeImportResult(
                    url=url, title=source_title, accepted=False,
                    substitutions=substitutions,
                    reject_reasons=[f"MES gate failed: {mes_score} < {MIN_IMPORT_MES} (rescue best: {rescue_score})"],
                ), None
    elif is_mes_scoreable:
        _, mes_score = passes_import_gate(nutrition)

    # Build final payload
    benefits = compute_health_benefits(ingredients_obj)
    protein_type = _infer_protein_types(updated_ingredients)
    carb_type = _infer_carb_types(updated_ingredients)
    flavor_profile = _infer_flavor_profile(title, updated_ingredients, formatted_steps)
    cuisine = _infer_cuisine(url, source_title)
    source_slug = urlparse(start_url).netloc.replace("www.", "").replace(".", "_")

    difficulty = "easy" if total_minutes <= 30 else ("medium" if total_minutes <= 60 else "hard")

    recipe_payload: dict[str, Any] = {
        "title": title,
        "description": description,
        "ingredients": ingredients_obj,
        "steps": formatted_steps,
        "prep_time_min": prep_minutes,
        "cook_time_min": cook_minutes,
        "total_time_min": total_minutes,
        "servings": servings,
        "nutrition_info": nutrition,
        "difficulty": difficulty,
        "tags": [meal_type, service_tag, f"{source_slug}_import", "whole-food"],
        "flavor_profile": flavor_profile,
        "dietary_tags": dietary_tags,
        "cuisine": cuisine,
        "health_benefits": benefits,
        "protein_type": protein_type,
        "carb_type": carb_type,
        "is_ai_generated": False,
        "image_url": _extract_image_url(node),
        "recipe_role": role,
        "is_component": is_component,
        "is_mes_scoreable": is_mes_scoreable,
        "default_pairing_ids": default_pairing_ids,
        "needs_default_pairing": node.get("needs_default_pairing"),
    }

    # Taxonomy quality enforcement
    taxonomy_warnings = _enforce_taxonomy(recipe_payload, role, updated_ingredients, title)
    for warning in taxonomy_warnings:
        logger.info("[taxonomy] %s", warning)

    return RecipeImportResult(
        url=url, title=source_title, accepted=True, substitutions=substitutions,
    ), recipe_payload


def import_recipes(
    start_url: str,
    allowed_domain: str,
    limit: int = 25,
    max_pages: int = 400,
) -> tuple[list[RecipeImportResult], int, int]:
    """Run the full import pipeline: crawl, extract, filter, and persist.

    Returns (results, inserted_count, updated_count).
    """
    init_db()
    db = SessionLocal()
    try:
        results: list[RecipeImportResult] = []
        inserted = 0
        updated = 0

        urls = crawl_recipe_urls(start_url, allowed_domain, max_pages)
        logger.info("Found %d candidate recipe URLs", len(urls))

        for url in urls:
            if inserted >= limit:
                break

            try:
                page_html = _fetch_html(url)
                result, recipe_payload = _process_single_recipe(url, page_html, start_url, db)
                results.append(result)

                if recipe_payload is None:
                    continue

                # Upsert into database
                existing = db.query(Recipe).filter(Recipe.title == recipe_payload["title"]).first()
                if existing:
                    for key, value in recipe_payload.items():
                        setattr(existing, key, value)
                    updated += 1
                else:
                    db.add(Recipe(id=str(uuid.uuid4()), **recipe_payload))
                    inserted += 1

            except Exception as exc:
                logger.exception("Failed to process %s", url)
                results.append(RecipeImportResult(
                    url=url, title=url, accepted=False,
                    reject_reasons=[f"exception: {exc}"],
                ))

        db.commit()
        return results, inserted, updated
    finally:
        db.close()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import whole-food compliant recipes from an external website.",
    )
    parser.add_argument("--start-url", required=True, help="Site URL to start crawl from")
    parser.add_argument("--domain", default=None, help="Allowed domain (default: derived from start-url)")
    parser.add_argument("--limit", type=int, default=25, help="Max accepted recipes to insert")
    parser.add_argument("--max-pages", type=int, default=400, help="Max pages to crawl")
    parser.add_argument("--report", type=str, default="wholefood_site_import_report.json", help="Report JSON path")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parsed_url = urlparse(args.start_url)
    allowed_domain = args.domain or parsed_url.netloc.replace("www.", "")

    results, inserted, updated = import_recipes(
        start_url=args.start_url,
        allowed_domain=allowed_domain,
        limit=args.limit,
        max_pages=args.max_pages,
    )

    accepted = [r for r in results if r.accepted]
    rejected = [r for r in results if not r.accepted]

    report = {
        "start_url": args.start_url,
        "allowed_domain": allowed_domain,
        "attempted": len(results),
        "accepted": len(accepted),
        "inserted": inserted,
        "updated": updated,
        "rejected": len(rejected),
        "accepted_items": [
            {"title": r.title, "url": r.url, "substitutions": r.substitutions}
            for r in accepted
        ],
        "rejected_items": [
            {"title": r.title, "url": r.url, "reasons": r.reject_reasons, "substitutions": r.substitutions}
            for r in rejected
        ],
    }

    with open(args.report, "w", encoding="utf-8") as report_file:
        json.dump(report, report_file, indent=2)

    print(json.dumps({
        "inserted": inserted,
        "updated": updated,
        "accepted": len(accepted),
        "rejected": len(rejected),
        "report": args.report,
    }, indent=2))


if __name__ == "__main__":
    main()
