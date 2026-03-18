/**
 * MacroRing — Tiny circular progress ring for macro tracking.
 * Uses react-native-svg with state-driven strokeDashoffset for reliable rendering.
 * Animates from 0 → progress on mount.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

interface MacroRingProps {
  /** Progress 0–1 */
  progress: number;
  /** Ring diameter */
  size: number;
  /** Active arc color */
  color: string;
  /** Background track color */
  trackColor: string;
  /** Stroke width — defaults to size * 0.12 */
  strokeWidth?: number;
}

export function MacroRing({
  progress,
  size,
  color,
  trackColor,
  strokeWidth: strokeWidthProp,
}: MacroRingProps) {
  const sw = strokeWidthProp ?? Math.max(3, Math.round(size * 0.12));
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const radius = (size - sw) / 2;
  const circumference = 2 * Math.PI * radius;

  const animValue = useRef(new Animated.Value(0)).current;
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      setCurrentProgress(clampedProgress);
      animValue.setValue(clampedProgress);
      return;
    }

    animValue.setValue(0);
    setCurrentProgress(0);

    const listener = animValue.addListener(({ value }) => {
      setCurrentProgress(value);
    });

    Animated.timing(animValue, {
      toValue: clampedProgress,
      duration: 700,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [clampedProgress]);

  const dashOffset = circumference * (1 - currentProgress);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={sw}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
    </View>
  );
}
