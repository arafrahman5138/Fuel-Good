/**
 * FuelScoreBadge — Inline pill badge showing a meal's Fuel Score.
 * Used in meal log rows to indicate whole-food quality.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../constants/Colors';

function getTierFromScore(score: number) {
  if (score >= 90) return { color: '#22C55E', icon: 'leaf' as const };
  if (score >= 75) return { color: '#4ADE80', icon: 'leaf' as const };
  if (score >= 60) return { color: '#F59E0B', icon: 'cafe' as const };
  if (score >= 40) return { color: '#FB923C', icon: 'fast-food' as const };
  return { color: '#EF4444', icon: 'fast-food' as const };
}

const FLEX_GOLD = '#F59E0B';

interface FuelScoreBadgeProps {
  score: number;
  compact?: boolean;
  /** If provided, scores below this threshold show a golden "FLEX" tag */
  fuelTarget?: number;
}

export function FuelScoreBadge({ score, compact = false, fuelTarget }: FuelScoreBadgeProps) {
  const tier = getTierFromScore(score);
  const isFlex = fuelTarget != null && score < fuelTarget;

  if (isFlex) {
    return (
      <View style={[styles.flexContainer]}>
        <Ionicons name="ticket" size={10} color={FLEX_GOLD} />
        <Text style={styles.flexText}>FLEX</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: tier.color + '18' }]}>
        <Ionicons name="leaf" size={8} color={tier.color} />
        <Text style={[styles.compactText, { color: tier.color }]}>{Math.round(score)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: tier.color + '15' }]}>
      <Ionicons name={tier.icon} size={12} color={tier.color} />
      <Text style={[styles.text, { color: tier.color }]}>Fuel {Math.round(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    gap: 2,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
  },
  flexContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLEX_GOLD + '18',
    borderColor: FLEX_GOLD + '40',
    borderWidth: 1,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  flexText: {
    fontSize: 9,
    fontWeight: '800',
    color: FLEX_GOLD,
    letterSpacing: 0.5,
  },
});
