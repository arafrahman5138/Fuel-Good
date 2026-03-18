/**
 * CollapsibleNutritionRow — Expandable "See nutrition" row.
 * Collapsed: single row with icon + "See nutrition" + chevron.
 * Expanded: calories + 4 macro progress bars.
 * Uses LayoutAnimation for smooth expand/collapse.
 */
import React, { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Macro config ─────────────────────────────────────────────────────────────
const MACROS = [
  { key: 'protein', label: 'Protein', unit: 'g', colors: ['#22C55E', '#16A34A'] as const },
  { key: 'fat', label: 'Fat', unit: 'g', colors: ['#EC4899', '#DB2777'] as const },
  { key: 'fiber', label: 'Fiber', unit: 'g', colors: ['#3B82F6', '#2563EB'] as const },
  { key: 'carbs', label: 'Carbs', unit: 'g', colors: ['#F59E0B', '#D97706'] as const },
];

// ── Props ────────────────────────────────────────────────────────────────────
interface CollapsibleNutritionRowProps {
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  fat: number;
  fatTarget: number;
  fiber: number;
  fiberTarget: number;
  carbs: number;
  carbsTarget: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export function CollapsibleNutritionRow({
  calories,
  calorieTarget,
  protein,
  proteinTarget,
  fat,
  fatTarget,
  fiber,
  fiberTarget,
  carbs,
  carbsTarget,
}: CollapsibleNutritionRowProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const macroValues: Record<string, { consumed: number; target: number }> = {
    protein: { consumed: protein, target: proteinTarget },
    fat: { consumed: fat, target: fatTarget },
    fiber: { consumed: fiber, target: fiberTarget },
    carbs: { consumed: carbs, target: carbsTarget },
  };

  const calPct = calorieTarget > 0 ? Math.min(100, (calories / calorieTarget) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
      {/* Toggle row */}
      <TouchableOpacity activeOpacity={0.72} onPress={toggle} style={styles.toggleRow}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primary + '14' }]}>
          <Ionicons name="nutrition" size={16} color={theme.primary} />
        </View>
        <Text style={[styles.toggleText, { color: theme.textSecondary }]}>See nutrition</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textTertiary}
        />
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Calorie bar */}
          <View style={styles.calorieRow}>
            <Text style={[styles.calorieValue, { color: theme.text }]}>
              {Math.round(calories)}
              <Text style={[styles.calorieDenom, { color: theme.textTertiary }]}>
                {' '}/ {Math.round(calorieTarget)} cal
              </Text>
            </Text>
            <View style={[styles.calTrack, { backgroundColor: theme.surfaceHighlight }]}>
              <LinearGradient
                colors={[theme.primary, theme.primary + '88'] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.calFill, { width: `${calPct}%` }]}
              />
            </View>
          </View>

          {/* Macro grid */}
          <View style={styles.macroGrid}>
            {MACROS.map((macro) => {
              const { consumed, target } = macroValues[macro.key];
              const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
              return (
                <View key={macro.key} style={styles.macroItem}>
                  <View style={styles.macroHeader}>
                    <View style={[styles.macroDot, { backgroundColor: macro.colors[0] }]} />
                    <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>
                      {macro.label}
                    </Text>
                    <Text style={[styles.macroValue, { color: theme.text }]}>
                      {Math.round(consumed)}
                      <Text style={{ color: theme.textTertiary }}>/{Math.round(target)}{macro.unit}</Text>
                    </Text>
                  </View>
                  <View style={[styles.macroTrack, { backgroundColor: theme.surfaceHighlight }]}>
                    <LinearGradient
                      colors={macro.colors as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.macroFill, { width: `${pct}%` }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  expandedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  calorieRow: {
    gap: 5,
  },
  calorieValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calorieDenom: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  calTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  calFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroGrid: {
    gap: Spacing.sm,
  },
  macroItem: {
    gap: 4,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  macroValue: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 3,
  },
});
