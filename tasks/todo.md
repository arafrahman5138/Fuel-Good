# Work Plans - Fuel Good Project

---

# Pass-8 Remediation + Pass-9 Re-audit (2026-07-14)

Executed the approved anti-vibecode fix plan: Phase 0 wedge fix, Phase 1 primitives +
standalone P1s (3 agents), Phase 2 migrations (6 agents + 1 resumed, strict per-file
ownership), Phase 3 re-audit. Reports: [ui-audit-pass9/report.md](ui-audit-pass9/report.md).

## Shipped
- [x] Wedge: tabs animation shift→fade + freezeOnBlur:false (mechanism-ranked fix; baseline churn ×60 didn't repro — intermittent; regression probe kept at tasks/ui-audit-pass8/run_churn.sh)
- [x] Primitives: utils/format.ts (fmtScore/fmtGrams/fmtCal/fmtCalParts/pluralize), macroTint + MAX_FONT_MULTIPLIER in Colors.ts, components/ui/{Chip,StatusPill,StreakChip,SettingsRow,DangerButton,TextLink}; drift-guard test with ratchet — primary ALLOWLIST now EMPTY (all 8 macro-map offenders migrated), fatAlt deleted, #EC4899 banned
- [x] P1s: planner pinned safe-area header + 44pt labeled X (tappable BY a11y label) + scroll-reset + CTA dedupe; FAB glass blur + 64pt parity + edge inset + dynamic a11y; login XXXL multipliers; settings subtitle 2-line (verified visually); scan step-aware StatusBar; grocery error gating
- [x] Migrations: settings 16 rows→SettingsRow w/ semantic tones + ghost SignOut + DangerButton + version footer; RecipeCard extracted (−417 lines, 21 chips→Chip, honest total count, neutral metadata); macro sweep across 7 files (all hues canonical, zero-state muted, fmtCalParts); StreakChip everywhere (labeled, weeks-at-goal preferred); DARK_RING_TRACK; desaturated MealImage placeholders; recap banner dark visibility; calendar single-indicator ring + trimmed legend; quests/recap/mes rounding + icons; MetabolicCoach chips + sane glyphs

## Verification (pass-9)
- tsc clean; jest 62/62 (46 + 16 new format/guard tests); guard allowlist empty = migration machine-verified
- Valid captures: settings A− (was B), quests B+, profile A−, subtitle P1 proven visually
- Soak: light 50/50 cycles clean; dark (in progress at write time — appended below)
- Honest gaps → pass-10 checklist: home/FAB/planner screenshots invalidated (springboard frames — Expo Go crashed mid-batch; code+automation verified instead), dark/XXXL/camera/grocery-failure/Health-Context not re-captured; capture harness needs a foreground assertion

---

# UI Audit Pass 8 — Look & Feel / Anti-Vibecode (2026-07-11)

Goal: full visual/UX audit of EVERY screen + edge states. Rubric: modern/sleek,
no "clanky" objects, nothing that reads as vibecoded — spacing rhythm, type
hierarchy, color/radius/shadow consistency, alignment, density, iconography,
empty/loading states, light+dark parity, Dynamic Type. Deliver ranked findings
+ concrete design fixes. Workspace: tasks/ui-audit-pass8/.

## Plan
- [x] Capture: 70 shots — light sweep (home/meals-hub/browse/desserts/components/saved/grocery/myplan/plan-builder/recipe path/track both views/coach/profile/quests/settings/scan capture+result/recap/FAB), dark 10-screen parity set + re-captures, XXXL type. Not captured: health-context (2 failed attempts — carry over), fuel-weekly, subscribe (audited in persona pass), onboarding (audited in persona pass), cook mode
- [x] Review: 4 review agents (Home/Track, Meals/Scan, Dark/Profile, Settings re-caps); reviewer md5-checked captures and caught duplicate/stale frames → re-capture round
- [x] Synthesize: tasks/ui-audit-pass8/report.md

## Review

**Full report: [ui-audit-pass8/report.md](ui-audit-pass8/report.md).**

8 P1s (broken): NEW reproducible blank-screen wedge after navigation churn (tab bar alive, content dead, ErrorBoundary silent); plan-builder status-bar collision + unlabeled sub-44pt ✕ (can trap users); tab bar doesn't blur scrolled content (purple bleed-through); XXXL splits "Welcome Back" mid-word; FAB clipped by screen edge; settings subtitle truncates mid-word; camera status bar dark-on-dark; grocery error+0% stat contradiction.

Verdict: bones are good (dark mode craft is real, scan result + recap hit the modern bar); the "vibecoded" feel comes from SYSTEM DRIFT — 4 chip styles, arbitrary tint assignment, 3 trailing-affordance styles, inconsistent per-macro colors, loud orange placeholder art, 3 safe-area/material bugs. Report includes a 7-point design-system prescription (one chip system + fixed macro color map, neutral placeholders, safe-area/material standardization, monochrome icon language, number-formatting util, a11y floor, affordance grammar).

---

# QA Fix Pass — P0–P3 remediation (2026-07-11)

Executed the approved fix plan (~/.claude/plans/create-a-plan-to-polished-sunset.md) for all
findings from the 5-persona QA campaign. Six parallel subagent workstreams + coordinator reconciliation.

## Shipped
- [x] A: cascade FK migration e5f6a7b8c9d0 (25 user FKs + 5 nested; root cause: dev DB stamped without DDL) → DELETE /account 200 (verified live); full store reset on logout/401 incl. AsyncStorage saved-recipes (leak verified fixed in sim); dead achievements hidden
- [x] B: dessert-role recipes scored from real ingredients (15/15 backfilled: banana milk 97 → brownie batter 50; meals stay 100); UI dessert logs send meal_type from recipe_role; room_used clamped + room_overflow; dedup respects meal_type; servings/quantity ≤20, titles truncate 200
- [x] C: sodium ceiling 1500 fires on profile save + height_in-only path (verified live); Health Context settings screen (7 condition toggles, prefilled); wizard prefill + inline hints; protein floors 1.2/0.7 (185.6g vs flat 232g verified)
- [x] D: GET /scan/quota; quota upsell sheet + scans-left pill (replaces "Scan failed" alert); health-pulse metabolic {available:false} for free (verified live); Track metabolic view premium-gated with upsell (verified in sim); paywall copy de-RevenueCat'd
- [x] E: /nutrition/daily comparison targets full-day (÷3 removed); coach truncation heuristic relaxed + retry-in-place + object-content guard; streaks recomputed correctly for backdated logs (jordan metabolic 1→20) + fuel_target_streak (weeks) exposed + badge shows weeks-at-goal; planner relaxation ladder (21/21 slots on default prefs) + warnings rendered; scan pairing opt-in (default off)
- [x] F: gaps/meal-suggestions dietary-filtered server-side; onboarding reveal hard diet filter (root cause: premium 402 → meat-heavy static fallback) + protein chips filtered; copy sweep (pluralization, Logged to Track, FLEX→ROOM, tier vocab util, Week-71 badge); photo-first browse; dynamic type on rings/chips; FAB closes on navigation

## Verification
- Backend: 421 passed / 1 known pre-existing failure (notifications e2e secret; password-reset dev-code excluded). Frontend: tsc clean, 46/46 jest.
- Month-driver re-run (411/411 logs): 10/10 assertions PASS — dessert scores varied [50→97] w/ meals 159/159 at 100, room_used ≤ room_total all 25 weeks, metabolic streaks track backdated days, no grammar bugs, priya errors all 402, frank sodium 1500.
- Simulator: free-tier Track shows premium upsell (was leaked/stale data); post-logout state clean.
- Also fixed forever: pytest can no longer bind to dev Postgres (tests/conftest.py guard) — the root cause of two dev-DB wipes.

## Notes
- Everything is UNCOMMITTED, mixed with the scan-enhancement session's working-tree changes — needs a commit-boundary decision.
- Follow-ups: notifications.py recap strings still hard-pluralize; /metabolic/meal-suggestions deeper rework; achievements system build-or-delete product decision.

---

# 5-Persona Month-of-Use QA Campaign (2026-07-10)

Goal: act as 5 distinct target users, exercise EVERY feature (onboarding, curated
meals/desserts, manual logging, scanning, AI coach, fuel score, metabolic score,
real-food tracker, weekly recap, streak, calendar, settings, freemium gating),
simulate a month of use per persona (API-backdated logs + live simulator UI
verification), and report strengths / weaknesses / over- & under-engineering from
both UX/visual and functional perspectives. Workspace: `tasks/persona-month-qa-2026-07-10/`.

## Personas
1. **Jordan Reyes, 27M** — gym rat, muscle gain, high-protein, logs 4-5x/day religiously, scans everything. Premium monthly.
2. **Priya Sharma, 34F** — busy vegetarian mom of two, quick meals, logs dinner only most days. FREE tier (tests 3-scans/day cap, upsells, 402s).
3. **Frank Kowalski, 58M** — hypertension + pre-diabetes, low tech-savvy, big portions, cooks classic American. Premium (tests health-flag pathways, sodium ceiling, accessibility).
4. **Sofia Reyes-Mata, 22F** — college student, sweet tooth, erratic logger (streak breaks, 3-day gaps, midnight snacks). Free → premium conversion mid-month.
5. **Marcus Webb, 41M** — Attia-adjacent biohacker, metabolic-score obsessive, keto-lean, heavy AI-coach user, edge-case magnet. Premium annual.

## Plan
- [x] Phase 0 — Recon: feature map (Explore agent), seed recipes (117), env check
- [x] Phase 1 — Backend restarted with `ALLOW_OPEN_PREMIUM_IN_NON_PRODUCTION=false`; premium granted via `access_override_level` (the prod comp path)
- [x] Phase 2 — 5 accounts provisioned via API; full 14-step onboarding walked in the simulator with a 6th fresh account (Nina, free-path incl. paywall dismiss). Signup password field rejects synthetic input (iOS strong-password overlay) → onboarding account registered via API, signed in via UI
- [x] Phase 3 — Month driver: 411/411 backdated logs OK across 5 personas; weekly + final captures per persona → runs/*_month.json
- [x] Phase 4 — Simulator passes: Jordan (home/recap/track/calendar/browse/recipe-log/live scan+log), Priya (coach gate, 3-scan quota wall live, free metabolic state), Sofia (calendar gaps, goal configurator, dessert log → tracker), Frank (XXXL Dynamic Type), Marcus (coach chat live ×3, edge logs). Meal-plan/grocery UI not captured (dev DB wiped mid-campaign by parallel session) — verified via API instead
- [x] Phase 5 — Edge cases: date bounds, dedup, 0.1/10 servings, emoji/500-char titles, zero-macro, empty log, quota boundary 3→4, streak gap/recovery (in driver + api_analysis)
- [x] Phase 6 — Report: `tasks/persona-month-qa-2026-07-10/report.md` (4 P0, 8 P1, 10+ P2, strengths, over-/under-engineered, top-10 actions)
- [x] Phase 7 — Env restored (open premium back on, content size reset); lessons.md updated

## Review

**Full report: [persona-month-qa-2026-07-10/report.md](persona-month-qa-2026-07-10/report.md).** 411 simulated logs + ~60 UI captures + 21-finding API analysis ([runs/api_analysis.md](persona-month-qa-2026-07-10/runs/api_analysis.md)).

Headline P0s: (1) account deletion 500s (xp_transactions FK, no cascade) and has no UI; (2) cross-account store leak — Priya saw Jordan's macros after account switch; (3) hypertension sodium ceiling unreachable — no UI collects it AND the API path never applied it; (4) curated recipes hardcode Fuel 100 incl. desserts, and UI-logged cookies count as real-food meals (verified live: 2/17 → 3/17).

Headline P1s: Today's Fuel divides targets by 3 (false "over budget" all day); Coach replies fail to render (message is an object, client expects string); streak units wrong/frozen ("21 weeks" on a 30-day account); quota wall is a bare "Scan failed" alert with no upgrade CTA; free tier leaks MES via health-pulse while never marketing premium; meal-plan generate silently returns empty plan without embeddings; scan-log silently adds a pairing item; onboarding meal reveal ignores vegetarian.

Standout strengths: scan→tracker integration ("logging this makes it 11 of 17"), weekly recap proof-moment, day-0 no-shame copy, goal configurator, calendar history, recipe detail + one-tap log.

Caveats: Expo Go (no RevenueCat purchase, push untested), chat failure needs prod-provider re-verify, dev DB wiped mid-campaign (data pre-captured; wipe itself surfaced the empty-plan bug).

---

# Scan Enhancement Implementation (2026-07-11)

Executed the approved 4-phase enhancement plan from the 2026-07-10 scan QA.
All phases shipped; plan file: ~/.claude/plans/create-an-enhancement-plan-joyful-bentley.md.

## Delivered
- [x] Phase 0: /scan/smart 90s timeout allowlist (api.ts); NaN macro guard + carbs/sugar row logic; recoverable label scans titled "Packaged product" (+raw_product_name)
- [x] Phase 1.1: `components` JSON persisted on scanned_meal_logs (migration a9f3d1c27e40); ingredient-overlap cache filters prompt_version, skips component-less rows, returns real components → identical fresh/cached fuel scores (test_scan_cache_consistency)
- [x] Phase 1.2: scan_primary_grace_ms=2000; race holds fallback result and prefers primary within grace (3 new unit tests). NOTE: live primary share still ~16% — flash rarely beats threshold+grace; tune threshold/grace against prod latencies or eval lite-as-primary
- [x] Phase 2.0: run_suite.py source_model share + distinct-label-score detector + --assert-baseline + `make scan-eval`
- [x] Phase 2.1: label scorer de-quantized (base 80, +16 bonus cap, band projection, sugar ramp + dominance caps, juice-concentrate patterns, ultra label ceiling 25). Live label scores now [19.7, 24, 63, 93, 96] vs {34.9, 59, 100}
- [x] Phase 2.2: estimated_grams/item_count in extractor prompt (v5_grams); USDA per-100g scaled by grams; energy-density sanity envelope (fried chicken 420→938 kcal, sundae 204→1000 live); prompt version bump invalidates caches
- [x] Phase 2.3: 33 South Asian NOVA entries + alias support; rotisserie chicken → nova 3; exact-dict-match bounds model's err-higher hints to dict+1 (unless processing methods) — thali 40→75, nachos stays ≤48
- [x] Phase 3.1: shared _smart_scan_stream_events + label branch (fixes /meal/stream label crash); POST /scan/smart/stream; api.uploadStream (expo/fetch, buffered SSE parser); scan screen streams component chips with kill switch + blocking fallback; verified E2E in simulator
- [x] Phase 3.2: recoverable labels → score null / tier "unscored" / needs_better_capture + barcode/panel CTA card (suite: capture handoff 2/2)
- [x] Phase 3.3: kept minimal (recoverable-path rename); vowel-ratio heuristic rejected — fails on the observed example, risks real brand names
- [x] Phase 3.4: portion-confirm chip (2026-07-11, user go-ahead): estimated-grams readout
  ("Portion — looks like ~750 g. About right?") + one-tap Small/Medium/Large below the macro
  grid; never gates logging. Implementing it exposed and fixed a PATCH /scan/meal bug: a
  portion-only update rebuilt nutrition from bare ingredient names, collapsing a grounded
  1170 kcal scan to 137 kcal — added rescale_meal_scan_result (meal_scan.py) + router fast
  path when echoed ingredients match estimated_ingredients (NOT normalized_ingredients,
  which carry merged hidden items like "salt"). Verified live: 517 kcal × large = 646.2,
  components preserved; 2 regression tests (test_meal_scan_portion_rescale.py). Simulator
  visual pass completed once the persona-QA session freed the sim: parfait scan showed
  "Portion — looks like ~300 g. About right?"; tapping Large rescaled 620→775 kcal
  (exact ×1.25, all macros) with the Large pill active — screenshots
  d02-portion-result-scroll1.png / d02-chip-after.png. Maestro note: tap the chip via
  a11y label ("Set portion to Large") — the accessibilityLabel replaces child text.

## Addendum — Gemini 3.1 upgrade (2026-07-11, user-requested)
- No plain "gemini-3.1-flash" exists on the API; benchmarked candidates on the eval image:
  3.1-flash-lite 4.3s (stable GA), 3.1-pro-preview 9.4s (preview-only), 2.5-flash 10.5s, 3.5-flash 12.0s.
- Shipped: scan_model=gemini-3.1-flash-lite (config.py + backend/.env SCAN_MODEL override),
  fallback stays gemini-2.5-flash-lite (cross-family resilience). chat_model/GEMINI_MODEL untouched.
- Full-suite result: p50 latency 9.5s → 4.4s (max 6.1s), fuel 17/19, kcal 14/19, label 4/5,
  handoff 2/2, recall 1.0, no regressions vs baseline gate.
- The upgrade exposed a PRE-EXISTING crash: multi-dish scans referenced undefined
  _aggregate_nutrition (meal_scan.py:1737) → degraded results (3.1 reports multi_dish more
  often). Implemented the missing helper; m06/m10 now scan clean (7/7 targeted rerun, 100%
  primary share). Also: USDA placeholder key now skipped (was burning ~0.5s/component on 403s);
  run_suite primary_share metric now keyed by PRIMARY_MODEL env (default gemini-3.1-flash-lite).
- Optional follow-ups: gemini-3.1-flash-image exists for the fixture generator (don't regenerate
  the current suite — ground truth is tied to it); chat/coach model upgrade is a separate decision.

## Verification
- Backend: 72 scan-related tests green (incl. 12 new); frontend: 45 jest green + tsc clean
- Live suite (make scan-eval): no regressions vs baseline; classification 26/28 (2 transient degraded), fuel 16/19, label 4/5, handoff 2/2, kcal 13/19, recall 1.0
- Simulator E2E: streaming scan rendered result (m08 nachos)
- Incidents during work (both fixed + lessons.md): alembic env.py silently skipped migrations (prod audit chip spawned); multi-file pytest wiped dev Postgres (re-seeded; DATABASE_URL guard documented)

---

# Scan Accuracy QA — Gemini Image Suite (2026-07-10)

Goal: thoroughly test scanning (meals, desserts, labels, grocery items) with a
Gemini-generated image suite; measure classification, component, calorie, and
Fuel Score accuracy + latency; verify in simulator; recommend optimizations
(benchmark: Cal AI).

## Plan
- [x] Recon: map scan pipeline, fuel score engine, existing harness (tasks/scan-audit)
- [x] Obtain working GOOGLE_API_KEY (user-provided), restart backend with it
- [x] Build new suite: 28 images (10 meals healthy→unhealthy, 6 desserts, 5 labels, 5 grocery, 2 edge) + ground truth (type, components, kcal range, fuel range)
- [x] Generate images via gemini-2.5-flash-image
- [x] Register test account, run full suite via /api/scan/smart; capture accuracy + latency
- [x] Simulator E2E: inject subset via simctl addmedia, drive scan flow, screenshot proof (5 flows)
- [x] CalAI research (background agent) → optimization comparison
- [x] Report: accuracy findings + ranked optimization recommendations
- [x] Fill Review section

## Review
Full report: [scan-qa-2026-07-10/report.md](scan-qa-2026-07-10/report.md).
Headline: classification 27/28, component recall 1.0, meal fuel-in-range 16/20,
label score-in-range 2/7 (weakest), kcal-in-range 12/20, p50 7.8s / max 14.1s.
Top defects: (P0) /scan/smart missing from client 90s-timeout allowlist (api.ts:30);
(P0) ingredient-overlap cache recomputes fuel score → identical thali scored 40 fresh
vs 70 cached; (P1) label scorer gave a 53g-sugar "no added sugar" smoothie 100/100 and
quantizes to {34.9, 59, 100}; (P1) flash-lite fallback wins ~83% of model races;
(P1) calorie error biased low on energy-dense foods (fried chicken −55%, sundae −65%).
No production code changed — QA artifacts only (tasks/scan-qa-2026-07-10/).
Caveat: local run had no ANTHROPIC/USDA keys, so ensemble+grounding stages were off.

---

# Month-1 Target-User Test — Replay (2026-04-23)

**Goal:** Re-run the month-long prime-target-user test from 2026-04-16 with a **fresh target-user persona** to validate which P0 fixes landed, re-score on the same rubric, and capture a new delta-vs-baseline report.

**Baseline:** [month1-target-user-assessment.md](tasks/month1-target-user-assessment.md) (Alex Chen, 2026-04-16, Composite 7.2/10)

## New Target User — Maya Patel

Fits the **prime target segment** identified in the 04-16 report ("wellness-curious high-earner, Attia-adjacent, tired of calorie counting") but distinct from Alex so findings are fresh, not confirmation-biased.

- **Maya Patel, 32F**, Senior Product Designer at a Series-B SaaS, NYC, $175k + equity
- Partner is a line cook — cares about ingredient depth, not just macros
- **Health flags:** mild PCOS (activates insulin-resistant pathway in metabolic engine)
- **Activity:** runs 4x/wk (half-marathon last fall), yoga Sundays
- **Goal:** weight maintenance + sustained energy through sprints; anti-restriction framing
- **Reading:** *Outlive*, *The Glucose Goddess*, *Atomic Habits*; Huberman + Attia listener
- **Current apps:** WHOOP 3+ yrs, Yuka daily, quit MyFitnessPal 2018, tried Noom 2 wks (shamed → churned)
- **Cooking:** 5x/wk (Sunday meal prep), Sweetgreen 2x/wk, weekend dining out
- **Dietary:** omnivore with strong pescatarian lean; dislikes lamb
- **Flavor preferences:** Mediterranean, Japanese, Mexican
- **Price tolerance:** $14.99/mo; would prefer $99/yr annual
- **Quote:** *"I'm not trying to lose weight — I'm trying to stop feeling like shit when I wake up."*

**Why this persona is the right differential:**
- Exercises PCOS pathway (Alex didn't) — tests insulin-resistant carb-curve math
- Female in prime target segment — original was male-skewed
- Runner → tests workout-logging / active-day adjustments
- Cohabitating with a chef → higher bar on recipe quality
- Same archetype (high-earning, wellness-curious, anti-Noom) so retention lens stays apples-to-apples

## Plan

### Phase 1 — Setup (~20 min)
- [ ] Add `maya` entry to `runs/personas/personas.json`
- [ ] Provision account + capture computed metabolic budget → verify PCOS → IR carb curve
- [ ] Confirm simulator + Expo + backend connectivity

### Phase 2 — Live Week 1 Walkthrough on Simulator (~90 min)
Maestro-driven end-to-end → `runs/captures/maya/`
- [ ] Onboarding (PCOS handling)
- [ ] Paywall
- [ ] Meal reveal (P0 #2 — liked-protein filter)
- [ ] Home / Today's Plan (one-tap log)
- [ ] Flex Budget (P0 #4 — "Needs Work" day-0 copy)
- [ ] Meal plan builder (Include/Avoid, Maya-specific swaps)
- [ ] Scanner (P0 #3 — tab-level) + 5 realistic scans
- [ ] Healthify chat × 4 prompts (P0 #1 — recipe card schema enforcement)
- [ ] Cook mode (one recipe end-to-end)
- [ ] Days 2-7 via API time-travel

### Phase 3 — Weeks 2-4 Projection (~30 min)
- [ ] Recipe catalog count (vs 79 baseline)
- [ ] Breakfast unique-meal count (vs 8 baseline)
- [ ] Maya's 4-week rotation uniqueness
- [ ] Day-28 renewal forecast

### Phase 4 — Market Research Refresh (~30 min, parallel subagent)
- [ ] Competitor landscape changes since April 2026
- [ ] New entrants in anti-calorie-counting segment
- [ ] ZOE / WHOOP nutrition / MacroFactor moves
- [ ] PCOS-specialist nutrition apps

### Phase 5 — Report (~45 min)
- [ ] Write `tasks/month1-target-user-assessment-2026-04-23.md`
- [ ] Same rubric: Utility / Polish / Habit / Moat + composite
- [ ] Delta vs 04-16 P0 items (shipped / regressed / untouched)
- [ ] Updated P0/P1/P2 recommendations
- [ ] Maya's renewal forecast
- [ ] Appendix: screenshots + flow paths

### Phase 6 — Lessons
- [ ] Update `tasks/lessons.md` with methodology improvements

## Success criteria
- [ ] Full end-to-end walkthrough captured
- [ ] Every 04-16 P0 explicitly verified: fixed / regressed / untouched
- [ ] New composite score w/ justification
- [ ] Maya persona persisted for future reuse
- [ ] Honest verdict on whether 04-16 recommendations materially moved the needle

---

# UI Enhancement Plan — "Make It Feel Premium"

## Audit Summary

After a thorough audit of every screen and component, the app has a solid foundation (good dark theme, glass tab bar, gradient cards). But there are clear gaps vs apps like Robinhood/Duolingo/Oura that make those apps feel *premium*. The main themes:

1. **Micro-interactions are sparse** — Most touchable elements only use `activeOpacity`. No scale, no haptics, no spring physics.
2. **Empty/loading states are bare** — Plain text or basic spinners instead of skeleton screens and animated illustrations.
3. **Visual hierarchy is flat in places** — Settings, preferences, food detail all feel like uniform lists with no breathing room.
4. **Celebration moments are muted** — Logging a meal, hitting a streak, leveling up should feel *rewarding*.
5. **Button gradient is too subtle** — Primary CTA doesn't pop enough.
6. **Some text is too small** — Macro labels at 9-10px, XP bar text, ring labels are hard to read.

## Implementation Plan

### Phase 1: Core Polish (Highest Visual Impact)

- [x] **1. Enhance Button.tsx** — Make primary gradient more vibrant (`#22C55E → #059669`), add `usePressScale` to all variants, increase disabled state contrast
- [x] **2. Add press-scale to all card components** — GradientCard, CompositeMealCard, EnergyHeroCard, TodayProgressCard menu items, meals.tsx action cards — anywhere with `activeOpacity` should also scale
- [x] **3. Improve empty states** — Home (no meals logged), TodayProgressCard, food search empty, chronometer empty — add animated icons, gradient containers, stronger CTAs
- [x] **4. Settings/Preferences visual grouping** — Add section cards with subtle surface backgrounds, visual separators, expand/collapse animations for budget editor
- [x] **5. Enhance FuelScoreRing** — Minimum opacity 0.3 at score 0, increase label font sizes, smoother toggle animation (200ms instead of 100ms)

### Phase 2: Micro-Interactions & Animations

- [x] **6. Staggered entrance animations** — Profile achievements, meal plan cards, search results, cook mode ingredients — items fade/slide in sequentially
- [x] **7. ChipSelector polish** — Add press scale, smooth background color transition on select, scroll fade hints for horizontal chips
- [x] **8. Progress bar animations** — EnergyHeroCard progress bar animate width on update, XPBar increase height to 8px and add gradient fill, macro ring counters
- [x] **9. Cook mode celebration** — Step completion gets bounce/check animation, recipe completion gets confetti moment
- [x] **10. Food detail color-coded macros** — Color dots for protein/carbs/fat, animated counter when quantity changes, log success celebration animation

### Phase 3: Premium Feel

- [x] **11. Skeleton loaders** — Replace ActivityIndicator with shimmer/skeleton cards for async content (home dashboard, search results, recipe detail)
- [x] **12. Subscribe page hero** — Add subtle gradient animation/shift, elevate recommended plan card with glow shadow, animated feature checkmarks
- [x] **13. Login/Auth polish** — Input focus animations (accent underline), animated error entry, social button press feedback
- [x] **14. Onboarding progress** — Add animated progress bar showing step X/16, step transition animations (slide/fade), completion celebration
- [x] **15. Scan screen** — Add scanning animation overlay, result card entrance animations, haptic on scan complete

## Design Principles for Implementation
- Use `react-native-reanimated` for all new animations (spring physics, not linear)
- Haptic feedback via `expo-haptics` on meaningful interactions
- Keep animations under 300ms — snappy, not sluggish
- Consistent `usePressScale(0.97)` on all interactive cards
- Minimum font size: 11px for any visible text

---

# Structural Audit Plan

## Overview
Full structural audit of the Fuel Good codebase (~72K lines): React Native/Expo frontend, FastAPI backend, Next.js website.

## Tasks

### 1. Dead Code Removal
- [ ] Scan all frontend files for unused imports
- [ ] Identify unreferenced functions and duplicate components
- [ ] Find orphaned files never imported anywhere
- [ ] Output list of every file and function to delete
- [ ] Remove dead code

### 2. Folder Restructure
- [x] Propose feature-based folder structure (see structural-audit.md)
- [ ] Migrate to feature-based folders (future)

### 3. Hardcoded Value Extraction
- [ ] Find hardcoded strings, color hexes, API URLs
- [ ] Find API keys, timeout values, magic numbers
- [ ] Move all into config files with named exports grouped by category

### 4. Naming Standardization
- [ ] Audit variable names, function names, file names
- [ ] Flag vague names (temp, data, handler, stuff, thing, utils2)
- [ ] Suggest specific descriptive replacements

### 5. Scalability Risks
- [ ] List top 5 things that will break at 10K daily active users
- [ ] For each risk, explain failure mode
- [ ] Provide specific fix with code examples

### 6. Worst File Rewrite
- [x] Identify the single messiest file in the project (scan/index.tsx — 2,992 lines)
- [x] Created useScanState.ts reducer hook to consolidate 32 useState calls
- [ ] Complete rewrite of scan/index.tsx using new hooks (future)

### 7. Documentation
- [ ] Write comprehensive README.md covering what the app does
- [ ] Include how to run locally, folder structure, environment variables

## Review
(To be filled after completion)

---

# Onboarding V2 Optimization Plan

## Goal
Maximize conversion rate and revenue without requiring external assets (video, food photography). All items are code-implementable.

---

## Phase 1: High-Impact Conversion Levers (Revenue-Direct)

These directly affect whether someone pays at the paywall.

- [x] **1.1 — Add "Generating Your Plan" loading screen**
  Insert a new screen between `commitment.tsx` and `paywall.tsx`. Show 8-10 seconds of animated progress messages:
  - "Analyzing your metabolism..."
  - "Building your meal plan..."
  - "Calculating your flex meals..."
  - "Personalizing your scanner..."
  - Final checkmark: "Your plan is ready"

  **Why:** Adds sunk cost (10 more seconds invested), creates anticipation ("I need to see MY plan"), and makes the paywall feel like it's gating something custom-built. This is the #1 pattern in high-converting health apps.

- [x] **1.2 — Add loss aversion copy on paywall dismiss**
  When user taps X to dismiss paywall, show a brief "what you'll lose" message before showing the discount. Examples:
  - "Without Fuel Good, you won't know what's really in your food."
  - "You'll lose your personalized meal plan and scanner access."

  **Why:** Loss aversion is 2x stronger than gain framing. Currently the dismiss just silently bumps a discount — pair it with emotional weight.

- [x] **1.3 — Fix commitment screen objection timing**
  Change auto-navigate from 2.5s to showing a "See my options →" CTA button instead. User taps when ready.

  **Why:** 2.5s isn't enough to read and process the objection response. Forcing navigation before the response lands undermines the objection handling.

- [x] **1.4 — Rethink the 80% discount on 3rd paywall**
  Replace the 80% discount (3rd dismiss) with a limited free tier entry. Show: "Try Fuel Good free with limited features — 3 scans/week, no meal plans." Add a prominent "Or unlock everything for just $11.99/year" as the alternative.

  **Why:** 80% discount trains users to always dismiss twice. A limited free tier gets them using the app (converts better long-term via in-app upgrade prompts) without devaluing the product.

---

## Phase 2: Engagement & Depth (Hook Users)

These increase time-in-onboarding and emotional investment.

- [x] **2.1 — Upgrade the video hook with richer animations**
  Make the existing animated scenes more cinematic:
  - Dramatic before/after comparison (red flags animating in → swap to clean alternative with green score pop)
  - Particle/confetti effect when Fuel Score hits 100 on the swap
  - Smooth cross-fade transitions instead of opacity toggles
  - Subtle background gradient shift per scene (warm → cool → green)

- [x] **2.2 — Merge problem statement into the video hook**
  Remove `problem-statement.tsx` as a standalone screen. Add the problem statement text as the opening of Scene 1 in video-hook.

  **Why:** Eliminates one tap/screen. Every unnecessary screen is a drop-off point.

- [x] **2.3 — Personalize plan preview copy based on goal**
  Change headline from generic "Your week with Fuel Good" to goal-specific:
  - energy → "Your energy transformation week"
  - weight → "Your fat loss week with Fuel Good"
  - cleaner → "Your clean eating week"
  - muscle → "Your muscle fuel week"

- [x] **2.4 — Rethink social proof screen**
  Replace hard-coded "12,400+" stat with a "What you'll get" recap that summarizes their personalized plan (goal, flex meals, meal types, scanner). Reinforces sunk cost and value simultaneously.

---

## Phase 3: Growth & Data (Revenue Indirect)

- [x] **3.1 — Add notification permission request**
  Custom "Enable Notifications" card after live scan (post-aha moment). Frame: "Get daily meal suggestions and flex meal reminders." Preview notification appearance.

- [x] **3.2 — Add attribution question**
  Single question early in onboarding (after energy-check): "How did you find Fuel Good?" Options: App Store, TikTok, Instagram, YouTube, Friend/Family, Other.

- [x] **3.3 — Add "premium preview" label to scan result**
  After scan result in `live-scan.tsx`, add badge: "Premium members see this for every product they scan."

---

## Phase 4: Polish & Micro-Interactions

- [x] **4.1 — Add selection micro-interactions to question screens**
  Card glow/pulse on select, subtle checkmark animation, 400ms delay before auto-advance.

- [x] **4.2 — Improve paywall CTA framing**
  "Start your 7-day free trial" → "Try Free for 7 Days" (shorter, punchier). Add: "Cancel anytime. No charge until day 8."

---

## Implementation Order

**Sprint 1 (ship first):** 1.1, 1.2, 1.3
**Sprint 2 (engagement):** 2.2, 2.3, 1.4
**Sprint 3 (growth):** 3.1, 3.2, 3.3
**Sprint 4 (polish):** 2.1, 2.4, 4.1, 4.2

## Success Metrics
- **Primary:** Paywall conversion rate (target: 10%+)
- **Secondary:** Onboarding completion rate (hook → paywall)
- **Tertiary:** Time in onboarding (target: 10-15 min)
- **Per-screen:** Drop-off rate at each step

---

# iOS App Store Audit — Implementation Pass 1 (2026-04-16)

Full audit: `tasks/ios-app-store-readiness-audit.md`.

## Shipped

### App Store submission blockers
- [x] **B3** Terms/Privacy links on onboarding paywall (`app/onboarding-v2/paywall.tsx`)
- [x] **B3/High** Auto-renew disclosure copy on onboarding paywall (all 3 dismiss states)
- [x] **B2** Privacy Manifest via `expo-build-properties` plugin (`app.json`) — covers tracking, collected data types, required-reason APIs for Sentry / PostHog / RevenueCat / Supabase / RN core
- [x] **B5** AI chat report-abuse UI: frontend bubble-level "Report" button + `/chat/report` backend endpoint persisting via `record_notification_event`
- [x] **B6** Deleted `frontend/tmp_probe.js`, `tmp_signup.js`, `tmp_toggle_signup.js`; added `frontend/tmp_*.js` to `.gitignore`
- [x] **B7** Camera/photos pre-permission rationale: new "Enable Camera in Settings" denied-state UI + `Linking.openSettings()` fallback; permission-denied alerts now offer Open Settings action

### Backend operation blockers
- [x] **B8** `.gitignore` `backend/real_food.db` and `backend/*.db`; `git rm --cached` the committed DB
- [x] **B10** Notification scheduler retry logic: `retry_count` + `next_retry_at` columns on `notification_deliveries`; exponential backoff (5m → 15m → 60m, max 3 attempts); `_retry_failed_deliveries` runs at top of every cycle; `_PERMANENT_EXPO_ERRORS` set (DeviceNotRegistered etc) marked non-retryable

### High-priority polish
- [x] Global `ErrorBoundary` at app root (`components/ErrorBoundary.tsx`, wrapped in `app/_layout.tsx`) — shows a branded fallback with "Try again" + "Contact support" actions; reports to Sentry via `reportClientError`
- [x] Replaced `allowFontScaling={false}` with `maxFontSizeMultiplier` in chat header + input (a11y)
- [x] Account-deletion error handling upgraded: UI no longer logs out on API failure; shows support email with mailto action
- [x] Backend file-upload validation order: magic bytes are now the single source of truth (`image/product` + `image/meal` endpoints); `detected_mime` used for storage, `content_type` demoted to hint
- [x] DB pool bumped to `pool_size=20, max_overflow=30, pool_timeout=30`
- [x] Server-side Sentry wired: `sentry-sdk[fastapi]==2.19.2` in requirements, `_configure_sentry()` in lifespan, new env vars in `render.yaml` (`SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`)

## Still needed before submission (not code-fixable in-repo)

- [ ] **B1 RevenueCat production API key**: still `test_pkQnpZsWQMeDLvqlLlVnHXtGiKk` in `eas.json`. Replace with prod key from RevenueCat dashboard before first store build.
- [ ] **B4 Publish legal URLs**: `docs/legal/privacy-policy.md`, `terms-of-service.md` must be live at `fuelgood.app/privacy`, `/terms`, `/support` — deploy to website host.
- [ ] **B9 Cascade delete migration**: add `ondelete='CASCADE'` to every FK referencing `users.id` via Alembic, test in staging. Current account-deletion path relies on implicit cascade.
- [ ] **apple-app-site-association** hosted at `fuelgood.app/.well-known/`.
- [ ] **Sentry dSYM auto-upload**: `eas.json` has `SENTRY_DISABLE_AUTO_UPLOAD=true` — flip after validating SENTRY_AUTH_TOKEN in build env.
- [ ] **RevenueCat production key**: expected also in `render.yaml` `REVENUECAT_SECRET_API_KEY` (sync from dashboard).
- [ ] **Install new npm dep**: run `npx expo install expo-build-properties` locally to materialize `expo-build-properties@~1.0.9` in `node_modules`.
- [ ] **Install new pip dep**: `sentry-sdk[fastapi]==2.19.2` — picked up on next Render deploy via `buildCommand`.

## Follow-up (medium)

- [ ] Accessibility label sweep across screens (only `GlassTabBar` covered today).
- [ ] Skeleton + error + retry state for every data-fetching screen.
- [ ] 6-digit password reset → 8-digit or 12-char alphanumeric.
- [ ] Move to Redis rate limiter before horizontal scale.
- [ ] PII (user_id) out of logs; use request-id correlation.
