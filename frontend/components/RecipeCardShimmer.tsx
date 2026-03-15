import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

interface Props {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * Single-pass shimmer sweep overlay. Runs once on mount then stays invisible.
 */
export function RecipeCardShimmer({ children, enabled = true }: Props) {
  const shimmerX = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!enabled || isReduceMotionEnabled()) return;
    const timeout = setTimeout(() => {
      Animated.timing(shimmerX, {
        toValue: 400,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 300); // slight delay so card is visible first
    return () => clearTimeout(timeout);
  }, [shimmerX, enabled]);

  return (
    <View style={styles.wrapper}>
      {children}
      {enabled && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmerStrip,
            { transform: [{ translateX: shimmerX }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(34, 197, 94, 0.10)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  shimmerStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
  },
});
