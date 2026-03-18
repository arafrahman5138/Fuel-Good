/**
 * TodayProgressCard — Unified daily progress card.
 * Shows today's fuel score, macro rings, and meal list in one flowing card.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from './GradientCard';
import { MacroRing } from './MacroRing';
import { SingleMealRow } from './CompositeMealCard';
import { MealMESBadge } from './MealMESBadge';
import { useTheme } from '../hooks/useTheme';
import { getTierConfig } from '../stores/metabolicBudgetStore';
import type { MealMES } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

// ── Fuel tier config ────────────────────────────────────────────────────────
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

// ── Macro config ────────────────────────────────────────────────────────────
const MACRO_RING_SIZE = 44;
const MACRO_CONFIG = [
  { key: 'calories', label: 'Cal', unit: '', color: '#22C55E' },
  { key: 'protein', label: 'Protein', unit: 'g', color: '#22C55E' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: '#F59E0B' },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#EC4899' },
];

// ── Types ───────────────────────────────────────────────────────────────────
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
  nutrition_snapshot?: Record<string, any>;
  [key: string]: unknown;
}

type DisplayItem =
  | { type: 'group'; main: DailyLog; side: DailyLog }
  | { type: 'single'; log: DailyLog };

// ── Props ───────────────────────────────────────────────────────────────────
interface NutrientValue {
  consumed: number;
  target: number;
}

interface TodayProgressCardProps {
  logs: DailyLog[];
  mealScores: MealMES[];
  fuelTarget?: number;
  todayFuelScore?: number;
  calories: NutrientValue;
  protein: NutrientValue;
  carbs: NutrientValue;
  fat: NutrientValue;
  /** Override card title (e.g. "Monday's Fuel" for past dates) */
  title?: string;
  /** Override subtitle */
  subtitle?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function buildDisplayItems(logs: DailyLog[]): DisplayItem[] {
  const groupMap = new Map<string, DailyLog[]>();
  for (const log of logs) {
    if (log.group_id) {
      const list = groupMap.get(log.group_id) || [];
      list.push(log);
      groupMap.set(log.group_id, list);
    }
  }

  const items: DisplayItem[] = [];
  const usedIds = new Set<string>();

  for (const log of logs) {
    if (usedIds.has(log.id)) continue;
    if (log.group_id && groupMap.has(log.group_id)) {
      const groupLogs = groupMap.get(log.group_id)!;
      if (groupLogs.length >= 2) {
        items.push({ type: 'group', main: groupLogs[0], side: groupLogs[1] });
        groupLogs.forEach((l) => usedIds.add(l.id));
        continue;
      }
    }
    items.push({ type: 'single', log });
    usedIds.add(log.id);
  }

  return items;
}

// ── Component ───────────────────────────────────────────────────────────────
export function TodayProgressCard({
  logs,
  mealScores,
  fuelTarget,
  todayFuelScore,
  calories,
  protein,
  carbs,
  fat,
  title,
  subtitle,
}: TodayProgressCardProps) {
  const theme = useTheme();
  const displayItems = buildDisplayItems(logs);
  const mealCount = displayItems.length;
  const hasFuel = todayFuelScore != null && todayFuelScore > 0;
  const tier = hasFuel ? getFuelTier(todayFuelScore!) : null;

  const macroValues: Record<string, NutrientValue> = {
    calories,
    protein,
    carbs,
    fat,
  };

  const trackColor = theme.surfaceHighlight;

  return (
    <Card style={styles.card}>
      {/* ── Header ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/food/meals' as any)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[theme.primary, theme.primary + 'CC'] as any}
            style={styles.headerIcon}
          >
            <Ionicons name="restaurant" size={16} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {title ?? "Today's Fuel"}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textTertiary }]}>
              {subtitle ?? (mealCount === 0
                ? 'No meals logged yet'
                : `${mealCount} meal${mealCount > 1 ? 's' : ''} logged`)}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {hasFuel && tier && (
            <View style={[styles.fuelPill, { backgroundColor: tier.color + '18' }]}>
              <Ionicons name="leaf" size={11} color={tier.color} style={{ marginRight: 3 }} />
              <Text style={[styles.fuelPillText, { color: tier.color }]}>
                {todayFuelScore} fuel
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* ── Macro Rings ── */}
      {mealCount > 0 && (
        <View style={styles.macroSection}>
          <View style={styles.macroRow}>
            {MACRO_CONFIG.map((macro) => {
              const v = macroValues[macro.key];
              const pct = v.target > 0 ? v.consumed / v.target : 0;
              const remaining = Math.max(0, Math.round(v.target - v.consumed));
              const isCalories = macro.key === 'calories';
              // Calories ring uses tier color when available
              const ringColor = isCalories && tier ? tier.color : macro.color;

              return (
                <View key={macro.key} style={styles.macroItem}>
                  <MacroRing
                    progress={pct}
                    size={MACRO_RING_SIZE}
                    color={ringColor}
                    trackColor={trackColor}
                  />
                  <Text style={[styles.macroValue, { color: theme.text }]}>
                    {Math.round(v.consumed)}
                    <Text style={[styles.macroTarget, { color: theme.textTertiary }]}>
                      /{Math.round(v.target)}{macro.unit}
                    </Text>
                  </Text>
                  <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>
                    {macro.label}
                  </Text>
                  {v.target > 0 && (
                    <Text style={[styles.macroRemaining, { color: ringColor + 'AA' }]}>
                      {remaining}{macro.unit} left
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Meals ── */}
      {mealCount === 0 ? (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={[theme.primary + '20', theme.primary + '08'] as any}
            style={styles.emptyIcon}
          >
            <Ionicons name="fast-food-outline" size={24} color={theme.primary} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Your plate is empty
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Log your first meal to start tracking
          </Text>
          <LinearGradient
            colors={['#22C55E', '#059669'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyBtn}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.emptyBtnText}>Log a Meal</Text>
          </LinearGradient>
        </View>
      ) : (
        <>
          <View style={[styles.mealDivider, { backgroundColor: theme.border }]} />
          <View style={styles.mealList}>
            {displayItems.map((item, idx) => {
              const isLast = idx === displayItems.length - 1;

              if (item.type === 'group') {
                return (
                  <GroupedMealRow
                    key={item.main.id}
                    main={item.main}
                    side={item.side}
                    mealScores={mealScores}
                    isLast={isLast}
                  />
                );
              }

              const mealMes = mealScores.find((m) => m.food_log_id === item.log.id);
              return (
                <SingleMealRow
                  key={item.log.id}
                  log={item.log}
                  mealScore={mealMes}
                  recipeScoreOverride={
                    item.log.source_type === 'scan' && item.log.nutrition_snapshot?.scan_mes_score != null
                      ? {
                          score: Number(item.log.nutrition_snapshot?.scan_mes_score || 0),
                          tier: String(item.log.nutrition_snapshot?.scan_mes_tier || 'critical'),
                        }
                      : null
                  }
                  isLast={isLast}
                  fuelTarget={fuelTarget}
                />
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
}

// ── Grouped Meal Row ────────────────────────────────────────────────────────
function GroupedMealRow({
  main,
  side,
  mealScores,
  isLast,
}: {
  main: DailyLog;
  side: DailyLog;
  mealScores: MealMES[];
  isLast: boolean;
}) {
  const theme = useTheme();

  const mainSnap = main.nutrition_snapshot || {};
  const sideSnap = side.nutrition_snapshot || {};
  const combinedCal = Number(mainSnap.calories || 0) + Number(sideSnap.calories || 0);
  const combinedPro = Number(mainSnap.protein || mainSnap.protein_g || 0) + Number(sideSnap.protein || sideSnap.protein_g || 0);
  const combinedCarb = Number(mainSnap.carbs || mainSnap.carbs_g || 0) + Number(sideSnap.carbs || sideSnap.carbs_g || 0);
  const combinedFat = Number(mainSnap.fat || mainSnap.fat_g || 0) + Number(sideSnap.fat || sideSnap.fat_g || 0);

  const storedScore = main.group_mes_score ?? side.group_mes_score ?? null;
  const storedTier = main.group_mes_tier ?? side.group_mes_tier ?? null;
  const mainMes = mealScores.find((m) => m.food_log_id === main.id);
  const fallbackScore = mainMes?.score?.display_score ?? mainMes?.score?.total_score ?? null;
  const fallbackTier = mainMes?.score?.display_tier ?? mainMes?.score?.tier ?? null;
  const displayScore = storedScore ?? fallbackScore;
  const displayTier = storedTier ?? fallbackTier;
  const tierConfig = displayTier ? getTierConfig(displayTier) : null;

  return (
    <View
      style={{
        paddingVertical: Spacing.sm + 2,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.surfaceHighlight,
      }}
    >
      <View style={styles.groupMainRow}>
        <View style={[styles.rowIcon, { backgroundColor: theme.surfaceHighlight }]}>
          <Ionicons name="restaurant-outline" size={16} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTitleWrap}>
            <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
              {main.title || 'Untitled'}
            </Text>
            {displayScore != null && displayTier ? (
              <View
                style={{
                  backgroundColor: (tierConfig?.color || theme.primary) + '14',
                  borderColor: (tierConfig?.color || theme.primary) + '35',
                  borderWidth: 1,
                  borderRadius: BorderRadius.full,
                  padding: 2,
                }}
              >
                <MealMESBadge score={displayScore} tier={displayTier} />
              </View>
            ) : (
              <View style={[styles.unscoredPill, { backgroundColor: theme.surfaceHighlight }]}>
                <Text style={{ color: theme.textTertiary, fontSize: 10, fontWeight: '700' }}>···</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.sideRow}>
        <View style={styles.sideDot} />
        <Ionicons name="leaf-outline" size={12} color="#22C55E" style={{ marginRight: 4 }} />
        <Text style={[styles.sideTitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {side.title || 'Side'}
        </Text>
      </View>

      <View style={styles.groupMacroRow}>
        <Text style={[styles.groupMacroText, { color: theme.textTertiary }]}>
          {combinedCal.toFixed(0)} cal
        </Text>
        {combinedPro > 0 && (
          <Text style={[styles.groupMacroText, { color: theme.textTertiary }]}>P {combinedPro.toFixed(0)}g</Text>
        )}
        {combinedCarb > 0 && (
          <Text style={[styles.groupMacroText, { color: theme.textTertiary }]}>C {combinedCarb.toFixed(0)}g</Text>
        )}
        {combinedFat > 0 && (
          <Text style={[styles.groupMacroText, { color: theme.textTertiary }]}>F {combinedFat.toFixed(0)}g</Text>
        )}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fuelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  fuelPillText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Macro rings
  macroSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  macroValue: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
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
    fontVariant: ['tabular-nums'] as any,
  },

  // Meal divider
  mealDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.md,
  },

  // Meal list
  mealList: {
    gap: Spacing.sm,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },

  // Grouped meal row
  groupMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  unscoredPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingLeft: 32 + Spacing.md,
  },
  sideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginRight: 8,
  },
  sideTitle: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  groupMacroRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingLeft: 32 + Spacing.md,
  },
  groupMacroText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
