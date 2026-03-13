from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


AccessLevel = Literal["none", "premium"]
SubscriptionState = Literal["inactive", "trialing", "active", "grace_period", "billing_issue", "expired"]


class EntitlementInfo(BaseModel):
    access_level: AccessLevel = "none"
    subscription_state: SubscriptionState = "inactive"
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    current_period_ends_at: Optional[datetime] = None
    product_id: Optional[str] = None
    store: Optional[str] = None
    will_renew: bool = False
    manage_url: Optional[str] = None
    requires_paywall: bool = True


class BillingStatusResponse(BaseModel):
    entitlement: EntitlementInfo


class BillingConfigResponse(BaseModel):
    entitlement_id: str
    offering_id: str
    trial_days: int
    ios_api_key: str
    ios_supported: bool
    products: list[dict]
    paywall: dict


class BillingSyncRequest(BaseModel):
    force: bool = False


class RevenueCatWebhookPayload(BaseModel):
    api_version: Optional[str] = None
    event: dict
