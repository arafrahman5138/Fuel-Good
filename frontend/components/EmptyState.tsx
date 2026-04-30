/**
 * EmptyState — shared empty / loading-timeout / error state used across
 * Browse, Food Database, Grocery, Saved Recipes, Achievements, Track.
 *
 * Variants:
 *   - default : neutral empty state with icon + title + subtitle + optional CTA
 *   - loading : pulsing skeleton for indeterminate loads (use `Skeleton` children instead of this variant for card grids)
 *   - error   : same layout but with an alert accent — reserved for *actual* errors (not empty states)
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface EmptyStateProps {
  /** Visual hint icon, defaults to sparkles-outline. */
  icon?: IoniconName;
  /** Headline — e.g. "No saved recipes yet". */
  title: string;
  /** Supporting copy — e.g. "Browse meals and tap bookmark to save". */
  subtitle?: string;
  /** Primary action label. */
  action?: string;
  /** Primary action handler. */
  onAction?: () => void;
  /** Optional secondary action. */
  secondaryAction?: string;
  onSecondaryAction?: () => void;
  /** Visual variant. */
  variant?: 'default' | 'error';
  /** Extra padding around the content. Defaults to Spacing.xl. */
  padding?: number;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
  variant = 'default',
  padding,
}: EmptyStateProps) {
  const theme = useTheme();
  const accentColor = variant === 'error' ? theme.error : theme.primary;
  const resolvedIcon: IoniconName =
    icon ?? (variant === 'error' ? 'alert-circle-outline' : 'sparkles-outline');

  return (
    <View style={[styles.container, { padding: padding ?? Spacing.xl }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: accentColor + '12' },
        ]}
      >
        <Ionicons name={resolvedIcon} size={30} color={accentColor} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {action && onAction ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={[styles.actionBtn, { backgroundColor: accentColor }]}
        >
          <Text style={styles.actionText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
      {secondaryAction && onSecondaryAction ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSecondaryAction}
          accessibilityRole="button"
          accessibilityLabel={secondaryAction}
          style={styles.secondaryBtn}
        >
          <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>
            {secondaryAction}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Skeleton — single rectangular placeholder block. Compose several of these
 * to simulate a loading recipe grid / list.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: any;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: theme.surfaceHighlight,
          borderRadius: radius,
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  actionBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  actionText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
