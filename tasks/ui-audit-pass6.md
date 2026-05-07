# Fuel Good iOS UI Audit — Pass 6 (2026-04-29)

*Sixth pass. Companion to passes [1](ui-audit.md), [2](ui-audit-pass2.md), [3](ui-audit-pass3.md), [4](ui-audit-pass4.md), [5](ui-audit-pass5.md). First pass to **audit motion and haptics** specifically — passes 1–5 were static-screen pixel-level audits.*

**Scope**: 7 video recordings + ~30 extracted key frames + static analysis of 38 haptic call-sites. Pass-5 P0–P3 fixes (F1–F17) shipped pre-pass-6 and are visually verified throughout this audit's captures.

---

## The single most important finding

**The app's design system has motion and haptic *primitives* in plenty of places, but no shared *language*.** Pass 6 found the codebase already uses `Animated.spring` extensively (70 files) and fires haptics in 38 sites — but two structural issues recur:

1. **Inconsistency**: the same gesture fires different haptic intensities across screens (cook step advance fires `Success`, onboarding step advance fires `Light`). Same animation pattern is implemented from scratch each time rather than reused. There's no shared `useTransition` helper or `Haptic.celebrate()` semantic primitive.

2. **Gaps where motion and haptic should fire together but only one does** — the most visible: **logging a meal from Today's Plan** has no haptic feedback at all (Gap G1 in haptics inventory) yet probably has a checkmark/state animation. Conversely the cook celebration has both a `Success` haptic AND a slide-in card — that's the pattern to spread.

**Fix direction**: introduce a small `motion-haptic-primitives.ts` layer that exports semantic helpers — `tap()`, `select()`, `commit()`, `celebrate()`, `error()` — each pairing the right haptic with the right Animated config. Then refactor the 38 sites + ~10 missing-haptic spots to use them. This keeps individual animations intact while unifying the *system*.

---

## P0 fixes from pass 5 — visually verified during pass 6 capture

While capturing the animation reels for this pass, I observed several pass-5 fixes landing in production state:

- **F3 Home dual-status bug** ✓ — Home shows green ring + "Elite day — you're in the zone" tagline (no more red "Low fuel" copy alongside green Elite Fuel badge). [`R02-tab-transitions-0.png`](ui-audit-pass6/frames/R02-tab-transitions-0.png) confirms.
- **F6 Cook tip button WCAG fix** ✓ — "Get tips for this step" now renders as **green** in dark mode (was orange-on-tan). [`R05-cook-celebration-1.png`](ui-audit-pass6/frames/R05-cook-celebration-1.png) confirms.
- **F14 Recipe Detail hero border** ✓ — hairline divider visible below hero photo on Beef and Potato Hash recipe screen.
- **F8 macro-tile colors** — Today's Fuel rings show 4 distinct colors (was 2 greens + 1 orange + 1 pink).

---

## Animation captures (Phase 1)

7 short video clips recorded with `xcrun simctl io booted recordVideo`, ~3-42 seconds each, totaling ~120 MB. Key frames (5 per video, at 5/25/50/75/95% of duration) extracted via `ffmpeg`. [Recordings](ui-audit-pass6/recordings/) · [Frames](ui-audit-pass6/frames/).

| ID | Animation | Duration | Status |
|---|---|---|---|
| R01 | Cold-launch (splash → home) | 2.8s | captured |
| R02 | Tab transitions Home→Meals→Track→Coach→Home | 41.8s | captured |
| R03 | Fuel ring tap-to-toggle (Fuel↔MES) | 17.7s | captured |
| R05 | Cook step nav (steps 3-5) + entry to Done | 19.1s | captured |
| R05b | Cook celebration (Done → "You cooked it!" → Log&Finish) | 17.7s | captured |
| R06 | Coach prompt → Healthify response stream + recipe card mount | 28.4s | captured |
| R07 | Profile → Settings → back navigation | 15.4s | captured |
| R04 | Meal log + ring fill | — | **deferred** (account already has 2 of 3 logged; needs fresh acct) |
| R08 | Score-up from 0 → 100 (first meal of day) | — | **deferred** (same — needs zeroed-state account) |

### Animation review

Full report in [`notes/animation-review.md`](ui-audit-pass6/notes/animation-review.md). Headline grades:

| ID | Animation | Grade | Status |
|---|---|---|---|
| R01 | Cold launch | **B+** | Hard cut splash → login; needs ~400ms cross-fade |
| R02 | Tab transitions | **C+** | **Zero animation** between tabs (frames show identical Home across 42s) |
| R03 | Fuel ring toggle | **B−** | Shrink+fade visible but spring overshoot not evident |
| R05 | Cook step nav | **B** | Missing celebration card slide, checkmark draw, XP bounce |
| R05b | Cook finish → celebration | **B−** | "Done" → "Log & Finish" is instant; no card mount animation |
| R06 | Coach stream | **A−** | Strong: spinner pulses, streaming text feels alive. Recipe card mount could ease in |
| R07 | Settings modal | n/a | **Capture artifact** — Maestro flow failed mid-step; frames don't show the modal transition. Re-capture in pass 7 |

**Average: B−/B**, dragged down by tab transitions (worst single finding).

#### Top 3 animation wins
1. **Coach streaming** — animated 3-dot spinner + progressively-revealed "Analyzing nutrition profile…" creates real-time presence
2. **Cook step UI layout** — green callout cards + ingredient grouping are well-designed (animations would enhance, not replace)
3. **Fuel ring + macro rings on Home** — clean visualization, the toggle mechanic is conceptually sound

#### Top 3 animation gaps (motion missing entirely)
1. **Tab bar transitions** — switching between Home / Meals / Track / Coach has zero motion. No content slide, no indicator slide. Feels like default `UITabBarController` with no customization. **This is the worst single finding of pass 6.**
2. **Cook celebration** — completing the final cook step should slide a card up from the bottom with a checkmark draw-in + "+50 XP earned" bounce. None of these animate today; the celebration screen mounts instantly.
3. **Cold launch** — splash screen → login is a hard cut. A 400ms cross-fade (or logo morph into the login app icon) would significantly improve perceived polish on first launch.

#### Top 3 timing issues
1. **Ring toggle easing (R03)** — code uses `Animated.sequence(shrink → expand)` with `Animated.spring(toValue: 1, tension: 180, friction: 10)`, but the bounce/overshoot is not visible in keyframes. Either the spring is too tight (no overshoot) or shrink phase is too brief (~130ms — humans barely register it). Recommend: 400ms total with `tension: 100, friction: 7` for a more felt overshoot.
2. **Tab indicator animation** (when implemented) — should lag slightly behind content slide so the indicator feels "pulled along" rather than locked-in-step. Suggest 200ms indicator vs 250ms content.
3. **Coach spinner pulse (R06)** — dots clearly pulse but cycle timing is ambiguous from frames. Should be deterministic 600–800ms loop with each dot offset 200ms.

#### Reduce-motion compliance
Static frame analysis can't fully verify, but the codebase has `isReduceMotionEnabled()` from `useAnimations` hook called in `FuelScoreRing.tsx:72`. **Pass 7 should toggle iOS Reduce Motion ON and re-capture R03 + R05b + (added R02 tab transitions, R07 modal once those are implemented)** to verify guards actually skip the animations rather than just running them faster.

---

## Haptics audit (Phase 3)

Full inventory in [`notes/haptics-inventory.md`](ui-audit-pass6/notes/haptics-inventory.md). Headline findings:

- **38 call-sites** total (not 57 as initial estimate — earlier grep counted multi-line code branches)
- **Distribution by intensity**: Light 42% · Success 26% · Medium 24% · Selection 5% · Warning 3%
- **Distribution by screen**: Onboarding 17 · Components 11 · Scan 6 · Cook 3 · Chat 1

### Top 5 issues

1. **`paywall.tsx:210` — Purchase fires `Medium`, should be `Heavy`** (financial commitment is high-stakes per HIG)
2. **`live-scan.tsx:90` — Demo scan result fires `Warning`, should be `Success`** (semantic mismatch on a positive action)
3. **`cook/[id].tsx:464` — Step advance fires `Success` but other step flows use `Light`** (cross-screen inconsistency: `generating-plan.tsx:72` uses Light for the same gesture)
4. **`LevelUpSheet.tsx:55-57` — Bespoke staggered Success+Medium+Medium pattern at 220/420ms** is not reused anywhere else; either standardize and apply elsewhere or simplify to single Success
5. **`GlassTabBar.tsx:244` — Tab switch fires `Light`** — debatable; many iOS apps suppress tab haptics entirely

### Top 8 gaps (haptics that should fire but don't)

| # | Where | Recommended haptic |
|---|---|---|
| G1 | Home Today's Plan: tap "+" to log meal | `Light` on press, `Success` on confirmation |
| G2 | Fuel ring tap-to-toggle (Fuel↔MES) | `selectionAsync()` (picker semantics) |
| G3 | Tier-up moment (e.g. score 89 → 90) | `Notification.Success` (auto-fire on threshold cross, not just LevelUpSheet open) |
| G4 | Coach send button | `Light` already covered ✓ (no gap — included for completeness) |
| G5 | Save/bookmark recipe | `Light` (or Success on toggle confirmation) |
| G6 | Pull-to-refresh trigger | `Impact.Medium` on pull-release |
| G7 | Modal swipe-down dismiss | `selectionAsync()` or `Light` |
| G8 | Cook final step "Done" button | `Success` distinct from intermediate `Light` |

### Top 3 wins (existing patterns to keep)

1. **Scan tab consistently uses `Success` for meal completion** — `scan:418, 510, 535, 574` all fire on meaningful logs. Pattern to spread to Home meal-log flow.
2. **`selectionAsync()` correctly used for picker-like gestures** — `TriStateProteinSelector:63`, cook timer chip selection. Apply to Fuel ring toggle and segmented controls.
3. **Onboarding's Light-for-options + Success-for-commitments hierarchy** — `commitment.tsx:60` (Success commit) vs `goal-context.tsx:193` (Light option). Maintain throughout app.

### Consistency table — same-gesture-different-feel anti-patterns

| Gesture | Fires Light at | Fires Success at | Recommended |
|---|---|---|---|
| Step advance | `generating-plan:72` | `cook/[id]:464` | **Light** for intermediate, **Success** only for final step |
| Favorite toggle | `scan:527` (unfavorite) | `scan:535` (favorite) | Both **Light** (it's a toggle, not a celebration) |
| Victory moment | (none) | `CookCompleteModal:53`, `LevelUpSheet:55-57` (staggered), `commitment:60` | Single **Success** everywhere; remove staggered pattern |

---

## Prioritized action list

### P0 — Critical
1. **Tab bar transition animation** — implement content slide + indicator slide on tab switch. Currently zero motion; users get no feedback that navigation happened. (`components/GlassTabBar.tsx` + tab Stack config)
2. **Cook celebration animations** — slide-up card from bottom (300ms ease-out, 1.1 spring overshoot) + checkmark stroke-dashoffset draw (400ms) + "+50 XP" scale bounce (`0 → 1.2 → 1.0` over 600ms). (`components/CookCompleteModal.tsx`)
3. **Add haptic to meal-log gesture on Home** (Gap G1 — meaningful daily action with no feedback today)
4. **Fix paywall purchase haptic** Medium → Heavy (`paywall.tsx:210`)
5. **Fix live-scan demo result haptic** Warning → Success (`live-scan.tsx:90`)

### P1 — High
6. Cold launch splash → login cross-fade (400ms) + logo subtle scale animation during splash
7. Settings modal slide-up + backdrop fade-in (250ms) with dismiss gesture cue
8. Strengthen ring toggle spring easing: drop tension 180→100, friction 10→7, total ~400ms with visible overshoot (`FuelScoreRing.tsx:122-131`)
9. Add ring-toggle haptic on Fuel↔MES tap (Gap G2 — `FuelScoreRing.tsx`)
10. Standardize cook step haptics: Light for intermediate, Success for final (Issue 3)
11. Standardize victory pattern: single Success everywhere; drop staggered Medium from `LevelUpSheet`
12. Make favorite toggle symmetric (both Light)
13. **Introduce `frontend/utils/feedback.ts`** semantic helpers (see infra section below) — refactor 38 sites + ~10 missing-haptic spots through it

### P2 — Medium
14. Define Coach spinner pulse timing explicitly (600-800ms loop, 200ms dot offset)
15. Recipe card mount fade-in + scale (0.95→1, 250ms ease-out) when Healthify response completes
16. Add pull-to-refresh haptic (G6)
17. Add modal dismiss haptic (G7)
18. Add cook final-step `Success` (G8)
19. Add bookmark/save-recipe haptic (G5)
20. Animated button label change "Next" → "Done" on final cook step (150ms opacity crossfade)
21. Staggered fade-in for cook step instructions (150ms per line)

### P3 — Low
22. Reconsider tab-bar haptic (Issue 5) — remove or change to selection
23. Auto-trigger tier-up haptic on score threshold cross (G3)
24. Document the haptic hierarchy in a `MOTION_HAPTIC_GUIDE.md` for new contributors
25. Add subtle backdrop blur when Coach response is streaming (visual focus on response)

### Recommended infra change (P1)
Create `frontend/utils/feedback.ts` with semantic helpers:
```ts
export const Feedback = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  select: () => Haptics.selectionAsync(),
  commit: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  purchase: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  celebrate: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
```
Then refactor the 38 sites to use these. Inconsistency goes to ~zero by construction.

---

## What pass 7 should capture

- **R04 + R08 deferred captures**: provision a fresh `pass7tester` account, capture meal-log animation (Today's Plan + button → checkmark + Today's Fuel ring update) AND first-meal-of-day score-up (ring fills from 0 → 100 with empty-state slate color transitioning to brand green)
- **Reduce-motion verification**: enable iOS "Reduce Motion" accessibility setting, re-capture R03 (ring toggle), R05 (celebration), R07 (modal). Confirm `isReduceMotionEnabled()` checks in `useAnimations` hook actually disable the right pieces.
- **Animations under load**: scroll Home with 30+ meal-history items; check whether macro rings on Today's Fuel still hit 60fps or jank
- **Sound design** — currently zero audio in the app; should at least be considered for cook celebration / first meal of day
- **Implementation** of pass-6 P0/P1 list (separate session, similar to F1–F17 implementation that followed pass 5)

---

## Methodology note

Pass 6 used three new techniques over pass 5:
1. **`xcrun simctl io booted recordVideo --codec h264`** for ~3-30s clips, killed via SIGINT on Maestro flow completion
2. **`ffmpeg -y -ss <t> -i <vid> -frames:v 1 -vf scale=600:-1 <out>.png`** to extract 5 keyframes per video at 5/25/50/75/95% of duration — keeps each frame ~200-320 KB so subagents can read all 5 without "photo too large" failures
3. **Static analysis of haptic call-sites in parallel** — the haptics inventory subagent ran in the background while I captured videos, reporting back ~2k words of findings without main-context image bloat

These should become the standard rig for any future motion + tactile audits. Pattern logged to [tasks/lessons.md](lessons.md).

---

## Outstanding from pass 5 implementation

Three items deferred from the post-pass-5 implementation session and still open:
- **F13** — Verify whether Today's Plan empty state still exists for new accounts (account state question, needs fresh account capture)
- **F16** — Cook tip "Was this helpful?" feedback — needs a new backend endpoint (no `/api/feedback` route exists)
- **F17** — animations — **superseded by pass 6's findings**; the granular animations called out in pass-5 plan are now folded into pass-6's broader audit

The XP-sync `useFocusEffect` from F-new should be visually re-verified at the next sim session — server XP was 340 at the start of pass 6, after this session's cook + Coach + log activity it's likely higher.
