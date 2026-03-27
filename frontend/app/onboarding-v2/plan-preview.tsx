import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeeklyBarChart } from '../../components/onboarding-v2/WeeklyBarChart';
import { FlexTicketRow } from '../../components/onboarding-v2/FlexTicketRow';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

const WEEK_DATA = [
  { label: 'Mon', score: 100, isFlex: false },
  { label: 'Tue', score: 100, isFlex: false },
  { label: 'Wed', score: 100, isFlex: false },
  { label: 'Thu', score: 100, isFlex: false },
  { label: 'Fri', score: 100, isFlex: false },
  { label: 'Sat', score: 35, isFlex: true },
  { label: 'Sun', score: 45, isFlex: true },
];

function getFlexMealCount(goal: string | null, activity: string | null): number {
  if (goal === 'weight') return 3;
  if (activity === 'active' || activity === 'very_active') return 5;
  return 4;
}

export default function PlanPreviewScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { primaryGoal, activityLevel } = useOnboardingState();

  const flexCount = useMemo(
    () => getFlexMealCount(primaryGoal, activityLevel),
    [primaryGoal, activityLevel]
  );

  const headlineFade = useRef(new Animated.Value(0)).current;
  const headlineSlide = useRef(new Animated.Value(20)).current;
  const chartFade = useRef(new Animated.Value(0)).current;
  const avgCardFade = useRef(new Animated.Value(0)).current;
  const avgCardSlide = useRef(new Animated.Value(20)).current;
  const flexFade = useRef(new Animated.Value(0)).current;
  const flexSlide = useRef(new Animated.Value(20)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    analytics.trackScreenView(8, 'plan_preview');

    Animated.stagger(300, [
      // Headline
      Animated.parallel([
        Animated.timing(headlineFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      // Chart
      Animated.timing(chartFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      // Average card
      Animated.parallel([
        Animated.timing(avgCardFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(avgCardSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      // Flex section
      Animated.parallel([
        Animated.timing(flexFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(flexSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      // Button
      Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    return () => analytics.trackScreenExit(8);
  }, []);

  const handleContinue = () => {
    analytics.trackEvent('plan_preview_continue', { flex_count: flexCount });
    router.push('/onboarding-v2/live-scan');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          style={[
            styles.headline,
            { opacity: headlineFade, transform: [{ translateY: headlineSlide }] },
          ]}
        >
          Your week with Fuel Good
        </Animated.Text>

        {/* Weekly Bar Chart */}
        <Animated.View style={[styles.chartContainer, { opacity: chartFade }]}>
          <WeeklyBarChart days={WEEK_DATA} animated />
        </Animated.View>

        {/* Weekly Average Card */}
        <Animated.View
          style={[
            styles.avgCard,
            { opacity: avgCardFade, transform: [{ translateY: avgCardSlide }] },
          ]}
        >
          <Text style={styles.avgLabel}>Weekly Average</Text>
          <Text style={styles.avgScore}>87.6</Text>
          <Text style={styles.avgSubtext}>Strong tier — even with 2 cheat meals</Text>
        </Animated.View>

        {/* Flex Meals Section */}
        <Animated.View
          style={[
            styles.flexSection,
            { opacity: flexFade, transform: [{ translateY: flexSlide }] },
          ]}
        >
          <Text style={styles.flexText}>
            Eat clean. Earn{' '}
            <Text style={styles.flexCount}>{flexCount}</Text>
            {' '}guilt-free cheat meals.
          </Text>

          <FlexTicketRow count={flexCount} animated />
        </Animated.View>
      </ScrollView>

      <Animated.View style={[styles.bottomContainer, { opacity: buttonFade }]}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <OnboardingProgress total={12} current={7} />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 28,
  },
  chartContainer: {
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F1F1F',
    marginBottom: 18,
  },
  avgCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22C55E20',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avgLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  avgScore: {
    fontSize: 36,
    fontWeight: '800',
    color: '#22C55E',
    marginBottom: 6,
  },
  avgSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  flexSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  flexText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  flexCount: {
    color: '#22C55E',
    fontWeight: '800',
  },
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
  progressContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
});
