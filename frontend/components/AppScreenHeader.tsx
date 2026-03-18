import React from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { useInfinitePulse } from '../hooks/useAnimations';

interface AppScreenHeaderProps {
  title?: string;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function AppScreenHeader({ title, centerContent, rightContent }: AppScreenHeaderProps) {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const insets = useSafeAreaInsets();
  const { animatedStyle: dotStyle } = useInfinitePulse(1.0, 1.6, 900);

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: 'transparent',
          paddingTop: Math.max(insets.top, Spacing.md),
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={24} color={theme.primary} style={{ transform: [{ translateX: -1 }] }} />
      </TouchableOpacity>

      <View style={styles.center}>
        {centerContent || (
          <View style={[styles.titleCapsule, { borderColor: theme.border, overflow: 'hidden' }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 40 : 80}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? 'rgba(20,20,26,0.72)' : 'rgba(255,255,255,0.82)' },
              ]}
            />
            <Animated.View
              style={[styles.dot, { backgroundColor: theme.primary }, dotStyle]}
            />
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
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
    borderRadius: BorderRadius.xl,
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
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    minHeight: 44,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
