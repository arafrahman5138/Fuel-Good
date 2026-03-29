import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';
import { isReduceMotionEnabled } from '../hooks/useAnimations';

export type ProfileSegment = 'overview' | 'achievements';

interface Props {
  active: ProfileSegment;
  onChange: (segment: ProfileSegment) => void;
}

const SEGMENTS: { key: ProfileSegment; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'achievements', label: 'Achievements' },
];

export function ProfileSegmentedControl({ active, onChange }: Props) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(active === 'overview' ? 0 : 1)).current;

  useEffect(() => {
    const toValue = active === 'overview' ? 0 : 1;
    if (isReduceMotionEnabled()) {
      slideAnim.setValue(toValue);
    } else {
      Animated.timing(slideAnim, {
        toValue,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [active, slideAnim]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceElevated }]}>
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: theme.primary,
            left: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['2%', '50%'],
            }),
          },
        ]}
      />
      {SEGMENTS.map((seg) => (
        <TouchableOpacity
          key={seg.key}
          activeOpacity={0.7}
          onPress={() => onChange(seg.key)}
          style={styles.segment}
        >
          <Text
            style={[
              styles.label,
              { color: active === seg.key ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {seg.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '48%',
    borderRadius: BorderRadius.sm + 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    zIndex: 1,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
