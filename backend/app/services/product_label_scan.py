from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from app.config import get_settings
from app.services.whole_food_scoring import analyze_whole_food_product


settings = get_settings()

PRODUCT_LABEL_SCAN_PROMPT = """You analyze a packaged food label image for a nutrition app.
Return strict JSON only with this exact shape:
{
  "product_name": "string",
  "brand": "string",
  "ingredients_text": "string",
  "nutrition": {
    "calories": 0,
    "protein_g": 0,
    "fat_g": 0,
    "fiber_g": 0,
    "sugar_g": 0,
    "carbs_g": 0,
    "sodium_mg": 0
  },
  "confidence": 0.0,
  "confidence_breakdown": {
    "ocr": 0.0,
    "ingredients": 0.0,
    "nutrition": 0.0,
    "metadata": 0.0
  },
  "notes": ["string"]
}

Rules:
- prefer exact visible text over guessing
- if a value is not visible, return empty string for text fields and 0 for numeric fields
- ingredients_text should be a plain comma-separated string when visible
- do not invent brand or nutrition facts
- confidence must reflect how readable the label is
"""


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _to_float(value: Any) -> float:
    if value in (None, "", "unknown", "n/a", "null"):
        return 0.0
    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        match = re.search(r"-?\d+(?:\.\d+)?", str(value))
        if not match:
            return 0.0
        return round(float(match.group(0)), 1)


def _normalize_ingredients_text(value: str) -> str:
    cleaned = _clean_text(value)
    cleaned = re.sub(r"(?i)^ingredients\s*:\s*", "", cleaned)
    cleaned = cleaned.strip(" .;:")
    return cleaned


async def _call_gemini_product_label_extractor(
    image_bytes: bytes,
    mime_type: str,
    capture_type: str,
) -> dict[str, Any]:
    api_key = settings.google_api_key or settings.gemini_api_key
    if not api_key:
        raise RuntimeError("Gemini API key is not configured.")

    prompt = PRODUCT_LABEL_SCAN_PROMPT + "\n\nContext:\n" + json.dumps({"capture_type": capture_type}, indent=2)
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("No product scan candidate returned.")
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    text_part = next((part.get("text") for part in parts if part.get("text")), None)
    if not text_part:
        raise RuntimeError("No product scan payload returned.")
    return _extract_json(text_part)


def _recoverable_score_override(result: dict[str, Any]) -> dict[str, Any]:
    adjusted = {**result}
    adjusted["score"] = min(float(adjusted.get("score", 0) or 0), 59.0)
    adjusted["tier"] = "mixed"
    adjusted["verdict"] = "Needs review"
    adjusted["summary"] = "We could not confidently read enough of the ingredient list to give a trusted verdict yet."
    adjusted["recommended_action"] = "Retake the label photo, try barcode, or fix the extracted text before deciding."
    concerns = list(adjusted.get("concerns") or [])
    concerns.insert(0, "The ingredient list could not be read confidently from the label photo.")
    adjusted["concerns"] = concerns[:5]
    return adjusted


async def analyze_product_label_image(
    image_bytes: bytes,
    mime_type: str,
    capture_type: str = "front_label",
) -> dict[str, Any]:
    raw = await _call_gemini_product_label_extractor(
        image_bytes=image_bytes,
        mime_type=mime_type,
        capture_type=capture_type,
    )

    nutrition = raw.get("nutrition") or {}
    ingredients_text = _normalize_ingredients_text(raw.get("ingredients_text") or "")
    confidence = max(0.0, min(1.0, float(raw.get("confidence", 0) or 0)))
    confidence_breakdown = raw.get("confidence_breakdown") or {}

    payload = {
        "product_name": _clean_text(raw.get("product_name")) or "Label scan",
        "brand": _clean_text(raw.get("brand")) or None,
        "ingredients_text": ingredients_text,
        "calories": _to_float(nutrition.get("calories")),
        "protein_g": _to_float(nutrition.get("protein_g")),
        "fat_g": _to_float(nutrition.get("fat_g")),
        "fiber_g": _to_float(nutrition.get("fiber_g")),
        "sugar_g": _to_float(nutrition.get("sugar_g")),
        "carbs_g": _to_float(nutrition.get("carbs_g")),
        "sodium_mg": _to_float(nutrition.get("sodium_mg")),
        "source": "label_image",
    }
    score_result = analyze_whole_food_product(payload)

    recoverable = not ingredients_text or confidence < 0.55
    if recoverable:
        score_result = _recoverable_score_override(score_result)

    return {
        "product_name": payload["product_name"],
        "brand": payload["brand"],
        "barcode": None,
        "source": "label_image",
        "capture_type": capture_type,
        "ingredients_text": ingredients_text,
        "confidence": confidence,
        "confidence_breakdown": {
            "ocr": float(confidence_breakdown.get("ocr", 0) or 0),
            "ingredients": float(confidence_breakdown.get("ingredients", 0) or 0),
            "nutrition": float(confidence_breakdown.get("nutrition", 0) or 0),
            "metadata": float(confidence_breakdown.get("metadata", 0) or 0),
        },
        "recoverable": recoverable,
        "notes": [str(item).strip() for item in (raw.get("notes") or []) if str(item).strip()][:4],
        **score_result,
    }
