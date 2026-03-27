import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

export default function SocialProofScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();

  const headlineFade = useRef(new Animated.Value(0)).current;
  const headlineSlide = useRef(new Animated.Value(15)).current;
  const statFade = useRef(new Animated.Value(0)).current;
  const statScale = useRef(new Animated.Value(0.95)).current;
  const testimonialFade = useRef(new Animated.Value(0)).current;
  const testimonialSlide = useRef(new Animated.Value(20)).current;
  const ratingFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    analytics.trackScreenView(10, 'social_proof');

    Animated.stagger(250, [
      Animated.parallel([
        Animated.timing(headlineFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(statFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(statScale, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(testimonialFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(testimonialSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(ratingFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    return () => analytics.trackScreenExit(10);
  }, []);

  const handleContinue = () => {
    analytics.trackEvent('social_proof_continue');
    router.push('/onboarding-v2/commitment');
  };

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
          Join thousands eating better
        </Animated.Text>

        {/* Key stat card */}
        <Animated.View
          style={[
            styles.statCard,
            { opacity: statFade, transform: [{ scale: statScale }] },
          ]}
        >
          <View style={styles.statGlow} />
          <Text style={styles.statNumber}>12,400+</Text>
          <Text style={styles.statLabel}>
            people improved their energy in the first week
          </Text>
        </Animated.View>

        {/* Testimonial card */}
        <Animated.View
          style={[
            styles.testimonialCard,
            { opacity: testimonialFade, transform: [{ translateY: testimonialSlide }] },
          ]}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#6B7280" style={styles.quoteIcon} />
          <Text style={styles.quoteText}>
            "I finally understand what to eat. The scanner changed how I shop."
          </Text>
          <Text style={styles.attribution}>
            — Sarah K., using Fuel Good for 3 months
          </Text>
        </Animated.View>

        {/* App Store rating badge */}
        <Animated.View style={[styles.ratingBadge, { opacity: ratingFade }]}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.ratingText}>4.8</Text>
          <Text style={styles.ratingLabel}>on the App Store</Text>
        </Animated.View>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },

  // Stat card
  statCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  statGlow: {
    position: 'absolute',
    top: -40,
    width: 160,
    height: 80,
    borderRadius: 80,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#22C55E',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Testimonial
  testimonialCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  quoteIcon: {
    marginBottom: 10,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E5E7EB',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  attribution: {
    fontSize: 13,
    color: '#6B7280',
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
