import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';

function getGoalLabel(goal: string | null): string {
  switch (goal) {
    case 'weight': return 'Fat loss';
    case 'muscle': return 'Muscle fuel';
    case 'cleaner': return 'Clean eating';
    case 'energy':
    default: return 'More energy';
  }
}

function getFlexCount(goal: string | null, activity: string | null): number {
  if (goal === 'weight') return 3;
  if (activity === 'active' || activity === 'very_active') return 5;
  return 4;
}

export default function SocialProofScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { primaryGoal, activityLevel } = useOnboardingState();

  const goalLabel = getGoalLabel(primaryGoal);
  const flexCount = useMemo(
    () => getFlexCount(primaryGoal, activityLevel),
    [primaryGoal, activityLevel],
  );

  const headlineFade = useRef(new Animated.Value(0)).current;
  const headlineSlide = useRef(new Animated.Value(15)).current;
  const item1Fade = useRef(new Animated.Value(0)).current;
  const item1Slide = useRef(new Animated.Value(16)).current;
  const item2Fade = useRef(new Animated.Value(0)).current;
  const item2Slide = useRef(new Animated.Value(16)).current;
  const item3Fade = useRef(new Animated.Value(0)).current;
  const item3Slide = useRef(new Animated.Value(16)).current;
  const item4Fade = useRef(new Animated.Value(0)).current;
  const item4Slide = useRef(new Animated.Value(16)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    analytics.trackScreenView(10, 'social_proof');

    Animated.stagger(200, [
      Animated.parallel([
        Animated.timing(headlineFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(item1Fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(item1Slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(item2Fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(item2Slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(item3Fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(item3Slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(item4Fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(item4Slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    return () => analytics.trackScreenExit(10);
  }, []);

  const handleContinue = () => {
    analytics.trackEvent('social_proof_continue');
    router.push('/onboarding-v2/commitment');
  };

  const items = [
    { icon: 'trophy-outline' as const, label: `Goal: ${goalLabel}`, color: '#22C55E' },
    { icon: 'ticket-outline' as const, label: `${flexCount} guilt-free cheat meals per week`, color: '#F59E0B' },
    { icon: 'restaurant-outline' as const, label: 'Personalized weekly meal plans', color: '#22C55E' },
    { icon: 'scan-outline' as const, label: 'Unlimited food scanning', color: '#22C55E' },
  ];

  const fadeRefs = [item1Fade, item2Fade, item3Fade, item4Fade];
  const slideRefs = [item1Slide, item2Slide, item3Slide, item4Slide];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Headline */}
        <Animated.Text
          style={[
            styles.headline,
            { opacity: headlineFade, transform: [{ translateY: headlineSlide }] },
          ]}
        >
          Here's what you're getting
        </Animated.Text>

        {/* Recap items */}
        <View style={styles.itemsList}>
          {items.map((item, i) => (
            <Animated.View
              key={item.label}
              style={[
                styles.itemCard,
                { opacity: fadeRefs[i], transform: [{ translateY: slideRefs[i] }] },
              ]}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: `${item.color}12` }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.itemLabel}>{item.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* App Store badge (keep real social proof if we have it) */}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.ratingText}>4.8</Text>
          <Text style={styles.ratingLabel}>on the App Store</Text>
        </View>
      </View>

      <Animated.View style={[styles.bottomContainer, { opacity: buttonFade }]}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
        <View style={styles.progressWrapper}>
          <OnboardingProgress total={12} current={9} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },

  // Items
  itemsList: {
    gap: 12,
    marginBottom: 28,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  itemIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    lineHeight: 22,
  },

  // Rating badge
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#151515',
    borderRadius: 12,
    alignSelf: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Bottom
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  continueButton: {
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  progressWrapper: {
    alignItems: 'center',
    paddingBottom: 8,
  },
});
