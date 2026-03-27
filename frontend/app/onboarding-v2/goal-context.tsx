import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { OptionCard } from '../../components/onboarding-v2/OptionCard';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];

const GOALS = [
  { label: 'Feel more energy', icon: 'flash-outline' as const, value: 'energy' as const },
  { label: 'Lose weight', icon: 'trending-down-outline' as const, value: 'weight' as const },
  { label: 'Eat cleaner', icon: 'leaf-outline' as const, value: 'cleaner' as const },
  { label: 'Build muscle', icon: 'barbell-outline' as const, value: 'muscle' as const },
];

const ACTIVITY_LEVELS = [
  { label: 'Mostly sedentary', value: 'sedentary' as const },
  { label: 'Lightly active (1-3 workouts/week)', value: 'light' as const },
  { label: 'Moderately active (3-5/week)', value: 'moderate' as const },
  { label: 'Very active (daily exercise)', value: 'active' as const },
  { label: 'Athlete / intense training', value: 'very_active' as const },
];

export default function GoalContextScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const store = useOnboardingState();

  const [subStep, setSubStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(store.primaryGoal);
  const [selectedAge, setSelectedAge] = useState(store.ageRange);
  const [selectedSex, setSelectedSex] = useState(store.sex);
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(store.activityLevel);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    analytics.trackScreenView(7, 'goal_context');
    return () => analytics.trackScreenExit(7);
  }, []);

  const animateTransition = useCallback((toStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSubStep(toStep);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const handleGoalSelect = (value: typeof selectedGoal) => {
    setSelectedGoal(value);
    store.setPrimaryGoal(value);
    analytics.trackEvent('goal_selected', { goal: value });

    setTimeout(() => animateTransition(1), 500);
  };

  const handleActivitySelect = (value: typeof selectedActivity) => {
    setSelectedActivity(value);
    store.setActivityLevel(value);
    analytics.trackEvent('activity_selected', { activity: value });

    setTimeout(() => {
      router.push('/onboarding-v2/plan-preview');
    }, 500);
  };

  const handleBodyContinue = () => {
    const totalInches = (parseInt(heightFt, 10) || 0) * 12 + (parseInt(heightIn, 10) || 0);
    const w = parseInt(weightLbs, 10) || 0;

    store.setAgeRange(selectedAge);
    store.setSex(selectedSex);
    store.setHeight(totalInches);
    store.setWeight(w);

    analytics.trackEvent('body_context_completed', {
      age_range: selectedAge,
      sex: selectedSex,
      height_inches: totalInches,
      weight_lbs: w,
    });

    animateTransition(2);
  };

  const isBodyFormValid =
    selectedAge !== '' &&
    selectedSex !== null &&
    heightFt !== '' &&
    weightLbs !== '';

  const renderSubStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.title}>Let's build your plan</Text>
      <Text style={styles.subtitle}>
        We'll use this to personalize your scores and predictions.
      </Text>

      <Text style={styles.question}>What matters most to you right now?</Text>

      <View style={styles.optionsContainer}>
        {GOALS.map((goal) => (
          <OptionCard
            key={goal.value}
            label={goal.label}
            icon={goal.icon}
            selected={selectedGoal === goal.value}
            onPress={() => handleGoalSelect(goal.value)}
          />
        ))}
      </View>
    </View>
  );

  const renderSubStep1 = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titleSmall}>Quick body context</Text>
        <Text style={styles.subtitle}>This personalizes your metabolic targets.</Text>

        {/* Age Range */}
        <Text style={styles.fieldLabel}>Age range</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {AGE_RANGES.map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.chip, selectedAge === range && styles.chipSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedAge(range);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, selectedAge === range && styles.chipTextSelected]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sex */}
        <Text style={styles.fieldLabel}>Sex</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, selectedSex === 'male' && styles.toggleSelected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSex('male');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, selectedSex === 'male' && styles.toggleTextSelected]}>
              Male
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, selectedSex === 'female' && styles.toggleSelected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSex('female');
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.toggleText, selectedSex === 'female' && styles.toggleTextSelected]}
            >
              Female
            </Text>
          </TouchableOpacity>
        </View>

        {/* Height */}
        <Text style={styles.fieldLabel}>Height</Text>
        <View style={styles.heightRow}>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.textInput}
              value={heightFt}
              onChangeText={setHeightFt}
              placeholder="5"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
              maxLength={1}
            />
            <Text style={styles.inputUnit}>ft</Text>
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.textInput}
              value={heightIn}
              onChangeText={setHeightIn}
              placeholder="10"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.inputUnit}>in</Text>
          </View>
        </View>

        {/* Weight */}
        <Text style={styles.fieldLabel}>Weight</Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={weightLbs}
            onChangeText={setWeightLbs}
            placeholder="165"
            placeholderTextColor="#6B7280"
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.inputUnit}>lbs</Text>
        </View>

        <View style={{ height: 24 }} />

        <TouchableOpacity
          style={[styles.continueButton, !isBodyFormValid && styles.continueButtonDisabled]}
          onPress={handleBodyContinue}
          disabled={!isBodyFormValid}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueText, !isBodyFormValid && styles.continueTextDisabled]}>
            Continue
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderSubStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.titleSmall}>How active are you?</Text>

      <View style={styles.optionsContainer}>
        {ACTIVITY_LEVELS.map((level) => (
          <OptionCard
            key={level.value}
            label={level.label}
            selected={selectedActivity === level.value}
            onPress={() => handleActivitySelect(level.value)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View
        style={[
          styles.animatedContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {subStep === 0 && renderSubStep0()}
        {subStep === 1 && renderSubStep1()}
        {subStep === 2 && renderSubStep2()}
      </Animated.View>

      <View style={styles.progressContainer}>
        <OnboardingProgress total={12} current={6} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  animatedContent: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  titleSmall: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 28,
  },
  question: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 18,
  },
  optionsContainer: {
    gap: 0,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 10,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
  },
  chipSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22C55E60',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  chipTextSelected: {
    color: '#22C55E',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
  },
  toggleSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22C55E60',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  toggleTextSelected: {
    color: '#22C55E',
  },
  heightRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 16,
  },
  inputUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  continueButtonDisabled: {
    backgroundColor: '#1A3A1A',
  },
  continueText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  continueTextDisabled: {
    color: '#4B5563',
  },
  progressContainer: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 12,
  },
});
