import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

export default function ProblemStatementScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useOnboardingAnalytics();

  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineSlide = useRef(new Animated.Value(16)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const subtextSlide = useRef(new Animated.Value(16)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    analytics.trackScreenView(2, 'problem_statement');

    // Staggered fade-in
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(headlineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(subtextOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(subtextSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(buttonSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    return () => analytics.trackScreenExit(2);
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.trackEvent('onboarding_problem_statement_continue');
    router.push('/onboarding-v2/energy-check');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.content}>
        <Animated.Text
          style={[
            styles.headline,
            { opacity: headlineOpacity, transform: [{ translateY: headlineSlide }] },
          ]}
        >
          Healthy eating shouldn't feel like punishment.
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtext,
            { opacity: subtextOpacity, transform: [{ translateY: subtextSlide }] },
          ]}
        >
          No calorie counting. No restriction. Just eat real food — and earn your cheat meals.
        </Animated.Text>
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
              <Text style={styles.ctaButtonText}>Show me how</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ marginTop: 20 }}>
          <OnboardingProgress total={12} current={1} />
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
    paddingHorizontal: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 38,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  subtext: {
    fontSize: 16,
    color: '#9CA3AF',
    lineHeight: 26,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  ctaButton: {
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
