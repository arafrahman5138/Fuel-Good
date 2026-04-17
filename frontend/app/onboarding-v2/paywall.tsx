import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';
import { billingService } from '../../services/billing';
import { authApi, billingApi, metabolicApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

type PlanChoice = 'annual' | 'weekly';

const LOSS_AVERSION_MESSAGES: Record<number, string> = {
  0: "Without Fuel Good, you won't know what's really in your food.",
  1: "You'll lose your personalized meal plan and scanner access.",
};

const FEATURES = [
  { icon: 'scan-outline' as const, label: 'Scan any food \u2014 instant Fuel Score' },
  { icon: 'calendar-outline' as const, label: 'Weekly meal plans \u2014 all Fuel 100' },
  { icon: 'ticket-outline' as const, label: 'Earn flex meals \u2014 guilt-free cheat days' },
  { icon: 'sparkles-outline' as const, label: 'AI-powered Healthify \u2014 transform any craving' },
  { icon: 'analytics-outline' as const, label: 'Track progress \u2014 scores, streaks, quests' },
];

// R17 fix (Month-1 target-user feedback): retire the dismissal-ladder pricing
// that dropped from $59.99 → $29.99 → $11.99 as the user dismissed the paywall.
// That pattern is (a) dark-pattern-adjacent — Noom was hit with a $56M class-
// action over similar auto-renewal/pricing opacity; (b) internally inconsistent
// with the $9.99/mo + $49.99/yr the subscribe screen fetches from /billing/config;
// (c) erodes trust, which is the single most valuable brand asset in wellness.
// We now show ONE headline and fetch the canonical product prices from the
// backend. If the API fails, we fall back to documented defaults so onboarding
// is never blocked.

type PricingView = {
  monthlyDisplayPrice: string;   // e.g. "$9.99"
  annualDisplayPrice: string;     // e.g. "$59.99"
  annualMonthlyEquivalent: string;  // e.g. "$5/month"
  savingsCopy: string;             // e.g. "Save over 58% with annual billing."
};

const PRICING_FALLBACK: PricingView = {
  monthlyDisplayPrice: '$9.99',
  annualDisplayPrice: '$59.99',
  annualMonthlyEquivalent: '$5/month',
  savingsCopy: 'Save over 58% with annual billing.',
};

function getHeadline(): string {
  return 'Start fueling good';
}

// R17: derive a monthly-equivalent string from an annual display price like
// "$59.99" → "$5/month". Safe against missing/malformed input — returns ''
// so the caller can fall back to PRICING_FALLBACK.
function deriveMonthlyEquivalent(annualDisplayPrice: string | undefined): string {
  if (!annualDisplayPrice) return '';
  const match = annualDisplayPrice.match(/[\d,.]+/);
  if (!match) return '';
  const amount = parseFloat(match[0].replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0) return '';
  const monthly = amount / 12;
  // Round to nearest whole dollar when annual is a clean round price, else .50
  const rounded = monthly < 1 ? Math.round(monthly * 100) / 100 : Math.round(monthly);
  return `$${rounded}/month`;
}

export default function PaywallScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { paywallDismissCount, incrementPaywallDismiss } = useOnboardingState();
  const state = useOnboardingState();
  const setUser = useAuthStore((s) => s.setUser);

  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>('annual');
  const [isLoading, setIsLoading] = useState(false);
  const [showLossMessage, setShowLossMessage] = useState(false);
  // R17: pricing is fetched from /api/billing/config so onboarding matches
  // what the subscribe screen + StoreKit/RevenueCat will actually charge.
  const [pricing, setPricing] = useState<PricingView>(PRICING_FALLBACK);

  const lossFade = useRef(new Animated.Value(0)).current;

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const ctaScale = useRef(new Animated.Value(0.97)).current;

  const headline = getHeadline();

  // R17: fetch canonical pricing once on mount. Derives annual-as-monthly for
  // the subline copy that used to be hardcoded "$5/month".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await billingApi.getConfig();
        const products = Array.isArray(config?.products) ? config.products : [];
        const monthly = products.find((p: any) =>
          p.package_type === 'monthly' || p.product_id === 'monthly'
        );
        const annual = products.find((p: any) =>
          p.package_type === 'yearly' || p.product_id === 'yearly'
        );
        if (cancelled) return;
        const next: PricingView = {
          monthlyDisplayPrice: monthly?.display_price || PRICING_FALLBACK.monthlyDisplayPrice,
          annualDisplayPrice: annual?.display_price || PRICING_FALLBACK.annualDisplayPrice,
          annualMonthlyEquivalent: deriveMonthlyEquivalent(annual?.display_price)
            || PRICING_FALLBACK.annualMonthlyEquivalent,
          savingsCopy: config?.paywall?.annual_savings_copy || PRICING_FALLBACK.savingsCopy,
        };
        setPricing(next);
      } catch {
        // keep fallback — onboarding must never block on a billing fetch
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    analytics.trackScreenView(12, 'paywall');
    analytics.trackEvent('onboarding_paywall_viewed', { dismiss_count: paywallDismissCount });

    fadeIn.setValue(0);
    slideUp.setValue(30);
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    // Subtle CTA pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(ctaScale, { toValue: 0.97, duration: 1500, useNativeDriver: true }),
      ]),
    ).start();

    return () => analytics.trackScreenExit(12);
  }, [paywallDismissCount]);

  const saveAndNavigate = async () => {
    try {
      // Save default preferences so onboarding gate passes
      await authApi.updatePreferences({
        dietary_preferences: ['none'],
        flavor_preferences: ['savory'],
      });

      // Save metabolic profile from onboarding state
      const ageMap: Record<string, number> = {
        '18-24': 21,
        '25-34': 30,
        '35-44': 40,
        '45-54': 50,
        '55+': 60,
      };
      const goalMap: Record<string, string> = {
        energy: 'maintenance',
        weight: 'fat_loss',
        muscle: 'muscle_gain',
        cleaner: 'maintenance',
      };

      if (state.weight && state.height) {
        await metabolicApi.saveProfile({
          weight_lb: state.weight,
          height_ft: Math.floor(state.height / 12),
          height_in: state.height % 12,
          age: ageMap[state.ageRange] || 30,
          sex: state.sex || 'male',
          activity_level: state.activityLevel || 'moderate',
          goal: goalMap[state.primaryGoal || 'energy'] || 'maintenance',
        });
      }

      // Refresh user in auth store
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (err) {
      // Non-blocking — don't prevent navigation
      console.warn('Paywall save error:', err);
    }

    state.setCompletedAt(new Date());
    router.replace('/(tabs)' as any);
  };

  const handlePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    analytics.trackEvent('onboarding_trial_started', { plan: selectedPlan, dismiss_count: paywallDismissCount });

    try {
      const outcome = await billingService.presentPaywallIfNeeded();
      if (outcome?.entitlement?.access_level === 'premium') {
        await saveAndNavigate();
        return;
      }
    } catch (err) {
      // Billing not configured or user cancelled — fall through
      if (!billingService.isUserCancelledPurchase(err)) {
        console.warn('Billing error:', err);
      }
    }

    setIsLoading(false);
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);

    try {
      const entitlement = await billingService.restorePurchases();
      if (entitlement?.access_level === 'premium') {
        await saveAndNavigate();
        return;
      }
      Alert.alert('No purchases found', 'We couldn\u2019t find any previous purchases to restore.');
    } catch (err) {
      Alert.alert('Restore failed', 'Please try again later.');
    }

    setIsLoading(false);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.trackEvent('onboarding_paywall_dismissed', { dismiss_count: paywallDismissCount });

    // Show loss aversion message briefly before escalating discount
    const lossMessage = LOSS_AVERSION_MESSAGES[paywallDismissCount];
    if (lossMessage && !showLossMessage) {
      setShowLossMessage(true);
      lossFade.setValue(0);
      Animated.timing(lossFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();

      setTimeout(() => {
        Animated.timing(lossFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowLossMessage(false);
          incrementPaywallDismiss();
        });
      }, 2500);
      return;
    }

    incrementPaywallDismiss();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Dismiss X */}
      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.7}>
        <Ionicons name="close" size={22} color="#6B7280" />
      </TouchableOpacity>

      {/* Loss aversion overlay */}
      {showLossMessage && (
        <Animated.View style={[styles.lossOverlay, { opacity: lossFade }]}>
          <View style={styles.lossCard}>
            <Ionicons name="warning-outline" size={24} color="#F59E0B" style={{ marginBottom: 8 }} />
            <Text style={styles.lossText}>
              {LOSS_AVERSION_MESSAGES[paywallDismissCount]}
            </Text>
          </View>
        </Animated.View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          {/* Headline */}
          <Text style={styles.headline}>{headline}</Text>

          {/* R17: removed urgency text + scarecrow free-tier branch. A user
              who dismisses the paywall twice used to see a "limited features —
              3 scans/week, no meal plans" scarecrow with a discounted $11.99
              price that wasn't honored elsewhere. That was a dark-pattern
              funnel (shame → discount → price inconsistency). Now we show one
              honest paywall at one honest price, every time. */}

          {/* Free tier view (3rd paywall) — REMOVED by R17 */}
          {false ? (
            <>
              <Text style={styles.freeTierSubtext}>
                Limited features — 3 scans/week, no meal plans.
              </Text>

              <View style={styles.featureList}>
                {FEATURES.map((feature, i) => {
                  const isLocked = i >= 1; // Only scanning is free
                  return (
                    <View key={feature.label} style={[styles.featureRow, isLocked && { opacity: 0.4 }]}>
                      <View style={[styles.featureIconCircle, isLocked && { backgroundColor: 'rgba(107, 114, 128, 0.08)' }]}>
                        <Ionicons name={isLocked ? 'lock-closed-outline' : feature.icon} size={18} color={isLocked ? '#6B7280' : '#22C55E'} />
                      </View>
                      <Text style={styles.featureText}>{feature.label}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Upgrade nudge */}
              <View style={styles.upgradeNudge}>
                <Text style={styles.upgradeNudgeText}>
                  Or unlock everything for just <Text style={{ color: '#22C55E', fontWeight: '700' }}>$11.99/year</Text>
                </Text>
              </View>

              {/* Price card for upgrade option */}
              <View style={styles.priceCards}>
                <TouchableOpacity
                  style={[styles.priceCard, styles.priceCardSelected]}
                  activeOpacity={0.8}
                >
                  <View style={styles.priceCardContent}>
                    <View style={styles.radioOuter}>
                      <View style={styles.radioInner} />
                    </View>
                    <View style={styles.priceInfo}>
                      <View style={styles.priceRow}>
                        <Text style={styles.originalPrice}>$59.99</Text>
                        <Text style={styles.currentPrice}>$11.99/year</Text>
                      </View>
                      <Text style={styles.priceSubtext}>Less than $1/month</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Feature list */}
              <View style={styles.featureList}>
                {FEATURES.map((feature) => (
                  <View key={feature.label} style={styles.featureRow}>
                    <View style={styles.featureIconCircle}>
                      <Ionicons name={feature.icon} size={18} color="#22C55E" />
                    </View>
                    <Text style={styles.featureText}>{feature.label}</Text>
                  </View>
                ))}
              </View>

              {/* Price cards */}
              <View style={styles.priceCards}>
                {/* Annual */}
                <TouchableOpacity
                  style={[styles.priceCard, selectedPlan === 'annual' && styles.priceCardSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPlan('annual')}
                >
                  {paywallDismissCount === 0 && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>Best value</Text>
                    </View>
                  )}
                  <View style={styles.priceCardContent}>
                    <View style={styles.radioOuter}>
                      {selectedPlan === 'annual' && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.priceInfo}>
                      <View style={styles.priceRow}>
                        <Text style={styles.currentPrice}>
                          {pricing.annualDisplayPrice}/year
                        </Text>
                      </View>
                      <Text style={styles.priceSubtext}>
                        {pricing.annualMonthlyEquivalent} · {pricing.savingsCopy}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* R17: replaced hardcoded $4.99/week with the canonical
                    monthly price from /billing/config. */}
                <TouchableOpacity
                  style={[styles.priceCard, selectedPlan === 'weekly' && styles.priceCardSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPlan('weekly')}
                >
                  <View style={styles.priceCardContent}>
                    <View style={styles.radioOuter}>
                      {selectedPlan === 'weekly' && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.priceInfo}>
                      <Text style={styles.currentPrice}>
                        {pricing.monthlyDisplayPrice}/month
                      </Text>
                      <Text style={styles.priceSubtext}>Billed monthly</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePurchase}
            disabled={isLoading}
          >
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  {/* R17: single CTA, no tier-gated discount text. */}
                  <Text style={styles.ctaText}>Try Free for 7 Days</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* R17: reassurance always shown; scarecrow "continue with free plan"
            button that only appeared after 2 dismisses is removed. Dismiss is
            still possible via the back/skip gesture and still increments the
            counter for analytics, but the UI no longer changes based on it. */}
        <Text style={styles.reassuranceText}>Cancel anytime. No charge until day 8.</Text>

        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={styles.restoreButton}>
          <Text style={styles.restoreText}>Restore purchases</Text>
        </TouchableOpacity>

        <View style={styles.progressWrapper}>
          <OnboardingProgress total={12} current={11} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  dismissButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lossOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lossCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  lossText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 36,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 8,
  },

  // Free tier
  freeTierSubtext: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  upgradeNudge: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  upgradeNudgeText: {
    fontSize: 15,
    color: '#E5E7EB',
    textAlign: 'center',
    fontWeight: '500',
  },
  continueFreeButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  continueFreeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  reassuranceText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },

  // Features
  featureList: {
    marginTop: 28,
    marginBottom: 28,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: '#E5E7EB',
    lineHeight: 20,
  },

  // Price cards
  priceCards: {
    gap: 10,
  },
  priceCard: {
    backgroundColor: '#151515',
    borderWidth: 1.5,
    borderColor: '#252525',
    borderRadius: 16,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  priceCardSelected: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.04)',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
  },
  priceInfo: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 15,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 20,
    gap: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  restoreText: {
    fontSize: 13,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  progressWrapper: {
    alignItems: 'center',
    paddingBottom: 8,
  },
});
