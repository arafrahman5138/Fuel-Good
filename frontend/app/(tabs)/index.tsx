import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
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
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/GradientCard';

import { StreakBadge } from '../../components/StreakBadge';
import { MetabolicStreakBadge } from '../../components/MetabolicStreakBadge';
import { XPToast } from '../../components/XPToast';

import { EnergyHeroCard } from '../../components/EnergyHeroCard';
import { FlexInsightsCard } from '../../components/FlexInsightsCard';
import { TodayProgressCard } from '../../components/TodayProgressCard';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useGamificationStore } from '../../stores/gamificationStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { useMetabolicBudgetStore, getTierConfig, getTierFromScore } from '../../stores/metabolicBudgetStore';
import { useFuelStore } from '../../stores/fuelStore';
import { recipeApi, nutritionApi } from '../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { useEntranceAnimation } from '../../hooks/useAnimations';
import { trackBehaviorEvent } from '../../services/notifications';

const TODAY_DAY_INDEX = 22; // offset 0 in [-22..+8]
const INITIAL_DAY_INDEX = Math.max(0, TODAY_DAY_INDEX - 3);

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
  const quests = useGamificationStore((s) => s.quests);
  const completionPct = useGamificationStore((s) => s.completionPct);
  const fetchQuests = useGamificationStore((s) => s.fetchQuests);
  const fetchStats = useGamificationStore((s) => s.fetchStats);

  const nutritionStreak = useGamificationStore((s) => s.nutritionStreak);
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const loadCurrentPlan = useMealPlanStore((s) => s.loadCurrentPlan);
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
  const [loggedMealIds, setLoggedMealIds] = useState<Set<string>>(new Set());

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
    } catch {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Reset meal plan hasLoaded so it reloads
    useMealPlanStore.setState({ hasLoaded: false });
    await Promise.all([
      fetchQuests(),
      fetchStats(),
      loadRecommended(),
      loadCurrentPlan(),
      loadDailyNutrition(selectedDayKey),
      fetchMetabolic(selectedDayKey),
      fetchFuelDaily(selectedDayKey),
      fetchFuelWeekly(selectedDayKey),
      fetchFlexSuggestions(selectedDayKey),
      fetchHealthPulse(selectedDayKey),
    ]);
    setRefreshing(false);
  }, [selectedDayKey, fetchMetabolic, fetchQuests, fetchStats, loadCurrentPlan, fetchFuelDaily, fetchFuelWeekly, fetchFlexSuggestions, fetchHealthPulse]);

  useEffect(() => {
    fetchQuests();
    fetchStats();
    loadRecommended();
    loadCurrentPlan();
    loadDailyNutrition(selectedDayKey);
    fetchMetabolic(selectedDayKey);
    fetchFuelDaily(selectedDayKey);
    fetchFuelWeekly(selectedDayKey);
    fetchFlexSuggestions(selectedDayKey);
    fetchHealthPulse(selectedDayKey);
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
      // Check if this plan item was logged (source_type=meal_plan, source_id matches)
      const found = logs.some(
        (l) => l.source_type === 'meal_plan' && l.source_id === meal.id
      );
      if (found) logged.add(meal.id);
    }
    return { completed: logged.size, total: todayMeals.length, loggedIds: logged };
  }, [todayMeals, dailySummary?.logs, loggedMealIds]);

  const handleLogPlannedMeal = async (meal: any) => {
    const recipe = meal.recipe_data;
    if (!meal.id) return;
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
        servings: 1,
        quantity: 1,
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
          group_id: groupId,
          group_mes_score: combinedScore,
          group_mes_tier: combinedTier,
        });
      }

      // Immediate feedback
      setLoggedMealIds((prev) => new Set(prev).add(meal.id));
      // Refresh nutrition data
      loadDailyNutrition(selectedDayKey);

      const sideLabel = hasPairing ? ` + ${preferredPairing.title}` : '';
      Alert.alert('Logged!', `"${recipe?.title || meal.meal_type}"${sideLabel} added to today's log.`);
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
  // Daily MES — for Today's Fuel card
  const dailyMesScore = Math.round(dailyMES?.score?.display_score ?? dailyMES?.score?.total_score ?? 0);
  const dailyMesTierKey = dailyMES?.score?.display_tier ?? dailyMES?.score?.tier ?? 'critical';
  const dailyMesTierColor = getTierConfig(dailyMesTierKey).color;
  // Weekly MES — average scores from the current week (Mon–Sun), matching fuel weekly bounds
  const weekStart = fuelWeekly?.week_start ?? (() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return d.toISOString().slice(0, 10);
  })();
  const thisWeekScores = scoreHistory
    .filter((e) => e.date >= weekStart && (e.display_score ?? e.total_score ?? 0) > 0);
  const weeklyMesScore = thisWeekScores.length > 0
    ? Math.round(thisWeekScores.reduce((sum, e) => sum + (e.display_score ?? e.total_score ?? 0), 0) / thisWeekScores.length)
    : 0;
  const weeklyMesTierColor = getTierConfig(getTierFromScore(weeklyMesScore)).color;
  // Homepage ring shows weekly avg — big-picture view; today's detail is in Chrono
  const fuelScoreValue = Math.round(fuelWeekly?.avg_fuel_score ?? fuelDaily?.avg_fuel_score ?? 0);
  const isDarkTheme = theme.background === '#0A0A0F';

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
      icon: 'sparkles-outline',
      label: 'Scan Food',
      description: 'Analyze a meal or product',
      route: '/(tabs)/chat',
      accent: '#22C55E',
      accentBg: '#EAF8EF',
    },
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
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/browse/${item.id}` as any)}
        style={{ marginRight: Spacing.md }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.recCard, { width: CARD_WIDTH, height: CARD_WIDTH * 1.25 }]}
        >
          <Ionicons name="restaurant" size={28} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', top: 12, right: 12 }} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl }} />
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
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [CARD_WIDTH]);

  return (
    <ScreenContainer safeArea={false}>
      <XPToast message={xpToast} icon={xpToastIcon} onDismissed={() => setXpToast(null)} />
      {showStickyHeader ? (
        <Animated.View
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
            >
              <Ionicons name="calendar-outline" size={14} color={theme.primary} />
              <Text style={[styles.calendarPillText, { color: theme.text }]}>{selectedCalendarLabel}</Text>
              <Ionicons name="chevron-down" size={12} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={styles.stickyHeaderRight}>
              {metabolicStreak && metabolicStreak.current_streak > 0 && (
                <MetabolicStreakBadge currentStreak={metabolicStreak.current_streak} compact />
              )}
              {nutritionStreak > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primaryMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full }}>
                  <Ionicons name="leaf" size={14} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: FontSize.xs, fontWeight: '700' }}>{nutritionStreak}d</Text>
                </View>
              )}
              <StreakBadge streak={user?.current_streak || 0} compact />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={[styles.profileButton, Shadows.sm(isDarkTheme)]}
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
      ) : null}
      <Animated.ScrollView
        ref={homeScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 10) }]}
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
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
              {metabolicStreak && metabolicStreak.current_streak > 0 && (
                <MetabolicStreakBadge currentStreak={metabolicStreak.current_streak} compact />
              )}
              {nutritionStreak > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primaryMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full }}>
                  <Ionicons name="leaf" size={14} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: FontSize.xs, fontWeight: '700' }}>{nutritionStreak}d</Text>
                </View>
              )}
              <StreakBadge streak={user?.current_streak || 0} compact />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={[styles.profileButton, Shadows.sm(isDarkTheme)]}
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

        <Animated.View
          style={[
            styles.weekStripWrap,
            {
              height: scrollY.interpolate({
                inputRange: [0, 32, 100],
                outputRange: [72, 44, 0],
                extrapolate: 'clamp',
              }),
              opacity: scrollY.interpolate({
                inputRange: [0, 52, 92],
                outputRange: [1, 0.55, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.weekStrip,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 80],
                  outputRange: [1, 0.92],
                  extrapolate: 'clamp',
                }),
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
        </Animated.View>

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
          mealCount={fuelDaily?.meal_count ?? 0}
          proteinRemaining={remainingBudget?.protein_remaining_g}
          fiberRemaining={remainingBudget?.fiber_remaining_g}
          healthPulse={healthPulse ? {
            fuel: healthPulse.fuel,
            metabolic: healthPulse.metabolic,
            nutrition: healthPulse.nutrition,
          } : undefined}
        />

        {/* ── Today's Progress ────────────────────────────────────────── */}
        <TodayProgressCard
          logs={(dailySummary?.logs ?? []).map((l) => ({
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
          }))}
          mealScores={mealScores}
          fuelTarget={fuelSettings?.fuel_target}
          todayFuelScore={Math.round(fuelDaily?.avg_fuel_score ?? 0)}
          todayMesScore={dailyMesScore}
          todayMesTierColor={dailyMesTierColor}
          calories={{ consumed: calorieConsumed, target: calorieTarget }}
          protein={{ consumed: proteinConsumed, target: proteinTarget }}
          carbs={{ consumed: carbsConsumed, target: carbsTarget }}
          fat={{ consumed: fatConsumed, target: fatTarget }}
        />

        {/* ── Today's Plan ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: Spacing.md }}>
          <Card padding={0}>
            {/* Card header */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/meals?tab=plan' as any)}
              style={s.todayHeader}
            >
              <View style={[s.planHeaderIcon, { backgroundColor: theme.primary + '14' }]}>
                <Ionicons name="calendar" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.todayTitle, { color: theme.text }]}>Today's Plan</Text>
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
                        activeOpacity={0.7}
                        onPress={() => meal.recipe_data?.id && router.push(`/browse/${meal.recipe_data.id}` as any)}
                        style={s.mealRowBody}
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
                            numberOfLines={1}
                          >
                            {recipeName}
                          </Text>
                          <Text style={[s.mealType, { color: theme.textTertiary }]}>{meal.meal_type}</Text>
                        </View>
                      </TouchableOpacity>
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
                        >
                          <Ionicons
                            name={isLogging ? 'hourglass-outline' : 'add'}
                            size={16}
                            color={theme.primary}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[s.logBtn, { backgroundColor: '#22C55E18' }]}>
                          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
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

        {/* ── Flex Insights (tickets + coach) ─────────────────────────── */}
        <FlexInsightsCard
          flexMealsRemaining={fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0}
          coachContext={flexSuggestions?.context}
          coachSuggestions={flexSuggestions?.suggestions?.length ? flexSuggestions.suggestions : undefined}
        />

        {/* ── Daily Quests ──────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Quests</Text>
        <Card style={{ overflow: 'hidden', padding: 0, marginBottom: Spacing.xl }}>
          <View style={[styles.questHeader, { backgroundColor: theme.surface }]}>
            <View style={styles.questHeaderTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Ionicons name="flame" size={18} color={theme.accent} />
                <Text style={[styles.questHeaderTitle, { color: theme.text }]}>Daily Progress</Text>
              </View>
              <View style={[styles.questPctBadge, { backgroundColor: completionPct === 100 ? theme.primary : theme.accentMuted }]}>
                <Text style={[styles.questPctText, { color: completionPct === 100 ? '#fff' : theme.accent }]}>{completionPct}%</Text>
              </View>
            </View>
            <View style={[styles.questProgressTrack, { backgroundColor: theme.surfaceHighlight }]}>
              <LinearGradient
                colors={completionPct === 100 ? ['#22C55E', '#059669'] : ['#F59E0B', '#F97316']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.questProgressFill, { width: `${Math.max(completionPct, 2)}%` as any }]}
              />
            </View>
          </View>
          {quests.map((quest, idx) => {
            const progress = quest.target_value > 0 ? quest.current_value / quest.target_value : 0;
            return (
              <View
                key={quest.id}
                style={[
                  styles.questItem,
                  { borderBottomColor: theme.border },
                  idx === quests.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[
                  styles.questIcon,
                  { backgroundColor: quest.completed ? theme.primaryMuted : theme.surfaceHighlight },
                ]}>
                  {quest.completed ? (
                    <Ionicons name="checkmark" size={16} color={theme.primary} />
                  ) : (
                    <Ionicons
                      name={
                        quest.quest_type === 'log_meal' ? 'restaurant-outline' :
                        quest.quest_type === 'logging' ? 'restaurant-outline' :
                        quest.quest_type === 'healthify' ? 'heart-outline' :
                        quest.quest_type === 'score' ? 'trophy-outline' :
                        quest.quest_type === 'cook' ? 'flame-outline' :
                        quest.quest_type === 'metabolic' ? 'flash-outline' :
                        quest.quest_type === 'fuel' ? 'leaf-outline' :
                        'star-outline'
                      }
                      size={16}
                      color={
                        quest.quest_type === 'metabolic' ? theme.accent :
                        quest.quest_type === 'fuel' ? theme.primary :
                        theme.textSecondary
                      }
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.questItemTitleRow}>
                    <Text
                      style={[
                        styles.questTitle,
                        { color: quest.completed ? theme.textTertiary : theme.text },
                        quest.completed && { textDecorationLine: 'line-through' },
                      ]}
                      numberOfLines={1}
                    >
                      {quest.title}
                    </Text>
                    <View style={[styles.questXpBadge, { backgroundColor: quest.completed ? theme.primaryMuted : theme.surfaceHighlight }]}>
                      <Text style={[styles.questXpText, { color: quest.completed ? theme.primary : theme.textSecondary }]}>+{quest.xp_reward} XP</Text>
                    </View>
                  </View>
                  <View style={[styles.questMiniTrack, { backgroundColor: theme.surfaceHighlight }]}>
                    <View
                      style={[
                        styles.questMiniFill,
                        {
                          width: `${Math.min(progress * 100, 100)}%` as any,
                          backgroundColor: quest.completed ? theme.primary : theme.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.questMeta, { color: theme.textTertiary }]}>
                    {quest.current_value}/{quest.target_value}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>

        {/* ── Quick Actions (with Healthify CTA) ─────────────────────── */}
        <Animated.View style={[actionsEntrance.style, { marginTop: Spacing.md }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>

        {/* Healthify CTA — full-width hero tile */}
        <TouchableOpacity
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

        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              onPress={() => {
                trackBehaviorEvent('home_quick_action_used', { label: action.label, route: action.route });
                router.push(action.route as any);
              }}
              style={[styles.actionCard, { width: (width - Spacing.xl * 2 - Spacing.sm) / 2 }]}
            >
              <Card
                padding={Spacing.md}
                style={[
                  styles.actionCardInner,
                  {
                    backgroundColor: isDarkTheme ? theme.surfaceElevated : '#FBFAF7',
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.actionCardTopRow}>
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: isDarkTheme ? action.accent + '1A' : action.accentBg },
                    ]}
                  >
                    <Ionicons name={action.icon} size={19} color={action.accent} />
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={isDarkTheme ? theme.textSecondary : theme.textTertiary}
                  />
                </View>
                <View style={styles.actionCopy}>
                  <Text
                    style={[styles.actionLabel, { color: isDarkTheme ? '#F3F4F6' : theme.text }]}
                    numberOfLines={1}
                  >
                    {action.label}
                  </Text>
                  <Text style={[styles.actionDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                    {action.description}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
        </Animated.View>

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

        {/* ── Daily Tip ──────────────────────────────────────────────── */}
        <Card style={{ marginTop: Spacing.md, borderLeftWidth: 3, borderLeftColor: theme.accent }}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb" size={20} color={theme.accent} />
            <Text style={[styles.tipTitle, { color: theme.accent }]}>Daily Tip</Text>
          </View>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            {dailyTip}
          </Text>
        </Card>

        <View style={{ height: Spacing.huge }} />
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

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
    alignItems: 'center',
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
    flex: 1,
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
    overflow: 'hidden',
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
  questHeader: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  questHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  questHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  questPctBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  questPctText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  questProgressTrack: {
    height: 6,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  questProgressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  questItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  questIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  questTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.xs,
  },
  questXpBadge: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  questXpText: {
    fontSize: FontSize.xs - 1,
    fontWeight: '700',
  },
  questMiniTrack: {
    height: 4,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  questMiniFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  questMeta: {
    fontSize: FontSize.xs - 1,
  },
});
