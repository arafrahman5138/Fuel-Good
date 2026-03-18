/**
 * Centralized animation timing constants.
 * Import from here instead of hardcoding durations/delays in components.
 */

export const AnimationDuration = {
  /** Ultra-fast micro-interactions (button press feedback) */
  instant: 120,
  /** Quick transitions (fade, close) */
  fast: 180,
  /** Standard transitions (card flip, tab switch) */
  normal: 300,
  /** Emphasis animations (entrance, reveal) */
  medium: 400,
  /** Slow, dramatic animations (hero entrance, phase text) */
  slow: 700,
  /** Extended animations (shimmer loops, glow pulses) */
  extended: 1200,
  /** Long-running loops (streak badge shimmer) */
  shimmer: 1800,
} as const;

export const AnimationDelay = {
  /** Stagger between list items */
  stagger: 80,
  /** Brief pause before secondary animations */
  short: 200,
  /** Phase text change interval */
  phaseInterval: 3000,
  /** Shimmer loop reset delay */
  shimmerReset: 2200,
} as const;

export const SpringConfig = {
  /** Snappy spring for card interactions */
  snappy: { tension: 58, friction: 11 },
  /** Gentle spring for entrance animations */
  gentle: { tension: 55, friction: 12 },
  /** Bouncy spring for badge reveals */
  bouncy: { tension: 40, friction: 8 },
} as const;

export const FadeConfig = {
  /** Standard loading phase text fade */
  phaseText: 280,
  /** Hero card fade transition */
  heroFade: 360,
  /** Card content fade */
  cardFade: 280,
} as const;
