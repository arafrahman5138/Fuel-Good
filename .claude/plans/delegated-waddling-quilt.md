# Comprehensive App Testing Plan - 4 User Profiles

## Context
Fuel Good is a nutrition app built on a reward-based system (not restriction). Users eat clean whole-food meals, earn Flex (cheat) meals, and track two scores: Fuel Score (ingredient quality, 0-100) and MES (Metabolic Energy Score, energy prediction). The app has meal planning, recipe browsing, AI coaching, scanning, gamification, and detailed nutrition tracking.

We need to simulate a full week of usage for 4 different test users in the iPhone Simulator, testing every feature and edge case visually and functionally, and documenting all bugs found.

## Prerequisites
1. Start backend server (PostgreSQL + FastAPI on port 8000)
2. Start frontend Expo dev server
3. Open iPhone Simulator
4. Ensure backend DB is seeded with recipes

## 4 Test User Profiles

### User 1: "Alex" - Young Athletic Male
- **Name:** Alex Test
- **Email:** alex.test@fuelgood.dev
- **Age:** 24, Male, 6'1" (73in), 185 lbs
- **Body fat:** 14% (visual)
- **Activity:** Athletic
- **Goal:** Muscle gain
- **Dietary:** None (eats everything)
- **Flavors:** Savory, Spicy, Smoky
- **Allergies:** None
- **Protein prefs:** Likes chicken, beef, fish
- **Purpose:** Tests the "ideal" user path - no restrictions, high activity, straightforward scoring

### User 2: "Maria" - Middle-aged Female with Health Conditions
- **Name:** Maria Test
- **Email:** maria.test@fuelgood.dev
- **Age:** 52, Female, 5'4" (64in), 195 lbs
- **Body fat:** 35% (bioimpedance)
- **Activity:** Sedentary
- **Goal:** Fat loss
- **Health flags:** Insulin resistant, Prediabetic
- **Dietary:** Gluten-free
- **Flavors:** Mediterranean, Comfort, Mild
- **Allergies:** Gluten, Shellfish
- **Protein prefs:** Likes chicken, fish; Dislikes red meat
- **Purpose:** Tests metabolic risk adjustments, stricter thresholds, dietary filtering, health condition personalization

### User 3: "Priya" - Vegan with Multiple Allergies
- **Name:** Priya Test
- **Email:** priya.test@fuelgood.dev
- **Age:** 30, Female, 5'6" (66in), 135 lbs
- **Body fat:** 22% (visual)
- **Activity:** Moderate
- **Goal:** Maintenance
- **Dietary:** Vegan
- **Flavors:** Fresh, Herby, Citrus
- **Allergies:** Tree nuts, Soy
- **Protein prefs:** Likes lentils, chickpeas; Dislikes tofu (soy)
- **Disliked ingredients:** Mushrooms, Olives
- **Purpose:** Tests extreme dietary filtering (vegan + nut-free + soy-free), ensures meal plans don't include animal products or allergens

### User 4: "James" - Older Male, Metabolic Reset
- **Name:** James Test
- **Email:** james.test@fuelgood.dev
- **Age:** 62, Male, 5'10" (70in), 245 lbs
- **Body fat:** 32% (calipers)
- **Activity:** Sedentary
- **Goal:** Metabolic reset
- **Health flags:** Type 2 diabetes, Insulin resistant
- **Dietary:** Low-carb
- **Flavors:** Savory, Smoky, Comfort
- **Allergies:** Dairy
- **Protein prefs:** Likes beef, fish, eggs; Dislikes pork
- **Purpose:** Tests strictest metabolic thresholds (T2D), low-carb + dairy-free filtering, metabolic reset pathway, highest ISM adjustments

## Testing Plan Per User (Repeated 4x)

### Phase 1: Registration & Onboarding
1. **Register** with email/password
2. **Complete full onboarding** (all 14 steps) with user-specific data
3. **Verify:** Metabolic profile saved correctly, budget computed, personalized targets shown
4. **Edge cases:** Back navigation during onboarding, skipping optional fields, invalid inputs

### Phase 2: Home Screen Audit
1. **Visual audit:** Layout, spacing, colors, text truncation, dark/light mode
2. **Verify scores:** MES score display (should be 0 or N/A with no meals logged)
3. **Verify flex budget:** Should show initial state
4. **Verify streaks:** Should be 0
5. **Quick actions:** Test all quick action buttons navigate correctly
6. **Calendar:** Tap different dates, verify data changes
7. **Pull-to-refresh:** Verify data reloads

### Phase 3: Meal Plan Generation & Usage
1. **Generate meal plan** from Meals tab → My Plan
2. **Verify:** Plan respects dietary preferences, allergies, protein preferences
3. **Verify:** 7 days of meals with breakfast/lunch/dinner
4. **Tap each meal** → verify recipe detail loads correctly
5. **Log meals from plan** → verify they appear in chronometer
6. **Replace a meal** → verify alternatives respect dietary constraints
7. **Edge cases:** Generate plan with restrictive diet (User 3 - vegan+nut-free+soy-free)

### Phase 4: Recipe Browsing & Logging
1. **Browse recipes** with various filters (cuisine, time, difficulty, dietary)
2. **View recipe detail** → verify ingredients, steps, nutrition, MES badge, fuel score
3. **Log a recipe** → verify success modal, appears in chronometer
4. **Plate composer:** Add multiple components, verify combined nutrition/MES
5. **Save recipe** → verify it appears in Saved tab
6. **Cook mode:** Enter cook mode, navigate steps, check off ingredients, complete
7. **Edge cases:** Filter combinations that return 0 results, very long recipe names

### Phase 5: Food Scanning
1. **Meal photo scan:** Upload pizza image from simulator photos
2. **Verify:** AI analysis returns label, fuel score, MES, ingredients, confidence
3. **Log scanned meal** → verify it appears in chronometer with correct scores
4. **Product scan:** Test with a product image if available
5. **Edge cases:** Poor quality image, unusual food, very small portions

### Phase 6: Nutrition Tracking (Chronometer)
1. **View daily summary** after logging several meals
2. **Verify:** MES ring updates, macro rings show progress vs targets
3. **Verify:** Energy budget card shows remaining protein/carbs/fat/fiber
4. **Verify:** Fuel score and flex budget update correctly
5. **Delete a meal log** → verify scores recalculate
6. **Food search:** Search for individual foods, log them
7. **Edge cases:** Log 0 meals (empty state), log many meals (overflow), same meal multiple times

### Phase 7: Flex System
1. **Navigate to Flex screen** from home
2. **Log several clean meals** to build flex budget
3. **Verify:** Flex tickets fill up as clean meals are logged
4. **Log a manual flex meal** (pizza, burger, etc.)
5. **Verify:** Weekly average calculation includes flex meals
6. **Verify:** Flex onboarding presets (Relaxed/Balanced/Strict) change targets
7. **Edge cases:** Use all flex meals, log flex with no clean meals first

### Phase 8: AI Coach (Chat)
1. **Open chat** and verify suggested queries
2. **Send a message** asking for a recipe
3. **Verify:** AI responds with recipe card (ingredients, macros, MES)
4. **Save recipe from chat** → verify it appears in saved
5. **Cook recipe from chat** → verify cook mode works
6. **Upload image in chat** → verify meal analysis
7. **Chat history:** Verify sessions are saved and loadable
8. **Edge cases:** Very long messages, rapid-fire messages, empty messages

### Phase 9: Metabolic Coach
1. **Navigate to metabolic coach** from home
2. **Verify:** Personalized insights based on current scores
3. **Verify:** Meal suggestions match dietary preferences
4. **Tap suggested recipe** → verify navigation works

### Phase 10: Gamification
1. **Check daily quests** → verify quests generated for today
2. **Complete quest requirements** (log meals, etc.)
3. **Verify:** Quest progress updates, XP awarded on completion
4. **Check achievements** → verify locked/unlocked states
5. **Verify:** Streaks update correctly (log meals on consecutive days)
6. **Check XP and level** → verify level progression math

### Phase 11: Profile & Settings
1. **View profile** → verify name, level, XP, achievements display
2. **Change avatar** → verify it persists
3. **Settings:** Toggle theme (light/dark/system)
4. **Settings:** Adjust budget weights → verify scores recalculate
5. **Preferences:** Update dietary preferences → verify meal plan respects changes
6. **Edge cases:** Extreme weight values, all preferences selected, none selected

### Phase 12: Fuel Weekly & MES Breakdown
1. **View fuel weekly** → verify 7-day breakdown
2. **Expand daily rows** → verify meal details shown
3. **View MES breakdown** → verify 4 sub-component rings (PAS, FS, GIS, FAS)
4. **Verify:** Scores change appropriately for each user's profile

### Phase 13: Grocery List
1. **Generate grocery list** from meal plan
2. **Verify:** Items organized by category
3. **Check off items** → verify persistence
4. **Edge cases:** Empty plan, plan with bulk cook items

### Phase 14: Cross-Cutting Concerns
1. **Navigation:** Test all back buttons, deep links, tab switching
2. **Loading states:** Verify shimmer/skeleton screens appear
3. **Error states:** Test with no network (airplane mode)
4. **Empty states:** Verify empty state messages for all lists
5. **Scroll behavior:** Long lists, pull-to-refresh, sticky headers
6. **Keyboard handling:** Input fields, keyboard dismiss
7. **Typography:** Text truncation, long names, special characters
8. **Responsive:** Different content lengths, dynamic data

## Bug Report Format
For each bug found:
- **ID:** BUG-XXX
- **User:** Which test user
- **Screen:** Where it occurs
- **Severity:** Critical/High/Medium/Low
- **Description:** What's wrong
- **Steps to reproduce:** Exact steps
- **Expected:** What should happen
- **Actual:** What actually happens
- **Screenshot:** If visual

## Execution Order
1. Start backend + frontend servers
2. **User 1 (Alex)** - Full test suite (most thorough, establishes baseline)
3. **User 2 (Maria)** - Full test suite (focus on health condition personalization)
4. **User 3 (Priya)** - Full test suite (focus on dietary filtering edge cases)
5. **User 4 (James)** - Full test suite (focus on strictest metabolic thresholds)
6. Compile bug report with all findings

## Verification
- All bugs documented in `tasks/bug-report-comprehensive.md`
- Screenshots captured for visual bugs
- Each user's onboarding data verified via API
- Scores verified to match expected personalization per user profile
