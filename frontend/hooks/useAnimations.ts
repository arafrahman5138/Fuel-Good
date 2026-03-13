import { useEffect, useRef, useCallback } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

// ---------------------------------------------------------------------------
// Reduce-motion utility
// ---------------------------------------------------------------------------
let _reducedMotion: boolean | null = null;

export async function preloadReduceMotion(): Promise<void> {
  try {
    _reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      _reducedMotion = enabled;
    });
  } catch {
    _reducedMotion = false;
  }
}

export function isReduceMotionEnabled(): boolean {
  return _reducedMotion === true;
}

// ---------------------------------------------------------------------------

/**
 * Fade + slide-up entrance animation.
 * Returns an animated style to spread onto an Animated.View.
 */
export function useEntranceAnimation(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      anim.setValue(1);
      return;
    }
    const timeout = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [anim, delay]);

  const style = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  return { anim, style };
}

/**
 * Toast animation: fade in → hold → fade out.
 * Pass `visible` to trigger. Calls `onDone` when the sequence finishes.
 */
export function useToastAnimation(
  visible: boolean,
  onDone?: () => void,
) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      if (isReduceMotionEnabled()) {
        anim.setValue(1);
        const t = setTimeout(() => {
          anim.setValue(0);
          onDone?.();
        }, 1640);
        return () => clearTimeout(t);
      }
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(anim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => onDone?.());
    }
  }, [visible, anim, onDone]);

  const style = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      },
    ],
  };

  return { anim, style };
}

/**
 * Subtle scale-down on press for tactile feedback.
 * Spread `animatedStyle` on an Animated.View wrapping your touchable content,
 * and pass `onPressIn`/`onPressOut` to the TouchableOpacity.
 */
export function usePressScale(toValue = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, toValue]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  const animatedStyle = { transform: [{ scale }] };

  return { onPressIn, onPressOut, animatedStyle };
}

/**
 * Staggered entrance for list items.
 * Returns an array of animated styles, one per item.
 * Pass a `triggerKey` to re-fire animations when content changes without count changing.
 */
export function useStaggeredEntrance(count: number, staggerMs = 50, triggerKey?: string | number) {
  const anims = useRef<Animated.Value[]>([]);

  // Ensure we have the right number of animated values
  if (anims.current.length !== count) {
    anims.current = Array.from({ length: count }, () => new Animated.Value(0));
  }

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      anims.current.forEach((a) => a.setValue(1));
      return;
    }
    // Reset all to 0 before re-animating
    anims.current.forEach((a) => a.setValue(0));
    const animations = anims.current.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 300,
        delay: i * staggerMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    Animated.parallel(animations).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, staggerMs, triggerKey]);

  const styles = anims.current.map((a) => ({
    opacity: a,
    transform: [
      {
        translateY: a.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  }));

  return styles;
}

/**
 * Spring-based scale reveal when a value becomes "triggered".
 * Great for badge/score reveals and success checkmarks.
 * Returns `animatedStyle` to spread on an Animated.View.
 */
export function useScaleReveal(
  triggered: boolean,
  fromScale = 0.7,
  springConfig: Partial<Parameters<typeof Animated.spring>[1]> = {},
) {
  const scale = useRef(new Animated.Value(triggered ? 1 : fromScale)).current;

  useEffect(() => {
    if (!triggered) return;
    if (isReduceMotionEnabled()) {
      scale.setValue(1);
      return;
    }
    scale.setValue(fromScale);
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.05,
        useNativeDriver: true,
        speed: 30,
        bounciness: 0,
        ...springConfig,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
        bounciness: 10,
        ...springConfig,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered]);

  return { animatedStyle: { transform: [{ scale }] } };
}

/**
 * Infinite scale + opacity pulse loop. Great for live-status indicators.
 * Starts on mount, cleans up on unmount.
 */
export function useInfinitePulse(
  minScale = 1.0,
  maxScale = 1.5,
  duration = 900,
) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration]);

  const animatedStyle = {
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [minScale, maxScale],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.5],
    }),
  };

  return { animatedStyle };
}
