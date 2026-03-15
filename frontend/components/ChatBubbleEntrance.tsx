import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle } from 'react-native';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  enabled?: boolean;
}

/**
 * Wraps children in a fade + slide-up entrance animation.
 * Only animates once on mount when `enabled` is true.
 */
export function ChatBubbleEntrance({ children, style, enabled = true }: Props) {
  const anim = useRef(new Animated.Value(enabled ? 0 : 1)).current;

  useEffect(() => {
    if (!enabled || isReduceMotionEnabled()) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, enabled]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
