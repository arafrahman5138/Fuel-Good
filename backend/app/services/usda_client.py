"""USDA FoodData Central API client with in-memory TTL cache."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_USDA_CACHE: dict[str, tuple[float, dict[str, float] | None]] = {}
CACHE_TTL_SECONDS = 86_400  # 24 hours

# ---------------------------------------------------------------------------
# USDA nutrient IDs
# ---------------------------------------------------------------------------

_NUTRIENT_MAP: dict[int, str] = {
    1008: "calories",
    1003: "protein",
    1005: "carbs",
    1004: "fat",
    1079: "fiber",
    2000: "sugar_g",
}

# ---------------------------------------------------------------------------
# Preparation-style adjustments applied on top of USDA base values
# ---------------------------------------------------------------------------

PREPARATION_ADJUSTMENTS: dict[str, dict[str, float]] = {
    "fried": {"calories": 1.35, "fat": 1.80},
    "deep fried": {"calories": 1.45, "fat": 2.0},
    "grilled": {"fat": 0.85},
    "baked": {},
    "steamed": {"fat": 0.90},
    "boiled": {},
    "raw": {},
    "fresh": {},
    "mixed": {},
    "unknown": {},
}

_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

# Preferred data types (lab-verified whole-food data, not branded)
_PREFERRED_DATA_TYPES = ["Survey (FNDDS)", "SR Legacy"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_query(name: str) -> str:
    """Lowercase, strip qualifiers, collapse whitespace."""
    value = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    # Strip common qualifiers that confuse USDA search
    for word in ("grilled", "fried", "baked", "steamed", "boiled", "raw", "fresh",
                 "sauteed", "roasted", "smoked", "dried", "canned", "frozen",
                 "sliced", "diced", "chopped", "shredded", "whole", "cooked"):
        value = value.replace(word, "")
    return re.sub(r"\s+", " ", value).strip()


def _parse_nutrients(food: dict[str, Any]) -> dict[str, float]:
    """Extract our 6 macro fields from a USDA food item."""
    result: dict[str, float] = {
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "fat": 0.0,
        "fiber": 0.0,
        "sugar_g": 0.0,
    }
    for nutrient in food.get("foodNutrients") or []:
        nid = nutrient.get("nutrientId") or nutrient.get("nutrientNumber")
        # nutrientId is int in some responses, nutrientNumber is str in others
        try:
            nid = int(nid)
        except (TypeError, ValueError):
            continue
        key = _NUTRIENT_MAP.get(nid)
        if key:
            result[key] = round(float(nutrient.get("value", 0) or 0), 1)
    return result


def _description_matches(description: str, query: str) -> bool:
    """Check if a USDA food description is a reasonable match for our query."""
    desc_lower = description.lower()
    query_words = query.split()
    if not query_words:
        return False
    # At least half the query words must appear in the description
    matches = sum(1 for w in query_words if w in desc_lower)
    return matches >= max(1, len(query_words) // 2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def search_usda_food(food_name: str) -> dict[str, float] | None:
    """
    Search USDA FoodData Central for a food item.

    Returns {calories, protein, carbs, fat, fiber, sugar_g} per 100g,
    or None if not found / API unavailable.
    """
    api_key = settings.usda_api_key
    if not api_key:
        return None

    query = _normalize_query(food_name)
    if not query or len(query) < 2:
        return None

    # Check cache
    cached = _USDA_CACHE.get(query)
    if cached:
        ts, result = cached
        if time.time() - ts < CACHE_TTL_SECONDS:
            return result

    try:
        params: dict[str, Any] = {
            "api_key": api_key,
            "query": query,
            "dataType": _PREFERRED_DATA_TYPES,
            "pageSize": 5,
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        foods = data.get("foods") or []
        if not foods:
            _USDA_CACHE[query] = (time.time(), None)
            return None

        # Pick the best match: prefer items whose description contains our query words
        best: dict[str, Any] | None = None
        for food in foods:
            desc = food.get("description", "")
            if _description_matches(desc, query):
                best = food
                break

        if best is None:
            # Fall back to first result
            best = foods[0]

        result = _parse_nutrients(best)

        # Sanity check: reject obviously empty results
        if result["calories"] < 1.0 and result["protein"] < 0.1:
            _USDA_CACHE[query] = (time.time(), None)
            return None

        _USDA_CACHE[query] = (time.time(), result)
        return result

    except Exception:
        logger.warning("USDA lookup failed for %r", food_name, exc_info=True)
        _USDA_CACHE[query] = (time.time(), None)
        return None


async def lookup_usda_nutrition(
    component_name: str,
    preparation_style: str = "unknown",
) -> dict[str, float] | None:
    """
    High-level lookup: searches USDA, then applies preparation-style adjustments.

    Returns adjusted {calories, protein, carbs, fat, fiber, sugar_g} or None.
    """
    base = await search_usda_food(component_name)
    if base is None:
        return None

    # Apply preparation adjustments
    style = (preparation_style or "unknown").lower()
    adjustments = PREPARATION_ADJUSTMENTS.get(style, {})
    if not adjustments:
        return base

    adjusted = dict(base)
    for key, multiplier in adjustments.items():
        if key in adjusted:
            adjusted[key] = round(adjusted[key] * multiplier, 1)
    return adjusted
