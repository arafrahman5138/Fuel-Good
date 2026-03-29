import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { isReduceMotionEnabled } from '../hooks/useAnimations';
import { FontSize } from '../constants/Colors';

const DEFAULT_PHASES = [
  'Finding a whole-food match…',
  'Analyzing nutrition profile…',
  'Crafting your healthified version…',
  'Almost ready…',
];

export const SCORE_PHASES = [
  'Analyzing your fuel score…',
  'Reviewing today\'s meals…',
  'Preparing your breakdown…',
  'Almost ready…',
];

export const GENERAL_PHASES = [
  'Thinking…',
  'Looking up nutrition info…',
  'Preparing answer…',
  'Almost ready…',
];

const PHASE_INTERVAL = 3000;
const FADE_DURATION = 280;

interface LoadingPhaseTextProps {
  color?: string;
  phases?: string[];
}

export function LoadingPhaseText({ color = '#9CA3AF', phases }: LoadingPhaseTextProps) {
  const activePhases = phases || DEFAULT_PHASES;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      const timer = setInterval(() => {
        setPhaseIndex((prev) => (prev + 1) % activePhases.length);
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
        setPhaseIndex((prev) => (prev + 1) % activePhases.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, PHASE_INTERVAL);

    return () => clearInterval(timer);
  }, [opacity, activePhases]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.text, { color, opacity }]}>
        {activePhases[phaseIndex]}
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
