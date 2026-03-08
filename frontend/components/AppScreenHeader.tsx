import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';

interface AppScreenHeaderProps {
  title?: string;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function AppScreenHeader({ title, centerContent, rightContent }: AppScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: 'transparent',
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={24} color={theme.primary} />
      </TouchableOpacity>

      <View style={styles.center}>
        {centerContent || (
          <View style={[styles.titleCapsule, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          </View>
        )}
      </View>

      <View style={styles.right}>{rightContent || <View style={styles.rightPlaceholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    minWidth: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightPlaceholder: {
    width: 42,
    height: 42,
  },
  titleCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
