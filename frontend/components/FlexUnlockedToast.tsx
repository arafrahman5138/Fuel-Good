/**
 * FlexUnlockedToast — Gold-themed celebration toast when a flex event happens.
 * Shows a ticket icon with a message, slides in from top and auto-dismisses.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../stores/themeStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { Shadows } from '../constants/Shadows';

const GOLD = '#F59E0B';
const GOLD_DARK = '#D97706';

interface FlexUnlockedToastProps {
  message: string | null;
  onDismissed?: () => void;
}

export function FlexUnlockedToast({ message, onDismissed }: FlexUnlockedToastProps) {
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const anim = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  useEffect(() => {
    if (!message) return;
    anim.setValue(0);
    shimmer.setValue(0);

    const sequence = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      // Shimmer pulse while visible
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
        { iterations: 2 },
      ),
      Animated.delay(400),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    sequence.start(() => {
      onDismissedRef.current?.();
    });
    return () => sequence.stop();
  }, [message, anim, shimmer]);

  if (!message) return null;

  const bgColor = isDark ? '#1C1917' : '#FFFBEB';
  const textColor = isDark ? '#FDE68A' : '#92400E';

  return (
    <Animated.View
      style={[
        styles.container,
        Shadows.md(isDark),
        {
          top: Math.max(insets.top, 20) + Spacing.sm,
          backgroundColor: bgColor,
          borderColor: GOLD + '40',
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.95, 1.02, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          {
            backgroundColor: GOLD + '20',
            transform: [
              {
                scale: shimmer.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.15],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="ticket" size={18} color={GOLD} />
      </Animated.View>
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
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
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
});
