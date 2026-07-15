/**
 * StreakChip — canonical streak pill (design-system pass 8).
 *
 * One implementation for both streak systems:
 *   kind 'fuel'      → leaf icon (real-food weekly streak / daily app streak)
 *   kind 'metabolic' → flash icon (metabolic weeks-at-goal)
 *
 * Tier colors reuse FuelStreakBadge's thresholds: bronze at 2, silver at 4,
 * gold at 8; below 2 stays neutral. Rendered on a StatusPill so the tinted
 * background follows the house color+'14' pattern.
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { pluralize } from '../../utils/format';
import { StatusPill } from './StatusPill';

export interface StreakChipProps {
  count: number;
  unit: 'day' | 'week';
  kind: 'fuel' | 'metabolic';
  /** Icon + "20d"/"5w"; full wording is preserved in the a11y label. */
  compact?: boolean;
  testID?: string;
}

/** Bronze/silver/gold thresholds shared with FuelStreakBadge (2/4/8). */
export function streakTierColor(count: number, fallback: string): string {
  if (count >= 8) return '#FFD700'; // gold
  if (count >= 4) return '#C0C0C0'; // silver
  if (count >= 2) return '#CD7F32'; // bronze
  return fallback;
}

export function StreakChip({
  count,
  unit,
  kind,
  compact = false,
  testID,
}: StreakChipProps) {
  const theme = useTheme();
  const color = streakTierColor(count, theme.textTertiary);
  const icon: keyof typeof Ionicons.glyphMap =
    kind === 'fuel' ? 'leaf' : 'flash';

  // "20-day streak" / "5 weeks at goal"
  const fullLabel =
    unit === 'day'
      ? `${count}-day streak`
      : `${pluralize(count, 'week')} at goal`;

  return (
    <StatusPill
      label={compact ? `${count}${unit === 'day' ? 'd' : 'w'}` : fullLabel}
      color={color}
      icon={icon}
      size={compact ? 'sm' : 'md'}
      accessibilityLabel={fullLabel}
      testID={testID}
    />
  );
}
