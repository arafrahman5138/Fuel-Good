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
  shadow = 'sm',
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

  // iOS cannot render shadows + overflow:hidden on the same View (causes square
  // corner artifacts). Use an outer View for the shadow and an inner
  // LinearGradient with overflow:hidden for the rounded-corner clipping.
  //
  // The shadow wrapper must ONLY receive layout/position styles — applying
  // backgroundColor, borderWidth, or borderColor to it creates a ghost-card
  // artifact where the wrapper's background/border bleeds through at the edges.
  // Visual styles (background, border) stay on the inner gradient only.
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const innerRadius = flatStyle?.borderRadius ?? BorderRadius.xl;

  // Strip visual properties that must not appear on the shadow wrapper
  const {
    backgroundColor: _bg,
    borderColor: _bc,
    borderWidth: _bw,
    borderTopWidth: _btw,
    borderBottomWidth: _bbw,
    borderLeftWidth: _blw,
    borderRightWidth: _brw,
    ...wrapperStyle
  } = flatStyle ?? {};

  const cardView = (
    <View style={[styles.shadowWrapper, shadowStyle, wrapperStyle]}>
      <LinearGradient
        colors={theme.gradient.card as readonly [string, string, ...string[]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.card,
          {
            borderRadius: innerRadius,
            borderColor: theme.card.border,
            borderWidth: 1,
            padding: padding ?? Spacing.lg,
          },
        ]}
      >
        {children}
      </LinearGradient>
    </View>
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
  shadowWrapper: {
    borderRadius: BorderRadius.xl,
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
});
