#!/usr/bin/env python3
"""
Generate Fuel Good splash screens via Gemini 2.5 Flash Image (generateContent).

Reads logo references from the repo root, writes PNGs under frontend/assets/images/.

Environment: GOOGLE_API_KEY or GEMINI_API_KEY (same as backend).

Usage:
  cd backend && python scripts/generate_splash_screens_gemini.py
  python scripts/generate_splash_screens_gemini.py --only primary
  python scripts/generate_splash_screens_gemini.py --only all
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import logging
import os
import sys
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_IMAGES = REPO_ROOT / "frontend" / "assets" / "images"
GENERATED = FRONTEND_IMAGES / "generated"

MODEL = "gemini-2.5-flash-image"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

# Preferred mark-only sources to avoid app-icon framing in generated splashes.
LOGO_MARK = FRONTEND_IMAGES / "icon-transparent.png"
LOGO_MARK_MONO = FRONTEND_IMAGES / "icon-white-transparent.png"


def _detect_mime(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/png"


def _api_key() -> str | None:
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


async def _generate_one(
    client: httpx.AsyncClient,
    api_key: str,
    image_path: Path,
    prompt: str,
    aspect_ratio: str = "1:1",
) -> bytes | None:
    raw = image_path.read_bytes()
    mime = _detect_mime(raw)
    b64 = base64.standard_b64encode(raw).decode("ascii")
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"inlineData": {"mimeType": mime, "data": b64}},
                    {"text": prompt},
                ],
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"aspectRatio": aspect_ratio},
        },
    }
    resp = await client.post(API_URL, params={"key": api_key}, json=payload, timeout=120.0)
    if resp.status_code != 200:
        logger.error("Gemini %s: %s", resp.status_code, resp.text[:500])
        return None
    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        logger.error("No candidates: %s", str(data)[:400])
        return None
    parts = candidates[0].get("content", {}).get("parts") or []
    for part in parts:
        inline = part.get("inlineData")
        if inline and inline.get("data"):
            return base64.standard_b64decode(inline["data"])
    logger.error("No image in parts")
    return None


Mode = Literal["primary", "all"]


async def run(mode: Mode) -> int:
    load_dotenv(REPO_ROOT / "backend" / ".env")
    key = _api_key()
    if not key or key.startswith("your-"):
        logger.error("Set GOOGLE_API_KEY or GEMINI_API_KEY (e.g. in backend/.env).")
        return 1

    for p in (LOGO_MARK, LOGO_MARK_MONO):
        if not p.is_file():
            logger.error("Missing reference image: %s", p)
            return 1

    GENERATED.mkdir(parents=True, exist_ok=True)

    jobs: list[tuple[str, Path, str, Path | None]] = [
        (
            "light_splash_from_light_logo",
            LOGO_MARK,
            (
                "Using the attached transparent brand mark as the exact logo, create a square (1:1) mobile splash screen "
                "that is a full-screen extension of the brand world, not an app icon. The background must fill the entire "
                "canvas edge to edge with no inset shape, no rounded rectangle, no tile, no panel, and no border. Keep the "
                "leaf-and-flame mark centered, same geometry, with vivid green fills and soft warm-cream linework. Place the "
                "mark directly on an airy off-white to pale cream background (#F9F9F2 to #FFFFFF) with extremely subtle "
                "diffused green atmosphere near the far outer edges only. Minimal, premium wellness, elegant negative space, "
                "no text, no watermark, no device frame, no UI."
            ),
            FRONTEND_IMAGES / "splash-icon-light.png",
        ),
        (
            "dark_splash_from_dark_logo",
            LOGO_MARK,
            (
                "Using the attached transparent brand mark as the exact logo, create a square (1:1) dark-mode mobile splash "
                "screen that feels like a full-screen extension of the brand, not an app icon. The background must cover the "
                "entire canvas edge to edge with no inset shape, no rounded rectangle, no tile, no panel, and no border. Keep "
                "the leaf-and-flame mark centered and faithful, with vivid green fills and soft warm-cream linework, floating "
                "directly on a continuous deep charcoal background around #222121. Background should be clean, minimal, and mostly "
                "flat, with only a very soft vignette for depth. Do not add green mist, leaves, particles, foliage, textures, shadows "
                "under the logo, glow rings, or any decorative objects. No hard shapes, no extra logos, no text, no watermark, no device frame."
            ),
            FRONTEND_IMAGES / "splash-icon-dark.png",
        ),
    ]

    if mode == "all":
        jobs.extend(
            [
                (
                    "light_splash_from_dark_logo",
                    LOGO_MARK,
                    (
                        "Using the attached transparent brand mark, create a square (1:1) "
                        "light-mode splash screen: soft white to pale cream full-field background, "
                        "centered mark with adjusted contrast so the warm-cream outlines read cleanly on light. "
                        "No inset tile or rounded rectangle. Preserve brand shapes. Subtle edge glow only. No text, no watermark."
                    ),
                    GENERATED / "splash-gemini-light-from-v3-dark-logo.png",
                ),
                (
                    "dark_splash_from_light_logo",
                    LOGO_MARK,
                    (
                        "Using the attached transparent brand mark, create a square (1:1) dark-mode splash: "
                        "full canvas deep charcoal ~#222121, keep greens vivid and warm-cream linework bright, "
                        "soft depth shadows suited to dark UI, and absolutely no icon tile or rounded rectangle. "
                        "Same centered mark, no new text or watermarks."
                    ),
                    GENERATED / "splash-gemini-dark-from-v3-light-logo.png",
                ),
            ]
        )

    async with httpx.AsyncClient() as client:
        for name, ref, prompt, out_main in jobs:
            logger.info("Generating %s …", name)
            image_bytes = await _generate_one(client, key, ref, prompt)
            if not image_bytes:
                return 1
            primary = out_main
            assert primary is not None
            primary.parent.mkdir(parents=True, exist_ok=True)
            primary.write_bytes(image_bytes)
            logger.info("Wrote %s", primary)
            alt = GENERATED / f"splash-gemini-{name}.png"
            if primary.resolve() != alt.resolve():
                alt.write_bytes(image_bytes)
                logger.info("Copy -> %s", alt)

    return 0


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--only",
        choices=("primary", "all"),
        default="primary",
        help="primary: light+dark Expo splashes only; all: also cross-theme variants in generated/",
    )
    args = parser.parse_args()
    code = asyncio.run(run(args.only))
    sys.exit(code)


if __name__ == "__main__":
    main()
