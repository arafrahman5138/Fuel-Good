import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  FlatList,
  Platform,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/GradientCard';
import { XPBar } from '../../components/XPBar';
import { StreakBadge } from '../../components/StreakBadge';
import { MetabolicRing } from '../../components/MetabolicRing';
import { MetabolicStreakBadge } from '../../components/MetabolicStreakBadge';
import { XPToast } from '../../components/XPToast';
import { SingleMealRow } from '../../components/CompositeMealCard';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useGamificationStore } from '../../stores/gamificationStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { useMetabolicBudgetStore, getTierConfig } from '../../stores/metabolicBudgetStore';
import { gameApi, recipeApi, nutritionApi } from '../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { useEntranceAnimation } from '../../hooks/useAnimations';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42;
const RING_SIZE = 100;
const RING_STROKE = 8;
const CHRONO_MODE_TAB_WIDTH = 56;
const CHRONO_MODE_TAB_GAP = 4;
const CHRONO_MODE_BAR_INSET = 4;
const CHRONO_MODE_TAB_HEIGHT = 32;
const DAY_CONTENT_WIDTH = width - Spacing.xl * 2;
const DAY_PILL_WIDTH = DAY_CONTENT_WIDTH / 7;
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

const MACRO_KEYS = new Set(['calories', 'protein', 'carbs', 'fat', 'fiber']);

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  route: string;
  accent: string;
  accentBg: string;
}

interface WeeklyStats {
  meals_cooked: number;
  recipes_saved: number;
  foods_explored: number;
  xp_earned: number;
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
    nutrition_snapshot?: Record<string, any>;
  }>;
}

// ── Circular Progress Ring ─────────────────────────────────────────────
function NutritionRing({ score, color, size = RING_SIZE, strokeWidth = RING_STROKE }: {
  score: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const theme = useTheme();
  const clampedScore = Math.min(100, Math.max(0, score));
  // Create ring segments using 4 quadrant Views
  const innerSize = size - strokeWidth * 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background track */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: theme.surfaceHighlight,
      }} />
      {/* Progress ring — right half */}
      {clampedScore > 0 && (
        <View style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: clampedScore > 25 ? color : 'transparent',
          borderBottomColor: clampedScore > 50 ? color : 'transparent',
          borderLeftColor: clampedScore > 75 ? color : 'transparent',
          transform: [{ rotate: '-45deg' }],
        }} />
      )}
      {/* Inner circle (mask center) */}
      <View style={{
        width: innerSize,
        height: innerSize,
        borderRadius: innerSize / 2,
        backgroundColor: theme.card.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: '800', color }}>{clampedScore}</Text>
        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.textTertiary, marginTop: -2 }}>NutriScore</Text>
      </View>
    </View>
  );
}

// ── Macro Status Badge ─────────────────────────────────────────────────
function MacroBadge({ label, pct, theme }: { label: string; pct: number; theme: any }) {
  const status = pct >= 80 ? 'GREAT' : pct >= 50 ? 'GOOD' : pct >= 25 ? 'LOW' : 'START';
  const statusColor = pct >= 80 ? '#22C55E' : pct >= 50 ? '#3B82F6' : pct >= 25 ? '#F59E0B' : theme.textTertiary;
  const statusBg = pct >= 80 ? 'rgba(34,197,94,0.12)' : pct >= 50 ? 'rgba(59,130,246,0.12)' : pct >= 25 ? 'rgba(245,158,11,0.12)' : theme.surfaceHighlight;

  return (
    <View style={s.macroBadgeRow}>
      <Text style={[s.macroBadgeLabel, { color: theme.text }]}>{label}</Text>
      <View style={[s.macroBadgePill, { backgroundColor: statusBg }]}>
        <Text style={[s.macroBadgeStatus, { color: statusColor }]}>{status}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const homeScrollRef = useRef<ScrollView>(null);
  const user = useAuthStore((s) => s.user);
  const quests = useGamificationStore((s) => s.quests);
  const completionPct = useGamificationStore((s) => s.completionPct);
  const fetchQuests = useGamificationStore((s) => s.fetchQuests);
  const fetchStats = useGamificationStore((s) => s.fetchStats);
  const stats = useGamificationStore((s) => s.stats);
  const nutritionStreak = useGamificationStore((s) => s.nutritionStreak);
  const currentPlan = useMealPlanStore((s) => s.currentPlan);
  const loadCurrentPlan = useMealPlanStore((s) => s.loadCurrentPlan);
  const dailyMES = useMetabolicBudgetStore((s) => s.dailyScore);
  const mealScores = useMetabolicBudgetStore((s) => s.mealScores);
  const remainingBudget = useMetabolicBudgetStore((s) => s.remainingBudget);
  const metabolicStreak = useMetabolicBudgetStore((s) => s.streak);
  const fetchMetabolic = useMetabolicBudgetStore((s) => s.fetchAll);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    meals_cooked: 0,
    recipes_saved: 0,
    foods_explored: 0,
    xp_earned: 0,
  });
  const [statsError, setStatsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recommended, setRecommended] = useState<RecommendedRecipe[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [xpToast, setXpToast] = useState<string | null>(null);
  const [xpToastIcon, setXpToastIcon] = useState<string>('flash');
  const heroEntrance = useEntranceAnimation(0);
  const chronoEntrance = useEntranceAnimation(80);
  const actionsEntrance = useEntranceAnimation(160);
  const [chronoPanelView, setChronoPanelView] = useState<'snapshot' | 'logged' | 'activity'>('snapshot');
  const [previousChronoPanelView, setPreviousChronoPanelView] = useState<'snapshot' | 'logged' | 'activity' | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => toDateKey(new Date()));
  const chronoModeAnim = useRef(new Animated.Value(0)).current;
  const chronoPanelTransition = useRef(new Animated.Value(1)).current;
  const weekPulse = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const weekListRef = useRef<FlatList<any>>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

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

  const loadStats = async () => {
    setStatsError(false);
    try {
      const data = await gameApi.getWeeklyStats();
      setWeeklyStats(data);
    } catch {
      setStatsError(true);
    }
  };

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
      loadStats(),
      fetchQuests(),
      fetchStats(),
      loadRecommended(),
      loadCurrentPlan(),
      loadDailyNutrition(selectedDayKey),
      fetchMetabolic(selectedDayKey),
    ]);
    setRefreshing(false);
  }, [selectedDayKey, fetchMetabolic, fetchQuests, fetchStats, loadCurrentPlan]);

  useEffect(() => {
    loadStats();
    fetchQuests();
    fetchStats();
    loadRecommended();
    loadCurrentPlan();
    loadDailyNutrition(selectedDayKey);
    fetchMetabolic(selectedDayKey);
  }, []);

  useEffect(() => {
    loadDailyNutrition(selectedDayKey);
    fetchMetabolic(selectedDayKey);
  }, [selectedDayKey, fetchMetabolic]);

  useFocusEffect(
    useCallback(() => {
      loadDailyNutrition(selectedDayKey);
      fetchMetabolic(selectedDayKey);
      loadCurrentPlan();
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

  // Nutrition ring color based on score
  const ringColor = useMemo(() => {
    const score = dailySummary?.daily_score ?? 0;
    if (score >= 80) return '#22C55E';
    if (score >= 50) return '#3B82F6';
    if (score >= 25) return '#F59E0B';
    return '#EF4444';
  }, [dailySummary]);

  // Top 2 micronutrients to highlight (lowest % — areas to improve)
  const topMicros = useMemo(() => {
    const comp = dailySummary?.comparison;
    if (!comp) return [];
    return Object.entries(comp)
      .filter(([key]) => !MACRO_KEYS.has(key) && comp[key]?.target > 0)
      .map(([key, val]) => ({
        key,
        label: key
          .replace(/_(mg|mcg|g)$/i, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (s: string) => s.toUpperCase()),
        pct: val.pct ?? 0,
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 2);
  }, [dailySummary]);

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
  const mesDisplayScore = Math.round(dailyMES?.score?.display_score ?? dailyMES?.score?.total_score ?? 0);
  const mesTierKey = dailyMES?.score?.display_tier ?? dailyMES?.score?.tier ?? 'critical';
  const mesTierLabelMap: Record<string, string> = {
    optimal: 'Elite Fuel',
    good: 'Momentum',
    moderate: 'Steady Burn',
    low: 'Low Energy',
    critical: 'Energy Drain',
    // Legacy aliases
    stable: 'Momentum',
    shaky: 'Steady Burn',
    crash_risk: 'Energy Drain',
  };
  const mesTierLabel = mesTierLabelMap[mesTierKey] || 'Energy Drain';
  const mesTierColor = getTierConfig(mesTierKey).color;
  const isDarkTheme = theme.background === '#0A0A0F';
  const homeScorePanelWidth = width < 390 ? 112 : 122;
  const homeScoreRingSize = width < 390 ? 96 : 106;
  const loggedMeals = useMemo(() => dailySummary?.logs || [], [dailySummary]);
  const loggedDisplayItems = useMemo(() => {
    const items: Array<
      | { type: 'single'; log: NonNullable<DailySummary['logs']>[number] }
      | { type: 'group'; main: NonNullable<DailySummary['logs']>[number]; side: NonNullable<DailySummary['logs']>[number] }
    > = [];
    const seenGroups = new Set<string>();

    for (const log of loggedMeals) {
      if (log.group_id) {
        if (seenGroups.has(log.group_id)) continue;
        const groupLogs = loggedMeals.filter((x) => x.group_id === log.group_id);
        if (groupLogs.length >= 2) {
          items.push({ type: 'group', main: groupLogs[0], side: groupLogs[1] });
          seenGroups.add(log.group_id);
          continue;
        }
      }
      items.push({ type: 'single', log });
    }

    return items;
  }, [loggedMeals]);

  const openChronoPanelRoute = (mode: 'snapshot' | 'logged' | 'activity') => {
    if (mode === 'snapshot') {
      router.push('/(tabs)/chronometer' as any);
      return;
    }
    if (mode === 'logged') {
      router.push('/food/meals' as any);
      return;
    }
    router.push('/(tabs)/chronometer' as any);
  };

  const handleChronoModePress = (mode: 'snapshot' | 'logged' | 'activity') => {
    if (chronoPanelView === mode) {
      openChronoPanelRoute(mode);
      return;
    }
    const modeOrder: Array<'snapshot' | 'logged' | 'activity'> = ['snapshot', 'logged', 'activity'];
    const nextIndex = modeOrder.indexOf(mode);

    Animated.spring(chronoModeAnim, {
      toValue: nextIndex,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();

    setPreviousChronoPanelView(chronoPanelView);
    setChronoPanelView(mode);
    chronoPanelTransition.setValue(0);
    Animated.timing(chronoPanelTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPreviousChronoPanelView(null);
    });
  };

  const renderChronoPanel = (mode: 'snapshot' | 'logged' | 'activity') => {
    if (mode === 'snapshot') {
      return (
        <View style={styles.chronoSnapshotWrap}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => openChronoPanelRoute('snapshot')}
          >
            <LinearGradient
              colors={
                isDarkTheme
                  ? ([theme.surface, theme.surfaceElevated] as any)
                  : (['#FFFFFF', '#FBFCF9'] as any)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.chronoHero, { borderColor: theme.primary + '22' }]}
            >
              <View style={styles.chronoHeroLeft}>
                <Text style={[styles.chronoEyebrow, { color: theme.primary }]}>Daily Fuel</Text>
                <View style={styles.chronoValueRow}>
                  <View style={styles.chronoValueGroup}>
                    <Text style={[styles.chronoValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                      {calorieConsumed}
                      <Text style={[styles.chronoValueTarget, { color: theme.textSecondary }]}> / {calorieTarget || 0}</Text>
                    </Text>
                  </View>
                  <Text
                    style={[styles.chronoLabelInline, { color: theme.textSecondary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.9}
                  >
                    cal
                  </Text>
                </View>
                <View style={styles.chronoPillsRow}>
                  <View style={[styles.chronoPill, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                    <Ionicons name="barbell-outline" size={12} color={theme.primary} />
                    <Text style={[styles.chronoPillText, { color: theme.primary }]}>
                      {Math.max((proteinTarget || 0) - proteinConsumed, 0)}g protein left
                    </Text>
                  </View>
                  <View style={[styles.chronoPill, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
                    <Ionicons name="leaf-outline" size={12} color="#D97706" />
                    <Text style={[styles.chronoPillText, { color: '#D97706' }]}>
                      {Math.round(remainingBudget?.carb_headroom_g ?? remainingBudget?.sugar_headroom_g ?? 0)}g carb room
                    </Text>
                  </View>
                </View>
                <View style={[styles.chronoCalTrack, { backgroundColor: theme.surfaceHighlight }]}>
                  <LinearGradient
                    colors={[theme.primary, '#7DD3A7'] as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.chronoCalFill,
                      { width: `${Math.max(6, Math.min(100, calorieTarget > 0 ? (calorieConsumed / calorieTarget) * 100 : 0))}%` },
                    ]}
                  />
                </View>
              </View>
              <View
                style={[
                  styles.chronoHeroScorePanel,
                  {
                    backgroundColor: isDarkTheme ? theme.surfaceHighlight : '#FCFCFA',
                    width: homeScorePanelWidth,
                  },
                ]}
              >
                <View style={[styles.chronoMesPill, styles.chronoMesPillCentered, { backgroundColor: mesTierColor + '18' }]}>
                  <Text style={[styles.chronoMesPillText, { color: mesTierColor }]}>{mesTierLabel}</Text>
                </View>
                <View style={styles.chronoRingWrap}>
                  <MetabolicRing
                    score={dailyMES?.score?.display_score ?? dailyMES?.score?.total_score ?? 0}
                    tier={dailyMES?.score?.display_tier ?? dailyMES?.score?.tier ?? 'crash_risk'}
                    size={homeScoreRingSize}
                    showLabel
                  />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.chronoMiniGrid}>
            {[
              { label: 'Protein', consumed: proteinConsumed, target: proteinTarget, icon: 'barbell-outline' as const, color: '#22C55E' },
              { label: 'Fat', consumed: fatConsumed, target: fatTarget, icon: 'water-outline' as const, color: '#A855F7' },
              { label: 'Fiber', consumed: fiberConsumed, target: fiberTarget, icon: 'leaf-outline' as const, color: '#3B82F6' },
              { label: 'Carbs', consumed: carbsConsumed, target: carbsTarget, icon: 'nutrition-outline' as const, color: '#F59E0B' },
            ].map((item) => {
              const target = item.target || 0;
              const progressPct = target > 0 ? Math.max(0, Math.min(100, (item.consumed / target) * 100)) : 0;
              return (
                <TouchableOpacity
                  key={item.label}
                  activeOpacity={0.88}
                  onPress={() => openChronoPanelRoute('snapshot')}
                  style={[styles.chronoMiniCard, { backgroundColor: theme.card.background, borderColor: theme.border }]}
                >
                  <View style={[styles.chronoMiniAccentTrack, { backgroundColor: theme.surfaceHighlight }]}>
                    <View style={[styles.chronoMiniAccentFill, { backgroundColor: item.color, width: `${Math.max(progressPct, 14)}%` }]} />
                  </View>
                  <View style={styles.chronoMiniHeaderRow}>
                    <Text style={[styles.chronoMiniLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={[styles.chronoMiniIcon, { backgroundColor: item.color + '16' }]}>
                      <Ionicons name={item.icon} size={14} color={item.color} />
                    </View>
                  </View>
                  <Text style={[styles.chronoMiniValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>
                    {item.consumed}
                    <Text style={[styles.chronoMiniTarget, { color: theme.textSecondary }]}>/{item.target || 0}g</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (mode === 'logged') {
      return (
        <View style={styles.chronoPanelFill}>
          <View style={[styles.chronoLoggedCard, styles.chronoFixedCard, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
            <View style={styles.chronoLoggedHeader}>
              <Text style={[styles.chronoLoggedTitle, { color: theme.text }]}>Today's Meals</Text>
              <View style={[styles.chronoLoggedCountPill, { backgroundColor: theme.primaryMuted }]}>
                <Text style={[styles.chronoLoggedCountText, { color: theme.primary }]}>{loggedMeals.length}</Text>
              </View>
            </View>
            {loggedMeals.length > 0 ? (
              <ScrollView
                style={styles.chronoLoggedScroll}
                contentContainerStyle={styles.chronoLoggedScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <View style={styles.chronoLoggedList}>
                  {loggedDisplayItems.map((item, idx) => {
                    const isLast = idx === loggedDisplayItems.length - 1;

                    if (item.type === 'group') {
                      const mainSnap = item.main.nutrition_snapshot || {};
                      const sideSnap = item.side.nutrition_snapshot || {};
                      const combinedCal = Number(mainSnap.calories || 0) + Number(sideSnap.calories || 0);
                      const combinedPro = Number(mainSnap.protein || mainSnap.protein_g || 0) + Number(sideSnap.protein || sideSnap.protein_g || 0);
                      const combinedCarb = Number(mainSnap.carbs || mainSnap.carbs_g || 0) + Number(sideSnap.carbs || sideSnap.carbs_g || 0);
                      const combinedFat = Number(mainSnap.fat || mainSnap.fat_g || 0) + Number(sideSnap.fat || sideSnap.fat_g || 0);
                      const displayMesScore = item.main.group_mes_score ?? item.side.group_mes_score ?? null;
                      const displayMesTier = item.main.group_mes_tier ?? item.side.group_mes_tier ?? null;
                      const tierCfg = displayMesTier ? getTierConfig(displayMesTier) : null;

                      return (
                        <View
                          key={`group-${item.main.group_id || item.main.id || idx}`}
                          style={[
                            styles.homeLoggedGroupRow,
                            !isLast && { borderBottomWidth: 1, borderBottomColor: theme.surfaceHighlight },
                          ]}
                        >
                          <View style={styles.homeLoggedMainRow}>
                            <View style={[styles.chronoLoggedIcon, { backgroundColor: theme.surfaceHighlight }]}>
                              <Ionicons name="restaurant-outline" size={14} color={theme.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.homeLoggedTitleRow}>
                                <Text style={[styles.chronoLoggedMealName, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                                  {item.main.title || 'Meal'}
                                </Text>
                                {displayMesScore != null && displayMesTier ? (
                                  <View
                                    style={[
                                      styles.homeLoggedBadgeWrap,
                                      {
                                        backgroundColor: (tierCfg?.color || theme.primary) + '14',
                                        borderColor: (tierCfg?.color || theme.primary) + '35',
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.homeLoggedBadgeText, { color: tierCfg?.color || theme.primary }]}>
                                      {Math.round(displayMesScore)}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>
                          <View style={styles.homeLoggedSideRow}>
                            <View style={styles.homeLoggedSideDot} />
                            <Ionicons name="leaf-outline" size={12} color="#22C55E" style={{ marginRight: 4 }} />
                            <Text style={[styles.chronoLoggedMeta, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
                              {item.side.title || 'Side'}
                            </Text>
                          </View>
                          <View style={styles.homeLoggedMacroRow}>
                            <Text style={[styles.chronoLoggedMeta, { color: theme.textTertiary }]}>{combinedCal.toFixed(0)} calories</Text>
                            {combinedPro > 0 && <Text style={[styles.chronoLoggedMeta, { color: theme.textTertiary }]}>P {combinedPro.toFixed(0)}g</Text>}
                            {combinedCarb > 0 && <Text style={[styles.chronoLoggedMeta, { color: theme.textTertiary }]}>C {combinedCarb.toFixed(0)}g</Text>}
                            {combinedFat > 0 && <Text style={[styles.chronoLoggedMeta, { color: theme.textTertiary }]}>F {combinedFat.toFixed(0)}g</Text>}
                          </View>
                        </View>
                      );
                    }

                    const mealMes = mealScores.find((m) => m.food_log_id === item.log.id);
                    return (
                      <SingleMealRow
                        key={item.log.id || `${item.log.title || 'meal'}-${idx}`}
                        log={item.log as any}
                        mealScore={mealMes}
                        isLast={isLast}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.chronoLoggedEmpty}>
                <Ionicons name="restaurant-outline" size={20} color={theme.textTertiary} />
                <Text style={[styles.chronoLoggedEmptyText, { color: theme.textSecondary }]}>No meals logged yet today</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.chronoPanelFill}>
        <View style={[styles.chronoLoggedCard, styles.chronoFixedCard, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
          <View style={styles.chronoLoggedHeader}>
            <Text style={[styles.chronoLoggedTitle, { color: theme.text }]}>Activity Snapshot</Text>
            <View style={[styles.chronoLoggedCountPill, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.chronoLoggedCountText, { color: theme.primary }]}>Today</Text>
            </View>
          </View>
          <View style={styles.activityGrid}>
            {[
              { label: 'Steps', value: '—', sub: '', icon: 'walk-outline' as const, color: '#22C55E' },
              { label: 'Active Min', value: '—', sub: '', icon: 'time-outline' as const, color: '#F59E0B' },
              { label: 'Distance', value: '—', sub: '', icon: 'map-outline' as const, color: '#3B82F6' },
              { label: 'Burned', value: '—', sub: '', icon: 'flame-outline' as const, color: '#EF4444' },
            ].map((item) => (
              <View
                key={item.label}
                style={[
                  styles.activityCard,
                  { backgroundColor: isDarkTheme ? theme.surface : '#FFFFFF', borderColor: theme.border },
                ]}
              >
                <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon} size={14} color={item.color} />
                </View>
                <Text style={[styles.activityValue, { color: theme.textTertiary }]}>{item.value}</Text>
                <Text style={[styles.activityLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.activitySub, { color: theme.textTertiary }]}>Coming soon</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

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
    {
      icon: 'search-outline',
      label: 'Food DB',
      description: 'Search the database',
      route: '/food/search',
      accent: '#3D8E86',
      accentBg: '#EAF4F3',
    },
    {
      icon: 'analytics-outline',
      label: 'Chronometer',
      description: 'Track your progress',
      route: '/(tabs)/chronometer',
      accent: '#397C7B',
      accentBg: '#EAF2F2',
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
          style={s.recCard}
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
  }, []);

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
                    style={styles.weekItem}
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

        {/* Chronometer Snapshot / Logged Panel */}
        <Animated.View style={[styles.chronoWrap, chronoEntrance.style]}>
          <Animated.View
            style={[
              styles.chronoMain,
            ]}
          >
            {previousChronoPanelView ? (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.chronoPanelLayer,
                    {
                      opacity: chronoPanelTransition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                      transform: [
                        {
                          translateY: chronoPanelTransition.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -8],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {renderChronoPanel(previousChronoPanelView)}
                </Animated.View>
                <Animated.View
                  style={[
                    styles.chronoPanelLayer,
                    {
                      opacity: chronoPanelTransition,
                      transform: [
                        {
                          translateY: chronoPanelTransition.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {renderChronoPanel(chronoPanelView)}
                </Animated.View>
              </>
            ) : (
              <View style={styles.chronoPanelLayer}>
                {renderChronoPanel(chronoPanelView)}
              </View>
            )}
          </Animated.View>

          <BlurView intensity={45} tint="light" style={[styles.chronoModeBar, { borderColor: theme.border }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.chronoModeActiveBubble,
                {
                  backgroundColor: theme.primaryMuted,
                  borderColor: theme.border,
                  transform: [
                    {
                      translateX: chronoModeAnim.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [
                          CHRONO_MODE_BAR_INSET,
                          CHRONO_MODE_BAR_INSET + CHRONO_MODE_TAB_WIDTH + CHRONO_MODE_TAB_GAP,
                          CHRONO_MODE_BAR_INSET + (CHRONO_MODE_TAB_WIDTH + CHRONO_MODE_TAB_GAP) * 2,
                        ],
                      }),
                    },
                  ],
                },
              ]}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleChronoModePress('snapshot')}
              style={[
                styles.chronoModeTab,
                { backgroundColor: 'transparent' },
              ]}
            >
              <Ionicons name="analytics-outline" size={18} color={chronoPanelView === 'snapshot' ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleChronoModePress('logged')}
              style={[
                styles.chronoModeTab,
                { backgroundColor: 'transparent' },
              ]}
            >
              <Ionicons name="restaurant-outline" size={18} color={chronoPanelView === 'logged' ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleChronoModePress('activity')}
              style={[
                styles.chronoModeTab,
                { backgroundColor: 'transparent' },
              ]}
            >
              <Ionicons name="walk-outline" size={18} color={chronoPanelView === 'activity' ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        {/* ── Today's Plan ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: Spacing.xl }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/meals?tab=plan' as any)}
          >
            <Card padding={0}>
              {/* Card header */}
              <View style={s.todayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.todayTitle, { color: theme.text }]}>Today's Plan</Text>
                  <Text style={[s.todayDay, { color: theme.textSecondary }]}>{selectedDayNameLong}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
              </View>

              {/* Meal rows */}
              {todayMeals.length > 0 ? (
                <View style={s.todayMeals}>
                  {todayMeals.map((meal, idx) => {
                    const icon = MEAL_TYPE_ICONS[meal.meal_type?.toLowerCase()] || 'ellipse-outline';
                    const recipeName = meal.recipe_data?.title || meal.meal_type || 'Meal';
                    return (
                      <View key={meal.id || idx} style={[s.mealRow, idx < todayMeals.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.surfaceHighlight }]}>
                        <View style={[s.mealIcon, { backgroundColor: theme.surfaceHighlight }]}>
                          <Ionicons name={icon} size={16} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.mealName, { color: theme.text }]} numberOfLines={1}>{recipeName}</Text>
                          <Text style={[s.mealType, { color: theme.textTertiary }]}>{meal.meal_type}</Text>
                        </View>
                        {meal.servings > 0 && (
                          <Text style={[s.mealServings, { color: theme.textTertiary }]}>{meal.servings}x</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={s.todayEmpty}>
                  <Ionicons name="calendar-outline" size={24} color={theme.textTertiary} />
                  <Text style={[s.todayEmptyText, { color: theme.textSecondary }]}>No meals planned for today</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/meals?tab=plan' as any)}
                    style={[s.todayEmptyCta, { backgroundColor: theme.primaryMuted }]}
                  >
                    <Text style={[s.todayEmptyCtaText, { color: theme.primary }]}>Create Plan</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        </View>

        {/* ── Recommended For You ─────────────────────────────────────── */}
        {recommended.length > 0 && (
          <View style={{ marginBottom: Spacing.xl }}>
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

        {/* XP Progress */}
        <Card style={{ marginBottom: Spacing.xl }}>
          <XPBar xp={user?.xp_points || 0} />
          {stats?.level_title ? (
            <Text style={{ color: theme.textSecondary, fontSize: FontSize.xs, textAlign: 'center', marginTop: 4 }}>
              {stats.level_title}
            </Text>
          ) : null}
        </Card>

        {/* Quick Actions */}
        <Animated.View style={actionsEntrance.style}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              onPress={() => router.push(action.route as any)}
              style={styles.actionCard}
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

        {/* Hero Card */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(tabs)/chat')} style={{ marginTop: Spacing.xl }}>
          <LinearGradient
            colors={['#16A34A', '#0D9488', '#0E7490'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(255,255,255,0.06)', borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl }} />
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Transform Your{'\n'}Favorite Foods</Text>
              <Text style={styles.heroSubtitle}>
                Tell our AI what you crave and get a wholesome, delicious version instantly.
              </Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>Try Healthify</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.heroIconContainer}>
              <Ionicons name="sparkles" size={64} color="rgba(255,255,255,0.2)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Today's Tip */}
        <Card style={{ marginTop: Spacing.md, borderLeftWidth: 3, borderLeftColor: theme.accent }}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb" size={20} color={theme.accent} />
            <Text style={[styles.tipTitle, { color: theme.accent }]}>Daily Tip</Text>
          </View>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            {dailyTip}
          </Text>
        </Card>

        {/* Daily Quests */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>Today's Quests</Text>
        <Card style={{ overflow: 'hidden', padding: 0 }}>
          {/* Progress header with gradient bar */}
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

          {/* Quest items */}
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
                        'star-outline'
                      }
                      size={16}
                      color={quest.quest_type === 'metabolic' ? theme.accent : theme.textSecondary}
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
                  {/* Mini progress bar */}
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

        {/* Weekly Summary */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>This Week</Text>
        {statsError ? (
          <Card padding={Spacing.lg}>
            <View style={{ alignItems: 'center', gap: Spacing.sm }}>
              <Ionicons name="cloud-offline-outline" size={28} color={theme.textTertiary} />
              <Text style={{ color: theme.textSecondary, fontSize: FontSize.sm, textAlign: 'center' }}>Unable to load weekly stats</Text>
              <TouchableOpacity
                onPress={loadStats}
                style={{ backgroundColor: theme.primaryMuted, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full }}
              >
                <Text style={{ color: theme.primary, fontSize: FontSize.sm, fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
        <>
        <View style={styles.statsRow}>
          <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.primary }]} padding={Spacing.md}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>{weeklyStats.meals_cooked}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Meals Cooked</Text>
          </Card>
          <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.accent }]} padding={Spacing.md}>
            <Text style={[styles.statNumber, { color: theme.accent }]}>{weeklyStats.recipes_saved}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Recipes Saved</Text>
          </Card>
        </View>
        <View style={[styles.statsRow, { marginTop: Spacing.md }]}>
          <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: '#8B5CF6' }]} padding={Spacing.md}>
            <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>{weeklyStats.foods_explored}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Foods Explored</Text>
          </Card>
          <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.info }]} padding={Spacing.md}>
            <Text style={[styles.statNumber, { color: theme.info }]}>{weeklyStats.xp_earned}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>XP Earned</Text>
          </Card>
        </View>
        </>
        )}

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
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.25,
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
  },
  todayTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  todayDay: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  todayMeals: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
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
  },
  mealType: {
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
    marginTop: 1,
  },
  mealServings: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  todayEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  todayEmptyText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  todayEmptyCta: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  todayEmptyCtaText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  // Nutrition section
  nutritionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  macroBadges: {
    flex: 1,
    gap: Spacing.sm,
  },
  macroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroBadgeLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  macroBadgePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  macroBadgeStatus: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Track CTA
  trackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  trackCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackCtaTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  trackCtaSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
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
  headerRight: {},
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
  chronoWrap: {
    marginBottom: Spacing.xl,
  },
  chronoMain: {
    width: '100%',
    height: 368,
  },
  chronoPanelLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  chronoPanelFill: {
    width: '100%',
    height: '100%',
    flex: 1,
  },
  chronoSnapshotWrap: {
    height: '100%',
    justifyContent: 'flex-start',
  },
  chronoHero: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chronoHeroLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  chronoEyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  chronoValue: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  chronoValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  chronoValueGroup: {
    flexShrink: 1,
    minWidth: 0,
  },
  chronoValueTarget: {
    fontSize: FontSize.xxl,
    fontWeight: '600',
  },
  chronoLabelInline: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    flexShrink: 0,
  },
  chronoMesPill: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chronoMesPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  chronoPillsRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  chronoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  chronoPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  chronoCalTrack: {
    height: 7,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginTop: Spacing.xs + 2,
  },
  chronoCalFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  chronoHeroScorePanel: {
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  chronoRingWrap: {
    width: 104,
    height: 104,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chronoMesPillCentered: {
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: Spacing.xs + 4,
  },
  chronoScorePanelCaption: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  chronoMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chronoMiniCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  chronoMiniAccentTrack: {
    width: '100%',
    height: 3,
    borderRadius: BorderRadius.full,
    marginBottom: 1,
  },
  chronoMiniAccentFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  chronoMiniHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  chronoMiniValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  chronoMiniTarget: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  chronoMiniLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  chronoMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chronoLoggedCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  chronoFixedCard: {
    width: '100%',
    height: '100%',
  },
  chronoLoggedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  chronoLoggedTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  chronoLoggedCountPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  chronoLoggedCountText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  chronoLoggedList: {
    gap: 0,
    flex: 1,
  },
  chronoLoggedScroll: {
    flex: 1,
  },
  chronoLoggedScrollContent: {
    paddingBottom: 4,
    flexGrow: 1,
  },
  chronoLoggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  chronoLoggedIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chronoLoggedMealName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  chronoLoggedMeta: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  chronoLoggedServings: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  homeLoggedGroupRow: {
    paddingVertical: Spacing.sm + 2,
  },
  homeLoggedMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  homeLoggedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  homeLoggedBadgeWrap: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexShrink: 0,
  },
  homeLoggedBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  homeLoggedSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingLeft: 32 + Spacing.md,
  },
  homeLoggedSideDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#22C55E',
    marginRight: Spacing.sm,
  },
  homeLoggedMacroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    paddingLeft: 32 + Spacing.md,
    flexWrap: 'wrap',
  },
  chronoLoggedEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  chronoLoggedEmptyText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm,
    marginTop: 2,
    flex: 1,
    alignContent: 'flex-start',
  },
  activityCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 4,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  activityLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  activitySub: {
    fontSize: FontSize.xs - 1,
    fontWeight: '500',
  },
  chronoModeBar: {
    marginTop: Spacing.sm,
    alignSelf: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: CHRONO_MODE_BAR_INSET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHRONO_MODE_TAB_GAP,
    overflow: 'hidden',
    position: 'relative',
  },
  chronoModeActiveBubble: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: CHRONO_MODE_TAB_WIDTH,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chronoModeTab: {
    width: CHRONO_MODE_TAB_WIDTH,
    minHeight: CHRONO_MODE_TAB_HEIGHT,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    zIndex: 1,
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
    width: DAY_PILL_WIDTH,
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
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionCard: {
    width: (width - Spacing.xl * 2 - Spacing.sm) / 2,
  },
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
});
