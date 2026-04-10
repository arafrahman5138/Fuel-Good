/**
 * FuelSettingsSheet — Bottom-sheet modal for configuring fuel ratio and meals/week.
 * Presets: Strict 90/10, Balanced 80/20, Flexible 70/30.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useFuelStore } from '../stores/fuelStore';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

interface FuelSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const RATIO_PRESETS = [
  {
    target: 90,
    label: 'Strict',
    ratio: '90 / 10',
    description: 'Mostly whole foods — minimal flex',
    icon: 'shield-checkmark' as const,
    color: '#22C55E',
  },
  {
    target: 80,
    label: 'Balanced',
    ratio: '80 / 20',
    description: 'Great balance — a few flex meals/week',
    icon: 'leaf' as const,
    color: '#4ADE80',
  },
  {
    target: 70,
    label: 'Flexible',
    ratio: '70 / 30',
    description: 'More freedom — more flex meals/week',
    icon: 'happy' as const,
    color: '#F59E0B',
  },
];

const MEALS_OPTIONS = [
  { value: 14, label: '2/day', sub: '14/week' },
  { value: 21, label: '3/day', sub: '21/week' },
  { value: 28, label: '4/day', sub: '28/week' },
];

function estimateFlexMeals(target: number, mealsPerWeek: number): number {
  // Match backend: flex = expectedMeals - ceil(expectedMeals * cleanPct / 100)
  const cleanMealsTarget = Math.ceil(mealsPerWeek * target / 100);
  return Math.max(0, mealsPerWeek - cleanMealsTarget);
}

export function FuelSettingsSheet({ visible, onClose }: FuelSettingsSheetProps) {
  const theme = useTheme();
  const { settings, updateSettings } = useFuelStore();

  const [selectedTarget, setSelectedTarget] = useState(settings?.fuel_target ?? 80);
  const [selectedMeals, setSelectedMeals] = useState(settings?.expected_meals_per_week ?? 21);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && settings) {
      setSelectedTarget(settings.fuel_target);
      setSelectedMeals(settings.expected_meals_per_week);
    }
  }, [visible, settings]);

  const estimatedFlex = estimateFlexMeals(selectedTarget, selectedMeals);
  const hasChanges =
    selectedTarget !== (settings?.fuel_target ?? 80) ||
    selectedMeals !== (settings?.expected_meals_per_week ?? 21);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await updateSettings(selectedTarget, selectedMeals);
    setSaving(false);
    onClose();
  }, [selectedTarget, selectedMeals, updateSettings, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.sheet, { backgroundColor: theme.card.background }]}>
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: theme.border }]} />

            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.text }]}>Fuel Settings</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Choose how strictly you want to eat
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <View style={[styles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}>
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Ratio presets */}
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>
              HEALTHY EATING RATIO
            </Text>
            <View style={styles.presetsRow}>
              {RATIO_PRESETS.map((preset) => {
                const isActive = selectedTarget === preset.target;
                return (
                  <TouchableOpacity
                    key={preset.target}
                    activeOpacity={0.7}
                    onPress={() => setSelectedTarget(preset.target)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isActive ? preset.color + '14' : theme.surfaceHighlight + '80',
                        borderColor: isActive ? preset.color : theme.border,
                        borderWidth: isActive ? 1.5 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.presetIconWrap, { backgroundColor: preset.color + '20' }]}>
                      <Ionicons name={preset.icon} size={18} color={preset.color} />
                    </View>
                    <Text style={[styles.presetLabel, { color: isActive ? preset.color : theme.text }]}>
                      {preset.label}
                    </Text>
                    <Text style={[styles.presetRatio, { color: isActive ? preset.color : theme.textSecondary }]}>
                      {preset.ratio}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.presetDescription, { color: theme.textSecondary }]}>
              {RATIO_PRESETS.find((p) => p.target === selectedTarget)?.description}
            </Text>

            {/* Meals per week */}
            <Text style={[styles.sectionLabel, { color: theme.textTertiary, marginTop: Spacing.lg }]}>
              MEALS PER DAY
            </Text>
            <View style={styles.mealsRow}>
              {MEALS_OPTIONS.map((opt) => {
                const isActive = selectedMeals === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.7}
                    onPress={() => setSelectedMeals(opt.value)}
                    style={[
                      styles.mealsChip,
                      {
                        backgroundColor: isActive ? theme.primary + '14' : theme.surfaceHighlight + '80',
                        borderColor: isActive ? theme.primary : theme.border,
                        borderWidth: isActive ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.mealsLabel, { color: isActive ? theme.primary : theme.text }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.mealsSub, { color: isActive ? theme.primary : theme.textTertiary }]}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Live preview */}
            <View style={[styles.previewCard, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '30' }]}>
              <Ionicons name="sparkles" size={18} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={[styles.previewTitle, { color: theme.text }]}>
                  ~{estimatedFlex} flex meals per week
                </Text>
                <Text style={[styles.previewBody, { color: theme.textSecondary }]}>
                  Earn cheat meals by eating clean — your body rewards consistency
                </Text>
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving || !hasChanges}
              style={{ marginTop: Spacing.md }}
            >
              <LinearGradient
                colors={
                  hasChanges
                    ? (['#22C55E', '#16A34A'] as any)
                    : ([theme.surfaceHighlight, theme.surfaceHighlight] as any)
                }
                style={styles.saveBtn}
              >
                <Text style={[styles.saveBtnText, { color: hasChanges ? '#fff' : theme.textTertiary }]}>
                  {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    paddingTop: Spacing.sm,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  presetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  presetLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  presetRatio: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  presetDescription: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  mealsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  mealsChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    gap: 2,
  },
  mealsLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  mealsSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  previewTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  previewBody: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  saveBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
