from datetime import UTC, datetime, timedelta
import hashlib
import json
import logging
import secrets
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.auth import (
    create_token_pair,
    get_current_user,
    get_password_hash,
    verify_password,
    verify_refresh_token,
)
from app.models.user import User
from app.schemas.billing import EntitlementInfo
from app.schemas.auth import (
    PasswordResetConfirm,
    PasswordResetConfirmResponse,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    SocialAuthRequest,
    Token,
    UserLogin,
    UserPreferencesUpdate,
    UserProfile,
    UserRegister,
)
from app.services.billing import build_entitlement_info
from app.services.access_overrides import ensure_allowlisted_user_has_override
from app.services.email import is_transactional_email_configured, send_password_reset_email, send_welcome_email
from app.services.notifications import record_notification_event
from app.utils import normalize_email as _normalize_email

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("fuelgood.auth")
APPLE_ISSUER = "https://appleid.apple.com"
_apple_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}


_MAX_RESET_ATTEMPTS = 5
# 8-digit codes give 10^8 = 100M possibilities, far outside a brute-force
# window at our 20 req/min auth rate limit (≈72k requests/day per IP, so
# worst-case expected success per IP is ~1400 days).
_RESET_CODE_LENGTH = 8
_RESET_CODE_MAX = 10 ** _RESET_CODE_LENGTH


def _generate_password_reset_code() -> str:
    return f"{secrets.randbelow(_RESET_CODE_MAX):0{_RESET_CODE_LENGTH}d}"


def _hash_password_reset_code(email: str, code: str) -> str:
    payload = f"{settings.secret_key}:{_normalize_email(email)}:{code.strip().upper()}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


async def _fetch_apple_jwks() -> list[dict[str, Any]]:
    now = datetime.now(UTC).timestamp()
    cached_keys = _apple_jwks_cache.get("keys")
    if cached_keys and now - float(_apple_jwks_cache.get("fetched_at") or 0) < 3600:
        return cached_keys

    async with httpx.AsyncClient(timeout=settings.social_request_timeout_seconds) as client:
        response = await client.get(settings.apple_jwks_url)
        response.raise_for_status()
        data = response.json()

    keys = data.get("keys") or []
    _apple_jwks_cache["keys"] = keys
    _apple_jwks_cache["fetched_at"] = now
    return keys


async def _verify_google_access_token(access_token: str) -> dict[str, str]:
    if not access_token.strip():
        raise HTTPException(status_code=400, detail="Missing Google access token.")

    async with httpx.AsyncClient(timeout=settings.social_request_timeout_seconds) as client:
        response = await client.get(
            settings.google_userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in token.")

    profile = response.json()
    email = _normalize_email(str(profile.get("email") or ""))
    if not email:
        raise HTTPException(status_code=401, detail="Google account did not provide an email address.")
    if not profile.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    return {
        "email": email,
        "name": str(profile.get("name") or "").strip(),
        "provider_subject": str(profile.get("sub") or email),
    }


async def _verify_apple_identity_token(identity_token: str) -> dict[str, str]:
    if not identity_token.strip():
        raise HTTPException(status_code=400, detail="Missing Apple identity token.")

    try:
        header = jwt.get_unverified_header(identity_token)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Apple identity token.") from exc

    kid = header.get("kid")
    keys = await _fetch_apple_jwks()
    key = next((candidate for candidate in keys if candidate.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Unable to verify Apple identity token.")

    valid_audiences = [settings.apple_bundle_id]
    if settings.apple_bundle_id != "com.fuelgood.app":
        valid_audiences.append("com.fuelgood.app")

    try:
        claims = jwt.decode(
            identity_token,
            key,
            algorithms=[header.get("alg", "RS256")],
            audience=valid_audiences,
            issuer=APPLE_ISSUER,
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Apple identity token.") from exc

    provider_subject = str(claims.get("sub") or "").strip()
    if not provider_subject:
        raise HTTPException(status_code=401, detail="Apple identity token is missing a subject.")

    email = _normalize_email(str(claims.get("email") or ""))
    return {
        "email": email,
        "name": "",
        "provider_subject": provider_subject,
    }


def _serialize_profile(current_user: User) -> UserProfile:
    return UserProfile(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        auth_provider=current_user.auth_provider,
        dietary_preferences=current_user.dietary_preferences or [],
        flavor_preferences=current_user.flavor_preferences or [],
        allergies=current_user.allergies or [],
        liked_ingredients=current_user.liked_ingredients or [],
        disliked_ingredients=current_user.disliked_ingredients or [],
        protein_preferences=current_user.protein_preferences or {},
        cooking_time_budget=current_user.cooking_time_budget or {},
        household_size=current_user.household_size,
        budget_level=current_user.budget_level,
        xp_points=current_user.xp_points,
        current_streak=current_user.current_streak,
        longest_streak=current_user.longest_streak,
        entitlement=build_entitlement_info(current_user),
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


def _auto_update_streak(user: User, db: Session):
    """Silently update streak when user fetches profile."""
    today = datetime.now(UTC).date()
    last_active = user.last_active_date.date() if user.last_active_date else None
    if last_active == today:
        return
    if last_active and (today - last_active).days == 1:
        user.current_streak = (user.current_streak or 0) + 1
    elif not last_active or (today - last_active).days > 1:
        user.current_streak = 1
    if (user.current_streak or 0) > (user.longest_streak or 0):
        user.longest_streak = user.current_streak
    user.last_active_date = datetime.now(UTC)
    db.commit()


@router.post("/register", response_model=Token)
async def register(
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = _normalize_email(user_data.email)
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(user_data.password),
        name=user_data.name.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ensure_allowlisted_user_has_override(db, user)

    if is_transactional_email_configured():
        background_tasks.add_task(
            send_welcome_email,
            to_email=user.email,
            name=user.name,
        )

    token = create_token_pair(str(user.id))
    return token


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == _normalize_email(user_data.email)).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    ensure_allowlisted_user_has_override(db, user)

    token = create_token_pair(str(user.id))
    return token


@router.post("/forgot-password", response_model=PasswordResetRequestResponse)
async def forgot_password(
    body: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = _normalize_email(body.email)
    user = db.query(User).filter(User.email == normalized_email).first()
    message = "If an account exists for that email, password reset instructions have been generated."

    if not user:
        return PasswordResetRequestResponse(message=message)

    reset_code = _generate_password_reset_code()
    user.password_reset_code_hash = _hash_password_reset_code(user.email, reset_code)
    user.password_reset_code_expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(
        minutes=settings.password_reset_token_expire_minutes
    )
    user.password_reset_attempts = 0
    db.commit()
    logger.info(
        json.dumps(
            {
                "event": "auth.password_reset_requested",
                "email": user.email,
                "request_delivery": "dev_response" if (settings.environment or "").lower() in {"dev", "development"} else "email_pending",
            }
        )
    )

    if (settings.environment or "").lower() in {"dev", "development"}:
        return PasswordResetRequestResponse(
            message=message,
            reset_code=reset_code,
            expires_in_minutes=settings.password_reset_token_expire_minutes,
        )

    if is_transactional_email_configured():
        background_tasks.add_task(
            send_password_reset_email,
            to_email=user.email,
            reset_code=reset_code,
            expires_in_minutes=settings.password_reset_token_expire_minutes,
            name=user.name,
        )
    return PasswordResetRequestResponse(message=message)


@router.post("/reset-password", response_model=PasswordResetConfirmResponse)
async def reset_password(body: PasswordResetConfirm, db: Session = Depends(get_db)):
    email = _normalize_email(body.email)
    code = (body.code or "").strip().upper()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired reset code")

    expires_at = user.password_reset_code_expires_at
    if not user.password_reset_code_hash or not expires_at or expires_at < datetime.now(UTC).replace(tzinfo=None):
        raise HTTPException(status_code=401, detail="Invalid or expired reset code")

    if (user.password_reset_attempts or 0) >= _MAX_RESET_ATTEMPTS:
        user.password_reset_code_hash = None
        user.password_reset_code_expires_at = None
        user.password_reset_attempts = 0
        db.commit()
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new reset code.")

    expected_hash = _hash_password_reset_code(email, code)
    if not secrets.compare_digest(user.password_reset_code_hash, expected_hash):
        user.password_reset_attempts = (user.password_reset_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid or expired reset code")

    user.hashed_password = get_password_hash(body.new_password)
    user.password_reset_code_hash = None
    user.password_reset_code_expires_at = None
    user.password_reset_attempts = 0
    db.commit()
    return PasswordResetConfirmResponse(message="Password updated successfully.")


@router.post("/social", response_model=Token)
async def social_auth(auth_data: SocialAuthRequest, db: Session = Depends(get_db)):
    if not settings.social_auth_enabled:
        raise HTTPException(status_code=503, detail="Social sign-in is disabled.")

    provider = (auth_data.provider or "").strip().lower()
    if provider not in {"google", "apple"}:
        raise HTTPException(status_code=400, detail="Unsupported social auth provider.")

    identity: dict[str, str]
    if provider == "google":
        identity = await _verify_google_access_token(auth_data.token)
    else:
        identity = await _verify_apple_identity_token(auth_data.token)

    provider_subject = identity["provider_subject"]
    email = identity.get("email") or _normalize_email(auth_data.email or "")
    name = (auth_data.name or identity.get("name") or "").strip()

    user = (
        db.query(User)
        .filter(User.auth_provider == provider, User.provider_subject == provider_subject)
        .first()
    )

    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user and user.provider_subject and user.provider_subject != provider_subject:
            raise HTTPException(status_code=409, detail="That email is already linked to another sign-in method.")

    if not user and not email:
        raise HTTPException(
            status_code=400,
            detail="Apple sign-in did not provide an email. Complete first sign-in with email sharing enabled.",
        )

    if not user:
        user = User(
            email=email,
            name=name or email.split("@")[0],
            auth_provider=provider,
            provider_subject=provider_subject,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        ensure_allowlisted_user_has_override(db, user)
    else:
        updated = False
        if not user.provider_subject:
            user.provider_subject = provider_subject
            updated = True
        if user.auth_provider == "email" and not user.hashed_password:
            user.auth_provider = provider
            updated = True
        if name and user.name != name:
            user.name = name
            updated = True
        if updated:
            db.commit()
            db.refresh(user)
        ensure_allowlisted_user_has_override(db, user)

    token = create_token_pair(str(user.id))
    return token


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
async def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    user_id = verify_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return create_token_pair(str(user.id))


@router.get("/me", response_model=UserProfile)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _auto_update_streak(current_user, db)
    record_notification_event(db, current_user.id, "app_opened", source="server")
    db.commit()
    return _serialize_profile(current_user)


@router.put("/preferences")
async def update_preferences(
    prefs: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = prefs.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    db.commit()
    return {"message": "Preferences updated"}


@router.delete("/account")
async def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the current user's account and all associated data."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info("account_deletion.requested request_id=%s", request_id)

    # Cascade FKs handle user-owned rows (see 2e4861eab987 + c7d8e9f0a1b2).
    try:
        db.delete(current_user)
        db.commit()
        logger.info("account_deletion.succeeded request_id=%s", request_id)
    except Exception:
        db.rollback()
        logger.exception("account_deletion.failed request_id=%s", request_id)
        raise HTTPException(status_code=500, detail="Failed to delete account. Please contact support.")

    return {"message": "Account deleted successfully"}
