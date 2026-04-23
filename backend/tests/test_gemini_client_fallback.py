"""Unit tests for the Gemini retry + fallback client.

Covers the behaviours introduced in Phase 2 of the scan pipeline rebuild:
  * Primary 5xx → retry → still 5xx → fallback wins.
  * Primary + fallback both fail → GeminiCallFailed.
  * Non-retryable 4xx → no retry, straight to fallback.

Uses ``unittest`` + ``asyncio.run`` to match the project's existing sync
test style (no pytest-asyncio dependency).
"""
from __future__ import annotations

import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("GOOGLE_API_KEY", "test-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.config import get_settings
from app.services import gemini_client


def _fake_payload() -> dict:
    return {
        "contents": [{"role": "user", "parts": [{"text": "hi"}]}],
        "generationConfig": {"temperature": 0.1},
    }


def _ok_response(model: str) -> dict:
    return {
        "candidates": [
            {"content": {"parts": [{"text": f'{{"served_by":"{model}"}}'}]}},
        ],
    }


class _RoutingTransport(httpx.AsyncBaseTransport):
    def __init__(self, handler):
        self._handler = handler

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        return await self._handler(request)


def _with_mock_httpx(handler):
    original = httpx.AsyncClient

    class _PatchedClient(original):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = _RoutingTransport(handler)
            super().__init__(*args, **kwargs)

    return patch.object(httpx, "AsyncClient", _PatchedClient)


def _model_from_url(request: httpx.Request) -> str:
    path = request.url.path
    return path.split("/models/")[-1].split(":")[0]


class GeminiClientFallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        get_settings.cache_clear()

    def test_primary_success_skips_fallback(self) -> None:
        calls: list[str] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            model = _model_from_url(request)
            calls.append(model)
            return httpx.Response(200, json=_ok_response(model))

        async def run() -> gemini_client.GeminiCallResult:
            with _with_mock_httpx(handler):
                return await gemini_client.call_gemini_with_fallback(
                    payload=_fake_payload(),
                    primary_model="primary",
                    fallback_model="fallback",
                    race=False,
                )

        result = asyncio.run(run())
        self.assertEqual(result.model, "primary")
        self.assertEqual(calls, ["primary"])

    def test_fallback_used_when_primary_returns_503_twice(self) -> None:
        calls: list[str] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            model = _model_from_url(request)
            calls.append(model)
            if model == "primary":
                return httpx.Response(503, json={"error": "overloaded"})
            return httpx.Response(200, json=_ok_response(model))

        async def run() -> gemini_client.GeminiCallResult:
            with _with_mock_httpx(handler):
                return await gemini_client.call_gemini_with_fallback(
                    payload=_fake_payload(),
                    primary_model="primary",
                    fallback_model="fallback",
                    race=False,
                )

        result = asyncio.run(run())
        self.assertEqual(result.model, "fallback")
        # Primary hit twice (initial + retry), fallback once
        self.assertEqual(calls.count("primary"), 2)
        self.assertEqual(calls.count("fallback"), 1)

    def test_both_models_failing_raises(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, json={"error": "overloaded"})

        async def run() -> None:
            with _with_mock_httpx(handler):
                await gemini_client.call_gemini_with_fallback(
                    payload=_fake_payload(),
                    primary_model="primary",
                    fallback_model="fallback",
                    race=False,
                )

        with self.assertRaises(gemini_client.GeminiCallFailed):
            asyncio.run(run())

    def test_race_mode_falls_back_when_primary_fails_fast(self) -> None:
        """Regression: when primary 503s within the race threshold and the
        fallback is racing in parallel, cancelling the fallback too eagerly
        caused the handler to raise GeminiCallFailed without ever consulting
        the fallback. Fix: keep the pending task alive until we have a winner.
        """
        calls: list[tuple[str, float]] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            model = _model_from_url(request)
            # Primary fails fast (instant 503). Fallback succeeds after a short
            # delay — long enough to still be pending when primary's retry
            # loop finishes.
            if model == "primary":
                return httpx.Response(503, json={"error": "overloaded"})
            await asyncio.sleep(0.1)
            return httpx.Response(200, json=_ok_response(model))

        async def run() -> gemini_client.GeminiCallResult:
            with _with_mock_httpx(handler):
                return await gemini_client.call_gemini_with_fallback(
                    payload=_fake_payload(),
                    primary_model="primary",
                    fallback_model="fallback",
                    race=True,
                )

        result = asyncio.run(run())
        self.assertEqual(result.model, "fallback")

    def test_non_retryable_4xx_skips_retry_goes_to_fallback(self) -> None:
        calls: list[str] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            model = _model_from_url(request)
            calls.append(model)
            if model == "primary":
                return httpx.Response(400, json={"error": "bad request"})
            return httpx.Response(200, json=_ok_response(model))

        async def run() -> gemini_client.GeminiCallResult:
            with _with_mock_httpx(handler):
                return await gemini_client.call_gemini_with_fallback(
                    payload=_fake_payload(),
                    primary_model="primary",
                    fallback_model="fallback",
                    race=False,
                )

        result = asyncio.run(run())
        self.assertEqual(result.model, "fallback")
        # Primary tried exactly once (4xx is non-retryable), fallback tried once
        self.assertEqual(calls, ["primary", "fallback"])


if __name__ == "__main__":
    unittest.main()
