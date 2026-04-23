"""Resilient Gemini client for the scan pipeline.

Phase 2 audit fix: the original pipeline had a single blocking call to
``gemini-2.5-flash`` with a 40s timeout and no retry. When Flash returned
503 (observed 2026-04-22), every scan degraded. This module wraps the
Gemini ``generateContent`` endpoint with three compounding defences:

1. **Per-call timeout** — much tighter than 40s (default 8s) so users
   don't wait on a dying request.
2. **Retry-once with jitter** — absorbs transient 5xx hiccups.
3. **Fallback model race** — if the primary is still silent at
   ``scan_race_threshold_ms``, we start the fallback model in parallel
   and take whichever finishes first.

Callers (``meal_scan``, ``product_label_scan``, and any future streaming
consumer) just ask for JSON — they don't care which model delivered it.
"""
from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# 5xx + 429 are the retryable classes. 4xx client errors never get retried
# because the request would fail identically against the fallback model.
_RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


class GeminiCallFailed(RuntimeError):
    """Raised when both primary and fallback models fail."""


@dataclass
class GeminiCallResult:
    json: dict[str, Any]         # parsed generateContent response
    model: str                    # which model finally returned
    attempts: list[dict[str, Any]]  # per-attempt timing + outcome


def _endpoint(model: str, api_key: str) -> str:
    return (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
        f":generateContent?key={api_key}"
    )


async def _call_once(
    *,
    client: httpx.AsyncClient,
    model: str,
    api_key: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    response = await client.post(_endpoint(model, api_key), json=payload)
    if response.status_code >= 400:
        http_err = httpx.HTTPStatusError(
            f"Gemini {model} returned {response.status_code}",
            request=response.request,
            response=response,
        )
        raise http_err
    return response.json()


async def _try_model_with_retry(
    *,
    api_key: str,
    model: str,
    payload: dict[str, Any],
    timeout_s: float,
    max_retries: int,
    attempts_log: list[dict[str, Any]],
) -> dict[str, Any]:
    """Call a single model with optional retry. Raises on final failure."""
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        started = asyncio.get_event_loop().time()
        entry: dict[str, Any] = {"model": model, "attempt": attempt + 1, "status": None, "ms": 0}
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                data = await _call_once(
                    client=client,
                    model=model,
                    api_key=api_key,
                    payload=payload,
                )
            entry["status"] = "ok"
            entry["ms"] = int((asyncio.get_event_loop().time() - started) * 1000)
            attempts_log.append(entry)
            return data
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response else 0
            entry["status"] = f"http_{status}"
            entry["ms"] = int((asyncio.get_event_loop().time() - started) * 1000)
            attempts_log.append(entry)
            last_exc = exc
            if status not in _RETRYABLE_STATUS:
                break
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            entry["status"] = type(exc).__name__
            entry["ms"] = int((asyncio.get_event_loop().time() - started) * 1000)
            attempts_log.append(entry)
            last_exc = exc
        # Exponential backoff with jitter before the next retry
        if attempt < max_retries:
            await asyncio.sleep(0.4 * (attempt + 1) + random.uniform(0, 0.3))
    assert last_exc is not None
    raise last_exc


async def call_gemini_with_fallback(
    *,
    payload: dict[str, Any],
    primary_model: str | None = None,
    fallback_model: str | None = None,
    race: bool = True,
) -> GeminiCallResult:
    """Call Gemini with retry + optional primary/fallback race.

    Parameters
    ----------
    payload
        The raw ``generateContent`` payload (``contents`` + ``generationConfig``).
    primary_model, fallback_model
        Override settings-derived defaults (useful for tests).
    race
        If True (default), we start the fallback model in parallel once the
        primary hits ``scan_race_threshold_ms`` without returning. If False,
        we only fall through to the fallback when the primary has truly
        failed (used for tests where we want deterministic ordering).
    """
    settings = get_settings()
    api_key = settings.google_api_key or settings.gemini_api_key
    if not api_key:
        raise RuntimeError("Gemini API key is not configured.")

    primary = primary_model or settings.scan_model or settings.gemini_model
    fallback = fallback_model or settings.scan_fallback_model
    timeout_s = float(settings.scan_per_call_timeout_s)
    race_threshold_s = float(settings.scan_race_threshold_ms) / 1000.0
    max_retries = int(settings.scan_max_retries)

    attempts: list[dict[str, Any]] = []

    primary_task = asyncio.create_task(
        _try_model_with_retry(
            api_key=api_key,
            model=primary,
            payload=payload,
            timeout_s=timeout_s,
            max_retries=max_retries,
            attempts_log=attempts,
        )
    )

    if not race or primary == fallback:
        # Sequential path: wait for primary, fallback only on total failure.
        try:
            data = await primary_task
            return GeminiCallResult(json=data, model=primary, attempts=attempts)
        except Exception as primary_exc:
            if primary == fallback:
                raise GeminiCallFailed(str(primary_exc)) from primary_exc
            try:
                data = await _try_model_with_retry(
                    api_key=api_key,
                    model=fallback,
                    payload=payload,
                    timeout_s=timeout_s,
                    max_retries=max_retries,
                    attempts_log=attempts,
                )
                return GeminiCallResult(json=data, model=fallback, attempts=attempts)
            except Exception as fallback_exc:
                raise GeminiCallFailed(
                    f"primary={type(primary_exc).__name__} fallback={type(fallback_exc).__name__}"
                ) from fallback_exc

    # Race path: wait up to race_threshold_s for primary. If it hasn't
    # finished by then, kick off the fallback and return whichever resolves
    # successfully first.
    try:
        done, _pending = await asyncio.wait(
            {primary_task}, timeout=race_threshold_s
        )
    except asyncio.CancelledError:
        primary_task.cancel()
        raise

    if primary_task in done:
        try:
            data = primary_task.result()
            return GeminiCallResult(json=data, model=primary, attempts=attempts)
        except Exception as primary_exc:
            # Primary failed within the race threshold — try the fallback alone.
            try:
                data = await _try_model_with_retry(
                    api_key=api_key,
                    model=fallback,
                    payload=payload,
                    timeout_s=timeout_s,
                    max_retries=max_retries,
                    attempts_log=attempts,
                )
                return GeminiCallResult(json=data, model=fallback, attempts=attempts)
            except Exception as fallback_exc:
                raise GeminiCallFailed(
                    f"primary={type(primary_exc).__name__} fallback={type(fallback_exc).__name__}"
                ) from fallback_exc

    # Primary still running past threshold — start fallback in parallel.
    fallback_task = asyncio.create_task(
        _try_model_with_retry(
            api_key=api_key,
            model=fallback,
            payload=payload,
            timeout_s=timeout_s,
            max_retries=max_retries,
            attempts_log=attempts,
        )
    )

    try:
        # Loop until one task succeeds or both have failed. We don't cancel
        # the pending task on the first completion — if it failed, we still
        # need the other as our only chance at a successful response.
        remaining = {primary_task, fallback_task}
        while remaining:
            done, pending = await asyncio.wait(
                remaining, return_when=asyncio.FIRST_COMPLETED
            )
            for task in done:
                try:
                    data = task.result()
                except Exception:
                    # This model failed — keep waiting on the other one.
                    continue
                winner_model = primary if task is primary_task else fallback
                # Cancel the still-pending task only after we have a winner.
                for pending_task in pending:
                    pending_task.cancel()
                return GeminiCallResult(json=data, model=winner_model, attempts=attempts)
            remaining = pending
        raise GeminiCallFailed("both primary and fallback failed after race")
    finally:
        for task in (primary_task, fallback_task):
            if not task.done():
                task.cancel()


def extract_text_from_response(data: dict[str, Any]) -> str:
    """Return the first candidate's text part, or raise if empty."""
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("No Gemini candidate returned.")
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    text_part = next((part.get("text") for part in parts if part.get("text")), None)
    if not text_part:
        raise RuntimeError("No Gemini text payload returned.")
    return text_part
