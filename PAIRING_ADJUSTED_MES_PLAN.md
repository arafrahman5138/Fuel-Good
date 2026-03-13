# Pairing-Adjusted MES Plan

## Purpose
The current MES system handles default pairings by **adding the pairing meal's macros** to the base meal and recomputing score. That is directionally useful, but it misses an important real-world metabolic effect:

> A fiber-rich, acid-containing, veggie-forward side eaten **with or before** a meal can reduce the glycemic impact of the overall meal by more than raw macro addition alone suggests.

This document defines a plan to add a **pairing synergy layer** to MES so that default pairings and intentional side choices can improve metabolic score in a way that better matches real physiology.

---

# Problem Statement

## Current behavior
Current MES treats pairings as:
- base meal nutrition
- plus side nutrition
- recompute score

This means pairings only help by increasing:
- fiber
n- fat
- protein
- total nutrients

But this does **not** model:
- fiber-first meal sequencing
- vinegar/lemon/acid effects on glucose response
- slower gastric emptying from fat + fiber combination
- the fact that a vegetable side can improve the metabolic response of the **whole plate**, not just add nutrients next to it

## Product consequence
The app can show a user:
- meal alone = 70
- meal + strong salad pairing = 74

Even when a user would reasonably expect a more meaningful metabolic improvement.

That creates a trust gap.

---

# Goal
Add a **Pairing Synergy Modifier** to MES that:
1. preserves current macro-based scoring foundation
2. gives meaningful credit to metabolically useful pairings
3. stays explainable
4. does not let weak meals get inflated unrealistically

---

# Design Principles

1. **Macros remain the base truth**  
   Pairing synergy should modify MES, not replace nutrient scoring.

2. **Only qualified pairings get synergy credit**  
   Random sides should not get automatic bonuses.

3. **Big bonuses require real metabolic value**  
   A pairing should only materially help if it improves fiber/acid/fat/veg profile.

4. **Explainability first**  
   Users should be able to understand *why* the pairing improved the score.

5. **Default pairings should feel worthwhile**  
   If a recommended pairing is intentionally chosen by the system, it should often improve MES more than a tiny cosmetic bump.

---

# Proposed Scoring Model

## Current structure
Current MES uses weighted sub-scores:
- GIS: 35%
- PAS: 30%
- FS: 20%
- FAS: 15%

## New structure
Keep current MES as the **base meal score**, then add a **Pairing Synergy Adjustment**.

### Formula
```text
paired_mes = base_macro_mes(combined_nutrition) + pairing_synergy_bonus
```

Where:
- `base_macro_mes(combined_nutrition)` = current combined score from meal + pairing macros
- `pairing_synergy_bonus` = bounded bonus based on the pairing's metabolic qualities

### Cap
To avoid unrealistic inflation:
- default max synergy bonus: **+6 points**
- recommended practical range: **+1 to +5**

This is enough to make pairings feel meaningful without breaking the model.

---

# Pairing Synergy Bonus

## Candidate bonus factors
A pairing can earn points from these dimensions:

### 1) Fiber density bonus
High-fiber sides improve meal response.

Example:
- +0.5 if pairing fiber >= 2g
- +1.0 if >= 4g
- +1.5 if >= 6g

### 2) Acid bonus
Acidic elements like lemon or vinegar can reduce glycemic response.

Eligible ingredients:
- lemon juice
- lime juice
- vinegar
- pickled vegetables

Example:
- +0.5 if pairing has clear acid ingredient

### 3) Non-starchy veg bonus
Vegetable-forward sides create better volume + fiber + sequencing effect.

Example:
- +0.5 if pairing is `veg_side`
- +1.0 if pairing is `veg_side` or `salad` with at least 2 produce ingredients

### 4) Fat support bonus
A modest amount of healthy fat can improve satiety and moderate meal response.

Eligible examples:
- olive oil
- avocado
- tahini
- nuts/seeds

Example:
- +0.5 if pairing adds 4–10g healthy fat
- no bonus if fat is negligible

### 5) Sequencing bonus
If pairing is marked as:
- `recommended_timing = before_meal`
- or `consume_first = true`

Then grant an extra small GIS modifier.

Example:
- +0.5 to +1.0

---

# Example Bonus Bands

## Weak pairing
Example: plain tomato slices
- low fiber
- no fat
- minimal acid

Bonus:
- +0.5 to +1.0

## Good pairing
Example: cucumber tomato herb salad with lemon
- moderate fiber
- acid present
- produce dense

Bonus:
- +2.0 to +3.0

## Strong pairing
Example: kale and white bean salad with olive oil + lemon
- good fiber
- some protein
- acid
- healthy fat
- strong veggie density

Bonus:
- +3.5 to +5.0

## Maximal default pairing
Example: large fiber-forward salad with acid + healthy fat

Bonus:
- up to +6.0 (capped)

---

# Additional GIS-Specific Adjustment (Recommended)

Instead of only adding a flat bonus, pairing synergy can directly reduce GIS drag.

## Option A — Flat bonus only
Simpler to implement.

## Option B — GIS modifier + small bonus (recommended)
Example:
```text
adjusted_gis = min(100, combined_gis + gis_pairing_bonus)
paired_mes = recompute_with_adjusted_gis + other_small_bonus
```

This is more realistic because pairings mostly affect glycemic response.

### Suggested GIS pairing bonus range
- weak pairing: +2 GIS
- good pairing: +4 GIS
- strong pairing: +6 to +8 GIS

Then optionally add a small overall synergy bonus (+0.5 to +1.5).

This better mirrors reality than a generic flat MES bump.

---

# Data Model Changes

## Recipe / pairing metadata additions
For pairable side recipes add:
- `pairing_fiber_bonus_class`: `none|low|med|high`
- `pairing_has_acid`: boolean
- `pairing_has_healthy_fat`: boolean
- `pairing_veg_density`: `low|med|high`
- `recommended_timing`: `with_meal|before_meal`
- `pairing_synergy_profile`: object

Example:
```json
{
  "pairing_synergy_profile": {
    "fiber_class": "med",
    "acid": true,
    "healthy_fat": true,
    "veg_density": "high",
    "recommended_timing": "before_meal"
  }
}
```

## Meal output fields
Add to `nutrition_info` or MES response:
- `mes_score_with_default_pairing`
- `mes_default_pairing_delta`
- `mes_default_pairing_synergy_bonus`
- `mes_default_pairing_gis_bonus`
- `mes_default_pairing_explanation`

---

# Backend Logic Changes

## File targets
Primary likely files:
- `backend/app/services/metabolic_engine.py`
- any pairing/default-pairing composition helpers
- recipe export / official meal serialization paths

## New functions
### `compute_pairing_synergy(pairing_recipe, base_meal=None)`
Returns:
```json
{
  "synergy_bonus": 2.5,
  "gis_bonus": 4.0,
  "reasons": [
    "fiber-rich side",
    "acidic dressing",
    "healthy fat present"
  ]
}
```

### `compute_meal_mes_with_pairing(base_meal, pairing)`
Steps:
1. compute combined macro MES
2. compute pairing synergy
3. adjust GIS / total score
4. return full response

---

# Frontend / UX Changes

## Meal detail card
When `use default pairing = true`, show:
- base meal MES
- paired MES
- delta badge: `+3.8 with default pairing`
- short explanation:
  - `Fiber + acid + healthy fat help reduce glycemic impact`

## Meal detail default pairing section
Include copy like:
- `This side meaningfully improves the metabolic response of the meal.`
- `Best eaten with or before the main dish.`

## Chronometer
If a meal is logged with default pairing, show:
- combined MES with pairing
- optional note: `paired optimization applied`

---

# Explainability Copy Examples

## Good explanation style
- `This salad improves the meal’s score by adding fiber, acidity, and healthy fats.`
- `Eating this side before or with the bowl may help reduce glucose impact.`

## Avoid
- vague statements like `optimized by AI`
- unexplained numeric jumps

---

# Calibration Plan

## Phase 1 — heuristic implementation
Use simple rule-based bonuses.

Target outcomes:
- weak pairing: +1 MES
- decent pairing: +2 to +3 MES
- strong pairing: +4 to +5 MES

## Phase 2 — internal tuning
Test on current meal library:
- Butter Chicken Bowl
- Chicken Shawarma Bowl
- Creamy Red Pepper Chicken Rice Bowl
- Fiesta Bowl

Compare whether the default pairing deltas feel intuitively right.

## Phase 3 — user validation
Track:
- whether users keep default pairing enabled
- whether higher pairing delta increases meal acceptance
- whether score explanations increase trust

---

# Example Use Cases

## Creamy Red Pepper Chicken Rice Bowl
Current behavior:
- base = 73.5
- plain salad pairing = 74.1

Desired behavior:
- if salad includes fiber + acid + healthy fat
- paired score should feel more like **76–78** if physiologically justified

## Butter Chicken Bowl
Current pairing bump feels too weak.
A stronger Kachumber variation (larger serving + acid + maybe healthy fat) should produce a more meaningful GIS improvement.

---

# Guardrails

- Pairing synergy cannot hide a fundamentally poor meal.
- Strong pairings should improve scores, but not push junk meals into elite range.
- Keep total synergy capped.
- Require explicit qualifying metadata to earn bonus.

---

# Recommended First Implementation

## Build this first
1. Add `pairing_synergy_profile` metadata to side recipes
2. Add `compute_pairing_synergy()` in metabolic engine
3. Apply GIS pairing bonus + capped synergy bonus
4. Surface delta + explanation in meal detail UI

## Do not do yet
- ML-driven physiological prediction
- user-specific glycemic response modeling
- glucose-monitor feedback loops

Those are later-stage features.

---

# Success Criteria

This plan is successful if:
- Default pairings feel meaningfully helpful
- Score changes align better with user intuition
- Explanations are understandable
- Meals are not unrealistically inflated
- The product feels more metabolically intelligent, not just macro-additive

---

# Final Recommendation
Implement **pairing-adjusted MES** as:
- **combined macro MES**
- plus **GIS-focused pairing bonus**
- plus **small capped synergy bonus**
- with explicit human-readable reasons

That gives the best balance of:
- realism
- trust
- explainability
- implementation simplicity
