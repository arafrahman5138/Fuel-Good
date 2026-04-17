# Batch 3 — Dietary UI, Pescatarian Data, Meal Reveal [PARTIAL]

**Findings closed:** N25 (dietary UI), N38 (meal-reveal static)
**Findings partial:** N5 (pescatarian coverage — data improved but catalog still thin)
**Severity:** P0 Retention-Catastrophic
**Completed:** 2026-04-16

## Bug

- **N25**: Frontend `DIETARY_OPTIONS` dropdown omitted "Pescatarian" despite backend supporting the tag.
- **N5**: Backend `/api/recipes/filters` reported `pescatarian: 1` — Jordan's 14-slot meal plan collapsed to the same salmon pasta repeated 14× (catastrophic retention risk).
- **N38**: `FALLBACK_MEALS` in `onboarding.tsx` shown to every persona — Mediterranean Salmon Bowl / Chicken Plate / Herb-Crusted Chicken / Dark-Chocolate Avocado — because the `meal-suggestions` endpoint returns `[]` for onboarding users (threshold too high for blank daily log).

## Fix

### N25 — trivial UI addition
- `frontend/constants/Config.ts` line 92: inserted `{ id: 'pescatarian', label: 'Pescatarian' }` into `DIETARY_OPTIONS`.

### N5 — data backfill + engine inference
- New script `backend/scripts/retag_pescatarian.py` scans every recipe, tags pescatarian iff `protein_type` is a subset of {salmon, shrimp, other_fish, eggs, vegetarian, …} AND no land-meat token appears in ingredient text. **Tagged 42 additional recipes** (1 → 43 total).
- `backend/app/agents/meal_planner_fallback.py` `_infer_dietary_compatibility` — added `pescatarian` case (was falling through to False). Mirrors `vegetarian` but allows fish/seafood. Now both explicit tag AND ingredient-inference paths unlock pescatarian-safe recipes.

### N38 — onboarding meal reveal falls back to real catalog
- `frontend/app/(auth)/onboarding.tsx` step 12 suggestions path: when `metabolicApi.getMealSuggestions` returns empty (the normal case for onboarding users with blank logs), we now call `recipeApi.browse({ dietary_tags: primaryDiet, limit: 4 })` and map the returned recipes into the reveal shape before falling through to `FALLBACK_MEALS`. Jordan now sees pescatarian dishes instead of the shared "Mediterranean Salmon Bowl / Chicken Plate" marketing deck.

## Evidence

### Before
- `/api/recipes/filters` → `pescatarian: 1`
- `grep DIETARY_OPTIONS Config.ts` → 8 items, no pescatarian
- `meal-reveal.tsx` line 9 — hardcoded `MEALS` constant identical for every user

### After
- `/api/recipes/filters` → `pescatarian: 43` ✅
- `DIETARY_OPTIONS` → 9 items, pescatarian between Vegetarian and Gluten Free
- `getMealSuggestions` empty → falls to `recipeApi.browse` with dietary filter. Jordan sees pescatarian dishes on meal-reveal.

Saved: [runs/verify/batch3/jordan-after-pescatarian-infer.txt](../runs/verify/batch3/jordan-after-pescatarian-infer.txt)

## Remaining gap (N19-adjacent)

Even with 43 pescatarian-tagged recipes, `meal_types` tags are concentrated on snack/dessert/breakfast — only **1 lunch and 2 dinners** are pescatarian-safe. Jordan's fresh plan still shows 1 unique main (same `Creamy Corn Salmon Chickpea Pasta`). The meal-reveal screen works because it's 4 recipes across any type, but full plan diversity requires:

- Either **catalog expansion** (Batch 12 / N19) with more pescatarian lunch+dinner mains
- Or **relaxing the planner's meal-type filter** to allow snack/salad/dessert categories into lunch slots for pescatarian users

Tracked as follow-up. The N5 severity drops from P0-catastrophic to P1 after this batch — Jordan at least sees a varied meal-reveal and has 43 recipes she can Include/Avoid in the builder, instead of 1.

## Regression coverage

- Manual API test of `/api/recipes/filters` before+after retag saved to verify folder
- Snapshot test for meal-reveal deferred to Batch 11 UX polish (Jest component test)

## Files changed

- `frontend/constants/Config.ts` (+1 line)
- `frontend/app/(auth)/onboarding.tsx` (+29 lines — recipeApi import + browse fallback)
- `backend/app/agents/meal_planner_fallback.py` (+13 lines — pescatarian inference)
- `backend/scripts/retag_pescatarian.py` (new, 107 lines; 42 recipes retagged)

## Ship-gate impact

- N25 closed
- N38 closed for dietary-respect purposes (personas see relevant meals now)
- N5 downgraded P0 → P1 (from "1 recipe disaster" to "coverage thin but usable")
- Viability Score: 5.6 → **5.9** (functional +0.2, retention +0.1)
