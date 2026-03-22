"""Ensemble reasoning: Claude analyzes Gemini's food identification for hidden
ingredients and nutrition cross-checking.  Text-only (no image), runs in
parallel with USDA lookups after Gemini returns."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# ---------------------------------------------------------------------------
# Prompt — one call handles both hidden ingredients AND nutrition validation
# ---------------------------------------------------------------------------

ENSEMBLE_REASONING_PROMPT = """You are a culinary nutrition expert. A vision model has identified
food components from a meal photo. Your job is to REASON about what the vision
model cannot see and cross-check its work.

Return strict JSON only with this exact shape:
{
  "hidden_ingredients": [
    {
      "name": "ingredient name",
      "reason": "short reason why it is likely present",
      "confidence": 0.7
    }
  ],
  "nutrition_adjustments": [
    {
      "component": "name of component to adjust",
      "field": "calories|protein|carbs|fat|fiber|sugar_g",
      "direction": "increase|decrease",
      "factor": 1.2,
      "reason": "short reason for adjustment"
    }
  ],
  "portion_assessment": "under|accurate|over",
  "portion_reason": "short explanation of portion assessment"
}

HIDDEN INGREDIENTS — focus on:
- Cooking oils/fats (especially seed oils at restaurants)
- Added sugars in sauces, dressings, or marinades
- Butter or cream commonly added at restaurants
- Thickeners, MSG, or flavor enhancers typical of the cuisine
- Bread crumbs or flour in coatings
- Do NOT repeat ingredients already visible

NUTRITION ADJUSTMENTS — focus on:
- Preparation method impact (frying adds significant oil calories)
- Restaurant portions typically 20-40% larger than home portions
- Sauces and dressings that add hidden calories/sugar
- Only suggest adjustments you are confident about (factor 1.0-2.0 range)
- An empty list is fine if the vision model's estimates seem reasonable

PORTION ASSESSMENT:
- "under" if the vision model likely underestimated portion size
- "over" if the vision model likely overestimated
- "accurate" if it seems about right

Guidelines:
- Be precise and conservative — only flag things you're confident about
- 2-6 hidden ingredients max
- 0-3 nutrition adjustments max
- Consider cuisine type, preparation method, and source (home vs restaurant)
"""


async def run_ensemble_reasoning(
    components: list[dict[str, Any]],
    meal_label: str,
    preparation_style: str,
    source_context: str,
    portion_size: str,
) -> dict[str, Any] | None:
    """
    Single Claude call that handles hidden ingredient inference AND nutrition
    cross-checking. Text-only (no image) — uses Gemini's output as input.

    Returns dict with hidden_ingredients, nutrition_adjustments, and
    portion_assessment, or None on failure.
    """
    api_key = settings.anthropic_api_key
    if not api_key or api_key.startswith("your-"):
        return None

    visible = [
        f"- {c.get('name', '?')} (role: {c.get('role', '?')}, portion_factor: {c.get('portion_factor', 1.0)})"
        for c in components
    ]
    component_text = "\n".join(visible) if visible else "- unknown"

    user_message = (
        f"Meal: {meal_label}\n"
        f"Portion size: {portion_size}\n"
        f"Preparation style: {preparation_style}\n"
        f"Source: {source_context}\n\n"
        f"Identified components:\n{component_text}\n\n"
        f"Analyze this meal for hidden ingredients and nutrition accuracy."
    )

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "temperature": 0.2,
        "messages": [
            {"role": "user", "content": ENSEMBLE_REASONING_PROMPT + "\n\n" + user_message}
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        # Extract text from Claude response
        content_blocks = data.get("content") or []
        text = ""
        for block in content_blocks:
            if block.get("type") == "text":
                text = block.get("text", "")
                break

        if not text:
            return None

        # Parse JSON — handle markdown fences
        cleaned = text.strip()
        if cleaned.startswith("```"):
            import re
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        parsed = json.loads(cleaned)

        # Validate structure
        result: dict[str, Any] = {
            "hidden_ingredients": [],
            "nutrition_adjustments": [],
            "portion_assessment": "accurate",
            "portion_reason": "",
        }

        for item in (parsed.get("hidden_ingredients") or []):
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            result["hidden_ingredients"].append({
                "name": name,
                "reason": str(item.get("reason", "")).strip(),
                "confidence": round(
                    min(max(float(item.get("confidence", 0.5) or 0.5), 0.0), 1.0), 2
                ),
            })

        for adj in (parsed.get("nutrition_adjustments") or []):
            component = str(adj.get("component", "")).strip()
            field = str(adj.get("field", "")).strip()
            if not component or field not in {"calories", "protein", "carbs", "fat", "fiber", "sugar_g"}:
                continue
            factor = float(adj.get("factor", 1.0) or 1.0)
            # Clamp factor to reasonable range
            factor = min(max(factor, 0.5), 2.0)
            result["nutrition_adjustments"].append({
                "component": component,
                "field": field,
                "direction": str(adj.get("direction", "increase")).strip(),
                "factor": round(factor, 2),
                "reason": str(adj.get("reason", "")).strip(),
            })

        result["portion_assessment"] = str(
            parsed.get("portion_assessment", "accurate")
        ).strip().lower()
        if result["portion_assessment"] not in {"under", "accurate", "over"}:
            result["portion_assessment"] = "accurate"
        result["portion_reason"] = str(parsed.get("portion_reason", "")).strip()

        return result

    except Exception:
        logger.warning("Ensemble reasoning (Claude) failed", exc_info=True)
        return None
