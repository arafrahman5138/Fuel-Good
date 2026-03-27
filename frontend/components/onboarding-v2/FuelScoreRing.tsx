import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  score: number;
  size?: number;
  animated?: boolean;
}

export function FuelScoreRing({ score, size = 90, animated = true }: Props) {
  const animValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  const isGood = score >= 70;
  const color = score >= 85 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444';

  useEffect(() => {
    if (animated) {
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(animValue, { toValue: score / 100, duration: 1800, useNativeDriver: false }),
          Animated.timing(fadeValue, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      animValue.setValue(score / 100);
      fadeValue.setValue(1);
    }
  }, [score, animated]);

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Track */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: '#1F1F1F',
          },
        ]}
      />
      {/* Progress (simplified — uses border approach) */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: score > 25 ? color : 'transparent',
            borderBottomColor: score > 50 ? color : 'transparent',
            borderLeftColor: score > 75 ? color : 'transparent',
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      {/* Score number */}
      <Animated.View style={[styles.scoreContainer, { opacity: fadeValue }]}>
        <Text style={[styles.score, { color, fontSize: size * 0.31 }]}>{score}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  ring: {
    position: 'absolute',
  },
  scoreContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
