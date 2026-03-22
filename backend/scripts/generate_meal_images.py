#!/usr/bin/env python3
"""
Batch generate food images for all recipes that don't have one.

Usage:
    cd backend
    python -m scripts.generate_meal_images [--limit 50] [--force]
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models.recipe import Recipe  # noqa: E402
from app.services.food_image import generate_image_for_recipe  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def main(limit: int, force: bool) -> None:
    settings = get_settings()
    api_key = settings.google_api_key or settings.gemini_api_key
    openai_key = settings.openai_api_key

    has_google = bool(api_key)
    has_openai = bool(openai_key and not openai_key.startswith("your-"))

    if not has_google and not has_openai:
        logger.error(
            "No image generation API key found. "
            "Set GOOGLE_API_KEY (for Imagen) or OPENAI_API_KEY (for DALL-E) in .env"
        )
        sys.exit(1)

    provider = "Imagen (Google)" if has_google else "DALL-E (OpenAI)"
    logger.info("Using %s for image generation", provider)

    db = SessionLocal()
    try:
        query = db.query(Recipe)
        if not force:
            query = query.filter(
                (Recipe.image_url == None) | (Recipe.image_url == "")  # noqa: E711
            )
        recipes = query.limit(limit).all()

        if not recipes:
            logger.info("All recipes already have images. Use --force to regenerate.")
            return

        logger.info("Processing %d recipes...", len(recipes))
        generated = 0
        failed = 0

        for i, recipe in enumerate(recipes, 1):
            logger.info("[%d/%d] %s", i, len(recipes), recipe.title)
            image_url = await generate_image_for_recipe(
                title=recipe.title,
                description=recipe.description,
                force=force,
            )
            if image_url:
                recipe.image_url = image_url
                generated += 1
                logger.info("  -> %s", image_url)
            else:
                failed += 1
                logger.warning("  -> FAILED")

            # Commit in batches of 5
            if i % 5 == 0:
                db.commit()

        db.commit()
        logger.info(
            "Done! Generated: %d, Failed: %d, Total: %d",
            generated, failed, len(recipes),
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate food images for recipes")
    parser.add_argument("--limit", type=int, default=50, help="Max recipes to process")
    parser.add_argument("--force", action="store_true", help="Regenerate existing images")
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.force))
