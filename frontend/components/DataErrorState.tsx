/**
 * DataErrorState — Inline error state for data-fetching screens.
 *
 * Shows a warning icon, a short explanatory message, and a Retry button.
 * Used when a screen's primary fetch fails on cold start, so users see
 * actionable feedback instead of a blank white screen.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

interface DataErrorStateProps {
  /** What couldn't be loaded, e.g. "dashboard", "meal plan". */
  thing?: string;
  /** Full override for the message body. */
  message?: string;
  /** Called when the user taps retry; should re-trigger the fetch. */
  onRetry: () => void | Promise<void>;
  /** Extra wrapper style (e.g. margins, padding). */
  style?: ViewStyle;
  /** Compact padded variant for inline placement inside a scroll view. */
  compact?: boolean;
}

export function DataErrorState({
  thing = 'data',
  message,
  onRetry,
  style,
  compact = false,
}: DataErrorStateProps) {
  const theme = useTheme();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const body =
    message ??
    `Couldn't load your ${thing}. Check your connection and try again.`;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        compact ? styles.compact : styles.full,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.error + '18' },
        ]}
      >
        <Ionicons name="warning-outline" size={26} color={theme.error} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        {body}
      </Text>
      <TouchableOpacity
        onPress={handleRetry}
        activeOpacity={0.8}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel={`Retry loading ${thing}`}
        style={[
          styles.retryBtn,
          {
            backgroundColor: theme.error,
            opacity: retrying ? 0.7 : 1,
          },
        ]}
      >
        {retrying ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  full: {
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  compact: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 300,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    minWidth: 120,
    minHeight: 40,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
