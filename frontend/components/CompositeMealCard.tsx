/**
 * CompositeMealCard — Glassmorphic card for grouped meal events.
 *
 * Shows a meal-type header (Breakfast/Lunch/Dinner/Snack) with a
 * combined MES badge, component chips, aggregated macros, and an
 * expandable detail view of individual components.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MealMESBadge } from './MealMESBadge';
import { FuelScoreBadge } from './FuelScoreBadge';
import { useTheme, useIsDark } from '../hooks/useTheme';
import { isReduceMotionEnabled, usePressScale } from '../hooks/useAnimations';
import { useMetabolicBudgetStore, getTierConfig } from '../stores/metabolicBudgetStore';
import type { MealMES, CompositeMES, MESScore } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, MacroColors, Spacing } from '../constants/Colors';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Types ──

interface DailyLog {
  id: string;
  title: string;
  meal_type?: string;
  source_type?: string;
  fuel_score?: number | null;
  nutrition?: Record<string, number>;
  nutrition_snapshot?: Record<string, number>;
  [key: string]: unknown;
}

function cleanScanTitle(raw: string | undefined, snap: Record<string, any>): string {
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

function deriveSnackProfile(snap: Record<string, any>) {
  if (snap?.meal_context !== 'snack') return null;
  const protein = Number(snap.protein || snap.protein_g || 0);
  const carbs = Number(snap.carbs || snap.carbs_g || 0);
  const sugar = Number(snap.sugar || Math.max(0, carbs * 0.18) || 0);
  const flags = Array.isArray(snap.whole_food_flags) ? snap.whole_food_flags : [];
  const hasHighSeverity = flags.some((flag: any) => String(flag?.severity || '') === 'high');
  const isWholeFood = String(snap.whole_food_status || '') === 'pass';
  const isHealthySnack = isWholeFood && !hasHighSeverity && (protein >= 12 || (carbs <= 18 && sugar <= 10));
  return {
    isHealthySnack,
    label: isHealthySnack ? 'Healthy snack' : 'Snack',
  };
}

interface MealGroup {
  mealType: string;
  logs: DailyLog[];
  mealScores: MealMES[];
}

// ── Meal type config ──

const MEAL_TYPE_CONFIG: Record<string, { icon: string; label: string; gradient: [string, string] }> = {
  breakfast: { icon: 'sunny-outline', label: 'Breakfast', gradient: ['#F59E0B', '#D97706'] },
  lunch: { icon: 'restaurant-outline', label: 'Lunch', gradient: ['#3B82F6', '#2563EB'] },
  dinner: { icon: 'moon-outline', label: 'Dinner', gradient: ['#8B5CF6', '#6D28D9'] },
  snack: { icon: 'cafe-outline', label: 'Snack', gradient: ['#EC4899', '#DB2777'] },
};

function getMealTypeConfig(mealType: string) {
  return MEAL_TYPE_CONFIG[mealType.toLowerCase()] ?? {
    icon: 'ellipse-outline',
    label: mealType.charAt(0).toUpperCase() + mealType.slice(1),
    gradient: ['#6B7280', '#4B5563'],
  };
}

// ── Helper: aggregate nutrition from logs ──

function aggregateNutrition(logs: DailyLog[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0;
  for (const log of logs) {
    const snap = log.nutrition_snapshot || {};
    calories += Number(snap.calories || 0);
    protein += Number(snap.protein || snap.protein_g || 0);
    carbs += Number(snap.carbs || snap.carbs_g || 0);
    fat += Number(snap.fat || snap.fat_g || 0);
    fiber += Number(snap.fiber || snap.fiber_g || 0);
  }
  return { calories, protein, carbs, fat, fiber };
}

// ── SingleMealRow — used for ungrouped logs & expanded component rows ──

export const SingleMealRow = React.memo(function SingleMealRow({
  log,
  mealScore,
  recipeScoreOverride,
  isLast = false,
  compact = false,
  fuelTarget,
}: {
  log: DailyLog;
  mealScore?: MealMES;
  recipeScoreOverride?: { score: number; tier: string } | null;
  isLast?: boolean;
  compact?: boolean;
  fuelTarget?: number;
}) {
  const theme = useTheme();
  const snap = log.nutrition_snapshot || {};
  const snackProfile = log.source_type === 'scan' ? deriveSnackProfile(snap) : null;
  const cal = Number(snap.calories || 0);
  const pro = Number(snap.protein || snap.protein_g || 0);
  const carb = Number(snap.carbs || snap.carbs_g || 0);
  const fat = Number(snap.fat || snap.fat_g || 0);
  const sourceIcon =
    log.source_type === 'recipe' ? 'restaurant-outline' :
    log.source_type === 'meal_plan' ? 'calendar-outline' : 'create-outline';
  const resolvedSourceIcon =
    log.source_type === 'scan' ? 'scan-outline' : sourceIcon;
  const badgeScore =
    recipeScoreOverride?.score ??
    mealScore?.score?.display_score ??
    mealScore?.score?.total_score ??
    null;
  const badgeTier =
    recipeScoreOverride?.tier ??
    mealScore?.score?.display_tier ??
    mealScore?.score?.tier ??
    'critical';
  const displayTitle = log.source_type === 'scan' ? cleanScanTitle(log.title, snap) : (log.title || 'Untitled');
  const showMesBadge = !compact && !snackProfile && (mealScore || recipeScoreOverride);
  const showSnackBadge = !compact && !!snackProfile;
  const scanAccent = snackProfile?.isHealthySnack ? '#16A34A' : '#64748B';
  const scanAccentBg = snackProfile?.isHealthySnack ? '#DCFCE7' : '#F1F5F9';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? Spacing.sm : Spacing.md,
        paddingVertical: compact ? Spacing.xs + 2 : Spacing.sm + 2,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.surfaceHighlight,
      }}
    >
      <View
        style={{
          width: compact ? 26 : 32,
          height: compact ? 26 : 32,
          borderRadius: BorderRadius.sm,
          backgroundColor: theme.surfaceHighlight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={resolvedSourceIcon as any} size={compact ? 13 : 16} color={theme.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: compact ? FontSize.xs : FontSize.sm,
              fontWeight: '600',
              flex: 1,
            }}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
          {log.fuel_score != null && (
            <FuelScoreBadge score={log.fuel_score} compact fuelTarget={fuelTarget} />
          )}
          {log.fuel_score == null && (log.source_type === 'recipe' || log.source_type === 'meal_plan') && (
            <FuelScoreBadge score={100} compact fuelTarget={fuelTarget} />
          )}
          {showMesBadge && badgeScore != null && (
            <MealMESBadge score={badgeScore} tier={badgeTier} compact />
          )}
          {showSnackBadge && (
            <View
              style={{
                backgroundColor: scanAccentBg,
                borderRadius: BorderRadius.full,
                paddingHorizontal: Spacing.sm + 2,
                paddingVertical: Spacing.xs + 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.xs + 1,
              }}
            >
              <Ionicons name={snackProfile.isHealthySnack ? 'leaf-outline' : 'cafe-outline'} size={12} color={scanAccent} />
              <Text style={{ color: scanAccent, fontSize: 10, fontWeight: '700' }}>
                {snackProfile.label}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 1 }}>
          <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>
            {cal.toFixed(0)} calories
          </Text>
          {pro > 0 && <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>P {pro.toFixed(0)}g</Text>}
          {carb > 0 && <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>C {carb.toFixed(0)}g</Text>}
          {fat > 0 && <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '500' }}>F {fat.toFixed(0)}g</Text>}
        </View>
        {snackProfile && (
          <Text
            style={{
              color: theme.textTertiary,
              fontSize: 11,
              fontWeight: '500',
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            Whole-food snack logged separately from MES meals
          </Text>
        )}
      </View>
    </View>
  );
});

// ── CompositeMealCard — The main composite card ──

export function CompositeMealCard({ group, fuelTarget }: { group: MealGroup; fuelTarget?: number }) {
  const theme = useTheme();
  const press = usePressScale();
  const isDark = useIsDark();
  const fetchCompositeMES = useMetabolicBudgetStore((s) => s.fetchCompositeMES);
  const [expanded, setExpanded] = useState(false);
  const [compositeMES, setCompositeMES] = useState<CompositeMES | null>(null);
  const [loading, setLoading] = useState(false);

  const config = getMealTypeConfig(group.mealType);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const rowAnims = useRef<Animated.Value[]>([]);
  const agg = useMemo(() => aggregateNutrition(group.logs), [group.logs]);
  const avgFuelScore = useMemo(() => {
    const scores = group.logs.map((l) => l.fuel_score).filter((s): s is number => s != null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }, [group.logs]);
  const compositeLogIds = useMemo(
    () => group.logs.map((log) => log.id).filter(Boolean),
    [group.logs]
  );
  const compositeLogIdsKey = useMemo(() => compositeLogIds.join(','), [compositeLogIds]);

  // Fetch composite MES on mount
  useEffect(() => {
    let cancelled = false;
    if (compositeLogIds.length < 2) return;

    setLoading(true);
    fetchCompositeMES(compositeLogIds).then(result => {
      if (!cancelled) {
        setCompositeMES(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [compositeLogIdsKey, fetchCompositeMES]);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);

    if (isReduceMotionEnabled()) {
      chevronAnim.setValue(next ? 1 : 0);
      return;
    }

    // Animate chevron rotation
    Animated.spring(chevronAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();

    // Stagger rows in when expanding
    if (next) {
      const count = group.logs.length;
      if (rowAnims.current.length !== count) {
        rowAnims.current = Array.from({ length: count }, () => new Animated.Value(0));
      } else {
        rowAnims.current.forEach((a) => a.setValue(0));
      }
      Animated.stagger(
        50,
        rowAnims.current.map((a) =>
          Animated.timing(a, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
  };

  // Determine display score/tier
  const displayScore = compositeMES?.score?.display_score ?? compositeMES?.score?.total_score ?? null;
  const displayTier = compositeMES?.score?.display_tier ?? compositeMES?.score?.tier ?? 'crash_risk';
  const tierCfg = getTierConfig(displayTier);

  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity activeOpacity={0.85} onPress={toggleExpand} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card.background,
              borderColor: theme.card.border,
            },
          ]}
        >
          {/* ── Tier accent left strip ── */}
          <View
            style={[
              styles.accentStrip,
              { backgroundColor: displayScore != null ? tierCfg.color + '60' : theme.surfaceHighlight },
            ]}
          />

          <View style={styles.cardContent}>
            {/* ── Header: Meal type icon + label + MES badge ── */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.mealTypeIcon, { backgroundColor: config.gradient[0] + '20' }]}>
                  <Ionicons name={config.icon as any} size={16} color={config.gradient[0]} />
                </View>
                <View>
                  <Text style={[styles.mealTypeLabel, { color: theme.text }]}>
                    {config.label}
                  </Text>
                  <Text style={[styles.componentCount, { color: theme.textTertiary }]}>
                    {group.logs.length} item{group.logs.length > 1 ? 's' : ''} · {agg.calories.toFixed(0)} calories
                  </Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                {avgFuelScore != null && (
                  <FuelScoreBadge score={avgFuelScore} compact fuelTarget={fuelTarget} />
                )}
                {loading ? (
                  <View style={[styles.mesBadgeLoading, { backgroundColor: theme.surfaceHighlight }]}>
                    <Text style={{ color: theme.textTertiary, fontSize: 10, fontWeight: '700' }}>···</Text>
                  </View>
                ) : displayScore != null ? (
                  <MealMESBadge score={displayScore} tier={displayTier} />
                ) : null}
                <Animated.View
                  style={{
                    transform: [{
                      rotate: chevronAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '180deg'],
                      }),
                    }],
                  }}
                >
                  <Ionicons name="chevron-down" size={14} color={theme.textTertiary} />
                </Animated.View>
              </View>
            </View>

            {/* ── Component chips ── */}
            <View style={styles.chipRow}>
              {group.logs.map((log) => (
                <View
                  key={log.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {log.title || 'Untitled'}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Aggregated macros ── */}
            <View style={styles.macroRow}>
              {[
                { label: 'Protein', value: agg.protein, color: MacroColors.protein },
                { label: 'Carbs', value: agg.carbs, color: MacroColors.carbs },
                { label: 'Fat', value: agg.fat, color: MacroColors.fat },
                { label: 'Fiber', value: agg.fiber, color: MacroColors.fiber },
              ].map((m) => (
                <View key={m.label} style={styles.macroItem}>
                  <View style={[styles.macroDot, { backgroundColor: m.color + '40' }]}>
                    <View style={[styles.macroDotInner, { backgroundColor: m.color }]} />
                  </View>
                  <Text style={[styles.macroValue, { color: theme.text }]}>{m.value.toFixed(0)}g</Text>
                  <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* ── Expanded: individual component rows ── */}
            {expanded && (
              <View style={[styles.expandedSection, { borderTopColor: theme.surfaceHighlight }]}>
                {group.logs.map((log, idx) => {
                  const score = group.mealScores.find(ms => ms.food_log_id === log.id);
                  const rowAnim = rowAnims.current[idx];
                  const rowStyle = rowAnim
                    ? {
                        opacity: rowAnim,
                        transform: [{
                          translateY: rowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 0],
                          }),
                        }],
                      }
                    : undefined;
                  return (
                    <Animated.View key={log.id} style={rowStyle}>
                      <SingleMealRow
                        log={log}
                        mealScore={score}
                        isLast={idx === group.logs.length - 1}
                        compact
                      />
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentStrip: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    flex: 1,
  },
  mealTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTypeLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  componentCount: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  mesBadgeLoading: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    marginTop: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    maxWidth: 180,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  macroItem: {
    alignItems: 'center',
    gap: 2,
  },
  macroDot: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroDotInner: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.xs,
  },
  macroValue: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  expandedSection: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    paddingTop: Spacing.xs,
  },
});
