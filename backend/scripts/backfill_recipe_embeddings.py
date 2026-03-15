from __future__ import annotations

import asyncio

from sqlalchemy import or_

from app.config import get_settings
from app.db import SessionLocal
from app.models import recipe as recipe_model  # noqa: F401
from app.models import recipe_embedding as recipe_embedding_model  # noqa: F401
from app.models.recipe import Recipe
from app.services.recipe_retrieval import ensure_recipe_embedding, recipe_search_text
from app.services.embeddings import text_hash


settings = get_settings()


async def main() -> None:
    db = SessionLocal()
    try:
        recipes = db.query(Recipe).filter(
            Recipe.recipe_role == "full_meal",
            or_(Recipe.is_component.is_(False), Recipe.is_component.is_(None)),
        ).all()
        updated = 0
        skipped = 0
        failed = 0

        for recipe in recipes:
            existing = db.query(recipe_embedding_model.RecipeEmbedding).filter(
                recipe_embedding_model.RecipeEmbedding.recipe_id == recipe.id
            ).first()
            fingerprint = text_hash(recipe_search_text(recipe))
            if existing and existing.text_hash == fingerprint and existing.embedding is not None:
                skipped += 1
                continue
            try:
                row = await ensure_recipe_embedding(db, recipe)
            except Exception as exc:
                failed += 1
                print(f"failed: {recipe.title} ({exc})")
                continue
            if row:
                updated += 1
                print(f"embedded: {recipe.title}")

        print(
            f"completed updated={updated} skipped={skipped} failed={failed} "
            f"dimension={settings.embedding_dimension} provider={settings.embedding_provider}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
