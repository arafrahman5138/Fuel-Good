# Fuel Good - Week-Long Simulator Test Results

**Date:** 2026-03-28
**Tester:** Automated (Claude)
**Method:** API testing + iOS Simulator UI verification (iPhone 17 Pro)
**Personas tested:** 4 (Sarah, Marcus, Priya, James)
**Total API calls:** 100+
**Meals logged:** 66 (21 Sarah + 15 each for Marcus/Priya/James)

---

## Executive Summary

### Overall: 13 endpoints tested, all functional. 8 bugs/issues identified.

| Category | Status | Critical Issues |
|----------|--------|-----------------|
| Auth & Registration | PASS | None |
| Onboarding & Preferences | PASS | None |
| Meal Plan Generation | PARTIAL FAIL | Empty plans for keto/vegan/paleo |
| Recipe Browse | PASS | No dietary filtering support |
| Meal Logging | PASS | All 66 logs created successfully |
| Fuel Score System | PASS | Correct 100.0 for clean, 35.0 for flex |
| MES Scoring | PASS | Per-meal scores working (82-92 range) |
| Flex System | PASS (concern) | Snack-type flex bypasses budget |
| Gamification | PASS (concern) | Streak not accumulating properly |
| AI Coach/Chat | PASS (concern) | Ignores user dietary profile |
| Food Search | PASS (sparse) | 0 results for common foods |
| Grocery List | PASS | 100 items generated, $0 cost |
| UI/Navigation | PASS | Dashboard, tabs, data display correct |

---

## Test User Personas

| Persona | Diet | Allergies | Goal | Flex |
|---------|------|-----------|------|------|
| Sarah Thompson | Gluten-free | Nuts, wheat | Fat loss | Balanced (80%) |
| Marcus Johnson | Keto | None | Muscle gain | Strict (90%) |
| Priya Sharma | Vegan | Soy, sesame | Maintenance | Relaxed (70%) |
| James Mitchell | Paleo | Shellfish, eggs | Metabolic reset | Balanced (80%) |

---

## Bugs Found (Priority Order)

### BUG 1: Meal Plan Generation Returns 0 Meals for Keto/Vegan/Paleo [CRITICAL]
- **Affected personas:** Marcus (keto), Priya (vegan), James (paleo)
- **Details:** POST /api/meal-plans/generate returns a plan with 0 items and warnings "No breakfast/lunch/dinner recipes could be selected"
- **Root cause:** Recipe database has 0 recipes tagged "keto" or "paleo". Only 8 tagged "vegan" (insufficient for 21 meals/week). Only "gluten-free" (67 recipes) and "dairy-free" (41) have adequate coverage.
- **Impact:** 3 of 7 dietary preferences produce completely empty meal plans
- **Recommendation:** Tag existing recipes with keto/paleo labels where applicable, and add dedicated recipes for these diets

### BUG 2: Allergen Violation in Generated Meal Plan [HIGH]
- **Affected persona:** Sarah (nut allergy)
- **Details:** Sarah's meal plan includes "Greek Yogurt Chia Protein Bowl" with **almond butter** — a tree nut. Sarah has "nuts" listed in allergies.
- **Impact:** Allergen violation in auto-generated meal plan could be dangerous
- **Recommendation:** Strengthen allergen filtering to check ingredient-level data, not just recipe-level tags

### BUG 3: Chat/Healthify Ignores User Dietary Profile [MEDIUM]
- **Affected persona:** James (paleo)
- **Details:** James asked to "healthify a breakfast burrito" and got **black beans and whole wheat tortilla** — both non-paleo. The AI used his explicit constraints (no eggs/shellfish) but didn't cross-reference his stored paleo preference.
- **Recommendation:** Inject user's dietary_preferences and allergies into the healthify prompt context

### BUG 4: Streak Not Accumulating Across Days [MEDIUM]
- **Affected:** All 4 personas
- **Details:** Sarah logged 7 consecutive days, current_streak = 1. Others logged 5 days each, also streak = 1.
- **Note:** UI showed "Energy Streak: Bronze! 3 days" which conflicts with API reporting streak=1

### BUG 5: Nutrition Score "Poor" Despite Perfect Food Quality [MEDIUM]
- **Details:** Health Pulse shows Nutrition Score = 40.6 (Poor) despite Fuel = 100.0 and MES = 86.9
- **Root cause:** Scoring penalizes users whose calorie totals (~1300-1500) are below targets (2200)
- **Impact:** Users eating all planned meals still see "poor" nutrition grades

### BUG 6: Flex Snack Loophole [LOW]
- **Details:** Flex meals logged as "snack" type don't decrement flex_available
- **Impact:** Unlimited cheat snacks without flex budget impact

### BUG 7: Food Search Returns Empty for Common Foods [LOW]
- **Details:** "grilled chicken breast" and "brown rice" return 0 results
- **Root cause:** LocalFood catalog is sparse

### BUG 8: Grocery Price Estimation Returns $0 [LOW]
- **Details:** total_estimated_cost = $0.00 for all grocery lists
- **Impact:** Price feature non-functional

---

## Verification Matrix

| Check | Sarah (GF) | Marcus (Keto) | Priya (Vegan) | James (Paleo) |
|---|---|---|---|---|
| Meal plan generated | ✅ 21 meals | ❌ 0 meals | ❌ 0 meals | ❌ 0 meals |
| Allergen violations | ❌ 1 (almond) | N/A | N/A | N/A |
| Meal logging works | ✅ 21/21 | ✅ 15/15 | ✅ 15/15 | ✅ 15/15 |
| Fuel Score correct | ✅ 100.0 | ✅ 100.0 | ✅ 100.0 | ✅ 100.0 |
| MES calculated | ✅ 86.9 | ✅ (per-meal) | ✅ (per-meal) | ✅ (per-meal) |
| Flex budget correct | ✅ 4 avail | ✅ 4→3 | ⚠️ Snack bypass | ✅ 4→3 |
| Weekly avg correct | ✅ 100.0 | ✅ 95.7 | ✅ 98.6 | ✅ 95.7 |
| Streak tracking | ⚠️ Shows 1 | ⚠️ Shows 1 | ⚠️ Shows 1 | ⚠️ Shows 1 |
| XP/Level progress | ✅ Lv4 3725XP | ✅ Lv2 1825XP | ✅ Lv2 1725XP | ✅ Lv2 1825XP |
| Achievements | ✅ 10/56 | ✅ 6/56 | ✅ 5/56 | ✅ 6/56 |
| Chat respects diet | ✅ | ✅ | ✅ | ❌ Non-paleo |
| Data persists | ✅ | ✅ | ✅ | ✅ |

---

## UI Verification (iOS Simulator Screenshots)

### Screens Verified:
1. **Login Screen** — Email/password form, validation messages, Sign Up link
2. **Home Dashboard** — Greeting, fuel ring, flex count, plan, daily tips, streak badge
3. **Meals Tab (Kitchen Hub)** — 6 cards: Meals, Meal Prep, Desserts, My Plan, Saved, Grocery
4. **Track/Chronometer** — Weekly fuel (ELITE FUEL badge), calendar with green dots, daily breakdown with per-meal MES/Fuel scores, macro rings
5. **Coach/Chat** — Chat history persists, AI responses, input field

### UI Observations:
- ✅ Personalized greeting "Good morning, Sarah"
- ✅ "ELITE FUEL" badge and "On Track" status after week of logging
- ✅ "4 flex meals available" correct
- ✅ "21 of 21 meals logged this week" tracking
- ✅ Calendar shows green circles on all 7 logged days
- ✅ Per-meal cards show both MES and Fuel (e.g., "86 | 100")
- ✅ Macro rings: CAL 1427/2200, PROTEIN 127/130g, CARBS 60/100g, FAT 80/75g
- ✅ Tab bar navigation works across all tabs
- ✅ Chat sessions persist between tab switches
- ⚠️ "Energy Streak: Bronze! 3 days" on home vs streak=1 in API (inconsistency)

---

## Scoring Results Detail

### Sarah's Week (21 meals, all from plan)
| Day | Calories | Protein | Carbs | Fat | Daily Score |
|-----|----------|---------|-------|-----|-------------|
| Mon | 1397 | 129g | 59g | 74g | 40.5 |
| Tue | 1511 | 134g | 95g | 71g | 45.3 |
| Wed | 1446 | 116g | 72g | 74g | 39.9 |
| Thu | 1240 | 108g | 66g | 55g | 37.3 |
| Fri | 1314 | 128g | 94g | 43g | 41.4 |
| Sat | 1427 | 127g | 60g | 80g | 40.6 |
| Sun | 1521 | 133g | 97g | 71g | 45.4 |

- Weekly Fuel Score: 100.0 (ELITE)
- Daily MES: 86.9 (Optimal) — PAS 97.0, GIS 93.7, FAS 89.3, FS 52.2
- Health Pulse: 77.6 (Good) — Fuel 100.0, MES 86.9, Nutrition 40.6

### Flex Meal Impact (Marcus, Priya, James)
| User | Pre-Flex Avg | Post-Flex Avg | Flex Score | Budget Change |
|------|-------------|---------------|------------|---------------|
| Marcus | 100.0 | 95.7 | 35.0 | 4→3 |
| Priya | 100.0 | 98.6 | 35.0 | 4→4 (snack) |
| James | 100.0 | 95.7 | 35.0 | 4→3 |

---

## Database Stats

| Metric | Count |
|--------|-------|
| Total recipes | 77 |
| Gluten-free tagged | 67 |
| Dairy-free tagged | 41 |
| Vegetarian tagged | 22 |
| Vegan tagged | 8 |
| Keto tagged | 0 |
| Paleo tagged | 0 |
| Total grocery items generated | 100 (13 categories) |
| Daily quests generated | 5 per user |
| Total achievements possible | 56 |

---

## Recommendations (Priority Order)

1. **[CRITICAL] Add keto/paleo recipe tags** to existing recipes that qualify
2. **[CRITICAL] Fix allergen filtering** in meal plan generator to check ingredient-level data
3. **[HIGH] Add more vegan entrees** to the recipe catalog
4. **[HIGH] Inject user profile into chat context** so healthify respects dietary preferences
5. **[MEDIUM] Investigate streak logic** — daily logging should increment streaks
6. **[MEDIUM] Recalibrate nutrition scoring** for calorie-restricted plans
7. **[LOW] Decide on snack flex policy** — should cheat snacks count against budget?
8. **[LOW] Seed food catalog** with common foods for manual search
