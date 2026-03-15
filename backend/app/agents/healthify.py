from __future__ import annotations

import json
import re
from copy import deepcopy
from typing import Any, AsyncIterator, List

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
from datetime import date


PROMPT_VERSION = "healthify_v2_rag"
RETRIEVAL_THRESHOLD = 0.72
LEXICAL_RETRIEVAL_THRESHOLD = 0.74


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


GENERATE_PROMPT = """You are Fuel Good Healthify AI.

Return strict JSON with keys: message, recipe, swaps, nutrition.

Behavior:
- If the user wants a meal made healthier, preserve the spirit of the dish while replacing ultra-processed ingredients with whole-food alternatives.
- If the user names a dish or cuisine with no extra context, treat that as a request for a complete healthified recipe.
- Use realistic ingredients and plausible quantities.
- Keep recipe steps actionable and concise.
- Keep nutrition estimates plausible and internally consistent.
- Do not copy retrieved recipes verbatim if told they are only context.
- If you include swaps, every swap must include `original`, `replacement`, and `reason`.
- Do not return partial swap entries or empty replacement fields.
- For food and recipe requests, `recipe` must not be null and must include non-empty `ingredients` and `steps`.

Recipe schema:
- recipe.title: string
- recipe.description: string
- recipe.ingredients: list of {name, quantity, unit}
- recipe.steps: list of strings
- recipe.prep_time_min: integer
- recipe.cook_time_min: integer
- recipe.servings: integer

Nutrition schema:
- nutrition.original_estimate: {calories, protein, carbs, fat, fiber}
- nutrition.healthified_estimate: {calories, protein, carbs, fat, fiber}
"""

GENERAL_PROMPT = """You are Fuel Good Healthify AI.
Return strict JSON with keys: message, recipe, swaps, nutrition.
For general questions, provide a helpful answer in message and set recipe, swaps, and nutrition to null.
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


def _build_user_context(db: Session, user_id: str | None) -> str:
    """Build a natural-language context block from the user's metabolic profile and daily state."""
    if not user_id:
        return ""
    try:
        profile = db.query(MetabolicProfile).filter(
            MetabolicProfile.user_id == user_id
        ).first()
        if not profile or not profile.weight_lb:
            return ""

        budget = load_budget_for_user(db, user_id)
        totals = aggregate_daily_totals(db, user_id, date.today())
        rem = remaining_budget(totals, budget)

        lines = ["User context (tailor the recipe to these constraints):"]

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
        totals = aggregate_daily_totals(db, user_id, date.today())
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


def _classify_intent(user_input: str) -> str:
    text = (user_input or "").lower()
    if any(token in text for token in ["what is", "how many", "is this healthy", "why is", "should i", "can i"]):
        return "general_nutrition_question"
    if any(token in text for token in ["protein", "fiber", "calories", "macros"]) and "?" in text:
        return "general_nutrition_question"
    if (
        any(token in text for token in ["change the", "modify", "swap", "instead of", "make it with", "without"])
        or re.search(r"\b(change|replace)\b.+\b(to|with)\b", text)
    ):
        return "modify_prior_recipe"
    if any(token in text for token in ["healthy version", "healthify", "clean up", "whole-food", "make this healthier"]):
        return "healthify_unhealthy_meal"
    words = re.findall(r"[a-zA-Z][a-zA-Z'-]*", text)
    if 1 <= len(words) <= 6:
        return "healthify_unhealthy_meal"
    return "lookup_existing_meal"


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


def _extract_payload(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
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
        except Exception:
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
    except ValidationError:
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
        repair_prompt = """Your previous response did not include a valid recipe object.
Return strict JSON only with keys: message, recipe, swaps, nutrition.
Requirements:
- recipe must be non-null
- recipe.ingredients must contain at least 5 items
- recipe.steps must contain at least 3 concise steps
- keep the dish faithful to the user's request
"""
        repair_messages = [SystemMessage(content=f"{GENERATE_PROMPT}\n\n{repair_prompt}")]
        if user_context:
            repair_messages = [SystemMessage(content=f"{GENERATE_PROMPT}\n\n{user_context}\n\n{repair_prompt}")]
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
        repaired_payload = parse_healthify_response(repair_response.content)
        if _nutrition_is_plausible(repaired_payload.get("nutrition")):
            payload["nutrition"] = repaired_payload.get("nutrition") or payload.get("nutrition")
        if repaired_payload.get("recipe"):
            payload["recipe"] = repaired_payload.get("recipe")
            payload["message"] = repaired_payload.get("message") or payload.get("message")
            payload["swaps"] = repaired_payload.get("swaps") or payload.get("swaps")

    payload["response_mode"] = "generated"
    payload["matched_recipe_id"] = retrieved_context[0]["id"] if retrieved_context else None
    payload["retrieval_confidence"] = None
    payload["prompt_version"] = PROMPT_VERSION
    return payload


async def _answer_general_question(
    user_input: str, history: List[dict], user_context: str = ""
) -> dict[str, Any]:
    llm = get_llm("chat")
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


async def healthify_agent(
    db: Session,
    user_input: str,
    history: List[dict],
    stream: bool = False,
    user_id: str | None = None,
) -> dict[str, Any] | AsyncIterator[str]:
    user_context = _build_user_context(db, user_id)

    intent = _classify_intent(user_input)
    if intent == "general_nutrition_question":
        if stream:
            async def _general_stream():
                payload = await _answer_general_question(user_input, history, user_context)
                yield json.dumps(payload)
            return _general_stream()
        return await _answer_general_question(user_input, history, user_context)

    if intent == "modify_prior_recipe":
        modified_payload = await _modify_prior_recipe(user_input, history, user_context)
        if modified_payload:
            nutrition = modified_payload.get("nutrition")
            mes = _compute_recipe_mes(db, user_id, nutrition)
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
    if top and (top_score >= RETRIEVAL_THRESHOLD or top_lexical >= LEXICAL_RETRIEVAL_THRESHOLD):
        recipe = top["recipe"]
        payload = _retrieved_response(recipe, top_score, user_context)
        payload["retrieval_debug"] = retrieval.get("timings_ms")
        # Compute MES for retrieved recipe
        nutrition = payload.get("nutrition")
        mes = _compute_recipe_mes(db, user_id, nutrition)
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
            context_block = "Closest existing recipe context:\n" + json.dumps(retrieved_context, indent=2)
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
    # Compute MES for generated recipe
    nutrition = payload.get("nutrition")
    mes = _compute_recipe_mes(db, user_id, nutrition)
    if mes:
        payload["mes_score"] = mes
    return payload
