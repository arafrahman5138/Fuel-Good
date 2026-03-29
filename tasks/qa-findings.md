# Fuel Good Pre-Production QA Findings

**Date**: 2026-03-29
**Tester**: Automated QA via iOS Simulator (iPhone 17 Pro, iOS 26.2)
**App Version**: 1.0.0 (development)
**User Account**: Sarah Thompson (sarah.test@fuelgood.app)

---

## Screens Tested

| Screen | Light Mode | Dark Mode | Status |
|--------|-----------|-----------|--------|
| Home Dashboard | Tested | Tested | Pass |
| Meals Tab (Kitchen Hub) | Tested | Tested | Pass |
| Chronometer - Fuel View | Tested | Tested | Pass |
| Chronometer - Metabolic View | Tested | N/A | Pass |
| Chat (Coach) | Tested | Tested | Pass |
| Profile - Overview | Tested | Tested | Pass |
| Profile - Achievements | Tested (list view) | Tested | Pass |
| Settings | Tested | Tested | Pass |
| Preferences | Tested | Tested | Pass |
| Notification Settings | Tested | Tested | Pass* |
| Quests & Streaks | Tested | Tested | Pass (UX note) |
| Flex Budget | Tested | Tested | Pass (UX note) |
| Weekly Fuel | Tested | Tested | Pass (UX note) |
| MES Breakdown | Tested | Tested | Pass |
| Browse Recipes | Tested | Tested | Pass |
| Saved Recipes (empty state) | Tested | N/A | Pass |
| Food Database (search) | N/A | Tested | Pass |
| Scanner | Tested | Tested | Pass |
| Metabolic Onboarding | Tested | N/A | Pass |

---

## Issues Found

### P1 - High (Should fix before release)

#### 1. Fuel Score exceeds documented max of 100
- **Screen**: Flex Budget (`/app/food/flex.tsx`)
- **Description**: Weekly average displays as "102" which exceeds the documented 0-100 scale. While the backend calculation allows this, it contradicts the README and in-app documentation that describe Fuel Score as a 0-100 scale.
- **Steps to reproduce**: Open Flex Budget screen, observe "102 Elite" stat
- **Expected**: Fuel score should be capped at 100, or the display should clarify the number (e.g., "100+" or adjust the scale description)
- **Actual**: Shows raw calculated value of 102
- **File**: `frontend/app/food/flex.tsx` line ~209, also backend `fuel_score.py`

#### 2. Quests "No Flex Meals Today" displays confusing progress numbers
- **Screen**: Quests & Streaks (`/app/quests.tsx`)
- **Description**: The "No Flex Meals Today" quest shows "100/70" which is unintuitive. Users would expect a "no flex" quest to show 0/0 or a simple checkmark. The numbers (100 = fuel score achieved, 70 = threshold) are not self-explanatory.
- **Steps to reproduce**: Open Quests screen, observe "No Flex Meals Today" quest progress
- **Expected**: Clearer labeling like "Fuel Score: 100 (above 70 target)" or a simple pass/fail indicator
- **Actual**: Shows "100/70" with a green checkmark, which looks like a ceiling quest being exceeded
- **File**: `frontend/app/quests.tsx` lines ~133-209

#### 3. MES score inconsistency between Home and Chronometer
- **Screen**: Home Dashboard vs Chronometer Metabolic View
- **Description**: Beef and Potato Hash shows MES 88 on the Home screen (Today's Plan) but MES 79 in the Chronometer Metabolic view. This could be recipe-expected vs. actual-logged discrepancy, but users see two different numbers for the same meal.
- **Steps to reproduce**: Compare MES scores for same meal on Home vs Chronometer
- **Expected**: Consistent MES display, or clear labeling distinguishing "recipe estimate" from "logged actual"
- **Actual**: Two different MES values shown for the same meal without explanation

### P2 - Medium (Fix if time permits)

#### 4. "23 of 21 meals logged" counter is confusing
- **Screen**: Weekly Fuel (`/app/food/fuel-weekly.tsx`), Chronometer
- **Description**: Displays "23 of 21 meals logged this week" which implies exceeding a limit. While functionally correct (21 is a default target, not a max), the "X of Y" format suggests Y is a cap. Users who log snacks or extra meals see an over-count.
- **Steps to reproduce**: Log more than 21 meals in a week, check Weekly Fuel screen
- **Expected**: Either "23 meals logged this week (target: 21)" or remove the target when exceeded
- **Actual**: "23 of 21 meals logged this week"
- **File**: `frontend/app/food/fuel-weekly.tsx` line ~199

#### 5. "21/17 Clean meals" denominator unclear on Flex screen
- **Screen**: Flex Budget (`/app/food/flex.tsx`)
- **Description**: Shows "21/17" under "Clean meals" label. The 17 is the calculated clean-eating target (80% of 21), but users may not understand this derived number without context.
- **Steps to reproduce**: Open Flex Budget screen
- **Expected**: Label like "21 clean of 17 needed" or "21 clean meals (target: 17)"
- **Actual**: Just "21/17" with "Clean meals" subtitle
- **File**: `frontend/app/food/flex.tsx` line ~204

#### 6. Camera permission dialog persists across navigation
- **Screen**: Scanner → Notification Settings
- **Description**: When navigating from Scanner (which triggers camera permission) to Notification Settings via deep link, the system permission dialog persists on top of the new screen. The dialog overlay doesn't dismiss on navigation.
- **Steps to reproduce**: Navigate to Scanner → before dismissing camera dialog, navigate to another screen
- **Expected**: System dialog should be scoped to the screen that requested it, or auto-dismiss on navigation
- **Actual**: Dialog overlays unrelated screens
- **Note**: This is iOS system behavior and may not be fixable in-app, but the scan screen could pre-check permissions before showing

### P3 - Low (Post-launch polish)

#### 7. Profile screen has unnecessary back button
- **Screen**: Profile (`/app/(tabs)/profile.tsx`)
- **Description**: The Profile screen shows a "< back" arrow in the top-left, but Profile is a main tab — there's no meaningful "back" destination. It navigates to the Home tab, which the user can already reach via the tab bar.
- **Steps to reproduce**: Open Profile tab, note the back arrow
- **Expected**: No back arrow on a main tab screen, or replace with a meaningful action
- **Actual**: Back arrow that navigates to Home tab
- **File**: `frontend/app/(tabs)/profile.tsx` lines ~131-136

#### 8. Streak terminology inconsistency
- **Screen**: Profile vs Quests
- **Description**: Profile shows "Day Streak: 2" while Quests shows "Fuel Streak: 0". While these are intentionally different streak types (engagement vs. fuel-specific), the naming isn't immediately clear to users. A user could think their streak data is inconsistent.
- **Steps to reproduce**: Compare Profile overview stats with Quests screen streak badges
- **Expected**: Clearer differentiation, e.g., "Login Streak" vs "Fuel Streak", or explain the difference
- **Actual**: "Day Streak" vs "Fuel Streak" with different values

#### 9. Subscribe route redirects to Home
- **Screen**: Subscribe (`/app/subscribe.tsx`)
- **Description**: Navigating to the subscribe screen via deep link redirects to the Home screen. This may be because RevenueCat isn't configured in development, but there's no feedback to the user about why.
- **Steps to reproduce**: Navigate to `/subscribe` via deep link
- **Expected**: Subscribe screen with paywall UI, or a message explaining subscription unavailability
- **Actual**: Silent redirect to Home screen

---

## Screens That Passed Without Issues

### Visual Quality (Both Themes)
- All gradient cards render properly in both light and dark mode
- Green accent color has excellent contrast on dark backgrounds
- Tab bar glass effect works correctly
- Score badges use correct tier colors (green for elite, amber for warning)
- Icons all render correctly (no missing or broken icons)
- Text is readable on all screens in both modes
- Safe area insets properly respected
- Animation timing appears smooth

### Functional Quality
- Home screen greeting matches time of day
- Week strip correctly highlights today (Sunday, March 29)
- Fuel score ring renders correctly
- Today's Plan section shows meals with fuel/MES scores
- Meals tab 6-card grid renders correctly
- Browse recipes loads with images, filters, and pagination
- Chat preserves conversation history across navigation
- Recipe cards in chat render with full details
- Settings all links navigate correctly
- Theme toggle applies immediately
- Preferences chips toggle correctly
- Notification settings toggles work
- Empty states (Saved Recipes) display appropriately
- Scanner shows proper permission handling
- Metabolic view shows detailed macro breakdown
- Quests display completed/incomplete state correctly
- MES Breakdown shows detailed scoring with formula

---

## Not Tested (Requires Physical Device or Additional Setup)

- Barcode/label scanning (requires real camera)
- Push notification delivery
- Social auth (Google/Apple Sign-In)
- Subscription purchase flow (requires RevenueCat sandbox)
- Offline mode behavior (requires network manipulation)
- Background/foreground state transitions
- Onboarding flow (requires new user account)
- Meal plan generation (requires API interaction)
- Food logging end-to-end (requires tapping through log flow)
- Achievement detail sheet (requires tapping achievement tile)
- Grocery list generation
- Recipe detail page from browse
