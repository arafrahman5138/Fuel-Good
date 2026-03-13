import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { ScreenContainer } from '../components/ScreenContainer';
import { Button } from '../components/Button';
import { useTheme } from '../hooks/useTheme';
import { billingApi } from '../services/api';
import { billingService } from '../services/billing';
import { useAuthStore } from '../stores/authStore';
import { APP_STORE_MANAGE_SUBSCRIPTIONS_URL, PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL, TERMS_URL } from '../constants/Config';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

interface BillingConfig {
  entitlement_id: string;
  offering_id: string;
  trial_days: number;
  ios_api_key: string;
  ios_supported: boolean;
  products: Array<{
    product_id: string;
    package_type: string;
    display_price: string;
    trial_days: number;
    highlight?: boolean;
    badge?: string;
  }>;
  paywall: {
    title: string;
    subtitle: string;
    legal_copy: string;
    annual_savings_copy?: string;
  };
}

export default function SubscribeScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setEntitlement = useAuthStore((s) => s.setEntitlement);
  const hasPremiumAccess = useAuthStore((s) => s.hasPremiumAccess);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const userHasDirectPremium = user?.entitlement?.access_level === 'premium' && user?.entitlement?.requires_paywall === false;

  useEffect(() => {
    if (hasPremiumAccess || userHasDirectPremium) {
      router.replace('/(tabs)' as any);
    }
  }, [hasPremiumAccess, userHasDirectPremium]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const [billingConfig, currentOffering] = await Promise.all([
          billingApi.getConfig(),
          billingService.bootstrap(user.id, user.email, user.name).then(() => billingService.getOfferings()),
        ]);
        if (!active) return;
        setConfig(billingConfig);
        setOffering(currentOffering);
      } catch (err: any) {
        if (active) {
          Alert.alert('Billing unavailable', err?.message || 'Unable to load subscription options right now.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const packageMap = useMemo(() => {
    const allPackages = offering?.availablePackages || [];
    const map = new Map<string, PurchasesPackage>();
    for (const pkg of allPackages) {
      map.set(pkg.product.identifier, pkg);
    }
    return map;
  }, [offering]);

  const handlePurchase = async (productId: string) => {
    const selected = packageMap.get(productId);
    if (!selected) {
      Alert.alert('Unavailable', 'This subscription option is not available in the current offering.');
      return;
    }

    try {
      setPurchasingId(productId);
      const entitlement = await billingService.purchasePackage(selected);
      setEntitlement(entitlement);
      const synced = await billingApi.sync(true).catch(() => null);
      if (synced?.entitlement) {
        setEntitlement(synced.entitlement);
      }
      router.replace('/(tabs)' as any);
    } catch (err: any) {
      if (!err?.userCancelled) {
        Alert.alert('Purchase failed', err?.message || 'We could not complete the subscription purchase.');
      }
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const entitlement = await billingService.restorePurchases();
      setEntitlement(entitlement);
      const synced = await billingApi.sync(true).catch(() => null);
      if (synced?.entitlement) {
        setEntitlement(synced.entitlement);
      }
      if (entitlement.access_level === 'premium') {
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('No active subscription', 'We did not find an active subscription to restore.');
      }
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message || 'We could not restore purchases right now.');
    } finally {
      setRestoring(false);
    }
  };

  const openUrl = async (url?: string) => {
    if (!url) return;
    await Linking.openURL(url);
  };

  const openSupport = async () => {
    if (SUPPORT_URL) {
      await Linking.openURL(SUPPORT_URL);
      return;
    }
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const products = config?.products || [];
  const billingSupported = Platform.OS === 'ios' && Boolean(config?.ios_supported);

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#14532D', '#0F766E', '#0F172A']} style={styles.hero}>
          <Text style={styles.kicker}>Premium Access</Text>
          <Text style={styles.title}>{config?.paywall.title || 'Start your 7-day free trial'}</Text>
          <Text style={styles.subtitle}>
            {config?.paywall.subtitle || 'Unlock the full app with monthly or annual iOS billing.'}
          </Text>
          <View style={styles.featureList}>
            {[
              'Full access to chat, scans, meal plans, browse, and tracking',
              '7-day free trial before billing starts',
              'Cancel anytime in App Store subscriptions',
            ].map((item) => (
              <View key={item} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#86EFAC" />
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {products.map((product) => {
            const rcPackage = packageMap.get(product.product_id);
            const displayPrice = rcPackage?.product.priceString || product.display_price;
            const cadence = product.package_type === 'annual' ? 'per year' : 'per month';
            const isBusy = purchasingId === product.product_id;
            return (
              <View
                key={product.product_id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: product.highlight ? theme.primary : theme.border,
                  },
                ]}
              >
                <View style={styles.planTopRow}>
                  <View>
                    <Text style={[styles.planName, { color: theme.text }]}>
                      {product.package_type === 'annual' ? 'Annual' : 'Monthly'}
                    </Text>
                    <Text style={[styles.planPrice, { color: theme.text }]}>
                      {displayPrice} <Text style={[styles.planCadence, { color: theme.textSecondary }]}>{cadence}</Text>
                    </Text>
                  </View>
                  {product.badge ? (
                    <View style={[styles.badge, { backgroundColor: theme.primaryMuted }]}>
                      <Text style={[styles.badgeText, { color: theme.primary }]}>{product.badge}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.planTrial, { color: theme.textSecondary }]}>
                  7 days free, then {displayPrice} {product.package_type === 'annual' ? 'yearly' : 'monthly'}.
                </Text>
                {product.package_type === 'annual' && config?.paywall?.annual_savings_copy ? (
                  <Text style={[styles.savingsCopy, { color: theme.primary }]}>{config.paywall.annual_savings_copy}</Text>
                ) : null}

                <Button
                  title={billingSupported ? `Start ${product.package_type === 'annual' ? 'Annual' : 'Monthly'} Trial` : 'Unavailable'}
                  onPress={() => handlePurchase(product.product_id)}
                  disabled={!billingSupported || !rcPackage || isBusy}
                  loading={isBusy}
                  fullWidth
                  size="lg"
                />
              </View>
            );
          })}

          <Text style={[styles.legalCopy, { color: theme.textTertiary }]}>
            {config?.paywall.legal_copy}
          </Text>

          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.8}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.secondaryActionText, { color: theme.text }]}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            onPress={() => openUrl(user?.entitlement?.manage_url || APP_STORE_MANAGE_SUBSCRIPTIONS_URL)}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryActionText, { color: theme.text }]}>Manage Subscription</Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => openUrl(TERMS_URL)}><Text style={[styles.linkText, { color: theme.textSecondary }]}>Terms</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openUrl(PRIVACY_POLICY_URL)}><Text style={[styles.linkText, { color: theme.textSecondary }]}>Privacy</Text></TouchableOpacity>
            <TouchableOpacity onPress={openSupport}><Text style={[styles.linkText, { color: theme.textSecondary }]}>Support</Text></TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              logout();
              router.replace('/(auth)/login' as any);
            }}
            style={{ marginTop: Spacing.lg, alignSelf: 'center' }}
          >
            <Text style={[styles.linkText, { color: theme.textTertiary }]}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.huge,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingTop: 92,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.md,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  featureList: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    color: '#F8FAFC',
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  planCard: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  planName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  planPrice: {
    marginTop: Spacing.xs,
    fontSize: 28,
    fontWeight: '800',
  },
  planCadence: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  planTrial: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  savingsCopy: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  legalCopy: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  secondaryAction: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  linkRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  linkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
