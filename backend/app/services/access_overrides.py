from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import User
from app.utils import normalize_email

settings = get_settings()


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def complimentary_allowlist_emails() -> set[str]:
    raw = settings.complimentary_access_allowlist_emails or ""
    return {
        normalize_email(email)
        for email in raw.replace("\n", ",").split(",")
        if email.strip()
    }


def email_is_allowlisted(email: str | None) -> bool:
    if not email:
        return False
    return normalize_email(email) in complimentary_allowlist_emails()


def ensure_allowlisted_user_has_override(db: Session, user: User, reason: str = "allowlisted TestFlight tester") -> bool:
    if not user.email or not email_is_allowlisted(user.email):
        return False
    if (user.access_override_level or "").strip():
        return False

    user.access_override_level = "premium_lifetime"
    user.access_override_reason = reason
    user.access_override_expires_at = None
    user.access_override_updated_at = utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return True
