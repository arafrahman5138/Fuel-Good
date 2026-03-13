/**
 * MetabolicRing — Circular MES display (0-100) with tier coloring.
 * Primary score ring for the Home and Chronometer screens.
 * Score counts up from 0 to the target value on mount/change.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { isReduceMotionEnabled } from '../hooks/useAnimations';
import { getTierConfig, TierKey } from '../stores/metabolicBudgetStore';
import { FontSize, Spacing } from '../constants/Colors';

interface MetabolicRingProps {
  score: number;
  tier: string;
  size?: number;
  showLabel?: boolean;
  showIcon?: boolean;
}

export function MetabolicRing({
  score,
  tier,
  size = 120,
  showLabel = true,
  showIcon = true,
}: MetabolicRingProps) {
  const theme = useTheme();
  const tierCfg = getTierConfig(tier);
  const borderWidth = Math.max(6, size * 0.06);
  const innerSize = size - borderWidth * 2;

  // Count-up animation
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      setDisplayScore(Math.round(score));
      animValue.setValue(score);
      return;
    }

    animValue.setValue(0);
    setDisplayScore(0);

    const listener = animValue.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    Animated.timing(animValue, {
      toValue: score,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // needed for listener-driven state updates
    }).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [score, animValue]);

  // Animated ring opacity
  const ringOpacity = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const ringColor = tierCfg.color;
  const bgRingColor = theme.surfaceHighlight;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background ring */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: bgRingColor,
          },
        ]}
      />
      {/* Colored ring overlay */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: ringColor,
            opacity: ringOpacity,
          },
        ]}
      />
      {/* Center content */}
      <View style={[styles.center, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
        {showIcon && (
          <Ionicons
            name={tierCfg.icon}
            size={Math.max(16, size * 0.15)}
            color={tierCfg.color}
            style={{ marginBottom: 2 }}
          />
        )}
        <Text style={[styles.score, { color: tierCfg.color, fontSize: Math.max(18, size * 0.22) }]}>
          {displayScore}
        </Text>
        {showLabel && (
          <Text style={[styles.label, { color: theme.textSecondary, fontSize: Math.max(9, size * 0.085) }]}>
            MES
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
