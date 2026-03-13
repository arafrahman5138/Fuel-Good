import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390; // iPhone 14/15 reference width

/**
 * Responsive scaling helpers.
 * `scale()` scales a value proportionally to screen width.
 * `isCompact` is true for narrow screens (iPhone SE, etc.).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const ratio = width / BASE_WIDTH;

  /** Scale proportionally to screen width */
  const scale = (px: number) => Math.round(px * ratio);

  /** Moderate scale — blended between fixed and proportional (good for fonts/padding) */
  const ms = (px: number, factor = 0.5) =>
    Math.round(px + (px * ratio - px) * factor);

  const isCompact = width < 380;
  const isLarge = width > 420;

  return { scale, ms, isCompact, isLarge, width, height };
}
