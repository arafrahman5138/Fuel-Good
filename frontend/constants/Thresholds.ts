/**
 * Centralized score thresholds, tier boundaries, and game constants.
 * Import from here instead of hardcoding magic numbers in components.
 */

/** MES (Metabolic Energy Score) tier boundaries */
export const MES_TIERS = {
  excellent: { min: 90, label: 'Excellent', color: '#22C55E' },
  good: { min: 75, label: 'Good', color: '#4ADE80' },
  moderate: { min: 60, label: 'Moderate', color: '#F59E0B' },
  fair: { min: 40, label: 'Fair', color: '#FB923C' },
  poor: { min: 0, label: 'Needs Work', color: '#EF4444' },
} as const;

/** Fuel streak tier thresholds (days) */
export const STREAK_TIERS = {
  gold: { min: 8, color: '#FFD700' },
  silver: { min: 4, color: '#C0C0C0' },
  bronze: { min: 2, color: '#CD7F32' },
} as const;

/** Flex meal insight thresholds */
export const FLEX_THRESHOLDS = {
  /** Below this ratio: "almost all whole food" */
  lowFlexRatio: 0.25,
  /** Above this ratio: "high flex usage" */
  highFlexRatio: 0.6,
} as const;

/** Energy budget remaining thresholds for UI messaging */
export const ENERGY_REMAINING = {
  /** Show "plenty remaining" message */
  plenty: 20,
  /** Show "getting low" message */
  low: 5,
  /** Show "almost depleted" message */
  critical: 4,
} as const;

/** Accent colors used outside the main theme (tier indicators, badges, etc.) */
export const AccentColors = {
  purple: '#8B5CF6',
  blue: '#3B82F6',
  momentumBlue: '#4A90D9',
  orange: '#FB923C',
} as const;
