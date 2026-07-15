/**
 * format — single source of truth for user-facing number formatting.
 *
 * Design-system pass 8: score/gram/calorie strings drifted across screens
 * ("142 g" vs "142g", ad-hoc `toLocaleString`, hand-rolled em dashes for
 * missing values). Route every formatted number through this module instead
 * of string-concatenating units inline.
 */

/** Thousands-group an integer with commas ("2459" → "2,459"). */
function group(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a 0–100 style score as a rounded integer.
 * Nullish (no data yet) renders the house em dash '—'.
 */
export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return String(Math.round(n));
}

export interface FmtGramsOptions {
  /** Decimal places to keep (default 0 — integer grams). */
  decimals?: number;
}

/**
 * Format grams with the space-free house suffix ("142g", never "142 g").
 * Nullish renders '—'.
 */
export function fmtGrams(
  n: number | null | undefined,
  opts?: FmtGramsOptions,
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const decimals = opts?.decimals ?? 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(n * factor) / factor;
  return `${rounded.toFixed(decimals)}g`;
}

/**
 * Format calories as a thousands-grouped integer with the ' cal' unit
 * ("2,459 cal"). Nullish renders '—'.
 */
export function fmtCal(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${group(n)} cal`;
}

/**
 * Calorie value/unit pair for tile layouts where the unit renders in a
 * smaller secondary style. Callers must never string-concat units
 * themselves — use this instead. Nullish yields value '—'.
 */
export function fmtCalParts(n: number | null | undefined): {
  value: string;
  unit: string;
} {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return { value: '—', unit: 'cal' };
  }
  return { value: group(n), unit: 'cal' };
}

/**
 * Count + noun with correct pluralization ("1 person", "2 people").
 * `plural` defaults to `singular + 's'`.
 */
export function pluralize(
  n: number,
  singular: string,
  plural?: string,
): string {
  const label = n === 1 ? singular : plural ?? `${singular}s`;
  return `${n} ${label}`;
}
