/**
 * LevelUpSheet — full-screen celebration sheet shown when the user's XP
 * crosses into a new level. Addresses the "celebrations are undersized"
 * complaint from the pass-1/2 audits: the sheet is a hero moment with a
 * shimmer gradient, spring-scaled level number, haptic pattern, and an
 * explicit "Continue" CTA.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';

interface Props {
  visible: boolean;
  level: number;
  onDismiss: () => void;
  /** Optional copy shown under the level e.g. "Unlocked: Pro Insights". */
  subtitle?: string;
}

export function LevelUpSheet({ visible, level, onDismiss, subtitle }: Props) {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const starAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.6);
      shimmerAnim.setValue(-1);
      starAnim.setValue(0);
      return;
    }

    // Haptic pattern: success, then medium bump, then medium bump.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 220);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 420);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(starAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(starAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
      { iterations: 4 },
    ).start();
  }, [visible, fadeAnim, scaleAnim, shimmerAnim, starAnim]);

  if (!visible) return null;

  const gradientColors = isDark
    ? (['#04150A', '#0B3B1E', '#155227'] as const)
    : (['#F0FDF4', '#DCFCE7', '#BBF7D0'] as const);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss level up" />
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Shimmer sweep */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmer,
                {
                  transform: [
                    {
                      translateX: shimmerAnim.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-220, 260],
                      }),
                    },
                    { rotate: '20deg' },
                  ],
                },
              ]}
            />

            {/* Animated stars */}
            <Animated.View
              style={[
                styles.starTopLeft,
                {
                  opacity: starAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  transform: [{ scale: starAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
                },
              ]}
            >
              <Ionicons name="sparkles" size={24} color="#FBBF24" />
            </Animated.View>
            <Animated.View
              style={[
                styles.starBottomRight,
                {
                  opacity: starAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
                  transform: [{ scale: starAnim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.8] }) }],
                },
              ]}
            >
              <Ionicons name="sparkles" size={18} color="#FBBF24" />
            </Animated.View>

            <Text style={[styles.kicker, { color: isDark ? '#4ADE80' : '#16A34A' }]}>LEVEL UP</Text>
            <Text style={[styles.level, { color: isDark ? '#fff' : '#052E16' }]}>Lvl {level}</Text>
            {subtitle ? (
              <Text style={[styles.sub, { color: isDark ? '#D1FAE5' : '#166534' }]}>{subtitle}</Text>
            ) : (
              <Text style={[styles.sub, { color: isDark ? '#D1FAE5' : '#166534' }]}>
                Keep fueling — your next reward is already loading.
              </Text>
            )}

            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: pressed ? '#0E7D3A' : '#16A34A' },
              ]}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '86%',
    maxWidth: 360,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: Spacing.xxl + Spacing.sm,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: -40,
    width: 160,
    height: 260,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 40,
  },
  starTopLeft: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
  },
  starBottomRight: {
    position: 'absolute',
    bottom: Spacing.xxl + 10,
    right: Spacing.lg + 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  level: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: Spacing.sm,
  },
  sub: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
    maxWidth: 240,
  },
  cta: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
  },
  ctaText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
