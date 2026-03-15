import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

interface Props {
  children: React.ReactNode;
  delay?: number;
}

/**
 * Spring-bounce scale reveal for MES badge pills.
 */
export function MesBadgePopIn({ children, delay = 0 }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 28,
          bounciness: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [scale, opacity, delay]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      {children}
    </Animated.View>
  );
}
