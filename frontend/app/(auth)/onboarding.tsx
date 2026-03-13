import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as StoreReview from 'expo-store-review';
import { Button } from '../../components/Button';
import { ChipSelector } from '../../components/ChipSelector';
import { Card } from '../../components/GradientCard';
import { MetabolicRing } from '../../components/MetabolicRing';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { getTierConfig, useMetabolicBudgetStore } from '../../stores/metabolicBudgetStore';
import { authApi, metabolicApi } from '../../services/api';
import {
  ALLERGY_OPTIONS,
  DIETARY_OPTIONS,
  DISLIKED_INGREDIENT_OPTIONS,
  FLAVOR_OPTIONS,
  PROTEIN_OPTIONS,
} from '../../constants/Config';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';

// ─── Constants ─────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

const TOTAL_STEPS = 14;

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Mostly sedentary', desc: 'Desk job, minimal exercise' },
  { value: 'moderate', label: 'Lightly active', desc: '1-3 light workouts/week' },
  { value: 'active', label: 'Regularly active', desc: '3-5 workouts/week' },
  { value: 'athletic', label: 'Athlete / daily training', desc: 'Intense daily exercise' },
];

const GOAL_OPTIONS = [
  { value: 'fat_loss', label: 'Lose body fat', icon: 'trending-down-outline' as const },
  { value: 'muscle_gain', label: 'Build muscle', icon: 'barbell-outline' as const },
  { value: 'maintenance', label: 'Maintain & optimize', icon: 'shield-checkmark-outline' as const },
  { value: 'metabolic_reset', label: 'Metabolic reset / health', icon: 'heart-outline' as const },
];

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const MOTIVATION_OPTIONS = [
  { id: 'too_processed', label: 'I eat too much processed food', summary: 'you eat too much processed food' },
  { id: 'more_energy', label: 'I want more energy', summary: 'you want more energy' },
  { id: 'confused', label: "I'm confused about what's healthy", summary: "you're confused about what's healthy" },
  { id: 'cook_more', label: 'I want to cook more real food', summary: 'you want to cook more real food' },
  { id: 'lose_weight', label: 'I want to lose weight the right way', summary: 'you want to lose weight the right way' },
  { id: 'feed_family', label: 'I want to feed my family better', summary: 'you want to feed your family better' },
];

const FREQUENCY_OPTIONS = [
  { id: 'every_meal', label: 'Almost every meal' },
  { id: 'few_daily', label: 'A few times a day' },
  { id: 'few_weekly', label: 'A few times a week' },
  { id: 'rarely', label: 'Rarely' },
];

interface MealSuggestion {
  recipe_id: string;
  title: string;
  meal_score: number;
  meal_tier: string;
  projected_daily_score: number;
  projected_daily_tier: string;
  protein_g: number;
  fiber_g: number;
  sugar_g: number;
  calories: number;
  cuisine: string;
  total_time_min: number;
}

const FALLBACK_MEALS: MealSuggestion[] = [
  {
    recipe_id: 'fb-1',
    title: 'Mediterranean Salmon Bowl',
    meal_score: 88,
    meal_tier: 'optimal',
    projected_daily_score: 83,
    projected_daily_tier: 'good',
    protein_g: 38,
    fiber_g: 9,
    sugar_g: 6,
    calories: 520,
    cuisine: 'Mediterranean',
    total_time_min: 25,
  },
  {
    recipe_id: 'fb-2',
    title: 'Chicken & Roasted Veggie Plate',
    meal_score: 85,
    meal_tier: 'optimal',
    projected_daily_score: 82,
    projected_daily_tier: 'good',
    protein_g: 42,
    fiber_g: 11,
    sugar_g: 5,
    calories: 480,
    cuisine: 'American',
    total_time_min: 30,
  },
  {
    recipe_id: 'fb-3',
    title: 'Herb-Crusted Chicken with Sweet Potato',
    meal_score: 86,
    meal_tier: 'optimal',
    projected_daily_score: 84,
    projected_daily_tier: 'good',
    protein_g: 40,
    fiber_g: 10,
    sugar_g: 7,
    calories: 550,
    cuisine: 'American',
    total_time_min: 35,
  },
  {
    recipe_id: 'fb-4',
    title: 'Dark Chocolate Avocado Mousse',
    meal_score: 76,
    meal_tier: 'good',
    projected_daily_score: 80,
    projected_daily_tier: 'good',
    protein_g: 6,
    fiber_g: 8,
    sugar_g: 12,
    calories: 280,
    cuisine: 'Dessert',
    total_time_min: 10,
  },
];

// ─── Component ─────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const saveMetabolicProfile = useMetabolicBudgetStore((s) => s.saveProfile);
  const fetchBudget = useMetabolicBudgetStore((s) => s.fetchBudget);

  // Navigation
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Act 1 — Problem awareness (local only, for mirroring)
  const [motivations, setMotivations] = useState<string[]>([]);
  const [processedFrequency, setProcessedFrequency] = useState<string[]>([]);

  // Act 2 — Preferences
  const [flavors, setFlavors] = useState<string[]>(user?.flavor_preferences || []);
  const [dietary, setDietary] = useState<string[]>(user?.dietary_preferences || []);
  const [allergies, setAllergies] = useState<string[]>(user?.allergies || []);
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>(
    user?.disliked_ingredients || []
  );
  const [likedProteins, setLikedProteins] = useState<string[]>(
    user?.protein_preferences?.liked || []
  );
  const [dislikedProteins, setDislikedProteins] = useState<string[]>(
    user?.protein_preferences?.disliked || []
  );

  // Metabolic profile (steps 8-9)
  const [weightLb, setWeightLb] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [insulinResistant, setInsulinResistant] = useState(false);
  const [prediabetes, setPrediabetes] = useState(false);
  const [type2Diabetes, setType2Diabetes] = useState(false);

  // Act 3 — Aha moment
  const [mealSuggestions, setMealSuggestions] = useState<MealSuggestion[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isCommitted, setIsCommitted] = useState<boolean | null>(null);
  const [computedTargets, setComputedTargets] = useState<{
    protein_g: number; carb_ceiling_g: number; fiber_g: number; fat_g: number;
    calorie_target_kcal: number; tdee: number;
  } | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ─── Metabolic helpers ───

  const bodyGoalsValid = useMemo(() => {
    return (
      weightLb.trim() !== '' &&
      heightFt.trim() !== '' &&
      age.trim() !== '' &&
      sex !== null &&
      activityLevel !== null &&
      goal !== null
    );
  }, [weightLb, heightFt, age, sex, activityLevel, goal]);

  const handleT2DToggle = (on: boolean) => {
    setType2Diabetes(on);
    if (on) setInsulinResistant(true);
  };

  const goalLabel = useMemo(() => {
    return GOAL_OPTIONS.find((o) => o.value === goal)?.label || '';
  }, [goal]);

  const activityLabel = useMemo(() => {
    return ACTIVITY_OPTIONS.find((o) => o.value === activityLevel)?.label?.toLowerCase() || '';
  }, [activityLevel]);

  // ─── Derived ───

  const frequencyId = processedFrequency[0] || '';
  const frequencyLabel =
    FREQUENCY_OPTIONS.find((o) => o.id === frequencyId)?.label?.toLowerCase() || '';
  const motivationSummaries = motivations
    .slice(0, 2)
    .map((id) => MOTIVATION_OPTIONS.find((o) => o.id === id)?.summary)
    .filter(Boolean);

  // Exclude dessert (last item) from daily MES average
  const projectedScore = useMemo(() => {
    if (mealSuggestions.length === 0) return 0;
    const mainMeals = mealSuggestions.slice(0, Math.max(mealSuggestions.length - 1, 1));
    return Math.round(
      mainMeals.reduce((sum, m) => sum + m.meal_score, 0) / mainMeals.length
    );
  }, [mealSuggestions]);

  const projectedTier = useMemo(() => {
    if (projectedScore >= 85) return 'optimal';
    if (projectedScore >= 70) return 'good';
    if (projectedScore >= 55) return 'moderate';
    if (projectedScore >= 40) return 'low';
    return 'critical';
  }, [projectedScore]);

  const title = useMemo(() => {
    switch (step) {
      case 0: return 'You already know\nsomething is off';
      case 1: return 'What brought you here?';
      case 2: return 'How often do you eat ultra-processed food?';
      case 3: {
        if (frequencyLabel && motivationSummaries.length > 0) {
          return `So you eat processed food ${frequencyLabel}...`;
        }
        return "Here's what we know so far";
      }
      case 4: return "Let's tune your flavor profile";
      case 5: return 'Any dietary goals or restrictions?';
      case 6: return 'Safety check: allergies';
      case 7: return 'Protein preferences';
      case 8: return "Now let's dial in your body";
      case 9: return 'Anything else we should know?';
      case 10: return 'Your personalized targets';
      case 11: return 'Building your metabolic profile...';
      case 12: return "Here's what a great day looks like for you";
      case 13: return 'Ready to start eating real food?';
      default: return '';
    }
  }, [step, frequencyLabel, motivationSummaries]);

  const subtitle = useMemo(() => {
    switch (step) {
      case 0: return "Most of what's sold as food wasn't food 50 years ago. You're here because you want better.";
      case 1: return 'Tap what resonates. No wrong answers.';
      case 2: return "Be honest — no judgment. This helps us help you.";
      case 3: {
        const motText = motivationSummaries.length > 0
          ? `...and you're here because ${motivationSummaries.join(' and ')}.`
          : '';
        return `${motText}\n\nThe average American eats 60% ultra-processed food. Let's fix that — starting with your preferences.`;
      }
      case 4: return 'Healthy eating doesn\'t have to be boring. Pick 2–4 flavors so every meal plan feels exciting.';
      case 5: return 'Choose what applies now. You can always change this later.';
      case 6: return "We'll use this to keep recommendations safe.";
      case 7: return 'Pick proteins you love. Great food starts with great ingredients.';
      case 8: return 'This personalizes your macros, scoring, and meal plans — no two people get the same targets.';
      case 9: return 'Optional — this fine-tunes your metabolic sensitivity scoring. Skip if unsure.';
      case 10: return 'Based on what you told us, here\'s your personalized metabolic budget.';
      case 11: return 'Personalizing your meals and calculating your metabolic targets...';
      case 12: return 'Three meals, a dessert, and real food. This is your projected Metabolic Energy Score.';
      case 13: return '';
      default: return '';
    }
  }, [step, motivationSummaries]);

  // ─── Helpers ───

  const toggle = (arr: string[], setter: (next: string[]) => void, id: string) => {
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const toggleProtein = (
    arr: string[],
    setter: (next: string[]) => void,
    otherArr: string[],
    otherSetter: (next: string[]) => void,
    id: string
  ) => {
    if (arr.includes(id)) {
      setter(arr.filter((x) => x !== id));
      return;
    }
    setter([...arr, id]);
    if (otherArr.includes(id)) {
      otherSetter(otherArr.filter((x) => x !== id));
    }
  };

  const canContinue =
    step === 0 ||
    (step === 1 && motivations.length > 0) ||
    (step === 2 && processedFrequency.length > 0) ||
    step === 3 ||
    (step === 4 && flavors.length > 0) ||
    (step === 5 && dietary.length > 0) ||
    step === 6 ||
    step === 7 ||
    (step === 8 && bodyGoalsValid) ||
    step === 9 ||
    step === 10 ||
    step === 12 ||
    (step === 13 && isCommitted !== null);

  // ─── Step 10: Compute targets from metabolic profile (local preview) ───

  useEffect(() => {
    if (step !== 10) return;
    if (!bodyGoalsValid) return;

    // Simple local estimate for the mirror step (real computation happens server-side in step 11)
    const w = parseFloat(weightLb);
    const a = parseInt(age);
    const g = goal || 'maintenance';

    const proteinFloor = g === 'muscle_gain' ? 1.2 : 1.0;
    const protein = Math.round(w * proteinFloor);

    let carbCeiling = 130;
    if (insulinResistant || type2Diabetes) carbCeiling = 90;
    else if (activityLevel === 'athletic') carbCeiling = 175;
    else if (activityLevel === 'active') carbCeiling = 155;
    if (g === 'fat_loss') carbCeiling = Math.round(carbCeiling * 0.85);

    const fiber = Math.round(w * 0.18);
    const fat = Math.round(w * 0.45);

    const cal = Math.round(protein * 4 + carbCeiling * 4 + fat * 9);

    // Simple Mifflin-St Jeor TDEE estimate
    const heightCm = (parseInt(heightFt) * 12 + parseFloat(heightIn || '0')) * 2.54;
    const weightKg = w * 0.453592;
    let bmr = sex === 'female'
      ? 10 * weightKg + 6.25 * heightCm - 5 * a - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * a + 5;
    const actMultiplier = activityLevel === 'sedentary' ? 1.2
      : activityLevel === 'moderate' ? 1.375
      : activityLevel === 'active' ? 1.55
      : 1.725;
    const tdee = Math.round(bmr * actMultiplier);

    setComputedTargets({
      protein_g: protein,
      carb_ceiling_g: carbCeiling,
      fiber_g: fiber,
      fat_g: fat,
      calorie_target_kcal: cal,
      tdee,
    });
  }, [step, bodyGoalsValid]);

  // ─── Step 11: Save preferences + metabolic profile + fetch meal suggestions ───

  useEffect(() => {
    if (step !== 11) return;
    let cancelled = false;

    const run = async () => {
      setProfileSaving(true);
      setError('');

      // Save food preferences
      try {
        await authApi.updatePreferences({
          flavor_preferences: flavors,
          dietary_preferences: dietary,
          allergies,
          disliked_ingredients: dislikedIngredients,
          protein_preferences: {
            liked: likedProteins,
            disliked: dislikedProteins,
          },
        });
        const profile = await authApi.getProfile();
        setUser(profile);
      } catch {
        // Preferences save failed — still continue
      }

      // Save metabolic profile
      if (bodyGoalsValid) {
        try {
          const data: Record<string, any> = {
            weight_lb: parseFloat(weightLb),
            height_ft: parseInt(heightFt),
            height_in: parseFloat(heightIn || '0'),
            age: parseInt(age),
            sex,
            activity_level: activityLevel,
            goal,
            insulin_resistant: insulinResistant,
            prediabetes,
            type_2_diabetes: type2Diabetes,
          };
          if (bodyFatPct.trim()) {
            data.body_fat_pct = parseFloat(bodyFatPct);
          }
          await saveMetabolicProfile(data);
          await fetchBudget();
        } catch {
          // Metabolic save failed — still continue with fallback meals
        }
      }

      // Fetch personalized meal suggestions
      try {
        const suggestions = await metabolicApi.getMealSuggestions(undefined, 4);
        if (!cancelled && suggestions && suggestions.length > 0) {
          setMealSuggestions(suggestions.slice(0, 4));
        } else if (!cancelled) {
          setMealSuggestions(FALLBACK_MEALS);
        }
      } catch {
        if (!cancelled) setMealSuggestions(FALLBACK_MEALS);
      }

      if (!cancelled) {
        setProfileSaving(false);
        setStep(12);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [step]);

  // ─── Navigation ───

  const animateTransition = (next: Step) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    if (step >= 13) return;
    animateTransition(Math.min(step + 1, 13) as Step);
  };

  const goBack = () => {
    if (step <= 0 || step === 11) return;
    // From step 12 or 13, go back to step 10 (skip the loading step 11)
    if (step === 12 || step === 13) {
      animateTransition(step === 13 ? 12 as Step : 10 as Step);
      return;
    }
    animateTransition(Math.max(step - 1, 0) as Step);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // Trigger review prompt (won't always show — Apple controls frequency)
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
      }
    } catch {
      // Review request is non-critical
    }
    router.replace('/subscribe');
  };

  // ─── Render helpers ───

  const renderMealCard = (meal: MealSuggestion, idx: number) => {
    const tierCfg = getTierConfig(meal.meal_tier);
    const mealLabels = ['Breakfast', 'Lunch', 'Dinner', 'Dessert'];
    return (
      <View
        key={meal.recipe_id}
        style={[styles.mealCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
      >
        <View style={styles.mealCardHeader}>
          <Text style={[styles.mealTypeLabel, { color: theme.textTertiary }]}>
            {mealLabels[idx] || `Meal ${idx + 1}`}
          </Text>
          <View style={[styles.mesBadge, { backgroundColor: tierCfg.color + '18' }]}>
            <Text style={[styles.mesBadgeText, { color: tierCfg.color }]}>
              {Math.round(meal.meal_score)} MES
            </Text>
          </View>
        </View>
        <Text style={[styles.mealTitle, { color: theme.text }]}>{meal.title}</Text>
        <View style={styles.mealMeta}>
          <Text style={[styles.mealMetaText, { color: theme.textTertiary }]}>
            {meal.calories} cal
          </Text>
          <Text style={[styles.mealMetaDot, { color: theme.textTertiary }]}> · </Text>
          <Text style={[styles.mealMetaText, { color: theme.textTertiary }]}>
            {meal.protein_g}g protein
          </Text>
          <Text style={[styles.mealMetaDot, { color: theme.textTertiary }]}> · </Text>
          <Text style={[styles.mealMetaText, { color: theme.textTertiary }]}>
            {meal.fiber_g}g fiber
          </Text>
        </View>
      </View>
    );
  };

  // ─── Main render ───

  const showBackButton = step > 0 && step !== 11;
  const showFooter = step !== 11; // Step 11 auto-advances

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Badge */}
        <View style={[styles.badge, { backgroundColor: theme.primaryMuted }]}>
          <Ionicons name="sparkles" size={14} color={theme.primary} />
          <Text style={[styles.badgeText, { color: theme.primary }]}>5-minute setup</Text>
        </View>

        {/* Progress */}
        <View style={[styles.progressBg, { backgroundColor: theme.surfaceHighlight }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: theme.primary, width: `${((step + 1) / TOTAL_STEPS) * 100}%` },
            ]}
          />
        </View>

        {/* Title & subtitle */}
        {step !== 11 && (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </>
        )}

        {/* Error */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.errorMuted }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── Step content ── */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Act 1: Problem Awareness ── */}

          {step === 0 && (
            <View style={styles.welcomeHero}>
              <View style={[styles.heroIconWrap, { backgroundColor: theme.primaryMuted }]}>
                <Ionicons name="leaf" size={48} color={theme.primary} />
              </View>
              <Text style={[styles.heroTagline, { color: theme.textSecondary }]}>
                Real food. Real energy.{'\n'}Once you eat like this, you'll feel amazing.
              </Text>
            </View>
          )}

          {step === 1 && (
            <ChipSelector
              label="What resonates with you?"
              options={MOTIVATION_OPTIONS}
              selected={motivations}
              onToggle={(id) => toggle(motivations, setMotivations, id)}
            />
          )}

          {step === 2 && (
            <ChipSelector
              label="Pick the closest match"
              options={FREQUENCY_OPTIONS}
              selected={processedFrequency}
              onToggle={(id) => setProcessedFrequency([id])}
              multiSelect={false}
            />
          )}

          {step === 3 && (
            <Card padding={Spacing.lg}>
              <View style={styles.mirrorRow}>
                <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
                <Text style={[styles.mirrorLabel, { color: theme.text }]}>Your snapshot</Text>
              </View>
              {motivationSummaries.length > 0 && (
                <Text style={[styles.mirrorItem, { color: theme.textSecondary }]}>
                  You're here because {motivationSummaries.join(' and ')}.
                </Text>
              )}
              {frequencyLabel ? (
                <Text style={[styles.mirrorItem, { color: theme.textSecondary }]}>
                  You eat ultra-processed food {frequencyLabel}.
                </Text>
              ) : null}
              <View style={[styles.statCallout, { backgroundColor: theme.primaryMuted }]}>
                <Text style={[styles.statText, { color: theme.primary }]}>
                  60% of the average American diet is ultra-processed food.
                </Text>
              </View>
            </Card>
          )}

          {/* ── Act 2: Preferences ── */}

          {step === 4 && (
            <ChipSelector
              label="Flavor preferences"
              options={FLAVOR_OPTIONS}
              selected={flavors}
              onToggle={(id) => toggle(flavors, setFlavors, id)}
            />
          )}

          {step === 5 && (
            <ChipSelector
              label="Dietary preferences"
              options={DIETARY_OPTIONS}
              selected={dietary}
              onToggle={(id) => toggle(dietary, setDietary, id)}
            />
          )}

          {step === 6 && (
            <ChipSelector
              label="Allergies"
              options={ALLERGY_OPTIONS}
              selected={allergies}
              onToggle={(id) => toggle(allergies, setAllergies, id)}
            />
          )}

          {step === 7 && (
            <>
              <ChipSelector
                label="Proteins you like"
                options={PROTEIN_OPTIONS}
                selected={likedProteins}
                onToggle={(id) =>
                  toggleProtein(likedProteins, setLikedProteins, dislikedProteins, setDislikedProteins, id)
                }
              />
              <ChipSelector
                label="Proteins to avoid"
                options={PROTEIN_OPTIONS}
                selected={dislikedProteins}
                onToggle={(id) =>
                  toggleProtein(dislikedProteins, setDislikedProteins, likedProteins, setLikedProteins, id)
                }
              />
              <ChipSelector
                label="Ingredients you dislike"
                options={DISLIKED_INGREDIENT_OPTIONS}
                selected={dislikedIngredients}
                onToggle={(id) => toggle(dislikedIngredients, setDislikedIngredients, id)}
              />
            </>
          )}

          {/* ── Step 8: Body & Goals ── */}

          {step === 8 && (
            <View style={styles.stepContainer}>
              {/* Weight */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Weight</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.inputField, { color: theme.text }]}
                  placeholder="165"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="numeric"
                  value={weightLb}
                  onChangeText={setWeightLb}
                />
                <Text style={[styles.inputUnit, { color: theme.textTertiary }]}>lbs</Text>
              </View>

              {/* Height */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Height</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.inputRow, { flex: 1, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.inputField, { color: theme.text }]}
                    placeholder="5"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                    value={heightFt}
                    onChangeText={setHeightFt}
                  />
                  <Text style={[styles.inputUnit, { color: theme.textTertiary }]}>ft</Text>
                </View>
                <View style={[styles.inputRow, { flex: 1, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.inputField, { color: theme.text }]}
                    placeholder="7"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="numeric"
                    value={heightIn}
                    onChangeText={setHeightIn}
                  />
                  <Text style={[styles.inputUnit, { color: theme.textTertiary }]}>in</Text>
                </View>
              </View>

              {/* Age */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Age</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.inputField, { color: theme.text }]}
                  placeholder="30"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
                <Text style={[styles.inputUnit, { color: theme.textTertiary }]}>years</Text>
              </View>

              {/* Sex */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Sex</Text>
              <View style={styles.chipRow}>
                {SEX_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setSex(opt.value)}
                    style={[
                      styles.chip,
                      { borderColor: theme.border },
                      sex === opt.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: sex === opt.value ? '#fff' : theme.text }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Activity Level */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Activity Level</Text>
              {ACTIVITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setActivityLevel(opt.value)}
                  style={[
                    styles.optionRow,
                    { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                    activityLevel === opt.value && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                    <Text style={[styles.optionDesc, { color: theme.textTertiary }]}>{opt.desc}</Text>
                  </View>
                  {activityLevel === opt.value && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}

              {/* Goal */}
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Goal</Text>
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setGoal(opt.value)}
                    style={[
                      styles.goalCard,
                      { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                      goal === opt.value && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                    ]}
                  >
                    <Ionicons name={opt.icon} size={22} color={goal === opt.value ? theme.primary : theme.textSecondary} />
                    <Text
                      style={[styles.goalLabel, { color: goal === opt.value ? theme.primary : theme.text }]}
                      numberOfLines={2}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 9: Health Context (optional) ── */}

          {step === 9 && (
            <View style={styles.stepContainer}>
              {/* Body Fat (optional) */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Body Fat % (optional)</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.inputField, { color: theme.text }]}
                  placeholder="18"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="numeric"
                  value={bodyFatPct}
                  onChangeText={setBodyFatPct}
                />
                <Text style={[styles.inputUnit, { color: theme.textTertiary }]}>%</Text>
              </View>
              <Text style={[styles.hintText, { color: theme.textTertiary }]}>
                Not sure? Leave blank — your scoring will use average sensitivity.
              </Text>

              {/* Health toggles */}
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.lg }]}>
                Metabolic health
              </Text>
              <ToggleRow
                label="I have insulin resistance"
                value={insulinResistant}
                onToggle={setInsulinResistant}
                theme={theme}
              />
              <ToggleRow
                label="I have prediabetes"
                value={prediabetes}
                onToggle={setPrediabetes}
                theme={theme}
              />
              <ToggleRow
                label="I have Type 2 diabetes"
                value={type2Diabetes}
                onToggle={handleT2DToggle}
                theme={theme}
              />
              <Text style={[styles.disclaimer, { color: theme.textTertiary }]}>
                Self-reported — used only to personalize scoring. Not medical advice.
              </Text>
            </View>
          )}

          {/* ── Step 10: Metabolic Mirror ── */}

          {step === 10 && computedTargets && (
            <View style={styles.stepContainer}>
              <Card padding={Spacing.lg}>
                <View style={styles.mirrorRow}>
                  <Ionicons name="analytics-outline" size={24} color={theme.primary} />
                  <Text style={[styles.mirrorLabel, { color: theme.text }]}>Your metabolic targets</Text>
                </View>

                <Text style={[styles.mirrorItem, { color: theme.textSecondary }]}>
                  {weightLb} lbs, {activityLabel}, goal: {goalLabel.toLowerCase()}
                  {(insulinResistant || type2Diabetes) ? ' · metabolic sensitivity adjusted' : ''}
                </Text>

                <View style={styles.targetGrid}>
                  <View style={[styles.targetCard, { backgroundColor: theme.primaryMuted }]}>
                    <Text style={[styles.targetValue, { color: theme.primary }]}>{computedTargets.protein_g}g</Text>
                    <Text style={[styles.targetLabel, { color: theme.textSecondary }]}>Protein</Text>
                  </View>
                  <View style={[styles.targetCard, { backgroundColor: theme.primaryMuted }]}>
                    <Text style={[styles.targetValue, { color: theme.primary }]}>{computedTargets.carb_ceiling_g}g</Text>
                    <Text style={[styles.targetLabel, { color: theme.textSecondary }]}>Carb ceiling</Text>
                  </View>
                  <View style={[styles.targetCard, { backgroundColor: theme.primaryMuted }]}>
                    <Text style={[styles.targetValue, { color: theme.primary }]}>{computedTargets.fiber_g}g</Text>
                    <Text style={[styles.targetLabel, { color: theme.textSecondary }]}>Fiber</Text>
                  </View>
                  <View style={[styles.targetCard, { backgroundColor: theme.primaryMuted }]}>
                    <Text style={[styles.targetValue, { color: theme.primary }]}>{computedTargets.fat_g}g</Text>
                    <Text style={[styles.targetLabel, { color: theme.textSecondary }]}>Fat</Text>
                  </View>
                </View>

                <View style={[styles.statCallout, { backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.statText, { color: theme.textSecondary }]}>
                    Est. TDEE: {computedTargets.tdee} cal · Target: ~{computedTargets.calorie_target_kcal} cal/day
                  </Text>
                </View>
              </Card>

              <Text style={[styles.hintText, { color: theme.textTertiary, textAlign: 'center', marginTop: Spacing.md }]}>
                These are computed from your body stats and goals. Your meal plans, scoring, and chronometer will all use these personalized targets.
              </Text>
            </View>
          )}

          {/* ── Step 11: Loading transition ── */}

          {step === 11 && (
            <View style={styles.loadingScreen}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingTitle, { color: theme.text }]}>
                Building your metabolic profile...
              </Text>
              <Text style={[styles.loadingSubtitle, { color: theme.textSecondary }]}>
                Personalizing meals and calculating{'\n'}your metabolic targets
              </Text>
            </View>
          )}

          {/* ── Act 3: Aha Moment ── */}

          {step === 12 && (
            <View style={styles.ahaContainer}>
              <View style={styles.ringCenter}>
                <MetabolicRing score={projectedScore} tier={projectedTier} size={140} />
                <Text style={[styles.tierLabel, { color: getTierConfig(projectedTier).color }]}>
                  {getTierConfig(projectedTier).label}
                </Text>
              </View>
              <View style={styles.mealList}>
                {mealSuggestions.map((meal, idx) => renderMealCard(meal, idx))}
              </View>
              <Text style={[styles.dessertNote, { color: theme.primary }]}>
                Yes, there's dessert. When you eat well all day, a treat doesn't derail your score.
              </Text>
              <Text style={[styles.ahaNote, { color: theme.textTertiary }]}>
                Scan your meals, follow curated plans, or browse recipes to feel this good every day.
              </Text>
            </View>
          )}

          {/* ── Step 13: Commitment + Launch ── */}

          {step === 13 && (
            <View style={styles.commitContainer}>
              {/* Profile summary */}
              <Card padding={Spacing.md}>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>
                  {user?.name ? `${user.name}'s profile` : 'Your profile'}
                </Text>
                {flavors.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.textTertiary }]}>Flavors</Text>
                    <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>
                      {flavors.map((f) => FLAVOR_OPTIONS.find((o) => o.id === f)?.label || f).join(', ')}
                    </Text>
                  </View>
                )}
                {dietary.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.textTertiary }]}>Diet</Text>
                    <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>
                      {dietary.map((d) => DIETARY_OPTIONS.find((o) => o.id === d)?.label || d).join(', ')}
                    </Text>
                  </View>
                )}
                {allergies.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.textTertiary }]}>Allergies</Text>
                    <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>
                      {allergies.map((a) => ALLERGY_OPTIONS.find((o) => o.id === a)?.label || a).join(', ')}
                    </Text>
                  </View>
                )}
                {goalLabel ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.textTertiary }]}>Goal</Text>
                    <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>{goalLabel}</Text>
                  </View>
                ) : null}
                {computedTargets ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.textTertiary }]}>Targets</Text>
                    <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>
                      {computedTargets.protein_g}g P · {computedTargets.carb_ceiling_g}g C · {computedTargets.fat_g}g F
                    </Text>
                  </View>
                ) : null}
              </Card>

              {/* Commitment cards */}
              <Text style={[styles.commitQuestion, { color: theme.text }]}>
                Are you ready to commit?
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsCommitted(true)}
                style={styles.commitOption}
              >
                <LinearGradient
                  colors={isCommitted === true ? ['#22C55E', '#16A34A'] : [theme.surface, theme.surface]}
                  style={[
                    styles.commitCard,
                    {
                      borderColor: isCommitted === true ? '#22C55E' : theme.border,
                      borderWidth: isCommitted === true ? 2 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="flame"
                    size={20}
                    color={isCommitted === true ? '#fff' : theme.primary}
                  />
                  <Text
                    style={[
                      styles.commitText,
                      { color: isCommitted === true ? '#fff' : theme.text },
                    ]}
                  >
                    Yes, I'm all in
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsCommitted(false)}
                style={styles.commitOption}
              >
                <View
                  style={[
                    styles.commitCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isCommitted === false ? theme.primary : theme.border,
                      borderWidth: isCommitted === false ? 2 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="compass-outline"
                    size={20}
                    color={isCommitted === false ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.commitText,
                      { color: isCommitted === false ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    Let me explore first
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Footer ── */}
      {showFooter && (
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
          {showBackButton ? (
            <Button
              title="Back"
              variant="ghost"
              onPress={goBack}
              disabled={loading}
            />
          ) : (
            <View />
          )}
          {step < 11 ? (
            <Button
              title="Continue"
              onPress={goNext}
              disabled={!canContinue || loading}
            />
          ) : step === 12 ? (
            <Button
              title="Continue"
              onPress={goNext}
            />
          ) : step === 13 ? (
            <Button
              title="Let's go"
              onPress={handleFinish}
              disabled={isCommitted === null}
              loading={loading}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Toggle row subcomponent ──
function ToggleRow({ label, value, onToggle, theme }: { label: string; value: boolean; onToggle: (v: boolean) => void; theme: any }) {
  return (
    <TouchableOpacity
      onPress={() => onToggle(!value)}
      activeOpacity={0.7}
      style={[styles.toggleRow, { borderColor: theme.border, backgroundColor: value ? theme.primary + '12' : theme.surfaceElevated }]}
    >
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.toggleSwitch, { backgroundColor: value ? theme.primary : theme.surfaceHighlight }]}>
        <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 16 : 0 }] }]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.huge,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  progressBg: {
    height: 6,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    lineHeight: 42,
  },
  subtitle: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  errorBox: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Step 0: Welcome ──
  welcomeHero: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  heroIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  heroTagline: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },

  // ── Step 3: Mirror ──
  mirrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  mirrorLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  mirrorItem: {
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  statCallout: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  statText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Step 8: Loading ──
  loadingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
  },
  loadingTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Step 9: Aha moment ──
  ahaContainer: {
    alignItems: 'center',
  },
  ringCenter: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  tierLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealList: {
    width: '100%',
    gap: Spacing.sm,
  },
  mealCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealTypeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mesBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  mesBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  mealTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealMetaText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  mealMetaDot: {
    fontSize: FontSize.xs,
  },
  dessertNote: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  ahaNote: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },

  // ── Steps 8-9: Metabolic profile ──
  stepContainer: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputField: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  inputUnit: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  optionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalCard: {
    width: '47%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
    minHeight: 80,
  },
  goalLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  hintText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  toggleSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },

  // ── Step 10: Metabolic mirror ──
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: Spacing.md,
  },
  targetCard: {
    width: '47%',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  targetValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  targetLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // ── Step 13: Commitment ──
  commitContainer: {
    gap: Spacing.md,
  },
  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  commitQuestion: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  commitOption: {
    width: '100%',
  },
  commitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  commitText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
