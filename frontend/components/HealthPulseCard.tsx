/**
 * HealthPulseCard — Composite health score combining Fuel, Metabolic, and Nutrition.
 * Shows a single "Health Pulse" score with 3-dimension breakdown bars.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

interface Dimension {
  score: number;
  label: string;
  tier: string;
  available: boolean;
}

interface HealthPulseCardProps {
  score: number;
  tier: string;
  tierLabel: string;
  fuel: Dimension;
  metabolic: Dimension;
  nutrition: Dimension;
  mealCount: number;
  onPress?: () => void;
}

const TIER_COLORS: Record<string, string> = {
  excellent: '#22C55E',
  good: '#3B82F6',
  fair: '#F59E0B',
  poor: '#EF4444',
};

const DIMENSION_CONFIG: Record<string, { icon: string; gradient: readonly [string, string] }> = {
  fuel: { icon: 'leaf', gradient: ['#22C55E', '#16A34A'] as const },
  metabolic: { icon: 'flash', gradient: ['#8B5CF6', '#6D28D9'] as const },
  nutrition: { icon: 'nutrition', gradient: ['#3B82F6', '#2563EB'] as const },
};

export function HealthPulseCard({
  score,
  tier,
  tierLabel,
  fuel,
  metabolic,
  nutrition,
  mealCount,
  onPress,
}: HealthPulseCardProps) {
  const theme = useTheme();
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.fair;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (score >= 82) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [score, pulseAnim]);

  const dimensions = [
    { key: 'fuel', dim: fuel },
    { key: 'metabolic', dim: metabolic },
    { key: 'nutrition', dim: nutrition },
  ];

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} disabled={!onPress}>
      <View style={[styles.container, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
        {/* ── Header Row ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Animated.View style={[styles.scoreCircle, { borderColor: tierColor, transform: [{ scale: pulseAnim }] }]}>
              <Text style={[styles.scoreValue, { color: tierColor }]}>{Math.round(score)}</Text>
            </Animated.View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>Health Pulse</Text>
              <View style={[styles.tierBadge, { backgroundColor: tierColor + '18' }]}>
                <Text style={[styles.tierText, { color: tierColor }]} numberOfLines={1}>{tierLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.mealCountText, { color: theme.textSecondary }]} numberOfLines={1}>
              {mealCount} meal{mealCount !== 1 ? 's' : ''} today
            </Text>
            {onPress && (
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            )}
          </View>
        </View>

        {/* ── Dimension Bars ── */}
        <View style={styles.dimensions}>
          {dimensions.map(({ key, dim }) => {
            const config = DIMENSION_CONFIG[key];
            return (
              <View key={key} style={styles.dimRow}>
                <View style={[styles.dimIconWrap, { backgroundColor: config.gradient[0] + '14' }]}>
                  <Ionicons name={config.icon as any} size={14} color={config.gradient[0]} />
                </View>
                <View style={styles.dimContent}>
                  <View style={styles.dimLabelRow}>
                    <Text style={[styles.dimLabel, { color: theme.textSecondary }]}>{dim.label}</Text>
                    <Text style={[styles.dimScore, { color: dim.available ? theme.text : theme.textTertiary }]}>
                      {dim.available ? Math.round(dim.score) : '—'}
                    </Text>
                  </View>
                  <View style={[styles.dimTrack, { backgroundColor: theme.surfaceHighlight }]}>
                    <LinearGradient
                      colors={config.gradient as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.dimFill, { width: `${dim.available ? Math.max(4, dim.score) : 0}%` }]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  headerText: {
    gap: 2,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealCountText: {
    fontSize: FontSize.xs,
  },
  dimensions: {
    gap: Spacing.sm,
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dimIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimContent: {
    flex: 1,
    gap: 3,
  },
  dimLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  dimScore: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  dimTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dimFill: {
    height: '100%',
    borderRadius: 3,
  },
});
