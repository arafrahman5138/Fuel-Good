/**
 * StatusPill — THE tinted-badge implementation (design-system pass 8).
 *
 * A small pill whose background is the foreground color at the house
 * `color + '14'` tint. Every "colored label on a soft matching wash"
 * badge in the app should be this component — do not hand-roll
 * `backgroundColor: someHex + '20'` pills per screen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';

export interface StatusPillProps {
  label: string;
  /** Foreground color (hex or theme color); bg is derived as color + '14'. */
  color: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  /** Optional override when `label` alone doesn't read well aloud. */
  accessibilityLabel?: string;
  testID?: string;
}

export function StatusPill({
  label,
  color,
  icon,
  size = 'md',
  accessibilityLabel,
  testID,
}: StatusPillProps) {
  const sm = size === 'sm';
  return (
    <View
      style={[
        styles.pill,
        sm ? styles.pillSm : styles.pillMd,
        { backgroundColor: color + '14' },
      ]}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {icon && <Ionicons name={icon} size={sm ? 11 : 13} color={color} />}
      <Text style={[sm ? styles.labelSm : styles.labelMd, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  pillSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  pillMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  labelSm: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  labelMd: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
