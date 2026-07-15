"""Low-confidence label scans must not surface garbled OCR as the product title.

Regression for scan QA 2026-07-10: a generated cola label OCR'd to
"Facouard 1% tanseorgh" and was displayed verbatim as the product name.
"""
from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from app.services.product_label_scan import analyze_product_label_image


def _raw(product_name: str, confidence: float, ingredients_text: str = "") -> dict:
    return {
        "product_name": product_name,
        "brand": None,
        "ingredients_text": ingredients_text,
        "nutrition": {"calories": 140, "sugar_g": 39},
        "confidence": confidence,
        "confidence_breakdown": {},
        "notes": [],
    }


class ProductLabelRecoverableTests(unittest.IsolatedAsyncioTestCase):
    async def test_low_confidence_replaces_product_name(self) -> None:
        with patch(
            "app.services.product_label_scan._call_gemini_product_label_extractor",
            new=AsyncMock(return_value=_raw("Facouard 1% tanseorgh", confidence=0.3)),
        ):
            result = await analyze_product_label_image(b"img", "image/png")
        self.assertTrue(result["recoverable"])
        self.assertEqual(result["product_name"], "Packaged product")
        self.assertEqual(result["raw_product_name"], "Facouard 1% tanseorgh")
        # No readable ingredients → no made-up score; route to a better capture.
        self.assertIsNone(result["score"])
        self.assertEqual(result["tier"], "unscored")
        self.assertTrue(result["needs_better_capture"])
        self.assertIn("barcode", result["suggested_captures"])

    async def test_confident_scan_keeps_product_name(self) -> None:
        with patch(
            "app.services.product_label_scan._call_gemini_product_label_extractor",
            new=AsyncMock(
                return_value=_raw(
                    "Rolled Oats",
                    confidence=0.9,
                    ingredients_text="100% whole grain rolled oats",
                )
            ),
        ):
            result = await analyze_product_label_image(b"img", "image/png")
        self.assertFalse(result["recoverable"])
        self.assertEqual(result["product_name"], "Rolled Oats")
        self.assertEqual(result["raw_product_name"], "Rolled Oats")


if __name__ == "__main__":
    unittest.main()
