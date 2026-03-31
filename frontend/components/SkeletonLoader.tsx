/**
 * SkeletonLoader — Shimmer placeholder for async content.
 * Drop-in replacement for ActivityIndicator in card/list contexts.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { isReduceMotionEnabled } from '../hooks/useAnimations';
import { BorderRadius, Spacing } from '../constants/Colors';

interface SkeletonLineProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonLine({
  width = '100%',
  height = 12,
  borderRadius = 6,
  style,
}: SkeletonLineProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.surfaceHighlight,
        },
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ lines = 3, style }: SkeletonCardProps) {
  const theme = useTheme();
  const shimmerX = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) return;
    const loop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 400,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerX]);

  const lineWidths = ['60%', '100%', '80%', '90%', '70%'];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        style,
      ]}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={lineWidths[i % lineWidths.length]}
          height={i === 0 ? 16 : 12}
          style={i > 0 ? { marginTop: Spacing.sm } : undefined}
        />
      ))}

      {/* Shimmer sweep */}
      <Animated.View
        pointerEvents="none"
        style={[styles.shimmer, { transform: [{ translateX: shimmerX }] }]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export { SkeletonLine };

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
});
