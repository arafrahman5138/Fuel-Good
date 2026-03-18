# MES Meal Scoring

Last updated: 2026-03-16

This README is the practical scoring guide for calculating new meal MES values.

Source of truth:
- `backend/app/services/metabolic_engine.py`
- `docs/mes-scoring.md`

## 1) What gets a meal MES score

Only score meals that represent a real, scoreable meal context.

Scored:
- `full_meal`

Not scored:
- `dessert`
- `sauce_condiment`
- `meal_component_protein`
- `meal_component_carb`
- `meal_component_veg`

For recipes, scoreability should also match:
- `recipe_role == "full_meal"`
- `is_component == false`
- `is_mes_scoreable == true`

## 2) Inputs used for meal MES

`compute_meal_mes(nutrition, budget)` uses:
- `protein_g` or fallback `protein`
- `fiber_g` or fallback `fiber`
- `carbs_g` or fallback `carbs`
- `fat_g` or fallback `fat`
- `calories`

Derived values:
- `net_carbs_g = max(0, carbs_g - fiber_g)`
- `protein_target_per_meal = daily_protein_target / 3`

When creating new meals, macros must be recalculated from the actual modeled ingredients. Do not reuse source-card macros after ingredient substitutions.

## 3) The four MES sub-scores

Each sub-score is normalized to `0-100`.

### GIS

`GIS` is based on `net_carbs_g`, not total carbs.

The engine now uses profile-sensitive carb curves:
- `general`: more forgiving for healthy mixed meals
- `standard`: middle path for prediabetes / metabolic reset users
- `strict`: more carb-sensitive for insulin resistance / type 2 diabetes

Practical meaning:
- low net-carb meals score very well
- moderate-carb mixed meals are no longer punished as harshly for general users
- clearly high-carb meals still fall off meaningfully

### PAS

`PAS` scores meal protein against the user’s per-meal protein target.

Curve:
- `>=100%` of target => `100`
- `75-100%` => `70..100`
- `50-75%` => `40..70`
- `25-50%` => `10..40`
- `<25%` => `0..10`

### FS

`FS` rewards fiber with diminishing returns:
- `0-2 g` => `0..20`
- `2-6 g` => `20..65`
- `6-10 g` => `65..90`
- `10-15 g` => `90..100`
- `>15 g` => `100`

### FAS

`FAS` is an inverted-U fat score:
- very low fat is penalized
- moderate fat is rewarded
- extremely high fat is penalized again

Practical sweet spot:
- about `15-40 g` fat per meal

## 4) Weighted meal MES composite

Base composite:

```text
meal_mes = w_gis*GIS + w_protein*PAS + w_fiber*FS + w_fat*FAS
```

Rounded to 1 decimal.

### General-user baseline weights

- `GIS`: `0.24`
- `Protein`: `0.34`
- `Fiber`: `0.24`
- `Fat`: `0.18`

### Stricter profile weighting

The engine keeps stricter carb sensitivity for higher-risk profiles:
- prediabetes / metabolic reset: middle weighting and middle carb curve
- insulin resistance / type 2 diabetes: stricter weighting and strict carb curve

Do not hardcode only the general weights when reasoning about personalized MES.

## 5) Ingredient-aware GIS adjustment

MES v3 keeps the macro-driven GIS curve, but adds a bounded ingredient-aware GIS adjustment when the meal has a confident whole-food carb signal.

This adjustment is additive to GIS only and is capped so it cannot overpower the core macro model.

Current v3 rules:
- explicit `glycemic_profile` metadata wins
- otherwise infer from `carb_type` plus ingredient names
- if the carb source is ambiguous, apply no ingredient relief

Current V1 relief policy:
- `sweet_potato`: positive relief
- `legume`: strongest relief
- `brown_rice`, `quinoa`, `oats`, `intact_whole_grain`: moderate relief
- `potato`: small relief
- `white_rice`: neutral
- `rice_noodles` and refined grains: no relief

Prep effect handling:
- `resistant_starch_prep = cooled | cooled_reheated` adds extra GIS relief
- this must be explicit metadata
- do not assume a cooling effect unless the recipe is intentionally modeled that way

User-facing explanation reasons may include:
- `whole-food starch source`
- `legume-based carb`
- `intact whole grain`
- `cooled starch resistant starch effect`

## 6) Backend-only metabolic stability bonus

MES v2 adds a small backend-only stability bonus for clearly metabolically strong low-carb meals.

Purpose:
- restore a clear edge for low-carb, protein-forward, balanced-fat meals
- keep the broader-retune gains for healthy mixed meals
- avoid going back to the old GIS-heavy distortion

This bonus is narrow and does not create a new user-facing field.

Current general-user gating:
- `general` carb curve only
- at least `300` calories
- `net_carbs_g <= 18`
- `protein_g >= 35`
- `fiber_g >= 6`
- `12 <= fat_g <= 35`

Current bonus shape:
- base `+2.0`
- `+0.5` if `net_carbs_g <= 8`
- `+0.25` if `protein_g >= 40`
- `+0.25` if fat is in the tighter sweet spot `15-30 g`
- `+0.25` if `fiber_g >= 8`
- cap `+3.0`

Interpretation:
- this is for metabolically excellent low-carb meals
- it should not activate for ordinary moderate-carb mixed meals
- it should not override the stricter behavior for higher-risk metabolic profiles

## 7) Meal tiers

Base thresholds:
- `optimal`: `82+`
- `good`: `65-81.9`
- `moderate`: `50-64.9`
- `low`: `35-49.9`
- `critical`: `<35`

These are still profile-adjusted inside the engine.

## 8) Pairing-adjusted MES

Some full meals can receive pairing-adjusted MES with a curated side that has `pairing_synergy_profile`.

Pairing adjustment is layered on top of the combined macro score.

Supported metadata:
- `fiber_class: none | low | med | high`
- `acid: boolean`
- `healthy_fat: boolean`
- `veg_density: none | low | med | high`
- `recommended_timing: with_meal | before_meal`

Pairing adds:
- `GIS` uplift capped at `+8`
- separate `synergy_bonus` capped at `+1.5`

The ingredient-aware GIS adjustment and backend-only metabolic stability bonus both still apply to the combined meal when the combined nutrition qualifies.

Stored fields may include:
- `mes_score_with_default_pairing`
- `mes_default_pairing_adjusted_score`
- `mes_default_pairing_delta`
- `mes_default_pairing_synergy_bonus`
- `mes_default_pairing_gis_bonus`
- `mes_default_pairing_reasons`

## 9) How to score new meals correctly

When modeling new meals:
- substitute non-whole-food ingredients with whole-food equivalents where possible
- recalculate macros from the final modeled ingredient list
- assign or infer the carb-source profile correctly
- score the main meal first
- if the meal should ship with a curated default side, calculate the pairing-adjusted score too

When carb source matters, model it intentionally:
- `sweet potato` should be treated as `sweet_potato`
- legumes should be treated as `legume`
- intact grains should keep their grain identity
- cooled rice/potatoes only get resistant-starch credit if the recipe explicitly uses that prep

Do not:
- assume a healthy label means the meal will score high automatically
- reuse old source-card macros after swapping ingredients
- guess resistant-starch prep from vague recipe text
- assign pairing-adjusted MES unless the side is curated and has valid pairing metadata

## 10) Operational refresh steps after scoring changes

When scoring logic changes, refresh stored outputs:

```bash
cd backend
PYTHONPATH=. ./venv/bin/python scripts/audit_mes_calibration.py
PYTHONPATH=. ./venv/bin/python scripts/backfill_recipe_mes_scores.py --apply
PYTHONPATH=. ./venv/bin/python scripts/export_official_meals.py
```

Also refresh any comparison artifacts or score-reference docs that depend on current stored values.
