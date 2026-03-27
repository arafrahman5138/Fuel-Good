import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MealCard } from '../../components/onboarding-v2/MealCard';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

const MEALS = [
  {
    title: 'Chicken Shawarma Bowl',
    subtitle: 'All whole food ingredients',
    fuelScore: 100,
    delay: 500,
  },
  {
    title: 'Homestyle Smash Burger',
    subtitle: 'Zero seed oils, zero guilt',
    fuelScore: 100,
    delay: 800,
  },
  {
    title: 'Turkish Eggs with Whipped Feta',
    subtitle: 'Restaurant quality, home kitchen',
    fuelScore: 100,
    delay: 1100,
  },
];

export default function MealRevealScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();

  const headlineFade = useRef(new Animated.Value(0)).current;
  const subtextFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    analytics.trackScreenView(6, 'meal_reveal');

    Animated.sequence([
      Animated.timing(headlineFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(subtextFade, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Button fades in after meals animate
    Animated.timing(buttonFade, {
      toValue: 1,
      duration: 500,
      delay: 1800,
      useNativeDriver: true,
    }).start();

    return () => analytics.trackScreenExit(6);
  }, []);

  const handleContinue = () => {
    analytics.trackEvent('meal_reveal_continue');
    router.push('/onboarding-v2/goal-context');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text style={[styles.headline, { opacity: headlineFade }]}>
          This is what Fuel Score 100{'\n'}looks like.
        </Animated.Text>

        <Animated.Text style={[styles.subtext, { opacity: subtextFade }]}>
          All whole food. All delicious. No compromises.
        </Animated.Text>

        <View style={styles.cardsContainer}>
          {MEALS.map((meal) => (
            <MealCard
              key={meal.title}
              title={meal.title}
              subtitle={meal.subtitle}
              fuelScore={meal.fuelScore}
              imageUrl={null}
              delay={meal.delay}
            />
          ))}
        </View>
      </ScrollView>

      <Animated.View style={[styles.bottomContainer, { opacity: buttonFade }]}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <OnboardingProgress total={12} current={5} />
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
    lineHeight: 32,
    marginBottom: 10,
  },
  subtext: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 28,
  },
  cardsContainer: {
    gap: 0,
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
