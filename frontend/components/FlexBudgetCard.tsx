/**
 * FlexBudgetCard — Weekly Fuel Score hero card.
 * Clean, minimal layout: ring left, typography-driven stats right.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, useColorScheme, useWindowDimensions, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  onOpenSettings,
  onPress,
}: FlexBudgetCardProps) {
  const theme = useTheme();
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const themeMode = useThemeStore((s) => s.mode);
  const isDark =
    themeMode === 'system' ? (systemScheme ?? 'dark') === 'dark' : themeMode === 'dark';

  const ringSize = Math.min(118, Math.round(width * 0.3));
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
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.leafDot, { backgroundColor: tier.color + '28' }]}>
              <Ionicons name="leaf" size={12} color={tier.color} />
            </View>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Weekly Fuel</Text>
            <Text style={[styles.headerSub, { color: textTertiary }]} numberOfLines={1}>
              Target: {fuelTarget}+
            </Text>
          </View>
          <View style={styles.headerRight}>
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
                <Ionicons name="checkmark-circle" size={11} color={tier.color} />
                <Text style={[styles.onTrackText, { color: tier.color }]}>On Track</Text>
              </Animated.View>
            )}
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
        </View>

        {/* ── Body: ring left | clean stats right ── */}
        <View style={styles.body}>
          {/* Ring */}
          <View style={styles.ringWrap}>
            <FuelScoreRing
              score={hasData ? avgScore : 0}
              size={ringSize}
              showLabel
              showIcon
              trackColor={ringTrack}
            />
            {hasData && (
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            )}
          </View>

          {/* Stats — clean vertical stack, no boxes */}
          {hasData ? (
            <View style={styles.statsCol}>
              {/* Flex Left */}
              <View style={styles.statRow}>
                <Ionicons name="pizza-outline" size={14} color={flexColor} />
                <Text style={[styles.statValue, { color: flexColor }]}>
                  {flexMealsRemaining}
                  <Text style={[styles.statUnit, { color: textTertiary }]}> flex left</Text>
                </Text>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              {/* Row 3: Streak */}
              <View style={styles.statRow}>
                <Ionicons
                  name={streakWeeks > 0 ? 'flash' : 'trending-up-outline'}
                  size={14}
                  color={streakColor}
                />
                {streakWeeks > 0 ? (
                  <Text style={[styles.statValue, { color: streakColor }]}>
                    {streakWeeks}
                    <Text style={[styles.statUnit, { color: textTertiary }]}> wk streak</Text>
                  </Text>
                ) : (
                  <Text style={[styles.statValue, { color: streakColor }]}>
                    Build
                    <Text style={[styles.statUnit, { color: textTertiary }]}> a streak</Text>
                  </Text>
                )}
              </View>

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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 1,
  },
  leafDot: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  headerSub: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginLeft: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  gearBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  onTrackText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Body
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md + 2,
    paddingBottom: Spacing.xs,
  },
  ringWrap: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  tierLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 6,
  },

  // Stats — clean rows
  statsCol: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  statValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statDenom: {
    fontSize: 12,
    fontWeight: '500',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
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
  progressLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
