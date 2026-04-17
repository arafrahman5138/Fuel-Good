"""R2 regression guard — chat recipe-requiring intents always produce a card.

The Month-1 target-user assessment caught the chat returning prose-only about
50% of the time for recipe requests. The README positions Healthify as
"transform a craving into a whole-food recipe" — that's the product's chat
moat vs. ChatGPT. If half the responses aren't cards, the moat doesn't hold.

The fix (R2) introduced `ensure_recipe_card`: after the first LLM call, if the
payload's `recipe` is None AND the intent was a recipe-producing one, do ONE
retry with a JSON-only prompt. This test suite locks that behavior in.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.healthify import (
    RECIPE_REQUIRING_INTENTS,
    ensure_recipe_card,
    parse_healthify_response,
)


# ── Helpers ──────────────────────────────────────────────────────────────

def _prose_only_payload(message: str = "Here's a nice salmon dinner idea.") -> dict:
    """Shape returned by parse_healthify_response when the LLM emitted prose."""
    return {
        "message": message,
        "recipe": None,
        "swaps": None,
        "nutrition": None,
        "mes_score": None,
    }


def _valid_recipe_json() -> str:
    """JSON the retry might produce."""
    return """
    {
      "message": "A quick sheet-pan salmon with bok choy.",
      "recipe": {
        "title": "Sheet-Pan Salmon with Ginger Bok Choy",
        "description": "30 minutes, one pan, whole-food.",
        "ingredients": [
          {"name": "wild salmon fillet", "quantity": "6", "unit": "oz"},
          {"name": "baby bok choy", "quantity": "4", "unit": "heads"},
          {"name": "jasmine rice", "quantity": "1", "unit": "cup"},
          {"name": "ginger", "quantity": "1", "unit": "tbsp"},
          {"name": "soy sauce", "quantity": "2", "unit": "tbsp"}
        ],
        "steps": [
          "Preheat oven to 400F.",
          "Toss bok choy with ginger and soy.",
          "Roast salmon and bok choy 15 min."
        ],
        "prep_time_min": 10,
        "cook_time_min": 15,
        "servings": 2
      },
      "swaps": null,
      "nutrition": null
    }
    """


# ── Tests ────────────────────────────────────────────────────────────────


class TestEnsureRecipeCardNoOp:
    """When the payload already has a recipe, we never retry."""

    def test_no_retry_when_recipe_present(self):
        payload = {
            "message": "ok",
            "recipe": {"title": "Salmon Bowl", "ingredients": [], "steps": []},
            "swaps": None,
            "nutrition": None,
        }
        result = asyncio.run(ensure_recipe_card("fridge_to_meal", "anything", payload, ""))
        assert result is payload, "must not retry when recipe already present"

    def test_no_retry_for_non_recipe_intent(self):
        """Score explainer, general question, empty input — these should
        never trigger a recipe-card retry even when recipe is None."""
        for intent in ["score_explainer", "general_nutrition_question", "empty_input",
                        "post_scan_guidance", "photo_analysis"]:
            payload = _prose_only_payload()
            result = asyncio.run(ensure_recipe_card(intent, "hi", payload, ""))
            assert result is payload, f"intent {intent!r} must not retry"


class TestEnsureRecipeCardRetryPath:
    """When prose-only AND intent is recipe-producing, we retry — and if the
    retry produces a valid card, return it."""

    def _run(self, intent: str, retry_output: str):
        payload = _prose_only_payload(
            "A long thoughtful paragraph about what you could cook with salmon."
        )
        fake_llm = MagicMock()
        fake_llm.ainvoke = AsyncMock(return_value=MagicMock(content=retry_output))
        with patch("app.agents.healthify.get_llm", return_value=fake_llm):
            return asyncio.run(ensure_recipe_card(intent, "salmon + bok choy", payload, ""))

    def test_retry_upgrades_prose_to_card_for_fridge_intent(self):
        result = self._run("fridge_to_meal", _valid_recipe_json())
        assert result["recipe"] is not None, result
        assert result["recipe"]["title"] == "Sheet-Pan Salmon with Ginger Bok Choy"
        assert len(result["recipe"]["ingredients"]) >= 3
        assert len(result["recipe"]["steps"]) >= 3

    def test_retry_upgrades_prose_to_card_for_healthify_intent(self):
        result = self._run("healthify_unhealthy_meal", _valid_recipe_json())
        assert result["recipe"] is not None
        assert result["recipe"]["title"]

    def test_retry_upgrades_prose_to_card_for_lookup_intent(self):
        result = self._run("lookup_existing_meal", _valid_recipe_json())
        assert result["recipe"] is not None

    def test_retry_upgrades_prose_to_card_for_modify_intent(self):
        result = self._run("modify_prior_recipe", _valid_recipe_json())
        assert result["recipe"] is not None


class TestEnsureRecipeCardRetryFailurePath:
    """When the retry also fails to produce valid JSON, we return the ORIGINAL
    payload unchanged. The user never sees a worse response than they would
    have without the retry."""

    def test_retry_returning_garbage_preserves_original(self):
        original_message = "Informative prose about salmon."
        payload = _prose_only_payload(original_message)
        fake_llm = MagicMock()
        fake_llm.ainvoke = AsyncMock(return_value=MagicMock(
            content="Not JSON at all, just more prose."
        ))
        with patch("app.agents.healthify.get_llm", return_value=fake_llm):
            result = asyncio.run(ensure_recipe_card("fridge_to_meal", "x", payload, ""))
        assert result["recipe"] is None
        assert result["message"] == original_message

    def test_retry_llm_exception_preserves_original(self):
        original_message = "Thoughtful paragraph."
        payload = _prose_only_payload(original_message)
        fake_llm = MagicMock()
        fake_llm.ainvoke = AsyncMock(side_effect=RuntimeError("provider down"))
        with patch("app.agents.healthify.get_llm", return_value=fake_llm):
            result = asyncio.run(ensure_recipe_card("fridge_to_meal", "x", payload, ""))
        assert result["message"] == original_message
        assert result["recipe"] is None

    def test_get_llm_failure_preserves_original(self):
        payload = _prose_only_payload("Prose only.")
        with patch("app.agents.healthify.get_llm", side_effect=RuntimeError("no provider")):
            result = asyncio.run(ensure_recipe_card("fridge_to_meal", "x", payload, ""))
        assert result is payload


class TestRetryPreservesMetadata:
    """The retry must not clobber metadata fields from the original payload."""

    def test_preserves_matched_recipe_id(self):
        original = {
            "message": "Prose...",
            "recipe": None,
            "swaps": None,
            "nutrition": None,
            "matched_recipe_id": "recipe-42",
            "retrieval_confidence": 0.74,
            "prompt_version": "v7",
            "response_mode": "generated",
        }
        fake_llm = MagicMock()
        fake_llm.ainvoke = AsyncMock(return_value=MagicMock(content=_valid_recipe_json()))
        with patch("app.agents.healthify.get_llm", return_value=fake_llm):
            result = asyncio.run(ensure_recipe_card("fridge_to_meal", "x", original, ""))
        assert result["recipe"] is not None
        assert result["matched_recipe_id"] == "recipe-42"
        assert result["retrieval_confidence"] == 0.74
        assert result["prompt_version"] == "v7"

    def test_preserves_longer_original_message_when_retry_message_is_terse(self):
        long_prose = (
            "Here's a really helpful thoughtful paragraph that explains the "
            "whole cooking approach, why these ingredients work together, "
            "and some optional variations. " * 3
        )
        original = _prose_only_payload(long_prose)
        # Retry JSON has a terse 1-liner message.
        fake_llm = MagicMock()
        fake_llm.ainvoke = AsyncMock(return_value=MagicMock(content=_valid_recipe_json()))
        with patch("app.agents.healthify.get_llm", return_value=fake_llm):
            result = asyncio.run(ensure_recipe_card("fridge_to_meal", "x", original, ""))
        # Retry produced a card (win), but we keep the longer useful prose.
        assert result["recipe"] is not None
        assert len(result["message"]) >= len(long_prose) * 0.9


class TestIntentSetDocumented:
    """Guard that RECIPE_REQUIRING_INTENTS stays in sync with what the
    handler actually treats as recipe-producing. If someone adds a new
    intent to the handler, they need to consider whether it should
    trigger R2's retry."""

    def test_known_recipe_intents_registered(self):
        expected = {
            "fridge_to_meal",
            "healthify_unhealthy_meal",
            "lookup_existing_meal",
            "modify_prior_recipe",
        }
        assert RECIPE_REQUIRING_INTENTS == expected


class TestParseHealthifyResponseContract:
    """The parser's output shape is the contract the UI renders. Keep it
    stable — any regression here breaks the card-render pipeline."""

    def test_valid_json_produces_populated_recipe(self):
        result = parse_healthify_response(_valid_recipe_json())
        assert result["recipe"] is not None
        assert result["recipe"]["title"]
        assert len(result["recipe"]["ingredients"]) >= 3
        assert len(result["recipe"]["steps"]) >= 3

    def test_prose_input_produces_none_recipe(self):
        result = parse_healthify_response(
            "Here's a great dinner idea: salmon with rice. Enjoy!"
        )
        assert result["recipe"] is None
        assert "salmon" in result["message"].lower()

    def test_malformed_json_with_missing_fields_produces_none_recipe(self):
        bad = '{"message": "hi", "recipe": {"title": "Salmon"}}'  # no ingredients/steps
        result = parse_healthify_response(bad)
        # Schema validator drops a recipe without ingredients+steps.
        assert result["recipe"] is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
