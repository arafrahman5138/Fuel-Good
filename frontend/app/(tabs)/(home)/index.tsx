import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { Card } from '../../../components/GradientCard';
import { SkeletonCard } from '../../../components/SkeletonLoader';
import { DataErrorState } from '../../../components/DataErrorState';

import { XPToast } from '../../../components/XPToast';
import { FlexUnlockedToast } from '../../../components/FlexUnlockedToast';

import { EnergyHeroCard } from '../../../components/EnergyHeroCard';
import { FlexInsightsCard } from '../../../components/FlexInsightsCard';
import { FlexSummaryCard } from '../../../components/FlexSummaryCard';
import { TodayProgressCard } from '../../../components/TodayProgressCard';
import { useTheme, useIsDark } from '../../../hooks/useTheme';
import { useAuthStore } from '../../../stores/authStore';
import { useMealPlanStore } from '../../../stores/mealPlanStore';
import { useMetabolicBudgetStore, getTierConfig, getTierFromScore } from '../../../stores/metabolicBudgetStore';
import { useFuelStore } from '../../../stores/fuelStore';
import { recipeApi, nutritionApi } from '../../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../../constants/Colors';
import { Shadows } from '../../../constants/Shadows';
import { useEntranceAnimation } from '../../../hooks/useAnimations';
import { trackBehaviorEvent } from '../../../services/notifications';
import { resolveImageUrl } from '../../../utils/imageUrl';
import { toDateKey } from '../../../utils/dateKey';

const TODAY_DAY_INDEX = 22; // offset 0 in [-22..+8]
const INITIAL_DAY_INDEX = Math.max(0, TODAY_DAY_INDEX - 3);

const DAILY_TIPS = [
  'Swap refined vegetable oils with extra virgin olive oil or avocado oil. They\'re rich in healthy monounsaturated fats and antioxidants.',
  'Aim for at least 30 different plant foods per week — fruits, vegetables, nuts, seeds, herbs, and whole grains — to support gut microbiome diversity.',
  'Eat the rainbow! Different colored produce provides different phytonutrients. Try to include at least 3 colors at each meal.',
  'Wild-caught fish like salmon, mackerel, and sardines are excellent sources of omega-3 fatty acids essential for brain and heart health.',
  'Fermented foods like yogurt, kimchi, sauerkraut, and kefir support a healthy gut. Try to include one serving daily.',
  'Soaking and sprouting grains, nuts, and legumes can increase nutrient bioavailability and reduce anti-nutrients like phytic acid.',
  'Dark leafy greens like kale, spinach, and Swiss chard are among the most nutrient-dense foods on the planet. Aim for a daily serving.',
];

const RECIPE_GRADIENTS: readonly [string, string][] = [
  ['#22C55E', '#16A34A'],
  ['#3B82F6', '#2563EB'],
  ['#EC4899', '#DB2777'],
  ['#F59E0B', '#D97706'],
  ['#8B5CF6', '#7C3AED'],
  ['#14B8A6', '#0D9488'],
  ['#EF4444', '#DC2626'],
  ['#6366F1', '#4F46E5'],
];

const MEAL_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  route: string;
  accent: string;
  accentBg: string;
}


interface RecommendedRecipe {
  id: string;
  title: string;
  difficulty?: string;
  total_time_min?: number;
  tags?: string[];
  image_url?: string | null;
}

interface NutrientComparison {
  consumed: number;
  target: number;
  pct: number;
}

interface DailySummary {
  daily_score: number;
  comparison: Record<string, NutrientComparison>;
  logs?: Array<{
    id?: string;
    title?: string;
    meal_type?: string;
    servings?: number;
    source_type?: string;
    source_id?: string;
    group_id?: string;
    group_mes_score?: number | null;
    group_mes_tier?: string | null;
    fuel_score?: number | null;
    nutrition_snapshot?: Record<string, any>;
    [key: string]: unknown;
  }>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { CARD_WIDTH, DAY_CONTENT_WIDTH, DAY_PILL_WIDTH } = useMemo(() => {
    const cardW = width * 0.42;
    const dayContentW = width - Spacing.xl * 2;
    const dayPillW = dayContentW / 7;
    return { CARD_WIDTH: cardW, DAY_CONTENT_WIDTH: dayContentW, DAY_PILL_WIDTH: dayPillW };
  }, [width]);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const homeScrollRef = useRef<ScrollView>(null);
  const user = useAuthStore((s) => s.user);
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const loadCurrentPlan = useMealPlanStore((s) => s.loadCurrentPlan);
  const mealPlanLoadError = useMealPlanStore((s) => s.loadError);
  const dailyMES = useMetabolicBudgetStore((s) => s.dailyScore);
  const scoreHistory = useMetabolicBudgetStore((s) => s.scoreHistory);

  const metabolicStreak = useMetabolicBudgetStore((s) => s.streak);
  const mealScores = useMetabolicBudgetStore((s) => s.mealScores);
  const remainingBudget = useMetabolicBudgetStore((s) => s.remainingBudget);
  const fetchMetabolic = useMetabolicBudgetStore((s) => s.fetchAll);

  const fuelDaily = useFuelStore((s) => s.daily);
  const fetchFuelDaily = useFuelStore((s) => s.fetchDaily);
  const fuelWeekly = useFuelStore((s) => s.weekly);
  const fetchFuelWeekly = useFuelStore((s) => s.fetchWeekly);
  const [refreshing, setRefreshing] = useState(false);
  const [recommended, setRecommended] = useState<RecommendedRecipe[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [xpToast, setXpToast] = useState<string | null>(null);
  const [xpToastIcon, setXpToastIcon] = useState<string>('flash');
  const [flexToast, setFlexToast] = useState<string | null>(null);
  const fuelStreak = useFuelStore((s) => s.streak);
  const fuelSettings = useFuelStore((s) => s.settings);
  const flexSuggestions = useFuelStore((s) => s.flexSuggestions);
  const fetchFlexSuggestions = useFuelStore((s) => s.fetchFlexSuggestions);
  const healthPulse = useFuelStore((s) => s.healthPulse);
  const fetchHealthPulse = useFuelStore((s) => s.fetchHealthPulse);
  const heroEntrance = useEntranceAnimation(0);
  const actionsEntrance = useEntranceAnimation(160);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => toDateKey(new Date()));
  const weekPulse = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const weekListRef = useRef<FlatList<any>>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null);
  const [recentMeals, setRecentMeals] = useState<any[]>([]);
  const [loggedMealIds, setLoggedMealIds] = useState<Set<string>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const weekDays = useMemo(() => {
    const now = new Date();
    const anchor = new Date(now);
    anchor.setHours(0, 0, 0, 0);

    return Array.from({ length: 31 }).map((_, idx) => {
      const offset = idx - 22; // range: -22 days to +8 days
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + offset);
      return {
        key: d.toISOString(),
        dayKey: toDateKey(d),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate(),
        offset,
        isToday:
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate(),
      };
    });
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(weekPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(weekPulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [weekPulse]);

  useEffect(() => {
    const t = setTimeout(() => {
      weekListRef.current?.scrollToIndex({ index: INITIAL_DAY_INDEX, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const shouldShow = value > 56;
      setShowStickyHeader((prev) => (prev === shouldShow ? prev : shouldShow));
    });
    return () => {
      scrollY.removeListener(id);
    };
  }, [scrollY]);

  const loadRecommended = async () => {
    try {
      const params: Record<string, string | number | undefined> = { page_size: 10 };
      // Use user preferences to filter
      const flavorPrefs = user?.flavor_preferences || [];
      const proteinPrefs = user?.protein_preferences?.liked || [];
      if (flavorPrefs.length > 0) params.flavor = flavorPrefs[0];
      if (proteinPrefs.length > 0) params.protein_type = proteinPrefs.join(',');
      const data = await recipeApi.browse(params);
      const items: RecommendedRecipe[] = data?.items || [];
      // Shuffle for variety
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      setRecommended(items.slice(0, 8));
    } catch {
      // Fallback: try without preferences
      try {
        const data = await recipeApi.browse({ page_size: 8 });
        setRecommended(data?.items || []);
      } catch {}
    }
  };

  const loadDailyNutrition = async (date?: string) => {
    try {
      const data = await nutritionApi.getDaily(date);
      if (data) setDailySummary(data);
    } catch {
      setLoadError(true);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(false);
    // Reset meal plan hasLoaded so it reloads
    useMealPlanStore.setState({ hasLoaded: false });
    await Promise.all([
      loadRecommended(),
      loadCurrentPlan(),
      loadDailyNutrition(selectedDayKey),
      // force:true bypasses the focus-cache TTL — pull-to-refresh should
      // always hit the network even if data was just fetched.
      fetchMetabolic(selectedDayKey, { force: true }),
      fetchFuelDaily(selectedDayKey),
      fetchFuelWeekly(selectedDayKey),
      fetchFlexSuggestions(selectedDayKey),
      fetchHealthPulse(selectedDayKey),
    ]);
    setRefreshing(false);
  }, [selectedDayKey, fetchMetabolic, loadCurrentPlan, fetchFuelDaily, fetchFuelWeekly, fetchFlexSuggestions, fetchHealthPulse]);

  // Stable callback consumed by the memoized RecentMealChip. Wrapping in
  // useCallback keyed only on the dependencies that actually change keeps
  // the chip from re-rendering on every parent state update.
  const handleLogRecentMeal = useCallback(async (meal: any) => {
    const label = meal.label || meal.food_name || 'Meal';
    const fuelScore = meal.fuel_score ?? meal.score;
    try {
      await nutritionApi.createLog({
        label,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        fiber: meal.fiber,
        source_type: 'quick_log',
        meal_type: meal.meal_type || 'snack',
        fuel_score: fuelScore,
      });
      Alert.alert('Logged!', `"${label}" added to today's log.`);
      loadDailyNutrition(selectedDayKey);
      fetchFuelDaily(selectedDayKey);
    } catch {
      Alert.alert('Log failed', 'Unable to log that meal right now.');
    }
  }, [selectedDayKey, fetchFuelDaily]);

  const loadRecentMeals = async () => {
    try {
      // Fetch logs from the last 7 days to find unique meals for quick re-logging
      const days: any[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(toDateKey(d));
      }
      const results = await Promise.all(days.map((dk) => nutritionApi.getLogs(dk).catch(() => [])));
      const allLogs = results.flat();
      // Deduplicate by label, keep most recent
      const seen = new Map<string, any>();
      for (const log of allLogs) {
        const label = log.label || log.food_name || '';
        if (label && !seen.has(label)) {
          seen.set(label, log);
        }
      }
      setRecentMeals(Array.from(seen.values()).slice(0, 6));
    } catch {}
  };

  useEffect(() => {
    Promise.all([
      loadRecommended(),
      loadCurrentPlan(),
      loadDailyNutrition(selectedDayKey),
      fetchMetabolic(selectedDayKey),
      fetchFuelDaily(selectedDayKey),
      fetchFuelWeekly(selectedDayKey),
      fetchFlexSuggestions(selectedDayKey),
      fetchHealthPulse(selectedDayKey),
      loadRecentMeals(),
    ]).finally(() => setIsInitialLoading(false));
  }, []);

  useEffect(() => {
    loadDailyNutrition(selectedDayKey);
    fetchMetabolic(selectedDayKey);
    fetchFuelDaily(selectedDayKey);
    fetchFuelWeekly(selectedDayKey);
    fetchFlexSuggestions(selectedDayKey);
    fetchHealthPulse(selectedDayKey);
  }, [selectedDayKey, fetchMetabolic, fetchFuelDaily, fetchFuelWeekly, fetchFlexSuggestions, fetchHealthPulse]);

  useFocusEffect(
    useCallback(() => {
      loadDailyNutrition(selectedDayKey);
      fetchMetabolic(selectedDayKey);
      loadCurrentPlan();
      // Clear optimistic logged IDs so server state is authoritative after any
      // changes made elsewhere (e.g. removing a meal in the Chrono tab)
      setLoggedMealIds(new Set());
    }, [selectedDayKey, fetchMetabolic, loadCurrentPlan])
  );

  // Show toast for metabolic streak milestones and daily tier XP
  const prevStreakRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (!metabolicStreak) return;
    const current = metabolicStreak.current_streak;
    const prev = prevStreakRef.current;
    prevStreakRef.current = current;

    if (prev === null || prev === current || current === 0) return;

    // Milestone streaks
    const milestones = [30, 14, 7, 3];
    for (const ms of milestones) {
      if (current >= ms && (prev < ms)) {
        const labels: Record<number, string> = { 3: 'Bronze', 7: 'Silver', 14: 'Gold', 30: 'Diamond' };
        setXpToastIcon('flash');
        setXpToast(`Energy Streak: ${labels[ms]}! 🔥 ${current} days`);
        return;
      }
    }

    // Generic streak growth
    if (current > prev) {
      setXpToastIcon('battery-charging');
      setXpToast(`Energy streak: ${current} days!`);
    }
  }, [metabolicStreak]);

  // Today's meals from plan
  const selectedDate = useMemo(() => {
    const found = weekDays.find((d) => d.dayKey === selectedDayKey);
    if (found) {
      const [y, m, day] = found.dayKey.split('-').map(Number);
      return new Date(y, (m || 1) - 1, day || 1);
    }
    return new Date();
  }, [weekDays, selectedDayKey]);
  const selectedDayName = DAYS[selectedDate.getDay()];
  const selectedDayNameLong = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const selectedCalendarLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Dynamic plan card title based on selected day
  const planCardTitle = useMemo(() => {
    const todayKey = toDateKey(new Date());
    if (selectedDayKey === todayKey) return "Today's Plan";
    const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));
    if (selectedDayKey === yesterdayKey) return "Yesterday's Plan";
    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayOfWeek}'s Plan`;
  }, [selectedDayKey, selectedDate]);

  // Dynamic fuel card title based on selected day
  const fuelCardTitle = useMemo(() => {
    const todayKey = toDateKey(new Date());
    if (selectedDayKey === todayKey) return "Today's Fuel";
    // Check if selected date is within the visible week strip
    const dayInWeek = weekDays.find((d) => d.dayKey === selectedDayKey);
    if (dayInWeek) {
      const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
      return `${dayOfWeek}'s Fuel`;
    }
    // Outside current week — show date
    const month = selectedDate.toLocaleDateString('en-US', { month: 'long' });
    const day = selectedDate.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    return `${month} ${day}${suffix}'s Fuel`;
  }, [selectedDayKey, selectedDate, weekDays]);

  const todayMeals = useMemo(() => {
    if (!currentPlan?.items) return [];
    return currentPlan.items.filter(
      (item) => item.day_of_week?.toLowerCase() === selectedDayName.toLowerCase()
    );
  }, [currentPlan, selectedDayName]);

  // Plan completion: cross-reference planned meals with logged meals
  const planCompletion = useMemo(() => {
    if (!todayMeals.length) return { completed: 0, total: 0, loggedIds: new Set<string>() };
    const logs = dailySummary?.logs ?? [];
    const logged = new Set<string>();
    for (const meal of todayMeals) {
      if (loggedMealIds.has(meal.id)) {
        logged.add(meal.id);
        continue;
      }
      // Check if this plan item was logged directly (source_type=meal_plan)
      const foundByPlan = logs.some(
        (l) => l.source_type === 'meal_plan' && l.source_id === meal.id
      );
      if (foundByPlan) { logged.add(meal.id); continue; }
      // Also check if the same recipe was logged from any source (browse, cook mode, etc.)
      const recipeId = meal.recipe_data?.id;
      if (recipeId) {
        const foundByRecipe = logs.some(
          (l) => l.source_id === String(recipeId)
        );
        if (foundByRecipe) logged.add(meal.id);
      }
    }
    return { completed: logged.size, total: todayMeals.length, loggedIds: logged };
  }, [todayMeals, dailySummary?.logs, loggedMealIds]);

  const handleLogPlannedMeal = async (meal: any) => {
    const recipe = meal.recipe_data;
    if (!meal.id) return;
    // Pass-6 Gap G1: meal-log gesture had no haptic feedback at all despite being
    // the daily hero action. Light impact on tap confirms the press; Success on
    // completion celebrates the log (fired below after the API succeeds).
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoggingMealId(meal.id);
    try {
      let preferredPairing: any = null;
      if (recipe?.id) {
        try {
          const suggestions = await recipeApi.getPairingSuggestions(String(recipe.id), 6);
          preferredPairing = suggestions.find((s: any) => s?.is_default_pairing) || null;
        } catch {}
      }
      const hasPairing = !!preferredPairing?.recipe_id;
      const groupId = hasPairing ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` : undefined;
      const combinedScore = preferredPairing?.combined_display_score ?? preferredPairing?.combined_mes_score ?? undefined;
      const combinedTier = preferredPairing?.combined_tier ||
        (combinedScore != null
          ? (combinedScore >= 82 ? 'optimal' : combinedScore >= 65 ? 'stable' : combinedScore >= 50 ? 'shaky' : 'crash_risk')
          : undefined);

      await nutritionApi.createLog({
        source_type: 'meal_plan',
        source_id: meal.id,
        meal_type: meal.meal_type,
        // Use the plan's effective servings so the food log captures the
        // full planned portion (e.g. a 2-serving lunch logs 860 kcal,
        // not 430). Backend multiplies per-serving nutrition by this.
        servings: meal.servings || 1,
        quantity: 1,
        date: selectedDayKey,
        group_id: groupId,
        group_mes_score: combinedScore,
        group_mes_tier: combinedTier,
      });

      if (hasPairing && groupId) {
        await nutritionApi.createLog({
          source_type: 'recipe',
          source_id: preferredPairing.recipe_id,
          meal_type: meal.meal_type,
          servings: 1,
          quantity: 1,
          date: selectedDayKey,
          group_id: groupId,
          group_mes_score: combinedScore,
          group_mes_tier: combinedTier,
        });
      }

      // Immediate feedback — Pass-6 Gap G1 paired with the Light tap above.
      // Success notification on confirmed log matches the same pattern Scan tab
      // already uses (scan/index.tsx:418, 510, 535, 574) — meaningful meal action
      // celebrates with Success haptic.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoggedMealIds((prev) => new Set(prev).add(meal.id));
      // Refresh nutrition + fuel data
      loadDailyNutrition(selectedDayKey);
      const prevFlex = fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0;
      await fetchFuelWeekly(selectedDayKey);
      const newFlex = useFuelStore.getState().weekly?.flex_budget?.flex_meals_remaining ?? 0;

      if (newFlex > prevFlex) {
        setXpToastIcon('ticket');
        setXpToast(`Flex meal earned! You have ${newFlex} now`);
      } else {
        setXpToastIcon('leaf');
        setXpToast(`${recipe?.title || meal.meal_type} logged`);
      }
    } catch {
      Alert.alert('Error', 'Could not log this meal. Try again.');
    } finally {
      setLoggingMealId(null);
    }
  };

  const calorieConsumed = Math.round(dailySummary?.comparison?.calories?.consumed ?? 0);
  const calorieTarget = Math.round(dailySummary?.comparison?.calories?.target ?? 0);
  const proteinConsumed = Math.round(dailySummary?.comparison?.protein?.consumed ?? 0);
  const proteinTarget = Math.round(dailySummary?.comparison?.protein?.target ?? 0);
  const carbsConsumed = Math.round(dailySummary?.comparison?.carbs?.consumed ?? 0);
  const carbsTarget = Math.round(dailySummary?.comparison?.carbs?.target ?? 0);
  const fatConsumed = Math.round(dailySummary?.comparison?.fat?.consumed ?? 0);
  const fatTarget = Math.round(dailySummary?.comparison?.fat?.target ?? 0);
  const fiberConsumed = Math.round(dailySummary?.comparison?.fiber?.consumed ?? 0);
  const fiberTarget = Math.round(dailySummary?.comparison?.fiber?.target ?? 0);
  // Memoize macro objects so the React.memo wrapper on TodayProgressCard
  // can shallow-compare and skip re-render when the underlying numbers
  // haven't changed. Without this, fresh `{ consumed, target }` objects
  // are created on every parent render and defeat the memo entirely.
  const caloriesObj = useMemo(() => ({ consumed: calorieConsumed, target: calorieTarget }), [calorieConsumed, calorieTarget]);
  const proteinObj = useMemo(() => ({ consumed: proteinConsumed, target: proteinTarget }), [proteinConsumed, proteinTarget]);
  const carbsObj = useMemo(() => ({ consumed: carbsConsumed, target: carbsTarget }), [carbsConsumed, carbsTarget]);
  const fatObj = useMemo(() => ({ consumed: fatConsumed, target: fatTarget }), [fatConsumed, fatTarget]);
  // Memoize the projected log list — without this, .map() builds a fresh
  // array every render, defeating React.memo on TodayProgressCard.
  const todayLogsForCard = useMemo(() => (dailySummary?.logs ?? []).map((l) => ({
    id: l.id ?? '',
    title: l.title ?? '',
    meal_type: l.meal_type,
    source_type: l.source_type,
    source_id: l.source_id,
    group_id: l.group_id,
    group_mes_score: l.group_mes_score,
    group_mes_tier: l.group_mes_tier,
    fuel_score: l.fuel_score,
    nutrition_snapshot: l.nutrition_snapshot,
  })), [dailySummary?.logs]);
  // Daily MES — for Today's Fuel card
  const dailyMesScore = Math.round(dailyMES?.score?.display_score ?? dailyMES?.score?.total_score ?? 0);
  const dailyMesTierKey = dailyMES?.score?.display_tier ?? dailyMES?.score?.tier ?? 'critical';
  const dailyMesTierColor = getTierConfig(dailyMesTierKey).color;
  // Weekly MES — average scores from the current week (Mon–Sun), matching fuel weekly bounds
  const weekStart = fuelWeekly?.week_start ?? (() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return toDateKey(d);
  })();
  const thisWeekScores = scoreHistory
    .filter((e) => e.date >= weekStart && (e.display_score ?? e.total_score ?? 0) > 0);
  const weeklyMesScore = thisWeekScores.length > 0
    ? Math.round(thisWeekScores.reduce((sum, e) => sum + (e.display_score ?? e.total_score ?? 0), 0) / thisWeekScores.length)
    : 0;
  const weeklyMesTierColor = getTierConfig(getTierFromScore(weeklyMesScore)).color;
  // Homepage ring shows weekly avg — big-picture view; today's detail is in Chrono
  const fuelScoreValue = Math.round(fuelWeekly?.avg_fuel_score ?? fuelDaily?.avg_fuel_score ?? 0);
  const isDarkTheme = useIsDark();

  // Days with at least one meal logged this week
  const weeklyDaysLogged = fuelWeekly?.daily_breakdown?.filter((d) => d.meal_count > 0).length ?? 0;

  // Weekly target is only truly "crushed" when backend confirms AND at least 4 days logged this week
  const weeklyTargetMet =
    (fuelWeekly?.flex_budget?.target_met ?? false) && weeklyDaysLogged >= 4;

  // Progress bar = consistency (days fueled / 7), not score avg — avoids misleading near-100% on day 1
  const weeklyProgressPct = weeklyTargetMet
    ? 100
    : Math.min(99, (weeklyDaysLogged / 7) * 100);

  const quickActions: QuickAction[] = [
    {
      icon: 'calendar-outline',
      label: 'Meal Plans',
      description: 'Build your week',
      route: '/(tabs)/meals?tab=plan',
      accent: '#179A72',
      accentBg: '#E9F7F2',
    },
    {
      icon: 'cart-outline',
      label: 'Groceries',
      description: 'Open your shopping list',
      route: '/(tabs)/meals?tab=grocery',
      accent: '#2A9D8F',
      accentBg: '#E9F6F4',
    },
    {
      icon: 'book-outline',
      label: 'Browse',
      description: 'Explore recipes',
      route: '/(tabs)/meals?tab=browse',
      accent: '#2F8F86',
      accentBg: '#E8F4F3',
    },
    {
      icon: 'bookmark-outline',
      label: 'Saved',
      description: 'Your saved recipes',
      route: '/(tabs)/meals?tab=saved',
      accent: '#6366F1',
      accentBg: '#EEF2FF',
    },
  ];

  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = getGreeting();
  const dailyTip = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
  }, []);

  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [44, 92],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyHeaderTranslateY = scrollY.interpolate({
    inputRange: [44, 92],
    outputRange: [-12, 0],
    extrapolate: 'clamp',
  });
  const introHeaderOpacity = scrollY.interpolate({
    inputRange: [0, 40, 70],
    outputRange: [1, 0.35, 0],
    extrapolate: 'clamp',
  });
  const introHeaderTranslateY = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });

  // ── Render ─────────────────────────────────────────────────────────────
  const renderRecipeCard = useCallback(({ item, index }: { item: RecommendedRecipe; index: number }) => {
    const gradient = RECIPE_GRADIENTS[index % RECIPE_GRADIENTS.length];
    const timeLabel = item.total_time_min ? `${item.total_time_min} min` : null;
    const resolvedImage = resolveImageUrl(item.image_url);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/(tabs)/(home)/recipe/${item.id}` as any)}
        style={{ marginRight: Spacing.md }}
        accessibilityRole="button"
        accessibilityLabel={`Open recipe ${item.title}${timeLabel ? `, ${timeLabel}` : ''}${item.difficulty ? `, ${item.difficulty}` : ''}`}
      >
        <View style={[s.recCard, { width: CARD_WIDTH, height: CARD_WIDTH * 1.25 }]}>
          {resolvedImage ? (
            <>
              <Image
                source={{ uri: resolvedImage }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)'] as const}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
              />
            </>
          ) : (
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            >
              <Ionicons name="restaurant" size={28} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', top: 12, right: 12 }} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl }} />
            </LinearGradient>
          )}
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Text style={s.recTitle} numberOfLines={2}>{item.title}</Text>
            <View style={s.recMeta}>
              {timeLabel && (
                <View style={s.recPill}>
                  <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.9)" />
                  <Text style={s.recPillText}>{timeLabel}</Text>
                </View>
              )}
              {item.difficulty && (
                <View style={s.recPill}>
                  <Text style={s.recPillText}>{item.difficulty}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [CARD_WIDTH]);

  return (
    <ScreenContainer safeArea={false}>
      <XPToast message={xpToast} icon={xpToastIcon} onDismissed={() => setXpToast(null)} />
      <FlexUnlockedToast message={flexToast} onDismissed={() => setFlexToast(null)} />
      {/* Sticky header is always rendered so opacity + translateY can run on
          the native driver. pointerEvents toggles via the threshold-crossing
          listener so taps don't hit a transparent header above the fold. */}
      <Animated.View
          pointerEvents={showStickyHeader ? 'box-none' : 'none'}
          style={[
            styles.stickyHeader,
            {
              paddingTop: Math.max(insets.top, 10),
              backgroundColor: isDarkTheme ? '#0A0A0F' : '#FCFCFA',
              borderBottomColor: theme.border + '66',
              opacity: stickyHeaderOpacity,
              transform: [{ translateY: stickyHeaderTranslateY }],
            },
          ]}
        >
          <View
            style={[
              styles.stickyHeaderInner,
              {
                backgroundColor: 'transparent',
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => homeScrollRef.current?.scrollTo({ y: 0, animated: true })}
              style={[
                styles.calendarPill,
                {
                  backgroundColor: isDarkTheme ? 'rgba(20,20,25,0.9)' : '#FFFFFFCC',
                  borderColor: theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Selected date ${selectedCalendarLabel}, scroll to top`}
            >
              <Ionicons name="calendar-outline" size={14} color={theme.primary} />
              <Text style={[styles.calendarPillText, { color: theme.text }]}>{selectedCalendarLabel}</Text>
              <Ionicons name="chevron-down" size={12} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={styles.stickyHeaderRight}>
              <TouchableOpacity
                testID="home-sticky-streak"
                onPress={() => router.push('/(tabs)/profile/quests' as any)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accentMuted, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full }}
                accessibilityRole="button"
                accessibilityLabel={`Open quests, current streak ${fuelStreak?.current_streak ?? 0} days`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flame" size={16} color={theme.accent} />
                {(fuelStreak?.current_streak ?? 0) > 0 && (
                  <Text style={{ color: theme.accent, fontSize: FontSize.sm, fontWeight: '700' }}>{fuelStreak?.current_streak}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="home-sticky-profile"
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={[styles.profileButton, Shadows.sm(isDarkTheme)]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.profileGradient}
                >
                  <Text style={styles.profileInitial}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      <Animated.ScrollView
        ref={homeScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 10) }]}
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          // Native driver is critical here — every interpolation downstream
          // (sticky header opacity/translate, intro header opacity/translate,
          // week strip opacity/translate) runs on the UI thread instead of
          // the JS thread. Drops scroll-frame work from ~10-20ms to <1ms.
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {!isInitialLoading && (loadError || mealPlanLoadError) && !dailySummary && !currentPlan && (
          <DataErrorState
            thing="dashboard"
            onRetry={async () => {
              setLoadError(false);
              await onRefresh();
            }}
          />
        )}
        {!isInitialLoading && (loadError || mealPlanLoadError) && (dailySummary || currentPlan) && (
          <TouchableOpacity
            onPress={() => { setLoadError(false); onRefresh(); }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginHorizontal: Spacing.xl, marginBottom: 4, backgroundColor: theme.warning + '18', borderRadius: BorderRadius.md }}
            accessibilityRole="button"
            accessibilityLabel="Some data couldn't load. Tap to retry."
          >
            <Ionicons name="cloud-offline-outline" size={14} color={theme.warning} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: FontSize.sm, color: theme.warning }}>Some data couldn't load. Tap to retry.</Text>
          </TouchableOpacity>
        )}
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: introHeaderOpacity,
              transform: [{ translateY: introHeaderTranslateY }],
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting}</Text>
            <Text style={[styles.name, { color: theme.text }]}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <TouchableOpacity
                testID="home-header-streak"
                onPress={() => router.push('/(tabs)/profile/quests' as any)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accentMuted, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full }}
                accessibilityRole="button"
                accessibilityLabel={`Open quests, current streak ${fuelStreak?.current_streak ?? 0} days`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flame" size={16} color={theme.accent} />
                {(fuelStreak?.current_streak ?? 0) > 0 && (
                  <Text style={{ color: theme.accent, fontSize: FontSize.sm, fontWeight: '700' }}>{fuelStreak?.current_streak}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="home-header-profile"
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={[styles.profileButton, Shadows.sm(isDarkTheme)]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.profileGradient}
                >
                  <Text style={styles.profileInitial}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Week strip — outer wrapper has fixed height + overflow:hidden so
            the inner strip can translate up out of view without changing
            layout below. (Previously this used a height interpolation to
            collapse, which forced useNativeDriver:false on the parent
            scroll event and dropped JS-thread fps during fast scrolls.) */}
        <View style={[styles.weekStripWrap, { height: 72, overflow: 'hidden' }]}>
          <Animated.View
            style={[
              styles.weekStrip,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 52, 92],
                  outputRange: [1, 0.55, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateY: scrollY.interpolate({
                      inputRange: [0, 100],
                      outputRange: [0, -72],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <FlatList
              ref={weekListRef}
              horizontal
              data={weekDays}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              pagingEnabled
              decelerationRate="fast"
              initialScrollIndex={INITIAL_DAY_INDEX}
              getItemLayout={(_, index) => ({
                length: DAY_PILL_WIDTH,
                offset: DAY_PILL_WIDTH * index,
                index,
              })}
              onScrollToIndexFailed={() => {}}
              contentContainerStyle={styles.weekListContent}
              renderItem={({ item: day }) => {
                const pulseScale = weekPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.08],
                });
                const isSelected = day.dayKey === selectedDayKey;
                const isToday = day.isToday;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedDayKey(day.dayKey)}
                    style={[styles.weekItem, { width: DAY_PILL_WIDTH }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.label} ${day.date}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
                  >
                    <Text
                      style={[
                        styles.weekDayLabel,
                        { color: isSelected || isToday ? theme.text : theme.textSecondary },
                        isSelected && styles.weekDayLabelActive,
                      ]}
                    >
                      {day.label}
                    </Text>
                    <Animated.View
                      style={[
                        styles.weekRing,
                        isSelected && styles.weekRingToday,
                        {
                          borderColor: isSelected ? theme.primary : isToday ? theme.primary + '88' : theme.border,
                          backgroundColor: isSelected ? undefined : isToday ? theme.primary + '0D' : undefined,
                        },
                        isSelected && { transform: [{ scale: pulseScale }] },
                      ]}
                    >
                      <Text style={[styles.weekDate, { color: isSelected ? theme.primary : theme.text }]}>{day.date}</Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        </View>

        {isInitialLoading ? (
          <View style={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.md }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </View>
        ) : (
        <>
        {/* ── Energy Hero ─────────────────────────────────────────────── */}
        <EnergyHeroCard
          fuelScore={fuelScoreValue}
          mesScore={weeklyMesScore}
          mesTierColor={weeklyMesTierColor}
          energyPrediction={dailyMES?.mea?.energy_prediction ?? null}
          fuelStreakWeeks={fuelStreak?.current_streak ?? 0}
          metabolicStreakDays={metabolicStreak?.current_streak ?? 0}
          weeklyProgress={weeklyProgressPct}
          weeklyTargetMet={weeklyTargetMet}
          weeklyDaysLogged={weeklyDaysLogged}
          mealCount={Math.max(fuelDaily?.meal_count ?? 0, dailySummary?.logs?.length ?? 0)}
          flexMealsEarned={fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0}
          cleanMealsToNextFlex={(() => {
            const flexRemaining = fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0;
            if (flexRemaining > 0) return 0;
            const target = fuelSettings?.fuel_target ?? 80;
            const avgCheatCost = Math.max(1, target - 35);
            const pointsRemaining = (fuelWeekly?.flex_budget as any)?.flex_points_remaining ?? 0;
            if (pointsRemaining >= avgCheatCost) return 0;
            return Math.ceil((avgCheatCost - pointsRemaining) / (100 - target));
          })()}
          onPress={() => router.push('/(tabs)/(home)/fuel-weekly' as any)}
        />

        {/* ── Flex Budget Summary ──────────────────────────────────────── */}
        <FlexSummaryCard
          flexAvailable={fuelWeekly?.flex_budget?.flex_available ?? fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0}
          flexBudget={fuelWeekly?.flex_budget?.flex_budget ?? 4}
          flexUsed={fuelWeekly?.flex_budget?.flex_used ?? 0}
        />

        {/* ── Today's Plan ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: Spacing.md }}>
          <Card padding={0}>
            {/* Card header */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/meals?tab=plan' as any)}
              style={s.todayHeader}
              accessibilityRole="button"
              accessibilityLabel={`Open ${planCardTitle}`}
            >
              <View style={[s.planHeaderIcon, { backgroundColor: theme.primary + '14' }]}>
                <Ionicons name="calendar" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.todayTitle, { color: theme.text }]}>{planCardTitle}</Text>
                <Text style={[s.todayDay, { color: theme.textTertiary }]}>
                  {todayMeals.length > 0
                    ? planCompletion.completed === planCompletion.total
                      ? 'All planned meals logged'
                      : `${planCompletion.completed} of ${planCompletion.total} meals completed`
                    : selectedDayNameLong}
                </Text>
              </View>
              {todayMeals.length > 0 && (
                <View style={s.progressDots}>
                  {todayMeals.map((meal, idx) => (
                    <View
                      key={idx}
                      style={[
                        s.progressDot,
                        {
                          backgroundColor: planCompletion.loggedIds.has(meal.id)
                            ? '#22C55E'
                            : theme.surfaceHighlight,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {/* Meal rows */}
            {todayMeals.length > 0 ? (
              <>
              <View style={s.todayMeals}>
                {todayMeals.map((meal, idx) => {
                  const icon = MEAL_TYPE_ICONS[meal.meal_type?.toLowerCase()] || 'ellipse-outline';
                  const recipeName = meal.recipe_data?.title || meal.meal_type || 'Meal';
                  const mesScore = meal.recipe_data?.mes_display_score;
                  const mesTier = meal.recipe_data?.mes_display_tier;
                  const tierCfg = mesTier ? getTierConfig(mesTier) : null;
                  const isLogged = planCompletion.loggedIds.has(meal.id);
                  const isLogging = loggingMealId === meal.id;
                  return (
                    <View key={meal.id || idx} style={[s.mealRow, idx < todayMeals.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surfaceHighlight }]}>
                      <TouchableOpacity
                        testID={`todays-plan-meal-${idx}`}
                        activeOpacity={0.7}
                        onPress={() => meal.recipe_data?.id && router.push(`/(tabs)/(home)/recipe/${meal.recipe_data.id}` as any)}
                        style={s.mealRowBody}
                        accessibilityRole="button"
                        accessibilityLabel={`Open recipe ${recipeName}, ${meal.meal_type}${isLogged ? ', logged' : ''}`}
                      >
                        <View style={[s.mealIcon, { backgroundColor: isLogged ? '#22C55E18' : theme.surfaceHighlight }]}>
                          <Ionicons
                            name={isLogged ? 'checkmark' : icon}
                            size={16}
                            color={isLogged ? '#22C55E' : theme.primary}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[s.mealName, { color: isLogged ? theme.textSecondary : theme.text }]}
                            numberOfLines={2}
                          >
                            {recipeName}
                          </Text>
                          <Text style={[s.mealType, { color: theme.textTertiary }]}>{meal.meal_type}</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={[s.fuelBadge, { backgroundColor: '#22C55E15' }]}>
                        <Ionicons name="leaf" size={10} color="#22C55E" />
                        <Text style={[s.fuelBadgeText, { color: '#22C55E' }]}>100</Text>
                      </View>
                      {mesScore > 0 && tierCfg && (
                        <View style={[s.mesBadge, { backgroundColor: tierCfg.color + '18' }]}>
                          <Text style={[s.mesBadgeText, { color: tierCfg.color }]}>
                            {Math.round(mesScore)}
                          </Text>
                        </View>
                      )}
                      {!isLogged ? (
                        <TouchableOpacity
                          onPress={() => handleLogPlannedMeal(meal)}
                          disabled={isLogging}
                          style={[s.logBtn, { backgroundColor: theme.primary + '14' }]}
                          activeOpacity={0.7}
                          accessibilityLabel={`Log ${recipeName}`}
                          accessibilityRole="button"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={isLogging ? 'hourglass-outline' : 'add'}
                            size={16}
                            color={theme.primary}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[s.logBtn, { backgroundColor: '#22C55E18' }]} accessibilityLabel="Meal logged">
                          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              {planCompletion.completed < planCompletion.total && (
                <View style={[s.planFlexFooter, { borderTopColor: theme.surfaceHighlight }]}>
                  <Ionicons name="ticket" size={12} color="#F59E0B" />
                  <Text style={[s.planFlexText, { color: theme.textSecondary }]}>
                    Log {planCompletion.total - planCompletion.completed} more → earn flex points
                  </Text>
                </View>
              )}
              </>
            ) : currentPlan ? (
              <View style={s.todayEmpty}>
                <Ionicons name="leaf-outline" size={24} color={theme.textTertiary} />
                <Text style={[s.todayEmptyText, { color: theme.textSecondary }]}>
                  Rest day — no meals planned for {selectedDayNameLong}
                </Text>
              </View>
            ) : (
              <View style={s.todayEmpty}>
                <View style={[s.emptyPlanIcon, { backgroundColor: theme.primary + '14' }]}>
                  <Ionicons name="sparkles" size={24} color={theme.primary} />
                </View>
                <Text style={[s.todayEmptyTitle, { color: theme.text }]}>Your personal chef is ready</Text>
                <Text style={[s.todayEmptyText, { color: theme.textSecondary }]}>
                  Generate a meal plan tailored to your goals
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/meals?tab=plan' as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Create meal plan"
                >
                  <LinearGradient
                    colors={[theme.primary, theme.primary + 'CC'] as any}
                    style={s.todayEmptyCtaGradient}
                  >
                    <Ionicons name="add" size={14} color="#fff" />
                    <Text style={s.todayEmptyCtaGradientText}>Create Plan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>

        {/* ── Today's Fuel ────────────────────────────────────────────── */}
        <TodayProgressCard
          logs={todayLogsForCard}
          mealScores={mealScores}
          fuelTarget={fuelSettings?.fuel_target}
          todayFuelScore={Math.round(fuelDaily?.avg_fuel_score ?? 0)}
          todayMesScore={dailyMesScore}
          todayMesTierColor={dailyMesTierColor}
          calories={caloriesObj}
          protein={proteinObj}
          carbs={carbsObj}
          fat={fatObj}
          title={fuelCardTitle}
        />

        {/* ── Recommended For You ─────────────────────────────────────── */}
        {recommended.length > 0 && (
          <View style={{ marginBottom: Spacing.xl, marginTop: Spacing.md }}>
            <View style={s.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Recommended For You</Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'browse' } } as any)}
                hitSlop={12}
              >
                <Text style={[s.seeAll, { color: theme.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recommended}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={renderRecipeCard}
              contentContainerStyle={{ paddingTop: Spacing.md }}
            />
          </View>
        )}

        {/* ── Recent Meals Quick-Log ─────────────────────────────────── */}
        {recentMeals.length > 0 && (
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Log Again</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
              {recentMeals.map((meal, i) => (
                <RecentMealChip
                  key={`recent-${i}`}
                  meal={meal}
                  onLog={handleLogRecentMeal}
                  isDarkTheme={isDarkTheme}
                  theme={theme}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Quick Actions (with Healthify CTA) ─────────────────────── */}
        <Animated.View style={[actionsEntrance.style, { marginTop: Spacing.md }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>

        {/* Healthify CTA — full-width hero tile */}
        <TouchableOpacity
          testID="home-healthify-tile"
          activeOpacity={0.85}
          onPress={() => {
            trackBehaviorEvent('home_quick_action_used', { label: 'Healthify', route: '/(tabs)/chat' });
            router.push('/(tabs)/chat');
          }}
          style={{ marginBottom: Spacing.sm }}
        >
          <LinearGradient
            colors={['#16A34A', '#0D9488', '#0E7490'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.healthifyTile}
          >
            <View style={styles.healthifyContent}>
              <Text style={styles.healthifyTitle}>Healthify a Craving</Text>
              <Text style={styles.healthifySubtitle}>
                Tell our AI what you crave — get a wholesome version instantly
              </Text>
            </View>
            <Ionicons name="sparkles" size={36} color="rgba(255,255,255,0.25)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Healthify suggestion chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm }}>
          {['pizza', 'burger', 'mac and cheese', 'ice cream', 'fried chicken', 'tacos'].map((item) => (
            <TouchableOpacity
              key={item}
              activeOpacity={0.7}
              onPress={() => {
                trackBehaviorEvent('healthify_chip_tapped', { craving: item });
                router.push({ pathname: '/(tabs)/chat', params: { prefill: `healthify ${item}` } });
              }}
              style={[styles.healthifyChip, { borderColor: theme.border, backgroundColor: isDarkTheme ? theme.surfaceElevated : '#F5F5F0' }]}
            >
              <Ionicons name="sparkles-outline" size={14} color="#16A34A" />
              <Text style={[styles.healthifyChipText, { color: theme.textSecondary }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scan Food CTA — second hero tile */}
        <TouchableOpacity
          testID="home-scan-tile"
          activeOpacity={0.85}
          onPress={() => {
            trackBehaviorEvent('home_quick_action_used', { label: 'Scan Food', route: '/scan' });
            router.push('/scan' as any);
          }}
          style={{ marginBottom: Spacing.sm }}
        >
          <LinearGradient
            colors={['#0E7490', '#1E40AF', '#4338CA'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.healthifyTile}
          >
            <View style={styles.healthifyContent}>
              <Text style={styles.healthifyTitle}>Scan Food</Text>
              <Text style={styles.healthifySubtitle}>
                Point your camera at any meal, label, or barcode — instant Fuel Score
              </Text>
            </View>
            <Ionicons name="scan" size={36} color="rgba(255,255,255,0.25)" />
          </LinearGradient>
        </TouchableOpacity>

        </Animated.View>

        {/* ── Daily Tip ──────────────────────────────────────────────── */}
        <Card style={{ marginTop: Spacing.md }}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb" size={20} color={theme.accent} />
            <Text style={[styles.tipTitle, { color: theme.accent }]}>Daily Tip</Text>
          </View>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            {dailyTip}
          </Text>
        </Card>
        </>
        )}
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

// Memoized recent-meal chip — the parent's `recentMeals.map(...)` was
// previously creating a fresh inline `onPress` arrow per item per render
// (7-10 chips × every state update on Home = a lot of churn). Extracting
// to React.memo with a stable parent callback means chips only re-render
// when their own meal/theme actually changes.
type RecentMealChipProps = {
  meal: any;
  onLog: (meal: any) => void;
  isDarkTheme: boolean;
  theme: any;
};
const RecentMealChip = React.memo(function RecentMealChip({ meal, onLog, isDarkTheme, theme }: RecentMealChipProps) {
  const label = meal.label || meal.food_name || 'Meal';
  const fuelScore = meal.fuel_score ?? meal.score;
  const handlePress = useCallback(() => onLog(meal), [meal, onLog]);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[styles.recentMealChip, { backgroundColor: isDarkTheme ? theme.surfaceElevated : '#F5F5F0', borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`Log ${label} again`}
    >
      <Text style={[styles.recentMealLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
      {fuelScore != null && (
        <View style={[styles.recentMealBadge, { backgroundColor: fuelScore >= 80 ? '#16A34A' : fuelScore >= 50 ? '#D97706' : '#EF4444' }]}>
          <Text style={styles.recentMealBadgeText}>{Math.round(fuelScore)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

// ── New Section Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  // Section header row
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  // Recipe card
  recCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  recTitle: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  recMeta: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  recPillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // Today card
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  planHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  todayDay: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 4,
    flexWrap: 'wrap',
    maxWidth: 80,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayMeals: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
  },
  mealRowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    minWidth: 0,
  },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  mesBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mesBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  fuelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  fuelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  planFlexFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  planFlexText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  mealType: {
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
    marginTop: 1,
  },
  logBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  emptyPlanIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayEmptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  todayEmptyText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  todayEmptyCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  todayEmptyCtaGradientText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  scroll: {
    paddingTop: Spacing.lg,
    paddingBottom: Layout.scrollBottomPadding,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
    overflow: 'hidden',
  },
  calendarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  calendarPillText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerLeft: {},
  headerRight: {
    flexShrink: 1,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  profileGradient: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  greeting: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  name: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    letterSpacing: -1,
  },
  weekStripWrap: {
    marginBottom: Spacing.md,
  },
  weekStrip: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  weekListContent: {
    paddingHorizontal: 0,
  },
  weekItem: {
    alignItems: 'center',
    gap: 5,
  },
  weekDayLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  weekDayLabelActive: {
    fontWeight: '800',
  },
  weekRing: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRingToday: {
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  weekDate: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  heroCard: {
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 160,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
  },
  heroIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  healthifyTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    overflow: 'hidden',
  },
  healthifyContent: {
    flex: 1,
    gap: 3,
    marginRight: Spacing.md,
  },
  healthifyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  healthifySubtitle: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionCard: {},
  actionCardInner: {
    minHeight: 132,
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  actionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  actionCopy: {
    gap: 4,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  actionDescription: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 17,
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  quickNavItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickNavIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNavLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  tipText: {
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  recentMealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  recentMealLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    maxWidth: 140,
  },
  recentMealBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    minWidth: 28,
    alignItems: 'center',
  },
  recentMealBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  healthifyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  healthifyChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
