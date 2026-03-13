from app.db import SessionLocal
from app.models import recipe as recipe_model  # noqa: F401
from app.models import recipe_embedding as recipe_embedding_model  # noqa: F401
from app.models.recipe import Recipe
from app.services.recipe_retrieval import ensure_recipe_embedding

import asyncio


async def main() -> None:
    db = SessionLocal()
    try:
        recipes = db.query(Recipe).all()
        updated = 0
        for recipe in recipes:
            row = await ensure_recipe_embedding(db, recipe)
            if row:
                updated += 1
                print(f"embedded: {recipe.title}")
        print(f"completed: {updated}/{len(recipes)} recipes")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
