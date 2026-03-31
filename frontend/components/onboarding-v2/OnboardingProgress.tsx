import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface Props {
  total: number;
  current: number;
}

export function OnboardingProgress({ total, current }: Props) {
  const fillWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillWidth, {
      toValue: total > 0 ? (current + 1) / total : 0,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: fillWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.stepText}>
        {current + 1}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#252525',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 30,
    textAlign: 'right',
  },
});
