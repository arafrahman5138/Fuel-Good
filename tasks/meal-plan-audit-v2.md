# Meal Plan Audit v2 - Comprehensive Cross-Profile Testing

**Date**: 2026-04-01
**Method**: Automated test suite (`backend/tests/test_meal_plan_audit.py`) across 8 user profiles
**Result**: 13 tests passed, 71 findings (0 critical, 55 high, 0 medium, 15 warn, 1 info)

---

## Executive Summary

The meal plan system is **structurally sound** -- all 8 profiles successfully generate 21-item plans with correct day/slot coverage, valid prep timelines, and accurate MES scoring. However, the audit uncovered two significant systemic issues:

1. **Daily calorie/protein shortfall (HIGH)**: Generated plans deliver only 30-50% of calorie targets and <50% of protein targets for most profiles, especially athletic/high-calorie users
2. **Fat target below expected band for diabetic profiles (WARN)**: The 250lb diabetic profile gets 77.6g fat vs expected 88-162g band

---

## Test Profiles

| # | Profile | TDEE | Cal Target | Protein | Carbs | Fat |
|---|---------|------|-----------|---------|-------|-----|
| 1 | 30M 165lb maintenance moderate | 2584 | 1922 | 165g | 130g | 82.5g |
| 2 | 25F 130lb fat_loss active | 2277 | 1551 | 130g | 132g | 55.9g |
| 3 | 55M 250lb fat_loss sedentary + T2D | 2408 | 2002 | 250g | 76g | 77.6g |
| 4 | 22M 180lb muscle_gain athletic | 3554 | 2552 | 216g | 175g | 109.8g |
| 5 | 45F 160lb metabolic_reset + prediabetes | 2150 | 1723 | 160g | 88g | 81.2g |
| 6 | 70M 150lb maintenance sedentary | 1641 | 1629 | 150g | 130g | 56.5g |
| 7 | 28F 120lb fat_loss active + IR | 2118 | 1292 | 120g | 76g | 56.4g |
| 8 | 35M 200lb muscle_gain active | 3189 | 2624 | 240g | 155g | 116g |

---

## Findings by Category

### A. Budget Accuracy - PASS
All 8 profiles produce correct budgets:
- Protein targets >= weight_lb * floor_ratio (1.0x or 1.2x for muscle_gain)
- Carb ceilings correctly reduced for T2D (76g) and IR (76g)
- Calorie targets = protein*4 + carbs*4 + fat*9, capped at TDEE

**One exception**: Diabetic male fat target (77.6g) falls below the 0.35-0.65 * weight_lb band (88-162g). This is by design -- the engine correctly prioritizes keeping fat low when high protein leaves fewer remaining calories -- but should be reviewed.

### B. Plan Structure - PASS
- All 8 profiles generate exactly 21 items (7 days x 3 meals)
- Every day has breakfast, lunch, dinner
- No same-day recipe duplicates detected
- Good variety: 4-5 unique recipes per meal type per week
- No missing meal slots

### C. MES Scoring Accuracy - PASS
- 0 mismatches between returned scores and recomputed scores (within 3-point tolerance)
- All scores in valid 0-100 range
- Tier assignments match threshold boundaries
- Quality summary qualifying counts match

**MES averages by profile**:
| Profile | Avg MES | Qualifying (70+) |
|---------|---------|-------------------|
| Baseline male | 66.2 | 11/21 |
| Young female | 66.6 | 12/21 |
| Diabetic male | 59.2 | 6/21 |
| Athletic muscle | 64.7 | 9/21 |
| Prediabetic female | 61.8 | 7/21 |
| Elderly male | 65.3 | 8/21 |
| Small IR female | 60.2 | 7/21 |
| Active muscle | 63.8 | 8/21 |

All profiles generate warnings about not reaching the 70+ MES target, suggesting the recipe library needs more high-MES options.

### D. Nutritional Compliance - SIGNIFICANT SHORTFALL

**Root Cause**: Recipe serving sizes in the seed data average:
- Breakfast: ~438 cal/serving
- Lunch: ~397 cal/serving
- Dinner: ~491 cal/serving
- **Daily total: ~1,326 cal** from 3 meals

This means the meal plan delivers:
- **Baseline male** (target 1,922 cal): gets ~1,100 cal/day = **57% of target**
- **Athletic male** (target 2,552 cal): gets ~1,140 cal/day = **45% of target**
- **Diabetic male** (target 2,002 cal): gets ~1,098 cal/day = **55% of target**

**Protein shortfall is equally severe**:
- Athletic male: 80-100g/day vs 216g target (37-46%)
- Diabetic male: 75-109g/day vs 250g target (30-44%)
- Baseline male: 80-100g/day vs 165g target (48-61%)

**The planner does not adjust serving sizes based on calorie/protein needs.** The `_budget_alignment_score` is a soft tiebreaker, not a hard constraint. No mechanism increases servings for profiles with high calorie needs.

### E. Dietary Restrictions - PASS
- **Vegetarian**: Correctly excludes all meat/fish recipes. Only vegetarian-tagged recipes appear.
- **Dairy + Gluten allergies**: 0 violations. Allergy expansion and ingredient matching work correctly.

### F. Edge Cases
- **Minimal preferences**: Works fine, generates full 21-item plan
- **Prep-heavy mode**: Generates plans but doesn't fully respect the 3-4 unique recipe limit for lunch/dinner slots (gets 5 instead)
- **Variety-heavy mode**: Works as expected
- **Household size 4**: Most items still have servings=1 instead of 4 (potential bug in how servings are set)
- **Meals per day 2**: Ignored -- still generates 21 items. The `meals_per_day` preference is not used by the fallback generator.

### G. Prep Timeline - PASS
- All prep entries reference valid recipes and days
- Prep day assignments (Sunday) are consistent
- Servings-to-make calculations are correct for bulk cooking
- No orphaned or invalid prep entries

---

## Prioritized Issues

### HIGH - Calorie/Protein Shortfall
**Impact**: Users following the meal plan will be significantly underfed, especially athletic/high-calorie profiles.
**Root cause**: Recipe serving sizes are static; the planner doesn't scale servings based on calorie/protein budgets.
**Fix options**:
1. **Scale servings dynamically**: After selecting recipes, multiply servings by `ceil(per_meal_cal_target / recipe_cal)` to approximate budget
2. **Add higher-calorie recipes**: Create recipe variants for "large" servings
3. **Add snack slots**: Include 1-2 snack slots to bridge the calorie gap
4. **Surface the gap to users**: Show a "you may need extra snacks/larger portions" warning when plan calories < 80% of target

### MEDIUM - Household Size Not Reflected
**Impact**: Household of 4 gets single servings per meal item.
**Root cause**: The servings field defaults to `preferences.household_size` when creating `MealPlanItem`, but the item data from the generator doesn't carry household_size through.
**Fix**: Ensure the generator passes `household_size` as the default servings.

### MEDIUM - meals_per_day=2 Ignored
**Impact**: Users requesting 2 meals/day still get 3 meals/day.
**Root cause**: The fallback generator hardcodes `MEAL_SLOTS = ["breakfast", "lunch", "dinner"]` and doesn't check `meals_per_day`.
**Fix**: Skip breakfast slot when `meals_per_day=2`.

### LOW - Prep-heavy variety limit slightly exceeded
**Impact**: Gets 5 unique lunch/dinner recipes instead of 3-4.
**Root cause**: Variety limit lookup may use wrong slot keys or the limit is applied before composed meals are added.

### INFO - All profiles trigger MES warnings
**Impact**: Every generated plan warns that MES targets aren't met.
**Root cause**: The recipe library lacks enough high-protein, high-fiber, low-sugar recipes to consistently score 70+ MES.
**Fix**: Add more recipes optimized for MES (high protein, moderate carbs, high fiber).

---

## Test File

`backend/tests/test_meal_plan_audit.py` - Run with:
```bash
cd backend && venv/bin/python -m pytest tests/test_meal_plan_audit.py -v -s
```

All 13 tests pass. Findings are reported via print output, not assertion failures (except for the strict vegetarian test).
