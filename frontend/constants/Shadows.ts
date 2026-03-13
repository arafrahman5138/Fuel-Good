import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const shadow = (
  offsetY: number,
  radius: number,
  opacityDark: number,
  opacityLight: number,
  elev: number,
) => {
  return (isDark: boolean): ShadowStyle => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: isDark ? opacityDark : opacityLight,
    shadowRadius: radius,
    ...(Platform.OS === 'android' ? { elevation: elev } : {}),
  });
};

export const Shadows = {
  none: { shadowOpacity: 0, elevation: 0 } as ShadowStyle,
  /** Subtle lift — cards, chips, list items */
  sm: shadow(1, 4, 0.12, 0.06, 2),
  /** Medium elevation — input bars, floating elements */
  md: shadow(4, 12, 0.18, 0.10, 6),
  /** High elevation — tab bar, popovers */
  lg: shadow(8, 20, 0.25, 0.15, 12),
  /** Modals, bottom sheets, overlays */
  overlay: shadow(12, 24, 0.30, 0.18, 20),
  /** Colored green glow — primary CTAs, selected states */
  interactive: (isDark: boolean): ShadowStyle => ({
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.35 : 0.18,
    shadowRadius: 14,
    ...(Platform.OS === 'android' ? { elevation: 8 } : {}),
  }),
  /** Elevated card depth — replaces flat card borders */
  card: shadow(2, 8, 0.24, 0.08, 4),
};
