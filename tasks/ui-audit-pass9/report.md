# UI Audit Pass 9 — Verification of Pass-8 Remediation — 2026-07-14

## Verdict

Pass 8 found 8 P1s (blank-screen wedge, planner trap, tab-bar bleed, XXXL word-split, detached FAB, truncated settings subtitle, dark-on-dark camera clock, grocery error contradiction) plus systemic drift (four chip styles, arbitrary tints, mixed affordances). Pass 9 confirms the remediation is real at the code level — every named fix exists in source, the macro-hex guard test's primary allowlist is empty, and the coordinator reports tsc clean and 62/62 jest. Visually, however, this pass splits cleanly in two: the **09:48–09:49 capture batch is invalid** (see Evidence integrity), so home, FAB-over-gradient, and both planner P1s remain code-verified only; the **10:11–10:16 batch is valid** and proves the settings/quests/profile work visually — those screens have genuinely jumped a grade. The wedge fix is code-verified and awaits the soak run (results appended separately by the coordinator).

## Evidence integrity (md5 dupe-check, run first)

- **P03-planner-firstpaint.png == P04-planner-scrolled.png** (byte-identical, `69e4c011…`) — the "scrolled" proof is the same frame; invalid as distinct evidence.
- **P09b-settings-subtitle-proof.png == hc-now.png** (`74954c83…`) — a renamed copy; benign, counted once.
- **P05-after-planner-close.png does not exist** in `tasks/ui-audit-pass9/captures/` despite being cited as the close-proof. The a11y-label-driven close is still supported by the automation log (the tap resolved BY label), but there is no on-disk capture.
- **Worse: P01, P02, P03/P04 are iOS springboard screenshots**, not the app (Maps/Calendar widgets at 09:48; Expo Go page at 09:49). The app was not foregrounded when they were taken. All four are invalid evidence.

## P1-by-P1

| # | Pass-8 finding | Fix | Proof | Status |
|---|---|---|---|---|
| 1 | Blank-screen wedge after nav churn | Tab animation shift→fade, `freezeOnBlur: false` | `app/(tabs)/_layout.tsx:42-43` | **PENDING-SOAK** (code-verified; soak appended by coordinator) |
| 2 | Planner trap: status-bar collision, unlabeled sub-44pt ✕, black header artifact | ✕ labeled "Close meal plan builder"; header rework | `components/MealsTab/MyPlanView.tsx:555`; automation closed the planner by tapping the a11y label | **CODE-VERIFIED** — P03/P04 are springboard dupes, P05 missing; no valid visual |
| 3 | Tab bar doesn't blur/scrim scrolled content | Real BlurView material in tab pill | `components/GlassTabBar.tsx:212` (pill BlurView) | **CODE-VERIFIED** — P02 invalid (springboard) |
| 4 | XXXL "Welcome Back" splits mid-word | `maxFontSizeMultiplier` caps | `app/(auth)/login.tsx:273,279,288` | **CODE-VERIFIED** — XXXL not re-captured |
| 5 | FAB detached + clipped by screen edge | FAB inset (`right: Spacing.lg`) + BlurView | `GlassTabBar.tsx:332,358,443`; P06–P10 tab bars show the + clearing the edge, vertically aligned with the pill | **PARTIALLY VERIFIED VISUALLY** — edge clearance proven on light bg; blur-over-gradient unproven (P02 invalid) |
| 6 | Settings subtitle truncates ("…and foll…") | SettingsRow 2-line subtitle | **P09 + P09b**: "Meal reminders, streak saves, and follow-ups" renders fully on two lines | **VERIFIED VISUALLY** |
| 7 | Camera status bar dark-on-dark | Step-aware StatusBar | `app/scan/index.tsx:2793` (`style={scanStep === 'capture' ? 'light' : …}`) | **CODE-VERIFIED** — scan not re-captured |
| 8 | Grocery error + "0 items / 0%" simultaneously | Stat card gated on `!error` | `components/MealsTab/GroceryView.tsx:204` | **CODE-VERIFIED** — forced failure not re-captured |

## System drift

**Guard test** (`frontend/__tests__/design-system-guards.test.ts`): all 8 pass-8 macro-map offenders migrated — `const ALLOWLIST: string[] = [];` — so no file under `app/` or `components/` may hardcode the six macro hexes as macro colors; the retired fatAlt pink `#EC4899` is guarded against reintroduction. A 35-entry SECONDARY_ALLOWLIST covers non-macro uses (brand green, score tiers), with a staleness test that forces entries to be deleted once cleaned — the ratchet only tightens.

**Primitives inventory** (`components/ui/`): Chip, DangerButton, SettingsRow, StatusPill, StreakChip, TextLink — all live and consumed by the migrated screens.

**Per-screen visual notes (valid captures only):**

- **Settings (P08/P09/P10/now3)** — pass-8 B+/B/B → **A−**. SettingsRow migration fully visible: uniform icon tiles with per-section semantic tones (green diet, blue notifications, purple/amber health, violet/grey subscription — no more arbitrary tints), affordance grammar now correct (chevron = navigate, caret on Guardrail Weights = expand, external-link on Subscription/Support/Privacy/Terms), "Household Size / 1 person" (pluralization fixed), Sign Out is a neutral ghost button distinct from red-tinted Delete Account, and Version 1.0.0 is a plain footer line. No regressions spotted.
- **Quests (P07)** — pass-8 B/C+ → **B+**. The two stat tiles (flame "2 Weeks at Goal", star "Lv 7") now share one icon-chip treatment; XP rewards are readable amber StatusPills (+30/+65/+75 XP); "Hit 129g Protein Target / 0/129" — rounding mismatch fixed. Minor: "Daily Progress 0%" pill plus its own progress bar is slightly redundant.
- **Profile (P06)** — clean **A−**. Level 7 + streak StatusPill/StreakChip pair reads as one system; XP bar, stat rows, and Quests & Streaks disclosure are consistent. Tab-bar + FAB geometry looks correct here.
- **Home / planner / FAB-over-gradient** — **ungradeable this pass**; the only captures are springboard shots.

## Honest coverage gaps

- P01–P04 invalid (springboard), P05 missing → home post-fix, FAB blur over the purple gradient, and both planner proofs have **no valid visual evidence** this pass.
- Dark-mode set not re-taken this pass.
- XXXL login not re-captured (code-verified only).
- **Health Context screen has still never been visually captured — two passes running.** P10c/hc-now show only its settings entry point ("Set Up Profile"), not the screen.
- Grocery forced-failure state not re-captured (code gate verified).
- Not regressions, by design: fat pink→violet (MacroColors), Sign Out de-reddening, tab shift→fade are intentional changes.

## Recommended pass-10 checklist

1. Re-capture with the app verifiably foregrounded (assert a known app element before every screenshot): home light, FAB over the Scan-Food purple gradient (blur + edge clearance), planner firstpaint, planner genuinely scrolled (distinct md5), planner post-close.
2. Health Context screen — capture it or file a ticket; third strike.
3. XXXL login re-capture; camera capture-step status bar; grocery forced-failure.
4. Dark-mode parity sweep (incl. "Last Week's Recap" presence check).
5. Append soak verdict on the wedge; if clean, close P1 #1.
6. Add an md5-uniqueness + foreground assertion step to the capture harness itself so invalid frames can't enter the evidence set again.

---

## Wedge soak results (appended by coordinator, 2026-07-14)

- **Baseline (pre-fix, `animation: 'shift'`):** 30 cycles light + 30 cycles dark — no reproduction. The wedge is intermittent (observed live twice during pass-8 capture, both post-navigation-churn in dark); the fix therefore rests on the ranked mechanism analysis (native scene detach under `shift` + uncontrolled screen freezing), not a proven repro→fix differential.
- **Post-fix (`animation: 'fade'` + `freezeOnBlur: false`):** 50 cycles light (10/10 rounds) + 20 cycles dark (4/4 rounds; the dark run's harness stalled after round 4 — all completed rounds clean) = **70 post-fix cycles, zero blank frames**.
- Regression probe kept at `tasks/ui-audit-pass8/run_churn.sh` — run it before ever switching the tab animation back to `shift`.
- Telemetry channel note: local dev has no Sentry DSN and no client_error table rows; the screenshot blank-detector is the authoritative signal.

**Wedge status: mechanism removed + 70-cycle soak clean = FIXED (with intermittency caveat); probe retained.**
