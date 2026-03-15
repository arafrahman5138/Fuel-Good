import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

interface TypingIndicatorProps {
  color?: string;
  iconColor?: string;
}

const DOT_SIZE = 7;
const DOT_GAP = 5;
const BOUNCE_HEIGHT = -6;

export function TypingIndicator({ color = '#22C55E', iconColor = '#22C55E' }: TypingIndicatorProps) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) return;

    const dotAnimations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 160 + 400),
        ]),
      ),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    dotAnimations.forEach((a) => a.start());
    pulseLoop.start();

    return () => {
      dotAnimations.forEach((a) => a.stop());
      pulseLoop.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Ionicons name="sparkles" size={14} color={iconColor} />
      </Animated.View>
      <View style={styles.dotsRow}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: color,
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 1],
                }),
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, BOUNCE_HEIGHT],
                    }),
                  },
                  {
                    scale: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.25],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
