import unittest
from datetime import datetime, timedelta

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
)
from app.models.user import User
from app.config import get_settings
from app.services.billing import build_entitlement_info, update_user_from_subscriber


class BillingServiceTests(unittest.TestCase):
    def test_build_entitlement_marks_expired_periods(self) -> None:
        user = User(
            email="billing@example.com",
            name="Billing User",
            subscription_status="active",
            subscription_current_period_ends_at=datetime.now() - timedelta(days=1),
        )

        entitlement = build_entitlement_info(user)

        self.assertEqual(entitlement.subscription_state, "expired")
        self.assertTrue(entitlement.requires_paywall)
        self.assertEqual(entitlement.access_level, "none")

    def test_sync_from_revenuecat_trial_entitlement(self) -> None:
        user = User(email="trial@example.com", name="Trial User")
        purchase_date = datetime.now() - timedelta(days=1)
        expires_date = datetime.now() + timedelta(days=6)
        entitlement_id = get_settings().revenuecat_entitlement_id
        subscriber = {
          "original_app_user_id": "user-123",
          "management_url": "https://apps.apple.com/account/subscriptions",
          "entitlements": {
            entitlement_id: {
              "product_identifier": "premium_monthly_999",
              "period_type": "TRIAL",
              "purchase_date": purchase_date.isoformat() + "Z",
              "expires_date": expires_date.isoformat() + "Z",
              "store": "app_store",
              "will_renew": True,
            }
          },
          "subscriptions": {
            "premium_monthly_999": {
              "expires_date": expires_date.isoformat() + "Z",
            }
          },
        }

        entitlement = update_user_from_subscriber(user, subscriber)

        self.assertEqual(user.revenuecat_customer_id, "user-123")
        self.assertEqual(user.subscription_status, "trialing")
        self.assertEqual(entitlement.subscription_state, "trialing")
        self.assertEqual(entitlement.product_id, "premium_monthly_999")
        self.assertEqual(entitlement.access_level, "premium")
        self.assertFalse(entitlement.requires_paywall)

    def test_manual_override_grants_premium_without_subscription(self) -> None:
        user = User(
            email="vip@example.com",
            name="VIP User",
            access_override_level="premium_lifetime",
            access_override_reason="founder",
        )

        entitlement = build_entitlement_info(user)

        self.assertEqual(entitlement.access_level, "premium")
        self.assertEqual(entitlement.subscription_state, "active")
        self.assertEqual(entitlement.product_id, "complimentary_access")
        self.assertEqual(entitlement.store, "manual_override")
        self.assertFalse(entitlement.requires_paywall)

    def test_recent_signup_receives_trial_entitlement(self) -> None:
        user = User(
            email="new@example.com",
            name="New User",
            created_at=datetime.now() - timedelta(days=2),
        )

        entitlement = build_entitlement_info(user)

        self.assertEqual(entitlement.access_level, "premium")
        self.assertEqual(entitlement.subscription_state, "trialing")
        self.assertEqual(entitlement.product_id, "frontend_free_trial")
        self.assertEqual(entitlement.store, "promo")
        self.assertFalse(entitlement.requires_paywall)
        self.assertIsNotNone(entitlement.trial_ends_at)


if __name__ == "__main__":
    unittest.main()
