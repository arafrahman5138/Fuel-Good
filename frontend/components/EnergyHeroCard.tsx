/**
 * EnergyHeroCard — Homepage hero showing weekly fuel score.
 * Ring on the left, tier + energy tagline + streaks on the right.
 * Progress bar at the bottom.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
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
  { min: 90, label: 'Elite Fuel', color: '#22C55E', darkGradient: ['#021a0e', '#0d3320', '#155227'] as const },
  { min: 75, label: 'Strong Fuel', color: '#4ADE80', darkGradient: ['#021a0e', '#0f3b20', '#166534'] as const },
  { min: 60, label: 'Decent', color: '#F59E0B', darkGradient: ['#160d02', '#3d2108', '#78350f'] as const },
  { min: 40, label: 'Mixed', color: '#FB923C', darkGradient: ['#160902', '#3d1408', '#9a3412'] as const },
  { min: 0, label: 'Flex Day', color: '#EF4444', darkGradient: ['#160606', '#3d0a0a', '#991b1b'] as const },
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
    return { text: 'Your day is a blank slate — make it count', color: '#8B5CF6' };
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

// ── Health Pulse dimension ───────────────────────────────────────────────────
interface HealthDimension {
  score: number;
  label: string;
  tier: string;
  available: boolean;
}

interface HealthPulseData {
  fuel: HealthDimension;
  metabolic: HealthDimension;
  nutrition: HealthDimension;
}

const PULSE_DIMS = [
  { key: 'fuel' as const, icon: 'leaf' as const, color: '#22C55E' },
  { key: 'metabolic' as const, icon: 'flash' as const, color: '#8B5CF6' },
  { key: 'nutrition' as const, icon: 'nutrition' as const, color: '#3B82F6' },
];

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
  healthPulse?: HealthPulseData;
}

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
  proteinRemaining,
  fiberRemaining,
  healthPulse,
}: EnergyHeroCardProps) {
  const theme = useTheme();
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.mode);
  const isDark = themeMode === 'system' ? (systemScheme ?? 'dark') === 'dark' : themeMode === 'dark';

  const hasData = mealCount > 0;
  const tier = getTierCfg(hasData ? fuelScore : 0);

  // Adaptive colors
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : theme.textTertiary;
  const dividerColor = isDark ? 'rgba(255,255,255,0.10)' : theme.border;
  const ringTrack = isDark ? 'rgba(255,255,255,0.10)' : theme.surfaceHighlight;

  // Tagline
  const tagline = getContextTagline(fuelScore, mealCount, weeklyProgress, energyPrediction, weeklyTargetMet);

  // Card background
  const gradientColors = isDark
    ? hasData ? (tier.darkGradient as unknown as string[]) : (DARK_EMPTY_GRADIENT as unknown as string[])
    : [theme.surface, theme.surface];
  const cardBorderColor = isDark
    ? hasData ? tier.color + '38' : 'rgba(255,255,255,0.08)'
    : theme.border;

  const progressPct = Math.min(100, Math.max(0, weeklyProgress));

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

  return (
    <Animated.View style={[styles.outerWrap, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
      <LinearGradient
        colors={gradientColors as any}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.card, { borderColor: cardBorderColor }]}
      >
        {/* ── Body: ring left | stats right ── */}
        <View style={styles.body}>
          <View style={styles.ringWrap}>
            <FuelScoreRing
              score={hasData ? fuelScore : 0}
              size={108}
              showLabel
              showIcon
              trackColor={ringTrack}
              mesScore={mesScore}
              mesTierColor={mesTierColor}
            />
            <View style={[styles.weekPill, { backgroundColor: hasData ? tier.color + '15' : (isDark ? 'rgba(255,255,255,0.06)' : theme.surfaceHighlight) }]}>
              <Text style={[styles.weekPillText, { color: hasData ? tier.color : textTertiary }]}>This week</Text>
            </View>
          </View>

          <View style={styles.statsCol}>
            <View style={[styles.tierPill, { backgroundColor: hasData ? tier.color + '18' : (isDark ? 'rgba(255,255,255,0.06)' : theme.surfaceHighlight) }]}>
              <Text style={[styles.tierPillText, { color: hasData ? tier.color : textTertiary }]}>
                {hasData ? tier.label : 'Ready to fuel'}
              </Text>
            </View>
            <Text style={[styles.tagline, { color: tagline.color }]} numberOfLines={2}>
              {tagline.text}
            </Text>
            <View style={styles.streakRow}>
              {hasData && (mesScore ?? 0) > 0 && (
                <View style={[styles.mesPill, { backgroundColor: (mesTierColor ?? '#8B5CF6') + '18' }]}>
                  <Ionicons name="flash" size={10} color={mesTierColor ?? '#8B5CF6'} />
                  <Text style={[styles.mesPillText, { color: mesTierColor ?? '#8B5CF6' }]}>
                    {mesScore} MES
                  </Text>
                </View>
              )}
              {metabolicStreakDays > 0 && (
                <MetabolicStreakBadge currentStreak={metabolicStreakDays} compact />
              )}
              {fuelStreakWeeks > 0 && (
                <FuelStreakBadge currentStreak={fuelStreakWeeks} compact />
              )}
            </View>
          </View>
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: dividerColor }]}>
            {hasData && (
              <LinearGradient
                colors={[tier.color, tier.color + '88'] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progressPct}%` }]}
              />
            )}
          </View>
          <Text style={[styles.progressLabel, { color: weeklyTargetMet ? '#22C55E' : textTertiary }]}>
            {!hasData
              ? 'Log a meal to start tracking your week'
              : weeklyTargetMet
                ? 'Weekly target crushed — enjoy your flex meals'
                : weeklyDaysLogged === 0
                  ? 'Start fueling your week'
                  : `${weeklyDaysLogged} of 7 days fueled this week`}
          </Text>
        </View>

        {/* ── Smart CTA ── */}
        {hasData && progressPct < 100 && (
          <View style={[styles.ctaRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : theme.surfaceHighlight + '80' }]}>
            <Ionicons
              name={fuelScore >= 75 ? 'arrow-up-circle' : 'add-circle'}
              size={14}
              color={tier.color}
            />
            <Text style={[styles.ctaText, { color: isDark ? 'rgba(255,255,255,0.55)' : theme.textSecondary }]}>
              {mealCount === 0
                ? 'Log your first meal to start your streak'
                : (proteinRemaining ?? 0) > 20
                  ? `You need ${Math.round(proteinRemaining!)}g more protein — try a whole-food meal`
                  : (fiberRemaining ?? 0) > 5
                    ? `Add ${Math.round(fiberRemaining!)}g fiber — veggies or legumes with your next meal`
                    : (weeklyDaysLogged ?? 0) < 4
                      ? `${7 - (weeklyDaysLogged ?? 0)} more days to hit your weekly target`
                      : fuelScore >= 75
                        ? 'Keep it up — you\'re building something great'
                        : 'One clean meal can change your whole day'}
            </Text>
          </View>
        )}
      </LinearGradient>
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
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  weekPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  weekPillText: {
    fontSize: 11,
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
  tagline: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  progressSection: {
    gap: 4,
    marginTop: Spacing.sm + 2,
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
  mesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  mesPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pulseRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pulseDim: {
    flex: 1,
    gap: 3,
  },
  pulseLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pulseLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  pulseTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  pulseFill: {
    height: '100%',
    borderRadius: 2,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  ctaText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
});
