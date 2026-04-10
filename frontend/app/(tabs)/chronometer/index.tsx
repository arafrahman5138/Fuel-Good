import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { Card } from '../../../components/GradientCard';
import { MetabolicRing } from '../../../components/MetabolicRing';
import { EnergyBudgetCard } from '../../../components/EnergyBudgetCard';
import { MealMESBadge } from '../../../components/MealMESBadge';
import { MealScoreSheet } from '../../../components/MealScoreSheet';
import { SingleMealRow } from '../../../components/CompositeMealCard';
import { EnergyHistoryChart } from '../../../components/EnergyHistoryChart';
import { MetabolicStreakBadge } from '../../../components/MetabolicStreakBadge';
import { MetabolicCoach } from '../../../components/MetabolicCoach';
import { FlexBudgetCard } from '../../../components/FlexBudgetCard';
import { TodayProgressCard } from '../../../components/TodayProgressCard';
import { FuelScoreBadge } from '../../../components/FuelScoreBadge';
import { FuelStreakBadge } from '../../../components/FuelStreakBadge';
import { FuelCalendarHeatMap } from '../../../components/FuelCalendarHeatMap';
import { SmartFlexCard } from '../../../components/SmartFlexCard';
import { FuelSettingsSheet } from '../../../components/FuelSettingsSheet';
import { FlexMealsEarned } from '../../../components/FlexMealsEarned';
import { WeeklyFuelBreakdown } from '../../../components/WeeklyFuelBreakdown';
import { useTheme, useIsDark } from '../../../hooks/useTheme';
import { useThemeStore } from '../../../stores/themeStore';
import { useAuthStore } from '../../../stores/authStore';
import { Shadows } from '../../../constants/Shadows';
import { nutritionApi, metabolicApi, recipeApi, fuelApi } from '../../../services/api';
import { subscribeToChronometerChanges } from '../../../services/supabase';
import type { MealSuggestion } from '../../../components/MetabolicCoach';
import { useMetabolicBudgetStore, getTierConfig, getTierFromScore } from '../../../stores/metabolicBudgetStore';
import { useFuelStore } from '../../../stores/fuelStore';
import { BorderRadius, FontSize, Layout, Spacing } from '../../../constants/Colors';
import { toDateKey } from '../../../utils/dateKey';

// ── Types ──────────────────────────────────────────────────────────────

interface NutrientComparison {
  consumed: number;
  target: number;
  pct: number;
}

interface DailyLog {
  id: string;
  title: string;
  meal_type?: string;
  source_type?: string;
  source_id?: string | null;
  group_id?: string | null;
  group_mes_score?: number | null;
  group_mes_tier?: string | null;
  fuel_score?: number | null;
  nutrition?: Record<string, number>;
  nutrition_snapshot?: Record<string, number>;
  [key: string]: unknown;
}

interface DailySummary {
  daily_score: number;
  comparison: Record<string, NutrientComparison>;
  logs: DailyLog[];
}

// ── Constants ──────────────────────────────────────────────────────────

const MACROS = [
  { key: 'protein', label: 'Protein', subtitle: '', unit: 'g', icon: 'barbell-outline' as const },
  { key: 'carbs', label: 'Carbs', subtitle: 'Daily target', unit: 'g', icon: 'flash-outline' as const },
  { key: 'fat', label: 'Fat', subtitle: '', unit: 'g', icon: 'water-outline' as const },
  { key: 'fiber', label: 'Fiber', subtitle: '', unit: 'g', icon: 'leaf-outline' as const },
];



export default function ChronometerScreen() {
  const theme = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'fuel' | 'metabolic'>('fuel');
  const [mesSuggestions, setMesSuggestions] = useState<MealSuggestion[]>([]);
  const [scoreSheetMeal, setScoreSheetMeal] = useState<{ title: string; score: any } | null>(null);
  const [fuelSettingsVisible, setFuelSettingsVisible] = useState(false);
  const [currentRecipeMesMap, setCurrentRecipeMesMap] = useState<Record<string, { score: number; tier: string }>>({});

  // Metabolic Energy Score state
  const dailyMES = useMetabolicBudgetStore((s) => s.dailyScore);
  const mesBudget = useMetabolicBudgetStore((s) => s.budget);
  const mealScores = useMetabolicBudgetStore((s) => s.mealScores);
  const fetchCompositeMES = useMetabolicBudgetStore((s) => s.fetchCompositeMES);
  const remainingBudget = useMetabolicBudgetStore((s) => s.remainingBudget);
  const mesHistory = useMetabolicBudgetStore((s) => s.scoreHistory);
  const metabolicStreak = useMetabolicBudgetStore((s) => s.streak);
  const metabolicProfile = useMetabolicBudgetStore((s) => s.profile);
  const fetchProfile = useMetabolicBudgetStore((s) => s.fetchProfile);
  const fetchMetabolic = useMetabolicBudgetStore((s) => s.fetchAll);
  const fuelWeekly = useFuelStore((s) => s.weekly);
  const fuelDaily = useFuelStore((s) => s.daily);
  const fuelSettings = useFuelStore((s) => s.settings);
  const fuelStreak = useFuelStore((s) => s.streak);
  const fuelCalendar = useFuelStore((s) => s.calendar);
  const flexSuggestions = useFuelStore((s) => s.flexSuggestions);
  const fetchFuel = useFuelStore((s) => s.fetchAll);
  const fetchCalendar = useFuelStore((s) => s.fetchCalendar);
  const fetchFlexSuggestions = useFuelStore((s) => s.fetchFlexSuggestions);
  // Weekly MES — average of scores within current week (Mon–Sun)
  const chronoWeeklyMes = useMemo(() => {
    const weekStart = fuelWeekly?.week_start ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return toDateKey(d);
    })();
    const thisWeek = mesHistory.filter(
      (e: any) => e.date >= weekStart && (e.display_score ?? e.total_score ?? 0) > 0,
    );
    if (thisWeek.length === 0) return { score: 0, color: '#8B5CF6' };
    const avg = Math.round(
      thisWeek.reduce((s: number, e: any) => s + (e.display_score ?? e.total_score ?? 0), 0) / thisWeek.length,
    );
    return { score: avg, color: getTierConfig(getTierFromScore(avg)).color };
  }, [mesHistory, fuelWeekly?.week_start]);

  // Previous week fuel score for trending
  const prevWeekFuelScore = useMemo(() => {
    if (!fuelCalendar?.days || !fuelWeekly?.week_start) return undefined;
    const weekStart = new Date(fuelWeekly.week_start + 'T12:00:00');
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(weekStart.getDate() - 1);
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
    const prevStartStr = toDateKey(prevWeekStart);
    const prevEndStr = toDateKey(prevWeekEnd);
    const prevDays = fuelCalendar.days.filter(
      (d: any) => d.date >= prevStartStr && d.date <= prevEndStr && d.avg_fuel_score > 0,
    );
    if (prevDays.length === 0) return undefined;
    return Math.round(prevDays.reduce((s: number, d: any) => s + d.avg_fuel_score, 0) / prevDays.length);
  }, [fuelCalendar?.days, fuelWeekly?.week_start]);

  const hasCoreProfileSetup = !!(
    metabolicProfile
    && metabolicProfile.sex
    && metabolicProfile.goal
    && metabolicProfile.activity_level
    && metabolicProfile.weight_lb != null
    && (
      metabolicProfile.height_cm != null
      || metabolicProfile.height_ft != null
    )
  );
  const hasCompletedOnboardingProfile = !!(
    metabolicProfile
    && (metabolicProfile.onboarding_step_completed || 0) >= 11
  );
  const hasPersonalizedMetabolicBudget = !!(
    mesBudget
    && (
      mesBudget.tdee != null
      || mesBudget.ism != null
      || mesBudget.tier_thresholds != null
      || mesBudget.threshold_context != null
    )
  );
  const shouldShowProfilePrompt = !!(
    metabolicProfile !== null
    && !hasCoreProfileSetup
    && !hasCompletedOnboardingProfile
    && !hasPersonalizedMetabolicBudget
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, , mesSuggestionsData] = await Promise.all([
        nutritionApi.getDaily(selectedDayKey),
        fetchMetabolic(selectedDayKey),
        metabolicApi.getMealSuggestions(undefined, 4).catch(() => [] as MealSuggestion[]),
        fetchProfile(),
      ]);
      setDaily(data);
      setMesSuggestions(mesSuggestionsData || []);
      fetchFuel(selectedDayKey);
      fetchCalendar();
      fetchFlexSuggestions(selectedDayKey);
    } catch (e: any) {
      setError(e?.message || 'Unable to load nutrition data.');
    } finally {
      setLoading(false);
    }
  }, [fetchMetabolic, fetchProfile, fetchFuel, fetchCalendar, fetchFlexSuggestions, selectedDayKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToChronometerChanges(userId, selectedDayKey, () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        refresh().catch(() => {});
      }, 350);
    });
    return () => {
      if (timeout) clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [refresh, selectedDayKey, userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const shouldShow = value > 48;
      setShowStickyHeader((prev) => (prev === shouldShow ? prev : shouldShow));
    });
    return () => {
      scrollY.removeListener(id);
    };
  }, [scrollY]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDayKey.split('-').map(Number);
    return new Date(year || 0, (month || 1) - 1, day || 1);
  }, [selectedDayKey]);

  useEffect(() => {
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const isSelectedToday = selectedDayKey === todayKey;
  const largeDateLabel = isSelectedToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const smallDateLabel = isSelectedToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const selectedDateSubLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const mealsSectionTitle = isSelectedToday
    ? "Today's Meals"
    : `${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })} Meals`;
  const mealsSectionSubLabel = isSelectedToday
    ? 'today'
    : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const calendarDays = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const startWeekday = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells: Array<{ key: string; label: string; dayKey?: string; isCurrentMonth: boolean }> = [];

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ key: `empty-start-${i}`, label: '', isCurrentMonth: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      cells.push({
        key: `day-${day}`,
        label: `${day}`,
        dayKey: toDateKey(date),
        isCurrentMonth: true,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: `empty-end-${cells.length}`, label: '', isCurrentMonth: false });
    }

    return cells;
  }, [calendarMonth]);

  const jumpDay = useCallback((offset: number) => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + offset);
    setSelectedDayKey(toDateKey(next));
  }, [selectedDate]);

  const heroHeaderScale = scrollY.interpolate({
    inputRange: [0, 72],
    outputRange: [1, 0.76],
    extrapolate: 'clamp',
  });
  const heroHeaderOpacity = scrollY.interpolate({
    inputRange: [0, 72],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [36, 84],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyHeaderTranslateY = scrollY.interpolate({
    inputRange: [36, 84],
    outputRange: [-10, 0],
    extrapolate: 'clamp',
  });

  const macros = useMemo(() => {
    const c = daily?.comparison || {};
    return MACROS.map((m) => ({
      ...m,
      consumed: Number(c[m.key]?.consumed || 0),
      target: Number(c[m.key]?.target || 0),
      pct: Math.min(100, Number(c[m.key]?.pct || 0)),
    }));
  }, [daily]);

  const calories = useMemo(() => {
    const c = daily?.comparison?.calories;
    return { consumed: Number(c?.consumed || 0), target: Number(c?.target || 0) };
  }, [daily]);
  const fatMacroTarget = useMemo(() => {
    const target = Number(daily?.comparison?.fat?.target || 0);
    return target > 0 ? target : null;
  }, [daily]);
  const fatMacroConsumed = useMemo(() => {
    const consumed = Number(daily?.comparison?.fat?.consumed || 0);
    return consumed >= 0 ? consumed : null;
  }, [daily]);

  const logs = useMemo(() => daily?.logs ?? [], [daily?.logs]);

  // ── Backfill group MES scores for logs created before score storage ──
  const [backfilledScores, setBackfilledScores] = useState<Record<string, { score: number; tier: string }>>({});
  useEffect(() => {
    let cancelled = false;
    // Find grouped logs missing stored group_mes_score
    const groupMap = new Map<string, DailyLog[]>();
    for (const log of logs) {
      if (!log.group_id) continue;
      const list = groupMap.get(log.group_id) || [];
      list.push(log);
      groupMap.set(log.group_id, list);
    }

    const needsBackfill = Array.from(groupMap.entries()).filter(([, groupLogs]) => {
      if (groupLogs.length < 2) return false;
      // Only backfill if no stored score exists
      return !groupLogs.some((l) => l.group_mes_score != null);
    });

    if (needsBackfill.length === 0) return;

    (async () => {
      const resolved = await Promise.all(
        needsBackfill.map(async ([groupId, groupLogs]) => {
          try {
            const recipeLogs = groupLogs.filter((x) => x.source_type === 'recipe' && x.source_id);
            if (recipeLogs.length < 2) return null;
            const mainRecipeId = String(recipeLogs[0].source_id);
            const sideRecipeId = String(recipeLogs[1].source_id);

            const [mainRecipe, pairings] = await Promise.all([
              recipeApi.getDetail(mainRecipeId).catch(() => null as any),
              recipeApi.getPairingSuggestions(mainRecipeId, 50).catch(() => [] as any[]),
            ]);
            const matchedPair = pairings.find((p: any) => String(p.recipe_id) === sideRecipeId);
            if (!matchedPair) return null;

            const score = Number(
              matchedPair.pairing_adjusted_score
              ?? matchedPair.combined_display_score
              ?? matchedPair.combined_mes_score
              ?? 0
            );
            if (!(score > 0)) return null;
            const tier = score >= 82 ? 'optimal' : score >= 65 ? 'stable' : score >= 50 ? 'shaky' : 'crash_risk';
            return { groupId, groupLogs, score, tier };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;

      const updates: Record<string, { score: number; tier: string }> = {};
      for (const item of resolved) {
        if (!item) continue;
        updates[item.groupId] = { score: item.score, tier: item.tier };
        // Persist to DB so this lookup is one-time.
        for (const log of item.groupLogs) {
          nutritionApi.updateLog(log.id, { group_mes_score: item.score, group_mes_tier: item.tier }).catch(() => {});
        }
      }
      if (Object.keys(updates).length > 0) {
        setBackfilledScores((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => { cancelled = true; };
  }, [logs]);

  useEffect(() => {
    let cancelled = false;
    const recipeIds = Array.from(
      new Set(
        logs
          .filter((log) => log.source_type === 'recipe' && !!log.source_id)
          .map((log) => String(log.source_id))
      )
    );

    if (recipeIds.length === 0) {
      setCurrentRecipeMesMap({});
      return;
    }

    (async () => {
      const resolved = await Promise.all(
        recipeIds.map(async (recipeId) => {
          try {
            const recipe = await recipeApi.getDetail(recipeId);
            const nutrition = recipe?.nutrition_info || {};
            const shouldUseComposite = recipe?.needs_default_pairing === true && typeof recipe?.composite_display_score === 'number';
            const score = Number(
              shouldUseComposite
                ? recipe?.composite_display_score
                : (nutrition.mes_display_score ?? nutrition.mes_score ?? 0)
            );
            const tier = shouldUseComposite
              ? String(recipe?.composite_display_tier || 'critical')
              : (typeof nutrition.mes_display_tier === 'string' ? nutrition.mes_display_tier : 'critical');
            if (!(score > 0)) return null;
            return { recipeId, score, tier };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      const nextMap: Record<string, { score: number; tier: string }> = {};
      for (const item of resolved) {
        if (!item) continue;
        nextMap[item.recipeId] = { score: item.score, tier: item.tier };
      }
      setCurrentRecipeMesMap(nextMap);
    })();

    return () => {
      cancelled = true;
    };
  }, [logs]);

  return (
    <ScreenContainer safeArea={false} padded={false}>
      {showStickyHeader ? (
        <Animated.View
          style={[
            styles.stickyChronoHeader,
            {
              paddingTop: Math.max(insets.top, 10),
              backgroundColor: theme.background,
              borderBottomColor: theme.border + '66',
              opacity: stickyHeaderOpacity,
              transform: [{ translateY: stickyHeaderTranslateY }],
            },
          ]}
        >
          <View style={styles.chronoHeaderInner}>
            <View style={styles.chronoHeaderLeft}>
              <View style={styles.chronoDateCluster}>
                <TouchableOpacity
                  activeOpacity={0.4}
                  onPress={() => jumpDay(-1)}
                  style={styles.chronoNavButton}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={19} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => {
                    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                    setShowCalendar(true);
                  }}
                  style={styles.chronoDatePill}
                >
                  <Text style={[styles.chronoDateTitleSticky, { color: theme.text }]}>{smallDateLabel}</Text>
                  <Ionicons name="chevron-down" size={12} color={theme.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.4}
                  onPress={() => jumpDay(1)}
                  style={styles.chronoNavButton}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={19} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.addIconBtn, { backgroundColor: theme.primaryMuted }]}
              onPress={() => setShowAddMenu(!showAddMenu)}
            >
              <Ionicons name="add" size={22} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: Math.max(insets.top, 10), paddingBottom: Layout.scrollBottomPadding }}
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <Animated.View
          style={[
            styles.chronoHeroHeader,
            {
              opacity: heroHeaderOpacity,
              transform: [{ scale: heroHeaderScale }],
            },
          ]}
        >
          <View style={styles.chronoHeaderLeft}>
            <View style={styles.chronoDateCluster}>
              <TouchableOpacity
                activeOpacity={0.4}
                onPress={() => jumpDay(-1)}
                style={styles.chronoNavButton}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => {
                  setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                  setShowCalendar(true);
                }}
                style={styles.chronoDatePillHero}
              >
                <Text style={[styles.chronoDateTitleHero, { color: theme.text }]}>{largeDateLabel}</Text>
                <Ionicons name="chevron-down" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.4}
                onPress={() => jumpDay(1)}
                style={styles.chronoNavButton}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.chronoDateSubtitle, { color: theme.textSecondary }]}>{selectedDateSubLabel}</Text>
          </View>
          <View style={styles.titleActionWrap}>
            <TouchableOpacity
              style={[styles.addIconBtn, { backgroundColor: theme.primaryMuted }]}
              onPress={() => setShowAddMenu(!showAddMenu)}
            >
              <Ionicons name="add" size={22} color={theme.primary} />
            </TouchableOpacity>

          </View>
        </Animated.View>

        {/* ── View Toggle ── */}
        <View style={[styles.toggleContainer, { backgroundColor: theme.card.background, borderColor: theme.card.border }]}>
          {([
            { mode: 'fuel' as const, label: 'Fuel', icon: 'leaf', gradient: ['#22C55E', '#16A34A'] },
            { mode: 'metabolic' as const, label: 'Metabolic', icon: 'flash', gradient: ['#F59E0B', '#D97706'] },
          ]).map(({ mode, label, icon, gradient }) => {
            const active = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.8}
                onPress={() => setViewMode(mode)}
                style={[styles.toggleBtn, active && styles.toggleBtnActive, active && Shadows.sm(isDark)]}
              >
                {active ? (
                  <LinearGradient
                    colors={gradient as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.toggleGradient}
                  >
                    <Ionicons name={icon as any} size={14} color="#fff" />
                    <Text style={styles.toggleTextActive}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.toggleInner}>
                    <Ionicons name={`${icon}-outline` as any} size={14} color={theme.textTertiary} />
                    <Text style={[styles.toggleText, { color: theme.textTertiary }]}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : error ? (
          <Card style={{ marginTop: Spacing.xl }}>
            <View style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg }}>
              <Ionicons name="cloud-offline-outline" size={36} color={theme.textTertiary} />
              <Text style={{ color: theme.text, fontSize: FontSize.md, fontWeight: '700' }}>Something went wrong</Text>
              <Text style={{ color: theme.textSecondary, fontSize: FontSize.sm, textAlign: 'center' }}>{error}</Text>
              <TouchableOpacity
                onPress={refresh}
                style={{ backgroundColor: theme.primaryMuted, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginTop: Spacing.xs }}
              >
                <Text style={{ color: theme.primary, fontSize: FontSize.sm, fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <>
            {/* ════════════════════════════════════════════
                 METABOLIC VIEW
               ════════════════════════════════════════════ */}
            {viewMode === 'metabolic' && (
              <>
            {shouldShowProfilePrompt && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/chronometer/metabolic-onboarding')}
                style={{
                  backgroundColor: theme.primary + '12',
                  borderColor: theme.primary + '30',
                  borderWidth: 1,
                  borderRadius: BorderRadius.lg,
                  padding: Spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.sm,
                  marginBottom: Spacing.md,
                }}
              >
                <Ionicons name="person-add-outline" size={22} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: FontSize.sm, fontWeight: '700' }}>
                    Personalize Your Scoring
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: FontSize.xs, fontWeight: '500', marginTop: 2 }}>
                    Set up your metabolic profile for personalized MES thresholds
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            )}

            {dailyMES?.score && mesBudget && (
              <EnergyBudgetCard
                score={dailyMES.score}
                budget={mesBudget}
                remaining={remainingBudget}
                mea={dailyMES.mea}
                fatTargetOverride={fatMacroTarget}
                fatConsumedOverride={fatMacroConsumed}
                weeklyMesScore={chronoWeeklyMes.score}
                weeklyMesTierColor={chronoWeeklyMes.color}
              />
            )}

            {/* Weekly MES folded into EnergyBudgetCard via prop */}
              </>
            )}

            {/* ════════════════════════════════════════════
                 FUEL VIEW
               ════════════════════════════════════════════ */}
            {viewMode === 'fuel' && (
              // key forces remount on every tab switch → entrance animations replay
              <React.Fragment key="fuel-view">
            {fuelWeekly && fuelSettings && (
              <FlexBudgetCard
                avgScore={fuelWeekly.avg_fuel_score}
                mealCount={fuelWeekly.meal_count}
                fuelTarget={fuelSettings.fuel_target}
                flexMealsRemaining={fuelWeekly.flex_budget?.flex_meals_remaining ?? 0}
                targetMet={fuelWeekly.target_met}
                streakWeeks={fuelStreak?.current_streak ?? 0}
                expectedMeals={fuelSettings.expected_meals_per_week}
                weeklyMesScore={chronoWeeklyMes.score}
                weeklyMesTierColor={chronoWeeklyMes.color}
                prevWeekScore={prevWeekFuelScore}
                onOpenSettings={() => setFuelSettingsVisible(true)}
                onPress={() => router.push('/(tabs)/(home)/fuel-weekly' as any)}
              />
            )}

            {fuelStreak && fuelStreak.current_streak > 0 && (
              <View style={{ marginBottom: Spacing.md }}>
                <FuelStreakBadge
                  currentStreak={fuelStreak.current_streak}
                  longestStreak={fuelStreak.longest_streak}
                />
              </View>
            )}

            {/* Calendar heatmap — promoted to top of fuel view */}
            {fuelCalendar && fuelCalendar.days.length > 0 && (
              <>
              <FuelSectionLabel label="MONTHLY VIEW" theme={theme} />
              <FuelCalendarHeatMap
                month={fuelCalendar.month}
                fuelTarget={fuelCalendar.fuel_target}
                days={fuelCalendar.days}
                onPrevMonth={() => {
                  const [y, m] = fuelCalendar.month.split('-').map(Number);
                  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
                  fetchCalendar(prev);
                }}
                onNextMonth={() => {
                  const [y, m] = fuelCalendar.month.split('-').map(Number);
                  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
                  fetchCalendar(next);
                }}
              />
              </>
            )}

            {/* Weekly breakdown removed — calendar heatmap covers this */}
              </React.Fragment>
            )}

            {/* ── Today's Progress (Fuel tab only) ── */}
            {viewMode === 'fuel' && <TodayProgressCard
              logs={logs.map((l: DailyLog) => ({
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
              calories={calories}
              protein={{ consumed: Math.round(macros.find((m: any) => m.key === 'protein')?.consumed ?? 0), target: Math.round(macros.find((m: any) => m.key === 'protein')?.target ?? 0) }}
              carbs={{ consumed: Math.round(macros.find((m: any) => m.key === 'carbs')?.consumed ?? 0), target: Math.round(macros.find((m: any) => m.key === 'carbs')?.target ?? 0) }}
              fat={{ consumed: Math.round(macros.find((m: any) => m.key === 'fat')?.consumed ?? 0), target: Math.round(macros.find((m: any) => m.key === 'fat')?.target ?? 0) }}
              title={(() => {
                if (isSelectedToday) return "Today's Fuel";
                // Check if within current week (within 6 days of today)
                const today = new Date();
                const diffMs = Math.abs(today.getTime() - selectedDate.getTime());
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                if (diffDays <= 6) return `${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}'s Fuel`;
                // Outside current week — show date
                const month = selectedDate.toLocaleDateString('en-US', { month: 'long' });
                const day = selectedDate.getDate();
                const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
                return `${month} ${day}${suffix}'s Fuel`;
              })()}
              subtitle={logs.length === 0 ? 'No meals logged yet' : `${logs.length} meal${logs.length > 1 ? 's' : ''} logged`}
            />}

            {/* ── Metabolic tab: compact meal list ── */}
            {viewMode === 'metabolic' && (
              <View style={{ marginBottom: Spacing.md, marginTop: Spacing.lg }}>
                {/* Compact meal list */}
                <Card style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: logs.length > 0 ? Spacing.sm : 0 }}>
                    <Text style={{ color: theme.text, fontSize: FontSize.sm, fontWeight: '700' }}>
                      {isSelectedToday ? "Today's Meals" : `${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}'s Meals`}
                    </Text>
                    {logs.length > 0 && (
                      <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '600' }}>
                        {logs.length} logged
                      </Text>
                    )}
                  </View>
                  {logs.length === 0 ? (
                    <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500', textAlign: 'center', paddingVertical: Spacing.md }}>
                      No meals logged yet
                    </Text>
                  ) : (
                    <View>
                      {(() => {
                        // Group logs for display
                        const gidMap = new Map<string, DailyLog[]>();
                        for (const log of logs) {
                          if (log.group_id) {
                            const list = gidMap.get(log.group_id) || [];
                            list.push(log);
                            gidMap.set(log.group_id, list);
                          }
                        }
                        const usedIds = new Set<string>();
                        const rows: React.ReactNode[] = [];

                        for (const log of logs) {
                          if (usedIds.has(log.id)) continue;

                          // Grouped pair
                          if (log.group_id && gidMap.has(log.group_id)) {
                            const groupLogs = gidMap.get(log.group_id)!;
                            if (groupLogs.length >= 2) {
                              const main = groupLogs[0];
                              const side = groupLogs[1];
                              groupLogs.forEach((l) => usedIds.add(l.id));
                              const storedScore = main.group_mes_score ?? side.group_mes_score ?? null;
                              const storedTier = main.group_mes_tier ?? side.group_mes_tier ?? null;
                              const mainMes = mealScores.find((m) => m.food_log_id === main.id);
                              const mesScore = storedScore ?? mainMes?.score?.display_score ?? mainMes?.score?.total_score ?? null;
                              const mesTier = storedTier ?? mainMes?.score?.display_tier ?? mainMes?.score?.tier ?? null;
                              const tierCfg = mesTier ? getTierConfig(mesTier) : null;

                              rows.push(
                                <View key={main.id} style={[styles.compactMealRow, rows.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.surfaceHighlight }]}>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ color: theme.text, fontSize: FontSize.sm, fontWeight: '600' }} numberOfLines={1}>
                                      {main.title || 'Untitled'}
                                    </Text>
                                    <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
                                      + {side.title || 'Side'}
                                    </Text>
                                  </View>
                                  {mesScore != null && tierCfg && (
                                    <View style={[styles.compactMesBadge, { backgroundColor: tierCfg.color + '15' }]}>
                                      <Text style={{ color: tierCfg.color, fontSize: 12, fontWeight: '800' }}>{Math.round(mesScore)}</Text>
                                    </View>
                                  )}
                                </View>,
                              );
                              continue;
                            }
                          }

                          // Solo meal
                          usedIds.add(log.id);
                          const mealMes = mealScores.find((m) => m.food_log_id === log.id);
                          const mesScore = mealMes?.score?.display_score ?? mealMes?.score?.total_score ?? null;
                          const mesTier = mealMes?.score?.display_tier ?? mealMes?.score?.tier ?? null;
                          const tierCfg = mesTier ? getTierConfig(mesTier) : null;

                          rows.push(
                            <View key={log.id} style={[styles.compactMealRow, rows.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.surfaceHighlight }]}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ color: theme.text, fontSize: FontSize.sm, fontWeight: '600' }} numberOfLines={1}>
                                  {log.title || 'Untitled'}
                                </Text>
                                {log.meal_type && (
                                  <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '500', marginTop: 1, textTransform: 'capitalize' }}>
                                    {log.meal_type}
                                  </Text>
                                )}
                              </View>
                              {mesScore != null && tierCfg && (
                                <View style={[styles.compactMesBadge, { backgroundColor: tierCfg.color + '15' }]}>
                                  <Text style={{ color: tierCfg.color, fontSize: 12, fontWeight: '800' }}>{Math.round(mesScore)}</Text>
                                </View>
                              )}
                            </View>,
                          );
                        }
                        return rows;
                      })()}
                    </View>
                  )}
                </Card>
              </View>
            )}

            {/* Old inline meals section removed — replaced by TodayProgressCard above */}
            {false as any && (() => {
              const totalKcal = 0;

              // Group logs by group_id — grouped logs become a single visual row
              const groupedLogIds = new Set<string>();
              const mealGroups: { main: DailyLog; side: DailyLog | null }[] = [];
              const ungrouped: DailyLog[] = [];

              // Build map of group_id -> logs
              const groupMap = new Map<string, DailyLog[]>();
              for (const log of logs) {
                if (log.group_id) {
                  const list = groupMap.get(log.group_id) || [];
                  list.push(log);
                  groupMap.set(log.group_id, list);
                  groupedLogIds.add(log.id);
                }
              }

              // Turn grouped logs into main + side pairs
              for (const [, groupLogs] of groupMap) {
                if (groupLogs.length >= 2) {
                  // First logged = main, second = side
                  mealGroups.push({ main: groupLogs[0], side: groupLogs[1] });
                } else {
                  // Single item in group — treat as ungrouped
                  ungrouped.push(groupLogs[0]);
                }
              }

              // Collect ungrouped logs
              for (const log of logs) {
                if (!groupedLogIds.has(log.id)) {
                  ungrouped.push(log);
                }
              }

              // Interleave in original order (by first appearance)
              type DisplayItem = { type: 'group'; main: DailyLog; side: DailyLog } | { type: 'single'; log: DailyLog };
              const displayItems: DisplayItem[] = [];
              const usedIds = new Set<string>();

              for (const log of logs) {
                if (usedIds.has(log.id)) continue;
                if (log.group_id && groupMap.has(log.group_id)) {
                  const groupLogs = groupMap.get(log.group_id)!;
                  if (groupLogs.length >= 2) {
                    displayItems.push({ type: 'group', main: groupLogs[0], side: groupLogs[1] });
                    groupLogs.forEach((l) => usedIds.add(l.id));
                    continue;
                  }
                }
                displayItems.push({ type: 'single', log });
                usedIds.add(log.id);
              }

              // Count distinct meals (grouped = 1, single = 1)
              const mealCount = displayItems.length;

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/(tabs)/(home)/food-meals' as any)}
                >
                  <Card
                    style={{
                      marginTop:
                        (viewMode === 'metabolic' && dailyMES?.score && mesBudget)
                          ? Spacing.sm
                          : 0,
                      marginBottom: Spacing.md,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <LinearGradient
                          colors={[theme.primary, theme.primary + 'CC'] as any}
                          style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="restaurant" size={16} color="#fff" />
                        </LinearGradient>
                        <View>
                          <Text style={{ color: theme.text, fontSize: FontSize.md, fontWeight: '700' }}>{mealsSectionTitle}</Text>
                          <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '500', marginTop: 1 }}>
                            {mealCount === 0
                              ? `No meals logged for ${mealsSectionSubLabel}`
                              : `${mealCount} meal${mealCount > 1 ? 's' : ''} logged`}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {logs.length > 0 && (
                          <View style={{ backgroundColor: theme.primary + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full }}>
                            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800' }}>
                              {totalKcal.toFixed(0)} calories
                            </Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                      </View>
                    </View>

                    {mealCount === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm }}>
                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: theme.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="fast-food-outline" size={24} color={theme.primary} />
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: FontSize.sm, fontWeight: '600' }}>
                          {isSelectedToday ? 'No meals logged yet today' : `No meals logged for ${mealsSectionSubLabel}`}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, marginTop: Spacing.xs }}>
                          <Ionicons name="add" size={14} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: '700' }}>Log a Meal</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: Spacing.sm }}>
                        {displayItems.map((item, idx) => {
                          const isLast = idx === displayItems.length - 1;

                          if (item.type === 'group') {
                            // Combined nutrition
                            const mainSnap = item.main.nutrition_snapshot || {};
                            const sideSnap = item.side.nutrition_snapshot || {};
                            const combinedCal = Number(mainSnap.calories || 0) + Number(sideSnap.calories || 0);
                            const combinedPro = Number(mainSnap.protein || mainSnap.protein_g || 0) + Number(sideSnap.protein || sideSnap.protein_g || 0);
                            const combinedCarb = Number(mainSnap.carbs || mainSnap.carbs_g || 0) + Number(sideSnap.carbs || sideSnap.carbs_g || 0);
                            const combinedFat = Number(mainSnap.fat || mainSnap.fat_g || 0) + Number(sideSnap.fat || sideSnap.fat_g || 0);

                            // Composite MES for this grouped meal — stored at log time or backfilled
                            const storedScore = item.main.group_mes_score ?? item.side.group_mes_score ?? null;
                            const storedTier = item.main.group_mes_tier ?? item.side.group_mes_tier ?? null;
                            const backfill = item.main.group_id ? backfilledScores[item.main.group_id] : undefined;
                            const mainMes = mealScores.find((m) => m.food_log_id === item.main.id);
                            const fallbackMainScore = mainMes?.score?.display_score ?? mainMes?.score?.total_score ?? null;
                            const fallbackMainTier = mainMes?.score?.display_tier ?? mainMes?.score?.tier ?? null;
                            const displayMesScore = storedScore ?? backfill?.score ?? fallbackMainScore;
                            const displayMesTier = storedTier ?? backfill?.tier ?? fallbackMainTier;
                            const displayTierConfig = displayMesTier ? getTierConfig(displayMesTier) : null;

                            return (
                              <View
                                key={item.main.id}
                                style={{
                                  paddingVertical: Spacing.sm + 2,
                                  borderBottomWidth: isLast ? 0 : 1,
                                  borderBottomColor: theme.surfaceHighlight,
                                }}
                              >
                                {/* Main meal row */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                                  <View style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: BorderRadius.sm,
                                    backgroundColor: theme.surfaceHighlight,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    <Ionicons name="restaurant-outline" size={16} color={theme.primary} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <Text
                                        style={{ color: theme.text, fontSize: FontSize.sm, fontWeight: '600', flex: 1 }}
                                        numberOfLines={1}
                                      >
                                        {item.main.title || 'Untitled'}
                                      </Text>
                                      {(() => {
                                        const fScores = [item.main, item.side].map((l: any) => l.fuel_score).filter((s: any): s is number => s != null);
                                        const avgFS = fScores.length > 0 ? Math.round(fScores.reduce((a: number, b: number) => a + b, 0) / fScores.length) : null;
                                        return avgFS != null ? <FuelScoreBadge score={avgFS} compact fuelTarget={fuelSettings?.fuel_target} /> : null;
                                      })()}
                                      {displayMesScore != null && displayMesTier ? (
                                        <View
                                          style={{
                                            backgroundColor: (displayTierConfig?.color || theme.primary) + '14',
                                            borderColor: (displayTierConfig?.color || theme.primary) + '35',
                                            borderWidth: 1,
                                            borderRadius: BorderRadius.full,
                                            padding: 2,
                                          }}
                                        >
                                          <MealMESBadge
                                            score={displayMesScore}
                                            tier={displayMesTier}
                                            onPress={mainMes?.score ? () => setScoreSheetMeal({ title: item.main.title || 'Untitled', score: mainMes.score }) : undefined}
                                          />
                                        </View>
                                      ) : (
                                        <View
                                          style={{
                                            backgroundColor: theme.surfaceHighlight,
                                            borderRadius: BorderRadius.full,
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                          }}
                                        >
                                          <Text style={{ color: theme.textTertiary, fontSize: 10, fontWeight: '700' }}>···</Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                </View>

                                {/* Side (nested, indented) */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingLeft: 32 + Spacing.md }}>
                                  <View style={{
                                    width: 6, height: 6,
                                    borderRadius: 3,
                                    backgroundColor: '#22C55E',
                                    marginRight: 8,
                                  }} />
                                  <Ionicons name="leaf-outline" size={12} color="#22C55E" style={{ marginRight: 4 }} />
                                  <Text
                                    style={{ color: theme.textSecondary, fontSize: FontSize.xs, fontWeight: '500', flex: 1 }}
                                    numberOfLines={1}
                                  >
                                    {item.side.title || 'Side'}
                                  </Text>
                                </View>

                                {/* Combined macros */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, paddingLeft: 32 + Spacing.md }}>
                                  <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>
                                    {combinedCal.toFixed(0)} calories
                                  </Text>
                                  {combinedPro > 0 && <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>P {combinedPro.toFixed(0)}g</Text>}
                                  {combinedCarb > 0 && <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>C {combinedCarb.toFixed(0)}g</Text>}
                                  {combinedFat > 0 && <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>F {combinedFat.toFixed(0)}g</Text>}
                                </View>
                              </View>
                            );
                          }

                          // Regular single meal row
                          const mealMes = mealScores.find((m) => m.food_log_id === item.log.id);
                          return (
                            <SingleMealRow
                              key={item.log.id}
                              log={item.log}
                              mealScore={mealMes}
                              recipeScoreOverride={
                                item.log.source_type === 'recipe' && item.log.source_id
                                  ? (currentRecipeMesMap[String(item.log.source_id)] || null)
                                  : item.log.source_type === 'scan' && item.log.nutrition_snapshot?.scan_mes_score != null
                                    ? {
                                        score: Number(item.log.nutrition_snapshot?.scan_mes_score || 0),
                                        tier: String(item.log.nutrition_snapshot?.scan_mes_tier || 'critical'),
                                      }
                                    : null
                              }
                              isLast={isLast}
                              fuelTarget={fuelSettings?.fuel_target}
                            />
                          );
                        })}
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            })()}

            {/* Calendar + weekly breakdown moved into main fuel view block above */}

            {/* ════════════════════════════════════════════
                 METABOLIC VIEW (continued)
               ════════════════════════════════════════════ */}
            {viewMode === 'metabolic' && (
              <>
            {/* ── Metabolic Coach ── */}
            <MetabolicCoach
              score={dailyMES?.score ?? null}
              remaining={remainingBudget}
              budget={mesBudget}
              mealsLogged={logs.length}
              mealSuggestions={mesSuggestions}
            />
              </>
            )}

          </>
        )}
      </Animated.ScrollView>

      {/* ── Fuel Settings Sheet ── */}
      <FuelSettingsSheet
        visible={fuelSettingsVisible}
        onClose={() => {
          setFuelSettingsVisible(false);
          fetchFuel();
        }}
      />

      {/* ── Meal Score Sheet ── */}
      {scoreSheetMeal && (
        <MealScoreSheet
          visible={!!scoreSheetMeal}
          onClose={() => setScoreSheetMeal(null)}
          title={scoreSheetMeal.title}
          score={scoreSheetMeal.score}
          proteinTarget={mesBudget ? Math.round(mesBudget.protein_target_g / 3) : undefined}
        />
      )}

      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <View style={styles.calendarBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCalendar(false)} />
          <View style={[styles.calendarCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, Shadows.lg(isDark)]}>
            <View style={styles.calendarHeader}>
              <Text style={[styles.calendarMonthTitle, { color: theme.text }]}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={styles.calendarHeaderActions}>
                {selectedDayKey !== todayKey && (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    onPress={() => {
                      const today = new Date();
                      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                      setSelectedDayKey(todayKey);
                      setShowCalendar(false);
                    }}
                    style={[styles.calendarTodayBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '40' }]}
                  >
                    <Text style={[styles.calendarTodayBtnText, { color: theme.primary }]}>Today</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  style={[styles.calendarArrow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="chevron-back" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  style={[styles.calendarArrow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.calendarWeekdays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <Text key={label} style={[styles.calendarWeekdayText, { color: theme.textTertiary }]}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day) => {
                const isSelected = day.dayKey === selectedDayKey;
                const isToday = day.dayKey === todayKey;
                return (
                  <TouchableOpacity
                    key={day.key}
                    disabled={!day.isCurrentMonth}
                    activeOpacity={0.78}
                    onPress={() => {
                      if (!day.dayKey) return;
                      setSelectedDayKey(day.dayKey);
                      setShowCalendar(false);
                    }}
                    style={styles.calendarDayCell}
                  >
                    <View
                      style={[
                        styles.calendarDayCircle,
                        isSelected && { backgroundColor: theme.primary },
                        !isSelected && isToday && { borderColor: theme.primary + '88', backgroundColor: theme.primary + '10', borderWidth: 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          { color: day.isCurrentMonth ? theme.text : theme.textTertiary },
                          isSelected && { color: '#FFFFFF' },
                        ]}
                      >
                        {day.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Menu Overlay (screen-level, always visible regardless of scroll) ── */}
      {showAddMenu && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 119 }]}
            onPress={() => setShowAddMenu(false)}
          />
          <View
            style={[
              styles.addMenu,
              {
                position: 'absolute',
                top: Math.max(insets.top, 10) + 58,
                right: 12,
                zIndex: 120,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              Shadows.lg(isDark),
            ]}
          >
            {[
              { icon: 'restaurant-outline' as const, label: 'Log Meal', sub: 'From recipes', onPress: () => { setShowAddMenu(false); router.push('/(tabs)/meals?tab=browse' as any); } },
              { icon: 'nutrition-outline' as const, label: 'Log Food', sub: 'Search database', onPress: () => { setShowAddMenu(false); router.push('/(tabs)/(home)/food-search' as any); } },
              { icon: 'camera-outline' as const, label: 'Scan Photo', sub: 'Coming soon', onPress: () => { setShowAddMenu(false); Alert.alert('Coming Soon', 'Photo scanning will be available in a future update.'); } },
            ].map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={[
                  styles.addMenuItem,
                  idx < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                ]}
              >
                <View style={[styles.addMenuIcon, { backgroundColor: theme.primaryMuted }]}>
                  <Ionicons name={item.icon} size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addMenuLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.addMenuSub, { color: theme.textTertiary }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

// Fuel tab section divider
const SECTION_ICONS: Record<string, { name: string; color: string }> = {
  'YOUR FLEX BUDGET': { name: 'ticket', color: '#F59E0B' },
  'FUEL COACH': { name: 'leaf', color: '#22C55E' },
  'MONTHLY VIEW': { name: 'calendar', color: '#3B82F6' },
};

function FuelSectionLabel({ label, theme }: { label: string; theme: any }) {
  const iconCfg = SECTION_ICONS[label];
  return (
    <View style={sectionStyles.wrap}>
      <View style={[sectionStyles.line, { backgroundColor: theme.border }]} />
      {iconCfg && (
        <Ionicons name={iconCfg.name as any} size={10} color={iconCfg.color} />
      )}
      <Text style={[sectionStyles.text, { color: theme.textTertiary }]}>{label}</Text>
      <View style={[sectionStyles.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  weeklyMesSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  compactMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  compactMesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  stickyChronoHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chronoHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: Spacing.md,
    zIndex: 40,
  },
  chronoHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    zIndex: 30,
  },
  chronoHeaderLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: Spacing.md,
  },
  chronoDateCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chronoNavButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chronoDatePillHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chronoDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chronoDateTitleHero: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chronoDateTitleSticky: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  chronoDateSubtitle: {
    marginTop: 6,
    marginLeft: 36,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: Spacing.md,
  },
  titleActionWrap: {
    flexShrink: 0,
    alignItems: 'flex-end',
    zIndex: 60,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 2, fontSize: FontSize.sm },
  addIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMenu: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: Math.min(240, Dimensions.get('window').width - 48),
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 120,
    overflow: 'hidden',
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMenuLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  addMenuSub: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  center: { marginTop: Spacing.xl, alignItems: 'center' },

  /* ── View Toggle ── */
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.md,
    width: '96%',
    alignSelf: 'center',
    zIndex: 10,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  toggleBtnActive: {
  },
  toggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  toggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  toggleTextActive: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  toggleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  calendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 18,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  calendarMonthTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  calendarHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  calendarTodayBtn: {
    height: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  calendarTodayBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    paddingVertical: 2,
  },
  calendarDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
