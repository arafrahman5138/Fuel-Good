/**
 * FuelTargetPicker — Settings component for choosing fuel target + expected meals/week.
 * Used in profile/settings screens.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

const TARGET_PRESETS = [
  { value: 70, label: 'Flexible', desc: '70+ avg — more room for eating out' },
  { value: 80, label: 'Balanced', desc: '80+ avg — recommended for most' },
  { value: 90, label: 'Strict', desc: '90+ avg — mostly whole foods' },
];

const MEAL_PRESETS = [14, 18, 21, 24, 28];

interface FuelTargetPickerProps {
  currentTarget: number;
  currentMealsPerWeek: number;
  onSave: (target: number, mealsPerWeek: number) => void;
}

export function FuelTargetPicker({
  currentTarget,
  currentMealsPerWeek,
  onSave,
}: FuelTargetPickerProps) {
  const theme = useTheme();
  const [target, setTarget] = useState(currentTarget);
  const [mealsPerWeek, setMealsPerWeek] = useState(currentMealsPerWeek);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Fuel Target */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Fuel Target</Text>
      <Text style={[styles.sectionDesc, { color: theme.textTertiary }]}>
        Your weekly average Fuel Score goal
      </Text>
      <View style={styles.presets}>
        {TARGET_PRESETS.map((p) => {
          const active = target === p.value;
          return (
            <TouchableOpacity
              key={p.value}
              activeOpacity={0.8}
              onPress={() => setTarget(p.value)}
              style={[
                styles.presetCard,
                { backgroundColor: active ? theme.primary + '15' : theme.surfaceElevated, borderColor: active ? theme.primary + '40' : theme.border },
              ]}
            >
              <View style={styles.presetHeader}>
                <Text style={[styles.presetValue, { color: active ? theme.primary : theme.text }]}>{p.value}</Text>
                <Text style={[styles.presetLabel, { color: active ? theme.primary : theme.textSecondary }]}>{p.label}</Text>
              </View>
              <Text style={[styles.presetDesc, { color: theme.textTertiary }]}>{p.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Meals Per Week */}
      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>Meals Per Week</Text>
      <Text style={[styles.sectionDesc, { color: theme.textTertiary }]}>
        How many meals do you typically eat per week?
      </Text>
      <View style={styles.mealChips}>
        {MEAL_PRESETS.map((m) => {
          const active = mealsPerWeek === m;
          return (
            <TouchableOpacity
              key={m}
              activeOpacity={0.8}
              onPress={() => setMealsPerWeek(m)}
              style={[
                styles.chip,
                { backgroundColor: active ? theme.primary + '15' : theme.surfaceElevated, borderColor: active ? theme.primary + '40' : theme.border },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Save */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onSave(target, mealsPerWeek)}
        style={[styles.saveBtn, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="checkmark" size={18} color="#fff" />
        <Text style={styles.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  presets: {
    gap: Spacing.sm,
  },
  presetCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm + 2,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  presetValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  presetLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  presetDesc: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  mealChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
