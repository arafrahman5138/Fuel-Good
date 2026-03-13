"""
Grant, revoke, or list complimentary premium access overrides.

Examples:
  PYTHONPATH=. python3 scripts/manage_comp_access.py grant you@example.com
  PYTHONPATH=. python3 scripts/manage_comp_access.py grant tester@example.com --reason "beta tester" --days 30
  PYTHONPATH=. python3 scripts/manage_comp_access.py revoke tester@example.com
  PYTHONPATH=. python3 scripts/manage_comp_access.py list
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta

from app.db import SessionLocal, init_db
from app.models import (  # noqa: F401
    gamification,
    grocery,
    local_food,
    meal_plan,
    metabolic,
    metabolic_profile,
    notification,
    nutrition,
    recipe,
    recipe_embedding,
    saved_recipe,
    scanned_meal,
    user as user_model,
)
from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def normalize_email(value: str) -> str:
    return value.strip().lower()


def grant_access(db, email: str, reason: str | None, days: int | None) -> int:
    user = db.query(User).filter(User.email == normalize_email(email)).first()
    if not user:
        raise SystemExit(f"User not found: {email}")

    user.access_override_level = "premium_lifetime" if not days else "complimentary"
    user.access_override_reason = (reason or "manual complimentary access").strip()
    user.access_override_expires_at = utcnow() + timedelta(days=days) if days else None
    user.access_override_updated_at = utcnow()
    db.commit()
    print(
        f"Granted complimentary premium to {user.email}"
        f"{f' until {user.access_override_expires_at.isoformat()}' if user.access_override_expires_at else ' with no expiry'}"
        f" (reason: {user.access_override_reason})"
    )
    return 0


def revoke_access(db, email: str) -> int:
    user = db.query(User).filter(User.email == normalize_email(email)).first()
    if not user:
        raise SystemExit(f"User not found: {email}")

    user.access_override_level = None
    user.access_override_reason = None
    user.access_override_expires_at = None
    user.access_override_updated_at = utcnow()
    db.commit()
    print(f"Revoked complimentary premium from {user.email}")
    return 0


def list_access(db) -> int:
    users = (
        db.query(User)
        .filter(User.access_override_level.isnot(None))
        .order_by(User.email.asc())
        .all()
    )
    if not users:
        print("No complimentary-access users found.")
        return 0

    print("Complimentary premium users:")
    for user in users:
        expiry = user.access_override_expires_at.isoformat() if user.access_override_expires_at else "never"
        reason = user.access_override_reason or "-"
        print(f"- {user.email} | level={user.access_override_level} | expires={expiry} | reason={reason}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage complimentary premium access overrides.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    grant = subparsers.add_parser("grant", help="Grant complimentary premium access to a user.")
    grant.add_argument("email", help="User email")
    grant.add_argument("--reason", default="manual complimentary access", help="Reason shown in admin output")
    grant.add_argument("--days", type=int, default=0, help="Optional number of days before complimentary access expires")

    revoke = subparsers.add_parser("revoke", help="Remove complimentary premium access from a user.")
    revoke.add_argument("email", help="User email")

    subparsers.add_parser("list", help="List users with complimentary premium access.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        if args.command == "grant":
            return grant_access(db, args.email, args.reason, args.days or None)
        if args.command == "revoke":
            return revoke_access(db, args.email)
        return list_access(db)
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
