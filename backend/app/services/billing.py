from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Optional
from urllib.parse import quote

import httpx

from app.config import get_settings
from app.models.user import User
from app.schemas.billing import EntitlementInfo

settings = get_settings()

ACTIVE_STATES = {"trialing", "active", "grace_period"}
OVERRIDE_PREMIUM_LEVELS = {"premium", "premium_lifetime", "complimentary"}
FRONTEND_FREE_TRIAL_DAYS = 7


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.utcfromtimestamp(float(value) / 1000.0 if value > 10_000_000_000 else float(value))
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def has_premium_access(state: Optional[str]) -> bool:
    return (state or "").strip().lower() in ACTIVE_STATES


def has_active_access_override(user: User) -> bool:
    level = (user.access_override_level or "").strip().lower()
    if level not in OVERRIDE_PREMIUM_LEVELS:
        return False
    expires_at = _parse_dt(user.access_override_expires_at)
    return not expires_at or expires_at >= _utcnow()


def has_frontend_trial_access(user: User) -> bool:
    created_at = _parse_dt(getattr(user, "created_at", None))
    if not created_at:
        return False
    return (_utcnow() - created_at).total_seconds() <= FRONTEND_FREE_TRIAL_DAYS * 24 * 60 * 60


def build_entitlement_info(user: User) -> EntitlementInfo:
    if has_active_access_override(user):
        expires_at = _parse_dt(user.access_override_expires_at)
        return EntitlementInfo(
            access_level="premium",
            subscription_state="active",
            trial_started_at=None,
            trial_ends_at=None,
            current_period_ends_at=expires_at,
            product_id="complimentary_access",
            store="manual_override",
            will_renew=expires_at is None,
            manage_url=None,
            requires_paywall=False,
        )

    if has_frontend_trial_access(user):
        trial_started_at = _parse_dt(getattr(user, "created_at", None))
        trial_ends_at = trial_started_at + timedelta(days=FRONTEND_FREE_TRIAL_DAYS) if trial_started_at else None
        return EntitlementInfo(
            access_level="premium",
            subscription_state="trialing",
            trial_started_at=trial_started_at,
            trial_ends_at=trial_ends_at,
            current_period_ends_at=trial_ends_at,
            product_id="frontend_free_trial",
            store="promo",
            will_renew=False,
            manage_url=settings.app_store_manage_subscriptions_url,
            requires_paywall=False,
        )

    now = _utcnow()
    state = (user.subscription_status or "inactive").strip().lower()
    current_period_ends_at = _parse_dt(user.subscription_current_period_ends_at)
    trial_ends_at = _parse_dt(user.subscription_trial_ends_at)
    trial_started_at = _parse_dt(user.subscription_trial_started_at)

    if state in ACTIVE_STATES and current_period_ends_at and current_period_ends_at < now:
        state = "expired"
    elif state == "trialing" and trial_ends_at and trial_ends_at < now and (not current_period_ends_at or current_period_ends_at < now):
        state = "expired"
    elif state not in {"inactive", "trialing", "active", "grace_period", "billing_issue", "expired"}:
        state = "inactive"

    manage_url = user.subscription_manage_url or None
    if not manage_url and (user.subscription_store or "").lower() in {"app_store", "appstore", "ios"}:
        manage_url = settings.app_store_manage_subscriptions_url

    access_level = "premium" if has_premium_access(state) else "none"
    return EntitlementInfo(
        access_level=access_level,
        subscription_state=state,  # type: ignore[arg-type]
        trial_started_at=trial_started_at,
        trial_ends_at=trial_ends_at,
        current_period_ends_at=current_period_ends_at,
        product_id=user.subscription_product_id or None,
        store=user.subscription_store or None,
        will_renew=bool(user.subscription_will_renew),
        manage_url=manage_url,
        requires_paywall=access_level != "premium",
    )


def apply_inactive_entitlement(user: User) -> None:
    user.subscription_status = "inactive"
    user.subscription_product_id = None
    user.subscription_store = None
    user.subscription_trial_started_at = None
    user.subscription_trial_ends_at = None
    user.subscription_current_period_ends_at = None
    user.subscription_will_renew = False
    user.subscription_manage_url = settings.app_store_manage_subscriptions_url
    user.subscription_last_synced_at = _utcnow()


def _subscriber_entitlement(subscriber: dict[str, Any]) -> dict[str, Any]:
    entitlements = subscriber.get("entitlements") or {}
    return entitlements.get(settings.revenuecat_entitlement_id) or {}


def _latest_expiration_from_subscriptions(subscriber: dict[str, Any]) -> Optional[datetime]:
    subscriptions = subscriber.get("subscriptions") or {}
    expirations = [_parse_dt(data.get("expires_date")) for data in subscriptions.values()]
    expirations = [dt for dt in expirations if dt is not None]
    return max(expirations) if expirations else None


def _map_subscription_state(entitlement: dict[str, Any], latest_expiration: Optional[datetime]) -> str:
    is_active = bool(entitlement.get("expires_date") or entitlement.get("purchase_date")) and bool(entitlement.get("product_identifier"))
    if entitlement.get("expires_date") is not None:
        is_active = bool(entitlement.get("expires_date"))
    active = bool(entitlement.get("product_identifier")) and bool(entitlement.get("purchase_date"))
    if "expires_date" in entitlement:
        active = True
    entitlement_active = bool(entitlement.get("product_identifier")) and (
        entitlement.get("expires_date") is None or (_parse_dt(entitlement.get("expires_date")) or _utcnow()) >= _utcnow()
    )
    is_active = entitlement_active or bool(entitlement.get("is_active"))

    period_type = (entitlement.get("period_type") or "").strip().upper()
    billing_issue_at = _parse_dt(entitlement.get("billing_issues_detected_at") or entitlement.get("billing_issue_detected_at"))

    if is_active and billing_issue_at:
        return "grace_period"
    if is_active and period_type == "TRIAL":
        return "trialing"
    if is_active:
        return "active"
    if billing_issue_at:
        return "billing_issue"
    if latest_expiration:
        return "expired"
    return "inactive"


def update_user_from_subscriber(user: User, subscriber: dict[str, Any]) -> EntitlementInfo:
    entitlement = _subscriber_entitlement(subscriber)
    latest_expiration = _latest_expiration_from_subscriptions(subscriber)

    user.revenuecat_customer_id = (
        subscriber.get("original_app_user_id")
        or subscriber.get("original_app_userid")
        or subscriber.get("app_user_id")
        or user.revenuecat_customer_id
        or str(user.id)
    )

    if entitlement:
        user.subscription_product_id = entitlement.get("product_identifier") or None
        store = (entitlement.get("store") or "").strip().lower()
        user.subscription_store = store or "app_store"
        user.subscription_status = _map_subscription_state(entitlement, latest_expiration)
        user.subscription_trial_started_at = _parse_dt(entitlement.get("purchase_date")) if (entitlement.get("period_type") or "").upper() == "TRIAL" else user.subscription_trial_started_at
        user.subscription_trial_ends_at = _parse_dt(entitlement.get("expires_date")) if (entitlement.get("period_type") or "").upper() == "TRIAL" else None
        user.subscription_current_period_ends_at = _parse_dt(entitlement.get("expires_date")) or latest_expiration
        user.subscription_will_renew = bool(entitlement.get("will_renew"))
    else:
        apply_inactive_entitlement(user)
        if latest_expiration is not None:
            user.subscription_status = "expired"
            user.subscription_current_period_ends_at = latest_expiration

    management_url = subscriber.get("management_url")
    if management_url:
        user.subscription_manage_url = management_url
    elif not user.subscription_manage_url:
        user.subscription_manage_url = settings.app_store_manage_subscriptions_url

    user.subscription_last_synced_at = _utcnow()
    return build_entitlement_info(user)


async def fetch_revenuecat_subscriber(app_user_id: str) -> Optional[dict[str, Any]]:
    if not settings.revenuecat_secret_api_key:
        return None

    encoded_user_id = quote(app_user_id, safe="")
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{settings.revenuecat_api_base_url.rstrip('/')}/subscribers/{encoded_user_id}",
            headers={
                "Authorization": f"Bearer {settings.revenuecat_secret_api_key}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        payload = response.json()
    return payload.get("subscriber") or {}


async def sync_user_entitlement(user: User, force: bool = False) -> EntitlementInfo:
    if has_active_access_override(user):
        return build_entitlement_info(user)

    last_synced = _parse_dt(user.subscription_last_synced_at)
    if not force and last_synced and (_utcnow() - last_synced).total_seconds() < 30:
        return build_entitlement_info(user)

    subscriber = await fetch_revenuecat_subscriber(user.revenuecat_customer_id or str(user.id))
    if subscriber is None:
        return build_entitlement_info(user)
    return update_user_from_subscriber(user, subscriber)


def get_billing_config() -> dict[str, Any]:
    annual_price = "$49.99"
    monthly_price = "$9.99"
    return {
        "entitlement_id": settings.revenuecat_entitlement_id,
        "offering_id": settings.revenuecat_offering_id,
        "trial_days": settings.revenuecat_trial_days,
        "ios_api_key": settings.revenuecat_ios_api_key,
        "ios_supported": bool(settings.revenuecat_ios_api_key),
        "products": [
            {
                "product_id": settings.revenuecat_monthly_product_id,
                "package_type": "monthly",
                "display_price": monthly_price,
                "trial_days": settings.revenuecat_trial_days,
                "highlight": False,
            },
            {
                "product_id": settings.revenuecat_annual_product_id,
                "package_type": "yearly",
                "display_price": annual_price,
                "trial_days": settings.revenuecat_trial_days,
                "highlight": True,
                "badge": "Best value",
            },
            {
                "product_id": settings.revenuecat_lifetime_product_id,
                "package_type": "lifetime",
                "display_price": "$149.99",
                "trial_days": 0,
                "highlight": False,
                "badge": "One-time",
            },
        ],
        "paywall": {
            "title": "Start your 7-day free trial",
            "subtitle": "Unlock the full app after onboarding with an iOS subscription.",
            "legal_copy": f"Free for {settings.revenuecat_trial_days} days, then auto-renews unless canceled at least 24 hours before renewal.",
            "annual_savings_copy": "Save over 58% with annual billing.",
            "customer_center_enabled": True,
        },
    }
