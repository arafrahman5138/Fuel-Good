/**
 * TodayProgressBar — Slim horizontal bar showing today's key stats at a glance.
 * Meals logged, fuel score trend, and flex remaining — all inline, no cards.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

// ── Props ────────────────────────────────────────────────────────────────────
interface TodayProgressBarProps {
  mealCount: number;
  fuelScore: number;
  flexMealsRemaining: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export function TodayProgressBar({
  mealCount,
  fuelScore,
  flexMealsRemaining,
}: TodayProgressBarProps) {
  const theme = useTheme();

  const fuelColor = fuelScore >= 90 ? '#22C55E' : fuelScore >= 75 ? '#4ADE80' : fuelScore >= 60 ? '#F59E0B' : fuelScore >= 40 ? '#FB923C' : '#EF4444';
  const flexColor = flexMealsRemaining > 0 ? '#F59E0B' : theme.textTertiary;

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => router.push('/(tabs)/chronometer')}
      style={[styles.bar, { backgroundColor: theme.card.background, borderColor: theme.border }]}
    >
      {/* Meals */}
      <View style={styles.stat}>
        <Ionicons name="restaurant" size={14} color={theme.primary} />
        <Text style={[styles.statValue, { color: theme.text }]}>{mealCount}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
          meal{mealCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Fuel Score */}
      <View style={styles.stat}>
        <Ionicons name="leaf" size={14} color={fuelColor} />
        <Text style={[styles.statValue, { color: fuelColor }]}>{mealCount > 0 ? fuelScore : '—'}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>fuel</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Flex */}
      <View style={styles.stat}>
        <Ionicons name="ticket" size={14} color={flexColor} />
        <Text style={[styles.statValue, { color: flexColor }]}>{flexMealsRemaining}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>flex</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 18,
    marginHorizontal: Spacing.xs,
  },
  chevron: {
    marginLeft: Spacing.xs,
  },
});
