# Comprehensive Bug Report - Fuel Good App Testing

**Testing Date:** April 2, 2026
**Tester:** Automated (Claude)
**Platform:** iPhone 17 Pro Simulator (iOS 26.2)
**Backend:** FastAPI (localhost:8000)
**Frontend:** Expo Go (localhost:8081)
**Total Tests:** 131 API tests + 14 phases of visual testing across 4 users

---

## Test Users

| User | Profile | Key Restrictions |
|------|---------|-----------------|
| Alex Test | 24M, 185 lbs, Athletic, Muscle Gain | None |
| Maria Test | 52F, 195 lbs, Sedentary, Fat Loss | Gluten-free, Insulin Resistant, Prediabetic |
| Priya Test | 30F, 135 lbs, Moderate, Maintenance | Vegan, Tree Nut + Soy Allergies |
| James Test | 62M, 245 lbs, Sedentary, Metabolic Reset | Low-Carb, Dairy-Free, Type 2 Diabetes |

---

## Bug Summary

| ID | Severity | Category | Title |
|----|----------|----------|-------|
| BUG-001 | P0 Critical | Meal Planning | Meal plan generation returns 0 items for restrictive diets |
| BUG-002 | P0 Critical | Metabolic Engine | T2D sugar ceiling higher than insulin resistance (safety issue) |
| BUG-003 | P0 Critical | Meal Planning | Meal plan shows non-vegan meals for vegan user |
| BUG-004 | P0 Critical | Meal Planning | Meal plan shows red meat for user who dislikes red meat |
| BUG-005 | P1 High | Calorie Targets | Muscle gain user gets 913-calorie deficit target |
| BUG-006 | P1 High | API Validation | Future dates accepted for meal logging |
| BUG-007 | P1 High | API Validation | Very old dates (6+ years) accepted for meal logging |
| BUG-008 | P1 High | API Validation | 0 servings silently overridden to 1 |
| BUG-009 | P1 High | Gamification | Fuel streak always shows 0 for all users |
| BUG-010 | P2 Medium | Settings UI | Liked Proteins shows "Not set" despite being set via API |
| BUG-011 | P2 Medium | Metabolic API | sugar_remaining_g missing from remaining-budget endpoint |
| BUG-012 | P2 Medium | Chat/Coach | AI chat response stalls mid-generation (partial response) |
| BUG-013 | P2 Medium | Onboarding | Calorie target inconsistency between onboarding and home screen |
| BUG-014 | P2 Medium | Settings | Privacy Policy link shows "Unavailable" error in dev build |
| BUG-015 | P3 Low | Home Screen | Notification badge shows "0" (should hide when count is 0) |
| BUG-016 | P3 Low | Navigation | Meal Plan back button doesn't navigate to Meals index |
| BUG-017 | P3 Low | Meal Plan | Meal Plan date range shows stale dates (Mar 16-22 on Apr 2) |

---

## Detailed Bug Reports

### BUG-001: Meal plan generation returns 0 items for restrictive diets
- **Severity:** P0 Critical
- **Users Affected:** Priya (vegan + nut-free + soy-free), James (low-carb + dairy-free + T2D)
- **Endpoint:** `POST /api/meal-plans/generate`
- **Steps to Reproduce:**
  1. Login as Priya or James
  2. Call meal plan generate endpoint
  3. Observe 0 items returned with warnings
- **Expected:** Weekly meal plan with 21 items respecting dietary restrictions, or partial plan with clear messaging
- **Actual:** 0 items returned. Warnings: "No breakfast/lunch/dinner recipes could be selected."
- **Root Cause:** Recipe library lacks sufficient coverage for extreme dietary combinations. Planner returns empty plan instead of graceful fallback.
- **Impact:** These users cannot use the meal planning feature at all.

### BUG-002: T2D sugar ceiling higher than insulin resistance (safety issue)
- **Severity:** P0 Critical
- **Users Affected:** James (T2D) vs Maria (Insulin Resistant)
- **Endpoint:** `GET /api/metabolic/budget`
- **Steps to Reproduce:**
  1. Compare Maria's sugar_ceiling_g (76.0g) with James's (90.0g)
- **Expected:** James (T2D, more severe condition) should have the LOWEST sugar ceiling
- **Actual:** Maria (76.0g) < James (90.0g). Insulin resistance gets stricter limits than T2D.
- **Root Cause:** Metabolic engine's sugar ceiling derivation does not properly weight T2D as more severe than insulin resistance.
- **Impact:** James receives potentially unsafe sugar guidance for a T2D patient.

### BUG-003: Meal plan shows non-vegan meals for vegan user
- **Severity:** P0 Critical
- **Users Affected:** Priya
- **Screen:** Home Screen > Today's Plan
- **Steps to Reproduce:**
  1. Login as Priya (dietary_preferences: vegan)
  2. View home screen Today's Plan section
- **Expected:** Only vegan meals shown
- **Actual:** Shows "Chicken Sausage Kale Scramble", "Creamy Red Pepper Chicken Rice Bowl", "Crispy Beef Tacos" - ALL contain animal products
- **Root Cause:** The displayed plan appears to be a default/shared plan not filtered by user preferences. The plan shown on the home screen was not generated via the /meal-plans/generate endpoint (which correctly returns 0 items for Priya).
- **Impact:** Vegan user sees meals with chicken and beef, violating their dietary restrictions.

### BUG-004: Meal plan shows red meat for user who dislikes red meat
- **Severity:** P0 Critical
- **Users Affected:** Maria
- **Screen:** Home Screen > Today's Plan
- **Steps to Reproduce:**
  1. Login as Maria (disliked_ingredients: ["red meat"])
  2. View home screen Today's Plan section
- **Expected:** No red meat in meal suggestions
- **Actual:** Shows "Crispy Beef Tacos" - beef is red meat
- **Root Cause:** Plan doesn't respect disliked_ingredients or protein_preferences.dislikes
- **Impact:** User sees meals with ingredients they explicitly dislike.

### BUG-005: Muscle gain user gets 913-calorie deficit target
- **Severity:** P1 High
- **Users Affected:** Alex
- **Screen:** Onboarding > "Your personalized targets"
- **Steps to Reproduce:**
  1. Complete onboarding as Alex (185 lbs, athletic, goal: build muscle)
  2. View personalized targets screen
- **Expected:** Calorie target at maintenance or slight surplus for muscle gain (TDEE 3248 -> target ~3400-3500)
- **Actual:** TDEE: 3248 cal, Target: ~2335 cal/day (913 calorie DEFICIT)
- **Root Cause:** Calorie target formula may not account for muscle gain goal requiring surplus
- **Impact:** User trying to build muscle is given a weight loss calorie target.

### BUG-006: Future dates accepted for meal logging
- **Severity:** P1 High
- **Endpoint:** `POST /api/nutrition/logs`
- **Steps to Reproduce:** Log a meal with date "2027-01-01"
- **Expected:** 422 validation error
- **Actual:** 200 OK, meal logged successfully for future date
- **Impact:** Data integrity risk; could corrupt analytics.

### BUG-007: Very old dates accepted for meal logging
- **Severity:** P1 High
- **Endpoint:** `POST /api/nutrition/logs`
- **Steps to Reproduce:** Log a meal with date "2020-01-01"
- **Expected:** Rejection or warning for dates >1 year old
- **Actual:** 200 OK, accepted without validation
- **Impact:** Data integrity risk.

### BUG-008: 0 servings silently overridden to 1
- **Severity:** P1 High
- **Endpoint:** `POST /api/nutrition/logs`
- **Steps to Reproduce:** Log a meal with servings=0
- **Expected:** 422 validation error
- **Actual:** 200 OK, servings silently changed to 1.0 with full nutrition values
- **Impact:** Confusing behavior; user thinks they logged 0 but gets 1 serving.

### BUG-009: Fuel streak always shows 0 for all users
- **Severity:** P1 High
- **Endpoint:** `GET /api/fuel/streak`
- **Users Affected:** All
- **Steps to Reproduce:**
  1. Log meals achieving fuel score > 80 target
  2. Check fuel streak
- **Expected:** Streak >= 1 for users meeting target
- **Actual:** current_streak=0, longest_streak=0 for ALL users, even those with daily avg above 80
- **Impact:** Fuel streak gamification feature is non-functional.

### BUG-010: Liked Proteins shows "Not set" despite being set via API
- **Severity:** P2 Medium
- **Users Affected:** Maria (and likely all users)
- **Screen:** Settings > Liked Proteins
- **Steps to Reproduce:**
  1. Set protein_preferences via PUT /api/auth/preferences
  2. View Settings screen > Liked Proteins row
- **Expected:** Shows "chicken, fish" (Maria's preferences)
- **Actual:** Shows "Not set"
- **Root Cause:** Settings screen may not be reading from the protein_preferences object correctly, or the display logic doesn't parse the nested JSON structure.

### BUG-011: sugar_remaining_g missing from remaining-budget endpoint
- **Severity:** P2 Medium
- **Endpoint:** `GET /api/metabolic/remaining-budget`
- **Expected:** Response includes sugar_remaining_g field
- **Actual:** Field not present
- **Impact:** Frontend cannot display remaining sugar budget.

### BUG-012: AI chat response stalls mid-generation
- **Severity:** P2 Medium
- **Users Affected:** Alex
- **Screen:** Coach > Chat
- **Steps to Reproduce:**
  1. Open Coach tab
  2. Type "Give me a high protein breakfast recipe"
  3. Send message
- **Expected:** Complete recipe response with recipe card
- **Actual:** Response starts streaming ("Hey there! I noticed you asked for a breakfast recipe, but since it's lunch time and you're crushing your muscle gain goals,") then stalls indefinitely. No recipe card rendered.
- **Note:** The AI correctly personalizes (knows muscle gain goals and current time), but the response never completes.

### BUG-013: Calorie target inconsistency between onboarding and home screen
- **Severity:** P2 Medium
- **Users Affected:** Alex
- **Screen:** Onboarding targets vs Home Screen macro rings
- **Steps to Reproduce:**
  1. During onboarding, note calorie target (~2335)
  2. After logging meals, view macro rings on home screen
  3. Home screen shows 2054/2804 cal target
- **Expected:** Same calorie target in both places
- **Actual:** Onboarding shows ~2335 cal, home screen shows 2804 cal target
- **Root Cause:** Different calorie calculations between onboarding display and metabolic budget computation.

### BUG-014: Privacy Policy link shows "Unavailable" error
- **Severity:** P2 Medium
- **Screen:** Settings > Privacy Policy
- **Steps to Reproduce:** Tap "Privacy Policy" in settings
- **Expected:** Opens privacy policy page
- **Actual:** Alert: "Unavailable - Privacy policy URL has not been configured for this build"
- **Note:** May be dev-build specific, but should show a fallback or placeholder.

### BUG-015: Notification badge shows "0"
- **Severity:** P3 Low
- **Screen:** Home Screen header
- **Steps to Reproduce:** View home screen with 0 notifications
- **Expected:** Badge hidden when count is 0
- **Actual:** Shows green badge with "0"
- **Impact:** Minor visual clutter; standard UX is to hide empty badges.

### BUG-016: Meal Plan back button doesn't navigate to Meals index
- **Severity:** P3 Low
- **Screen:** Meals tab > Meal Plan
- **Steps to Reproduce:**
  1. Navigate to Meals tab > view Meal Plan
  2. Tap back arrow (top left)
- **Expected:** Returns to Meals menu (6-card grid)
- **Actual:** Back button has no effect; user is stuck on Meal Plan screen
- **Impact:** Navigation dead-end.

### BUG-017: Meal Plan shows stale date range
- **Severity:** P3 Low
- **Screen:** Meals tab > Meal Plan
- **Steps to Reproduce:** View Meal Plan for Alex on April 2, 2026
- **Expected:** Current week's dates
- **Actual:** Shows "Mar 16 - Mar 22" (2+ weeks old)
- **Impact:** Confusing stale data.

---

## What Passed (Highlights)

### Visual/UI (All Users)
- Login/registration flow works correctly
- Onboarding flow is smooth with proper step progression and back navigation
- Flavor, dietary, allergy selection chips work correctly
- Body metrics input (weight, height, age) accepts valid values
- Profile screen correctly shows name, email, level, XP, achievements
- Settings page displays all preference categories correctly
- Dark mode renders correctly across all screens
- Tab bar navigation works between Home, Meals, Track, Coach
- Fuel Score ring visualization updates after logging meals
- MES score badge displays correctly on recipe cards
- Achievement tiles display with unlock states
- Pull-to-refresh updates data on home screen
- Recipe detail page shows correct info (time, calories, servings, tags)
- Cook mode and Log This Meal buttons present on recipe detail

### API (131 tests, 121 passed)
- All auth endpoints (register, login, social, refresh, profile, preferences)
- Metabolic profiles personalized correctly per user
- Metabolic budgets computed differently per user (protein/fiber/sugar targets vary)
- Recipe browsing with filters (dietary, cuisine, time)
- Nutrition logging creates logs with correct fuel scores
- Daily summaries correctly sum nutrition across meals
- MES scores are personalized (Alex: 79, Maria: 51, Priya: 48, James: 67)
- Health Pulse composite scoring works
- Gamification (XP, levels, achievements, quests, leaderboard)
- Coach insights personalized per user's score tier
- Grocery list generation from meal plan
- Fuel settings update correctly affects flex budget
- Log deletion triggers score recalculation
- Token security (invalid/expired/missing tokens return 401)

---

## Recommendations

### P0 - Fix Immediately
1. **Expand recipe library** for restrictive diets OR implement graceful fallback in meal planner (partial plans with warnings instead of empty results)
2. **Fix T2D sugar ceiling logic** - T2D must always produce a stricter ceiling than insulin resistance alone
3. **Fix meal plan display on home screen** - ensure Today's Plan respects user's dietary preferences and disliked ingredients

### P1 - Fix Before Release
4. **Fix calorie targets for muscle gain** - should be at maintenance or surplus, not deficit
5. **Add date validation** to nutrition logging (reject future dates, reject >90 days past)
6. **Add servings validation** (reject servings <= 0)
7. **Fix fuel streak calculation** - daily scores above target should increment streak

### P2 - Fix Soon
8. **Fix Liked Proteins display** in settings
9. **Add sugar_remaining_g** to remaining-budget endpoint
10. **Investigate AI chat stalling** - streaming response cuts off mid-generation
11. **Fix calorie target consistency** between onboarding and home screen
12. **Configure Privacy Policy URL** for dev builds

### P3 - Nice to Have
13. Hide notification badge when count is 0
14. Fix Meal Plan back button navigation
15. Auto-refresh meal plan date range to current week
