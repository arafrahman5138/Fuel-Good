from __future__ import annotations

import hashlib
from typing import Any

import httpx

from app.config import get_settings


settings = get_settings()


class EmbeddingUnavailable(RuntimeError):
    pass


def active_embedding_provider() -> tuple[str, str]:
    provider = (settings.embedding_provider or "").strip().lower()
    if provider == "openai" and settings.openai_api_key:
        return "openai", settings.embedding_model or settings.openai_embedding_model
    if provider == "gemini" and (settings.google_api_key or settings.gemini_api_key):
        return "gemini", settings.embedding_model or settings.gemini_embedding_model
    if provider == "ollama" and settings.ollama_host:
        return "ollama", settings.embedding_model or settings.ollama_embedding_model
    return "none", ""


def text_hash(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


async def embed_text(text: str) -> list[float]:
    provider, model = active_embedding_provider()
    if provider == "none":
        raise EmbeddingUnavailable("No embedding provider configured.")
    if provider == "openai":
        return await _embed_openai(text, model)
    if provider == "gemini":
        return await _embed_gemini(text, model)
    if provider == "ollama":
        return await _embed_ollama(text, model)
    raise EmbeddingUnavailable(f"Unsupported embedding provider: {provider}")


def validate_embedding_vector(vector: list[float]) -> list[float]:
    if len(vector) != settings.embedding_dimension:
        raise EmbeddingUnavailable(
            f"Embedding dimension mismatch: expected {settings.embedding_dimension}, got {len(vector)}."
        )
    return vector


async def _embed_openai(text: str, model: str) -> list[float]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"input": text, "model": model},
        )
        response.raise_for_status()
        data = response.json()
    return validate_embedding_vector([float(x) for x in ((data.get("data") or [{}])[0].get("embedding") or [])])


async def _embed_gemini(text: str, model: str) -> list[float]:
    api_key = settings.google_api_key or settings.gemini_api_key
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
    payload = {
        "content": {"parts": [{"text": text}]},
        "outputDimensionality": settings.embedding_dimension,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
    values = ((data.get("embedding") or {}).get("values") or [])
    return validate_embedding_vector([float(x) for x in values])


async def _embed_ollama(text: str, model: str) -> list[float]:
    base = settings.ollama_host
    if not base.startswith("http"):
        base = f"http://{base}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{base}/api/embeddings",
            json={"model": model, "prompt": text},
        )
        response.raise_for_status()
        data = response.json()
    return validate_embedding_vector([float(x) for x in (data.get("embedding") or [])])


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sum(a * a for a in left) ** 0.5
    right_norm = sum(b * b for b in right) ** 0.5
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)
