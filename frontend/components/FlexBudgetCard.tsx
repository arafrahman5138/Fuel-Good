/**
 * FlexBudgetCard — Weekly Fuel Score hero card.
 * Clean, minimal layout: ring left, typography-driven stats right.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, useColorScheme, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FuelScoreRing } from './FuelScoreRing';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

// ── Tier config ──────────────────────────────────────────────────────────────
const TIER_CONFIGS = [
  {
    min: 90,
    label: 'Elite Fuel',
    color: '#22C55E',
    darkGradient: ['#021a0e', '#0d3320', '#155227'] as const,
  },
  {
    min: 75,
    label: 'Strong Fuel',
    color: '#4ADE80',
    darkGradient: ['#021a0e', '#0f3b20', '#166534'] as const,
  },
  {
    min: 60,
    label: 'Decent',
    color: '#F59E0B',
    darkGradient: ['#160d02', '#3d2108', '#78350f'] as const,
  },
  {
    min: 40,
    label: 'Mixed',
    color: '#FB923C',
    darkGradient: ['#160902', '#3d1408', '#9a3412'] as const,
  },
  {
    min: 0,
    label: 'Flex Day',
    color: '#EF4444',
    darkGradient: ['#160606', '#3d0a0a', '#991b1b'] as const,
  },
];

const DARK_EMPTY_GRADIENT = ['#111118', '#1a1a24', '#111118'] as const;

function getTierCfg(score: number) {
  return TIER_CONFIGS.find((t) => score >= t.min) ?? TIER_CONFIGS[TIER_CONFIGS.length - 1];
}

// ── Props ────────────────────────────────────────────────────────────────────
interface FlexBudgetCardProps {
  avgScore: number;
  mealCount: number;
  fuelTarget: number;
  flexMealsRemaining: number;
  targetMet: boolean;
  streakWeeks: number;
  expectedMeals: number;
  weeklyMesScore?: number;
  weeklyMesTierColor?: string;
  /** Previous week's avg fuel score for trending comparison */
  prevWeekScore?: number;
  onOpenSettings?: () => void;
  onPress?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export function FlexBudgetCard({
  avgScore,
  mealCount,
  fuelTarget,
  flexMealsRemaining,
  targetMet,
  streakWeeks,
  expectedMeals,
  weeklyMesScore,
  weeklyMesTierColor,
  prevWeekScore,
  onOpenSettings,
  onPress,
}: FlexBudgetCardProps) {
  const theme = useTheme();
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.mode);
  const isDark =
    themeMode === 'system' ? (systemScheme ?? 'dark') === 'dark' : themeMode === 'dark';

  const hasData = mealCount > 0;
  const tier = getTierCfg(hasData ? avgScore : 0);
  const mealProgressPct =
    expectedMeals > 0 ? Math.min(100, (mealCount / expectedMeals) * 100) : 0;

  // Adaptive colours
  const textPrimary = isDark ? 'rgba(255,255,255,0.90)' : theme.text;
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : theme.textSecondary;
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : theme.textTertiary;
  const dividerColor = isDark ? 'rgba(255,255,255,0.10)' : theme.border;
  const ringTrack = isDark ? 'rgba(255,255,255,0.10)' : theme.surfaceHighlight;
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : theme.surfaceHighlight + 'CC';

  // ── Entrance animation ────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(36)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const onTrackScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(36);
    fadeAnim.setValue(0);
    onTrackScale.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 58,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (targetMet) {
        Animated.spring(onTrackScale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    });
  }, []);

  // ── Card background ───────────────────────────────────────────────────────
  const gradientColors = isDark
    ? hasData
      ? (tier.darkGradient as unknown as string[])
      : (DARK_EMPTY_GRADIENT as unknown as string[])
    : [theme.surface, theme.surface];

  const cardBorderColor = isDark
    ? hasData
      ? tier.color + '38'
      : 'rgba(255,255,255,0.08)'
    : theme.border;

  // Flex color
  const flexColor = flexMealsRemaining > 0 ? '#4ADE80' : '#F87171';
  const streakColor = streakWeeks > 0 ? '#FBBF24' : tier.color;

  return (
    <Animated.View
      style={[
        styles.outerWrap,
        { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.85 : 1}
        onPress={onPress}
        disabled={!onPress}
      >
      <LinearGradient
        colors={gradientColors as any}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.card, { borderColor: cardBorderColor }]}
      >
        {/* ── Body: ring left | stats right ── */}
        <View style={styles.body}>
          {/* Ring with MES badge overlay */}
          <View style={styles.ringWrap}>
            <FuelScoreRing
              score={hasData ? avgScore : 0}
              size={108}
              showLabel
              showIcon
              trackColor={ringTrack}
            />
            {hasData && (weeklyMesScore ?? 0) > 0 && (
              <View style={[styles.mesBadge, { backgroundColor: isDark ? '#1a1a24' : theme.surface }]}>
                <View style={[styles.mesBadgeRing, { borderColor: weeklyMesTierColor ?? '#8B5CF6' }]}>
                  <Ionicons name="pulse-outline" size={8} color={weeklyMesTierColor ?? '#8B5CF6'} />
                  <Text style={[styles.mesBadgeScore, { color: weeklyMesTierColor ?? '#8B5CF6' }]}>
                    {weeklyMesScore}
                  </Text>
                </View>
              </View>
            )}
            <Text style={[styles.thisWeekLabel, { color: hasData ? tier.color : textTertiary }]}>
              this week
            </Text>
          </View>

          {/* Stats */}
          {hasData ? (
            <View style={styles.statsCol}>
              {/* Title row with gear */}
              <View style={styles.titleRow}>
                <Text style={[styles.cardTitle, { color: textPrimary }]}>Weekly Fuel</Text>
                {onOpenSettings && (
                  <TouchableOpacity
                    onPress={onOpenSettings}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={[styles.gearBtn, { backgroundColor: chipBg }]}
                  >
                    <Ionicons name="settings-outline" size={14} color={textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Tier pill + On Track */}
              <View style={styles.tierRow}>
                <View style={[styles.tierPill, { backgroundColor: tier.color + '18' }]}>
                  <Text style={[styles.tierPillText, { color: tier.color }]}>{tier.label}</Text>
                </View>
                {targetMet && (
                  <Animated.View
                    style={[
                      styles.onTrackPill,
                      {
                        backgroundColor: tier.color + '20',
                        borderColor: tier.color + '50',
                        transform: [{ scale: onTrackScale }],
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={10} color={tier.color} />
                    <Text style={[styles.onTrackText, { color: tier.color }]}>On Track</Text>
                  </Animated.View>
                )}
              </View>

              {/* Flex remaining */}
              {flexMealsRemaining > 0 && (
                <View style={styles.compactRow}>
                  <Ionicons name="ticket-outline" size={12} color={flexColor} />
                  <Text style={[styles.compactText, { color: textSecondary }]}>
                    <Text style={{ color: flexColor, fontWeight: '700' }}>{flexMealsRemaining}</Text> flex left
                  </Text>
                </View>
              )}

              {/* Streak — always visible */}
              <View style={styles.compactRow}>
                <Ionicons
                  name={streakWeeks > 0 ? 'flash' : 'trending-up-outline'}
                  size={12}
                  color={streakWeeks > 0 ? streakColor : textTertiary}
                />
                {streakWeeks > 0 ? (
                  <Text style={[styles.compactText, { color: textSecondary }]}>
                    <Text style={{ color: streakColor, fontWeight: '700' }}>{streakWeeks}</Text> wk streak
                  </Text>
                ) : (
                  <Text style={[styles.compactText, { color: textTertiary }]}>Build a streak</Text>
                )}
              </View>

              {/* Trend vs last week */}
              {prevWeekScore != null && prevWeekScore > 0 && (() => {
                const diff = Math.round(avgScore - prevWeekScore);
                if (diff === 0) return null;
                const isUp = diff > 0;
                const trendColor = isUp ? '#22C55E' : '#F59E0B';
                return (
                  <View style={styles.compactRow}>
                    <Ionicons name={isUp ? 'arrow-up' : 'arrow-down'} size={12} color={trendColor} />
                    <Text style={[styles.compactText, { color: textSecondary }]}>
                      <Text style={{ color: trendColor, fontWeight: '700' }}>{isUp ? '+' : ''}{diff}</Text> vs last week
                    </Text>
                  </View>
                );
              })()}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="restaurant-outline"
                size={22}
                color={isDark ? 'rgba(255,255,255,0.22)' : theme.textTertiary}
              />
              <Text style={[styles.emptyTitle, { color: textSecondary }]}>
                No meals logged
              </Text>
              <Text style={[styles.emptyBody, { color: textTertiary }]}>
                Log a meal to start tracking your Fuel Score
              </Text>
            </View>
          )}
        </View>

        {/* ── Progress bar ── */}
        {hasData && (
          <View style={styles.progressSection}>
            <View style={[styles.progressTrack, { backgroundColor: dividerColor }]}>
              <LinearGradient
                colors={[tier.color, tier.color + '88'] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${mealProgressPct}%` }]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: textTertiary }]}>
              {mealCount} of {expectedMeals} meals logged this week
            </Text>
          </View>
        )}
      </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outerWrap: {
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: Spacing.md + 2,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.md,
  },

  // Body
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  gearBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  onTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  onTrackText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md + 2,
    paddingBottom: Spacing.xs,
  },
  ringWrap: {
    alignItems: 'center',
    gap: 4,
  },
  mesBadge: {
    position: 'absolute',
    bottom: 22,
    right: -8,
    borderRadius: 20,
    padding: 2,
  },
  mesBadgeRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesBadgeScore: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  thisWeekLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statsCol: {
    flex: 1,
    gap: Spacing.xs + 2,
  },
  tierPill: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tierPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Progress bar
  progressSection: {
    gap: 5,
    marginTop: Spacing.xs,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
