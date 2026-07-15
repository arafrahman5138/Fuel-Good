/**
 * ScanWeekImpact — "Do I have room for this?" strip on scan results.
 *
 * The burger-spot moment: after any scan, answer where the user's week
 * stands and what logging this food would do to it. Real Food Tracker
 * semantics: score ≥ target strengthens the week; below target uses a
 * room-for-life slot (snacks/desserts included). Never shames — running
 * out of room is information, not failure.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useFuelStore } from '../stores/fuelStore';

const GREEN = '#22C55E';
const AMBER = '#F59E0B';

interface ScanWeekImpactProps {
  score: number | null | undefined;
  /** meal_type when known (meal scans); snacks/desserts word the copy differently */
  mealType?: string;
  /** true once this scan has been logged — switches copy to past tense */
  logged?: boolean;
  /** products aren't logged from the result screen; copy becomes "if you eat this" */
  variant?: 'meal' | 'product';
  /** changes (e.g. scan id) retrigger the weekly refresh */
  refreshKey?: string;
}

function ScanWeekImpactImpl({ score, mealType, logged, variant = 'meal', refreshKey }: ScanWeekImpactProps) {
  const theme = useTheme();
  const weekly = useFuelStore((s) => s.weekly);
  const fetchWeekly = useFuelStore((s) => s.fetchWeekly);

  useEffect(() => {
    // Fresh week state for the impact math whenever a new result appears.
    fetchWeekly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const budget = weekly?.flex_budget;
  if (score == null || !budget) return null;

  const target = budget.fuel_target || 80;
  const isRealFood = score >= target;
  const isSnack = ['snack', 'dessert'].includes((mealType || '').toLowerCase());
  const roomRemaining = budget.room_remaining ?? 0;
  const roomTotal = budget.room_total ?? 0;
  const realFood = budget.real_food_meals ?? 0;
  const goal = budget.real_food_goal ?? 0;

  let icon: keyof typeof Ionicons.glyphMap;
  let color: string;
  let headline: string;

  if (isRealFood) {
    icon = 'leaf';
    color = GREEN;
    if (isSnack) {
      headline = logged
        ? 'Clean snack logged — it lifts your weekly average.'
        : 'Clean snack — lifts your weekly average without using room.';
    } else if (logged) {
      headline = `Logged — ${realFood} of ${goal} real-food meal${goal !== 1 ? 's' : ''} this week.`;
    } else if (variant === 'product') {
      headline = 'Real food — eating this strengthens your week.';
    } else {
      headline = `Logging this makes it ${Math.min(realFood + 1, goal)} of ${goal} real-food meal${goal !== 1 ? 's' : ''} this week.`;
    }
  } else if (logged) {
    icon = 'restaurant';
    color = AMBER;
    headline =
      roomRemaining > 0
        ? `Room-for-life meal logged — room for ${roomRemaining} more this week.`
        : 'Room-for-life meal logged. Your next clean meal starts rebuilding.';
  } else if (roomRemaining > 0) {
    icon = 'restaurant';
    color = AMBER;
    headline =
      variant === 'product'
        ? `This would use 1 of your ${roomRemaining} room-for-life meals — your week can absorb it.`
        : `Logging this uses 1 of your ${roomRemaining} room-for-life meals — your week can absorb it.`;
  } else {
    icon = 'information-circle';
    color = theme.textSecondary;
    headline = 'No room left this week — your call. Your next clean meal starts rebuilding.';
  }

  const weekLine =
    goal > 0
      ? `Your week: ${realFood} of ${goal} real food · room ${Math.min(budget.room_used ?? 0, roomTotal)} of ${roomTotal} used`
      : null;

  return (
    <View
      testID="scan-week-impact"
      style={[styles.card, { backgroundColor: color + '10', borderColor: color + '30' }]}
    >
      <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.headline, { color: theme.text }]}>{headline}</Text>
        {weekLine && <Text style={[styles.weekLine, { color: theme.textSecondary }]}>{weekLine}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.sm,
  },
  headline: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  weekLine: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});

export const ScanWeekImpact = React.memo(ScanWeekImpactImpl);
