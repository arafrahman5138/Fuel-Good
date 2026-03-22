"""
Food image generation service.

Uses Google Gemini's Imagen 3 API to generate appetizing food photography
for meal/recipe cards. Falls back gracefully when the API is unavailable.
"""

import base64
import hashlib
import logging
import os
from pathlib import Path

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Directory where generated images are stored
IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "meal-images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _build_prompt(title: str, description: str | None = None) -> str:
    """Build an appetizing food photography prompt from a recipe title."""
    base = (
        f"Professional food photography of {title}. "
        "Overhead shot, natural daylight, shallow depth of field, "
        "on a clean ceramic plate, garnished beautifully, "
        "warm inviting tones, restaurant quality presentation, "
        "no text or watermarks."
    )
    return base


def _image_filename(title: str) -> str:
    """Deterministic filename from recipe title."""
    slug = hashlib.md5(title.lower().strip().encode()).hexdigest()[:12]
    return f"{slug}.png"


async def generate_food_image(
    title: str,
    description: str | None = None,
    force: bool = False,
) -> str | None:
    """
    Generate a food image for a recipe and save it locally.

    Returns the relative URL path (e.g. "/static/meal-images/abc123.png")
    or None if generation fails.
    """
    settings = get_settings()
    api_key = settings.google_api_key or settings.gemini_api_key
    if not api_key:
        logger.warning("No Google API key configured; skipping image generation")
        return None

    filename = _image_filename(title)
    filepath = IMAGES_DIR / filename
    relative_url = f"/static/meal-images/{filename}"

    # Skip if already exists (unless force regenerate)
    if filepath.exists() and not force:
        return relative_url

    prompt = _build_prompt(title, description)

    # Use Gemini 2.5 Flash Image model for image generation
    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        "models/gemini-2.5-flash-image:generateContent"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                url,
                params={"key": api_key},
                json=payload,
            )

            if resp.status_code != 200:
                logger.error(
                    "Gemini image API error %s for '%s': %s",
                    resp.status_code,
                    title,
                    resp.text[:300],
                )
                return None

            data = resp.json()
            # Navigate Gemini response structure
            candidates = data.get("candidates", [])
            if not candidates:
                logger.warning("No candidates returned for '%s'", title)
                return None

            parts = candidates[0].get("content", {}).get("parts", [])
            image_b64 = None
            for part in parts:
                if "inlineData" in part:
                    image_b64 = part["inlineData"].get("data")
                    break

            if not image_b64:
                logger.warning("No image data in response for '%s'", title)
                return None

            image_bytes = base64.b64decode(image_b64)
            filepath.write_bytes(image_bytes)
            logger.info("Generated image for '%s' -> %s", title, relative_url)
            return relative_url

    except httpx.TimeoutException:
        logger.error("Timeout generating image for '%s'", title)
        return None
    except Exception:
        logger.exception("Failed to generate image for '%s'", title)
        return None


async def generate_food_image_openai(
    title: str,
    description: str | None = None,
    force: bool = False,
) -> str | None:
    """
    Alternative: Generate a food image using OpenAI DALL-E 3.
    Used when OPENAI_API_KEY is available and valid.
    """
    settings = get_settings()
    api_key = settings.openai_api_key
    if not api_key or api_key.startswith("your-"):
        return None

    filename = _image_filename(title)
    filepath = IMAGES_DIR / filename
    relative_url = f"/static/meal-images/{filename}"

    if filepath.exists() and not force:
        return relative_url

    prompt = _build_prompt(title, description)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": 1,
                    "size": "1024x1024",
                    "quality": "standard",
                    "response_format": "b64_json",
                },
            )

            if resp.status_code != 200:
                logger.error("DALL-E error %s: %s", resp.status_code, resp.text[:300])
                return None

            data = resp.json()
            image_b64 = data["data"][0]["b64_json"]
            image_bytes = base64.b64decode(image_b64)
            filepath.write_bytes(image_bytes)
            logger.info("Generated DALL-E image for '%s' -> %s", title, relative_url)
            return relative_url

    except Exception:
        logger.exception("Failed DALL-E generation for '%s'", title)
        return None


async def generate_image_for_recipe(
    title: str,
    description: str | None = None,
    force: bool = False,
) -> str | None:
    """
    Try Imagen first, fall back to DALL-E if available.
    Returns the relative URL path or None.
    """
    url = await generate_food_image(title, description, force)
    if url:
        return url

    url = await generate_food_image_openai(title, description, force)
    return url
