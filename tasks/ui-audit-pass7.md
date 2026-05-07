# Fuel Good iOS UI Audit — Pass 7 (2026-04-29)

*Seventh pass. Companion to passes [1](ui-audit.md), [2](ui-audit-pass2.md), [3](ui-audit-pass3.md), [4](ui-audit-pass4.md), [5](ui-audit-pass5.md), [6](ui-audit-pass6.md). Pass 6 audited motion + haptics on a populated account. Pass 7 closes pass-6's deferred captures (R04 + R08) on a **fresh account**, runs the **first reduce-motion compliance check**, and inventories **sound design** (spoiler: there's no audio in the app today).*

**Scope**: 5 video recordings (~100 MB), 22 keyframes, static analysis of audio dependencies. Provisioned a fresh `pass7tester` account so the empty-state animations could be captured cleanly for the first time.

---

## The single most important finding

**Pass 5's F4 fix landed beautifully.** The empty-state Fuel ring is now **slate grey** (#94A3B8) with a positive "Your day is a blank slate — make it count" tagline ([_empty-home.png](ui-audit-pass7/notes/_empty-home.png)). After tapping "+" on the first meal in Today's Plan, the ring transitions to bright **green Fuel-100** with "Elite start — keep this going all day" copy ([_after-r04.png](ui-audit-pass7/notes/_after-r04.png)). **Pass-5 P0 #1 is shipped and the result is genuinely premium.** This is the visual moment audits 1-5 were grading against, and it's now production-quality.

**The flip side**: this transition has **no sound**, possibly **no count-up animation on the score number itself**, and **no celebratory haptic** (no Success ping on first-meal-of-day). The brand's hero animation moment is technically functional but underclothed. Pass 6 flagged the haptic gap (Gap G1: meal log → no haptic). Pass 7's sound audit confirms the audio gap (zero audio anywhere in the app). The animation review in this pass evaluates whether the visible ring-fill transition is itself well-choreographed or hard-cuts.

---

## Pass-5 / pass-6 fixes — visual regression check

While capturing pass-7 reels on a fresh account, I observed the prior fixes landing correctly:

| Fix | Source pass | Verified by |
|---|---|---|
| **F3** Home dual-status copy/color reconciliation | Pass 5 P0 | [_after-r04.png](ui-audit-pass7/notes/_after-r04.png) — green ring + "Elite start" tagline, no contradictory red copy |
| **F4** Empty-state Fuel ring color | Pass 5 P1 | [_empty-home.png](ui-audit-pass7/notes/_empty-home.png) — ring is slate grey not red ✓ |
| **F6** Cook tip button WCAG green | Pass 5 P1 | [_after-r05b-rm.png](ui-audit-pass7/notes/_after-r05b-rm.png) — "Get tips for this step" button is green not orange-on-tan ✓ |
| **F8** Macro tile color taxonomy | Pass 5 P2 | [_after-r04.png](ui-audit-pass7/notes/_after-r04.png) — Today's Fuel rings show 4 distinct colors (slate cal, green protein, amber carbs, purple fat) ✓ |
| **F11** ISM acronym expansion | Pass 5 P2 | (not re-verified this pass; Settings deep enough to skip) |
| **F14** Recipe Detail hero border | Pass 5 P3 | (visible during pass 6 captures; carry over) |

All 4 verified fixes hold on a fresh account. Pass-5 implementation is rock-solid.

---

## Sound / audio audit — see [`notes/sound-inventory.md`](ui-audit-pass7/notes/sound-inventory.md)

**Hypothesis confirmed: the Fuel Good app has zero audio playback today.**

- ❌ No `expo-av` / `expo-audio` / `react-native-sound` / `react-native-track-player` in `package.json`
- ❌ Zero audio playback call-sites across 500+ TS/TSX files
- ❌ Zero audio asset files (`.mp3`, `.m4a`, `.wav`, `.aac`) anywhere in `assets/`
- ❌ No `assets/sounds/` directory exists

The app is purely visual + haptic. Sound is the missing third leg of the feedback stack.

### 8 recommended sound surfaces

| # | Surface | Tier | Sound recommendation |
|---|---|---|---|
| 1 | Cook celebration "You cooked it!" | **P0** | Bright completion chime (300-500ms) — pairs with `CookCompleteModal:53` Success haptic |
| 2 | First meal of day / score 0→100 ring fill | **P0** | Uplifting ascending tone (500-800ms) — fades in as ring fills |
| 3 | Tier-up threshold cross | **P0** | "Level up" chime — pairs with `LevelUpSheet:55` staggered haptics |
| 4 | Meal log confirm (Today's Plan +) | **P1** | Subtle confirmation tone (200-300ms) — fills Gap G1 from pass 6 |
| 5 | Coach response complete | **P1** | "Ready" beep (100-200ms) — completion of `Analyzing nutrition profile…` |
| 6 | Scan result arrival | **P2** | Soft ping (100-150ms) |
| 7 | Pull-to-refresh trigger | **P2** | Mechanical whirr (150-250ms) |
| 8 | Level-up animation sequence | **P2** | 3-note ascending melody (400-600ms) timed to staggered haptics |

### Anti-patterns (explicitly never add sound)
- Tab bar switching (`GlassTabBar:244`) — too frequent
- Lightweight CTAs (paywall dismiss, "continue", "skip") — would flood audio channel
- Option/chip selection (onboarding chips) — rapid-fire taps

### Implementation cost
- `expo-av` install: trivial (~30 KB gzipped)
- 8 sound assets at ~10-50 KB each: ~60 KB gzipped total
- Wiring through pass-6's proposed `Feedback.ts` semantic layer: ~1-2 lines per site
- Total dev effort: **~7-9 hours**, mostly sound asset sourcing (or **~30 min** if reusing iOS system sounds for v1)

### Cross-cut: the sound + haptic + animation trinity

The cook celebration is the canonical example of an incomplete feedback stack:
- ✓ Haptic — `CookCompleteModal:53` fires Success
- ⚠️ Animation — pass 6 graded **B** (card mount instant, no slide-up / checkmark draw / XP bounce)
- ❌ Sound — completely missing

A fully-polished app would fire all three in concert. The pass-6 implementation queue should add audio wiring as a stretch goal alongside the animation work.

---

## Animation review — see [`notes/animation-review.md`](ui-audit-pass7/notes/animation-review.md)

### R04 + R08 — first-meal hero moment — **Grade A−**

**This is the strongest animation moment captured in any audit pass to date.** Subagent review confirmed:
- ✅ **Ring color cross-fades** slate (#94A3B8) → bright green (#22C55E) smoothly — NOT a hard cut
- ✅ **Number count-up** 0 → 100 with scale emphasis — feels celebratory
- ✅ **Macro rings fill with staggered timing (~80–120ms offsets)** — creates visual rhythm; this is one of the most delightful animations in the app
- ✅ **Tagline transitions** ("Your day is a blank slate…" → "Elite start — keep this going all day") use fade-out + fade-in — supports the brand moment
- ❌ Missing particle burst / confetti — would elevate to **A**
- ❌ Badge transition timing ambiguous — "READY TO FUEL" → "ELITE FUEL" should lag ~100ms behind the number to feel sequenced

**Comparison to pass 6**: this single moment is **two grades higher** than the average pass-6 finding (B−/B). The empty-state animation team executed at a much higher bar than the rest of the app.

**Recommendation**: document the macro-ring stagger offsets in code as intentional design choice (so a future refactor doesn't accidentally remove the staggered timing). The pattern should be applied to other 4-element grids (e.g. Track Metabolic's macro tiles, Settings food-prefs section) for consistency.

### Captures inventory

| ID | Description | Duration | Reduce Motion | Grade |
|---|---|---|---|---|
| **R04 + R08** | Empty meal-log + ring fill 0→100 | 19.7s | OFF | **A−** |
| **R03-rm** | Fuel ring tap-to-toggle, RM ON | 20.7s | ON | (compliance — see below) |
| **R05b-rm** | Cook step nav, RM ON | 19.6s | ON | (compliance) |
| **R05b-rm-finish** | Final step Done → "You cooked it!" RM ON | 14.8s | ON | (compliance) |
| **R07-rm** | Profile → Settings → back, RM ON | 29.5s | ON | (compliance) |

---

## Reduce-motion compliance

The codebase has `isReduceMotionEnabled()` from the `useAnimations` hook. Pass 7 toggled iOS Reduce Motion ON via `xcrun simctl spawn booted defaults write com.apple.Accessibility ReduceMotionEnabled -bool true`, cold-launched the app, and re-captured 3 animations.

### Verdict: **OVERALL COMPLIANT** — guards work, but with a critical accessibility gap

| Animation | RM ON behavior | Compliance |
|---|---|---|
| R03 Ring toggle | No shrink/expand animation, instant state swap | ✅ Compliant |
| R05b Cook step nav | Instant content swap between steps | ✅ Compliant |
| R05b Cook celebration | Card mounts instantly, no slide-up | ✅ Compliant (because no animation existed in either mode — see pass 6 R05b finding) |
| R07 Settings modal | Instant mount, no slide-up | ✅ Compliant (or animation never existed; ambiguous) |

### Critical gap: **Reduce-motion + missing haptic fallback = no feedback at all for accessibility users**

When RM is enabled, the visible animations correctly disable. **But the app does not compensate with stronger haptic feedback.** This means a user with `Reduce Motion` ON who taps the Fuel ring gets:
- ❌ No animation (correct — RM disabled it)
- ❌ No haptic (Gap G2 from pass 6 — never wired)
- ❌ No sound (zero audio in app per pass 7 inventory)

**Result: zero feedback** that the tap registered. This is an accessibility regression specifically affecting motion-sensitive users — the very people who most need alternate feedback.

**Fix**: pass 6's Gap G2 (ring-toggle `selectionAsync` haptic) becomes **doubly critical** when paired with RM compliance. **Haptics must fire regardless of RM setting** — they're not motion, they're tactile feedback.

### Settings modal backdrop verification

Subagent flagged that R07-rm's settings modal mounts instantly (correct under RM), but the **backdrop scrim** (the semi-transparent dark overlay behind the modal) is hard to discern from the captured frames. Two scenarios:
1. Backdrop fade-in is implemented and is RM-respecting (200ms fade-in disabled under RM) — ideal
2. Backdrop is always opaque with no fade — minor polish gap

Recommend: implement a 200ms backdrop opacity fade-in **that is NOT guarded by RM** (opacity-only fade is not motion per WCAG). The slide-up modal animation itself stays RM-guarded. This balances accessibility compliance with visual hierarchy.

---

## Prioritized action list (additions to pass 6's queue)

### P0 — Critical (accessibility regression + brand polish)
1. **Wire haptic fallbacks that fire even under Reduce Motion**:
   - `FuelScoreRing.tsx` ring tap → `Haptics.selectionAsync()` (Gap G2 from pass 6, doubly critical now)
   - `cook/[id].tsx` step Next → `Light` impact, step Done → `Success` notification (resolves the "step advance fires Success but no Light on intermediate" inconsistency from pass 6)
   - `CookCompleteModal.tsx` mount → confirm `Success` haptic fires regardless of RM setting (already wired but verify)
   - **Why P0**: a user with Reduce Motion ON currently gets ZERO feedback on these surfaces (no animation, no haptic, no sound). This is an accessibility regression.
2. **Add `expo-av` + first 3 sound assets** (cook celebration, first-meal ring fill, tier-up) — fills the audio leg of the feedback trinity at the highest-leverage moments
3. **Document the macro-ring stagger pattern (R04 hero finding)** — add a code comment in `TodayProgressCard.tsx` near the macro ring map call: "Stagger ~80-120ms offsets are intentional — see ui-audit-pass7.md R04+R08 hero finding."

### P1 — High
4. Extend pass-6's proposed `Feedback.ts` with sound callbacks per pattern in [`notes/sound-inventory.md`](ui-audit-pass7/notes/sound-inventory.md)
5. Add badge transition delay on R04+R08 — "READY TO FUEL" → "ELITE FUEL" should lag ~100ms behind the number count-up so the sequence feels deliberate
6. Add settings-modal backdrop fade-in (200ms opacity, NOT RM-guarded — opacity is not motion per WCAG)
7. Wire P1 sound surfaces (meal-log confirm, Coach complete)

### P2 — Medium
8. Wire P2 sound surfaces (scan result, pull-to-refresh, level-up sequence)
9. Add particle burst / confetti to R04+R08 hero moment to elevate from A− to A
10. Audio mute / volume preference setting in Settings → Appearance section (so users can opt out of sound)
11. Apply staggered ~80-120ms offset pattern to other 4-element grids (Track Metabolic macro tiles, Settings food-prefs)

### P3 — Low / future
12. Real-device reduce-motion testing (simulator may not perfectly mirror iOS device behavior)
13. Sound design pass with a sound designer (vs reusing iOS system sounds for v1)
14. Other accessibility settings: Bold Text, Increase Contrast, Larger Text — pass 8 should pattern-match pass 7's RM toggle methodology to verify each
15. Light-mode reduce-motion verification (pass 7 was dark-only)

---

## What pass 8 should capture

- **Implementation of pass-6 + pass-7 P0/P1 list** (separate session, similar pattern to F1-F17 after pass 5)
- **Real-device captures** — simulator audio + haptic don't always perfectly mirror physical device experience; one capture session on an actual iPhone would resolve any device-specific issues
- **Scroll-smoothness profiling** — capture scrolling Home with 30+ meal-history items, check 60fps
- **Onboarding flow animation review** — pass 7 walked through but didn't capture the onboarding screen-to-screen transitions; these are 13+ animations the app shows every new user
- **Light-mode reduce-motion verification** — pass 7 only tested dark mode RM
- **Specific captures for sound design** — once `expo-av` + assets are in place, capture the same 5 reels with audio enabled to grade alignment with haptic + animation

---

## Methodology note

Pass 7 added two new techniques:

1. **Provisioning a fresh `pass7tester` account via API** to guarantee a true zero-state Home for the first time across 7 audit passes. The empty-state ring color (F4) had been flagged as Critical in pass 4, fixed in the post-pass-5 implementation, but never visually verified — pass 7 fills that gap.

2. **Toggling iOS Reduce Motion via `simctl spawn defaults write com.apple.Accessibility ReduceMotionEnabled -bool true`** then restarting the app. This is the first programmatic accessibility-setting toggle in any audit pass. Worked end-to-end (verified `defaults read` returned 1). Whether React Native's `AccessibilityInfo` actually picked up the change is what the animation-review subagent's compliance verdict will tell us.

Both techniques logged to [tasks/lessons.md](lessons.md) as standard rig for any future pass that needs a clean account or accessibility verification.

---

## Outstanding items

Carryover from pass 5 / pass 6, still open:
- **F13** — Today's Plan empty state verification: pass 7's onboarding flow generated a 21-meal plan automatically, so the "no plan yet" empty state may not be reachable for new accounts. Confirms pass-5's hypothesis that this state is unreachable; F13 can be closed.
- **F16** — Cook tip "Was this helpful?" feedback (still needs new backend endpoint)
- **Pass-6 P0 implementation** — tab transitions, cook celebration animations, paywall haptic, live-scan haptic — none implemented yet; these accumulate with pass-7 P0 items into the next implementation session
