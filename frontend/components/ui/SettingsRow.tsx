/**
 * SettingsRow — canonical settings/list row (design-system pass 8).
 *
 * Matches the current settings.tsx visuals: 36×36 icon tile (radius md,
 * tinted background), md/600 label, sm tertiary description, chevron
 * trailing. Screens should compose this row instead of copying the
 * settingsRow/settingsIcon style block again.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { useTheme } from '../../hooks/useTheme';

/**
 * Semantic icon-tile tones. fg is the icon color, bg its house tint
 * (fg + '1F' ≈ the rgba(...,0.12) washes settings.tsx uses today).
 * These are theme-invariant hexes that read on both schemes.
 */
export const SETTINGS_ICON_TONES = {
  brand:   { fg: '#22C55E', bg: '#22C55E1F' }, // primary green — core app rows
  info:    { fg: '#3B82F6', bg: '#3B82F61F' }, // notifications, informational
  warn:    { fg: '#F59E0B', bg: '#F59E0B1F' }, // scoring weights, caution rows
  danger:  { fg: '#EF4444', bg: '#EF44441F' }, // destructive / health-critical
  neutral: { fg: '#6B7280', bg: '#6B72801F' }, // misc / low-emphasis rows
  premium: { fg: '#8B5CF6', bg: '#8B5CF61F' }, // metabolic / paid features
} as const;

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconTone?: keyof typeof SETTINGS_ICON_TONES;
  label: string;
  /** Always clamped to two lines — write copy that fits. */
  desc?: string;
  /**
   * 'chevron' (default) = drill-in, 'external' = leaves the app,
   * 'expand' = accordion (pair with `expanded`), 'none', or a custom node
   * (e.g. a Switch).
   */
  trailing?: 'chevron' | 'external' | 'expand' | 'none' | React.ReactNode;
  /** Accordion state when trailing === 'expand'. */
  expanded?: boolean;
  onPress?: () => void;
  /** Renders label + icon in theme.error with an errorMuted tile. */
  danger?: boolean;
  testID?: string;
}

export function SettingsRow({
  icon,
  iconTone = 'brand',
  label,
  desc,
  trailing = 'chevron',
  expanded = false,
  onPress,
  danger = false,
  testID,
}: SettingsRowProps) {
  const theme = useTheme();
  const tone = SETTINGS_ICON_TONES[iconTone];
  const iconFg = danger ? theme.error : tone.fg;
  const iconBg = danger ? theme.errorMuted : tone.bg;

  let trailingNode: React.ReactNode = null;
  if (trailing === 'chevron') {
    trailingNode = (
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    );
  } else if (trailing === 'external') {
    trailingNode = (
      <Ionicons name="open-outline" size={16} color={theme.textTertiary} />
    );
  } else if (trailing === 'expand') {
    trailingNode = (
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={theme.textTertiary}
      />
    );
  } else if (trailing !== 'none') {
    trailingNode = trailing;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={desc ? `${label}. ${desc}` : label}
      accessibilityState={trailing === 'expand' ? { expanded } : undefined}
      testID={testID}
      style={styles.row}
    >
      <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconFg} />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.label, { color: danger ? theme.error : theme.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {desc ? (
          <Text
            style={[styles.desc, { color: theme.textTertiary }]}
            numberOfLines={2}
          >
            {desc}
          </Text>
        ) : null}
      </View>
      {trailingNode}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  desc: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
});
