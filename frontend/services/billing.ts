import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import {
  APP_ENV,
  APP_STORE_MANAGE_SUBSCRIPTIONS_URL,
  PREMIUM_ENTITLEMENT_ID,
  REVENUECAT_IOS_API_KEY,
} from '../constants/Config';
import { UserEntitlement, getDefaultEntitlement } from '../stores/authStore';

let configuredAppUserId: string | null = null;
let customerInfoListener: ((customerInfo: CustomerInfo) => void) | null = null;

export type BillingPurchaseOutcome = {
  entitlement: UserEntitlement;
  customerInfo: CustomerInfo | null;
  purchased: boolean;
  restored: boolean;
  cancelled: boolean;
};

function isRevenueCatSupportedPlatform(): boolean {
  return Platform.OS === 'ios';
}

function isTestRevenueCatKey(apiKey: string): boolean {
  return apiKey.trim().startsWith('test_');
}

function isRevenueCatEnabled(): boolean {
  if (!isRevenueCatSupportedPlatform() || !REVENUECAT_IOS_API_KEY) {
    return false;
  }

  // Prevent production/TestFlight builds from bootstrapping RevenueCat with a
  // test placeholder key. Internal QA can still use preview/internal builds.
  if (APP_ENV === 'production' && isTestRevenueCatKey(REVENUECAT_IOS_API_KEY)) {
    return false;
  }

  return true;
}

function billingUnavailableError(): Error {
  return new Error('RevenueCat billing is not configured for this build.');
}

function normalizeRevenueCatError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string' && error.trim()) return new Error(error);
  return new Error(fallback);
}

function isCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return Boolean((error as { userCancelled?: boolean }).userCancelled);
}

function toEntitlement(customerInfo: CustomerInfo): UserEntitlement {
  const premium =
    customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]
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
  if (!isRevenueCatEnabled()) {
    return false;
  }

  const isConfigured = await Purchases.isConfigured();
  if (!isConfigured) {
    await Purchases.setLogLevel(APP_ENV === 'production' ? LOG_LEVEL.INFO : LOG_LEVEL.DEBUG);
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

async function requireConfigured(): Promise<void> {
  if (!isRevenueCatEnabled()) {
    throw billingUnavailableError();
  }
  const isConfigured = await Purchases.isConfigured();
  if (!isConfigured) {
    throw new Error('RevenueCat is not configured yet. Call billingService.bootstrap() first.');
  }
}

async function buildPurchaseOutcome(
  customerInfo: CustomerInfo | null,
  flags?: Partial<BillingPurchaseOutcome>,
): Promise<BillingPurchaseOutcome> {
  const info = customerInfo ?? (await Purchases.getCustomerInfo());
  return {
    entitlement: toEntitlement(info),
    customerInfo: info,
    purchased: Boolean(flags?.purchased),
    restored: Boolean(flags?.restored),
    cancelled: Boolean(flags?.cancelled),
  };
}

function paywallResultToFlags(result: PAYWALL_RESULT): Partial<BillingPurchaseOutcome> {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return { purchased: true };
    case PAYWALL_RESULT.RESTORED:
      return { restored: true };
    case PAYWALL_RESULT.CANCELLED:
      return { cancelled: true };
    default:
      return {};
  }
}

export const billingService = {
  isSupported(): boolean {
    return isRevenueCatSupportedPlatform();
  },

  isConfiguredForBuild(): boolean {
    return isRevenueCatEnabled();
  },

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
    await requireConfigured();
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!isRevenueCatEnabled()) return null;
    await requireConfigured();
    return Purchases.getCustomerInfo();
  },

  async getCustomerEntitlement(): Promise<UserEntitlement> {
    if (!isRevenueCatEnabled()) {
      return getDefaultEntitlement();
    }
    return toEntitlement(await Purchases.getCustomerInfo());
  },

  async purchasePackage(aPackage: PurchasesPackage): Promise<UserEntitlement> {
    await requireConfigured();
    const result = await Purchases.purchasePackage(aPackage);
    return toEntitlement(result.customerInfo);
  },

  async restorePurchases(): Promise<UserEntitlement> {
    await requireConfigured();
    return toEntitlement(await Purchases.restorePurchases());
  },

  async presentPaywall(offering?: PurchasesOffering | null): Promise<BillingPurchaseOutcome> {
    await requireConfigured();
    try {
      const result = await RevenueCatUI.presentPaywall(offering ? { offering } : undefined);
      return buildPurchaseOutcome(null, paywallResultToFlags(result));
    } catch (error) {
      throw normalizeRevenueCatError(error, 'Unable to present RevenueCat paywall.');
    }
  },

  async presentPaywallIfNeeded(offering?: PurchasesOffering | null): Promise<BillingPurchaseOutcome> {
    await requireConfigured();
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT_ID,
        ...(offering ? { offering } : {}),
      });
      return buildPurchaseOutcome(null, paywallResultToFlags(result));
    } catch (error) {
      throw normalizeRevenueCatError(error, 'Unable to present RevenueCat paywall.');
    }
  },

  async presentCustomerCenter(): Promise<void> {
    await requireConfigured();
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
      throw normalizeRevenueCatError(error, 'Unable to present RevenueCat Customer Center.');
    }
  },

  async getManageSubscriptionsUrl(): Promise<string> {
    if (!isRevenueCatEnabled()) {
      return APP_STORE_MANAGE_SUBSCRIPTIONS_URL;
    }
    return (await Purchases.getCustomerInfo()).managementURL || APP_STORE_MANAGE_SUBSCRIPTIONS_URL;
  },

  async syncEntitlementFromCustomerInfo(): Promise<UserEntitlement> {
    if (!isRevenueCatEnabled()) {
      return getDefaultEntitlement();
    }
    return toEntitlement(await Purchases.getCustomerInfo());
  },

  addCustomerInfoListener(listener: (entitlement: UserEntitlement) => void) {
    if (!isRevenueCatEnabled()) return () => {};
    customerInfoListener = (customerInfo) => listener(toEntitlement(customerInfo));
    Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    return () => {
      if (customerInfoListener) {
        Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
        customerInfoListener = null;
      }
    };
  },

  isUserCancelledPurchase(error: unknown): boolean {
    return isCancelledError(error);
  },
};
