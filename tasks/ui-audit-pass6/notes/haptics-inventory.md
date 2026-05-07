# Haptics Inventory & Audit (Pass 6)

## Summary
- **Total call-sites**: 38 (not 57 as initially estimated)
- **Distribution by screen**: Onboarding: 17, Scan: 6, Cook: 3, Chat: 1, Components: 11
- **Distribution by intensity**: 
  - Light Impact: 16 sites (42%)
  - Medium Impact: 9 sites (24%)
  - Notification.Success: 10 sites (26%)
  - Notification.Warning: 1 site (3%)
  - Selection: 2 sites (5%)

---

## Inventory by Screen

### Onboarding (17 sites)

| File:line | Trigger | Intensity | Verdict |
|-----------|---------|-----------|---------|
| goal-context.tsx:193 | Age range chip tap | Light | fine |
| goal-context.tsx:211 | Sex toggle (Male) | Light | fine |
| goal-context.tsx:223 | Sex toggle (Female/other) | Light | fine |
| paywall.tsx:210 | Purchase button press | Medium | **wrong-intensity** (should be Heavy for financial action) |
| paywall.tsx:231 | Restore purchases button | Light | fine |
| paywall.tsx:249 | Dismiss paywall button | Light | fine |
| generating-plan.tsx:72 | Plan generation step animation (per-step) | Light | fine |
| generating-plan.tsx:92 | Plan generation complete → nav to paywall | Success | fine |
| live-scan.tsx:65 | Start scan button | Medium | fine |
| live-scan.tsx:90 | Scan result (demo scan) | Warning | **questionable** (Warning for a demo result feels odd; should be Success) |
| notification-permission.tsx:48 | Enable notifications button | Medium | fine |
| notification-permission.tsx:60 | Skip notifications button | Light | fine |
| commitment.tsx:60 | Commit button press | Success | fine |
| commitment.tsx:67 | "Not yet" recovery button | Light | fine |
| commitment.tsx:75 | Objection response selection | Light | fine |
| commitment.tsx:86 | "See options" button → generating-plan | Medium | fine |
| video-hook.tsx:234 | Continue button after video loop | Medium | fine |
| onboarding.tsx:631 | Continue/next step in legacy onboarding | Light | fine |
| onboarding.tsx:1386 | Commit choice selection (commitment modal) | Success | fine |

**Onboarding verdict**: 16/18 sites are correct. 2 issues:
1. **paywall.tsx:210** - Purchase should fire `Heavy` (significant financial commitment), not Medium.
2. **live-scan.tsx:90** - Demo scan result fires `Warning` instead of `Success`—confusing UX, should be Success.

---

### Scan (6 sites)

| File:line | Trigger | Intensity | Verdict |
|-----------|---------|-----------|---------|
| index.tsx:418 | Scan result arrives (meal/product scanned) | Success | fine |
| index.tsx:510 | Re-log meal from history | Success | fine |
| index.tsx:527 | Remove favorite (unfavorite) | Light | fine |
| index.tsx:535 | Add to favorites (favorite) | Success | fine |
| index.tsx:574 | Log favorite meal | Success | fine |
| index.tsx:2366 | Compare & Scan Next button (product compare flow) | Light | fine |

**Scan verdict**: 6/6 sites correct. Well-executed; notification.Success on meaningful meal logging, Light on toggles.

---

### Cook (3 sites)

| File:line | Trigger | Intensity | Verdict |
|-----------|---------|-----------|---------|
| [id].tsx:395 | Cook timer countdown reaches 0 | Success | fine |
| [id].tsx:464 | Step advance (moving to next cook step) | Success | **inconsistent** — only fires on *advance*, not on every step start; inconsistent with per-step Light in generating-plan.tsx:72 |
| [id].tsx:685 | Timer chip selection (start timer) | Selection | fine |

**Cook verdict**: 2/3 sites fine, 1 consistency issue.
- Cook step advance fires **Success** (feels right—completing a step earns progress).
- But **no Light impact on step initial load** or step "done" button (final step should feel more ceremonial than intermediate steps).

---

### Chat (1 site)

| File:line | Trigger | Intensity | Verdict |
|-----------|---------|-----------|---------|
| index.tsx:130 | Coach message send button | Light | fine |

**Chat verdict**: 1/1 correct. Coach prompts are lightweight interactions.

---

### Components (11 sites)

| File:line | Trigger | Intensity | Verdict |
|-----------|---------|-----------|---------|
| CookCompleteModal.tsx:53 | Cook complete modal appears (celebration) | Success | fine |
| LevelUpSheet.tsx:55 | Level-up sheet visible (tier advance) | Success + 2x Medium (220ms, 420ms) | **creative** — adds rhythmic Medium taps for celebration effect; works but non-standard pattern |
| LevelUpSheet.tsx:56 | (staggered Medium impact) | Medium | (see above) |
| LevelUpSheet.tsx:57 | (staggered Medium impact) | Medium | (see above) |
| TriStateProteinSelector.tsx:63 | Protein preference tri-state toggle | Selection | fine |
| GlassTabBar.tsx:147 | Plus button (add menu) toggle | Light | fine |
| GlassTabBar.tsx:244 | Tab bar navigation (tab switch) | Light | **questionable** — Light on tab switch is reasonable, but should perhaps be Selection (picker semantics) or nothing. Inconsistent with mobile UX norms (many apps suppress tab-bar haptics). |
| onboarding-v2/OptionCard.tsx:55 | Onboarding option card selection | Light | fine |

**Components verdict**: 10/11 correct. 1 minor inconsistency:
- **GlassTabBar.tsx:244** — Light on tab switch is OK but arguably over-haptic. Tab switches are like picker changes; some apps use Selection, many use nothing.

---

## Top Issues

### 1. Paywall Purchase Fires Medium, Should Fire Heavy
- **Where**: app/onboarding-v2/paywall.tsx:210 (`handlePurchase`)
- **Problem**: A financial commitment (trial or subscription purchase) is a *significant* action. Apple HIG recommends `Heavy` for destructive or high-consequence actions; financial transactions are high-consequence.
- **Fix**: Change `Haptics.ImpactFeedbackStyle.Medium` → `Haptics.ImpactFeedbackStyle.Heavy` at paywall.tsx:210.
- **Impact**: Elevates haptic salience to match the stakes of the action.

### 2. Live-Scan Demo Result Fires Warning, Should Fire Success
- **Where**: app/onboarding-v2/live-scan.tsx:90 (`showResult`)
- **Problem**: The demo scan shows a completed scan result (success state). `Warning` is wrong semantics—it implies caution or risk. A successful scan should feel celebratory (Success).
- **Fix**: Change `Haptics.NotificationFeedbackType.Warning` → `Haptics.NotificationFeedbackType.Success` at live-scan.tsx:90.
- **Impact**: Aligns haptic meaning with the actual outcome; removes confusing negative-valence feedback on a positive action.

### 3. Cook Step Advance Fires Success, But Initial Step Load is Silent
- **Where**: app/cook/[id].tsx:464 (`onStepChange` — advance only)
- **Problem**: Advancing to the next step fires `Success`, but *loading the initial step* when entering the recipe is silent. First step deserves haptic feedback too. Also, intermediate steps (advancing forward) feel like `Success` (which implies completion), but advancing backward doesn't fire anything.
- **Fix**: 
  - Add Light Impact on initial step load (when recipe first mounts and sets step 0).
  - Consider removing Success from forward advance and using Light instead (Success should be reserved for true completion—final step or cook complete).
- **Impact**: More consistent and lighter step transitions; reserves Success for actual completion moments.

### 4. Level-Up Celebration Uses Staggered Medium (Non-Standard Pattern)
- **Where**: components/LevelUpSheet.tsx:55, 56, 57 (Success + 2x Medium at 220ms, 420ms)
- **Problem**: The haptic pattern is creative (3-tap rhythm: Success → pause → Medium → pause → Medium), but it's a bespoke non-standard pattern. Not documented in the codebase; other victory moments (CookCompleteModal, commitment success) just use single Success. Inconsistent visual language.
- **Fix**: Standardize to single `Success` notification, like other completion moments. If a celebration pattern is desired, document it and apply it everywhere (or remove it).
- **Impact**: Consistency across victory moments; easier to maintain.

### 5. Tab Bar Switch Fires Light (Debatable)
- **Where**: components/GlassTabBar.tsx:244 (`onPress` for tab switch)
- **Problem**: Tab switches fire `Light` Impact. Many apps fire nothing (tabs are fast navigation, not commits). Some apps use `Selection`. This breaks the mental model: in picker/segmented-control patterns, Selection makes sense; in tab bar, lighter or nothing is more standard.
- **Fix**: Either (a) remove the haptic, or (b) change to `Haptics.selectionAsync()` if it must fire. Document the choice.
- **Impact**: Reduces haptic noise and aligns with platform conventions (most iOS apps suppress tab bar haptics).

---

## Top Gaps (Haptics That Should Fire But Don't)

### G1. Home Screen: Adding Meal from Plan
- **Where**: `(tabs)/home` or `(tabs)/plan` (search for "+ Add meal" / "log meal" button)
- **Recommended haptic**: `Impact.Light` (on press) or `Notification.Success` (on successful log with confirmation)
- **Justification**: Logging a meal is a meaningful daily action; Light on tap confirms the press; Success on completion celebrates the log.
- **Status**: **NOT FOUND** — No haptic in meal-add flows.

### G2. Fuel Score Ring: Tap-to-Toggle Fuel ↔ MES
- **Where**: `components/FuelScoreRing.tsx` (if it exists) or home-screen ring component
- **Recommended haptic**: `selectionAsync()` (toggling between two modes is a picker-like gesture)
- **Justification**: Toggling between Fuel and MES is a state-change picker gesture.
- **Status**: **NOT FOUND** — No toggle haptic inventory found.

### G3. Tier-Up Threshold Crossing
- **Where**: Anywhere Fuel score crosses a tier boundary (e.g., 89 → 90, Decent → Strong)
- **Recommended haptic**: `Notification.Success` (tier advance is a major milestone)
- **Justification**: Tier advance is rarer and more significant than step completion; should feel celebratory.
- **Status**: **PARTIALLY COVERED** — LevelUpSheet.tsx has Success + staggered Medium on level-up, but no auto-trigger on *score update*. If tier-up is only surfaced in a sheet, it's covered (and over-haptic with staggered pattern).

### G4. Coach Send Button
- **Where**: `app/(tabs)/chat/index.tsx` (Coach prompt send button)
- **Recommended haptic**: `Impact.Light` (already present at line 130 ✓)
- **Justification**: Coach is a passive read interface, send is a lightweight action.
- **Status**: **COVERED** ✓

### G5. Save/Bookmark Recipe
- **Where**: Cook recipe screen (save recipe / add to favorites button)
- **Recommended haptic**: `Impact.Light` (or `Notification.Success` if it's a toggle with confirmation)
- **Justification**: Favoriting is a lightweight preference change.
- **Status**: **NOT FOUND** — No recipe save/bookmark haptic in cook/[id].tsx inventory.

### G6. Pull-to-Refresh Trigger
- **Where**: Home screen, Scan screen, or any RefreshControl
- **Recommended haptic**: `Impact.Medium` on pull-release (when refresh starts)
- **Justification**: Pull-to-refresh is a significant gesture; Medium impact confirms trigger.
- **Status**: **NOT FOUND** — No RefreshControl haptic in scan/index.tsx or home screen.

### G7. Modal Dismiss (Swipe-Down)
- **Where**: Any modal with swipe-down dismiss
- **Recommended haptic**: `selectionAsync()` or `Impact.Light` (on dismiss completion)
- **Justification**: Modal close is a state-change gesture; Light or Selection confirms.
- **Status**: **NOT FOUND** — No dismiss gesture haptic found.

### G8. Final Cook Step Completion
- **Where**: app/cook/[id].tsx (when user advances past final step, or taps "Done" on final step)
- **Recommended haptic**: `Notification.Success` (distinct from intermediate steps)
- **Justification**: Final step completion is more significant than intermediate steps; should feel celebratory (Success), not just Light.
- **Status**: **PARTIALLY COVERED** — Cook advance fires Success (line 464), which applies to final step advance too. But there's no explicit "Done button" haptic or final-step distinction.

---

## Consistency Table

Moments that fire **different intensities** for semantically similar gestures (the "same button, different feel" anti-pattern):

| Gesture / Context | Sites Firing Light | Sites Firing Medium | Sites Firing Success | Recommended |
|---|---|---|---|---|
| **Chip / Option selection** | goal-context:193, 211, 223; OptionCard:55 | — | — | Light (correct, consistent) |
| **Button navigation / CTA** | paywall:231, 249; commitment:67, 75; notification-perm:60; onboarding:631; OptionCard:55; chat:130; GlassTabBar:147, 244 | video-hook:234; live-scan:65; notification-perm:48; commitment:86; paywall:210; mirror:101 | — | **No clear standard** — Mix of Light (lighter CTAs) and Medium (heavier CTAs). Suggest: Light for "continue/skip", Medium for "enable/purchase". |
| **Toggle / State change (favorite, toggle-sex)** | scan:527 (unfavorite) | — | scan:535 (favorite) | **Inconsistent** — Favoriting should be symmetric. Both should fire Light or both Success. Recommend: Light for both (it's a toggle). |
| **Tab bar switch** | GlassTabBar:244 | — | — | Light or nothing (varies by app). Consider removal. |
| **Picker / Segmented control** | — | — | — | selectionAsync (TriStateProteinSelector:63 is correct; cook timer:685 is correct). |
| **Meal/result logging** | scan:2366 (compare button) | — | scan:418, 510, 535, 574 (logged/favorited) | **Success (correct)** — Meal logging is a meaningful action. Keep Success for logs. |
| **Step completion (cook/onboarding)** | generating-plan:72 (per-step Light) | — | cook:464 (per-step Success) | **Inconsistent** — Recommend: Light for intermediate steps (generating-plan is correct). Success only for final completion (cook final step, commit, etc.). |
| **Celebration / Victory** | — | LevelUpSheet:56, 57 (staggered Medium) | CookCompleteModal:53, LevelUpSheet:55, commitment:60, cook:395, onboarding:1386 | **Success only** (standardize). Remove staggered Medium pattern from LevelUpSheet. |
| **Timer completion** | — | — | cook:395 | **Success (correct)** — Timers are notable moments. |

**Key inconsistencies to fix**:
1. **Favorite toggle** (scan:527 vs. scan:535) — use Light for both.
2. **Step generation** (generating-plan:72 Light vs. cook:464 Success) — use Light for steps, Success only for final.
3. **Celebration pattern** (LevelUpSheet staggered Medium) — standardize to Success only.
4. **Purchase button** (paywall:210 Medium) — upgrade to Heavy.

---

## Top 3 Wins

### Win 1: Consistent Success on Meal Logging
The scan screen correctly fires `Notification.Success` on meaningful meal completions:
- Scan result arrives (scan:418)
- Re-log meal (scan:510)
- Log favorite (scan:574)
- Add to favorite (scan:535)

This is excellent UX—every significant meal interaction celebrates success. **Keep this pattern.**

### Win 2: Selection Haptics on Pickers
The codebase correctly uses `selectionAsync()` for state-change gestures:
- TriStateProteinSelector (tri-state protein toggle)
- Cook timer chip selection

This is semantically correct—pickers and toggles should feel different from button presses. **Keep this pattern; apply to tab bar if needed.**

### Win 3: Onboarding Flow Consistently Uses Light + Success
The onboarding flow is well-designed:
- Light on every navigation/chip tap (lightweight feedback)
- Success on major commitment moments (commitment.tsx:60, onboarding.tsx:1386)

This creates a clear hierarchy: options are Light, commitments are Success. **Maintain this throughout the app.**

---

## Recommendations (Priority Order)

1. **CRITICAL**: Fix paywall:210 Medium → Heavy (financial action).
2. **CRITICAL**: Fix live-scan:90 Warning → Success (confusing semantics).
3. **HIGH**: Standardize favorite toggle (scan:527, 535) to both Light OR both Success (currently asymmetric).
4. **HIGH**: Remove staggered Medium pattern from LevelUpSheet:56-57; use single Success like other victory moments.
5. **HIGH**: Clarify cook step haptics: Light for intermediate, Success for final step / completion.
6. **MEDIUM**: Add `Light` Impact on initial cook step load (first step when recipe mounts).
7. **MEDIUM**: Add haptics to Home/Plan meal-add flows (Light on press, Success on confirmation).
8. **MEDIUM**: Consider suppressing or changing tab bar haptic (GlassTabBar:244) — Light is non-standard.
9. **LOW**: Add pull-to-refresh haptic (Medium on release) if RefreshControl is used.
10. **LOW**: Add modal dismiss haptic (Selection or Light) if swipe-down dismiss is supported.

---

## Appendix: All 38 Call-Sites Inventory

```
1. app/(tabs)/chat/index.tsx:130 → Coach send → Light
2. app/scan/index.tsx:418 → Scan result → Success
3. app/scan/index.tsx:510 → Re-log meal → Success
4. app/scan/index.tsx:527 → Unfavorite → Light
5. app/scan/index.tsx:535 → Favorite → Success
6. app/scan/index.tsx:574 → Log favorite → Success
7. app/scan/index.tsx:2366 → Compare & Scan → Light
8. app/onboarding-v2/video-hook.tsx:234 → Continue → Medium
9. app/onboarding-v2/goal-context.tsx:193 → Age chip → Light
10. app/onboarding-v2/goal-context.tsx:211 → Sex toggle → Light
11. app/onboarding-v2/goal-context.tsx:223 → Sex toggle → Light
12. app/onboarding-v2/paywall.tsx:210 → Purchase [BUG] → Medium
13. app/onboarding-v2/paywall.tsx:231 → Restore → Light
14. app/onboarding-v2/paywall.tsx:249 → Dismiss → Light
15. app/onboarding-v2/generating-plan.tsx:72 → Plan step → Light
16. app/onboarding-v2/generating-plan.tsx:92 → Plan complete → Success
17. app/onboarding-v2/live-scan.tsx:65 → Start scan → Medium
18. app/onboarding-v2/live-scan.tsx:90 → Scan result [BUG] → Warning
19. app/onboarding-v2/notification-permission.tsx:48 → Enable notify → Medium
20. app/onboarding-v2/notification-permission.tsx:60 → Skip notify → Light
21. app/onboarding-v2/commitment.tsx:60 → Commit → Success
22. app/onboarding-v2/commitment.tsx:67 → Not yet → Light
23. app/onboarding-v2/commitment.tsx:75 → Objection → Light
24. app/onboarding-v2/commitment.tsx:86 → See options → Medium
25. app/onboarding-v2/mirror.tsx:101 → Continue → Medium
26. app/cook/[id].tsx:395 → Timer done → Success
27. app/cook/[id].tsx:464 → Step advance → Success
28. app/cook/[id].tsx:685 → Timer chip → Selection
29. app/(auth)/onboarding.tsx:631 → Continue → Light
30. app/(auth)/onboarding.tsx:1386 → Commit choice → Success
31. components/CookCompleteModal.tsx:53 → Complete modal → Success
32. components/LevelUpSheet.tsx:55 → Level up → Success
33. components/LevelUpSheet.tsx:56 → Level up (stagger 220ms) → Medium
34. components/LevelUpSheet.tsx:57 → Level up (stagger 420ms) → Medium
35. components/TriStateProteinSelector.tsx:63 → Tri-state toggle → Selection
36. components/GlassTabBar.tsx:147 → Plus menu toggle → Light
37. components/GlassTabBar.tsx:244 → Tab switch → Light
38. components/onboarding-v2/OptionCard.tsx:55 → Option card → Light
```

**END OF REPORT**
