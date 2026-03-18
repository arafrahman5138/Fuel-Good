# MES Scoring Reference

This document describes the current Metabolic Energy Score (MES) model on branch `feature/mes-calibration-rebalance`.

MES is a `0-100` score intended to reflect how metabolically balanced a meal or day is, with a stronger emphasis on blood-sugar stability, protein adequacy, fiber support, and practical satiety than on calories alone.

## What MES Scores

MES is built from four sub-scores:

- `GIS` — Glycemic Impact Score
- `PAS` — Protein Adequacy Score
- `FS` — Fiber Score
- `FAS` — Fat Adequacy Score

Each sub-score is normalized to `0-100`, then combined with weighted averaging.

## Meal MES

### Meal inputs

Per-meal MES uses:

- `protein_g`
- `fiber_g`
- `carbs_g`
- `fat_g`

Net carbs are calculated as:

```text
net_carbs_g = max(0, carbs_g - fiber_g)
```

### Meal sub-score formulas

#### GIS

GIS is profile-sensitive.

General users use a more forgiving curve so healthy mixed meals with moderate carbs do not get pushed down too aggressively.
Prediabetes / metabolic reset users use a middle curve.
Insulin-resistant and type 2 diabetes users use the strict curve.

#### PAS

Protein is scored against the user’s per-meal protein target:

```text
protein_target_per_meal = daily_protein_target / 3
```

Meals that fully meet the per-meal target score `100` on PAS.

#### FS

Fiber rises with diminishing returns:

- `0-2 g`: low score
- `2-6 g`: meaningful improvement
- `6-10 g`: strong
- `10-15 g`: near-max

#### FAS

Fat uses an inverted-U curve:

- very low fat is penalized
- moderate fat is rewarded
- very high fat is penalized again

The practical sweet spot remains roughly `15-40 g` fat per meal.

### Meal weights

#### General users

- `GIS`: `24%`
- `PAS`: `34%`
- `FS`: `24%`
- `FAS`: `18%`

#### Prediabetes / metabolic reset users

- `GIS`: `30%`
- `PAS`: `31%`
- `FS`: `22%`
- `FAS`: `17%`

#### Insulin-resistant / type 2 diabetes users

- `GIS`: `36%`
- `PAS`: `28%`
- `FS`: `22%`
- `FAS`: `14%`

### Ingredient-aware GIS adjustment

MES v3 adds a bounded ingredient-aware GIS adjustment after the base macro GIS curve is calculated.

This is meant to fix a real limitation in macro-only GIS: whole-food carb sources like sweet potato, legumes, and intact grains are not metabolically equivalent to generic refined starch, and explicit resistant-starch prep can matter too.

Current rules:

- explicit `glycemic_profile` metadata takes priority
- otherwise the engine infers a carb source from `carb_type` plus ingredient names
- ambiguous meals get no ingredient relief instead of a guess

Current V1 ingredient relief:

- `sweet_potato`: positive relief
- `legume`: strongest relief
- `brown_rice`, `quinoa`, `oats`, `intact_whole_grain`: moderate relief
- `potato`: small relief
- `white_rice`: neutral
- `rice_noodles` and refined grains: no relief

Current explicit prep effect:

- `resistant_starch_prep = cooled | cooled_reheated` adds extra GIS relief
- no freeform step parsing is used in v1

The adjustment is profile-scaled:

- `general`: full relief
- `standard`: reduced relief
- `strict`: smallest relief

This adjustment is capped and additive to GIS only. It does not replace the macro model.

### Backend-only metabolic stability bonus

MES v2 adds a small backend-only stability bonus for clearly metabolically excellent low-carb meals.

Intent:

- preserve the broader-retune uplift for healthy mixed meals
- restore a clear advantage for low-carb, protein-forward, balanced-fat meals
- avoid exposing another user-facing score component

Current gating for the bonus:

- `general` carb curve only
- at least `300` calories
- `net_carbs_g <= 18`
- `protein_g >= 35`
- `fiber_g >= 6`
- `12-35 g` fat

Current bonus shape:

- base `+2.0`
- `+0.5` if `net_carbs_g <= 8`
- `+0.25` if `protein_g >= 40`
- `+0.25` if fat is in the tighter `15-30 g` sweet spot
- `+0.25` if `fiber_g >= 8`
- capped at `+3.0`

This bonus is intentionally narrow. It should not lift ordinary moderate-carb meals, and it does not replace the stricter carb-sensitive behavior for higher-risk profiles.

### Meal tiers

Base tier thresholds are:

- `optimal`: `82+`
- `good`: `65-81.9`
- `moderate`: `50-64.9`
- `low`: `35-49.9`
- `critical`: `<35`

These thresholds are still profile-adjusted by metabolic-risk and activity logic.

## Pairing-Adjusted MES

Some full meals can receive a pairing-adjusted MES when combined with a curated side that has `pairing_synergy_profile`.

Pairing adjustment is layered on top of the normal combined meal score, which now already includes any ingredient-aware GIS adjustment and the backend-only stability bonus.

### Pairing metadata

Supported side metadata:

- `fiber_class`: `none | low | med | high`
- `acid`: `boolean`
- `healthy_fat`: `boolean`
- `veg_density`: `none | low | med | high`
- `recommended_timing`: `with_meal | before_meal`

### Pairing uplift

Pairing contributes:

- a `GIS` uplift, capped at `+8`
- a separate `synergy_bonus`, capped at `+1.5`

Typical rewarded traits:

- fiber-rich sides
- acidic elements like lemon, lime, or vinegar
- healthy fat
- high vegetable density
- eating the side before the main meal when marked `before_meal`

### Stored pairing fields

When a default pairing exists, recipe nutrition may store:

- `mes_score_with_default_pairing`
- `mes_default_pairing_adjusted_score`
- `mes_default_pairing_delta`
- `mes_default_pairing_synergy_bonus`
- `mes_default_pairing_gis_bonus`
- `mes_default_pairing_reasons`

## Daily MES

Daily MES aggregates the day’s logged macros, then:

- scores daily protein against the full daily protein target
- scores daily GIS using `net_carbs / 3` so the daily carb load maps back to per-meal scoring behavior
- scores daily fiber and fat using per-meal equivalents
- applies treat-impact penalties
- adds capped daily ingredient-aware GIS bonus when logged meals earned ingredient relief
- adds capped daily pairing synergy when grouped paired meals were logged

Daily ingredient-aware bonus is capped at `+6`.
Daily pairing bonus is capped at `+8`.

## Profile-Sensitive Behavior

The system is intentionally not equally strict for all users.

### General users

- healthy homemade mixed meals should usually land in `good`
- moderate-carb meals are treated more leniently than before

### Higher-risk metabolic profiles

For insulin resistance, prediabetes, and type 2 diabetes:

- GIS remains stricter
- carb ceilings remain lower
- tier thresholds remain stricter than the default path

## Calibration Intent

The retuned model is meant to solve a specific product problem:

- healthy homemade mixed meals were often scoring too low for user expectations
- carb-heavy but otherwise solid meals were being penalized too harshly

The current calibration is intended to:

- penalize carbs less for general users
- keep stronger penalties for clearly glycemic meals
- preserve stricter behavior for higher-risk metabolic profiles
- keep metabolically excellent low-carb meals clearly advantaged
- leave room above ordinary healthy meals for truly optimized meals

## Operational Notes

When MES scoring logic changes, refresh all stored score surfaces that depend on it:

- recipe-level MES fields
- default-pairing recipe MES fields
- grouped canonical meal scores
- daily MES outputs
- exported meal JSON snapshots

Recommended commands:

```bash
cd backend
PYTHONPATH=. ./venv/bin/python scripts/audit_mes_calibration.py
PYTHONPATH=. ./venv/bin/python scripts/backfill_recipe_mes_scores.py --apply
PYTHONPATH=. ./venv/bin/python scripts/export_official_meals.py
```
