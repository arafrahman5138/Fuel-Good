#!/usr/bin/env python3
"""Generate realistic scan test images via Gemini 2.5 Flash Image.

Produces meal photos, ingredient labels, and edge-case images into
tasks/scan-audit/images/ for simulator-driven scan audits.

Usage:
    cd backend && python scripts/generate_scan_test_images.py
    python scripts/generate_scan_test_images.py --only meal_01_healthy_plate
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import httpx
from dotenv import load_dotenv

logger = logging.getLogger("scan_test_images")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = REPO_ROOT / "tasks" / "scan-audit" / "images"
MODEL = "gemini-2.5-flash-image"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"


@dataclass(frozen=True)
class ImageSpec:
    name: str
    prompt: str
    aspect_ratio: str = "4:3"


# ---- Meal photos: diverse across Fuel Score spectrum ----
MEAL_SPECS: list[ImageSpec] = [
    ImageSpec(
        name="meal_01_healthy_plate",
        prompt=(
            "A realistic smartphone photo, taken from above at a slight angle, of a home-cooked dinner "
            "plate on a light wood table. The plate contains a grilled skinless chicken breast sliced "
            "into medallions, a fluffy mound of cooked quinoa, and bright steamed broccoli florets "
            "with a lemon wedge. Natural kitchen light from a window, shallow depth of field, appetizing "
            "but casual — not a styled food-magazine shot. Minor imperfections like a fork on the side of "
            "the plate and a glass of water partly visible in the background."
        ),
    ),
    ImageSpec(
        name="meal_02_diner_burger",
        prompt=(
            "A realistic smartphone photo of a greasy American diner cheeseburger with melted yellow "
            "cheese, iceberg lettuce, tomato, and a sesame seed bun on a white diner plate, next to a "
            "pile of golden crinkle-cut fries and a small paper cup of ketchup. Shot from slightly "
            "above at the diner counter, with a red plastic booth and a napkin dispenser slightly out "
            "of focus in the background. Authentic, casual phone photo — no food styling, natural fluorescent lighting."
        ),
    ),
    ImageSpec(
        name="meal_03_burrito_bowl",
        prompt=(
            "A realistic smartphone photo, top-down, of a Chipotle-style burrito bowl in a cardboard "
            "takeout container. Visible sections: cilantro-lime white rice, black beans, grilled chicken, "
            "pico de gallo, corn salsa, guacamole, and shredded cheese, with a lime wedge on top. "
            "Taken on a plain gray office desk under overhead lighting, slight motion blur on the edge "
            "of the container. Looks like a quick lunch photo a regular user would take."
        ),
    ),
    ImageSpec(
        name="meal_04_pasta_carbonara",
        prompt=(
            "A realistic restaurant phone photo of a bowl of spaghetti carbonara on a white bistro "
            "plate, creamy egg-and-cheese sauce coating the pasta, crispy guanciale, black pepper, "
            "shaved parmesan on top. Shot from a 30-degree angle on a dark wood restaurant table with "
            "a wine glass, warm ambient lighting. Slight reflection from overhead lights. Casual, not styled."
        ),
    ),
    ImageSpec(
        name="meal_05_yogurt_bowl",
        prompt=(
            "A realistic kitchen-counter phone photo, top-down, of a breakfast bowl of plain Greek "
            "yogurt topped with fresh blueberries, sliced strawberries, granola clusters, a drizzle of "
            "honey, and a scatter of chia seeds. White ceramic bowl on a light-colored marble counter, "
            "a spoon beside it, morning light from a window. Looks like an everyday breakfast snapshot."
        ),
    ),
    ImageSpec(
        name="meal_06_pizza_slice",
        prompt=(
            "A realistic smartphone photo of two large pepperoni pizza slices on a greasy paper plate "
            "from a New York pizzeria, with oily pepperoni cups and browned cheese, a red pepper flake "
            "shaker and a can of soda slightly out of focus behind it. Late-night casual shot, warm "
            "yellow pizzeria lighting, shot from a slightly low angle."
        ),
    ),
    ImageSpec(
        name="meal_07_salmon_rice",
        prompt=(
            "A realistic phone photo of a dinner plate with a glazed teriyaki salmon fillet, a scoop "
            "of sticky white jasmine rice, and sauteed bok choy with garlic. Shot top-down on a dark "
            "matte plate on a light marble counter. Sesame seeds sprinkled on the salmon, a slice of "
            "lemon on the side. Home-cooked vibe, overhead LED kitchen lighting."
        ),
    ),
    ImageSpec(
        name="meal_08_oats_berries",
        prompt=(
            "A realistic top-down phone photo of overnight oats in a glass mason jar on a wooden "
            "breakfast table, topped with sliced banana, raspberries, peanut butter drizzle, chia "
            "seeds, and cinnamon. A wooden spoon on the side, cozy morning light. Feels like an "
            "everyday breakfast, not a food blog shot."
        ),
    ),
    ImageSpec(
        name="meal_09_cafeteria_tray",
        prompt=(
            "A realistic smartphone photo of a beige plastic cafeteria tray with multiple compartments: "
            "one section has baked macaroni and cheese, another has four chicken tenders with ketchup, "
            "another has canned corn, and a small cup of chocolate pudding. Fluorescent overhead "
            "lighting, shot straight down on a laminate cafeteria table. Unstyled, realistic."
        ),
    ),
    ImageSpec(
        name="meal_10_acai_bowl",
        prompt=(
            "A realistic phone photo of an acai bowl in a white bowl, taken from a high angle at a "
            "juice-bar counter. Deep purple acai base topped with banana slices, strawberries, "
            "blueberries, a generous pile of granola, shredded coconut, and a honey drizzle. Sun-lit, "
            "light background, slight shadow from the phone."
        ),
    ),
]

# ---- Ingredient labels: test OCR + flag detection ----
LABEL_SPECS: list[ImageSpec] = [
    ImageSpec(
        name="label_01_greek_yogurt_clean",
        prompt=(
            "A realistic close-up smartphone photo of the back of a plain whole-milk Greek yogurt tub, "
            "showing the Nutrition Facts panel and ingredients list. The ingredients list reads clearly: "
            "'INGREDIENTS: Pasteurized Grade A Whole Milk, Pasteurized Cream, Live Active Cultures "
            "(S. Thermophilus, L. Bulgaricus, L. Acidophilus, Bifidus, L. Casei).' Nutrition Facts panel "
            "visible with: Serving Size 3/4 cup (170g), Calories 160, Total Fat 10g, Saturated Fat 6g, "
            "Cholesterol 35mg, Sodium 65mg, Total Carbs 7g, Total Sugars 6g, Protein 15g, Calcium 15% DV. "
            "Phone held at a slight angle, hand visible at edge, natural lighting. Text sharp and readable."
        ),
        aspect_ratio="3:4",
    ),
    ImageSpec(
        name="label_02_sugary_cereal_ultra",
        prompt=(
            "A realistic phone photo of the side panel of a brightly colored children's breakfast cereal "
            "box, showing a long ingredients list and Nutrition Facts. Ingredients list clearly reads: "
            "'INGREDIENTS: Corn Flour, Sugar, Whole Grain Oat Flour, Wheat Flour, High Fructose Corn "
            "Syrup, Vegetable Oil (Soybean and/or Palm Oil), Salt, Dextrose, Maltodextrin, Natural and "
            "Artificial Flavors, Red 40, Yellow 5, Yellow 6, Blue 1, BHT For Freshness.' Nutrition Facts "
            "show: Serving 1 cup (30g), Calories 130, Total Sugars 12g (Added Sugars 12g), Protein 1g, "
            "Fiber 1g, Sodium 180mg. Taken on a kitchen counter with grocery bag in background, slight "
            "glare on the box. All label text crisp and fully legible."
        ),
        aspect_ratio="3:4",
    ),
    ImageSpec(
        name="label_03_granola_bar_healthwashed",
        prompt=(
            "A realistic close-up phone photo of a 'healthy' granola bar wrapper back, with the "
            "marketing terms 'MADE WITH WHOLE GRAINS' and 'NO HIGH FRUCTOSE CORN SYRUP' visible at the "
            "top. Below that, the ingredients list clearly reads: 'INGREDIENTS: Whole Grain Rolled Oats, "
            "Cane Sugar, Canola Oil, Rice Flour, Honey, Soy Lecithin, Natural Flavor, Salt, Mixed "
            "Tocopherols (for freshness), Molasses.' Nutrition Facts: Serving 1 bar (35g), Calories 150, "
            "Total Sugars 9g (Added Sugars 8g), Protein 3g, Fiber 2g. Photo taken at a slight angle on a "
            "wooden table under soft daylight. Every line of text readable."
        ),
        aspect_ratio="3:4",
    ),
    ImageSpec(
        name="label_04_protein_bar_isolates",
        prompt=(
            "A realistic phone photo of the back of a protein bar wrapper advertising '20g PROTEIN' on "
            "the front (partially visible). The ingredients list is clearly legible: 'INGREDIENTS: Soy "
            "Protein Isolate, Whey Protein Isolate, Vegetable Glycerin, Soluble Corn Fiber, Water, "
            "Erythritol, Cocoa Butter, Almond Butter, Sunflower Lecithin, Natural Flavors, Sucralose, "
            "Salt, Steviol Glycosides.' Nutrition Facts show: Serving 1 bar (60g), Calories 210, Total "
            "Sugars 1g, Sugar Alcohols 10g, Protein 20g, Fiber 5g. Held in-hand at the gym, slight "
            "motion, text crisp."
        ),
        aspect_ratio="3:4",
    ),
    ImageSpec(
        name="label_05_tortilla_chips_simple",
        prompt=(
            "A realistic phone photo of the back of a bag of tortilla chips. The ingredients list reads "
            "simply and clearly: 'INGREDIENTS: Stone Ground Whole Corn, Sunflower Oil, Sea Salt.' "
            "Nutrition Facts: Serving 10 chips (28g), Calories 140, Total Fat 7g, Sodium 110mg, Total "
            "Carbs 18g, Fiber 2g, Protein 2g. The bag is crinkled, shot on a kitchen counter with "
            "natural overhead light. Labels fully legible."
        ),
        aspect_ratio="3:4",
    ),
]

# ---- Edge cases: robustness tests ----
EDGE_SPECS: list[ImageSpec] = [
    ImageSpec(
        name="edge_01_blurry_dim_meal",
        prompt=(
            "A realistic smartphone photo of a plate of chicken stir-fry with vegetables on a dimly lit "
            "restaurant table — the image is intentionally slightly blurry due to low light and a "
            "shaky hand, with noticeable image noise and warm tungsten lighting making colors muddy. "
            "Still recognizable as food but not sharp. No food styling."
        ),
    ),
    ImageSpec(
        name="edge_02_restaurant_menu",
        prompt=(
            "A realistic phone photo of a printed restaurant menu page on a wooden table, showing a "
            "list of dishes with prices — typical bistro menu layout with categories like 'Starters', "
            "'Mains', 'Desserts'. No food in the frame, just the paper menu. Someone might accidentally "
            "scan this thinking it's a label."
        ),
        aspect_ratio="3:4",
    ),
    ImageSpec(
        name="edge_03_coffee_latte",
        prompt=(
            "A realistic overhead phone photo of a single cappuccino in a white ceramic cup on a "
            "wooden cafe table, with simple latte art on top. No food around it, just the drink. "
            "Soft morning cafe light."
        ),
    ),
]

ALL_SPECS: list[ImageSpec] = MEAL_SPECS + LABEL_SPECS + EDGE_SPECS


def _api_key() -> str | None:
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


async def _generate(
    client: httpx.AsyncClient,
    api_key: str,
    spec: ImageSpec,
) -> bytes | None:
    payload = {
        "contents": [{"role": "user", "parts": [{"text": spec.prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"aspectRatio": spec.aspect_ratio},
        },
    }
    resp = await client.post(API_URL, params={"key": api_key}, json=payload, timeout=180.0)
    if resp.status_code != 200:
        logger.error("%s: HTTP %s — %s", spec.name, resp.status_code, resp.text[:400])
        return None
    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        logger.error("%s: no candidates — %s", spec.name, str(data)[:300])
        return None
    parts = candidates[0].get("content", {}).get("parts") or []
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            return base64.standard_b64decode(inline["data"])
    logger.error("%s: no image part returned", spec.name)
    return None


async def _run_one(
    client: httpx.AsyncClient,
    api_key: str,
    spec: ImageSpec,
    force: bool,
) -> bool:
    out_path = OUT_DIR / f"{spec.name}.png"
    if out_path.exists() and not force:
        logger.info("SKIP %s (exists)", spec.name)
        return True
    logger.info("→ %s", spec.name)
    img = await _generate(client, api_key, spec)
    if not img:
        logger.error("FAIL %s", spec.name)
        return False
    out_path.write_bytes(img)
    logger.info("✓ %s (%d KB)", spec.name, len(img) // 1024)
    return True


async def run(selected: list[str] | None, force: bool, concurrency: int) -> int:
    load_dotenv(REPO_ROOT / "backend" / ".env")
    key = _api_key()
    if not key or key.startswith("your-"):
        logger.error("Set GOOGLE_API_KEY or GEMINI_API_KEY in backend/.env")
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    specs = [s for s in ALL_SPECS if not selected or s.name in selected]
    if not specs:
        logger.error("No specs matched: %s", selected)
        return 1

    sem = asyncio.Semaphore(concurrency)
    failures = 0

    async with httpx.AsyncClient() as client:
        async def _bounded(s: ImageSpec) -> None:
            nonlocal failures
            async with sem:
                ok = await _run_one(client, key, s, force)
                if not ok:
                    failures += 1

        await asyncio.gather(*[_bounded(s) for s in specs])

    logger.info("Done. %d/%d succeeded.", len(specs) - failures, len(specs))
    return 0 if failures == 0 else 2


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", action="append", default=None, help="Generate specific spec names")
    parser.add_argument("--force", action="store_true", help="Regenerate even if file exists")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--list", action="store_true", help="List spec names and exit")
    args = parser.parse_args()
    if args.list:
        for s in ALL_SPECS:
            print(s.name)
        return
    code = asyncio.run(run(args.only, args.force, args.concurrency))
    sys.exit(code)


if __name__ == "__main__":
    main()
