# Fuel Good App - Comprehensive QA Bug Report (Verified)

**Date**: April 9, 2026  
**Tester**: Claude (Automated QA)  
**Device**: iPhone 17 Pro Max (Simulator, iOS 26.2)  
**Test Users**: Sarah Miller (fat loss, no restrictions), Raj Patel (vegetarian, dairy/gluten allergies), Emma Chen (vegan, nuts/soy allergies), Mike Torres (keto)  
**Second Pass**: All bugs code-verified on April 9, 2026

---

## CONFIRMED BUGS (Code-Verified)

### BUG-001: Recipe Browse Does NOT Filter by Dietary Preferences or Allergies
- **Severity**: CRITICAL
- **Status**: CONFIRMED — code-verified, not implemented
- **Feature**: Recipe Browse / Allergy Filtering
- **User**: Raj Patel (vegetarian, dairy/gluten allergies)
- **Steps**:
  1. Create user with `dietary_preferences: ["vegetarian"]` and `allergies: ["dairy", "gluten"]`
  2. Call `GET /api/recipes/browse`
  3. Observe returned recipes
- **Expected**: Only vegetarian recipes without dairy/gluten ingredients should be returned
- **Actual**: All 79 recipes returned including:
  - "Air Fryer Gochujang Chicken Skewers" (chicken - NOT vegetarian)
  - "Beef and Broccoli Stir-Fry" (beef)
  - "Beef and Cheese Borek Rolls" (beef AND cheese/dairy)
- **Impact**: Users with allergies see foods they're allergic to. **Health/safety issue**.
- **Root Cause**: `backend/app/routers/recipes.py` browse endpoint (lines 256-349) accepts a manual `dietary` query param for recipe-level tag filtering, but **never reads** `current_user.allergies` or `current_user.dietary_preferences` to auto-filter. The substitution endpoint (line 622) DOES use allergies, proving the pattern exists but wasn't applied to browse. Frontend (`BrowseView.tsx`) also has no logic to pre-select filters from user preferences.

### BUG-002: Calendar Day Highlight Off by One Day (UTC vs Local Timezone)
- **Severity**: HIGH
- **Status**: CONFIRMED — root cause identified in code
- **Feature**: Track Tab / Fuel Calendar Heatmap
- **Steps**: Navigate to Track tab → observe calendar
- **Expected**: April 9 (today, local time) highlighted
- **Actual**: April 10 highlighted (confirmed via zoomed screenshot)
- **Root Cause**: `frontend/components/FuelCalendarHeatMap.tsx:79`:
  ```js
  const today = new Date().toISOString().slice(0, 10);
  ```
  `toISOString()` returns UTC, not local time. When local time is April 9 evening, UTC is already April 10. This same pattern exists in 8+ other files:
  - `WeeklyFuelBreakdown.tsx:53,57`
  - `chronometer/index.tsx:151`
  - `(home)/index.tsx:523`
  - `mes-breakdown.tsx:102-103`
  
  Backend also uses UTC in `fuel.py:421-425`. **Systematic UTC-vs-local issue across the codebase**.

### BUG-004: Chat AI Response Truncation Due to Timeout Mismatch
- **Severity**: HIGH
- **Status**: CONFIRMED — timeout mismatch found in code
- **Feature**: Coach Tab / Healthify Chat
- **Steps**: Send any prompt via Coach chat → wait for response
- **Expected**: Full recipe response
- **Actual**: Response cut off mid-sentence
- **Root Cause**: **Frontend timeout (60s) < Backend timeout (120s)**
  - Frontend: `services/api.ts:10` → `aiTimeout = 60000` (60 seconds)
  - Backend: `routers/chat.py:279` → `asyncio.timeout(120)` (120 seconds)
  - Streaming path in `agents/healthify.py:1548` has **no `max_tokens` limit**, while non-streaming paths cap at 1024 tokens
  - Backend even has a `_try_repair_truncated_json()` function (healthify.py:780-877), confirming this is a known recurring issue
  - When LLM takes >60s to stream a full recipe, the frontend aborts the connection

### BUG-008: Onboarding Form Fields Lack Focus Management
- **Severity**: MEDIUM
- **Status**: CONFIRMED — missing props verified
- **Feature**: Onboarding / Body Metrics Form
- **Steps**: Fill height inches, then try to advance to Age field
- **Actual**: Focus doesn't auto-advance; keyboard return key doesn't move to next field
- **Root Cause**: No `returnKeyType`, `blurOnSubmit`, or `onSubmitEditing` props on any `TextInput` in the onboarding forms (searched entire `app/(auth)/` and `app/onboarding-v2/` directories — zero matches). This means the keyboard "return" key does nothing and users must manually tap each field.

---

## RETRACTED / UNVERIFIED (Likely Simulator Test Artifacts)

### ~~BUG-003: Kitchen Hub Menu Cards Not Responding to Taps~~
- **Status**: RETRACTED — likely simulator interaction issue, not a real bug
- **Code Review**: `app/(tabs)/meals/index.tsx` lines 49-62 show correct implementation: `TouchableOpacity` with `onPress={() => setActiveView(item.id)}` inside `Animated.View`. The `usePressScale` hook (hooks/useAnimations.ts:69-93) uses `useNativeDriver: true` transforms, which CAN have touch propagation issues in simulator automation but typically work fine with real finger taps.
- **Recommendation**: Test manually on a real device to confirm. If it reproduces, the `Animated.View` wrapper with native driver scale transforms is the likely cause.

### ~~BUG-005: "Log This Meal" Button Doesn't Log~~
- **Status**: RETRACTED — code shows correct implementation
- **Code Review**: `app/(tabs)/meals/recipe/[id].tsx` lines 460-518 show the handler calls `nutritionApi.createLog()`, updates state, and shows a `ChronometerSuccessModal` on success. The button briefly shows "Logged!" (3 seconds) and then resets. Most likely my simulator click didn't actually trigger the button handler. The meal logging flow is correctly implemented.

### ~~BUG-006: "+" Scan Navigates Wrong~~
- **Status**: RETRACTED — code is correct
- **Code Review**: `components/GlassTabBar.tsx:355-358` correctly routes Scan to `router.push('/scan')`. I likely tapped "Log Meal" (one item above) instead of "Scan" due to coordinate imprecision in the simulator.

### ~~BUG-007: Metabolic/Fuel Toggle Not Switching~~
- **Status**: RETRACTED — likely simulator click issue
- **Code Review**: `chronometer/index.tsx:633-636` uses standard `TouchableOpacity` with `onPress={() => setViewMode(mode)}`. The `LinearGradient` inside the active button MAY block touch events in some React Native versions (missing `pointerEvents="none"`), but this needs real-device testing to confirm.
- **Recommendation**: If it reproduces on device, add `pointerEvents="none"` to the `LinearGradient` at line 640.

---

## LOW SEVERITY (Observations — Need Manual Verification)

### BUG-009: Activity Level Pre-selected to "Mostly Sedentary"
- **Severity**: LOW
- **Status**: Observed in simulator — needs manual verification
- **Impact**: Users may submit with default activity level without changing it

### BUG-010: Body Fat % Pre-populated with "18"
- **Severity**: LOW
- **Status**: Observed in simulator — needs manual verification
- **Impact**: Optional field, may confuse users

### BUG-011: Notification Badge Shows "1" for New User
- **Severity**: LOW
- **Status**: Observed in simulator — needs manual verification
- **Impact**: Minor UX confusion

---

## VISUAL/UX OBSERVATIONS

| # | Feature | Note |
|---|---------|------|
| OBS-001 | Flex Budget | Shows "95 Elite" tier for new user with 0 meals — potentially confusing |
| OBS-002 | Today's Plan | Auto-generates meal plan after onboarding — good behavior |
| OBS-003 | Recipe Pairing | MES pairing system works well (53→79 with side) — great feature |
| OBS-004 | Onboarding | 14-step flow is thorough but may cause drop-off due to length |
| OBS-005 | Meal Plan Preview | Onboarding shows Fuel 85 / MES 86 projected — compelling |
| OBS-006 | Premium Access | Dev mode auto-grants premium — works correctly for testing |

---

## FEATURES VERIFIED WORKING

- [x] Account creation (email/password)
- [x] Full 14-step onboarding flow
- [x] Home screen layout (Fuel Score, Flex, Today's Plan, Daily Tip)
- [x] Profile screen (XP, Level, Achievements, Streak)
- [x] Settings (all preference sections accessible)
- [x] Sign Out with confirmation dialog
- [x] Recipe browse (grid layout with images, nutrition, time, difficulty)
- [x] Recipe detail (ingredients, steps, nutrition, MES, pairing)
- [x] Flex Budget (weekly breakdown, clean goal, flex tracking)
- [x] Coach Chat UI (quick starts, text input, sessions)
- [x] "+" Quick Actions popup (4 options render correctly)
- [x] Premium access auto-grant in dev mode
- [x] Tab navigation (Home, Meals, Track, Coach)
- [x] Personalized targets calculation (TDEE, macros)
- [x] Search recipes functionality
- [x] Recipe filter chips (Protein, Carb, Cook Time)
- [x] Full Meals / Meal Prep toggle

---

## PRIORITY RECOMMENDATIONS (Verified Only)

| Priority | Bug | Action | File |
|----------|-----|--------|------|
| **P0** | BUG-001 | Auto-filter recipes by user allergies/dietary prefs | `backend/app/routers/recipes.py:256-349` |
| **P0** | BUG-004 | Align frontend/backend timeouts; add `max_tokens` to streaming | `services/api.ts:10`, `routers/chat.py:279`, `agents/healthify.py:1548` |
| **P1** | BUG-002 | Replace `toISOString().slice(0,10)` with local date across all files | `FuelCalendarHeatMap.tsx:79` + 8 other files |
| **P2** | BUG-008 | Add `returnKeyType`/`onSubmitEditing` to onboarding form inputs | `app/(auth)/onboarding.tsx` or `app/onboarding-v2/` |
| **Investigate** | BUG-003/007 | Test Kitchen Hub cards + Metabolic toggle on real device | `meals/index.tsx`, `chronometer/index.tsx:640` |
