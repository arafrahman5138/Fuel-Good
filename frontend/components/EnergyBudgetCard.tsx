/**
 * EnergyBudgetCard — Hero card combining MetabolicRing + macro guardrails + score breakdown CTA.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { isReduceMotionEnabled } from '../hooks/useAnimations';
import { MetabolicRing } from './MetabolicRing';
import { getTierConfig } from '../stores/metabolicBudgetStore';
import type { MESScore, MetabolicBudget, RemainingBudget, MEAScore } from '../stores/metabolicBudgetStore';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

interface EnergyBudgetCardProps {
  score: MESScore;
  budget: MetabolicBudget;
  remaining: RemainingBudget | null;
  mea?: MEAScore | null;
  fatTargetOverride?: number | null;
  fatConsumedOverride?: number | null;
}

function GoalRing({
  label,
  icon,
  color,
  consumed,
  target,
  unit = 'g',
  stateLabel,
  animDelay = 0,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  consumed: number;
  target: number;
  unit?: string;
  stateLabel: string;
  animDelay?: number;
}) {
  const theme = useTheme();
  const safeTarget = target > 0 ? target : 1;
  const pct = Math.max(0, Math.min(100, Math.round((consumed / safeTarget) * 100)));
  const segmentCount = 24;
  const targetFilled = Math.max(0, Math.min(segmentCount, Math.round((pct / 100) * segmentCount)));

  // Animated fill
  const fillAnim = useRef(new Animated.Value(0)).current;
  const [animFilled, setAnimFilled] = useState(0);

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      setAnimFilled(targetFilled);
      fillAnim.setValue(targetFilled);
      return;
    }

    fillAnim.setValue(0);
    setAnimFilled(0);

    const listener = fillAnim.addListener(({ value }) => {
      setAnimFilled(Math.round(value));
    });

    const timeout = setTimeout(() => {
      Animated.timing(fillAnim, {
        toValue: targetFilled,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, animDelay);

    return () => {
      clearTimeout(timeout);
      fillAnim.removeListener(listener);
    };
  }, [targetFilled, animDelay, fillAnim]);

  return (
    <View style={[styles.goalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.goalTopRow}>
        <View style={[styles.goalIconWrap, { backgroundColor: color + '14' }]}>
          <Ionicons name={icon} size={13} color={color} />
        </View>
        <Text style={[styles.goalState, { color }]} numberOfLines={1}>
          {stateLabel}
        </Text>
      </View>

      <View style={styles.goalMainRow}>
        <View style={styles.goalRingWrap}>
          {Array.from({ length: segmentCount }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.goalRingSegment,
                {
                  backgroundColor: index < animFilled ? color : theme.surfaceHighlight,
                  transform: [
                    { rotate: `${(index / segmentCount) * 360}deg` },
                    { translateY: -16 },
                  ],
                },
              ]}
            />
          ))}
          <View style={styles.goalRingCenter}>
            <Text style={[styles.goalPct, { color }]}>{pct}%</Text>
          </View>
        </View>
        <View style={styles.goalTextBlock}>
          <Text style={[styles.goalLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.goalValue, { color: theme.text }]}>
            {Math.round(consumed)}
            <Text style={[styles.goalValueMuted, { color: theme.textSecondary }]}>
              /{Math.round(target)}{unit}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

export function EnergyBudgetCard({ score, budget, remaining, mea, fatTargetOverride, fatConsumedOverride }: EnergyBudgetCardProps) {
  const theme = useTheme();
  const rawScore = score.display_score || score.total_score;
  const hasAnyMeals = rawScore > 0;
  const displayTier = hasAnyMeals ? ((score.display_tier || score.tier) as any) : 'no_data';
  const displayScore = rawScore;
  const tierCfg = getTierConfig(displayTier);
  const entrance = useRef(new Animated.Value(0)).current;

  const proteinLeft = remaining ? Math.round(remaining.protein_remaining_g) : 0;
  const fiberLeft = remaining ? Math.round(remaining.fiber_remaining_g) : 0;
  const carbRoom = remaining ? Math.round((remaining as any).carb_headroom_g ?? remaining.sugar_headroom_g) : 0;
  const fatLeft = remaining ? Math.round(remaining.fat_remaining_g ?? 0) : 0;
  const meaColor = getTierConfig(mea?.tier || displayTier).color;
  const fatTarget =
    fatTargetOverride != null && Number.isFinite(fatTargetOverride) && fatTargetOverride > 0
      ? fatTargetOverride
      : (budget.fat_target_g ?? 0);
  const fatConsumed =
    fatConsumedOverride != null && Number.isFinite(fatConsumedOverride) && fatConsumedOverride >= 0
      ? fatConsumedOverride
      : (score.fat_g ?? 0);

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, displayScore]);

  const goalItems = useMemo(() => {
    const carbTarget = budget.carb_ceiling_g ?? budget.sugar_ceiling_g;
    const proteinPct = budget.protein_target_g > 0 ? (score.protein_g / budget.protein_target_g) * 100 : 0;
    const fatPct = fatTarget > 0 ? (fatConsumed / fatTarget) * 100 : 0;
    const fiberPct = budget.fiber_floor_g > 0 ? (score.fiber_g / budget.fiber_floor_g) * 100 : 0;
    const carbConsumed = score.carbs_g ?? score.sugar_g ?? 0;
    const carbPct = carbTarget > 0 ? (carbConsumed / carbTarget) * 100 : 0;

    return [
      {
        key: 'protein',
        label: 'Protein',
        icon: 'barbell-outline' as const,
        color: '#22C55E',
        consumed: score.protein_g,
        target: budget.protein_target_g,
        stateLabel: proteinPct >= 100 ? 'Hit' : 'Needs more',
      },
      {
        key: 'fat',
        label: 'Fat',
        icon: 'water-outline' as const,
        color: '#A855F7',
        consumed: fatConsumed,
        target: fatTarget,
        stateLabel: fatPct >= 100 ? 'Hit' : 'Needs more',
      },
      {
        key: 'fiber',
        label: 'Fiber',
        icon: 'leaf-outline' as const,
        color: '#3B82F6',
        consumed: score.fiber_g,
        target: budget.fiber_floor_g,
        stateLabel: fiberPct >= 100 ? 'Hit' : 'Needs more',
      },
      {
        key: 'carbs',
        label: 'Carbs',
        icon: 'shield-checkmark-outline' as const,
        color: '#F59E0B',
        consumed: carbConsumed,
        target: carbTarget,
        stateLabel: carbPct > 100 ? 'Over' : carbPct >= 85 ? 'Watch it' : 'Good',
      },
    ];
  }, [
    budget.carb_ceiling_g,
    budget.fiber_floor_g,
    budget.protein_target_g,
    budget.sugar_ceiling_g,
    fatConsumed,
    fatTarget,
    score.carbs_g,
    score.fiber_g,
    score.protein_g,
    score.sugar_g,
  ]);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* ── Branded header ── */}
      <View style={styles.header}>
        <LinearGradient
          colors={[tierCfg.color + '20', tierCfg.color + '08'] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={[styles.headerIcon, { backgroundColor: tierCfg.color + '1A' }]}>
            <Ionicons name="flash" size={13} color={tierCfg.color} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Metabolic Energy</Text>
          <View style={[styles.headerPill, { backgroundColor: tierCfg.color + '18' }]}>
            <Text style={[styles.headerPillText, { color: tierCfg.color }]}>MES</Text>
          </View>
        </LinearGradient>
      </View>

      {/* ── Score ring + tier info ── */}
      <View style={styles.topRow}>
        <MetabolicRing score={displayScore} tier={displayTier} size={96} />
        <View style={styles.tierInfo}>
          {/* Tier badge */}
          <View style={[styles.tierBadge, { backgroundColor: tierCfg.color + '18' }]}>
            <Ionicons name={tierCfg.icon} size={14} color={tierCfg.color} />
            <Text style={[styles.tierLabel, { color: tierCfg.color }]}>{tierCfg.label}</Text>
          </View>

          {/* MEA mini badge */}
          {mea && mea.mea_score > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, flexWrap: 'wrap' }}>
              <View style={[styles.statPill, { backgroundColor: meaColor + '12' }]}>
                <Ionicons name="pulse-outline" size={11} color={meaColor} />
                <Text style={[styles.statPillText, { color: meaColor }]}>
                  MEA {Math.round(mea.mea_score)}
                </Text>
              </View>
              <Text style={{ fontSize: 9, color: theme.textTertiary, fontWeight: '500' }}>
                {mea.energy_prediction === 'sustained' ? 'Sustained Energy' :
                 mea.energy_prediction === 'adequate' ? 'Adequate Energy' :
                 mea.energy_prediction === 'may_dip' ? 'May Dip' : 'Low Energy'}
              </Text>
            </View>
          )}

          {/* Remaining budget — compact stat pills */}
          {remaining && (
            <View style={styles.statPills}>
              {proteinLeft > 0 && (
                <View style={[styles.statPill, { backgroundColor: '#22C55E14' }]}>
                  <Ionicons name="barbell-outline" size={11} color="#34C759" />
                  <Text style={[styles.statPillText, { color: '#16A34A' }]}>{proteinLeft}g protein left</Text>
                </View>
              )}
              {fiberLeft > 0 && (
                <View style={[styles.statPill, { backgroundColor: '#3B82F612' }]}>
                  <Ionicons name="leaf-outline" size={11} color="#4A90D9" />
                  <Text style={[styles.statPillText, { color: '#2563EB' }]}>{fiberLeft}g fiber left</Text>
                </View>
              )}
              <View style={[styles.statPill, { backgroundColor: '#F59E0B14' }]}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#FF9500" />
                <Text style={[styles.statPillText, { color: '#D97706' }]}>{carbRoom}g carb room</Text>
              </View>
              {fatLeft > 0 && (
                <View style={[styles.statPill, { backgroundColor: '#A855F714' }]}>
                  <Ionicons name="water-outline" size={11} color="#A855F7" />
                  <Text style={[styles.statPillText, { color: '#9333EA' }]}>{fatLeft}g fat left</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={[styles.divider, { backgroundColor: theme.surfaceHighlight }]} />

      {/* ── Macro rings ── */}
      <View style={styles.goalGrid}>
        {goalItems.map((item, idx) => (
          <GoalRing
            key={item.key}
            label={item.label}
            icon={item.icon}
            color={item.color}
            consumed={item.consumed}
            target={item.target}
            stateLabel={item.stateLabel}
            animDelay={idx * 80}
          />
        ))}
      </View>

      {/* ── Score Breakdown CTA ── */}
      {score.sub_scores && score.weights_used && (
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={() => router.push('/food/mes-breakdown' as any)}
          style={[styles.breakdownLink, { borderTopColor: theme.surfaceHighlight }]}
        >
          <View style={styles.breakdownLinkLeft}>
            <Text style={[styles.breakdownLinkTitle, { color: theme.text }]}>Score Breakdown</Text>
            <Text style={[styles.breakdownLinkSub, { color: theme.textSecondary }]}>
              See how your MES is calculated
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Header
  header: {
    marginBottom: 0,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  headerPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  headerPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  // Score + Tier
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    paddingTop: Spacing.md,
  },
  tierInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.sm,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: BorderRadius.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  tierLabel: {
    fontWeight: '700',
    fontSize: FontSize.sm,
  },

  // Stat pills
  statPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: BorderRadius.xs,
    borderRadius: BorderRadius.full,
  },
  statPillText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },

  goalGrid: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm + 2,
  },
  goalCard: {
    width: '48%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  goalIconWrap: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalState: {
    flexShrink: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  goalMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  goalRingWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRingSegment: {
    position: 'absolute',
    width: 4,
    height: 9,
    borderRadius: BorderRadius.full,
  },
  goalRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPct: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  goalTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  goalLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  goalValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  goalValueMuted: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownLink: {
    marginHorizontal: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  breakdownLinkLeft: {
    flex: 1,
  },
  breakdownLinkTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  breakdownLinkSub: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
