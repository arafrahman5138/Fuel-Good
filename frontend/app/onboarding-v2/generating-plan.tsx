import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';

const STEPS = [
  { label: 'Analyzing your metabolism...', icon: 'pulse-outline' as const },
  { label: 'Building your meal plan...', icon: 'restaurant-outline' as const },
  { label: 'Calculating your flex meals...', icon: 'ticket-outline' as const },
  { label: 'Personalizing your scanner...', icon: 'scan-outline' as const },
  { label: 'Your plan is ready', icon: 'checkmark-circle' as const },
];

const STEP_DURATION = 2000; // 2s per step = ~10s total

export default function GeneratingPlanScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { primaryGoal } = useOnboardingState();

  const [activeStep, setActiveStep] = useState(0);

  // Progress bar animation
  const progressWidth = useRef(new Animated.Value(0)).current;

  // Step fade animations (one per step)
  const stepFades = useRef(STEPS.map(() => new Animated.Value(0))).current;
  const stepSlides = useRef(STEPS.map(() => new Animated.Value(12))).current;

  // Spinner rotation
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    analytics.trackScreenView(11, 'generating_plan');

    // Spin animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Progress bar fills over total duration
    Animated.timing(progressWidth, {
      toValue: 1,
      duration: STEP_DURATION * STEPS.length,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Stagger steps
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        setActiveStep(i);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Animated.parallel([
          Animated.timing(stepFades[i], {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(stepSlides[i], {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }, i * STEP_DURATION);
    });

    // Navigate to paywall after all steps complete
    const navTimeout = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/onboarding-v2/paywall');
    }, STEPS.length * STEP_DURATION + 800);

    return () => {
      clearTimeout(navTimeout);
      analytics.trackScreenExit(11);
    };
  }, []);

  const goalLabel =
    primaryGoal === 'weight'
      ? 'fat loss'
      : primaryGoal === 'muscle'
        ? 'muscle fuel'
        : primaryGoal === 'cleaner'
          ? 'clean eating'
          : 'energy';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Top label */}
        <Text style={styles.topLabel}>
          Building your {goalLabel} plan
        </Text>

        {/* Spinner */}
        <Animated.View style={[styles.spinnerContainer, { transform: [{ rotate: spin }] }]}>
          <Ionicons name="sync-outline" size={40} color="#22C55E" />
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {STEPS.map((step, i) => {
            const isComplete = activeStep > i;
            const isActive = activeStep === i;
            const isFinal = i === STEPS.length - 1;

            return (
              <Animated.View
                key={step.label}
                style={[
                  styles.stepRow,
                  {
                    opacity: stepFades[i],
                    transform: [{ translateY: stepSlides[i] }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.stepIconCircle,
                    isComplete && styles.stepIconComplete,
                    isFinal && isActive && styles.stepIconFinal,
                  ]}
                >
                  <Ionicons
                    name={isComplete ? 'checkmark' : step.icon}
                    size={18}
                    color={
                      isFinal && isActive
                        ? '#000'
                        : isComplete
                          ? '#22C55E'
                          : '#9CA3AF'
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isComplete && styles.stepLabelComplete,
                    isFinal && isActive && styles.stepLabelFinal,
                  ]}
                >
                  {step.label}
                </Text>
              </Animated.View>
            );
          })}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  spinnerContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1A1A1A',
    marginBottom: 40,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  stepsContainer: {
    width: '100%',
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconComplete: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  stepIconFinal: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E',
  },
  stepLabel: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  stepLabelComplete: {
    color: '#6B7280',
  },
  stepLabelFinal: {
    color: '#22C55E',
    fontWeight: '700',
  },
});
