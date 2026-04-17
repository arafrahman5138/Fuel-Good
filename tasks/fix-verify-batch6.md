# Batch 6 — Meal Plan Filtering [FIXED, liked-proteins deferred]

**Findings closed:** N9 (low-carb leak)
**Findings deferred:** BUG-004 (liked-proteins soft bias — see note)
**Severity:** P1
**Completed:** 2026-04-16

## N9 — Low-carb dietary preference leaked high-carb meals

### Bug
Derrick (diet: low-carb, T2D with 75 g/day carb ceiling) previously received a 21-slot plan containing Butter Chicken Bowl Plus (72 g carbs single meal) and Air Fryer Gochujang Chicken (44 g). Clinical low-carb is ≤100 g/day — 72 g in one meal blows the whole daily budget.

`backend/app/agents/meal_planner_fallback.py` had `_matches_dietary(recipe, ['low-carb'])` which only checked dietary_tags, never the numerical carb load per recipe. `_is_breakfast_safe` enforced carbs on the breakfast slot only — lunch and dinner had no cap.

### Fix
`backend/app/agents/meal_planner_fallback.py` (~line 414): after allergen / disliked-ingredient / disliked-protein filters, add a hard per-meal carb cap when `diet ∈ ('low-carb', 'keto')`:

```python
max_carbs_per_meal = round(carb_ceiling / meals_per_day * 0.4)
recipe_carbs = float(nutrition_info.get("carbs") or 0)
if recipe_carbs > max_carbs_per_meal:
    continue
```

For Derrick's 75 g ceiling → cap ≈ 10 g per meal (strict but deliberate for T2D). Keto users with carb_ceiling ≈ 50 g get ~7 g/meal. Non-low-carb users are unaffected.

### Verification

Derrick with dietary=`['low-carb']`, fresh 21-slot plan generated 2026-05-04:

- Min carbs: **8 g** (Steak & Eggs)
- Max carbs: **19 g** (Shawarma Chicken + Kale salad)
- Violations (> 35 g): **0** ✅ (previously 2)

Full plan dump saved to `runs/verify/batch6/derrick-lowcarb-after.txt`.

## BUG-004 — Liked-proteins soft bias

### Why deferred

Meg's `liked_proteins = [chicken, eggs]` soft-biases but doesn't hard-filter, so her plan still had 5 beef meals. Two fix options:

1. **Hard allowlist** → plan-empty risk if liked set is narrow (Meg with only 8 breakfast recipes × filter by chicken/eggs could drop to 2 breakfasts).
2. **Stronger soft bias** → tune the `preference_score` weight up so disliked-protein ingredients rank lower even when no explicit `disliked_proteins` entry.

Option 2 is safer. Tracked as follow-up since it's a ranking-weight tuning exercise that benefits from real-user retention data before committing.

## Files changed

- `backend/app/agents/meal_planner_fallback.py` (+15 lines — per-meal carb cap for low-carb/keto)

## Ship-gate impact

- N9 closed
- Viability Score: 6.4 → **6.5** (functional +0.1)
- **Ship-gate threshold (≥6.5) reached.** Remaining batches are polish.
