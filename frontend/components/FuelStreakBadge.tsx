/**
 * FuelStreakBadge — Streak pill with leaf icon + weeks.
 * Similar to MetabolicStreakBadge but tracks consecutive weeks meeting
 * fuel target. Gold tier (8+ weeks) gets a shimmer sweep animation.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { isReduceMotionEnabled } from '../hooks/useAnimations';
import { BorderRadius, Spacing } from '../constants/Colors';

interface FuelStreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  compact?: boolean;
}

export function FuelStreakBadge({
  currentStreak,
  longestStreak,
  compact = false,
}: FuelStreakBadgeProps) {
  const theme = useTheme();
  const shimmerX = useRef(new Animated.Value(-80)).current;
  const isGold = currentStreak >= 8;

  useEffect(() => {
    if (!isGold || compact || isReduceMotionEnabled()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 200,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(shimmerX, {
          toValue: -80,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isGold, compact, shimmerX]);

  const streakColor =
    currentStreak >= 8 ? '#FFD700' :
    currentStreak >= 4 ? '#C0C0C0' :
    currentStreak >= 2 ? '#CD7F32' :
    theme.textTertiary;

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: streakColor + '20' }]}>
        <Ionicons name="leaf" size={12} color={streakColor} />
        <Text style={[styles.compactText, { color: streakColor }]}>{currentStreak}w</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceElevated }]}>
      {isGold && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { overflow: 'hidden', borderRadius: BorderRadius.md },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 60,
              transform: [{ translateX: shimmerX }],
            }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,215,0,0.18)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      )}

      <View style={[styles.iconBg, { backgroundColor: streakColor + '20' }]}>
        <Ionicons name="leaf" size={18} color={streakColor} />
      </View>
      <View>
        <Text style={[styles.streakCount, { color: theme.text }]}>
          {currentStreak} week{currentStreak !== 1 ? 's' : ''}
        </Text>
        <Text style={[styles.streakLabel, { color: theme.textTertiary }]}>
          Fuel Streak
        </Text>
      </View>
      {longestStreak !== undefined && longestStreak > 0 && (
        <View style={styles.bestContainer}>
          <Text style={[styles.bestLabel, { color: theme.textTertiary }]}>Best</Text>
          <Text style={[styles.bestValue, { color: theme.textSecondary }]}>{longestStreak}w</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 11,
  },
  bestContainer: {
    marginLeft: 'auto',
    alignItems: 'center',
  },
  bestLabel: {
    fontSize: 10,
  },
  bestValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
