import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { isReduceMotionEnabled } from '../hooks/useAnimations';
import { FontSize } from '../constants/Colors';

const PHASES = [
  'Finding a whole-food match…',
  'Analyzing nutrition profile…',
  'Crafting your healthified version…',
  'Almost ready…',
];

const PHASE_INTERVAL = 3000;
const FADE_DURATION = 280;

interface LoadingPhaseTextProps {
  color?: string;
}

export function LoadingPhaseText({ color = '#9CA3AF' }: LoadingPhaseTextProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      const timer = setInterval(() => {
        setPhaseIndex((prev) => (prev + 1) % PHASES.length);
      }, PHASE_INTERVAL);
      return () => clearInterval(timer);
    }

    const timer = setInterval(() => {
      // Fade out → swap → fade in
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setPhaseIndex((prev) => (prev + 1) % PHASES.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, PHASE_INTERVAL);

    return () => clearInterval(timer);
  }, [opacity]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.text, { color, opacity }]}>
        {PHASES[phaseIndex]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 22,
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSize.md,
    lineHeight: 22,
    includeFontPadding: false,
  },
});
