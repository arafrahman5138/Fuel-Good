import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface Props {
  total: number;
  current: number;
}

export function OnboardingProgress({ total, current }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            i < current && styles.dotCompleted,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#22C55E',
    width: 24,
    borderRadius: 4,
  },
  dotCompleted: {
    backgroundColor: '#22C55E50',
  },
});
