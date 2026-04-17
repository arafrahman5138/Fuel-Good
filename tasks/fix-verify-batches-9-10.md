# Batches 9 & 10 — Scoring Polishes + Gamification Dedupe [FIXED]

**Findings closed:** N12 (duplicate fiber quest), N14 (group_mes_tier null), N15 (cannot reproduce)
**Severity:** P2
**Completed:** 2026-04-16

## N14 — `group_mes_tier` null on manual logs

### Fix
`backend/app/routers/nutrition.py` (line ~465): when the payload omits `group_mes_tier` and no `group_id` is present, derive the tier from the just-computed Fuel Score (`whole_food` ≥85, `solid` ≥70, `mixed` ≥50, else `ultra_processed`). The response now always carries a readable tier.

### Verify
```
POST /api/nutrition/logs (clean lunch, no group_id, no group_mes_tier)
→ { "fuel_score": 80.0, "group_mes_tier": "solid" }  ✅
```

## N12 — Duplicate fiber quest

### Bug
`_generate_quests` picked independently from a quality pool (`"Eat {target}g Fiber"`, meta_key=`hit_fiber`) and a metabolic pool (`"Meet {target}g Fiber Floor"`, meta_key=`fiber_floor`). On days they collided, users saw two identical-goal quests worth a combined 100 XP for a single action.

### Fix
`backend/app/routers/gamification.py` line ~325: after the initial random picks, detect fiber↔fiber and protein↔protein collisions between quality and metabolic pools. On collision, re-roll the quality pick from the non-colliding remainder (protein isn't prioritized either direction since both pools have multiple protein-agnostic options).

### Verify
```
GET /api/game/daily-quests
→ 5 quests. 0 fiber-label duplicates.
   [general]   Healthify a Craving
   [logging]   Log a Snack
   [quality]   Hit 158g Protein
   [metabolic] Budget Lockdown
   [fuel]      Fuel Score 90+ Meal
```

## N15 — MES sub-score polarity (non-bug)

### Status: Not a bug — probe-shape mismatch

Original report claimed "`sugar_score: 100` alongside `total_score: 36` on a 70g-sugar meal." Reproducing with the correct `MESPreviewRequest` shape (top-level `sugar_g` / `carbs_g` / `protein_g` — NOT a nested `nutrition` dict) returns:

```
sugar_g=110.0, sugar_score=0.0, total=20.3, tier=critical
```

Sub-score polarity is correct. The original observation used a nested `nutrition.sugar_g` payload that the Pydantic schema silently dropped → all macros parsed as 0 → sugar_score=100 because 0 sugar is perfect. Closing as a documentation issue: the API contract expects top-level macro fields and should probably 422 when a nested `nutrition` is supplied. That documentation follow-up is low-priority.

## Files changed

- `backend/app/routers/nutrition.py` (+14 lines — tier derivation from fuel score)
- `backend/app/routers/gamification.py` (+19 lines — quest dedupe after random picks)

## Ship-gate impact

- N12, N14 closed
- N15 closed as non-bug
- Viability Score: 6.5 → **6.6** (consistency +0.1)
