import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { Shadows } from '../constants/Shadows';

interface ChronometerSuccessModalProps {
  visible: boolean;
  title?: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

export function ChronometerSuccessModal({
  visible,
  title = 'Logged to Chronometer',
  message,
  primaryLabel = 'View Chronometer',
  secondaryLabel = 'Stay Here',
  onPrimary,
  onSecondary,
}: ChronometerSuccessModalProps) {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onSecondary} />
        <View style={[styles.card, Shadows.overlay(isDark), { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
            <Ionicons name="checkmark" size={18} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onSecondary}
              style={[styles.secondaryBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryText, { color: theme.text }]}>{secondaryLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onPrimary}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.primaryText}>{primaryLabel}</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1.35,
    minHeight: 52,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
