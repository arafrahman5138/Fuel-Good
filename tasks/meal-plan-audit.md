# Meal Plan Functionality — Full Audit Report

**Date**: 2026-03-21
**Tested with**: 7 user profiles via API, UI simulator (Araf's account)

---

## Executive Summary

The meal plan system is **functionally solid** — the deterministic generator, MES scoring, prep timeline, and UI flow all work correctly. However, there is one **critical content gap** (lunch recipes) and several **moderate issues** around recipe diversity, edge cases, and UI polish that limit the user experience.

---

## CRITICAL ISSUES

### 1. Only 1 Lunch Recipe in Entire Database
**Severity**: 🔴 Critical
**Impact**: Every user gets Homestyle Smash Burger for lunch 7 days a week

**Evidence**:
- All 7 tested users received identical lunch plans: `Homestyle Smash Burger x7`
- Shortlist API returns only 1 lunch candidate
- Alternatives API returns 0 options for lunch items (can't replace)
- The "Replace" button in the UI is non-functional for lunch — no alternatives exist

**Root cause**: Of 29 full meals, only 1 is tagged `lunch`. The remaining 21 non-breakfast meals are all tagged `dinner`.

**Fix**: Many dinner recipes would work perfectly as lunch. Dual-tag appropriate meals with both `lunch` and `dinner`. Good candidates (≤600 cal, ≤30min):
- Air Fryer Gochujang Chicken Skewers (320 cal, 30 min)
- Bang Bang Chicken Skewers (380 cal, 30 min)
- Beef and Broccoli Stir-Fry (380 cal, 30 min)
- Chicken Shawarma Bowl (420 cal, 30 min)
- Butter Chicken Bowl (420 cal, 30 min)
- Butter Chicken Bowl Plus (420 cal, 15 min)
- Chickpea Mac N' Beef (507 cal, 30 min)
- Creamy Corn Salmon Chickpea Pasta (430 cal, 25 min)
- Beef and Cheese Borek Rolls (420 cal, 26 min)

### 2. Vegetarian User Gets Only Breakfast — No Lunch or Dinner
**Severity**: 🔴 Critical
**Impact**: Vegetarian users receive a 7-item plan (breakfast only) instead of 21

**Evidence**:
- E2E Tester (vegetarian): 7 items total, 0 lunch, 0 dinner
- Only 1 recipe tagged `vegetarian`: Greek Yogurt Chia Protein Bowl (breakfast)
- Warnings generated: "No lunch recipes could be selected" + "No dinner recipes could be selected"

**Fix**:
- Add vegetarian lunch and dinner recipes to the database
- Consider adding existing recipes that are naturally vegetarian but not tagged (e.g., some pasta dishes without meat)
- At minimum, the UI should clearly communicate when a diet restriction results in missing meals rather than silently showing an incomplete plan

---

## MODERATE ISSUES

### 3. Incomplete Test User Profiles
**Severity**: 🟡 Moderate
**Impact**: Testing accuracy reduced; profiles don't represent real users well

**Details**:
| User | Missing Fields |
|------|---------------|
| E2E Tester | Weight=None, Height=None, goal="maintain" (should be "maintenance") |
| Edge Tester | No metabolic profile at all → gets "Premium subscription required" error |
| Alex Tester | No metabolic profile → no personalized budget |
| Sarah FatLoss | Height=None |
| Mike Muscle | Height=None |
| Maria Maintain | Height=None |
| Rob Reset | Height=None |
| Irene Insulin | Height=None |

**Fix**: Update test user profiles with complete, realistic data. Fix E2E Tester's goal enum from "maintain" to "maintenance".

### 4. Breakfast Calorie Filter Inconsistency
**Severity**: 🟡 Moderate
**Impact**: Different users may see different breakfast pools without understanding why

**Details**:
- Default limits: ≤15g carbs, ≤450 cal → only 4/7 breakfasts pass
- Personalized limits (most users): ~566 cal → all 7 pass
- Irene Insulin (low calorie target 1697): ~481 cal → 6/7 pass (Steak & Eggs excluded at 510 cal)
- For users without metabolic profiles, the strict defaults apply, reducing variety

**Observation**: The breakfast filter is well-designed for personalization but the defaults are quite restrictive. This is fine if all users complete onboarding, but users who skip it get artificially limited breakfast options.

### 5. Limited Recipe Diversity for Plans
**Severity**: 🟡 Moderate
**Impact**: Plans feel repetitive, especially at "variety" mode

**Details**:
- Balanced mode: 4 breakfast, 5 lunch, 5 dinner unique meals targeted
- Actual: 4 breakfast (good), 1 lunch (critical), 5 dinner (good)
- Dinner pool has 21 recipes, but after allergies/dietary filters, available count drops
- For Araf (nut + sesame allergies): still gets full variety ✓
- All tested users get very similar dinner rotations (Sweet Potato Beef Sliders, Beef and Potato Hash, Chickpea Mac N' Beef appear in most plans)

### 6. No Differentiation Between User Goals in Meal Selection
**Severity**: 🟡 Moderate
**Impact**: Fat loss users get same meals as muscle gain users

**Evidence**:
| User | Goal | Dinner Selection |
|------|------|-----------------|
| Sarah (fat_loss) | Fat loss | Sweet Potato Beef Sliders, Beef & Potato Hash, Chickpea Mac, Beef Kebab, Corn Salmon Pasta |
| Mike (muscle_gain) | Muscle gain | Sweet Potato Beef Sliders, Beef & Potato Hash, Bang Bang, Beef Kebab, Corn Salmon Pasta |
| Rob (metabolic_reset) | Reset | Sweet Potato Beef Sliders, Beef & Potato Hash, Bang Bang, Beef Kebab, Corn Salmon Pasta |

The MES scoring provides *some* personalization (different scores per user), but the top-ranked meals are nearly identical across all goals. The budget_alignment_score helps in theory, but with only 21 dinner options, the same meals dominate.

---

## MINOR ISSUES

### 7. Prep Timeline Shows Burger Prep for All 7 Days
**Severity**: 🟢 Minor
**Impact**: Prep timeline card says "Prep Sunday: Homestyle Smash Burger for Monday-Sunday lunches" — suggests prepping burgers for a full week, which is unrealistic for a fresh burger

**Fix**: Burgers should probably not be flagged as bulk_cook/reheat candidates. Consider adding a `bulk_cook_suitable` flag to recipes.

### 8. Missing Meal Images on Shortlist Cards
**Severity**: 🟢 Minor (UX)
**Impact**: Step 2 "Pick meals" cards show only text — less engaging than the main plan view which shows beautiful food photos

**Fix**: Add `image_url` to the shortlist recipe response and render thumbnail images on cards.

### 9. Day Tab Selector Partially Clipped (Sat/Sun)
**Severity**: 🟢 Minor (UX)
**Impact**: "Sat" and "Sun" labels in the day selector are partially cut off on mobile viewport

**Fix**: Make the day selector horizontally scrollable or reduce padding to ensure all 7 days are fully visible.

### 10. "No Internet Connection" Banner Persists
**Severity**: 🟢 Minor (Web only)
**Impact**: Red banner at top of all screens on web preview. Likely caused by Google connectivity check failing in sandboxed environment.

---

## UI/UX OBSERVATIONS

### What Works Well ✅
- **Meal cards**: Beautiful food images, clean layout with MES score ring and fuel badge
- **Nutrition display**: Clear "460 cal · 44g protein · 9g carbs · 28g fat" format
- **Prep badges**: "Quick", "Reheat", "Bulk Cook" tags are clear and well-positioned
- **Replace button**: Easy to find and understand
- **Plan Style selector**: Three clear options (Meal Prep / Balanced / Variety) with good descriptions
- **Projected Energy Score**: Nice weekly MES chart with daily bars
- **Step 1 preferences**: Pulls from user profile automatically, with Edit buttons for each section
- **Flex meals earned**: "This plan earns ~9 flex meals" is a great motivational touch
- **Quality summary**: "3 meals · 1,567 cal · 127g protein" header per day is useful

### What Could Be Better 🔧
- **Shortlist cards lack images** — text-only cards in Step 2 feel jarring after the image-rich plan view
- **Single lunch option** makes the "Include/Avoid" toggles on Step 2 feel broken — user has no meaningful choice for lunch
- **Day tabs clip on small screens** — Sat/Sun partially hidden
- **No empty-state guidance** — when vegetarian user gets 0 lunch/dinner, there's no helpful message about expanding their diet options
- **Prep timeline for unsuitable meals** — burgers shouldn't show "Prep Sunday for the whole week"

---

## OPTIMIZATION PLAN

### Phase 1: Content Gap Fix (Highest Priority)
1. **Dual-tag dinner meals as lunch** — Add `lunch` tag to 8-10 appropriate dinner recipes (see list in Issue #1). This instantly solves the critical lunch variety problem with zero new recipe creation.
2. **Add vegetarian/vegan recipes** — Create 3-5 vegetarian lunch/dinner meals to support dietary restrictions. Consider: veggie stir-fry bowl, lentil curry, chickpea salad, mushroom pasta, black bean burrito bowl.
3. **Review all dietary tags** — Audit existing recipes for meals that are naturally vegetarian/vegan/gluten-free but not tagged.

### Phase 2: Data Quality (High Priority)
4. **Fix test user profiles** — Fill in missing height fields, fix "maintain" → "maintenance" enum, add metabolic profiles for Edge Tester and Alex Tester.
5. **Add `bulk_cook_suitable` flag** — Prevent burgers, salads, and other fresh-only meals from being tagged as bulk cook/reheat.
6. **Review breakfast calorie defaults** — Consider raising BREAKFAST_MAX_CALORIES_DEFAULT from 450 to 500 to include Smoked Salmon Omelet and Chicken Sausage Kale Scramble for users without profiles.

### Phase 3: UX Polish (Medium Priority)
7. **Add images to shortlist cards** — Include `image_url` in shortlist response and render thumbnails in Step 2.
8. **Fix day tab overflow** — Make day selector scrollable or use abbreviated day names.
9. **Add empty-state messaging** — When a meal type has 0 candidates, show a helpful message: "No [lunch] recipes match your dietary restrictions. Consider expanding your preferences."
10. **Differentiate goal-based meal selection** — Add goal-aware scoring: favor higher-protein meals for muscle_gain, lower-calorie for fat_loss, lower-carb for metabolic_reset/insulin_resistant users. This could be done by adjusting the `_budget_alignment_score` weights.

### Phase 4: Future Enhancements (Lower Priority)
11. **Allow cross-tagging meals between lunch/dinner** in the planner logic itself — if lunch candidates < 3, fall back to pulling from dinner pool.
12. **Add meal plan history comparison** — show users what changed between their current and previous plan.
13. **Shortlist "Surprise Me"** — random selection option for users who don't want to manually pick.
14. **Per-day calorie targets** — show how each day's total compares to the user's TDEE.

---

## TEST RESULTS SUMMARY

| User | Profile | Items | Avg MES | Breakfast | Lunch | Dinner | Issues |
|------|---------|-------|---------|-----------|-------|--------|--------|
| Sarah FatLoss | F/30/154lb/fat_loss/active | 21 | 84.3 | 4 unique | 1 (burger x7) | 5 unique | Lunch variety |
| Mike Muscle | M/25/181lb/muscle_gain/athletic | 21 | 80.3 | 4 unique | 1 (burger x7) | 5 unique | Lunch variety |
| Irene Insulin | F/45/187lb/fat_loss/IR | 21 | 81.7 | 3 unique | 1 (burger x7) | 5 unique | Lunch variety, fewer breakfast options |
| Maria Maintain | F/40/137lb/maintenance/moderate | 21 | 85.1 | 4 unique | 1 (burger x7) | 5 unique | Lunch variety |
| Rob Reset | M/50/221lb/metabolic_reset/sedentary | 21 | 80.5 | 4 unique | 1 (burger x7) | 5 unique | Lunch variety |
| Araf (allergies) | M/26/165lb/maintenance/active | 21 | 83.5 | 4 unique | 1 (burger x7) | 5 unique | Lunch variety |
| Vegetarian | vegetarian diet | 7 | 85.4 | 1 unique | 0 | 0 | **No lunch/dinner at all** |
| Edge (no profile) | None | N/A | N/A | N/A | N/A | N/A | Premium required error |
