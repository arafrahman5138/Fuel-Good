/**
 * FuelScoreRing — Circular Fuel Score display (0-100) with tier coloring.
 * Shows how "whole food" a meal or day is.
 * Tap the ring to toggle between FUEL score and MES score.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

const FUEL_TIERS = [
  { min: 90, label: 'Elite', color: '#22C55E', icon: 'leaf' as const },
  { min: 75, label: 'Strong', color: '#4ADE80', icon: 'leaf' as const },
  { min: 60, label: 'Decent', color: '#F59E0B', icon: 'cafe' as const },
  { min: 40, label: 'Mixed', color: '#FB923C', icon: 'fast-food' as const },
  { min: 0, label: 'Flex', color: '#EF4444', icon: 'fast-food' as const },
];

function getTierConfig(score: number) {
  return FUEL_TIERS.find((t) => score >= t.min) ?? FUEL_TIERS[FUEL_TIERS.length - 1];
}

interface FuelScoreRingProps {
  score: number;
  size?: number;
  showLabel?: boolean;
  showIcon?: boolean;
  /** Color of the background track ring. Defaults to theme.surfaceHighlight. */
  trackColor?: string;
  /** MES score to show when toggled. If omitted, tapping does nothing. */
  mesScore?: number;
  /** Ring color for MES tier. Defaults to fuel tier color. */
  mesTierColor?: string;
  /** Controlled: whether to show MES. If provided, component is controlled. */
  showMes?: boolean;
  /** Controlled: called when user taps to toggle. */
  onToggle?: () => void;
  /**
   * Pass-5 F4: Color used when score === 0 (empty state). The default red
   * "Flex Day" tier was confusing on first launch — it signaled "danger" while
   * the supporting copy ("Your day is a blank slate") signaled "opportunity".
   * Callers that have a true empty state should pass a neutral/cool color here.
   * Defaults to a slate grey so any caller forgetting to pass it stops bleeding red.
   */
  emptyStateColor?: string;
}

export function FuelScoreRing({
  score,
  size = 120,
  showLabel = true,
  showIcon = true,
  trackColor,
  mesScore,
  mesTierColor,
  showMes: showMesProp,
  onToggle,
  emptyStateColor = '#94A3B8', // slate — neutral cool for empty state
}: FuelScoreRingProps) {
  const theme = useTheme();
  const tierCfg = getTierConfig(score);
  const borderWidth = Math.max(6, size * 0.065);
  const innerSize = size - borderWidth * 2;

  const isControlled = showMesProp !== undefined;
  const [showMesInternal, setShowMesInternal] = useState(false);
  const showMes = isControlled ? showMesProp! : showMesInternal;
  const canToggle = mesScore !== undefined;

  // Ring entrance animation
  const animValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.78)).current;
  const [displayScore, setDisplayScore] = useState(0);

  // Toggle animation: scale center content in/out
  const toggleScale = useRef(new Animated.Value(1)).current;
  const toggleOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReduceMotionEnabled()) {
      setDisplayScore(Math.round(score));
      animValue.setValue(score);
      scaleAnim.setValue(1);
      return;
    }

    animValue.setValue(0);
    scaleAnim.setValue(0.78);
    setDisplayScore(0);

    const listener = animValue.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    Animated.parallel([
      Animated.timing(animValue, {
        toValue: score,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [score]);

  const ringOpacity = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [0.3, 1],
    extrapolate: 'clamp',
  });

  const resolvedTrack = trackColor ?? theme.surfaceHighlight;

  // Active ring color: fuel color or MES color when toggled.
  // Pass-5 F4: when no data has been logged (score === 0 and not toggled to MES),
  // use the neutral empty-state color instead of the red "Flex Day" tier.
  const activeRingColor = showMes && mesTierColor
    ? mesTierColor
    : (!showMes && score === 0)
      ? emptyStateColor
      : tierCfg.color;

  const handleToggle = () => {
    if (!canToggle) return;

    // Pass-6 Gap G2 + Pass-7 RM accessibility fix: ring tap-to-toggle had zero haptic
    // feedback, so users with Reduce Motion enabled (which disables the visible
    // shrink/expand animation) got no feedback at all that the tap registered.
    // selectionAsync is the correct semantic for picker-like toggle gestures
    // (Fuel ↔ MES is a state pick) and fires regardless of RM setting.
    Haptics.selectionAsync();

    // Quick shrink then expand to signal the swap
    Animated.sequence([
      Animated.parallel([
        Animated.timing(toggleScale, { toValue: 0.78, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(toggleOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(toggleScale, { toValue: 1, tension: 180, friction: 10, useNativeDriver: true }),
        Animated.timing(toggleOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();

    if (isControlled) {
      onToggle?.();
    } else {
      setShowMesInternal((prev) => !prev);
    }
  };

  const resolvedScore = showMes ? (mesScore ?? 0) : displayScore;
  const scoreLabel = showMes ? 'MES' : 'FUEL';
  const iconName = showMes ? ('pulse-outline' as const) : tierCfg.icon;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ scale: scaleAnim }],
          // Soft glow shadow using the tier color
          boxShadow: `0px 0px ${size * 0.18}px ${activeRingColor}59`,
          elevation: 6,
        },
      ]}
    >
      {/* Background track ring */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: resolvedTrack,
          },
        ]}
      />

      {/* Animated colored ring overlay */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: activeRingColor,
            opacity: ringOpacity,
          },
        ]}
      />

      {/* Center content — tappable for FUEL/MES toggle */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={canToggle ? 0.7 : 1}
        style={[
          styles.center,
          { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
        ]}
      >
        <Animated.View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: toggleScale }],
            opacity: toggleOpacity,
          }}
        >
          {showIcon && (
            <Ionicons
              name={iconName}
              size={Math.max(14, size * 0.14)}
              color={activeRingColor}
              style={{ marginBottom: 1 }}
            />
          )}
          <Text
            style={[
              styles.score,
              { color: activeRingColor, fontSize: Math.max(18, size * 0.22) },
            ]}
          >
            {resolvedScore}
          </Text>
          {showLabel && (
            <Text
              style={[
                styles.label,
                {
                  color: theme.textSecondary,
                  fontSize: Math.max(11, size * 0.1),
                },
              ]}
            >
              {scoreLabel}
            </Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  ring: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
