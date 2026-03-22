# E2E Responsiveness & UI Audit Report

**Date:** 2026-03-22
**Devices Tested:**
- iPhone SE 3rd Gen (375x667pt @2x) — smallest iPhone
- iPhone 15 Pro (393x852pt @3x) — standard/medium
- iPhone 15 Pro Max (430x932pt @3x) — largest iPhone

**Modes:** Dark mode (SE, Pro) + Light mode (Pro Max)
**Test Users:** Alex (muscle gain), Sarah (fat loss), InsulinUser (metabolic reset/IR)

---

## Summary

| Device | Pass | Fail | Total Tests |
|--------|------|------|-------------|
| iPhone SE | 24 | 3 | 27 |
| iPhone 15 Pro | ~25 | 0 | ~25 |
| iPhone 15 Pro Max | 29 | 2 | 31 |
| **Total** | **~78** | **5** | **~83** |

---

## Issues Found (Sorted by Priority)

### P1 — Recipe Detail: Ingredients/Steps Inaccessible on iPhone SE
- **Device:** iPhone SE only
- **Screen:** Recipe detail (`/browse/[id]`)
- **Problem:** The hero image + title + description + stats row + sticky "Log This Meal" footer consume the entire 667pt viewport. Ingredients and cooking steps are unreachable. Users cannot actually cook from a recipe.
- **Root Cause:** ScrollView content sizing doesn't account for the SE's limited vertical space. The sticky footer consumes ~60pt of already-scarce space.
- **Fix:** Ensure the ScrollView `contentContainerStyle` has sufficient `paddingBottom` to account for the sticky footer height. On smaller screens, consider making the hero image collapsible or shorter by default.

### P1 — Chat API Error for Insulin-Resistant User
- **Device:** iPhone 15 Pro Max (likely all devices)
- **Screen:** Chat tab
- **Problem:** The Fuel Coach chat returns "Something went wrong" for the insulin-resistant user. Both initial send and retry failed.
- **Root Cause:** Likely a backend/API configuration issue — the chat endpoint may not handle users with IR-specific metabolic profiles correctly.
- **Fix:** Debug the chat API endpoint for IR users. Check if the metabolic profile data format causes an error when building the system prompt.

### P2 — Meals Browse: Recipe List Doesn't Scroll on iPhone SE
- **Device:** iPhone SE only
- **Screen:** Eat > Meals browse
- **Problem:** Shows "20 recipes found" but only the first 2 recipes (top row of the 2-column grid) are visible. The list does not scroll despite repeated attempts.
- **Root Cause:** FlatList/ScrollView frame height may not be calculated correctly for the SE's shorter screen, possibly conflicting with the filter bar or header.
- **Fix:** Audit the FlatList container height in the meals browse view. Ensure it uses `flex: 1` and isn't constrained by a fixed height that's too small for SE.

### P3 — Onboarding Placeholder Confusion
- **Device:** iPhone 15 Pro Max (likely all devices)
- **Screen:** Onboarding body info step (Weight, Height, Age)
- **Problem:** Placeholder values (e.g., "165" for weight) look identical to real entered values. Users may think fields are pre-filled and skip them, causing the Continue button to stay disabled with no visible error.
- **Fix:** Use lighter/italic/gray placeholder text. Add "Required" indicators or inline validation messages.

### P3 — Profile Achievements Tab Unresponsive on iPhone SE
- **Device:** iPhone SE
- **Screen:** Profile > Achievements tab
- **Problem:** Tapping the "Achievements" tab doesn't switch views. Possibly a touch target positioning issue on SE.
- **Fix:** Check tab touch targets are properly sized (min 44pt) and correctly positioned on smaller screens.

---

## What Passed (Highlights)

### Layout & Responsiveness
- Home screen renders correctly on all 3 screen sizes — hero card, day selector, meal plan, fuel stats all scale properly
- 2-column recipe grids work well on all sizes with no card overlap
- Eat hub card grid (4-6 cards) adapts cleanly to all widths
- Chrono tab toggle views (Fuel/Metabolic/Nutrients) render properly across all sizes
- Calendar heatmap is readable on even the smallest screen
- Tab bar properly positioned above home indicator safe area on all devices
- Profile stat cards (no orange borders) look clean on all sizes

### Light Mode (Pro Max)
- Good text contrast throughout — dark text on light backgrounds
- Card borders/shadows visible and appropriate
- Score ring colors (red/green) clear and distinguishable
- Toggle pill active states clearly differentiated
- Hero card gradient visible and clean

### Dark Mode (SE, Pro)
- Consistent dark theme across all screens
- No contrast issues with text or icons
- Score badges (green, red) are readable against dark backgrounds

### Insulin-Resistant User Experience
- Onboarding IR toggle works
- Carb ceiling correctly adjusted (90g vs ~130g standard)
- "Metabolic sensitivity adjusted" label shown in targets
- MES scoring with IR thresholds working
- "Net carbs - metabolic" tracking label appears
- Full meal logging flow works end-to-end

### Interactions
- Full meal logging flow works: Browse > Detail > Log > Success modal > View in Chrono
- Plus button action sheet shows all 4 options correctly on all sizes
- Navigation between tabs works consistently
- Back navigation works from recipe detail
- Keyboard behavior in Chat is proper — input stays visible

---

## Action Plan

### Phase 1: P1 Fixes (Critical)
1. **Fix recipe detail scroll on SE** — Add proper `paddingBottom` to ScrollView content that accounts for sticky footer height. Consider reducing hero image height on smaller screens.
2. **Fix chat API for IR users** — Debug the chat backend endpoint to handle insulin-resistant metabolic profiles.

### Phase 2: P2 Fixes (Important)
3. **Fix meals browse scroll on SE** — Audit FlatList container layout to ensure proper scrolling on 667pt screens.

### Phase 3: P3 Fixes (Nice-to-have)
4. **Improve onboarding placeholder styling** — Use distinct placeholder text styling (lighter color, italic) to differentiate from entered values.
5. **Fix achievements tab touch target on SE** — Ensure tab buttons meet 44pt minimum touch targets.
