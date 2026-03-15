from __future__ import annotations

import difflib
import re
import time
from typing import Any

from sqlalchemy import false, or_, select
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
LEXICAL_SHORTLIST_LIMIT = 24
VECTOR_CANDIDATE_LIMIT = 24


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


def _tokens(value: str) -> list[str]:
    seen: list[str] = []
    for token in TOKEN_RE.findall((value or "").lower()):
        if token not in seen:
            seen.append(token)
    return seen


def _ingredient_overlap(query_tokens: set[str], recipe: Recipe) -> float:
    ingredient_tokens: set[str] = set()
    for ingredient in recipe.ingredients or []:
        if isinstance(ingredient, dict):
            ingredient_tokens |= set(_tokens(str(ingredient.get("name", ""))))
    if not query_tokens:
        return 0.0
    return len(query_tokens & ingredient_tokens) / len(query_tokens)


def _lexical_score(query: str, recipe: Recipe, query_tokens: set[str]) -> float:
    title_ratio = difflib.SequenceMatcher(None, (query or "").lower(), (recipe.title or "").lower()).ratio()
    title_tokens = set(_tokens(recipe.title or ""))
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
            embedding=vector,
        )
        db.add(row)
    else:
        row.provider = provider
        row.model = model
        row.text_hash = fingerprint
        row.vector = vector
        row.embedding = vector
    db.commit()
    db.refresh(row)
    return row


def _base_recipe_query(db: Session, *, recipe_role: str | None, allow_components: bool):
    query = db.query(Recipe)
    if recipe_role:
        query = query.filter(Recipe.recipe_role == recipe_role)
    if not allow_components:
        query = query.filter(or_(Recipe.is_component.is_(False), Recipe.is_component.is_(None), Recipe.is_component == false()))
    return query


def _lexical_shortlist(
    db: Session,
    query: str,
    *,
    recipe_role: str | None,
    allow_components: bool,
    limit: int,
) -> list[Recipe]:
    tokens = _tokens(query)[:6]
    recipe_query = _base_recipe_query(db, recipe_role=recipe_role, allow_components=allow_components)
    if tokens:
        filters = []
        for token in tokens:
            pattern = f"%{token}%"
            filters.append(Recipe.title.ilike(pattern))
            filters.append(Recipe.description.ilike(pattern))
            filters.append(Recipe.cuisine.ilike(pattern))
        recipe_query = recipe_query.filter(or_(*filters))
    shortlist = recipe_query.limit(limit).all()
    if shortlist:
        return shortlist
    return _base_recipe_query(db, recipe_role=recipe_role, allow_components=allow_components).limit(limit).all()


async def _pgvector_candidates(
    db: Session,
    query_vector: list[float],
    *,
    recipe_role: str | None,
    allow_components: bool,
    limit: int,
) -> list[tuple[float, Recipe]]:
    stmt = (
        select(RecipeEmbedding.embedding.cosine_distance(query_vector), Recipe)
        .join(Recipe, RecipeEmbedding.recipe_id == Recipe.id)
        .where(RecipeEmbedding.embedding.is_not(None))
    )
    if recipe_role:
        stmt = stmt.where(Recipe.recipe_role == recipe_role)
    if not allow_components:
        stmt = stmt.where(Recipe.is_component.is_(False))
    stmt = stmt.order_by(RecipeEmbedding.embedding.cosine_distance(query_vector)).limit(limit)
    rows = db.execute(stmt).all()
    return [(max(0.0, 1.0 - float(distance)), recipe) for distance, recipe in rows]


async def retrieve_recipe_candidates(
    db: Session,
    query: str,
    *,
    limit: int = 5,
    recipe_role: str | None = "full_meal",
    allow_components: bool = False,
) -> dict[str, Any]:
    started = time.perf_counter()
    query_tokens = set(_tokens(query))
    lexical_started = time.perf_counter()
    lexical_candidates = _lexical_shortlist(
        db,
        query,
        recipe_role=recipe_role,
        allow_components=allow_components,
        limit=max(limit * 4, LEXICAL_SHORTLIST_LIMIT),
    )
    lexical_ms = round((time.perf_counter() - lexical_started) * 1000, 2)

    provider, _ = active_embedding_provider()
    vector_started = time.perf_counter()
    vector_used = provider != "none"
    query_vector: list[float] = []
    vector_candidates: dict[str, float] = {}
    vector_error: str | None = None

    if vector_used:
        try:
            query_vector = await embed_text(query)
            rows = await _pgvector_candidates(
                db,
                query_vector,
                recipe_role=recipe_role,
                allow_components=allow_components,
                limit=max(limit * 4, VECTOR_CANDIDATE_LIMIT),
            )
            vector_candidates = {str(recipe.id): round(score, 4) for score, recipe in rows}
        except EmbeddingUnavailable as exc:
            vector_used = False
            vector_error = str(exc)
        except Exception as exc:
            vector_used = False
            vector_error = str(exc)
    vector_ms = round((time.perf_counter() - vector_started) * 1000, 2)

    ranked: dict[str, dict[str, Any]] = {}

    for recipe in lexical_candidates:
        lexical = _lexical_score(query, recipe, query_tokens)
        ingredient_overlap = _ingredient_overlap(query_tokens, recipe)
        vector_score = float(vector_candidates.get(str(recipe.id), 0.0))
        score = (
            vector_score * 0.6
            + lexical * 0.3
            + ingredient_overlap * 0.05
            + (0.05 if getattr(recipe, "is_mes_scoreable", True) else 0.0)
        ) if vector_used else (
            lexical * 0.8
            + ingredient_overlap * 0.15
            + (0.05 if getattr(recipe, "is_mes_scoreable", True) else 0.0)
        )
        ranked[str(recipe.id)] = {
            "recipe": recipe,
            "score": round(score, 4),
            "lexical_score": round(lexical, 4),
            "vector_score": round(vector_score, 4),
            "ingredient_overlap": round(ingredient_overlap, 4),
        }

    if vector_used:
        recipe_ids = [key for key in vector_candidates.keys() if key not in ranked]
        if recipe_ids:
            recipes = _base_recipe_query(db, recipe_role=recipe_role, allow_components=allow_components).filter(Recipe.id.in_(recipe_ids)).all()
            for recipe in recipes:
                lexical = _lexical_score(query, recipe, query_tokens)
                ingredient_overlap = _ingredient_overlap(query_tokens, recipe)
                vector_score = float(vector_candidates.get(str(recipe.id), 0.0))
                score = (
                    vector_score * 0.6
                    + lexical * 0.3
                    + ingredient_overlap * 0.05
                    + (0.05 if getattr(recipe, "is_mes_scoreable", True) else 0.0)
                )
                ranked[str(recipe.id)] = {
                    "recipe": recipe,
                    "score": round(score, 4),
                    "lexical_score": round(lexical, 4),
                    "vector_score": round(vector_score, 4),
                    "ingredient_overlap": round(ingredient_overlap, 4),
                }

    results = sorted(ranked.values(), key=lambda item: item["score"], reverse=True)[:limit]
    return {
        "provider": provider if vector_used else "lexical_fallback",
        "used_embeddings": vector_used,
        "results": results,
        "timings_ms": {
            "lexical": lexical_ms,
            "vector": vector_ms,
            "total": round((time.perf_counter() - started) * 1000, 2),
        },
        "debug": {
            "lexical_candidates": len(lexical_candidates),
            "vector_candidates": len(vector_candidates),
            "vector_error": vector_error,
        },
    }
