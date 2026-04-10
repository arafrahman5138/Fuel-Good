/**
 * Convert a Date to YYYY-MM-DD format using LOCAL timezone (not UTC).
 *
 * Use this instead of `date.toISOString().slice(0, 10)` which returns
 * the UTC date and causes off-by-one errors for users west of UTC.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
