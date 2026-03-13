import React from 'react';
import { Animated, View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Spacing } from '../constants/Colors';
import { Shadows } from '../constants/Shadows';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { usePressScale } from '../hooks/useAnimations';

interface GradientCardProps {
  children: React.ReactNode;
  gradient?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export function GradientCard({ children, gradient, style, padding }: GradientCardProps) {
  const theme = useTheme();
  const colors = gradient || (theme.gradient.surface as readonly [string, string, ...string[]]);

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { padding: padding ?? Spacing.lg }, style as ViewStyle]}
    >
      {children}
    </LinearGradient>
  );
}

export function Card({
  children,
  style,
  padding,
  onPress,
  shadow = 'none',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  onPress?: () => void;
  shadow?: 'none' | 'sm' | 'md';
}) {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const press = usePressScale();

  const shadowStyle = shadow !== 'none' ? Shadows[shadow](isDark) : {};

  const cardView = (
    <LinearGradient
      colors={theme.gradient.card as readonly [string, string, ...string[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[
        styles.card,
        shadowStyle,
        {
          borderColor: theme.card.border,
          borderWidth: 1,
          padding: padding ?? Spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <Animated.View style={press.animatedStyle}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
        >
          {cardView}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return cardView;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
});
