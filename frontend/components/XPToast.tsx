import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { Shadows } from '../constants/Shadows';

interface XPToastProps {
  message: string | null;
  icon?: string;
  onDismissed?: () => void;
}

export function XPToast({ message, icon = 'flash', onDismissed }: XPToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const anim = useRef(new Animated.Value(0)).current;

  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  useEffect(() => {
    if (!message) return;
    anim.setValue(0);
    const sequence = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    sequence.start(() => {
      onDismissedRef.current?.();
    });
    return () => sequence.stop();
  }, [message, anim]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        Shadows.md(isDark),
        {
          top: Math.max(insets.top, 20) + Spacing.sm,
          backgroundColor: theme.surface,
          borderColor: theme.primary + '30',
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
        <Ionicons name={icon as any} size={16} color={theme.primary} />
      </View>
      <Text style={[styles.text, { color: theme.text }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    zIndex: 999,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
