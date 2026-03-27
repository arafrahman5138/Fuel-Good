import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { OptionCard } from '../../components/onboarding-v2/OptionCard';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

type DietOption = 'fall_off' | 'bored' | 'restricted' | 'lost';

const OPTIONS: { label: string; value: DietOption; icon: any }[] = [
  { label: 'I do great for a while, then fall off', value: 'fall_off', icon: 'trending-down' },
  { label: 'I get bored of the food', value: 'bored', icon: 'sad-outline' },
  { label: 'I feel restricted and give up', value: 'restricted', icon: 'lock-closed' },
  { label: "I don't know where to start", value: 'lost', icon: 'help-circle-outline' },
];

export default function DietHistoryScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useOnboardingAnalytics();
  const setDietHistory = useOnboardingState((s) => s.setDietHistory);
  const [selected, setSelected] = useState<DietOption | null>(null);

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(16)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    analytics.trackScreenView(4, 'diet_history');

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(optionsSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    return () => analytics.trackScreenExit(4);
  }, []);

  const handleSelect = (value: DietOption) => {
    setSelected(value);
    setDietHistory(value);
    analytics.trackEvent('onboarding_diet_history_answered', { value });

    // Auto-advance after 500ms
    setTimeout(() => {
      router.push('/onboarding-v2/mirror');
    }, 500);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.content}>
        <Animated.View
          style={{ opacity: titleOpacity, transform: [{ translateY: titleSlide }] }}
        >
          <Text style={styles.question}>What happens when you try to eat healthier?</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.optionsContainer,
            { opacity: optionsOpacity, transform: [{ translateY: optionsSlide }] },
          ]}
        >
          {OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              icon={opt.icon}
              selected={selected === opt.value}
              onPress={() => handleSelect(opt.value)}
            />
          ))}
        </Animated.View>
      </View>

      <View style={styles.bottomArea}>
        <OnboardingProgress total={12} current={3} />
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
  question: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 0,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
