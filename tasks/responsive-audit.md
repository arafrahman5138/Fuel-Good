# Responsive UX Audit Report - Fuel Good App

**Date:** 2026-04-01
**Devices Tested:** iPhone SE 3rd gen (375x667pt), iPhone 17 Pro (402x874pt), iPhone 17 Pro Max (430x932pt)
**Method:** Simulator screenshots + code review

---

## Severity Scale
- **P0 (Critical)**: Unusable - content hidden, buttons unreachable
- **P1 (Major)**: Functionality impaired - overlaps obscure info, truncation hides key data
- **P2 (Minor)**: Cosmetic - spacing looks off, minor alignment issues
- **P3 (Nit)**: Polish - minor aesthetic inconsistencies

---

## Phase 1: Home

### Screen: Home Dashboard (`app/(tabs)/index.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| H-1 | Meal name truncation | P1 | SE | Long meal names like "Smoked Salmon Omelet with Avoca..." get truncated with ellipsis on SE. The truncation hides the full dish name, making it hard to distinguish similar meals. |
| H-2 | Tab bar label squeeze | P2 | SE | The bottom tab bar has 4 labels + a large "+" button. On SE (375pt), tab labels are compressed and "Coach" label is tight against the "+" button. Labels become very small. |
| H-3 | Today's Plan - only 2 meals visible | P2 | SE | On SE, only 2 of 3 planned meals are visible above the fold. The 3rd meal (Dinner) requires scrolling, but there's no visual indicator that more content exists below. |
| H-4 | Recipe card gradient hardcoded | P3 | All | `index.tsx:617` - gradient overlay uses `height: 80` hardcoded. Works fine currently but won't scale with different card sizes. |
| H-5 | Today's Fuel macro circles cut off | P2 | Pro Max | On Pro Max, "Today's Fuel" section with macro circles (CAL, PROTEIN, CARBS, FAT) peeks above the tab bar but the circles appear empty/unloaded. On smaller screens this section is below the fold entirely. Verify loading state. |

### Screen: Food Search (`app/food/search.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| FS-1 | Search placeholder truncated | P3 | SE | Placeholder "Search: chicken breast, avocado..." gets truncated earlier on SE vs 17 Pro where it shows "chicken breast, avocado, gre...". Minor since it's placeholder text. |

### Screen: Quests & Streaks (`app/quests.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| Q-1 | No issues found | - | All | Layout scales well. Streak icons, XP bar, and quest list all render correctly on both devices. |

---

## Phase 2: Meals

### Screen: Kitchen Hub (`app/(tabs)/meals.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| M-1 | Bottom row cards partially visible | P2 | SE | The 6-card grid (Meals, Meal Prep, Desserts, My Plan, Saved, Grocery) shows the bottom row (Saved, Grocery) partially cut off by the tab bar on SE. User must scroll to see them fully. |
| M-2 | Filter minWidth constraint | P2 | SE | `meals.tsx:332` - `minWidth: 140` on filter items. With horizontal scroll this works, but the first visible filter may look cramped. |

### Screen: Browse Recipes (`app/browse/index.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| BR-1 | Recipe title truncation | P2 | SE | "Chicken & Shrimp Basil Stir-Fried Noo..." truncated on SE. On 17 Pro shows "Stir-Fried Noodles" fully. |
| BR-2 | Filter row overflow | P3 | All | On 17 Pro, the filter row shows "M..." cut off. On Pro Max it shows "Meal..." cut off. Even the largest device can't fit all filters. Needs a clearer scroll affordance (fade edge or arrow indicator). |

### Screen: Saved Recipes (`app/saved/index.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| SR-1 | No issues found | - | All | Empty state renders cleanly on both devices. |

### Screen: Meal Plan Builder (`app/meal-plan-builder.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| MPB-1 | No issues found | - | All | Form layout, chips, and step indicator all scale well. Flavor preference tags wrap correctly. |

---

## Phase 3: Track

### Screen: Chronometer (`app/(tabs)/chronometer.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| T-1 | Calendar month view cramped | P2 | SE | The monthly calendar view has very tight spacing between day numbers on SE. Touch targets for individual days are smaller than the recommended 44pt minimum. |
| T-2 | Add menu hardcoded width | P1 | SE (code) | `chronometer.tsx:1542` - `addMenu` popup has `width: 240` hardcoded with `position: 'absolute', right: 0`. On SE with padding, this could overflow the left edge. Should use `Math.min(240, Dimensions.get('window').width - 60)` like GlassTabBar does. |
| T-3 | Fuel/Metabolic toggle good | - | All | The segmented control (Fuel/Metabolic) scales well across both devices. |

---

## Phase 4: Coach

### Screen: Chat (`app/(tabs)/chat.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| C-1 | Quick starts chip wrapping | P2 | SE | On SE, the quick start suggestion chips ("Salmon Power Bowl", "Beef and Broccoli", etc.) wrap into a dense vertical stack. On 17 Pro they have better spacing. The SE view looks crowded. |
| C-2 | Background glow overflow | P2 | SE (code) | `chat.tsx:1322-1329` - Background glow elements have hardcoded `width: 260` and `width: 220`. On SE (375pt), these take up 69% of screen width. While decorative and likely clipped, they could cause performance issues on smaller devices. |
| C-3 | Input bar safe area | P3 | SE | The "Ask about any food..." input bar is very close to the bottom edge on SE. On devices without a home indicator (SE has a physical button), the spacing looks adequate but tight. |

---

## Phase 5: Scan

### Screen: Scan Modal (`app/scan/index.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| S-1 | Camera permission layout good | - | All | "Camera Access Needed" permission screen renders well on both devices. The "Grant Access" button is centered and visible. |
| S-2 | Scan Food / Packaged Food tabs | P3 | SE | The bottom toggle between "Scan Food" and "Packaged Food" is slightly closer to the shutter button on SE. Adequate spacing but tight. |

---

## Phase 6: Profile & Settings

### Screen: Profile (`app/(tabs)/profile.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| P-1 | Recent Unlocks truncation | P1 | 17 Pro, Pro Max | Achievement titles under "Recent Unlocks" are truncated: "First Healthi...", "Healthify R...", "Meal Planner", "Week Warrior". On Pro Max a 5th tile "Grocer..." also appears truncated. The truncation makes several achievements unreadable across ALL device sizes. |
| P-2 | Achievement tile minWidth | P2 | SE (code) | `profile.tsx:421` - `minWidth: 88` on achievement tiles. On SE, this limits how many tiles fit per row and may cause awkward wrapping. |
| P-3 | Quests & Streaks row | P3 | SE | The "Quests & Streaks" section with the chevron is slightly tighter on SE but still functional. |

### Screen: Settings (`app/settings.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| SET-1 | Flavor Profile text truncation | P2 | SE | "spicy, savory, sweet, tangy, mild,..." text is truncated with "..." on SE. The full list ("spicy, savory, sweet, tangy, mild, umami") is visible on 17 Pro and Pro Max. Only affects small screens. |
| SET-2 | Settings list scrollable | - | All | All settings rows are accessible via scroll. No overflow issues. |

### Screen: Preferences (`app/preferences.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| PREF-1 | No issues found | - | All | Chip/tag layout wraps correctly on both devices. Dietary preferences, flavor profile, and allergy tags all reflow properly. |

### Screen: Push Notifications (`app/notification-settings.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| NOTIF-1 | Description text density | P3 | SE | The notification category descriptions are quite dense on SE. "Up to twice a week when tonight's dinner is already chosen." wraps to 3 lines on SE vs 2 on 17 Pro. Functional but feels cramped. |

---

## Phase 7: Auth & Onboarding

### Screen: Login (`app/(auth)/login.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| L-1 | No issues found | - | All | Login screen scales well. Logo, form fields, Sign In button, OAuth buttons, and "Sign Up" link all render correctly. Good vertical spacing. |

### Screen: Onboarding V2

_Note: Could not test onboarding screens as they require a new user flow. Code review only._

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| OB-1 | Needs manual testing | - | - | 15 onboarding screens need to be tested with a fresh account. Based on code patterns, they use similar layout components as the main app. |

---

## Phase 8: Miscellaneous

### Tab Bar (`components/GlassTabBar.tsx`)

| # | Issue | Severity | Device(s) | Description |
|---|-------|----------|-----------|-------------|
| TB-1 | Label readability on SE | P1 | SE | The tab bar has 4 labels + a "+" button in 375pt. Each tab gets ~69pt. The `compactTabs` mode kicks in at `slotWidth < 86`, which triggers on SE. Labels shrink to 10pt font with `minimumFontScale: 0.82`. This makes labels borderline unreadable for users with vision impairments. |
| TB-2 | Plus button proximity | P2 | SE | The "+" FAB button is very close to the "Coach" tab on SE. Risk of accidental taps on the wrong element. |
| TB-3 | Good responsive pattern | - | All | `GlassTabBar.tsx:475` uses `Math.min(260, Dimensions.get('window').width - 60)` - excellent responsive pattern that should be adopted elsewhere. |

---

## Pro Max (430pt) Specific Notes

The iPhone 17 Pro Max (430pt) generally displays more content above the fold and has better spacing than smaller devices. Key observations:
- **No new critical/major issues** introduced by the larger screen
- **Profile achievement truncation persists** even at 430pt - confirms this is a design issue, not just a small-screen problem
- **Browse filter overflow persists** at all sizes - the filter row needs a scroll affordance regardless of device
- **Home screen** benefits most from extra space - shows all 3 meals + macro section above the fold
- **Coach quick starts** have noticeably better chip layout with more breathing room
- **Settings** shows all text without truncation at this width

---

## Summary by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| P0 (Critical) | 0 | None - app is usable on all tested devices |
| P1 (Major) | 5 | Meal name truncation, profile achievement truncation, chronometer menu overflow risk, tab bar readability, **deep link navigation stacking** |
| P2 (Minor) | 11 | Card visibility, filter constraints, calendar touch targets, chip crowding, text truncation in settings, macro section loading |
| P3 (Nit) | 6 | Gradient heights, placeholder text, input spacing, description density |

## Top Priority Fixes

1. **Tab bar label readability on SE (TB-1)**: Consider using icons-only mode on compact screens, or reducing to 4 items by moving "+" to a different position.
2. **Meal name truncation (H-1, BR-1)**: Allow 2 lines for meal names, or use a wider card layout on small screens.
3. **Profile achievement title truncation (P-1)**: Increase width of achievement tiles or allow text wrapping.
4. **Chronometer add menu width (T-2)**: Use responsive width pattern from GlassTabBar: `Math.min(240, screenWidth - 60)`.
5. **Settings flavor text truncation (SET-1)**: Show full text or use expandable rows.

## Code Patterns to Adopt Project-Wide

The `GlassTabBar.tsx` already demonstrates the correct responsive pattern:
```js
width: Math.min(maxWidth, Dimensions.get('window').width - margin)
```

Apply this to:
- `chronometer.tsx:1542` (addMenu width: 240)
- `chat.tsx:1322-1329` (glow elements: 260, 220)
- Any future fixed-width elements

---

---

## Addendum: Deep Link Navigation Stacking Bug

### Problem
When navigating via deep links (or `router.push()` to root-level routes), screens are **pushed onto the Root Stack on top of the tab navigator** rather than navigating within it. This creates:

1. **"App within an app" feel** — a new screen slides up/in, covering the tabs entirely
2. **Stacking problem** — each deep link navigation pushes a new screen. After navigating to 5 screens via deep links, the user must press back 5 times to return to the original tab view
3. **Duplicate tab instances** — deep linking to `/(tabs)` creates a **second copy** of the tab navigator on the stack instead of returning to the existing one

### Root Cause
All non-tab routes (`food/*`, `browse/*`, `settings`, `preferences`, `quests`, etc.) are defined as **siblings** to `(tabs)` in the Root Stack:

```
Root Stack
├── (tabs)              ← Tab Navigator
├── food/search         ← Root-level screen (pushes ON TOP of tabs)
├── browse/[id]         ← Root-level screen (pushes ON TOP of tabs)
├── settings            ← Root-level screen (pushes ON TOP of tabs)
├── ...etc
```

When `router.push('/food/search')` is called from any tab, React Navigation pushes `food/search` onto the Root Stack, covering the entire `(tabs)` screen including the tab bar.

### Affected Routes (all root-level non-modal screens)

| Route | How it's reached | Stacking behavior |
|-------|-----------------|-------------------|
| `food/search` | Home > Search, Track > Log Food | Pushes on root, hides tabs |
| `food/[id]` | Various food item taps | Pushes on root, hides tabs |
| `food/meals` | Home > meal details | Pushes on root, hides tabs |
| `food/metabolic-coach` | Various coach links | Pushes on root, hides tabs |
| `food/mes-breakdown` | Track > MES details | Pushes on root, hides tabs |
| `browse/[id]` | Meals > recipe tap, Home > recipe tap | Pushes on root, hides tabs |
| `browse/index` | Meals > Browse | Pushes on root, hides tabs |
| `saved/index` | Meals > Saved | Pushes on root, hides tabs |
| `saved/[id]` | Saved > recipe tap | Pushes on root, hides tabs |
| `settings` | Profile > gear icon | Pushes on root, hides tabs |
| `preferences` | Settings > Dietary Preferences | Pushes on root, hides tabs |
| `notification-settings` | Settings > Push Notifications | Pushes on root, hides tabs |
| `quests` | Profile > Quests & Streaks | Pushes on root, hides tabs |
| `chat-recipe` | Coach > recipe generation | Pushes on root, hides tabs |

### Intentionally Modal Routes (OK as-is)

These routes are **correctly** defined as modals/fullscreen overlays:
- `scan/index` — Camera scanner (fullScreenModal, slide_from_bottom)
- `subscribe` — Paywall (fullScreenModal, slide_from_bottom)
- `meal-plan-builder` — Plan creation (fullScreenModal, slide_from_bottom)
- `cook/[id]` — Cooking mode (modal)

### Severity: P1 (Major)

This affects the core navigation UX of the entire app. Users experience:
- Loss of tab bar context when navigating to detail screens
- Inability to quickly switch tabs while viewing a recipe/food detail
- Confusing back-button behavior (especially after multiple deep links)
- Potential for very deep navigation stacks that are hard to unwind

### Recommended Fix

**Option A: Keep current architecture, reset stack on deep link**
Add a `navigationState` reset when handling deep links so they don't accumulate:
```tsx
// In _layout.tsx, intercept deep links and use router.replace() instead of push
```

**Option B: Move detail screens into tab-specific stacks (recommended)**
Create nested stacks within each tab so detail screens stay within their tab context:
```
(tabs)
├── index/                  ← Home tab stack
│   ├── index.tsx           ← Home screen
│   ├── food/search.tsx     ← Search (within Home tab, keeps tab bar)
│   └── food/[id].tsx       ← Food detail (within Home tab)
├── meals/                  ← Meals tab stack
│   ├── index.tsx           ← Meals hub
│   ├── browse/[id].tsx     ← Recipe detail (within Meals tab)
│   └── saved/[id].tsx      ← Saved detail (within Meals tab)
├── chronometer.tsx         ← Track tab
├── chat.tsx                ← Coach tab
└── profile/                ← Profile tab stack
    ├── index.tsx            ← Profile screen
    ├── settings.tsx         ← Settings (within Profile tab, keeps tab bar)
    └── preferences.tsx      ← Preferences (within Profile tab)
```

This approach:
- Keeps the tab bar visible during detail navigation
- Prevents stack accumulation
- Ensures deep links navigate within the correct tab context
- Matches the expected iOS/Android navigation pattern

---

_Screenshots saved in `tasks/audit-screenshots/` for reference._
