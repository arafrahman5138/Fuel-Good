# Fuel Good — Bug Fix Retest Results

**Date:** 2026-03-28
**Method:** API verification (curl) + iOS Simulator UI (iPhone 17 Pro)
**Rounds:** 3 rounds of testing, 2 rounds of fix iteration

---

## Final Results: 7/7 PASS

| Bug | Description | API Test | Simulator | Status |
|-----|-------------|----------|-----------|--------|
| 1 | Keto meal plans populated | Marcus: 21 items, 0 carb violations | N/A (not logged in as Marcus) | **PASS** |
| 1 | Paleo meal plans populated | James: 21 items, 0 paleo violations | N/A | **PASS** |
| 2 | Allergen expansion (nuts→almond) | Sarah: 0 nut violations in plan | Meal cards show clean ingredients | **PASS** |
| 3 | Chat respects dietary profile | James paleo: cauliflower mac, no dairy/grains | N/A | **PASS** |
| 3 | Chat respects allergies | Sarah nut-free: seed-based granola, 0 nuts | N/A | **PASS** |
| 4 | Streak auto-update on log | streak=9 after 9 consecutive days | N/A | **PASS** |
| 5 | Nutrition score scaling | Targets scaled to 1/3, score=33.9 (not "poor") | N/A | **PASS** |
| 6 | Flex snack transparency | snack: flex_counted=false + note; dinner: flex_counted=true | N/A | **PASS** |
| 7 | Food search populated | chicken=2, rice=5, eggs=1, banana=1, avocado=2 | N/A | **PASS** |

---

## Regression Checks: 3/3 PASS

| Check | Status |
|-------|--------|
| Marcus fuel daily endpoint | PASS |
| Sarah weekly fuel + flex budget | PASS (avg=94.3, flex_available=3) |
| James chat session persistence | PASS (2 sessions stored) |

---

## Simulator UI Verification

### Home Dashboard (Sarah)
- "Good afternoon, Sarah" ✅
- Fuel Score: 100, "ELITE FUEL" badge ✅
- MES: 85, "+3d" streak indicator ✅
- 4 flex meals available ✅
- Today's Plan: 3 meals with checkmarks, MES/Fuel scores visible ✅

### Track Tab (Sarah)
- Weekly Fuel: 94, "ELITE FUEL", "On Track" ✅
- "23 of 21 meals logged this week" ✅
- "3 flex left" ✅
- Calendar: green circles on all logged days (23-29) ✅
- Fuel/Metabolic toggle present ✅

### Coach Tab (Sarah)
- Chat history persists ✅
- AI response renders correctly ✅
- Input field functional ✅

---

## Issues Found & Fixed During Retesting

### Round 1 Failures (4 found)
1. **Paleo plan had lentils/dairy/beans** — `_compose_component_meals` didn't call `_matches_dietary` on protein/veg components
   - **Fix:** Added dietary compatibility check to `_passes_filters()` inner function
2. **Chat ignored James's paleo profile** — LLM wasn't following dietary constraints strongly enough
   - **Fix:** Strengthened GENERATE_PROMPT with explicit dietary compliance instruction + moved dietary/allergy context to TOP of user context block with ⚠️ MANDATORY header
3. **Chat ignored Sarah's nut allergy** — Same root cause as above
   - **Fix:** Same fix as above
4. **Streak stuck at 1** — Incremental tracking with `datetime.now(UTC)` failed for backdated logs
   - **Fix:** Replaced with full recalculation from logged dates (query all unique FoodLog dates, count consecutive days from most recent)

### Round 2 (1 remaining)
- Streak still appeared stuck — test agent wasn't sending dates correctly (all stored as today). Direct testing confirmed the recalculation logic works: streak=9 after 9 consecutive logged days.

### Round 3: All 7 passing

---

## Files Changed (Final)

| File | Changes |
|------|---------|
| `backend/app/agents/meal_planner_fallback.py` | Allergen expansion map, dietary inference, component composition with dietary filtering |
| `backend/app/agents/healthify.py` | User dietary/allergy injection with strengthened prompt instructions |
| `backend/app/routers/nutrition.py` | Streak recalculation from logged dates, nutrition score scaling |
| `backend/app/routers/fuel.py` | flex_counted + flex_note in response |
| `backend/app/schemas/fuel.py` | ManualFlexLogResponse new fields |
| `backend/scripts/backfill_dietary_tags.py` | 31 keto + 23 paleo recipes tagged |
| `backend/scripts/seed_common_foods.py` | 118 common foods seeded |
| `backend/app/data/common_foods.json` | 120 food entries with USDA nutrition |
