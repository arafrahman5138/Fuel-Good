/**
 * DangerButton — canonical destructive action button (design-system pass 8).
 *
 * Sources theme.error / theme.errorMuted tokens; visuals match the
 * settings.tsx Delete Account button (errorMuted fill, error+'25' hairline,
 * error text). Use for destructive actions only — everything else is Button.
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { useTheme } from '../../hooks/useTheme';

export interface DangerButtonProps {
  label: string;
  onPress: () => void;
  /** Optional leading Ionicons glyph (e.g. 'trash-outline'). */
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  testID?: string;
}

export function DangerButton({
  label,
  onPress,
  icon,
  disabled = false,
  testID,
}: DangerButtonProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[
        styles.btn,
        {
          backgroundColor: theme.errorMuted,
          borderColor: theme.error + '25',
        },
        disabled && styles.disabled,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={theme.error} />}
      <Text style={[styles.label, { color: theme.error }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});
