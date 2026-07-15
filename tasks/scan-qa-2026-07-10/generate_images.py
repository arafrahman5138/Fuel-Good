#!/usr/bin/env python3
"""Generate the 2026-07-10 scan-QA image suite via Gemini 2.5 Flash Image.

28 images: 10 meals spanning healthy→unhealthy, 6 desserts, 5 nutrition
labels, 5 grocery items, 2 edge cases. Ground truth lives in
ground_truth.json next to this script.

Usage:
    python tasks/scan-qa-2026-07-10/generate_images.py [--only NAME] [--force]
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

logger = logging.getLogger("scan_qa_images")

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
OUT_DIR = ROOT / "images"
MODEL = "gemini-2.5-flash-image"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

STYLE = (
    " Realistic casual smartphone photo, not styled food photography. Natural imperfections,"
    " believable lighting, everyday setting."
)


@dataclass(frozen=True)
class ImageSpec:
    name: str
    prompt: str
    aspect_ratio: str = "4:3"


SPECS: list[ImageSpec] = [
    # ---- Meals: healthy -> unhealthy ----
    ImageSpec(
        "m01_grilled_salmon_quinoa",
        "Top-down phone photo of a home dinner plate: a grilled salmon fillet with char lines, a scoop of "
        "fluffy quinoa, and roasted asparagus spears with lemon. White plate on a wooden table, fork beside it."
        + STYLE,
    ),
    ImageSpec(
        "m02_chicken_avocado_salad",
        "Phone photo of a large salad bowl for lunch: sliced grilled chicken breast, mixed greens, cherry "
        "tomatoes, cucumber, half a sliced avocado fanned on top, olive oil drizzle. On a kitchen counter."
        + STYLE,
    ),
    ImageSpec(
        "m03_steak_sweet_potato",
        "Phone photo at a slight angle of a dinner plate with a sliced medium-rare sirloin steak, a whole "
        "roasted sweet potato split open with a little butter, and steamed broccoli florets. Dark plate, home table."
        + STYLE,
    ),
    ImageSpec(
        "m04_sushi_platter",
        "Overhead phone photo of a sushi dinner on a black rectangular tray: 4 salmon and tuna nigiri, 6 "
        "California roll pieces, pickled ginger, wasabi, small dish of soy sauce, chopsticks. Restaurant table."
        + STYLE,
    ),
    ImageSpec(
        "m05_turkey_sandwich",
        "Phone photo of a deli turkey sandwich on whole grain bread cut diagonally on a plate: visible sliced "
        "turkey, lettuce, tomato, a slice of cheddar. A small handful of baby carrots beside it. Kitchen counter, daylight."
        + STYLE,
    ),
    ImageSpec(
        "m06_spaghetti_meatballs",
        "Phone photo of a big bowl of spaghetti with marinara sauce and three large beef meatballs, grated "
        "parmesan on top, garlic bread slice on the side. Dinner table, warm indoor light."
        + STYLE,
    ),
    ImageSpec(
        "m07_fried_chicken_fries",
        "Phone photo of a red plastic fast-food basket lined with paper: three pieces of crispy deep-fried "
        "chicken (drumstick and thighs), a large pile of golden french fries, small tub of ranch. Greasy paper, fluorescent light."
        + STYLE,
    ),
    ImageSpec(
        "m08_loaded_nachos",
        "Overhead phone photo of a huge plate of loaded nachos: tortilla chips smothered in orange nacho "
        "cheese sauce, seasoned ground beef, sour cream dollops, pickled jalapeños, and a few olives. Sports-bar table."
        + STYLE,
    ),
    ImageSpec(
        "m09_hotdogs_and_ramen",
        "Phone photo of a college dorm meal on a small desk: a bowl of instant ramen noodles in orange broth "
        "with two sliced hot dogs mixed in, the torn seasoning packet and plastic wrapper beside the bowl. Harsh desk-lamp light."
        + STYLE,
    ),
    ImageSpec(
        "m10_fastfood_burger_meal",
        "Phone photo of a fast-food tray: a double cheeseburger with the wrapper peeled open, a large "
        "carton of fries, and a large soda cup with a straw. Yellow-and-red branded paper (generic, no real logos)."
        + STYLE,
    ),
    # ---- Desserts: healthy -> unhealthy ----
    ImageSpec(
        "d01_fruit_salad",
        "Overhead phone photo of a glass bowl of fresh fruit salad: watermelon cubes, strawberries, "
        "blueberries, kiwi slices, and grapes. A fork beside it on a bright kitchen table."
        + STYLE,
    ),
    ImageSpec(
        "d02_yogurt_berry_parfait",
        "Phone photo of a dessert glass with layered Greek yogurt parfait: white yogurt, a layer of "
        "raspberries and blueberries, a thin honey drizzle and a sprinkle of granola on top. Evening kitchen light."
        + STYLE,
    ),
    ImageSpec(
        "d03_dark_chocolate_squares",
        "Phone photo of three squares of 85% dark chocolate broken off a bar, sitting on a small wooden "
        "board next to a cup of black coffee. The rest of the bar in its foil behind."
        + STYLE,
    ),
    ImageSpec(
        "d04_apple_pie_slice",
        "Phone photo of a slice of homemade apple pie on a dessert plate, golden lattice crust, visible "
        "cinnamon apple filling, a small scoop of vanilla ice cream melting beside it. Family kitchen table."
        + STYLE,
    ),
    ImageSpec(
        "d05_glazed_donuts",
        "Phone photo of two glazed donuts and one chocolate-frosted donut with rainbow sprinkles on a "
        "paper napkin on an office desk, coffee cup nearby. Overhead office lighting."
        + STYLE,
    ),
    ImageSpec(
        "d06_icecream_sundae",
        "Phone photo of a tall ice cream sundae in a glass: three scoops of vanilla and chocolate ice "
        "cream, whipped cream, hot fudge dripping down, crushed peanuts, and a maraschino cherry on top. Diner counter."
        + STYLE,
    ),
    # ---- Nutrition labels ----
    ImageSpec(
        "l01_canned_black_beans",
        "Close-up phone photo of the back label of a can of black beans, text sharp and fully legible. "
        "Ingredients list reads exactly: 'INGREDIENTS: Prepared Black Beans, Water, Sea Salt.' Nutrition Facts: "
        "Serving 1/2 cup (130g), Calories 110, Total Fat 0g, Sodium 130mg, Total Carbohydrate 20g, Dietary "
        "Fiber 7g, Total Sugars 0g, Protein 7g. Held in hand in a kitchen, natural light.",
        "3:4",
    ),
    ImageSpec(
        "l02_cola_soda_label",
        "Close-up phone photo of a 2-liter cola bottle's nutrition label, text sharp and fully legible. "
        "Ingredients read exactly: 'INGREDIENTS: Carbonated Water, High Fructose Corn Syrup, Caramel Color, "
        "Phosphoric Acid, Natural Flavors, Caffeine.' Nutrition Facts: Serving 12 fl oz (360mL), Calories 140, "
        "Total Sugars 39g (Added Sugars 39g), Sodium 45mg, Protein 0g. Kitchen counter, fridge in background.",
        "3:4",
    ),
    ImageSpec(
        "l03_healthwashed_smoothie",
        "Close-up phone photo of the back of a green 'ALL NATURAL SUPERFOOD SMOOTHIE' bottle, marketing text "
        "'No Added Sugar*' visible, label text sharp and fully legible. Ingredients read exactly: 'INGREDIENTS: "
        "Apple Juice Concentrate, Banana Puree, Mango Puree, White Grape Juice Concentrate, Spinach Powder, "
        "Natural Flavors, Citric Acid, Ascorbic Acid.' Nutrition Facts: Serving 1 bottle (450mL), Calories 270, "
        "Total Sugars 53g, Fiber 2g, Protein 2g. Grocery store shelf background.",
        "3:4",
    ),
    ImageSpec(
        "l04_instant_noodle_cup",
        "Close-up phone photo of the side of an instant noodle cup, label text sharp and fully legible. "
        "Ingredients read exactly: 'INGREDIENTS: Enriched Wheat Flour, Palm Oil, Salt, Monosodium Glutamate, "
        "Hydrolyzed Soy Protein, Sugar, Dehydrated Vegetables, Disodium Inosinate, Disodium Guanylate, TBHQ "
        "(Preservative), Yellow 6.' Nutrition Facts: Serving 1 cup (64g), Calories 290, Total Fat 12g, Saturated "
        "Fat 6g, Sodium 1160mg, Total Carbohydrate 40g, Protein 6g. Held in hand under supermarket lighting.",
        "3:4",
    ),
    ImageSpec(
        "l05_rolled_oats_label",
        "Close-up phone photo of the back of a cylindrical container of old-fashioned rolled oats, text sharp "
        "and fully legible. Ingredients list reads exactly: 'INGREDIENTS: 100% Whole Grain Rolled Oats.' "
        "Nutrition Facts: Serving 1/2 cup dry (40g), Calories 150, Total Fat 3g, Sodium 0mg, Total Carbohydrate "
        "27g, Dietary Fiber 4g, Total Sugars 1g, Protein 5g. Pantry shelf, warm kitchen light.",
        "3:4",
    ),
    # ---- Grocery items (front-of-pack / raw produce) ----
    ImageSpec(
        "g01_banana_bunch",
        "Phone photo of a bunch of five ripe yellow bananas lying on a kitchen counter next to a fruit bowl."
        + STYLE,
    ),
    ImageSpec(
        "g02_avocado_halves",
        "Phone photo of two avocado halves with the pit still in one half, on a cutting board with a knife, "
        "a whole avocado beside them. Kitchen counter, daylight."
        + STYLE,
    ),
    ImageSpec(
        "g03_potato_chips_bag",
        "Phone photo of the FRONT of a shiny orange bag of 'CRUNCHY CHEESE PUFFS' snack (generic brand, no "
        "real logos), cartoon cheetah-style mascot, 'Party Size!' banner. Held in hand in a grocery aisle. No "
        "ingredients list visible, front of bag only."
        + STYLE,
    ),
    ImageSpec(
        "g04_toaster_pastry_box",
        "Phone photo of the FRONT of a box of frosted strawberry toaster pastries (generic brand, no real "
        "logos), showing the pastry with pink frosting and sprinkles, '8 PASTRIES' flag. On a supermarket shelf. "
        "Front of box only, no ingredients panel visible."
        + STYLE,
    ),
    ImageSpec(
        "g05_rotisserie_chicken",
        "Phone photo of a whole golden rotisserie chicken in a clear plastic supermarket container with the "
        "lid open, on a kitchen counter, steam visible."
        + STYLE,
    ),
    # ---- Edge cases ----
    ImageSpec(
        "e01_indian_thali",
        "Overhead phone photo of an Indian thali on a steel tray with separate bowls: yellow dal, basmati "
        "rice, two rotis, palak paneer, cucumber raita, and a small salad of onion and tomato. Home dinner table."
        + STYLE,
    ),
    ImageSpec(
        "e02_birthday_dessert_plate",
        "Phone photo of a paper party plate holding a slice of frosted birthday cake with rainbow sprinkles, "
        "two chocolate chip cookies, and a small pile of candy (gummy bears and M&M-style chocolates). Party table."
        + STYLE,
    ),
]


def _api_key() -> str | None:
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


async def _generate(client: httpx.AsyncClient, api_key: str, spec: ImageSpec) -> bytes | None:
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


async def _run_one(client: httpx.AsyncClient, api_key: str, spec: ImageSpec, force: bool) -> bool:
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
        logger.error("Set GOOGLE_API_KEY in backend/.env")
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    specs = [s for s in SPECS if not selected or s.name in selected]
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
    parser.add_argument("--only", action="append", default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--list", action="store_true")
    args = parser.parse_args()
    if args.list:
        for s in SPECS:
            print(s.name)
        return
    sys.exit(asyncio.run(run(args.only, args.force, args.concurrency)))


if __name__ == "__main__":
    main()
