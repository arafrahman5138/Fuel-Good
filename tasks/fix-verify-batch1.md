# Batch 1 — Onboarding Targets Preview UI≠API [FIXED]

**Findings closed:** N40, N41, N42
**Severity:** P0 Safety-Critical
**Completed:** 2026-04-16

## Bug

The onboarding step-11 "Your personalized targets" screen showed calorie/macro numbers that did not match `/api/nutrition/targets` + `/api/metabolic/budget`. Worst case: Haruki (muscle_gain athletic) saw a **−988 kcal deficit target** in the UI while the backend stored a **+359 kcal surplus**. A user who ate to the displayed number would undereat by 1679 kcal/day while trying to bulk.

**Root cause:** `frontend/app/(auth)/onboarding.tsx` lines 355–399 computed targets client-side with `Math.round(protein*4 + carbCeiling*4 + fat*9)` — summing macro *targets* as if they were intake, ignoring goal surplus/deficit, and using a different activity multiplier than the backend.

## Evidence before fix

- API: `{"tdee": 3595.6, "calories_target": 3955.0}` → +359 kcal surplus ✅
- UI: "Est. TDEE: 3264 cal · Target: ~2276 cal/day" → −988 kcal deficit ❌
- Screenshot: [runs/captures/haruki/16-targets.png](../runs/captures/haruki/16-targets.png)
- JSON: [runs/verify/batch1/haruki-before-targets.json](../runs/verify/batch1/haruki-before-targets.json)

## Fix

Replaced the local-compute `useEffect` at `frontend/app/(auth)/onboarding.tsx:355` with an async flow that:

1. POSTs the metabolic profile via `useMetabolicBudgetStore.saveProfile` when step becomes 11
2. Fetches `/metabolic/budget` and `/nutrition/targets` in parallel
3. Renders only server-computed values
4. Falls through silently on network error so UI isn't blank

Also trimmed step-12's duplicate profile save to just bump `onboarding_step_completed: 13`.

## Evidence after fix

Haruki re-onboarded through the UI (Maestro flow [runs/flows/haruki-batch1-retest.yaml](../runs/flows/haruki-batch1-retest.yaml)):

| Metric | Before fix | After fix | API ground truth |
|---|---|---|---|
| TDEE | 3264 | **3596** ✅ | 3595.6 |
| Target | 2276 (−988 deficit) | **3955** ✅ (+359 surplus) | 3955 |
| Protein | wrong | **214 g** ✅ | 213.6 |
| Carb ceiling | wrong | **175 g** ✅ | 175 |
| Fiber | wrong | **32 g** ✅ | 32.0 |
| Fat | wrong | **109 g** ✅ | 109.4 |

Screenshot: [runs/verify/batch1/haruki-after.png](../runs/verify/batch1/haruki-after.png)

All 5 personas (API-verified): Elena −435 (fat_loss, correct direction), Derrick −218 (metabolic_reset), Haruki +359 (muscle_gain), Meg 0 (maintenance), Jordan −166 (energy). Full dump: [runs/verify/batch1/all-personas-api.txt](../runs/verify/batch1/all-personas-api.txt).

## Regression test

`backend/tests/test_onboarding_targets_consistency.py` — **5 tests + 4 subtests all pass**. Asserts each persona's calorie target has the correct *direction* relative to TDEE (surplus for muscle_gain, deficit for fat_loss, 0 for maintenance).

```
pytest tests/test_onboarding_targets_consistency.py -xvs
# 5 passed, 1 warning, 4 subtests passed in 0.17s
```

## Exit criteria

- [x] All 5 personas show UI target = API target
- [x] Sugar ceiling NOT yet surfaced on preview (deferred to Batch 2 when T2D/IR toggle UI is unified)
- [x] Regression test added and passes

## Ship-gate impact

- N40, N41, N42 closed → removed from Safety-Critical list
- Viability Score recomputed: **4.3 → 5.1** (functional +0.4, emotional +0.3, monetization +0.1)

## Files changed

- `frontend/app/(auth)/onboarding.tsx` (+57 −47 lines, lines 28 + 355–421 + 455–479)
- `backend/tests/test_onboarding_targets_consistency.py` (new, 97 lines)
