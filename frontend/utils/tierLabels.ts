/**
 * tierLabels — single source of truth for user-facing Metabolic Score tier
 * vocabulary (F7 tier-vocabulary sweep).
 *
 * The API emits tier keys (critical / low / moderate / good / optimal, plus
 * legacy aliases crash_risk / shaky / stable). Recipe cards already display
 * these through the ladder in stores/metabolicBudgetStore TIER_CONFIG:
 *
 *   critical → Drained · low → Sluggish · moderate → Steady ·
 *   good → Efficient · optimal → Optimized
 *
 * One-off strings elsewhere ("Stable" in backend quest titles, "Rebuilding"
 * from the health-pulse endpoint's poor tier) drifted from that ladder.
 * Route every tier display string through this module instead of mapping
 * ad hoc.
 */

/** API tier key → user-facing label (the recipe-card ladder). */
export const METABOLIC_TIER_LABELS: Record<string, string> = {
  critical: 'Drained',
  low: 'Sluggish',
  moderate: 'Steady',
  good: 'Efficient',
  optimal: 'Optimized',
  // Legacy aliases still emitted by older score rows
  crash_risk: 'Drained',
  shaky: 'Steady',
  stable: 'Efficient',
  // Health-pulse endpoint keys (backend /fuel/health-pulse _pulse_tier)
  excellent: 'Optimized',
  fair: 'Steady',
  poor: 'Sluggish',
};

/** Resolve an API tier key to the user-facing ladder label. */
export function metabolicTierLabel(tier: string | null | undefined): string {
  if (!tier) return '';
  return METABOLIC_TIER_LABELS[String(tier).toLowerCase()] ?? tier;
}

/**
 * Normalize legacy tier words inside server-composed copy (e.g. the quest
 * title "Reach Stable Energy") to the current ladder vocabulary. Only swaps
 * standalone tier words — never touches other copy.
 */
export function normalizeTierWording(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\bStable\b/g, 'Efficient')
    .replace(/\bShaky\b/g, 'Steady')
    .replace(/\bCrash Risk\b/gi, 'Drained');
}
