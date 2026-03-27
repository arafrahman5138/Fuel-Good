import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { MirrorCard } from '../../components/onboarding-v2/MirrorCard';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

// ─── Mirror Copy Matrix (energy x diet = 16 combos) ───────────────────
type Energy = 'energized' | 'fine' | 'tired' | 'depends';
type Diet = 'fall_off' | 'bored' | 'restricted' | 'lost';

const MIRROR_COPY: Record<Energy, Record<Diet, string>> = {
  tired: {
    restricted:
      "You said you feel foggy after meals and that diets feel restrictive. That's not a willpower problem — it's a system problem.",
    fall_off:
      "You said you feel tired after eating and that healthy streaks don't stick. Your food is crashing your energy — and willpower can't fix that.",
    bored:
      'You said you feel tired after eating and healthy food bores you. What if the food that fuels you also excites you?',
    lost:
      "You said you feel tired after eating and don't know where to start. That's exactly why we built this.",
  },
  depends: {
    restricted:
      'You said your energy is inconsistent and diets feel too strict. That pattern has a name — and a fix.',
    fall_off:
      "You said your energy is inconsistent and healthy habits don't stick. The problem isn't you — it's the system you were using.",
    bored:
      'You said your energy is inconsistent and healthy food bores you. What if clean eating meant Shawarma Bowls and Smash Burgers?',
    lost:
      "You said your energy is inconsistent and you don't know where to start. We'll show you exactly what to eat — and you'll love it.",
  },
  fine: {
    restricted:
      'You said you feel okay after meals but diets feel restrictive. Imagine feeling great — without any restriction.',
    fall_off:
      "You said you feel fine after meals but healthy streaks don't stick. 'Fine' can become 'amazing' with the right fuel.",
    bored:
      "You said you feel fine but healthy food bores you. We're about to change what 'healthy food' means to you.",
    lost:
      "You said you feel fine but don't know where to start. We'll take you from fine to thriving.",
  },
  energized: {
    restricted:
      "You already feel energized — imagine how you'd feel without any restriction holding you back.",
    fall_off:
      "You feel good now, but streaks don't stick. Let's build a system that makes consistency effortless.",
    bored:
      "You feel energized but healthy food bores you. Wait until you see what's possible.",
    lost:
      "You feel energized but don't know where to start. You're already ahead — let us handle the plan.",
  },
};

const CALLOUT = 'Fuel Good does the opposite.';

// Fallback if state is somehow null
const DEFAULT_TEXT =
  "Your relationship with food deserves better. That's not a willpower problem — it's a system problem.";

export default function MirrorScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useOnboardingAnalytics();
  const energyFeeling = useOnboardingState((s) => s.energyFeeling);
  const dietHistory = useOnboardingState((s) => s.dietHistory);

  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    analytics.trackScreenView(5, 'mirror');
    analytics.trackEvent('onboarding_mirror_shown', {
      energy_feeling: energyFeeling,
      diet_history: dietHistory,
    });

    // Delay button appearance to let the mirror card land first
    Animated.sequence([
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    return () => analytics.trackScreenExit(5);
  }, []);

  // Resolve mirror text
  const mirrorText =
    energyFeeling && dietHistory
      ? MIRROR_COPY[energyFeeling]?.[dietHistory] ?? DEFAULT_TEXT
      : DEFAULT_TEXT;

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.trackEvent('onboarding_mirror_continue');
    router.push('/onboarding-v2/meal-reveal');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.content}>
        <MirrorCard text={mirrorText} callout={CALLOUT} />
      </View>

      <View style={styles.bottomArea}>
        <Animated.View
          style={{ opacity: buttonOpacity, transform: [{ translateY: buttonSlide }] }}
        >
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaButtonText}>Show me</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ marginTop: 20 }}>
          <OnboardingProgress total={12} current={4} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
