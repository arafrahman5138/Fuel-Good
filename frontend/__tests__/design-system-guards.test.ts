/**
 * @jest-environment node
 *
 * Design-system drift guards (pass 8).
 *
 * The six macro hexes are canonical in constants/Colors.ts (MacroColors).
 * No file under app/ or components/ may hardcode them — import MacroColors
 * / macroTint instead. Files that predate the rule are grandfathered in the
 * two allowlists below; NEW files must never appear here.
 */
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
const CANONICAL_FILE = 'constants/Colors.ts';

/** The MacroColors hexes (protein/carbs/fat/fiber/neutral) plus the retired
 *  fatAlt pink — still guarded so it can't be reintroduced as a macro color. */
const MACRO_HEXES = [
  '#22C55E',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#3B82F6',
  '#94A3B8',
];

/**
 * ALLOWLIST — known macro-color drift offenders (audit pass 8).
 * These files hardcode macro hexes AS macro colors and must migrate to
 * MacroColors/macroTint. Phase 2 empties this list.
 */
const ALLOWLIST: string[] = [];

/**
 * SECONDARY_ALLOWLIST — pre-existing files where the same hex values appear
 * in a NON-macro role (brand green, score tiers, meal-slot palettes, icon
 * tints...). They aren't the pass-8 migration targets, but each should
 * eventually route through a named constant. One comment per entry; remove
 * entries as files are cleaned — the staleness check below enforces that.
 */
const SECONDARY_ALLOWLIST = [
  'app/(auth)/login.tsx',                    // brand-green accents on auth screen
  'app/(auth)/onboarding.tsx',               // brand green + amber step accents
  'app/(tabs)/(home)/flex-onboarding.tsx',   // brand green + amber pillar accents
  'app/(tabs)/(home)/fuel-weekly.tsx',       // fuel score-tier greens/ambers
  'app/(tabs)/(home)/index.tsx',             // avatar gradient palette + brand-green CTA gradient
  'app/(tabs)/(home)/mes-breakdown.tsx',     // MES factor accent colors (green/blue/amber)
  'app/(tabs)/(home)/metabolic-coach.tsx',   // coach persona accents (green/purple/amber)
  'app/(tabs)/(home)/recap.tsx',             // recap score-tier greens/ambers
  'app/(tabs)/chat/index.tsx',               // brand-green chat accents
  'app/(tabs)/chronometer/index.tsx',        // fuel/metabolic mode gradients + coach icon tints
  'app/(tabs)/meals/index.tsx',              // meals-tab category card accents (green/amber/blue/purple)
  'app/(tabs)/profile/index.tsx',            // brand-green profile accents
  'app/(tabs)/profile/quests.tsx',           // quest state colors (green done / amber active)
  'app/(tabs)/profile/settings.tsx',         // settings icon-tile tints (migrate to SETTINGS_ICON_TONES)
  'app/cook/[id].tsx',                       // cook-mode timer/step accents (green/amber)
  'components/Button.tsx',                   // brand-green fallback in button variants
  'components/CompositeMealCard.tsx',        // meal-slot gradients (breakfast/lunch/dinner/snack)
  'components/EnergyHeroCard.tsx',           // score-tier + energy-forecast status colors
  'components/ErrorBoundary.tsx',            // brand-green retry accent
  'components/FuelCalendarHeatMap.tsx',      // heat-map tier colors (green/amber/blue legend)
  'components/FuelScoreBadge.tsx',           // score-tier green/amber
  'components/FuelScoreRing.tsx',            // score-tier colors + slate empty-state default
  'components/FuelSettingsSheet.tsx',        // fuel goal accent colors (green/amber)
  'components/MealImage.tsx',                // placeholder-image gradient palette
  'components/MealsTab/RecipeCard.tsx',      // fit-tier green/amber + Fuel-100 brand badge (non-macro role)
  'components/MealsTab/MyPlanView.tsx',      // plan-mode pill colors + meal-slot dots
  'components/MetabolicCoach.tsx',           // coach status colors (green/blue/amber)
  'components/RealFoodTrackerCard.tsx',      // tracker tier green/amber
  'components/ScanWeekImpact.tsx',           // scan impact tier green/amber
  'components/ScoreBreakdown.tsx',           // score-factor gradients (amber/green/blue/purple)
  'components/TypingIndicator.tsx',          // brand-green typing dots
  'components/WeeklyFuelBreakdown.tsx',      // weekly tier green/amber
  'components/WeeklyRecapBanner.tsx',        // recap banner tier green/amber
  'components/ui/SettingsRow.tsx',           // SETTINGS_ICON_TONES semantic map — canonical tones share hex values with macros by design
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function macroHexesIn(source: string): string[] {
  const upper = source.toUpperCase();
  return MACRO_HEXES.filter((hex) => upper.includes(hex));
}

describe('design-system guards: macro hex drift', () => {
  const files = SCAN_DIRS.flatMap((d) =>
    listSourceFiles(path.join(FRONTEND_ROOT, d)),
  );
  const offenders = new Map<string, string[]>(); // rel path -> hexes found
  for (const file of files) {
    const hexes = macroHexesIn(fs.readFileSync(file, 'utf8'));
    if (hexes.length > 0) {
      offenders.set(path.relative(FRONTEND_ROOT, file), hexes);
    }
  }
  const allowed = new Set([...ALLOWLIST, ...SECONDARY_ALLOWLIST]);

  it('no file outside Colors.ts and the allowlists hardcodes macro hexes', () => {
    const violations = [...offenders.entries()]
      .filter(([rel]) => rel !== CANONICAL_FILE && !allowed.has(rel))
      .map(([rel, hexes]) => `  ${rel}: ${hexes.join(', ')}`);

    expect(
      violations.length === 0
        ? ''
        : `Macro hexes hardcoded outside constants/Colors.ts.\n` +
            `Import MacroColors / macroTint from constants/Colors instead:\n` +
            violations.join('\n'),
    ).toBe('');
  });

  it('allowlists contain no stale entries (remove files once cleaned)', () => {
    const stale = [...allowed].filter((rel) => !offenders.has(rel));
    expect(
      stale.length === 0
        ? ''
        : `Allowlisted files no longer contain macro hexes — delete these ` +
            `entries so the ratchet only tightens:\n  ${stale.join('\n  ')}`,
    ).toBe('');
  });

  it('allowlists do not overlap', () => {
    const overlap = ALLOWLIST.filter((f) => SECONDARY_ALLOWLIST.includes(f));
    expect(overlap).toEqual([]);
  });
});
