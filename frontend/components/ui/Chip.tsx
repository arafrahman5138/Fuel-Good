/**
 * Chip — the canonical pill-shaped selectable chip (design-system pass 8).
 *
 * Visuals are cloned from ChipSelector's chip (radius full, 1.5px border,
 * selected = primaryMuted bg + primary border) so the two render
 * identically. New filter rows / single selects should compose this
 * primitive instead of restyling their own pills.
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { useTheme } from '../../hooks/useTheme';
import { usePressScale } from '../../hooks/useAnimations';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional leading Ionicons glyph (14px, tinted with the label). */
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** 'caret' = dropdown affordance, 'close' = removable-token affordance. */
  trailing?: 'caret' | 'close';
  /**
   * Visual density only: 'filter' rows pack more chips per line so they use
   * slightly denser padding; 'select' (default) matches ChipSelector.
   */
  tone?: 'filter' | 'select';
  disabled?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  leadingIcon,
  trailing,
  tone = 'select',
  disabled = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const press = usePressScale(0.95);

  const fg = selected ? theme.primary : theme.textSecondary;

  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={0.7}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected, disabled }}
        testID={testID}
        style={[
          styles.chip,
          tone === 'filter' && styles.chipFilter,
          {
            backgroundColor: selected ? theme.primaryMuted : theme.surfaceElevated,
            borderColor: selected ? theme.primary : theme.border,
          },
          selected && {
            boxShadow: `0px 0px 8px ${theme.primary}33`,
            elevation: 2,
          },
          disabled && styles.disabled,
        ]}
      >
        {leadingIcon && (
          <Ionicons
            name={leadingIcon}
            size={14}
            color={fg}
            style={styles.leading}
          />
        )}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
        {trailing && (
          <Ionicons
            name={trailing === 'caret' ? 'chevron-down' : 'close'}
            size={14}
            color={fg}
            style={styles.trailing}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipFilter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  leading: {
    marginRight: 4,
  },
  trailing: {
    marginLeft: 4,
  },
  disabled: {
    opacity: 0.45,
  },
});
