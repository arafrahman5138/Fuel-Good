from __future__ import annotations

import difflib
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.recipe import Recipe
from app.models.recipe_embedding import RecipeEmbedding
from app.services.embeddings import (
    EmbeddingUnavailable,
    active_embedding_provider,
    cosine_similarity,
    embed_text,
    text_hash,
)


TOKEN_RE = re.compile(r"[a-z0-9]{3,}")


def recipe_search_text(recipe: Recipe) -> str:
    ingredient_names = [
        str((ingredient or {}).get("name", "")).strip()
        for ingredient in (recipe.ingredients or [])
        if isinstance(ingredient, dict)
    ]
    tags = [str(v) for v in (recipe.tags or [])]
    dietary = [str(v) for v in (recipe.dietary_tags or [])]
    flavor = [str(v) for v in (recipe.flavor_profile or [])]
    return " | ".join(
        part for part in [
            recipe.title or "",
            recipe.description or "",
            " ".join(ingredient_names),
            " ".join(tags),
            " ".join(dietary),
            " ".join(flavor),
            recipe.cuisine or "",
        ] if part
    )


def _tokens(value: str) -> set[str]:
    return set(TOKEN_RE.findall((value or "").lower()))


def _ingredient_overlap(query_tokens: set[str], recipe: Recipe) -> float:
    ingredient_tokens: set[str] = set()
    for ingredient in recipe.ingredients or []:
        if isinstance(ingredient, dict):
            ingredient_tokens |= _tokens(str(ingredient.get("name", "")))
    if not query_tokens:
        return 0.0
    return len(query_tokens & ingredient_tokens) / len(query_tokens)


def _lexical_score(query: str, recipe: Recipe, query_tokens: set[str]) -> float:
    title_ratio = difflib.SequenceMatcher(None, (query or "").lower(), (recipe.title or "").lower()).ratio()
    title_tokens = _tokens(recipe.title or "")
    title_overlap = len(query_tokens & title_tokens) / max(len(query_tokens), 1)
    ingredient_overlap = _ingredient_overlap(query_tokens, recipe)
    cuisine_boost = 0.08 if recipe.cuisine and recipe.cuisine.lower() in query.lower() else 0.0
    mes_ready = 0.05 if getattr(recipe, "is_mes_scoreable", True) else 0.0
    return min(1.0, title_ratio * 0.45 + title_overlap * 0.2 + ingredient_overlap * 0.22 + cuisine_boost + mes_ready)


async def ensure_recipe_embedding(db: Session, recipe: Recipe) -> RecipeEmbedding | None:
    provider, model = active_embedding_provider()
    if provider == "none":
        return None

    content = recipe_search_text(recipe)
    fingerprint = text_hash(content)
    row = db.query(RecipeEmbedding).filter(RecipeEmbedding.recipe_id == recipe.id).first()
    if row and row.text_hash == fingerprint and row.vector:
        return row

    try:
        vector = await embed_text(content)
    except EmbeddingUnavailable:
        return None
    except Exception:
        return None

    if row is None:
        row = RecipeEmbedding(
            recipe_id=recipe.id,
            provider=provider,
            model=model,
            text_hash=fingerprint,
            vector=vector,
        )
        db.add(row)
    else:
        row.provider = provider
        row.model = model
        row.text_hash = fingerprint
        row.vector = vector
    db.commit()
    db.refresh(row)
    return row


async def retrieve_recipe_candidates(
    db: Session,
    query: str,
    *,
    limit: int = 5,
    recipe_role: str | None = "full_meal",
    allow_components: bool = False,
) -> dict[str, Any]:
    candidates_query = db.query(Recipe)
    if recipe_role:
        candidates_query = candidates_query.filter(Recipe.recipe_role == recipe_role)
    if not allow_components:
        candidates_query = candidates_query.filter(Recipe.is_component.is_(False))
    recipes = candidates_query.all()

    query_tokens = _tokens(query)
    scored = sorted(
        (
            (_lexical_score(query, recipe, query_tokens), recipe)
            for recipe in recipes
        ),
        key=lambda item: item[0],
        reverse=True,
    )[: max(limit * 5, 12)]

    provider, _ = active_embedding_provider()
    query_vector: list[float] = []
    vector_used = provider != "none"
    if vector_used:
        try:
            query_vector = await embed_text(query)
        except Exception:
            vector_used = False

    results: list[dict[str, Any]] = []
    for lexical, recipe in scored:
        vector_score = 0.0
        if vector_used and query_vector:
            row = await ensure_recipe_embedding(db, recipe)
            if row and row.vector:
                vector_score = cosine_similarity(query_vector, [float(x) for x in row.vector])
        ingredient_overlap = _ingredient_overlap(query_tokens, recipe)
        final_score = (
            vector_score * 0.5
            + lexical * 0.35
            + ingredient_overlap * 0.1
            + (0.05 if getattr(recipe, "is_mes_scoreable", True) else 0.0)
        ) if vector_used else (lexical * 0.8 + ingredient_overlap * 0.15 + (0.05 if getattr(recipe, "is_mes_scoreable", True) else 0.0))
        results.append(
            {
                "recipe": recipe,
                "score": round(final_score, 4),
                "lexical_score": round(lexical, 4),
                "vector_score": round(vector_score, 4),
                "ingredient_overlap": round(ingredient_overlap, 4),
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)
    return {
        "provider": provider if vector_used else "lexical_fallback",
        "used_embeddings": vector_used,
        "results": results[:limit],
    }
