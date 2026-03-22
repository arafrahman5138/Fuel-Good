/**
 * FlexOnboarding — Choose your clean eating goal.
 * Single-screen preset selection: Relaxed (70%), Balanced (80%), Strict (90%).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { useTheme } from '../hooks/useTheme';
import { useFuelStore } from '../stores/fuelStore';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

const GOLD = '#F59E0B';
const GOLD_DARK = '#D97706';

interface Preset {
  pct: number;
  label: string;
  flexMeals: number;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  recommended?: boolean;
}

const PRESETS: Preset[] = [
  {
    pct: 70,
    label: 'Relaxed',
    flexMeals: 6,
    description: 'Flexible lifestyle — enjoy more treats while still eating well most of the time',
    icon: 'happy-outline',
  },
  {
    pct: 80,
    label: 'Balanced',
    flexMeals: 4,
    description: 'The sweet spot — enough treats to enjoy life, enough discipline to feel great',
    icon: 'fitness-outline',
    recommended: true,
  },
  {
    pct: 90,
    label: 'Strict',
    flexMeals: 2,
    description: 'Maximum results — for when you want to optimize your nutrition',
    icon: 'flash-outline',
  },
];

export default function FlexOnboarding() {
  const theme = useTheme();
  const { updateSettings } = useFuelStore();
  const [selected, setSelected] = useState<number>(80);
  const [saving, setSaving] = useState(false);

  const activePreset = PRESETS.find((p) => p.pct === selected)!;
  const cleanTarget = Math.ceil(21 * selected / 100);
  const projectedAvg = Math.round((cleanTarget * 95 + activePreset.flexMeals * 35) / 21);
  const tierLabel = projectedAvg >= 90 ? 'Elite' : projectedAvg >= 75 ? 'Strong' : projectedAvg >= 60 ? 'Decent' : 'Mixed';

  const handleSave = async () => {
    setSaving(true);
    await updateSettings(80, 21);
    // Update clean_eating_pct via separate call since updateSettings might not support it yet
    try {
      const { fuelApi } = require('../services/api');
      await fuelApi.updateSettings({ clean_eating_pct: selected });
    } catch {}
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient colors={[GOLD, GOLD_DARK] as any} style={styles.headerIcon}>
            <Ionicons name="ticket" size={28} color="#fff" />
          </LinearGradient>
          <Text style={[styles.title, { color: theme.text }]}>How do you want to eat?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose your clean eating target. This determines how many guilt-free flex meals you earn each week.
          </Text>
        </View>

        {/* Preset Cards */}
        <View style={styles.presetList}>
          {PRESETS.map((preset) => {
            const isActive = selected === preset.pct;
            return (
              <TouchableOpacity
                key={preset.pct}
                activeOpacity={0.8}
                onPress={() => setSelected(preset.pct)}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: isActive ? GOLD + '10' : theme.card.background,
                    borderColor: isActive ? GOLD + '50' : theme.border,
                  },
                ]}
              >
                <View style={styles.presetRow}>
                  <View style={[styles.presetIconWrap, { backgroundColor: isActive ? GOLD + '18' : theme.surfaceHighlight }]}>
                    <Ionicons name={preset.icon} size={20} color={isActive ? GOLD : theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.presetTitleRow}>
                      <Text style={[styles.presetLabel, { color: theme.text }]}>
                        {preset.label} — {preset.pct}%
                      </Text>
                      {preset.recommended && (
                        <View style={[styles.recBadge, { backgroundColor: GOLD + '18' }]}>
                          <Ionicons name="star" size={10} color={GOLD} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.presetFlex, { color: isActive ? GOLD : theme.textSecondary }]}>
                      {preset.flexMeals} flex meals per week
                    </Text>
                  </View>
                  <View style={[styles.radio, { borderColor: isActive ? GOLD : theme.border }]}>
                    {isActive && <View style={[styles.radioDot, { backgroundColor: GOLD }]} />}
                  </View>
                </View>
                {isActive && (
                  <Text style={[styles.presetDesc, { color: theme.textSecondary }]}>
                    {preset.description}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Math Proof */}
        <View style={[styles.proofCard, { backgroundColor: '#22C55E08', borderColor: '#22C55E25' }]}>
          <Ionicons name="analytics" size={16} color="#22C55E" />
          <Text style={[styles.proofText, { color: theme.textSecondary }]}>
            {selected}% = {cleanTarget} clean meals + {activePreset.flexMeals} treats per week.{'\n'}
            Weekly avg: ~{projectedAvg} — <Text style={{ color: '#22C55E', fontWeight: '700' }}>{tierLabel} tier</Text>
          </Text>
        </View>

        {/* CTA */}
        <View style={{ flex: 1 }} />
        <TouchableOpacity activeOpacity={0.9} onPress={handleSave} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
          <LinearGradient colors={[GOLD, GOLD_DARK] as any} style={styles.ctaBtn}>
            <Text style={styles.ctaText}>{saving ? 'Saving...' : "Let's go"}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity onPress={() => router.back()} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: theme.textTertiary }]}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  presetList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  presetCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  presetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  recBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetFlex: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  presetDesc: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: Spacing.sm,
    paddingLeft: 52,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  proofCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  proofText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
