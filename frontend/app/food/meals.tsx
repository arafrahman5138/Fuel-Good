import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppScreenHeader } from '../../components/AppScreenHeader';
import { ScreenContainer } from '../../components/ScreenContainer';
import { MealMESBadge } from '../../components/MealMESBadge';
import { FuelScoreBadge } from '../../components/FuelScoreBadge';
import { MacroRing } from '../../components/MacroRing';
import { useTheme } from '../../hooks/useTheme';
import { nutritionApi, foodApi, recipeApi, fuelApi, metabolicApi } from '../../services/api';
import { useMetabolicBudgetStore, getTierConfig, getTierFromScore } from '../../stores/metabolicBudgetStore';
import { useFuelStore } from '../../stores/fuelStore';
import type { MealMES } from '../../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';

// ── Types ──

interface DailyLog {
  id: string;
  title: string;
  meal_type?: string;
  source_type?: string;
  source_id?: string | null;
  group_id?: string | null;
  group_mes_score?: number | null;
  group_mes_tier?: string | null;
  nutrition?: Record<string, number>;
  nutrition_snapshot?: Record<string, number>;
  [key: string]: unknown;
}

interface SearchResult {
  fdc_id?: number;
  id?: number;
  description?: string;
  brand_owner?: string;
  calories_kcal?: number;
}

// ── Fuel tier config ──
const FUEL_TIERS = [
  { min: 90, color: '#22C55E', label: 'Elite' },
  { min: 75, color: '#4ADE80', label: 'Strong' },
  { min: 60, color: '#F59E0B', label: 'Decent' },
  { min: 40, color: '#FB923C', label: 'Mixed' },
  { min: 0, color: '#EF4444', label: 'Flex' },
];
function getFuelTier(score: number) {
  return FUEL_TIERS.find((t) => score >= t.min) ?? FUEL_TIERS[FUEL_TIERS.length - 1];
}

// ── Macro ring config ──
const MACRO_RING_SIZE = 44;
const MACRO_CONFIG = [
  { key: 'calories', label: 'Cal', unit: '', color: '#22C55E' },
  { key: 'protein', label: 'Protein', unit: 'g', color: '#22C55E' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: '#F59E0B' },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#EC4899' },
];

function cleanScanTitle(raw: string | undefined, snap: Record<string, any>) {
  const value = String(raw || '').trim();
  if (
    value &&
    value.length > 3 &&
    !/[+\-]$/.test(value) &&
    !/\b(with|and|in|on|over|with\s*)$/i.test(value)
  ) {
    return value;
  }

  const estimated = Array.isArray(snap?.estimated_ingredients) ? snap.estimated_ingredients : [];
  const normalized = Array.isArray(snap?.normalized_ingredients) ? snap.normalized_ingredients : [];
  const ingredients = (estimated.length ? estimated : normalized)
    .map((item: unknown) => String(item || '').trim())
    .filter(Boolean);

  if (ingredients.length >= 2) return `${ingredients[0]} + ${ingredients[1]}`;
  if (ingredients.length === 1) return ingredients[0];
  return value || 'Scanned food';
}

function isScanSnack(snap: Record<string, any>, sourceType?: string) {
  return sourceType === 'scan' && snap?.meal_context === 'snack';
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(d: Date): { dayName: string; dateStr: string; isToday: boolean } {
  const today = new Date();
  const isToday = toDateKey(d) === toDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = toDateKey(d) === toDateKey(yesterday);
  const dayName = isToday ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return { dayName, dateStr, isToday };
}

// ── Component ──

export default function TodaysMealsScreen() {
  const theme = useTheme();
  const fuelSettings = useFuelStore((s) => s.settings);

  // Date state
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateKey = toDateKey(selectedDate);
  const { dayName, dateStr, isToday } = formatDateLabel(selectedDate);

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mealScores, setMealScores] = useState<MealMES[]>([]);

  // Daily scores
  const [dailyFuelScore, setDailyFuelScore] = useState(0);
  const [dailyMesScore, setDailyMesScore] = useState(0);
  const [dailyMesTier, setDailyMesTier] = useState('');

  // Nutrition targets (from store, static)
  const targets = useMetabolicBudgetStore((s) => s.budget);
  const calTarget = targets?.tdee ?? 2000;
  const proTarget = targets?.protein_target_g ?? 150;
  const carbTarget = targets?.carb_ceiling_g ?? 250;
  const fatTarget = targets?.fat_target_g ?? 65;

  const fetchAll = useCallback(async (date: string) => {
    try {
      const [nutritionData, fuelData, mesData, mealScoreData] = await Promise.all([
        nutritionApi.getDaily(date).catch(() => null),
        fuelApi.getDaily(date).catch(() => null),
        metabolicApi.getDailyScore(date).catch(() => null),
        metabolicApi.getMealScores(date).catch(() => []),
      ]);
      setLogs(nutritionData?.logs || []);
      setDailyFuelScore(Math.round(fuelData?.avg_fuel_score ?? 0));
      const mesScore = mesData?.score?.display_score ?? mesData?.score?.total_score ?? 0;
      setDailyMesScore(Math.round(mesScore));
      setDailyMesTier(mesData?.score?.display_tier ?? mesData?.score?.tier ?? '');
      setMealScores(mealScoreData ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll(dateKey).finally(() => setLoading(false));
  }, [dateKey, fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(dateKey);
    setRefreshing(false);
  }, [dateKey, fetchAll]);

  const goDay = (delta: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      // Don't allow future dates
      if (next > new Date()) return prev;
      return next;
    });
  };

  const handleDelete = (logId: string, title: string, groupId?: string | null) => {
    const label = groupId ? `"${title}" and its side` : `"${title}"`;
    Alert.alert('Remove Meal', `Remove ${label} from today's log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(logId);
          try {
            if (groupId) {
              await nutritionApi.deleteGroupLogs(groupId);
            } else {
              await nutritionApi.deleteLog(logId);
            }
            await fetchAll(dateKey);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to remove meal.';
            Alert.alert('Error', msg);
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await foodApi.search(q.trim(), 1);
      const foods = Array.isArray(data?.foods) ? data.foods : Array.isArray(data) ? data : [];
      setSearchResults(foods.slice(0, 10));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAddSearchResult = async (item: SearchResult) => {
    const foodId = item.fdc_id || item.id;
    if (foodId) {
      router.push(`/food/${foodId}` as any);
    }
  };

  // ── Totals ──
  const totals = logs.reduce(
    (acc, log) => {
      const snap = log.nutrition_snapshot || {};
      acc.cal += Number(snap.calories || 0);
      acc.pro += Number(snap.protein || 0);
      acc.carb += Number(snap.carbs || 0);
      acc.fat += Number(snap.fat || 0);
      return acc;
    },
    { cal: 0, pro: 0, carb: 0, fat: 0 },
  );

  const macroValues: Record<string, { consumed: number; target: number }> = {
    calories: { consumed: totals.cal, target: calTarget },
    protein: { consumed: totals.pro, target: proTarget },
    carbs: { consumed: totals.carb, target: carbTarget },
    fat: { consumed: totals.fat, target: fatTarget },
  };

  const mealCount = useMemo(() => {
    const groupIds = new Set<string>();
    let count = 0;
    for (const log of logs) {
      if (log.group_id) {
        if (!groupIds.has(log.group_id)) {
          groupIds.add(log.group_id);
          count++;
        }
      } else {
        count++;
      }
    }
    return count;
  }, [logs]);

  // Fuel tier
  const hasFuel = dailyFuelScore > 0;
  const fuelTier = hasFuel ? getFuelTier(dailyFuelScore) : null;

  // MES tier
  const hasMes = dailyMesScore > 0 && dailyMesTier;
  const mesTierConfig = hasMes ? getTierConfig(dailyMesTier) : null;

  // ── Backfill group MES ──
  const [backfilledScores, setBackfilledScores] = useState<Record<string, { score: number; tier: string }>>({});
  useEffect(() => {
    let cancelled = false;
    const groupMap = new Map<string, DailyLog[]>();
    for (const log of logs) {
      if (!log.group_id) continue;
      const list = groupMap.get(log.group_id) || [];
      list.push(log);
      groupMap.set(log.group_id, list);
    }
    const needsBackfill = Array.from(groupMap.entries()).filter(([, groupLogs]) => {
      if (groupLogs.length < 2) return false;
      return !groupLogs.some((l) => l.group_mes_score != null);
    });
    if (needsBackfill.length === 0) return;
    (async () => {
      for (const [groupId, groupLogs] of needsBackfill) {
        if (cancelled) return;
        try {
          const recipeLogs = groupLogs.filter((x) => x.source_type === 'recipe' && x.source_id);
          if (recipeLogs.length < 2) continue;
          const mainRecipeId = String(recipeLogs[0].source_id);
          const sideRecipeId = String(recipeLogs[1].source_id);
          const [mainRecipe, pairings] = await Promise.all([
            recipeApi.getDetail(mainRecipeId).catch(() => null as any),
            recipeApi.getPairingSuggestions(mainRecipeId, 50).catch(() => [] as any[]),
          ]);
          const matchedPair = pairings.find((p: any) => String(p.recipe_id) === sideRecipeId);
          if (matchedPair) {
            const storedRawMes = Number(mainRecipe?.nutrition_info?.mes_score ?? 0);
            const hasStoredRawMes = Number.isFinite(storedRawMes) && storedRawMes > 0;
            const score = Number(
              matchedPair.pairing_adjusted_score
              ?? matchedPair.combined_display_score
              ?? matchedPair.combined_mes_score
              ?? (hasStoredRawMes
                ? Math.min(100, Number((storedRawMes + (matchedPair.mes_delta ?? 0)).toFixed(1)))
                : 0)
            );
            const tier = score >= 82 ? 'optimal' : score >= 65 ? 'stable' : score >= 50 ? 'shaky' : 'crash_risk';
            if (score > 0 && !cancelled) {
              setBackfilledScores((prev) => ({ ...prev, [groupId]: { score, tier } }));
              for (const log of groupLogs) {
                nutritionApi.updateLog(log.id, { group_mes_score: score, group_mes_tier: tier }).catch(() => {});
              }
            }
          }
        } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; };
  }, [logs.map((l) => `${l.id}:${l.group_id}:${l.group_mes_score}`).join('|')]);

  // ── Build items list ──
  type ListItem =
    | { type: 'paired'; main: DailyLog; side: DailyLog }
    | { type: 'solo'; log: DailyLog };

  const items = useMemo(() => {
    const gidMap = new Map<string, DailyLog[]>();
    for (const log of logs) {
      if (log.group_id) {
        const list = gidMap.get(log.group_id) || [];
        list.push(log);
        gidMap.set(log.group_id, list);
      }
    }
    const result: ListItem[] = [];
    const usedIds = new Set<string>();
    for (const log of logs) {
      if (usedIds.has(log.id)) continue;
      if (log.group_id) {
        const groupLogs = gidMap.get(log.group_id);
        if (groupLogs && groupLogs.length >= 2) {
          // Main = meal_plan source; side = recipe pairing. Fallback: higher cal = main
          const mealPlanIdx = groupLogs.findIndex((l) => l.source_type === 'meal_plan');
          let main: DailyLog, side: DailyLog;
          if (mealPlanIdx >= 0) {
            main = groupLogs[mealPlanIdx];
            side = groupLogs[mealPlanIdx === 0 ? 1 : 0];
          } else {
            const calOf = (l: DailyLog) => Number((l.nutrition_snapshot as any)?.calories || 0);
            const sorted = [...groupLogs].sort((a, b) => calOf(b) - calOf(a));
            main = sorted[0];
            side = sorted[1];
          }
          result.push({ type: 'paired', main, side });
          groupLogs.forEach((l) => usedIds.add(l.id));
          continue;
        }
      }
      result.push({ type: 'solo', log });
      usedIds.add(log.id);
    }
    return result;
  }, [logs]);

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <AppScreenHeader
        title={dayName === 'Today' ? "Today's Meals" : `${dayName}'s Meals`}
        centerContent={
          <View style={st.datePicker}>
            <TouchableOpacity onPress={() => goDay(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={20} color={theme.primary} />
            </TouchableOpacity>
            <View style={st.dateCenter}>
              <Text style={[st.dateDayName, { color: theme.text }]}>{dayName}</Text>
              <Text style={[st.dateStr, { color: theme.textTertiary }]}>{dateStr}</Text>
            </View>
            <TouchableOpacity
              onPress={() => goDay(1)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isToday}
            >
              <Ionicons name="chevron-forward" size={20} color={isToday ? theme.textTertiary + '40' : theme.primary} />
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* ── Summary + Macros ── */}
        <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
          {/* Summary row: scores + stats */}
          <View style={st.summaryRow}>
            <View style={st.summaryScores}>
              {hasFuel && fuelTier && (
                <View style={st.summaryScoreItem}>
                  <Ionicons name="leaf" size={14} color={fuelTier.color} />
                  <Text style={[st.summaryScoreNum, { color: fuelTier.color }]}>{dailyFuelScore}</Text>
                  <Text style={[st.summaryScoreLabel, { color: theme.textTertiary }]}>fuel</Text>
                </View>
              )}
              {hasMes && mesTierConfig && (
                <View style={st.summaryScoreItem}>
                  <Ionicons name="flash" size={14} color={mesTierConfig.color} />
                  <Text style={[st.summaryScoreNum, { color: mesTierConfig.color }]}>{dailyMesScore}</Text>
                  <Text style={[st.summaryScoreLabel, { color: theme.textTertiary }]}>mes</Text>
                </View>
              )}
              {!hasFuel && !hasMes && (
                <Text style={[st.summaryScoreLabel, { color: theme.textTertiary }]}>No scores yet</Text>
              )}
            </View>
            <View style={st.summaryStats}>
              <Text style={[st.summaryStatText, { color: theme.textSecondary }]}>
                {mealCount} meal{mealCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Macro rings */}
          <View style={st.macroRow}>
            {MACRO_CONFIG.map((macro) => {
              const v = macroValues[macro.key];
              const pct = v.target > 0 ? v.consumed / v.target : 0;
              const remaining = Math.max(0, Math.round(v.target - v.consumed));
              const ringColor = macro.key === 'calories' && fuelTier ? fuelTier.color : macro.color;
              return (
                <View key={macro.key} style={st.macroItem}>
                  <MacroRing progress={pct} size={MACRO_RING_SIZE} color={ringColor} trackColor={theme.surfaceHighlight} />
                  <Text style={[st.macroValue, { color: theme.text }]}>
                    {Math.round(v.consumed)}
                    <Text style={[st.macroTarget, { color: theme.textTertiary }]}>/{Math.round(v.target)}{macro.unit}</Text>
                  </Text>
                  <Text style={[st.macroLabel, { color: theme.textTertiary }]}>{macro.label}</Text>
                  {v.target > 0 && (
                    <Text style={[st.macroRemaining, { color: ringColor + 'AA' }]}>{remaining}{macro.unit} left</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Quick Add ── */}
        <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.md }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowSearch(!showSearch)}
            style={[st.addBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <LinearGradient colors={[theme.primary, theme.primary + 'BB'] as any} style={st.addBtnIcon}>
              <Ionicons name="add" size={18} color="#fff" />
            </LinearGradient>
            <Text style={[st.addBtnText, { color: theme.text }]}>Quick Add Food</Text>
            <Ionicons name={showSearch ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textTertiary} />
          </TouchableOpacity>

          {showSearch && (
            <View style={{ marginTop: Spacing.sm }}>
              <View style={[st.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="search" size={16} color={theme.textTertiary} />
                <TextInput
                  style={[st.searchInput, { color: theme.text }]}
                  placeholder="Search foods..."
                  placeholderTextColor={theme.textTertiary}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
              {searching && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.sm }} />}
              {searchResults.length > 0 && (
                <View style={[st.searchResults, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {searchResults.map((item, idx) => (
                    <TouchableOpacity
                      key={String(item.fdc_id || item.id || idx)}
                      onPress={() => handleAddSearchResult(item)}
                      style={[
                        st.searchResultRow,
                        idx < searchResults.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                      ]}
                    >
                      <View style={[st.searchResultIcon, { backgroundColor: theme.primaryMuted }]}>
                        <Ionicons name="nutrition-outline" size={14} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.searchResultName, { color: theme.text }]} numberOfLines={1}>{item.description || 'Unknown'}</Text>
                        {item.brand_owner && (
                          <Text style={[st.searchResultBrand, { color: theme.textTertiary }]} numberOfLines={1}>{item.brand_owner}</Text>
                        )}
                      </View>
                      {item.calories_kcal != null && (
                        <Text style={[st.searchResultCal, { color: theme.textSecondary }]}>{Math.round(item.calories_kcal)} cal</Text>
                      )}
                      <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
          <TouchableOpacity
            style={[st.quickAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/meals?tab=browse' as any)}
          >
            <View style={[st.quickActionIcon, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="book-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[st.quickActionText, { color: theme.text }]}>Browse Recipes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.quickAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/food/search' as any)}
          >
            <View style={[st.quickActionIcon, { backgroundColor: theme.accentMuted }]}>
              <Ionicons name="search-outline" size={16} color={theme.accent} />
            </View>
            <Text style={[st.quickActionText, { color: theme.text }]}>Search Foods</Text>
          </TouchableOpacity>
        </View>

        {/* ── Meal List ── */}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
            <Text style={[st.sectionTitle, { color: theme.text }]}>Logged Meals</Text>
            {mealCount > 0 && (
              <Text style={[st.sectionCount, { color: theme.textTertiary }]}>{mealCount} item{mealCount !== 1 ? 's' : ''}</Text>
            )}
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxxl }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : items.length === 0 ? (
            <View style={st.empty}>
              <View style={[st.emptyIcon, { backgroundColor: theme.primaryMuted }]}>
                <Ionicons name="fast-food-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[st.emptyTitle, { color: theme.text }]}>No meals yet</Text>
              <Text style={[st.emptySub, { color: theme.textSecondary }]}>
                Start by adding your first meal{isToday ? '' : ' for this day'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {items.map((item) => {
                if (item.type === 'paired') {
                  const mainSnap = item.main.nutrition_snapshot || {};
                  const sideSnap = item.side.nutrition_snapshot || {};
                  const cal = Number(mainSnap.calories || 0) + Number(sideSnap.calories || 0);
                  const pro = Number(mainSnap.protein || 0) + Number(sideSnap.protein || 0);
                  const carb = Number(mainSnap.carbs || 0) + Number(sideSnap.carbs || 0);
                  const fat = Number(mainSnap.fat || 0) + Number(sideSnap.fat || 0);
                  const fiber = Number(mainSnap.fiber || 0) + Number(sideSnap.fiber || 0);
                  const storedScore = item.main.group_mes_score ?? item.side.group_mes_score ?? null;
                  const storedTier = item.main.group_mes_tier ?? item.side.group_mes_tier ?? null;
                  const backfill = item.main.group_id ? backfilledScores[item.main.group_id] : undefined;
                  const mainMes = mealScores.find((ms: MealMES) => ms.food_log_id === item.main.id);
                  const displayScore = storedScore ?? backfill?.score ?? (mainMes?.score?.display_score || mainMes?.score?.total_score || null);
                  const displayTier = storedTier ?? backfill?.tier ?? (mainMes?.score?.display_tier || mainMes?.score?.tier || null);
                  const isDeletingGroup = deleting === item.main.id;

                  return (
                    <View key={item.main.id} style={[st.mealCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={st.mealCardRow}>
                        <LinearGradient colors={[theme.primary + '22', theme.primary + '0A'] as any} style={st.mealIcon}>
                          <Ionicons name="restaurant-outline" size={17} color={theme.primary} />
                        </LinearGradient>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[st.mealTitle, { color: theme.text }]} numberOfLines={1}>
                            {item.main.title || 'Untitled'}
                          </Text>
                          <View style={st.mealMetaRow}>
                            {item.main.meal_type && (
                              <Text style={[st.mealType, { color: theme.textTertiary }]}>
                                {item.main.meal_type.charAt(0).toUpperCase() + item.main.meal_type.slice(1)}
                              </Text>
                            )}
                            <Text style={[st.calBadge, { color: theme.textSecondary }]}>{cal.toFixed(0)} cal</Text>
                            {(item.main as any).fuel_score != null && fuelSettings && (
                              <FuelScoreBadge score={(item.main as any).fuel_score} compact fuelTarget={fuelSettings.fuel_target} />
                            )}
                            {displayScore != null && displayTier && (
                              <MealMESBadge score={displayScore} tier={displayTier} compact />
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDelete(item.main.id, item.main.title || 'Untitled', item.main.group_id)}
                          disabled={isDeletingGroup}
                          style={st.deleteBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {isDeletingGroup
                            ? <ActivityIndicator size="small" color={theme.error} />
                            : <Ionicons name="trash-outline" size={15} color={theme.error} />}
                        </TouchableOpacity>
                      </View>
                      <View style={[st.sideRow, { borderColor: theme.border }]}>
                        <View style={[st.sideIconWrap, { backgroundColor: theme.primaryMuted }]}>
                          <Ionicons name="add-outline" size={11} color={theme.primary} />
                        </View>
                        <Text style={[st.sideRowText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.side.title || 'Side'}
                        </Text>
                      </View>
                      <MacroDots theme={theme} cal={cal} pro={pro} carb={carb} fat={fat} fiber={fiber} />
                    </View>
                  );
                }

                // Solo meal
                const log = item.log;
                const snap = log.nutrition_snapshot || {};
                const cal = Number(snap.calories || 0);
                const pro = Number(snap.protein || 0);
                const carb = Number(snap.carbs || 0);
                const fat = Number(snap.fat || 0);
                const fiber = Number(snap.fiber || 0);
                const scanSnack = isScanSnack(snap, log.source_type);
                const sourceIcon =
                  log.source_type === 'scan' ? 'scan-outline' :
                  log.source_type === 'recipe' ? 'restaurant-outline' :
                  log.source_type === 'meal_plan' ? 'calendar-outline' : 'create-outline';
                const isDeleting = deleting === log.id;
                const mealMes = mealScores.find((ms: MealMES) => ms.food_log_id === log.id);

                return (
                  <View key={log.id} style={[st.mealCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={st.mealCardRow}>
                      <LinearGradient colors={[theme.primary + '22', theme.primary + '0A'] as any} style={st.mealIcon}>
                        <Ionicons name={sourceIcon as any} size={17} color={theme.primary} />
                      </LinearGradient>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[st.mealTitle, { color: theme.text }]} numberOfLines={1}>
                          {log.source_type === 'scan' ? cleanScanTitle(log.title, snap) : (log.title || 'Untitled')}
                        </Text>
                        <View style={st.mealMetaRow}>
                          {log.meal_type && (
                            <Text style={[st.mealType, { color: theme.textTertiary }]}>
                              {log.meal_type.charAt(0).toUpperCase() + log.meal_type.slice(1)}
                            </Text>
                          )}
                          <Text style={[st.calBadge, { color: theme.textSecondary }]}>{cal.toFixed(0)} cal</Text>
                          {(log as any).fuel_score != null && fuelSettings && (
                            <FuelScoreBadge score={Number((log as any).fuel_score)} compact fuelTarget={fuelSettings.fuel_target} />
                          )}
                          {!scanSnack && mealMes && (
                            mealMes.score
                              ? <MealMESBadge score={mealMes.score.display_score || mealMes.score.total_score} tier={mealMes.score.display_tier || mealMes.score.tier} compact />
                              : <MealMESBadge score={null} tier="crash_risk" unscoredHint={mealMes.unscored_hint} compact />
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(log.id, log.title || 'Untitled')}
                        disabled={isDeleting}
                        style={st.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isDeleting
                          ? <ActivityIndicator size="small" color={theme.error} />
                          : <Ionicons name="trash-outline" size={15} color={theme.error} />}
                      </TouchableOpacity>
                    </View>
                    <MacroDots theme={theme} cal={cal} pro={pro} carb={carb} fat={fat} fiber={fiber} />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Macro dots component ──
function MacroDots({ theme, cal, pro, carb, fat, fiber }: { theme: any; cal: number; pro: number; carb: number; fat: number; fiber: number }) {
  return (
    <View style={st.macroDots}>
      {[
        { label: 'PROTEIN', val: pro, color: '#22C55E' },
        { label: 'CARBS', val: carb, color: '#3B82F6' },
        { label: 'FAT', val: fat, color: '#F59E0B' },
        { label: 'FIBER', val: fiber, color: '#A855F7' },
      ].map((m) => (
        <View key={m.label} style={st.macroDotItem}>
          <View style={[st.macroDot, { backgroundColor: m.color }]} />
          <Text style={[st.macroDotValue, { color: theme.text }]}>{m.val.toFixed(0)}g</Text>
          <Text style={[st.macroDotLabel, { color: theme.textTertiary }]}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──
const st = StyleSheet.create({
  // Date picker
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dateCenter: {
    alignItems: 'center',
    minWidth: 120,
  },
  dateDayName: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  dateStr: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md + 2,
  },
  summaryScores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md + 4,
  },
  summaryScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryScoreNum: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  summaryScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryStatText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Macro rings
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  macroValue: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  macroTarget: {
    fontSize: 9,
    fontWeight: '500',
  },
  macroLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  macroRemaining: {
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Quick add
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  addBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchResults: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchResultIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  searchResultBrand: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  searchResultCal: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginRight: Spacing.xs,
  },

  // Quick actions
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Section
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 240,
  },

  // Meal card
  mealCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  mealCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mealTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  mealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  mealType: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  calBadge: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: 40 + Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideRowText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Macro dots
  macroDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  macroDotItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroDotValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroDotLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
