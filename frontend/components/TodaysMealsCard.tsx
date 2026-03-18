/**
 * TodaysMealsCard — Shows today's logged meals on the homepage.
 * Reuses SingleMealRow from CompositeMealCard for consistent look
 * with the Chrono tab. Grouped meals (main + side) shown inline.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from './GradientCard';
import { SingleMealRow } from './CompositeMealCard';
import { MealMESBadge } from './MealMESBadge';
import { useTheme } from '../hooks/useTheme';
import { getTierConfig } from '../stores/metabolicBudgetStore';
import type { MealMES } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

const FUEL_TIERS = [
  { min: 90, color: '#22C55E', label: 'Elite' },
  { min: 75, color: '#4ADE80', label: 'Strong' },
  { min: 60, color: '#F59E0B', label: 'Decent' },
  { min: 40, color: '#FB923C', label: 'Mixed' },
  { min: 0,  color: '#EF4444', label: 'Flex' },
];
function getFuelTier(score: number) {
  return FUEL_TIERS.find((t) => score >= t.min) ?? FUEL_TIERS[FUEL_TIERS.length - 1];
}

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
interface TodaysMealsCardProps {
  logs: DailyLog[];
  mealScores: MealMES[];
  fuelTarget?: number;
  todayFuelScore?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function buildDisplayItems(logs: DailyLog[]): DisplayItem[] {
  const groupMap = new Map<string, DailyLog[]>();
  const groupedIds = new Set<string>();

  for (const log of logs) {
    if (log.group_id) {
      const list = groupMap.get(log.group_id) || [];
      list.push(log);
      groupMap.set(log.group_id, list);
      groupedIds.add(log.id);
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
export function TodaysMealsCard({ logs, mealScores, fuelTarget, todayFuelScore }: TodaysMealsCardProps) {
  const theme = useTheme();
  const displayItems = buildDisplayItems(logs);
  const mealCount = displayItems.length;

  const totalKcal = logs.reduce(
    (sum, l) => sum + Number(l.nutrition_snapshot?.calories || 0),
    0,
  );
  const totalProtein = logs.reduce(
    (sum, l) => sum + Number(l.nutrition_snapshot?.protein || l.nutrition_snapshot?.protein_g || 0),
    0,
  );
  const totalCarbs = logs.reduce(
    (sum, l) => sum + Number(l.nutrition_snapshot?.carbs || l.nutrition_snapshot?.carbs_g || 0),
    0,
  );
  const totalFat = logs.reduce(
    (sum, l) => sum + Number(l.nutrition_snapshot?.fat || l.nutrition_snapshot?.fat_g || 0),
    0,
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/food/meals' as any)}
    >
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={[theme.primary, theme.primary + 'CC'] as any}
              style={styles.headerIcon}
            >
              <Ionicons name="restaurant" size={16} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Today's Meals</Text>
              <Text style={[styles.headerSub, { color: theme.textTertiary }]}>
                {mealCount === 0
                  ? 'No meals logged yet'
                  : `${mealCount} meal${mealCount > 1 ? 's' : ''} logged`}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {mealCount > 0 && todayFuelScore != null && todayFuelScore > 0 && (() => {
              const tier = getFuelTier(todayFuelScore);
              return (
                <View style={[styles.calPill, { backgroundColor: tier.color + '18' }]}>
                  <Ionicons name="leaf" size={11} color={tier.color} style={{ marginRight: 3 }} />
                  <Text style={[styles.calPillText, { color: tier.color }]}>
                    {todayFuelScore} fuel
                  </Text>
                </View>
              );
            })()}
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </View>
        </View>

        {/* Macro pills */}
        {mealCount > 0 && totalKcal > 0 && (
          <View style={styles.macroPillRow}>
            {[
              { value: Math.round(totalKcal), unit: '', label: 'cal', color: theme.text },
              { value: Math.round(totalProtein), unit: 'g', label: 'P', color: '#22C55E' },
              { value: Math.round(totalCarbs), unit: 'g', label: 'C', color: '#F59E0B' },
              { value: Math.round(totalFat), unit: 'g', label: 'F', color: '#EC4899' },
            ].map((m) => (
              <View key={m.label} style={[styles.macroPill, { backgroundColor: m.color + '10' }]}>
                <Text style={[styles.macroPillValue, { color: m.color }]}>
                  {m.value}{m.unit}
                </Text>
                <Text style={[styles.macroPillLabel, { color: m.color + 'AA' }]}>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {mealCount === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="fast-food-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No meals logged yet today
            </Text>
            <View style={[styles.emptyBtn, { backgroundColor: theme.primary }]}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.emptyBtnText}>Log a Meal</Text>
            </View>
          </View>
        ) : (
          /* Meal rows */
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
        )}
      </Card>
    </TouchableOpacity>
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
      {/* Main meal */}
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

      {/* Side (indented) */}
      <View style={styles.sideRow}>
        <View style={styles.sideDot} />
        <Ionicons name="leaf-outline" size={12} color="#22C55E" style={{ marginRight: 4 }} />
        <Text style={[styles.sideTitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {side.title || 'Side'}
        </Text>
      </View>

      {/* Combined macros */}
      <View style={styles.macroRow}>
        <Text style={[styles.macroText, { color: theme.textTertiary }]}>
          {combinedCal.toFixed(0)} calories
        </Text>
        {combinedPro > 0 && (
          <Text style={[styles.macroText, { color: theme.textTertiary }]}>P {combinedPro.toFixed(0)}g</Text>
        )}
        {combinedCarb > 0 && (
          <Text style={[styles.macroText, { color: theme.textTertiary }]}>C {combinedCarb.toFixed(0)}g</Text>
        )}
        {combinedFat > 0 && (
          <Text style={[styles.macroText, { color: theme.textTertiary }]}>F {combinedFat.toFixed(0)}g</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
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
  calPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  calPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
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
  mealList: {
    gap: Spacing.sm,
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
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingLeft: 32 + Spacing.md,
  },
  macroText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  // Macro pills
  macroPillRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm + 2,
  },
  macroPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  macroPillValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  macroPillLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
