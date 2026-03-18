import React from 'react';
import {
  Animated,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { Shadows } from '../constants/Shadows';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { usePressScale } from '../hooks/useAnimations';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const isDisabled = disabled || loading;
  const press = usePressScale();

  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, fontSize: FontSize.sm },
    md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, fontSize: FontSize.md },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl, fontSize: FontSize.lg },
  };

  const currentSize = sizeStyles[size];

  if (variant === 'primary') {
    const glowStyle = !isDisabled ? Shadows.interactive(isDark) : {};
    return (
      <Animated.View style={[press.animatedStyle, fullWidth && styles.fullWidth, style]}>
        <View style={glowStyle}>
          <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
          >
            <LinearGradient
              colors={['#22C55E', '#059669'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.button,
                {
                  paddingVertical: currentSize.paddingVertical,
                  paddingHorizontal: currentSize.paddingHorizontal,
                  borderRadius: size === 'lg' ? BorderRadius.xl : BorderRadius.md,
                  opacity: isDisabled ? 0.4 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  {icon}
                  <Text style={[styles.primaryText, { fontSize: currentSize.fontSize }, textStyle]}>
                    {title}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  const variantStyles: Record<string, { bg: string; border: string; text: string }> = {
    secondary: {
      bg: theme.primaryMuted,
      border: 'transparent',
      text: theme.primary,
    },
    outline: {
      bg: 'transparent',
      border: theme.border,
      text: theme.text,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      text: theme.textSecondary,
    },
  };

  const vs = variantStyles[variant];

  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.7}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.button,
          {
            backgroundColor: vs.bg,
            borderColor: vs.border,
            borderWidth: variant === 'outline' ? 1 : 0,
            paddingVertical: currentSize.paddingVertical,
            paddingHorizontal: currentSize.paddingHorizontal,
            opacity: isDisabled ? 0.4 : 1,
          },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={vs.text} size="small" />
        ) : (
          <>
            {icon}
            <Text style={[styles.buttonText, { color: vs.text, fontSize: currentSize.fontSize }, textStyle]}>
              {title}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
