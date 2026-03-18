from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_db
from app.models.user import User
from app.schemas.billing import BillingConfigResponse, BillingStatusResponse, BillingSyncRequest, RevenueCatWebhookPayload
from app.services.billing import build_entitlement_info, get_billing_config, sync_user_entitlement

router = APIRouter()
settings = get_settings()


@router.get("/config", response_model=BillingConfigResponse)
async def billing_config():
    return get_billing_config()


@router.get("/status", response_model=BillingStatusResponse)
async def billing_status(
    current_user: User = Depends(get_current_user),
):
    return BillingStatusResponse(entitlement=build_entitlement_info(current_user))


@router.post("/sync", response_model=BillingStatusResponse)
async def billing_sync(
    body: BillingSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entitlement = await sync_user_entitlement(current_user, force=body.force)
    db.commit()
    db.refresh(current_user)
    return BillingStatusResponse(entitlement=entitlement)


@router.post("/webhook/revenuecat")
async def revenuecat_webhook(
    payload: RevenueCatWebhookPayload,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    expected_auth = (settings.revenuecat_webhook_authorization or "").strip()
    if not expected_auth:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    if not authorization or not hmac.compare_digest(authorization, expected_auth):
        raise HTTPException(status_code=401, detail="Unauthorized webhook")

    event = payload.event or {}
    app_user_id = (
        event.get("app_user_id")
        or event.get("original_app_user_id")
    )
    if not app_user_id:
        return {"received": True}

    user = db.query(User).filter(
        (User.id == app_user_id) | (User.revenuecat_customer_id == app_user_id)
    ).first()
    if not user:
        return {"received": True}

    await sync_user_entitlement(user, force=True)
    db.commit()
    return {"received": True}
