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
import { FuelScoreBadge } from './FuelScoreBadge';
import { useTheme } from '../hooks/useTheme';
import { getTierConfig } from '../stores/metabolicBudgetStore';
import type { MealMES } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, MacroColors, Spacing } from '../constants/Colors';

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
  { key: 'calories', label: 'Cal', unit: '', color: MacroColors.protein },
  { key: 'protein', label: 'Protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', color: MacroColors.fatAlt },
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
  todayMesScore?: number;
  todayMesTierColor?: string;
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
function pickMainAndSide(groupLogs: DailyLog[]): { main: DailyLog; side: DailyLog } {
  // The main dish is the meal_plan source; the side is the recipe pairing
  const mealPlanIdx = groupLogs.findIndex((l) => l.source_type === 'meal_plan');
  if (mealPlanIdx >= 0) {
    const main = groupLogs[mealPlanIdx];
    const side = groupLogs[mealPlanIdx === 0 ? 1 : 0];
    return { main, side };
  }
  // For scan-based or manual groups: the one with more calories is likely the main
  const calOf = (l: DailyLog) => Number(l.nutrition_snapshot?.calories || 0);
  const sorted = [...groupLogs].sort((a, b) => calOf(b) - calOf(a));
  return { main: sorted[0], side: sorted[1] };
}

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
        const { main, side } = pickMainAndSide(groupLogs);
        items.push({ type: 'group', main, side });
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
  todayMesScore,
  todayMesTierColor,
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
        onPress={() => router.push('/(tabs)/index/food-meals' as any)}
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
            <View style={styles.scoreChips}>
              <View style={[styles.scoreChip, { backgroundColor: tier.color + '15' }]}>
                <Ionicons name="leaf" size={11} color={tier.color} />
                <Text style={[styles.scoreChipText, { color: tier.color }]}>{todayFuelScore}</Text>
              </View>
              {(todayMesScore ?? 0) > 0 && (
                <View style={[styles.scoreChip, { backgroundColor: (todayMesTierColor ?? '#8B5CF6') + '15' }]}>
                  <Ionicons name="flash" size={11} color={todayMesTierColor ?? '#8B5CF6'} />
                  <Text style={[styles.scoreChipText, { color: todayMesTierColor ?? '#8B5CF6' }]}>{todayMesScore}</Text>
                </View>
              )}
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* ── Macro Rings (always visible) ── */}
      <View style={styles.macroSection}>
        <View style={styles.macroRow}>
          {MACRO_CONFIG.map((macro) => {
            const v = macroValues[macro.key];
            const pct = v.target > 0 ? v.consumed / v.target : 0;
            const diff = Math.round(v.target - v.consumed);
            const isOver = diff < 0;
            const displayDiff = Math.abs(diff);
            const isCalories = macro.key === 'calories';
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
                  <Text style={[styles.macroRemaining, { color: isOver ? '#EF4444AA' : ringColor + 'AA' }]}>
                    {displayDiff}{macro.unit} {isOver ? 'over' : 'left'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Meals ── */}
      {mealCount === 0 ? (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={[theme.primary + '15', theme.primary + '08'] as any}
            style={styles.emptyIcon}
          >
            <Ionicons name="restaurant-outline" size={26} color={theme.primary} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: theme.primary }]}>
            Ready to fuel up?
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Your first meal sets the tone for the day
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/scan' as any)}
          >
            <LinearGradient
              colors={['#22C55E', '#059669'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyBtn}
            >
              <Ionicons name="scan" size={14} color="#fff" />
              <Text style={styles.emptyBtnText}>Scan a Meal</Text>
            </LinearGradient>
          </TouchableOpacity>
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
                    fuelTarget={fuelTarget}
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
  fuelTarget,
}: {
  main: DailyLog;
  side: DailyLog;
  mealScores: MealMES[];
  isLast: boolean;
  fuelTarget?: number;
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
            {main.fuel_score != null && (
              <FuelScoreBadge score={main.fuel_score} compact fuelTarget={fuelTarget} />
            )}
            {displayScore != null && displayTier ? (
              <MealMESBadge score={displayScore} tier={displayTier} compact />
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
  scoreChips: {
    flexDirection: 'row',
    gap: 6,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  scoreChipText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
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
