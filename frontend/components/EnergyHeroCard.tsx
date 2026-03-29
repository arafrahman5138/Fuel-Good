/**
 * EnergyHeroCard — Homepage hero showing weekly fuel + MES scores.
 * Dual-ring layout: large Fuel ring + mini MES ring on left, tier + tagline on right.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FuelScoreRing } from './FuelScoreRing';
import { FuelStreakBadge } from './FuelStreakBadge';
import { MetabolicStreakBadge } from './MetabolicStreakBadge';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

// ── Tier config ─────────────────────────────────────────────────────────────
const TIER_CONFIGS = [
  { min: 90, label: 'Elite Fuel', color: '#22C55E', darkGradient: ['#021a0e', '#0d3320', '#155227'] as const, lightGradient: ['#f0fdf4', '#dcfce7', '#f0fdf4'] as const },
  { min: 75, label: 'Strong Fuel', color: '#4ADE80', darkGradient: ['#021a0e', '#0f3b20', '#166534'] as const, lightGradient: ['#f0fdf4', '#dcfce7', '#f0fdf4'] as const },
  { min: 60, label: 'Decent', color: '#F59E0B', darkGradient: ['#160d02', '#3d2108', '#78350f'] as const, lightGradient: ['#fffbeb', '#fef3c7', '#fffbeb'] as const },
  { min: 40, label: 'Mixed', color: '#FB923C', darkGradient: ['#160902', '#3d1408', '#9a3412'] as const, lightGradient: ['#fff7ed', '#fed7aa', '#fff7ed'] as const },
  { min: 0, label: 'Flex Day', color: '#EF4444', darkGradient: ['#160606', '#3d0a0a', '#991b1b'] as const, lightGradient: ['#fef2f2', '#fecaca', '#fef2f2'] as const },
];

const DARK_EMPTY_GRADIENT = ['#111118', '#1a1a24', '#111118'] as const;

function getTierCfg(score: number) {
  return TIER_CONFIGS.find((t) => score >= t.min) ?? TIER_CONFIGS[TIER_CONFIGS.length - 1];
}

// ── Energy taglines ─────────────────────────────────────────────────────────
const ENERGY_TAGLINES: Record<string, { text: string; color: string }> = {
  sustained: { text: "You're fueled for a strong day", color: '#22C55E' },
  adequate: { text: 'Energy looking solid today', color: '#3B82F6' },
  may_dip: { text: 'Watch for an afternoon dip', color: '#F59E0B' },
  likely_fatigued: { text: 'Low fuel — eat something nourishing', color: '#EF4444' },
};

function getContextTagline(
  fuelScore: number,
  mealCount: number,
  weeklyProgress: number,
  energyPrediction: string | null | undefined,
  weeklyTargetMet: boolean,
): { text: string; color: string } {
  if (mealCount === 0) {
    return { text: 'Your day is a blank slate — make it count', color: '#4ADE80' };
  }
  if (mealCount <= 2) {
    if (fuelScore >= 90) return { text: 'Elite start — keep this going all day', color: '#22C55E' };
    if (fuelScore >= 75) return { text: 'Great start — keep this momentum going', color: '#4ADE80' };
    if (fuelScore >= 60) return { text: 'Solid start — your next meal can level you up', color: '#F59E0B' };
    return { text: 'Still early — one clean meal changes everything', color: '#FB923C' };
  }
  if (weeklyTargetMet) {
    return { text: 'Weekly target crushed — you earned this', color: '#22C55E' };
  }
  if (energyPrediction && ENERGY_TAGLINES[energyPrediction]) {
    return ENERGY_TAGLINES[energyPrediction];
  }
  if (fuelScore >= 90) return { text: "Elite day — you're in the zone", color: '#22C55E' };
  if (fuelScore >= 75) return { text: 'Strong fuel — your body is thanking you', color: '#4ADE80' };
  if (fuelScore >= 60) return { text: 'Decent day — one clean meal pushes you higher', color: '#F59E0B' };
  if (fuelScore >= 40) return { text: 'Mixed fuel — a whole-food meal turns this around', color: '#FB923C' };
  return { text: 'Flex day — get back on track with something nourishing', color: '#EF4444' };
}

// ── MES tier label ──────────────────────────────────────────────────────────
function getMesTierLabel(score: number): string {
  if (score >= 85) return 'Optimal';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Low';
  return 'Poor';
}

// ── Props ────────────────────────────────────────────────────────────────────
interface EnergyHeroCardProps {
  fuelScore: number;
  mesScore?: number;
  mesTierColor?: string;
  energyPrediction?: string | null;
  fuelStreakWeeks: number;
  metabolicStreakDays: number;
  weeklyProgress: number;
  weeklyTargetMet?: boolean;
  weeklyDaysLogged?: number;
  mealCount: number;
  proteinRemaining?: number;
  fiberRemaining?: number;
  healthPulse?: { fuel: any; metabolic: any; nutrition: any };
  flexMealsEarned?: number;
  cleanMealsToNextFlex?: number;
  onPress?: () => void;
}

// ── Mini MES Ring ────────────────────────────────────────────────────────────
function MiniMesRing({
  score,
  tierColor,
  trackColor,
  icon,
  backgroundColor,
}: {
  score: number;
  tierColor: string;
  trackColor: string;
  icon: 'pulse-outline' | 'leaf';
  backgroundColor?: string;
}) {
  const size = 38;
  const borderWidth = 2.5;

  return (
    <View style={[miniStyles.container, { width: size, height: size }]}>
      {/* Track */}
      <View
        style={[
          miniStyles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: trackColor,
          },
        ]}
      />
      {/* Colored ring */}
      <View
        style={[
          miniStyles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: tierColor,
          },
        ]}
      />
      {/* Center content */}
      <View style={[miniStyles.center, { width: size - borderWidth * 2, height: size - borderWidth * 2, borderRadius: (size - borderWidth * 2) / 2, backgroundColor: backgroundColor ?? 'transparent' }]}>
        <Ionicons name={icon} size={9} color={tierColor} />
        <Text style={[miniStyles.score, { color: tierColor }]}>{score}</Text>
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
});

// ── Component ────────────────────────────────────────────────────────────────
export function EnergyHeroCard({
  fuelScore,
  mesScore,
  mesTierColor,
  energyPrediction,
  fuelStreakWeeks,
  metabolicStreakDays,
  weeklyProgress,
  weeklyTargetMet = false,
  weeklyDaysLogged = 0,
  mealCount,
  flexMealsEarned = 0,
  cleanMealsToNextFlex = 0,
  onPress,
}: EnergyHeroCardProps) {
  const theme = useTheme();
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.mode);
  const isDark = themeMode === 'system' ? (systemScheme ?? 'dark') === 'dark' : themeMode === 'dark';

  const hasData = fuelScore > 0 || mealCount > 0;
  const tier = getTierCfg(hasData ? fuelScore : 0);

  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : theme.textTertiary;
  const ringTrack = isDark ? 'rgba(255,255,255,0.10)' : theme.surfaceHighlight;

  const tagline = getContextTagline(fuelScore, mealCount, weeklyProgress, energyPrediction, weeklyTargetMet);

  const gradientColors = isDark
    ? hasData ? (tier.darkGradient as unknown as string[]) : (DARK_EMPTY_GRADIENT as unknown as string[])
    : hasData ? (tier.lightGradient as unknown as string[]) : [theme.surface, theme.surface, theme.surface];
  const cardBorderColor = isDark
    ? hasData ? tier.color + '38' : 'rgba(255,255,255,0.08)'
    : hasData ? tier.color + '30' : theme.border;

  // Entrance animation
  const slideAnim = useRef(new Animated.Value(36)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(36);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 11, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const hasMes = hasData && (mesScore ?? 0) > 0;
  const resolvedMesColor = mesTierColor ?? '#8B5CF6';
  const hasStreaks = metabolicStreakDays > 0 || fuelStreakWeeks > 0;

  // Controlled toggle: lift showMes state so badge reacts to ring swap
  const [showMes, setShowMes] = useState(false);
  const badgeBounce = useRef(new Animated.Value(1)).current;

  const handleRingToggle = () => {
    // Bounce the badge out and back in sync with the ring swap
    Animated.sequence([
      Animated.timing(badgeBounce, { toValue: 0.5, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.spring(badgeBounce, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }),
    ]).start();
    setShowMes((prev) => !prev);
  };

  return (
    <Animated.View style={[styles.outerWrap, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
      <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={gradientColors as any}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.card, { borderColor: cardBorderColor }]}
      >
        {/* ── Body: ring left | stats right ── */}
        <View style={styles.body}>
          {/* Fuel ring with MES badge overlay */}
          <View style={styles.ringContainer}>
            <FuelScoreRing
              score={hasData ? fuelScore : 0}
              size={108}
              showLabel
              showIcon
              trackColor={ringTrack}
              mesScore={mesScore}
              mesTierColor={mesTierColor}
              showMes={hasMes ? showMes : undefined}
              onToggle={hasMes ? handleRingToggle : undefined}
            />
            {hasMes && (
              <Animated.View
                style={[styles.mesBadge, { backgroundColor: isDark ? '#111916' : theme.surface, transform: [{ scale: badgeBounce }] }]}
              >
                <MiniMesRing
                  score={showMes ? fuelScore : mesScore!}
                  tierColor={showMes ? tier.color : resolvedMesColor}
                  trackColor={ringTrack}
                  icon={showMes ? 'leaf' : 'pulse-outline'}
                  backgroundColor={isDark ? '#111916' : '#fff'}
                />
              </Animated.View>
            )}
            <Text style={[styles.thisWeekLabel, { color: hasData ? tier.color : textTertiary }]}>
              this week
            </Text>
          </View>

          <View style={styles.statsCol}>
            {/* Tier pill */}
            <View style={[styles.tierPill, { backgroundColor: hasData ? tier.color + '18' : (isDark ? 'rgba(255,255,255,0.06)' : theme.surfaceHighlight) }]}>
              <Text style={[styles.tierPillText, { color: hasData ? tier.color : textTertiary }]}>
                {hasData ? tier.label : 'Ready to fuel'}
              </Text>
            </View>

            {/* Tagline */}
            <Text style={[styles.tagline, { color: tagline.color }]} numberOfLines={3}>
              {tagline.text}
            </Text>

            {/* Streaks */}
            {hasStreaks && (
              <View style={styles.streakRow}>
                {metabolicStreakDays > 0 && (
                  <MetabolicStreakBadge currentStreak={metabolicStreakDays} compact />
                )}
                {fuelStreakWeeks > 0 && (
                  <FuelStreakBadge currentStreak={fuelStreakWeeks} compact />
                )}
              </View>
            )}
          </View>
        </View>
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ringContainer: {
    alignItems: 'center',
    gap: 4,
  },
  mesBadge: {
    position: 'absolute',
    bottom: 12,
    right: -8,
    borderRadius: 20,
    padding: 2,
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
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  tagline: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
});
