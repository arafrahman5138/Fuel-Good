from __future__ import annotations

import asyncio
from sqlalchemy import text

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.models import recipe as recipe_model  # noqa: F401
from app.models import recipe_embedding as recipe_embedding_model  # noqa: F401
from app.services.recipe_retrieval import retrieve_recipe_candidates


CHAT_RETRIEVAL_QUERIES = [
    "healthy chicken shawarma bowl",
    "whole-food mac and cheese",
    "high protein burger and fries alternative",
]


async def main() -> None:
    init_db()
    settings = get_settings()
    db = SessionLocal()
    try:
        print("== pgvector checks ==")
        extension_ok = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()
        print(f"vector extension: {'ok' if extension_ok else 'missing'}")
        index_ok = db.execute(text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'recipe_embeddings' AND indexdef ILIKE '%embedding%'"
        )).scalar()
        print(f"embedding index: {'ok' if index_ok else 'missing'}")
        column_ok = db.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'recipe_embeddings' AND column_name = 'embedding'"
        )).scalar()
        if column_ok:
            embedded = db.execute(text(
                "SELECT COUNT(*) FROM recipe_embeddings WHERE embedding IS NOT NULL"
            )).scalar()
            print(f"embedded recipes: {embedded} (expected dimension={settings.embedding_dimension})")
        else:
            print("embedded recipes: unavailable (embedding column missing)")

        print("== Chat retrieval smoke check ==")
        for query in CHAT_RETRIEVAL_QUERIES:
            result = await retrieve_recipe_candidates(db, query, limit=3, recipe_role="full_meal")
            top = (result.get("results") or [None])[0]
            if top:
                print(
                    f"{query} -> {top['recipe'].title} "
                    f"(score={top['score']}, provider={result.get('provider')}, timings={result.get('timings_ms')})"
                )
            else:
                print(f"{query} -> no match")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
