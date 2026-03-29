# Fuel Good Pre-Production Bug Fix Sprint

## Context
Fuel Good is a React Native/Expo nutrition app preparing for production release. A comprehensive QA pass was performed across all screens in both light and dark mode on iPhone 17 Pro simulator. The app is overall in excellent shape — strong visual design, consistent theming, solid dark mode support, and clean empty states. The issues found are primarily UX clarity concerns around data display, not functional bugs.

## Issues Found

### P1 - High (Should fix before release)

#### 1. Fuel Score exceeds documented max of 100
- **Screen**: Flex Budget
- **File**: `frontend/app/food/flex.tsx` line ~209 (`{Math.round(projectedAvg)}`)
- **Also**: `frontend/app/food/fuel-weekly.tsx`, backend `fuel_score.py`
- **Problem**: Weekly avg displays "102" but the entire app and documentation describe Fuel Score as 0-100
- **Fix**: Either cap the display at 100 (`Math.min(100, Math.round(projectedAvg))`) or update the messaging to explain scores can exceed 100 when all meals are whole food. Capping at 100 is simpler and aligns with user expectations.
- **Verify**: Check all places where fuel score is displayed (flex screen, weekly fuel, chronometer, home hero card) and apply consistent capping

#### 2. "No Flex Meals Today" quest shows confusing "100/70" progress
- **Screen**: Quests & Streaks
- **File**: `frontend/app/quests.tsx` lines ~133-209
- **Problem**: The quest "No Flex Meals Today" shows progress as "100/70" with a green checkmark. Users can't tell what these numbers mean. Is 100 the fuel score? Is 70 the minimum threshold? The quest name says "no flex" but the display implies something was measured.
- **Fix**: For this specific quest type, show a clearer label. When `quest.direction === 'ceiling'` and the quest is about flex meals, display something like "All meals clean today" (checkmark) or "Fuel Score 100 (min: 70)" instead of raw "100/70"
- **Verify**: Check how other ceiling quests display, ensure the fix is consistent

#### 3. MES score inconsistency between Home and Chronometer
- **Screen**: Home Dashboard (`frontend/app/(tabs)/index.tsx`) vs Chronometer (`frontend/app/(tabs)/chronometer.tsx`)
- **Problem**: Same meal (Beef and Potato Hash) shows MES 88 on Home screen but MES 79 in Chronometer. Home shows the recipe's expected MES while Chronometer shows the logged/actual MES.
- **Fix options**:
  - (a) Add a subtle label distinguishing "est." vs "actual" MES scores
  - (b) Use the logged/actual MES everywhere once a meal is logged
  - (c) Keep as-is but add a tooltip/info explaining the difference
- **Verify**: Log a meal from the plan, compare MES on Home vs Chronometer. Check if the home screen updates its MES after logging.

### P2 - Medium (Fix if time permits)

#### 4. "23 of 21 meals logged" counter wording
- **Screen**: Weekly Fuel, Chronometer
- **File**: `frontend/app/food/fuel-weekly.tsx` line ~199
- **Problem**: "X of Y" format implies Y is a maximum. Showing "23 of 21" looks like exceeding a limit.
- **Fix**: Change wording to: `{weekly.meal_count} meals logged this week` (drop the target when exceeded), or: `{weekly.meal_count} meals logged (target: {expectedMeals})`
- **Verify**: Test with meal_count both below and above expectedMeals

#### 5. "21/17 Clean meals" denominator unclear
- **Screen**: Flex Budget
- **File**: `frontend/app/food/flex.tsx` line ~204
- **Problem**: "21/17" is ambiguous — does it mean 21 out of 17 needed? 21 total with 17 clean?
- **Fix**: Change label to "{cleanLogged} of {cleanTarget} target" or "21 clean (17 needed)"
- **Verify**: Check that the label is clear in both over-target and under-target scenarios

#### 6. Camera permission dialog overlaps other screens
- **Screen**: Scanner → any other screen
- **Problem**: iOS system dialog persists across React Navigation transitions
- **Fix**: In the scan screen, check camera permission status before mounting the camera component. If not determined, show a custom permission request UI. Only mount the native camera after permission is granted. This prevents the system dialog from appearing at an unexpected time.
- **File**: `frontend/app/scan/index.tsx`
- **Verify**: Navigate to scanner, then immediately navigate away before granting permission

### P3 - Low (Post-launch polish)

#### 7. Remove unnecessary back button from Profile tab
- **File**: `frontend/app/(tabs)/profile.tsx` lines ~131-136
- **Fix**: Remove the back arrow `TouchableOpacity` since Profile is a main tab. Keep the settings gear.
- **Verify**: Ensure Profile screen still looks balanced without the back arrow

#### 8. Clarify streak terminology
- **Files**: `frontend/app/(tabs)/profile.tsx` (line ~210), `frontend/app/quests.tsx` (line ~85)
- **Fix**: Rename Profile's "Day Streak" to "Logging Streak" or add a subtitle explaining what each streak tracks
- **Verify**: Check all places streak is mentioned for consistency

#### 9. Subscribe route silent redirect
- **File**: `frontend/app/subscribe.tsx`
- **Fix**: Show a "Subscription not available in development" message when billing service isn't configured, instead of silently redirecting
- **Verify**: Test in dev mode to see the message

## Instructions
1. Fix all P1 issues first, then P2, then P3
2. For each fix: read the affected file, make the minimal change needed, verify it works in the simulator
3. Group related fixes into logical commits
4. After all fixes, do a final pass through each affected screen to verify no regressions
5. Test in both light and dark mode
6. For visual issues, take before/after screenshots in the simulator

## Key Files Reference
- Frontend screens: `frontend/app/`
- Components: `frontend/components/`
- Stores: `frontend/stores/`
- API service: `frontend/services/api.ts`
- Theme/Colors: `frontend/constants/Colors.ts`
- Backend routers: `backend/app/routers/`
- Backend services: `backend/app/services/`

## Overall Assessment
The app is in **excellent visual and functional shape** for production. Dark mode is particularly well-executed with consistent theming across all screens. The tab bar, gradient cards, score badges, and empty states all look polished. The issues found are primarily around **data display clarity** — how numbers and progress are presented to users — rather than functional bugs. None of the P1s are crashers; they're UX clarity improvements that will prevent user confusion at launch.
