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
import { authApi, metabolicApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

type PlanChoice = 'annual' | 'weekly';

const FEATURES = [
  { icon: 'scan-outline' as const, label: 'Scan any food \u2014 instant Fuel Score' },
  { icon: 'calendar-outline' as const, label: 'Weekly meal plans \u2014 all Fuel 100' },
  { icon: 'ticket-outline' as const, label: 'Earn flex meals \u2014 guilt-free cheat days' },
  { icon: 'sparkles-outline' as const, label: 'AI-powered Healthify \u2014 transform any craving' },
  { icon: 'analytics-outline' as const, label: 'Track progress \u2014 scores, streaks, quests' },
];

function getHeadline(dismissCount: number): string {
  if (dismissCount === 0) return 'Start fueling good';
  if (dismissCount === 1) return 'Wait \u2014 here\u2019s 50% off to get started.';
  return 'Okay, final offer. 80% off \u2014 just for you.';
}

function getAnnualPrice(dismissCount: number): { original: string; current: string; monthly: string } {
  if (dismissCount === 0) return { original: '', current: '$59.99/year', monthly: '$5/month' };
  if (dismissCount === 1) return { original: '$59.99', current: '$29.99/year', monthly: '$2.50/month' };
  return { original: '$59.99', current: '$11.99/year', monthly: 'Less than $1/month' };
}

export default function PaywallScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { paywallDismissCount, incrementPaywallDismiss } = useOnboardingState();
  const state = useOnboardingState();
  const setUser = useAuthStore((s) => s.setUser);

  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>('annual');
  const [isLoading, setIsLoading] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const ctaScale = useRef(new Animated.Value(0.97)).current;

  const pricing = getAnnualPrice(paywallDismissCount);
  const headline = getHeadline(paywallDismissCount);

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
    router.replace('/(tabs)');
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

    if (paywallDismissCount >= 2) {
      // Free tier entry
      saveAndNavigate();
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          {/* Headline */}
          <Text style={styles.headline}>{headline}</Text>

          {/* Urgency text for discounts */}
          {paywallDismissCount === 1 && (
            <Text style={styles.urgencyText}>This offer won't appear again</Text>
          )}
          {paywallDismissCount === 2 && (
            <Text style={styles.urgencyText}>That's less than $1/month</Text>
          )}

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
                    {pricing.original !== '' && (
                      <Text style={styles.originalPrice}>{pricing.original}</Text>
                    )}
                    <Text style={styles.currentPrice}>{pricing.current}</Text>
                  </View>
                  <Text style={styles.priceSubtext}>{pricing.monthly}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Weekly */}
            {paywallDismissCount === 0 && (
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
                    <Text style={styles.currentPrice}>$4.99/week</Text>
                    <Text style={styles.priceSubtext}>Billed weekly</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
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
                  <Text style={styles.ctaText}>Start your 7-day free trial</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

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
