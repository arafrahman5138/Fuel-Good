import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { APP_STORE_MANAGE_SUBSCRIPTIONS_URL, PREMIUM_ENTITLEMENT_ID, REVENUECAT_IOS_API_KEY } from '../constants/Config';
import { UserEntitlement, getDefaultEntitlement } from '../stores/authStore';

let configuredAppUserId: string | null = null;
let customerInfoListener: ((customerInfo: CustomerInfo) => void) | null = null;

function toEntitlement(customerInfo: CustomerInfo): UserEntitlement {
  const premium = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]
    || customerInfo.entitlements.all[PREMIUM_ENTITLEMENT_ID];
  if (!premium) {
    return {
      ...getDefaultEntitlement(),
      manage_url: customerInfo.managementURL || APP_STORE_MANAGE_SUBSCRIPTIONS_URL,
      current_period_ends_at: customerInfo.latestExpirationDate || null,
      subscription_state: customerInfo.latestExpirationDate ? 'expired' : 'inactive',
    };
  }

  const hasBillingIssue = Boolean(premium.billingIssueDetectedAt);
  const isTrial = premium.periodType === 'TRIAL';
  const subscriptionState =
    premium.isActive && hasBillingIssue
      ? 'grace_period'
      : premium.isActive && isTrial
        ? 'trialing'
        : premium.isActive
          ? 'active'
          : hasBillingIssue
            ? 'billing_issue'
            : premium.expirationDate
              ? 'expired'
              : 'inactive';

  return {
    access_level: ['trialing', 'active', 'grace_period'].includes(subscriptionState) ? 'premium' : 'none',
    subscription_state: subscriptionState,
    trial_started_at: isTrial ? premium.latestPurchaseDate : null,
    trial_ends_at: isTrial ? premium.expirationDate : null,
    current_period_ends_at: premium.expirationDate || customerInfo.latestExpirationDate || null,
    product_id: premium.productIdentifier || null,
    store: premium.store || null,
    will_renew: premium.willRenew,
    manage_url: customerInfo.managementURL || APP_STORE_MANAGE_SUBSCRIPTIONS_URL,
    requires_paywall: !premium.isActive,
  };
}

async function ensureConfigured(appUserId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !REVENUECAT_IOS_API_KEY) {
    return false;
  }

  const isConfigured = await Purchases.isConfigured();
  if (!isConfigured) {
    await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({
      apiKey: REVENUECAT_IOS_API_KEY,
      appUserID: appUserId,
    });
    configuredAppUserId = appUserId;
    return true;
  }

  if (configuredAppUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
  }
  return true;
}

export const billingService = {
  async bootstrap(appUserId: string, email?: string, name?: string): Promise<void> {
    const enabled = await ensureConfigured(appUserId);
    if (!enabled) return;
    const attributes: Record<string, string> = {};
    if (email) attributes.email = email;
    if (name) attributes.displayName = name;
    if (Object.keys(attributes).length > 0) {
      await Purchases.setAttributes(attributes);
    }
  },

  async getOfferings(): Promise<PurchasesOffering | null> {
    if (Platform.OS !== 'ios' || !REVENUECAT_IOS_API_KEY) return null;
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  },

  async getCustomerEntitlement(): Promise<UserEntitlement> {
    if (Platform.OS !== 'ios' || !REVENUECAT_IOS_API_KEY) {
      return getDefaultEntitlement();
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return toEntitlement(customerInfo);
  },

  async purchasePackage(aPackage: PurchasesPackage): Promise<UserEntitlement> {
    const result = await Purchases.purchasePackage(aPackage);
    return toEntitlement(result.customerInfo);
  },

  async restorePurchases(): Promise<UserEntitlement> {
    const customerInfo = await Purchases.restorePurchases();
    return toEntitlement(customerInfo);
  },

  async getManageSubscriptionsUrl(): Promise<string> {
    if (Platform.OS !== 'ios' || !REVENUECAT_IOS_API_KEY) {
      return APP_STORE_MANAGE_SUBSCRIPTIONS_URL;
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.managementURL || APP_STORE_MANAGE_SUBSCRIPTIONS_URL;
  },

  addCustomerInfoListener(listener: (entitlement: UserEntitlement) => void) {
    if (Platform.OS !== 'ios' || !REVENUECAT_IOS_API_KEY) return () => {};
    customerInfoListener = (customerInfo) => listener(toEntitlement(customerInfo));
    Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    return () => {
      if (customerInfoListener) {
        Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
        customerInfoListener = null;
      }
    };
  },
};
