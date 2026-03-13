from __future__ import annotations

import asyncio

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
    db = SessionLocal()
    try:
        print("== Chat retrieval smoke check ==")
        for query in CHAT_RETRIEVAL_QUERIES:
            result = await retrieve_recipe_candidates(db, query, limit=3, recipe_role="full_meal")
            top = (result.get("results") or [None])[0]
            if top:
                print(
                    f"{query} -> {top['recipe'].title} "
                    f"(score={top['score']}, provider={result.get('provider')})"
                )
            else:
                print(f"{query} -> no match")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
