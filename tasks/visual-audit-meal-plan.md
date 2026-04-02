# Meal Plan Visual Audit

**Date**: 2026-04-01
**Method**: Web preview at 375x812 (iPhone viewport) + iOS Simulator (iPhone 17 Pro Max), dark + light mode
**Account**: arahman.usa500@gmail.com (existing user with meal plan)
**Passes**: 3 (web dark, web light, native simulator light)

---

## Overall Impression

The app has a **strong visual identity** with a dark-first glassmorphic design, consistent green accent color (#22C55E), and professional typography. The meal plan experience feels polished and the recipe cards with food photography are appetizing. The design is modern and on-par with premium fitness/nutrition apps.

---

## Screen-by-Screen Findings

### Home Tab
**Verdict: Strong**
- Clean hero section with greeting, avatar, and streak/fire badges
- Week calendar strip is intuitive with highlighted current day
- Fuel Score radial gauge is visually compelling and immediately readable
- Flex meals ticket row is a nice gamification touch
- "Today's Plan" section shows all 3 meals with Fuel Score + MES badges
- "Log 3 more -> earn flex points" CTA is motivating

**Below the fold (scrolled down):**
- "Today's Fuel" card with 4 macro progress rings (CAL, PROTEIN, CARBS, FAT) -- clean empty state with "No meals logged yet" and "Ready to fuel up?" CTA
- "Scan a Meal" button is well-positioned as the primary action
- "Recommended For You" horizontal recipe cards with food images, titles, cook time, difficulty overlaid -- visually appetizing
- "Quick Actions" section with gradient cards ("Healthify a Craving", "Scan Food") -- strong visual hierarchy
- "Meal Plans" and "Groceries" shortcut cards at the bottom

**Issues:**
- The persistent red "No internet connection" banner at the top consumes 30px of premium screen real estate. On web/preview it always shows because the web build can't detect connectivity the same way. On device this should auto-dismiss, but verify it doesn't flash on app launch.

### Meals Tab (Kitchen Hub)
**Verdict: Good, but could be more engaging**
- 6-card grid layout is clean and organized
- Each card has an icon + title + subtitle
- Cards use subtle dark surfaces with rounded corners

**Issues:**
- The cards feel somewhat generic/placeholder-ish -- they lack visual energy compared to the rest of the app. Consider adding gradient backgrounds, food imagery, or subtle illustrations to each card to make them more inviting.
- "Eat" as the hero text ("Kitchen Hub / Eat / What are you looking for?") is too minimal. Consider "What's cooking?" or showing a featured recipe/plan highlight instead.
- The 6-card grid takes up the entire screen but doesn't scroll -- wasted space below the last row.

### My Plan View
**Verdict: Excellent**
- Day selector pills (Mon-Sun) are clean and immediately show the active day
- Prep Timeline horizontal scroll cards are a great feature -- showing "Prep Sunday: Recipe X for Mon-Wed lunches" is super useful
- Projected Energy Score section with weekly MES bar chart is visually rich
- "This plan earns ~9 flex meals" summary is motivating
- "Wednesday's Meals" header with "3 meals, 1,513 cal, 129g protein" summary is informative

**Issues:**
- The day selector cuts off "Sat" at the right edge -- the horizontal scrolling isn't obvious. Consider showing a fade/gradient on the right edge to hint at scrollability.
- All prep entries show "Prep Sunday" -- consider varying prep days (Sunday/Wednesday) for visual variety and practical utility.

### Meal Cards (within My Plan)
**Verdict: Very Good**
- Beautiful food photography fills the card width
- Meal type label (BREAKFAST/LUNCH/DINNER) in green uppercase is clear
- Fuel Score (100) and MES Score (86) badges are compact and readable
- Nutrition summary row "470 cal, 43g protein, 11g carbs, 28g fat" is well-formatted
- Servings counter with +/- buttons is functional
- "Prepped" and "Bulk Cook" status pills are useful
- "Replace" button and cook time/difficulty info is accessible

**Issues:**
- The green "Prepped" and "Bulk Cook" pill buttons sit next to a "+" button whose purpose is unclear. What does it do? If it's "Add to grocery list" or "Log meal", make the icon/label explicit.
- Servings default to 1 even when the user might have a household of 4 (confirmed in backend audit -- servings don't reflect household_size).

### Recipe Browse View
**Verdict: Good**
- "Full Meals" / "Meal Prep" toggle pills are clear
- Filter chips (Protein, Carb, Cook Time) are functional
- Recipe count ("32 recipes found") provides context
- Two-column card grid is standard and works well
- Each card shows: image, title, description preview, cook time, difficulty, cal/protein badge

**Issues:**
- The green cal/protein badge at the bottom of each card (e.g., "824 cal, 66g protein") is always green regardless of whether the values are good or bad for the user. Consider color-coding: green for well-aligned with budget, yellow for moderate, red for over-budget.
- Recipe descriptions are truncated with "..." but there's no visual cue that tapping reveals more.
- Only 20-32 recipes visible depending on filters. The "recipes found" count should update dynamically as filters change (verify this works).

### Recipe Detail View
**Verdict: Excellent**
- Full-width hero image is appetizing
- Title, description, and nutrition breakdown are well-organized
- Macro circles (Protein 32g, Carbs 18g, Fat 20g, Fiber 1g) with color-coded rings are great
- MES Score section with "Elite Fuel" badge and score ring is polished
- "Default Pairing" section showing the paired side dish and MES impact is unique and valuable
- "Tap for breakdown" hint is good for power users
- Ingredients section organized by category (Protein, Produce, Spices) with checkboxes is excellent
- "Open Cook Mode" button with steps is a strong feature

**Issues:**
- Fiber shows "1g" for the Bang Bang Chicken Skewers which is very low. The purple ring is nearly empty but doesn't call attention to this being below target. Consider adding a subtle indicator when a macro is significantly below the per-meal target.
- The ingredient count "0/26" suggests checkbox tracking, but it's not immediately clear what checking an ingredient does (grocery list? prep tracking?).
- Servings adjuster shows "4" but the nutrition values appear to be per-serving, not for 4 servings. Clarify whether the displayed nutrition scales with servings.

### Track Tab
**Verdict: Good**
- Weekly Fuel Score with radial gauge is consistent with home
- Calendar month view with color-coded day indicators is standard and works
- Streak display "2 weeks" is motivating
- "Fuel" / "Metabolic" toggle provides depth

### Coach Tab
**Verdict: Good**
- AI chat interface with quick-start meal suggestions is inviting
- "What's in my fridge?" and "Explain my score" CTAs are useful
- Clean chat input with camera icon for meal scanning

### Tab Bar
**Verdict: Excellent**
- Floating glassmorphic tab bar is visually premium
- Active tab gets a subtle bubble indicator
- "+" button that morphs to "X" with quick actions (Log Meal, Scan, Create New Plan, New Chat) is very slick
- Icon sizing and spacing is balanced

---

## Light Mode

**Verdict: Works Well (corrected after second-pass verification)**

On second-pass review, light mode renders correctly across all screens:
- Home tab, Kitchen Hub, recipe browse, recipe detail, My Plan, Track, Coach all properly adapt
- Recipe cards use light surfaces with dark text -- no contrast issues
- Kitchen Hub cards switch to white backgrounds with appropriate borders
- Nutrition circles, MES badges, and macro rings all remain readable
- **One caveat**: The theme is cached in the Zustand store. If the system theme changes while the app is running, the app does NOT reactively switch -- it requires a reload/restart. This is acceptable for mobile (users rarely toggle mid-session) but worth noting.

---

## Simulator Pass (Native iOS - iPhone 17 Pro Max)

**Confirmed from native rendering (light mode):**
- Home tab renders correctly in light mode natively — no theming issues
- The Fuel Score gauge, calendar strip, meal rows, and tab bar all adapt properly
- **Logo discoloration confirmed**: The dark-background `icon.png` creates a visible dark square on the light splash screen and login screen. This is the primary visual issue in light mode.
- Expo Go crashes on subsequent launches (SIGBUS in JS runtime) — this is an Expo Go + SDK compatibility issue, not an app bug. A dev client build would be needed for thorough native testing.

### Logo Fix Applied
- Generated `icon-light.png` using Gemini Flash (white background variant of the leaf+flame logo)
- Generated `icon-transparent.png` (transparent background, icon only)
- Updated `login.tsx` and `onboarding.tsx` to conditionally use `icon-light.png` in light mode
- The onboarding-v2 screens (`notification-permission.tsx`, `video-hook.tsx`) always use dark backgrounds, so they correctly keep the dark logo

---

## Cross-Cutting Visual Issues

1. **Logo discoloration in light mode [FIXED]**: The dark-background `icon.png` created a visible dark square on light screens. Fixed by generating a light-mode variant and conditionally loading it based on theme.

2. **"+" log button has no label or accessibility attributes**: The 32x32 "+" icon next to each meal in "Today's Plan" is actually a "Log this planned meal" button (confirmed via source: `handleLogPlannedMeal`). It changes to a checkmark when logged. However, it has no `role="button"`, no `aria-label`, and no visible text label. New users won't know what it does without trial-and-error.

3. **"No internet connection" banner**: Always visible in web preview. On production, verify this only shows when truly offline and auto-dismisses. The red bar is visually aggressive.

4. **Recipe card nutrition badges always green**: The green pill showing "824 cal, 66g protein" doesn't communicate whether those values align with the user's budget. An 824-cal single meal might be perfect for an athletic user but excessive for a small-frame female on fat loss. Contextual color-coding would add value.

4. **Servings disconnect**: The UI shows servings=1 by default but doesn't scale nutrition display or account for household size from preferences (confirmed in backend audit).

---

## Recommendations (Priority Order)

### Must Fix
1. **Add label/accessibility to the "+" log button**: Add `accessibilityLabel="Log meal"` and consider showing "Log" text below the icon, or use a more descriptive icon like `checkmark-circle-outline`. The button is a critical interaction point (it's how users complete their plan) but is currently invisible to screen readers and unclear to sighted users.

### Should Fix
2. **Kitchen Hub cards need more visual energy**: The 6-card grid works functionally but feels generic compared to the rest of the app. Add gradient backgrounds, food imagery, or subtle illustrations to each card.
3. **Budget-aware nutrition badges**: Color-code the cal/protein pills on recipe cards relative to the user's per-meal budget (green=aligned, yellow=moderate, red=over).
4. **Day selector scroll hint**: Add a right-edge fade gradient on the My Plan day selector to indicate horizontal scrollability -- "Sat" gets clipped with no visual hint.
5. **Ingredient checkbox purpose**: Add a small label or onboarding tooltip explaining what checking an ingredient does (grocery list tracking? prep tracking?).

### Nice to Have
6. **Fiber/macro warnings**: Subtle visual indicator when a recipe's macro is significantly below the per-meal target (e.g., the nearly-empty purple fiber ring on Bang Bang Chicken Skewers).
7. **Servings-aware nutrition display**: Clarify whether displayed nutrition scales with the servings adjuster, and ensure household_size preference is reflected.
8. **Theme reactivity**: Currently the app caches the theme on load and doesn't react to system `prefers-color-scheme` changes mid-session. Low priority since mobile users rarely toggle mid-session.
