export const Colors = {
  dark: {
    background: '#0A0A0F',
    surface: '#141419',
    surfaceElevated: '#1C1C24',
    surfaceHighlight: '#24242E',
    border: '#2A2A35',
    borderLight: '#35354A',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
    primary: '#22C55E',
    primaryLight: '#4ADE80',
    primaryDark: '#16A34A',
    primaryMuted: 'rgba(34, 197, 94, 0.12)',
    accent: '#F59E0B',
    accentLight: '#FBBF24',
    accentMuted: 'rgba(245, 158, 11, 0.12)',
    error: '#EF4444',
    errorMuted: 'rgba(239, 68, 68, 0.12)',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#3B82F6',
    infoMuted: 'rgba(59, 130, 246, 0.12)',
    gradient: {
      primary: ['#22C55E', '#16A34A'] as const,
      accent: ['#F59E0B', '#D97706'] as const,
      surface: ['#141419', '#0A0A0F'] as const,
      hero: ['#16A34A', '#0D9488', '#0891B2'] as const,
      heroSubtle: ['rgba(34,197,94,0.10)', 'rgba(13,148,136,0.06)'] as const,
      card: ['#1C1C24', '#141419'] as const,
    },
    card: {
      background: '#141419',
      border: '#2A2A35',
    },
    tabBar: {
      background: '#0A0A0F',
      border: '#1C1C24',
      active: '#22C55E',
      inactive: '#6B7280',
    },
  },
  light: {
    background: '#FAFAF9',
    surface: '#FFFFFF',
    surfaceElevated: '#F5F5F4',
    surfaceHighlight: '#E7E5E4',
    border: '#E7E5E4',
    borderLight: '#D6D3D1',
    text: '#1C1917',
    textSecondary: '#57534E',
    textTertiary: '#A8A29E',
    primary: '#16A34A',
    primaryLight: '#22C55E',
    primaryDark: '#15803D',
    primaryMuted: 'rgba(22, 163, 74, 0.08)',
    accent: '#D97706',
    accentLight: '#F59E0B',
    accentMuted: 'rgba(217, 119, 6, 0.08)',
    error: '#DC2626',
    errorMuted: 'rgba(220, 38, 38, 0.08)',
    success: '#16A34A',
    warning: '#D97706',
    info: '#2563EB',
    infoMuted: 'rgba(37, 99, 235, 0.08)',
    gradient: {
      primary: ['#22C55E', '#16A34A'] as const,
      accent: ['#F59E0B', '#D97706'] as const,
      surface: ['#FFFFFF', '#FAFAF9'] as const,
      hero: ['#16A34A', '#0D9488', '#0E7490'] as const,
      heroSubtle: ['rgba(22,163,74,0.08)', 'rgba(13,148,136,0.05)'] as const,
      card: ['#FFFFFF', '#F9F9F7'] as const,
    },
    card: {
      background: '#FFFFFF',
      border: '#E7E5E4',
    },
    tabBar: {
      background: '#FFFFFF',
      border: '#E7E5E4',
      active: '#16A34A',
      inactive: '#A8A29E',
    },
  },
};

export type ThemeColors = typeof Colors.dark;

/* ── Responsive scaling (computed once at init for the device) ────────── */
import { Dimensions } from 'react-native';

const _BASE_WIDTH = 390; // iPhone 14/15 reference
const _screenW = Dimensions.get('window').width;
const _ratio = _screenW / _BASE_WIDTH;

/** Moderate scale — blends fixed + proportional (good for spacing & fonts) */
const _ms = (px: number, factor = 0.45): number =>
  Math.round(px + (px * _ratio - px) * factor);

export const Spacing = {
  xs: _ms(4),
  sm: _ms(8),
  md: _ms(12),
  lg: _ms(16),
  xl: _ms(20),
  xxl: _ms(24),
  xxxl: _ms(32),
  huge: _ms(48),
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 28,
  full: 9999,
};

export const FontSize = {
  xs: _ms(11, 0.35),
  sm: _ms(13, 0.35),
  md: _ms(15, 0.35),
  lg: _ms(17, 0.35),
  xl: _ms(20, 0.35),
  xxl: _ms(24, 0.35),
  xxxl: _ms(32, 0.35),
  hero: _ms(40, 0.35),
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '800' as const,
};

export const Layout = {
  /** Bottom padding for scrollable content to clear the floating tab bar */
  scrollBottomPadding: 120,
  /** Standard horizontal content padding (matches ScreenContainer.padded) */
  contentPaddingH: Spacing.xl,
};
