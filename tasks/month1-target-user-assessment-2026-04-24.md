# Fuel Good — Month 1 Target-User Assessment (Replay, Clinical Persona)

**Date:** 2026-04-24
**Persona simulated:** **Carlos Mendoza, 51M**, warehouse supervisor in Phoenix, $62k/yr. BMI 31 (5'9" 210 lb). Just diagnosed with **prediabetes (A1C 6.1)** and **hypertension (140/92)** at his annual physical 3 weeks ago — on **lisinopril 10mg**. Mom died of T2D complications at 68 (kidney failure, dialysis the last two years). No nutrition-app history. Doctor told him to "cut carbs." Info diet: YouTube — Dr. Berg, Dr. Pradip Jamnadas. Wife cooks Mexican daily (enchiladas, rice, beans, tortillas). iPhone 13, no wearable. **Price tolerance $9.99/mo, actively skeptical of subscriptions.** Motivator: *fear*, not curiosity. Quote: *"I've got 10 years before I'm my mom. I don't want the dialysis, the neuropathy, any of it."*

**Why this persona was chosen:** The 04-16 baseline report explicitly recommended *"Prioritize Derrick in marketing, not Haruki or Jordan. Derrick is the only persona with positive WTP-1 ($29.99) AND a clinical reason to care that MyFitnessPal/Cronometer don't serve."* Carlos tests that recommendation at a different WTP tier ($9.99 vs Derrick's $29.99), a different cultural context (Mexican vs West African), and a different motivator (fear of mom's fate vs Derrick's newly-diagnosed pragmatism). This is the *priority* segment Fuel Good should be winning — and Carlos stress-tests whether the app actually serves a scared, working-class, subscription-skeptical user who is the app's stated moat audience.

**Method:** Hybrid, skewed backend-first per lessons from yesterday's Maya run. Carlos's account provisioned via `runs/provision_carlos.py` with prediabetes + HTN + A1C 6.1 + systolic/diastolic on the metabolic profile. API deep-dive on `/metabolic/budget`, `/nutrition/targets`, `/meal-plans/generate`, `/chat/healthify` (four prompts), `/fuel/weekly`, `/fuel/health-pulse`. Frontend code-diff review on paywall (`onboarding-v2/paywall.tsx`), onboarding motivations, tabs layout. Simulator spot-check of the current onboarding state. DB direct-query via SQLAlchemy to confirm profile ORM state.

**Baseline comparisons:**
- **Alex Chen** (04-16, Composite 7.2 / 10) — wellness-curious premium
- **Maya Patel** (04-23, Composite 7.7 / 10) — wellness-curious premium + PCOS
- **This assessment (Carlos)** — clinical / fear-motivated / working-class / low-WTP

---

## Executive Verdict

**Composite Score: 6.8 / 10** (−0.4 vs Alex, −0.9 vs Maya)
- Utility — **7.5 / 10** (the metabolic engine works; a sodium-cap BUG hurts)
- Polish — **6.5 / 10** (onboarding motivation options don't include Carlos's on-ramp; first-impression red "Needs Work" on health-pulse)
- Habit-formation — **6 / 10** (chat recipe-card trigger misses cultural questions; meal plan under-serves Mexican cuisine)
- Moat — **8 / 10** (medical-advice guardrail is the *real* moat and it works; clinical-grade math adjusts correctly for prediabetes)

**Would Carlos pay $9.99/month after the 7-day trial? → Probably not.** Three things block his conversion:
1. **First-day shame coding still exists on the health-pulse tile.** `/api/fuel/health-pulse` returns `tier: "poor", tier_label: "Needs Work"` on Day 0 with zero logs. The R3 "Ready to start" fix only applied to [(home)/flex.tsx:45-66](frontend/app/(tabs)/(home)/flex.tsx:45); the health-pulse endpoint is unguarded. Carlos — already scared — opens the app and gets scored "poor" before logging a single meal.
2. **The chat's recipe-card schema is trigger-sensitive.** "Healthify my wife's cheese enchiladas" → prose only. "Give me a low-carb enchilada recipe" → card. For a culturally-Latino user asking culturally-phrased questions, the moat feature misfires.
3. **The paywall dismissal ladder** ($59.99 → $29.99 → $11.99 year) is still present ([onboarding-v2/paywall.tsx:42-59](frontend/app/onboarding-v2/paywall.tsx:42)). The 04-16 report flagged this as dark-pattern-adjacent and recommended retiring it. It did not ship. For a subscription-skeptic, the discount ladder *is* the signal that the real price isn't the real price.

**Would Carlos pay if he got through the first week? → Yes, with high conviction.** The **medical-advice chat guardrail actually works** — asked about lisinopril + food interactions, the chat correctly refused medical advice and referred to doctor/pharmacist. That's the single most valuable feature for his segment. No other nutrition app will do that — MyFitnessPal will happily invent a food-drug interaction; Noom doesn't know Carlos is on lisinopril. This is the moat.

---

## 1. Carlos's metabolic context — what the engine computed

```
TDEE:                2119.6 kcal
ISM:                 1.15    (intermediate; default 1.0, Maya/IR was 1.25)
protein_target_g:    210.0   (1.0 g/lb — metabolic-reset posture)
fiber_floor_g:       37.8    (elevated — fiber is the prediabetes lever)
carb_ceiling_g:      110.0   (between default 130 and IR's 90 — tuned for prediabetes)
sugar_ceiling_g:     110.0
fat_target_g:        82.4
tier_thresholds:     optimal 86, good 69, moderate 54, low 39
threshold_context:   shift +4 stricter — "Metabolic risk detected"
```

**Verdict on engine math: ✅ Correct directional posture.** Prediabetes lands between default and full-IR — reasonable. The +4 threshold shift is visible (Maya's was +6 for diagnosed IR, default is 0). Carlos — Jamnadas-aware — would appreciate the transparency.

---

## 2. Delta vs the 04-16 / 04-23 baselines — what this persona exposed

### 🔴 NEW FINDING: HTN sodium-cap is silently broken

The Batch-2 fix from 04-16 (`HYPERTENSION_SODIUM_CEILING_MG = 1500`) lives in [nutrition.py:132-138](backend/app/routers/nutrition.py:132) and is supposed to override the default 2300 mg sodium ceiling when a user's profile has `hypertension=True`. **For Carlos, it doesn't fire.** `/api/nutrition/targets` returns `sodium_mg: 2300.0` even though his profile unambiguously has `hypertension=True, systolic_mmhg=140, diastolic_mmhg=92`.

**Root cause:** [nutrition.py:95-103](backend/app/routers/nutrition.py:95) — `_profile_has_core_setup(profile)` checks:
```python
profile.height_cm is not None or getattr(profile, "height_ft", None) is not None
```
It accepts `height_cm` or `height_ft` but **not** `height_in`. Carlos's profile was provisioned with `height_in=69` only (no `height_cm`, no `height_ft`). The guard returns False, the entire sync path bails out, and the hypertension override never executes.

**Blast radius:** Any user whose height was captured as inches-only — which almost certainly includes the iOS UI onboarding path — misses the HTN sodium cap. This is the clinical-grade safety feature Fuel Good advertises to its #1 priority segment (clinical, metabolic-reset). It is not working for the users who need it most.

**Fix (1-line):**
```python
profile.height_cm is not None
    or getattr(profile, "height_ft", None) is not None
    or getattr(profile, "height_in", None) is not None
```

Call this **P0, regression-test-required.** Add an integration test that provisions a user with height_in only + hypertension=True and asserts sodium_mg == 1500.

### 🔴 NEW FINDING: "Needs Work" shame persists on the health-pulse endpoint

The 04-16 R3 fix wrapped the *flex budget* component in a guard — if `mealsLogged < 3`, show "Ready to start" in slate-400. Carlos's first-day API call to `/api/fuel/health-pulse` returns:

```json
{
  "tier": "poor",
  "tier_label": "Needs Work",
  "meal_count": 0,
  "fuel": { "score": 0.0, "tier": "poor", "available": false },
  "metabolic": { "score": 0.0, "tier": "poor", "available": false },
  "nutrition": { "score": 0.0, "tier": "poor", "available": false }
}
```

The backend returns raw shame-coded defaults. The frontend health-pulse card renders these directly (unlike the flex.tsx component which computes the tier client-side with the guard). Carlos — fearful, working-class, watching Dr. Berg — sees *"Metabolic Score: Needs Work"* in red as his first data point.

**This is the opposite of brand-promise.** The 04-16 report noted: *"'0 Needs Work' in red on day 0 is punitive ... Hide this for the first 3 days or change the copy to a neutral 'Let's get started.'"* The fix landed on `flex.tsx`. It did not land on `/fuel/health-pulse`.

**Fix:** apply the same guard on `/fuel/health-pulse` — when `meal_count < 3`, return `tier_label: "Ready to start"` and a neutral color. Server-side, since the health-pulse card doesn't compute the label client-side.

### 🟡 PARTIAL: chat recipe-card schema is trigger-sensitive

Four chat prompts as Carlos, structured-card yield:

| Prompt | Card returned? | Notes |
|---|---|---|
| *"I was just diagnosed with prediabetes. What foods should I completely avoid?"* | ❌ Prose-only (ok — question is discursive, not recipe-seeking) | Reasonable product choice |
| *"My wife makes cheese enchiladas every Sunday. How can I still eat them with prediabetes?"* | ❌ Prose-only | **This is the miss.** Culturally-framed craving question; 04-16 promised every Healthify response is a card. |
| *"Give me a low-carb enchilada recipe that keeps my blood sugar stable."* | ✅ Card — "High-Protein Chicken Enchilada Stuffed Bell Peppers," 18 ingredients | Working as designed when prompt has "recipe" keyword |
| *"I take lisinopril 10mg for blood pressure. Is there any food I need to avoid with it?"* | ❌ Prose (correctly refused medical advice, referred to doctor/pharmacist) | **This is the moat feature working.** |

**So P0 #1 from 04-16 is ~75% shipped**: recipe cards reliably appear for explicit-recipe prompts and "healthify X" prompts where X is a familiar American dish (mac and cheese, yesterday). They **miss** discursive culturally-framed questions. For Maya (who phrases things like "what can I make with salmon and bok choy") the schema triggers. For Carlos (who phrases things like "how can I still eat my wife's enchiladas") it doesn't.

**Fix:** the agent should detect *any* food-mention in the user's message and return a healthified card as a default format, falling back to prose only for explicit question-words ("avoid," "what," "why," "is X bad") that indicate an informational ask. The current classifier appears to use recipe/action-verbs exclusively.

### 🔴 NEW FINDING: No clinical on-ramp in onboarding motivation

The "What brought you here?" screen offers six motivations (observed live 04-23):
- I eat too much processed food
- I want more energy
- I'm confused about what's healthy
- I want to cook more real food
- I want to lose weight the right way
- I want to feed my family better

**None of these match Carlos's activation motivator.** His honest answer would be *"My doctor just told me I'm prediabetic and I'm scared."* There is no on-ramp for:
- "My doctor told me to change my diet"
- "I was just diagnosed with [condition]"
- "I want to avoid [disease] in my family"

The 04-16 report's #1 marketing-priority segment has no onboarding path that acknowledges why they're here. This is a copy-only fix (~30 min of product/marketing work).

### 🟡 PARTIAL: meal plan serves Carlos's protein list but not his cuisine

Carlos's `protein_preferences.liked` = ["chicken", "beef", "eggs", "other_fish"] (no salmon). His `cuisines` = ["mexican", "american"].

Generated 7-day plan (21 items, 13 unique titles):
- **Chicken:** 2× Bang Bang Chicken Skewers, 2× Cheesy Chicken Tacos with Pico, 1× Butter Chicken Bowl Plus, 1× Air Fryer Gochujang Chicken Skewers → solid
- **Beef:** 2× Sweet Potato Beef Sliders, 1× Crispy Beef Tacos, 1× Beef and Potato Hash, 1× Chickpea Mac N' Beef, 1× Steak and Eggs with Chimichurri Greens → solid
- **Eggs:** 2× Turkey & Spinach Egg White Skillet (eggs+turkey — fine), 2× Smoked Salmon Omelet with Avocado
- **Salmon** (NOT in Carlos's liked list): **5/21 slots** — 3× Creamy Corn Salmon Chickpea Pasta + 2× Smoked Salmon Omelet. The planner is pushing salmon ≥ 24% of plan despite Carlos not marking it as liked.

**Reproducing the 04-16 liked_proteins weakness.** Maya had salmon liked and got salmon (fixed vs Alex baseline). Carlos does not have salmon liked and still gets salmon. The meal planner treats liked_proteins as "include extra" but not "avoid if absent." Soft-filter architecture is the right call; Carlos's case shows the downside when the catalog is salmon-heavy relative to the user's preferences.

**Cultural fit (Mexican):** 2× Cheesy Chicken Tacos with Pico + 1× Crispy Beef Tacos + 1× Beef and Potato Hash + 1× Steak & Eggs with Chimichurri = **~5/21 Mexican-or-Latin-adjacent** (24%). Not bad, but not tailored. None are the wife's actual Sunday foods (enchiladas, tamales, pozole). The catalog has no enchilada recipe at all.

---

## 3. What shipped / didn't / regressed — consolidated vs 04-16 baseline

| # | 04-16 P0 | 04-23 Maya status | 04-24 Carlos status | Final verdict |
|---|---|---|---|---|
| 1 | Chat recipe-card schema | ✅ shipped | 🟡 trigger-sensitive | **~75% shipped** — works for explicit recipe prompts, misses cultural/discursive phrasing |
| 2 | Meal-reveal personalization | ❌ not shipped | (not re-tested) | **❌ not shipped** |
| 3 | Scan as tab | 🟡 home hero tile | (same) | **🟡 partial / alternative** (home hero tile; not a full 5th tab) |
| 4 | "Needs Work" day-0 shame | ✅ shipped on flex.tsx | ❌ **regression on health-pulse** | **🟡 partial** — fixed on one surface, broken on another |
| 5 | Meals-per-day onboarding | ✅ fully wired | ✅ same | **✅ shipped** |
| **NEW** | HTN sodium cap (Batch-2) | (not re-tested) | ❌ **silently broken for height_in-only profiles** | **❌ regression / never worked at runtime** |
| **NEW** | Clinical on-ramp in onboarding | (gap) | (not flagged) | **❌ gap — no on-ramp for doctor-diagnosed users** |
| **NEW** | Paywall dismissal ladder retired (04-16 recommendation) | (not re-tested) | ❌ **still present** | **❌ did not ship** |

**Score delta for the clinical segment specifically:** where Maya's run showed a +0.5 improvement vs Alex (7.7 vs 7.2), Carlos's run shows a −0.4 regression (6.8 vs 7.2). The shipped fixes helped the wellness-premium segment but **left, or introduced, gaps on the clinical segment the 04-16 report said to prioritize.**

---

## 4. What's genuinely strong for Carlos specifically

1. **Medical-advice chat guardrail works.** The single most moat-defensive feature. No other nutrition app will correctly refuse medical advice with a doctor-referral. For endocrinologist partnerships this is the ship-ready asset.
2. **Metabolic engine math is correctly tuned.** Prediabetes + HTN combined → ISM 1.15, fiber 37.8, carb ceiling 110, stricter thresholds. The engine understands clinical context.
3. **Price fits at $9.99/mo.** Below Maya's $14.99 tolerance but above $0. Carlos can afford it if the trust is earned.
4. **Chicken + beef + eggs catalog has enough recipes** to populate Carlos's week plausibly.
5. **The Fuel Score framing ("eat real food, score high") maps onto Jamnadas-style YouTube nutrition content Carlos already consumes.** The copy lands for him even though he's not Attia's audience.

---

## 5. Retention projection for Carlos — 4-week arc

| Week | Open rate | Why |
|---|---|---|
| Week 1 | **6/7** | Fear-motivated high initial engagement; but Day-1 "Needs Work" tier label on health-pulse hurts first impression. If he doesn't bounce off the paywall ladder → continues. |
| Week 2 | **5/7** | Scanned 8-10 products at Albertsons / Food City; caught the Cheerios = ultra-processed finding, felt validated. Plan is working on weekdays; weekends with the family break the plan (wife's Mexican = sodium landmine, no HTN cap enforcement anyway). |
| Week 3 | **3/7** | Classic 3-week quit window. Breakfast boredom (still 8 recipes). Enchilada question returned prose-only → he felt unseen culturally. Checks Reddit: Dr. Berg sells his own supplements; WeightWatchers is cheaper ($23/mo). |
| Week 4 | **3/7** | Renewal crossroads. If the wife joined and is meal-prepping Fuel Good lunches → he renews at annual $59.99 or even $11.99/yr (dismissal ladder actually helps here). If he's eating alone from the plan → cancels. |

**Conversion probability at $9.99/mo: ~35%** (vs Maya's 65%, Alex's inferred ~60%). Carlos is a ~50% softer conversion than the premium wellness persona because the three P0 gaps hit him harder.

**Conversion probability at $11.99/yr (dismissal ladder sale): ~55%.** The sale converts exactly the subscription-skeptic segment — but it does so by signaling the real price isn't the real price, which undermines trust long-term.

---

## 6. Priority Recommendations (Carlos-focused)

### P0 — clinical-segment shipping blockers

1. **Fix the HTN sodium-cap `_profile_has_core_setup` bug** — add `height_in` to the check. Add a regression test. 1-line fix + 1 test. This is a clinical safety feature advertised on the signup page; it is not working at runtime.
2. **Apply the R3 "Ready to start" guard to `/fuel/health-pulse`** (not just the flex component). When `meal_count < 3`, return `tier_label: "Ready to start"`. Server-side change. Same shame-code removal as flex. 30-min fix.
3. **Broaden chat recipe-card schema trigger** to culturally-framed and discursive healthify prompts. When a specific food is mentioned AND the user's intent includes eating it (not avoiding it), return a card. 2-hour agent-prompt change.
4. **Add clinical on-ramp to onboarding motivation** — one new option "My doctor told me to change my diet" that routes to the appropriate health-flag capture screen directly. 30-min copy + 1 hour routing.
5. **Retire the paywall dismissal ladder.** This was a 04-16 explicit recommendation. It reappeared in today's inspection unchanged. Replace with a single honest $9.99/mo + $59.99/yr + 7-day trial. The research on Noom's $56M settlement is the evidence; trust is the brand asset.

### P1 — cultural fit

6. **Add 10-15 Mexican / Latin-staple recipes** to the catalog — enchilada stuffed bell peppers (chat already invented one), chicken-and-rice, pollo asado + cauliflower rice, carnitas lettuce wraps, huevos rancheros (egg-based low-carb). The catalog went 79→117 but added ~zero explicitly-Mexican recipes.
7. **Family-mode for meal plans** — flag recipes that a partner / wife would cook without protest. "Kid-friendly" / "Family-size" tags. Carlos meal-preps, but Sunday-dinner is his wife's turf.

### P2 — economic lever

8. **Add a "medical-context" onboarding flow that routes to a slightly richer $14.99/mo tier** with "your health coach" positioning. Clinical users have higher WTP than they'd admit to at the generic paywall — if the app explicitly serves their diagnosis, the price tolerance shifts. Research: ZOE charges $60/mo and sells well to the same cohort.

---

## 7. The single most important thing (Carlos-framed)

**The HTN sodium-cap bug.** It's not the biggest UX finding, but it's the biggest *integrity* finding. Fuel Good's differential moat is "clinical-grade math the other apps don't have." A user with hypertension is *specifically* the user this app sells to. The cap is documented in code, wired through the API path, and broken by a narrow guard that fails silently for the most common height-input format.

Ship that 1-line fix, add a regression test, and Carlos's whole experience improves without any UI change — because the food-plan calorie target, the scan product scoring, the chat dietary suggestions all downstream-read from his nutrition targets. Right now he's on a plan that thinks his sodium ceiling is 2300 mg when AHA / his cardiologist would say 1500 mg. For a user who says *"I don't want the dialysis"* — that's the feature.

---

## Appendix A — Files touched

- `runs/personas/personas.json` — added `carlos` entry
- `runs/provision_carlos.py` — new provisioner (prediabetes + HTN + A1C)
- `runs/personas/tokens.json` — Carlos token cached
- `runs/captures/carlos/` — directory created (no usable simulator captures; sim was in Maya's onboarding state; report relies on API + code inspection per the yesterday-lessons pragmatic-simulator rule)
- `tasks/month1-target-user-assessment-2026-04-24.md` — this file

No app code was modified.

## Appendix B — Methodology notes

- **Same hybrid approach as 04-23.** UI spot-check confirmed sim was in an inconsistent state; API + code-inspection carried the assessment.
- **DB state verified:** 117 recipes still seeded from yesterday. Carlos's profile written via POST `/metabolic/profile`; DB-direct-query confirmed all flags set.
- **SQL warnings during DB direct-query:** the `overlaps=` relationship warnings in the User model remain (pre-existing); they don't affect runtime but clutter the output.
- **Not captured:** UI paywall screens with Carlos's active session; cook-mode flow; chronometer drill-down; streak / achievements UX.

## Appendix C — Persona comparison table

| Axis | Alex (04-16) | Maya (04-23) | Carlos (04-24) |
|---|---|---|---|
| Age / Sex | 35M | 32F | 51M |
| Segment | wellness-curious premium | wellness-curious premium + PCOS | clinical / fear / working-class |
| Income | $180k | $175k | $62k |
| Price tolerance | $15-20/mo | $14.99/mo | $9.99/mo |
| Motivator | curiosity + longevity | energy + anti-restriction | fear of mom's death |
| Subscription-skeptic? | No | No | Yes |
| Info diet | Attia, Huberman | Attia, Glucose Goddess | YouTube (Berg, Jamnadas) |
| Cultural cuisine | SF / bowl-food | Mediterranean / Japanese | Mexican / American |
| Wearable? | Whoop (adjacent) | WHOOP 3+yr | None |
| Clinical flag | none | mild PCOS / IR | prediabetes + HTN + A1C 6.1 |
| Composite score | 7.2 / 10 | 7.7 / 10 | 6.8 / 10 |
| Renewal P at tolerance price | ~55% | ~65% | ~35% |
| Biggest shipped win for them | chat quality | chat card schema | medical-advice guardrail |
| Biggest gap | scanner IA | meal-reveal personalization | HTN cap bug + health-pulse shame |
