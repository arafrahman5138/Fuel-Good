# Fix Plan: 17 Bugs from Comprehensive QA Audit

## Context
QA testing across 4 user profiles (Alex: athletic/muscle-gain, Maria: insulin-resistant/gluten-free, Priya: vegan/nut-free/soy-free, James: T2D/low-carb/dairy-free) uncovered 17 bugs. 4 are P0 critical (safety/dietary violations), 5 P1, 5 P2, 3 P3. The bugs consolidate into 13 distinct code changes across 10 files.

---

## Phase 1: P0 Critical Fixes (4 changes)

### Fix 1 — T2D sugar ceiling must be strictest (BUG-002)
**File:** `backend/app/services/metabolic_engine.py` lines 800-820
**Function:** `calc_carb_ceiling_g()`
**Change:** Replace the combined `if profile.type_2_diabetes or profile.insulin_resistant` with tiered logic:
```python
if profile.type_2_diabetes:
    base = 75  # Strictest — T2D patients need lowest carb ceiling
elif profile.insulin_resistant:
    base = CARB_CEILING_IR_G  # 90g — less strict than T2D
elif profile.activity_level == ActivityLevel.ATHLETIC:
    ...
```
The existing prediabetes, triglyceride, and fat-loss modifiers remain unchanged below.

### Fix 2 — Muscle gain gets calorie surplus, not deficit (BUG-005, BUG-013)
**File:** `backend/app/services/metabolic_engine.py` lines 987-1018
**Function:** `build_metabolic_budget()`
**Change:** After line 999, add goal-based calorie adjustment before the `return`:
```python
# Apply goal-based calorie adjustment
if profile.goal == Goal.MUSCLE_GAIN:
    calorie_target_kcal = round(tdee * 1.10)   # +10% surplus
elif profile.goal == Goal.FAT_LOSS:
    calorie_target_kcal = round(tdee * 0.80)   # -20% deficit
elif profile.goal == Goal.METABOLIC_RESET:
    calorie_target_kcal = round(tdee * 0.90)   # -10% mild deficit
else:  # MAINTENANCE
    calorie_target_kcal = round(tdee)           # Match TDEE
```
Remove the existing `min(calorie_target_kcal, round(tdee, 1))` cap on line 999 since the goal multiplier now controls the relationship to TDEE.

### Fix 3 — Meal plan respects current dietary preferences (BUG-003, BUG-004)
**File:** `backend/app/routers/meal_plan.py` lines 415-436
**Endpoint:** `GET /meal-plans/current`
**Change:** After loading the plan, filter items against user's current preferences:
```python
plan = db.query(MealPlan).filter(...).order_by(...).first()
if not plan:
    raise HTTPException(status_code=404, detail="No meal plan found")

# Re-filter items against user's current preferences
filtered_items = _filter_plan_items_for_user(plan.items, current_user)
if len(filtered_items) < len(plan.items):
    # Some items were removed due to preference changes
    plan.items = filtered_items
```
Add helper `_filter_plan_items_for_user()` that checks each item's recipe against:
- `current_user.dietary_preferences` (e.g., vegan → no animal products)
- `current_user.disliked_ingredients` (e.g., red meat)
- `current_user.allergies` (safety critical)

Also update **frontend** `mealPlanStore.ts` line 71-88: check if `week_start` is older than current week. If stale, don't display — show "Create Plan" CTA instead.

### Fix 4 — Expand dietary inference for meal plan generation (BUG-001)
**File:** `backend/app/agents/meal_planner_fallback.py` lines 249-257
**Function:** `_matches_dietary()` and `_infer_dietary_compatibility()`
**Change:** Expand `_infer_dietary_compatibility()` to handle:
- `vegan`: Check all ingredients are plant-based (no meat/dairy/eggs/honey keywords)
- `nut-free` / `tree-nut-free`: Check no nut ingredients (almonds, walnuts, cashews, pecans, etc.)
- `soy-free`: Check no soy ingredients (tofu, soy sauce, edamame, tempeh, etc.)
- `low-carb`: Check total carbs < threshold

Also add a **fallback mode** at the `_candidate_pool()` level: if strict filtering yields 0 candidates, relax flavor/preference filters (keep only safety-critical filters: allergies + dietary restrictions) and try again. Log a warning when using relaxed mode.

---

## Phase 2: P1 High Fixes (4 changes)

### Fix 5 — Date validation for meal logging (BUG-006, BUG-007)
**File:** `backend/app/schemas/nutrition.py` lines 23-36
**Schema:** `FoodLogCreate`
**Change:** Add Pydantic validator:
```python
from pydantic import field_validator
from datetime import date, timedelta

@field_validator("date")
@classmethod
def validate_date(cls, v):
    if v is None:
        return v
    parsed = date.fromisoformat(v)
    today = date.today()
    if parsed > today:
        raise ValueError("Cannot log meals for future dates")
    if parsed < today - timedelta(days=90):
        raise ValueError("Cannot log meals more than 90 days in the past")
    return v
```

### Fix 6 — Servings validation (BUG-008)
**File:** `backend/app/schemas/nutrition.py` lines 23-36
**Schema:** `FoodLogCreate`
**Change:** Add validator (same file as Fix 5):
```python
@field_validator("servings", "quantity")
@classmethod
def validate_positive(cls, v):
    if v is not None and v <= 0:
        raise ValueError("Servings and quantity must be greater than 0")
    return v
```

### Fix 7 — Fuel streak off-by-one (BUG-009)
**File:** `backend/app/services/fuel_score.py` lines 630-671
**Function:** `compute_fuel_streak()`
**Change:** Fix the date calculation on line 641:
```python
# OLD (skips back 2 weeks):
check_date = ref_date - timedelta(days=ref_date.weekday() + 7)

# NEW (start from current week's Monday):
check_date = ref_date - timedelta(days=ref_date.weekday())
```
Also fix the early break on line 647-648:
```python
# OLD: breaks on ANY empty week
if not scores:
    break

# NEW: allow up to 1 gap week (vacation etc), only break on 2 consecutive empty weeks
if not scores:
    consecutive_empty += 1
    if consecutive_empty >= 2:
        break
    check_date -= timedelta(days=7)
    continue
consecutive_empty = 0
```

### Fix 8 — Chat timeout/stalling (BUG-012)
**File:** `backend/app/routers/chat.py` lines 269-383
**Change:**
1. Line 279: Increase timeout from 45s to 120s
2. Line 292: Fix exception type from `TimeoutError` to `asyncio.TimeoutError`
3. Add keepalive: Emit a space character every 15s of silence to prevent connection drops

---

## Phase 3: P2 Medium Fixes (4 changes)

### Fix 9 — Add sugar_remaining_g to budget endpoint (BUG-011)
**File:** `backend/app/schemas/metabolic.py` ~line 186
**Schema:** `RemainingBudgetResponse`
**Change:** Add field: `sugar_remaining_g: float = 0`
**File:** `backend/app/services/metabolic_engine.py` ~line 1792
**Function:** `remaining_budget()`
**Change:** Add `"sugar_remaining_g": round(carb_headroom, 1)` to the return dict (alias of sugar_headroom_g for clarity).

### Fix 10 — Liked Proteins display (BUG-010)
**File:** `frontend/app/(tabs)/profile/settings.tsx` line 192
**Change:** The code reads `protein_preferences?.liked` but the API stores the key as `likes`:
```typescript
// OLD:
desc: user?.protein_preferences?.liked?.join(', ') || 'Not set'
// NEW:
desc: (user?.protein_preferences?.likes && user.protein_preferences.likes.length > 0)
    ? user.protein_preferences.likes.join(', ')
    : 'Not set'
```

### Fix 11 — Privacy Policy URL fallback (BUG-014)
**File:** `frontend/app/(tabs)/profile/settings.tsx` line 478 + config file
**Change:** Set `PRIVACY_POLICY_URL = 'https://fuelgood.app/privacy'` in config. If env-specific, use `https://docs.fuelgood.app/legal/privacy-policy` as fallback.

### Fix 12 — Chat timeout fix (already in Fix 8)

---

## Phase 4: P3 Low Fixes (2 changes)

### Fix 13 — Notification badge hides when 0 (BUG-015)
**File:** Home screen header component (likely `frontend/app/(tabs)/(home)/index.tsx`)
**Change:** Wrap badge in conditional: `{notificationCount > 0 && <Badge count={notificationCount} />}`

### Fix 14 — Stale meal plan date range (BUG-017)
Already handled by Fix 3's frontend change (stale plans show "Create Plan" CTA instead).

### BUG-016 (Meal Plan back button)
**Status:** Deferred — code at line 164 (`setActiveView(null)`) appears correct. Need to reproduce and debug further; may be a React Navigation state issue.

---

## Files Modified Summary

| File | Fixes |
|------|-------|
| `backend/app/services/metabolic_engine.py` | Fix 1 (carb ceiling), Fix 2 (calorie target), Fix 9 (sugar remaining) |
| `backend/app/services/fuel_score.py` | Fix 7 (streak date math) |
| `backend/app/routers/meal_plan.py` | Fix 3 (filter current plan) |
| `backend/app/agents/meal_planner_fallback.py` | Fix 4 (dietary inference) |
| `backend/app/schemas/nutrition.py` | Fix 5 (date validation), Fix 6 (servings validation) |
| `backend/app/schemas/metabolic.py` | Fix 9 (sugar_remaining_g field) |
| `backend/app/routers/chat.py` | Fix 8 (timeout/keepalive) |
| `frontend/stores/mealPlanStore.ts` | Fix 3 (stale plan check) |
| `frontend/app/(tabs)/profile/settings.tsx` | Fix 10 (protein prefs), Fix 11 (privacy URL) |
| `frontend/app/(tabs)/(home)/index.tsx` | Fix 13 (badge conditional) |

---

## Verification

1. **Unit tests:** Run existing test suite: `cd backend && python -m pytest tests/ -v`
2. **Metabolic engine:** Run `test_metabolic_engine_targets.py` — verify James sugar < Maria sugar
3. **Meal plan:** Run `test_meal_plan_audit.py` — verify Priya gets vegan-only meals
4. **API validation:** Test date/servings edge cases via curl
5. **Fuel streak:** Log meals for 2 consecutive days, verify streak increments
6. **Visual:** Login as each test user in simulator, verify home screen shows correct meals
7. **Chat:** Send a recipe request, verify full response completes without stalling
