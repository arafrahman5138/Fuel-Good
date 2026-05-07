# Fuel Good — Month 1 Target-User Assessment (Replay)

**Date:** 2026-04-23
**Persona simulated:** Maya Patel, 32F, Sr. Product Designer at a Series-B SaaS in NYC, $175k + equity. Partner is a line cook. Reads Attia's *Outlive* + *The Glucose Goddess* + Clear's *Atomic Habits*. WHOOP 3+ yrs, Yuka daily at Whole Foods. Quit MyFitnessPal 2018; tried Noom for 2 wks (shamed → churned). Runs 4x/wk (half-marathon last fall), Sunday yoga. Partner cooks, Sweetgreen 2x/wk, weekends out. **Mild PCOS** (modeled via `insulin_resistant=true` in metabolic engine). Anti-restriction goal: weight maintenance + sustained energy. Price tolerance $14.99/mo.
**Method:** Hybrid. UI-driven onboarding walkthrough on iPhone 17 Pro iOS 26.2 via Maestro 2.4 + `xcrun simctl` (15+ screenshots through 10 distinct onboarding screens); API-level deep-dive as Maya's provisioned account (meal plan gen, `/chat/healthify`, `/scan/product/barcode`, `/fuel/weekly`, `/metabolic/budget`); frontend code diff-review against 04-16 findings to verify shipped P0 items. Simulator form-input brittleness at the body-measurements screen (text fields without `testID`) forced the pivot to API+code for the authenticated flows — noted in lessons, not a judgment on the app.
**Baseline:** [month1-target-user-assessment.md](tasks/month1-target-user-assessment.md) (Alex Chen, 2026-04-16, Composite **7.2 / 10**)

---

## Executive Verdict

**Composite Score: 7.7 / 10** (+0.5 vs 04-16)
- Utility — **8 / 10** (unchanged — engine was already tight)
- Polish — **7.5 / 10** (+0.5 — "Ready to start" guard, consolidated body form, prefilled prefs)
- Habit-formation hooks — **7 / 10** (+1 — chat recipe-card schema enforcement, meals-per-day wiring, scan on home)
- Moat vs free alternatives — **7.5 / 10** (+0.5 — reliable structured chat output is now a real wedge)

**Would Maya pay $14.99/month after the 7-day trial? → Yes, with higher conviction than Alex did at 04-16.** Two things move the needle for her specifically:
1. **Chat now returns a structured recipe card on every prompt** tested — including the *"what can I make with salmon, bok choy, rice"* prompt that returned prose-only in 04-16. This is the moat feature working.
2. **The PCOS / insulin-resistant pathway is active and visible.** `carb_ceiling_g: 90` (vs 130 default), ISM 1.25, `threshold_context: { shift: 6, reason: "Metabolic risk detected — thresholds adjusted for your profile.", leniency: stricter }`. Maya reads Glucose Goddess; the app quietly adapting the math to her insulin resistance is exactly the unstated promise of "know if you're on track."

**Would Maya still be paying at Month 3? → Probably, if the breakfast catalog expands.** Recipe catalog is up from 79 → 117 (+48%), but breakfast is **unchanged at 8 recipes**. Over 4 weeks that's 3.5 repeats per breakfast — uncomfortable for a Sunday meal-prepper who needs variety.

**Would Maya still be paying at Month 6? → Only if Fuel Good integrates with WHOOP or adds a CGM layer.** Oura is shipping AI meal logging; Dexcom Stelo is OTC; WHOOP has the wearable relationship Maya already trusts. Standalone nutrition-app retention at 6 months requires a defensible moat that *any* wearable app could absorb with 2 engineers and a vision doc.

---

## 1. Delta vs the 04-16 Baseline — What shipped, what didn't

Each 04-16 P0 verified against current code + live API.

| # | 04-16 P0 | Status | Evidence |
|---|---|---|---|
| **1** | Every Healthify response must be a structured recipe card | ✅ **SHIPPED** | `POST /api/chat/healthify` returns `healthified_recipe` with `{title, description, ingredients[], steps[], prep_time_min, cook_time_min, servings}` + `ingredient_swaps[]`. Tested both craving ("healthify mac and cheese") and pantry ("what can I make with salmon, bok choy, rice") — both returned cards. |
| **2** | Meal reveal must honor `liked_proteins` + `flavor_preferences` | ❌ **NOT SHIPPED** | [frontend/app/onboarding-v2/meal-reveal.tsx](frontend/app/onboarding-v2/meal-reveal.tsx) still hardcodes 3 meals (Chicken Shawarma Bowl, Homestyle Smash Burger, Turkish Eggs). Zero reference to `protein_preferences` or user prefs. **Mitigation:** the headline has been reframed from *"Here's what a great day looks like for you"* to *"This is what Fuel Score 100 looks like."* — the dishonest personalization claim is gone. But the opportunity to delight a fresh user at minute 4 was missed. |
| **3** | Scan must be a tab | 🟡 **PARTIAL / ALTERNATIVE** | [frontend/app/(tabs)/_layout.tsx](frontend/app/(tabs)/_layout.tsx) still has 5 tabs (home / meals / chronometer / chat / profile) — no scan tab. BUT [(home)/index.tsx:1281-1303](frontend/app/(tabs)/(home)/index.tsx:1281) now has "Scan Food CTA — second hero tile" on the home screen as a big quick-action. Better than the +menu buried 3-deep. Not the full fix, but a thoughtful compromise. |
| **4** | Hide "Needs Work" for day-0 / <3 logged meals | ✅ **SHIPPED** | [(home)/flex.tsx:45-66](frontend/app/(tabs)/(home)/flex.tsx:45) — explicit code comment `// R3 fix (Month-1 target-user feedback):` — `getTierLabel(avg, mealsLogged)` returns `"Ready to start"` in slate-400 when `mealsLogged < MIN_MEALS_FOR_TIER (3)`. Exactly matches the 04-16 request. |
| **5** | Meals-per-day onboarding question | ✅ **FULLY WIRED** | UI: "Typical meals per day" picker with options 2 (IF/OMAD) / 3 (Most common) / 4 (With a snack) / 5+ — observed live in sim ([29g-goals.png](runs/captures/maya/29g-goals.png)). Code: [(auth)/onboarding.tsx:484](frontend/app/(auth)/onboarding.tsx:484) sends `expected_meals_per_week: mealsPerDay * 7 (clamped 7-35)` to `/api/fuel/settings`. Backend: `User.expected_meals_per_week` (Column default 21) used in flex math ([fuel.py:183-184](backend/app/routers/fuel.py:183), [fuel_score.py:714-773](backend/app/services/fuel_score.py:714)). Meal planner calorie math also uses `meals_per_day` ([meal_planner_fallback.py:72](backend/app/agents/meal_planner_fallback.py:72)). |

**Shipped: 3 of 5 fully, 1 partial, 1 not done. ~70% P0 delivery in one week.** That's a real week.

---

## 2. What Maya experienced in Week 1 (live walkthrough)

### Onboarding — significantly improved

**Structural wins:**
- **Body + Activity + Meals-per-day + Goal consolidated into one scrollable form** (was 4 separate screens at 04-16). Less tap-tap-tap ceremony. See [29g-goals.png](runs/captures/maya/29g-goals.png).
- **Protein preferences pre-filled** from API-provisioned profile (Maya's chicken/salmon/shrimp/eggs/fish liked + lamb disliked all appeared pre-selected on first render — [28-proteins.png](runs/captures/maya/28-proteins.png)). This is a subtle premium cue.
- **"Typical meals per day" picker** — answers the 04-16 IF/OMAD critique head-on. Maya picked 3, and her `expected_meals_per_week=21` flows downstream to flex math + meal planner calorie allocation.
- **"Maintain & optimize"** is now an explicit goal option alongside "Metabolic reset / health". 04-16 Alex had to shoehorn his intent into "Metabolic reset." Maya got a clean match.

**Unchanged or new friction:**
- **Body measurement fields (weight, height, age) are NOT pre-filled** from API-provisioned profile, even though the data exists server-side. Contrast with the proteins step which *is* pre-filled. Inconsistent UX. Mild.
- **Text inputs lack `testID` / `accessibilityIdentifier`** — Maestro flows using `tapOn: below: "Weight"` worked in April; don't work today. This suggests no end-to-end tests in CI. Worth adding before the next persona run.
- **iOS "Save Password?" keychain prompt** interrupts the first screen after sign-in. First-impression friction. 1-line fix (`autoComplete="off"` on the fields during sign-up flow).
- **The value-prop carousel (You already know something is off → Real food. Real energy → You don't have to be perfect)** is three screens that don't take input. Fine content, but three Continue taps with no interaction before the first real question. Consider compressing to one animated screen.

### Home / Today's Plan / Flex Budget

Verified via `/api/fuel/weekly` with Maya's day-0 token:

```
clean_meals_target: 17 / 21
flex_budget: 4 / week
flex_points_total: 315
projected_weekly_avg: 95.0
meals_logged: 0
tier label (computed client-side): "Ready to start" (slate-400) ← R3 fix
```

The "Ready to start" tier label replaces the previous red "Needs Work" on Day 0. This is worth the 30-minute change it represents — for Maya (who churned from Noom over shame copy), this is the difference between first-impression "is this another diet app?" and "OK, this respects me."

### Healthify Chat — the real unlock

Two test prompts, both returned structured cards:

**Prompt 1** (craving): *"Healthify a mac and cheese craving. I want the comfort, without the crash."*
- Returned: **Creamy Chicken & Cauliflower "Mac" and Cheese** — 15 ingredients with qty/unit, 5 cook steps, 15+30 min, 2 servings, plus `ingredient_swaps` with `{original: "Refined wheat pasta", ...}`.
- Respected Maya's insulin_resistant context (low-carb framing, cauliflower sub).
- Chose chicken (Maya's liked protein) over beef.
- *One gap:* no `fuel_score` / `mes_score` pre-computed on the generated card. Maya has to tap through to the preview endpoint to see the score. Low-effort improvement.

**Prompt 2** (pantry): *"What can I make for dinner with salmon, bok choy, and rice?"*
- Returned: **Pan-Seared Salmon with Garlic-Ginger Bok Choy and Brown Rice** — 10 ingredients, 6 steps, 15+20 min.
- 04-16 note: *"First chat query [salmon + bok choy + rice] returned 2 paragraphs of useful advice but no structured recipe card."* → **Fixed.** This was the fragility that made me worry about chat in April; it's gone.

### Scanner — Coca-Cola scan smoke test

```
barcode 049000006346 (Coca-Cola)
→ score: 3.0, tier: ultra_processed, verdict: "Not a great fit"
→ concerns: ["Sweetened beverage: ultra-processed regardless of ingredient count.", "Contains added sugars.", ...]
```

Consistent with the Batch-4 fix from 04-16 (Coke ≤20). Scanner scoring calibration is still sane.

```
barcode 851818005034 (Siete chips)
→ 404: "Product not found — try scanning the label directly."
```

**New finding:** Siete is a popular whole-food-brand at Maya's Whole Foods. It's absent from the product DB. Fallback to `label_scan` exists, but losing the barcode-first happy path on a top-50 healthy-snack brand hurts the Yuka-parity story. This is a data-ops problem (ingest OpenFoodFacts + expand), not an engineering one.

### Meal Plan generation for Maya

`POST /api/meal-plans/generate {style: balanced, days: 7}` produced 21 items, **13 unique titles**. Breakdown:

- 3× Creamy Corn Salmon Chickpea Pasta, 2× Smoked Salmon Omelet with Avocado → salmon *is* appearing in Maya's plan (5/21 = 24% salmon-containing slots). 04-16 gap ("Zero salmon") → closed.
- 2× Sweet Potato Beef Sliders, 2× Crispy Beef Tacos → beef still appears despite Maya's pescatarian lean. Her `protein_preferences.disliked` only lists lamb, so this is compliant with her literal input, but the meal planner isn't picking up the signal that "pescatarian-leaning" is different from "no beef restriction." Worth a soft-filter rule: if `salmon + shrimp + other_fish` are all in `liked` and `chicken` is also `liked`, down-weight beef by 30%.
- 0× shrimp anywhere in the plan — despite being a top-liked protein. The catalog only has 2 shrimp recipes, and both apparently failed the balance/budget scoring.

---

## 3. Retention analysis — Maya's 4-week arc

### Recipe catalog delta (the single biggest retention lever)

|                | 04-16 baseline | 04-23 replay | Δ |
|---|---|---|---|
| Total recipes | 79 | **117** | **+48%** |
| Breakfast | 8 | 8 | **0** |
| Lunch | — | 13 | — |
| Dinner | — | 28 | — |
| Snack | — | 6 | — |
| Salmon-primary | 1 | 2 | +1 |
| Shrimp-primary | — | 2 | — |
| Chicken-primary | — | 34 | — |
| Beef-primary | — | 19 | — |

**The big story:** total catalog +48% is a meaningful week's work. **The honest story:** breakfast is still 8. Maya meal-preps on Sunday. Over 28 days she'd cycle each breakfast 3.5 times. Unless those 8 are *really* good, she'll fall off the plan and into ad-hoc logging — which is where MyFitnessPal lost her in 2018.

### Week-by-week projection for Maya

| Week | Open rate | Why |
|---|---|---|
| Week 1 | **7/7** | Onboarding momentum + structured chat wins + PCOS pathway visible in the numbers |
| Week 2 | **6/7** | Chat has kept her. Scan has replaced Yuka for 3-4 grocery trips. Breakfast rotation starting to feel small. |
| Week 3 | **4/7** | Classic 3-week quit window. Breakfast fatigue + Sunday meal-prep variety ceiling. Counterweight: she's planned one *Flex* meal for Saturday dinner — that's a sticky emotional hook Noom doesn't have. |
| Week 4 | **5/7** | Renewal moment. If Maya has had ≥2 *wow* chat sessions + has logged ≥5 flex meals without guilt + has seen her Fuel Score average climb above 80 → she renews at $14.99/mo. If breakfasts have become a chore → she cancels and keeps Yuka. |

### Maya's Day-28 renewal checklist (grounded in code + current catalog)

| Condition | Status at Day 28 |
|---|---|
| ≥ 2 "wow" chat moments | **Likely** — chat structured output is reliable; Glucose Goddess-aligned recipes available |
| ≥ 5 scans that changed a grocery decision | **Likely for mainstream UPCs, unlikely for Siete/Goodpop/Hu Kitchen** — DB gaps hurt |
| ≥ 10 meals logged in one tap from the plan | **Likely for lunch/dinner, risk on breakfast** (only 8 options) |
| ≥ 1 dessert / flex meal logged without guilt | **Likely** — Flex Budget screen is still the emotional center (R3 copy fix helps) |
| PCOS / IR math visibly working | **Yes** — `threshold_context` exposes the shift; Maya (Glucose Goddess reader) will notice |

**Renewal forecast:** ~65% probability of conversion at $14.99/mo. Up from an equivalent ~55% projection for Alex at 04-16.

---

## 4. Competitive positioning — updated

(Full refresh in [tasks/market-refresh-2026-04-23.md](tasks/market-refresh-2026-04-23.md).)

**Biggest real threat to Fuel Good:** not any nutrition app — it's **Oura's meal-logging** (shipped 2024-2025 for Ring 4 users) and the mainstreaming of OTC CGMs (Dexcom Stelo, Abbott Lingo). Both hit Maya's cohort directly.

**Biggest real opportunity:** the **post-GLP-1 maintenance cohort**. Noom pivoted to Noom Med for weight-loss users; GLP-1 users coming off the drug need a framework for maintaining without the appetite suppressant, and *specifically* need nutrient-density and energy framing — Fuel Good's exact positioning. Shipping a "post-GLP-1 transition" onboarding variant would be a differential channel.

**PCOS/IR-specialist threat:** Allara Health (~$60-80/mo clinical-telehealth) is adjacent but different — it's a *service*, not a tracking app. Low substitution risk; moderate co-purchase risk (Maya could use both). No consumer PCOS tracking app has won the narrative.

**Where Fuel Good is unambiguously strongest (unchanged from 04-16):**
- Structured chat output (now reliably delivered)
- Flex Budget framing (Noom's anti-pattern, Fuel Good's brand asset)
- Tone: non-manipulative, non-shaming, non-restrictive
- PCOS/IR math exposed via `threshold_context` — the only generalist app doing this

**Where Fuel Good is still weakest:**
- Recipe catalog (117 vs MyFitnessPal's 14M foods, Cronometer's USDA-verified)
- Product barcode DB (Yuka's millions vs Fuel Good's ~hundreds)
- Breakfast variety (8 recipes is structurally a retention ceiling)
- No wearable integration (Apple Health, WHOOP, Oura)

---

## 5. Updated Priority Recommendations

### P0 — ship before any paid acquisition scales

1. **Meal-reveal personalization** (the one 04-16 P0 that didn't ship). At minimum, pull 3 recipes from `/api/recipes/browse?protein_type={first_liked_protein}&limit=3`. 2-hour change. Closes the trust gap at minute 4.
2. **Breakfast catalog expansion to 20+** — single biggest retention lever per 4-week projection. Use the same AI pipeline that generated the 38 new recipes in this cycle. Focus: overnight oats variants, egg-based meal-prep options, chia pudding formats.
3. **Recipe card on chat response should include pre-computed Fuel + MES scores** — the chat returns ingredients; run them through `/api/metabolic/preview` server-side before response. Maya shouldn't need a second tap to see if the craving-substitute recipe actually scores.
4. **Product barcode DB expansion** — ingest top-1000 OpenFoodFacts + UPC Item DB entries for US Whole Foods / Trader Joe's brands. Siete, Hu, Goodpop, Simple Mills, RXBAR. Closes Yuka-parity gap for Maya's realistic scan behavior.
5. **"Post-GLP-1 transition" onboarding variant.** New opportunity identified this cycle. Would open a high-LTV channel via endocrinologist partnerships.

### P1

6. **Soft-filter pescatarian-leaning users** — if `liked_proteins ⊇ {salmon, shrimp, other_fish}` and `disliked_proteins` is small, down-weight beef by 30% in meal plan scoring. Doesn't require a hard dietary_tag.
7. **WHOOP integration** — read weight + activity + recovery; show "Your recovery was low today — here's a fiber + protein breakfast idea." Oura is already here; ship before they ship nutrition at WHOOP parity.
8. **Pre-fill body measurements** on the body step from `/api/metabolic/profile` the same way proteins already pre-fill. Consistency.
9. **Compress the value-prop carousel** from 3 screens to 1 animated screen. Three taps with no input is a friction surface we can cut.
10. **Scan-to-cart** — after scan, one-tap "Add to this week's grocery list." Converts scan behavior into plan behavior.

### P2

11. **Single headline score on home** with Fuel/MES as drill-downs (unchanged from 04-16 — still two parallel scores shown upfront).
12. **Apple Health sync** for weight + activity.
13. **Share recipe card to iMessage** in one tap (Maya's partner is a cook; send-to-partner is a real behavior).

---

## 6. The single most important thing (updated)

**The chat response is now a real product surface, not just a novelty.** At 04-16 I argued the Flex Budget was the heart. I still think that's right for brand, but the chat is now the *daily engagement* heart — it's where Maya goes when the plan is boring, when she's at her partner's restaurant staring at the menu, when she wants to use pantry leftovers, when she feels a craving and wants to not feel shamed. Every chat response being a saveable structured recipe card is what turns "ChatGPT for food" into a defensible product with a paywall.

Protect the chat schema. Add the fuel/mes score to it. Add one-tap save. Add one-tap share. This is the wedge that'll convert Maya at Day 28.

---

## 7. Renewal verdict — Maya at Day 28

| Axis | Value |
|---|---|
| Baseline conversion P at $14.99/mo | **~65%** (projected from 4-week arc + chat strength + PCOS fit) |
| Year-1 LTV if retained | **$180** ($14.99 × 12) |
| Churn risk vector | Breakfast boredom → ad-hoc logging → MyFitnessPal-equivalent frustration → cancel |
| Sticky vector | Chat recipe cards for cravings + Flex Budget emotional framing + PCOS math that WHOOP doesn't have |
| Biggest external risk at Month-6 | Oura / WHOOP shipping first-party nutrition |

---

## Appendix A — Screenshot index (Maya, 2026-04-23)

- `[01-login.png]` login screen (initial)
- `[02-login-filled.png]` credentials entered via coord-tap fallback
- `[03-post-signin.png]` first onboarding screen "You already know something is off"
- `[20-next.png]` motivation chooser "What brought you here?" — 6 options
- `[21-after-motivation.png]` frequency screen
- `[22-mirror.png]` snapshot card with "60% of the average American diet is ultra-processed"
- `[23-next.png]` Fuel Score intro with 85 ring
- `[24-next.png]` Flex preview Mon-Sun dots with Fri/Sat marked FLEX
- `[25-next.png]` Flavor profile picker (6 flavors)
- `[26-flavors-selected.png]` Savory + Umami + Mild selected
- `[27-dietary.png]` Dietary goals + Allergies screen
- `[28-proteins.png]` **Prefilled proteins from API-provisioned profile** — Chicken/Salmon/Shrimp/Other Fish/Eggs liked, Lamb avoided
- `[29-body.png]` Body form with Weight/Height/Age/Sex inputs
- `[29f-activity.png]` Activity selector with Regularly active checked
- `[29g-goals.png]` **"Typical meals per day" picker (P0 #5 shipped)** + Goal grid
- `[30-goal-picked.png]` Maintain & optimize selected

Full capture dir: `/Users/arafrahman/Desktop/Fuel-Good/runs/captures/maya/`

---

## Appendix B — Methodology notes

- **Hybrid UI + API + code approach.** Simulator form-input brittleness at the body-measurements step made pure UI-driven walkthrough uneconomical; authenticated flows exercised via backend as Maya's provisioned user. Code-diff verification against 04-16 findings provided ground-truth on which P0s shipped.
- **Persona data:** `runs/personas/personas.json` now contains `maya` key for future reuse. Provisioner: `runs/provision_maya.py`. Token cached at `runs/personas/tokens.json`.
- **Seeding:** DB was empty at start of run (localhost:8000 backend was pointing at a fresh DB). Ran `python3 restore_meals.py` → 117 recipes synced from `official_meals.json`.
- **Market research subagent had no web access in this session** — reported what's verifiable to Jan 2026 cutoff, flagged `[UNVERIFIED POST-CUTOFF]` items. Recommend a browsing-enabled pass before this assessment goes to stakeholders. Full subagent output: [tasks/market-refresh-2026-04-23.md](tasks/market-refresh-2026-04-23.md).
- **Not captured in this replay:** the paywall screens (Maya never reached them in UI; need to complete body form first). The cook mode flow. The chronometer / micronutrient screens. The achievements / streak UX. These are gap areas for a subsequent focused QA pass.

---

## Appendix C — Files touched in this assessment

- `runs/personas/personas.json` — added `maya` entry
- `runs/provision_maya.py` — new (persona-only provisioner)
- `runs/flows/maya-signin.yaml`, `maya-onboard-01..06.yaml`, `maya-body*.yaml`, `maya-goal.yaml` — Maestro flows
- `runs/captures/maya/` — 16 screenshots
- `tasks/market-refresh-2026-04-23.md` — market subagent output
- `tasks/month1-target-user-assessment-2026-04-23.md` — this file

No app code was modified.
