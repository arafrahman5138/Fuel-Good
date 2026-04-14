from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()


class SupabaseStorageUnavailable(RuntimeError):
    pass


def is_supabase_storage_configured() -> bool:
    return bool(settings.supabase_url.strip() and settings.supabase_service_role_key.strip())


def require_supabase_storage() -> None:
    if not is_supabase_storage_configured():
        raise SupabaseStorageUnavailable("Supabase Storage is not configured.")


def build_private_object_path(*, user_id: str, namespace: str, extension: str) -> str:
    safe_extension = (extension or "jpg").lower().strip(".") or "jpg"
    now = datetime.now(UTC)
    stamp = now.strftime("%Y/%m/%d")
    # user_id must be the first path segment to satisfy RLS policies
    return f"{user_id}/{stamp}/{uuid.uuid4()}.{safe_extension}"


async def upload_private_object(
    *,
    bucket: str,
    path: str,
    content: bytes,
    mime_type: str,
) -> dict[str, Any]:
    require_supabase_storage()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path}",
            content=content,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
                "Content-Type": mime_type,
                "x-upsert": "true",
            },
        )
        response.raise_for_status()
        return response.json()


async def create_signed_object_url(
    *,
    bucket: str,
    path: str,
    expires_in: int | None = None,
) -> dict[str, Any]:
    require_supabase_storage()
    ttl = expires_in or settings.supabase_signed_url_ttl_seconds
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/{bucket}/{path}",
            json={"expiresIn": ttl},
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        payload = response.json()
    signed_path = payload.get("signedURL") or payload.get("signedUrl") or ""
    if not signed_path:
        raise SupabaseStorageUnavailable("Supabase did not return a signed object URL.")
    return {
        "signed_url": f"{settings.supabase_url.rstrip('/')}/storage/v1{signed_path}",
        "expires_in": ttl,
        "expires_at": datetime.now(UTC) + timedelta(seconds=ttl),
    }
