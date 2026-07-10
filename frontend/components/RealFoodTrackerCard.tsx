/**
 * RealFoodTrackerCard — Home hero for the 80% Real Food Tracker.
 *
 * Answers, in order: "how is my week going?" and "do I have room for life?"
 * Meal counts are the headline; the weekly Fuel average is secondary.
 * Never shows red or shame framing — day 0 is neutral, room at 0 is
 * "next clean meal rebuilds", not failure. Taps through to the weekly
 * breakdown screen.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

const GREEN = '#22C55E';
const GREEN_SOFT = '#4ADE80';
const AMBER = '#F59E0B';

interface RealFoodTrackerCardProps {
  realFoodMeals: number;
  realFoodGoal: number;
  loggedMeals: number;
  roomTotal: number;
  roomUsed: number;
  roomRemaining: number;
  weeklyAvg: number;
}

function weeklyTierLabel(avg: number): string {
  if (avg >= 90) return 'Elite';
  if (avg >= 75) return 'Strong';
  if (avg >= 60) return 'Decent';
  if (avg >= 40) return 'Mixed';
  return 'Rebuilding';
}

function RealFoodTrackerCardImpl({
  realFoodMeals,
  realFoodGoal,
  loggedMeals,
  roomTotal,
  roomUsed,
  roomRemaining,
  weeklyAvg,
}: RealFoodTrackerCardProps) {
  const theme = useTheme();
  const hasLogs = loggedMeals > 0;
  const goalMet = realFoodMeals >= realFoodGoal && realFoodGoal > 0;

  const headline = hasLogs
    ? `${realFoodMeals} of ${realFoodGoal} real-food meals`
    : 'Your week starts with your first log';

  let roomLine: string;
  if (!hasLogs) {
    roomLine = `Room for ${roomTotal} off-baseline meal${roomTotal !== 1 ? 's' : ''} this week`;
  } else if (goalMet) {
    roomLine = 'Goal met — your baseline is strong';
  } else if (roomRemaining > 0) {
    roomLine = `Room for ${roomRemaining} more off-baseline meal${roomRemaining !== 1 ? 's' : ''}`;
  } else {
    roomLine = 'Room used — your next clean meal rebuilds the week';
  }

  return (
    <TouchableOpacity
      testID="home-real-food-tracker"
      activeOpacity={0.78}
      onPress={() => router.push('/(tabs)/(home)/fuel-weekly' as any)}
      accessibilityRole="button"
      accessibilityLabel={`Real food tracker. ${headline}. ${roomLine}`}
      style={[
        styles.card,
        {
          backgroundColor: theme.card.background,
          borderColor: goalMet ? GREEN + '40' : theme.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.leafIcon, { backgroundColor: GREEN + '14' }]}>
          <Ionicons name="leaf" size={14} color={GREEN} />
        </View>
        <Text style={[styles.kicker, { color: theme.textTertiary }]}>REAL FOOD THIS WEEK</Text>
        {hasLogs && weeklyAvg > 0 && (
          <Text style={[styles.avgChip, { color: theme.textSecondary }]}>
            Fuel {Math.round(weeklyAvg)} · {weeklyTierLabel(weeklyAvg)}
          </Text>
        )}
      </View>

      <Text style={[styles.headline, { color: theme.text }]}>{headline}</Text>

      {/* Segmented progress toward the real-food goal — fills up, never depletes */}
      <View style={styles.segmentRow}>
        {Array.from({ length: Math.max(realFoodGoal, 1) }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.segment,
              {
                backgroundColor:
                  idx < realFoodMeals ? (goalMet ? GREEN : GREEN_SOFT) : theme.surfaceHighlight,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.footerRow}>
        <Ionicons
          name={goalMet ? 'checkmark-circle' : 'restaurant-outline'}
          size={13}
          color={goalMet ? GREEN : roomRemaining > 0 ? AMBER : theme.textTertiary}
        />
        <Text style={[styles.roomLine, { color: theme.textSecondary }]}>{roomLine}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
      </View>

      {/* Room dots: enjoyed vs remaining — informational, never red */}
      {hasLogs && roomTotal > 0 && (
        <View style={styles.roomDots}>
          {Array.from({ length: roomTotal }).map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.roomDot,
                idx < Math.min(roomUsed, roomTotal)
                  ? { backgroundColor: AMBER + '90' }
                  : { backgroundColor: 'transparent', borderWidth: 1, borderColor: AMBER + '60' },
              ]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  leafIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  avgChip: {
    fontSize: 11,
    fontWeight: '600',
  },
  headline: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  roomLine: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  roomDots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 1,
  },
  roomDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export const RealFoodTrackerCard = React.memo(RealFoodTrackerCardImpl);
