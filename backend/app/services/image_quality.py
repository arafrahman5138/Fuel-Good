"""Image quality probe for scan inputs.

Audit bug G: blurry / dim scans were returning AI confidence 0.83 and
hitting Fuel 100 because the AI is overconfident about bad photos. This
module runs a fast local check before the Gemini call and attenuates the
final confidence if the photo fails basic quality gates.

The signal is intentionally conservative — we only flag images that are
visibly unreadable. Normal photos in varied lighting pass.
"""
from __future__ import annotations

import io
import logging
from typing import Any

from PIL import Image, ImageFilter, ImageStat

logger = logging.getLogger(__name__)

# Thresholds chosen empirically from the 18 audit fixtures:
#   edge_01_blurry_dim_meal.png → should fail both checks.
#   meal_01_healthy_plate.png   → should pass cleanly.
BRIGHTNESS_MIN = 70.0       # mean grayscale 0-255
BRIGHTNESS_SUSPECT = 95.0   # soft-warn threshold (reduces confidence)
BLUR_MIN_EDGE_STD = 18.0    # std deviation of edge magnitudes (blur proxy)


def probe_image_quality(image_bytes: bytes) -> dict[str, Any]:
    """Return a dict with brightness + blur signals.

    Keys:
      brightness_ok: bool  — False if too dark to read reliably
      blur_ok: bool        — False if too blurry to read reliably
      brightness_mean: float
      edge_std: float
      confidence_multiplier: float — apply to Gemini-reported confidence
      review_required: bool        — surface the UI "review before logging" hint
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("L")  # grayscale
            img.thumbnail((384, 384))

            brightness_mean = float(ImageStat.Stat(img).mean[0])

            edges = img.filter(ImageFilter.FIND_EDGES)
            edge_stat = ImageStat.Stat(edges)
            edge_std = float(edge_stat.stddev[0])
    except Exception as exc:
        logger.info("image quality probe failed (%s) — assuming pass", type(exc).__name__)
        return {
            "brightness_ok": True,
            "blur_ok": True,
            "brightness_mean": None,
            "edge_std": None,
            "confidence_multiplier": 1.0,
            "review_required": False,
        }

    brightness_ok = brightness_mean >= BRIGHTNESS_MIN
    blur_ok = edge_std >= BLUR_MIN_EDGE_STD

    confidence_multiplier = 1.0
    if not brightness_ok:
        confidence_multiplier *= 0.6
    elif brightness_mean < BRIGHTNESS_SUSPECT:
        confidence_multiplier *= 0.85
    if not blur_ok:
        confidence_multiplier *= 0.5

    return {
        "brightness_ok": brightness_ok,
        "blur_ok": blur_ok,
        "brightness_mean": round(brightness_mean, 1),
        "edge_std": round(edge_std, 1),
        "confidence_multiplier": round(confidence_multiplier, 3),
        "review_required": not (brightness_ok and blur_ok),
    }
