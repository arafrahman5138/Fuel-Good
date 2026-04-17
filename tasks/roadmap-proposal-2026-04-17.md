# Fuel Good — Roadmap Proposal from Month 1 Target-User Assessment

**Date**: 2026-04-17
**Source**: Recommendations from [month1-target-user-assessment.md](month1-target-user-assessment.md) + deferred items from [fix-completion-report.md](fix-completion-report.md) (prior fix plan, Batches 7/8/11/12).
**Context**: Alex Chen (wellness-curious SF PM, $180k, ex-MyFitnessPal, Yuka user) scored the app 7.2/10 after a live Week 1 + projected Weeks 2–4. Research on MyFitnessPal / Yuka / Cronometer / Noom / ZOE / MacroFactor confirms a real market gap for "eat clean without counting calories" — Fuel Good has the wedge. This roadmap is about turning that wedge into retention.

---

## How to use this doc

Every initiative is numbered (R1–R24). After reading, tell me which to proceed with using the item numbers — e.g., *"yes to R1, R2, R5, R8–R12; skip R3, R4; defer R6"*. Items are grouped thematically; priorities (P0 / P1 / P2) are called out inline.

**Definition of priorities:**
- **P0** = ship before any paid marketing scales. Material to retention.
- **P1** = next 60 days. Material to Month-3 LTV.
- **P2** = next 90+ days. Delight / moat amplification.

---

## Group A — Fix the Trust-Cost Moments (P0, 4 items)

Every app has first-5-minute moments where a new user catches you being slightly dishonest or sloppy. Alex caught three. These compound. They're also the cheapest fixes in the plan.

### R1. Meal reveal honors liked_proteins + flavor_preferences

- **What**: `frontend/app/(auth)/onboarding.tsx` step 12 currently falls back to a hardcoded meal list when `/meal-suggestions` returns empty. Make the fallback `/recipes/browse` call filter by user's `liked_proteins` + `flavor_preferences` from onboarding state (not just `dietary_preferences`, which it already does after Batch 3).
- **Why**: Alex marked salmon + shrimp as liked, saw four chicken/beef meals at minute 4. Trust cost.
- **Effort**: 1–2 hours. One file.
- **Files**: `frontend/app/(auth)/onboarding.tsx` (extend the fallback logic I added in Batch 3).
- **Success**: Alex re-onboarding sees ≥1 salmon/shrimp dish on the reveal screen. Jest snapshot locks it.
- **Priority**: **P0**.

### R2. Every Healthify chat response renders as a structured recipe card

- **What**: Enforce the agent output schema so every response includes `{title, fuel_score, mes_score, ingredients[], steps[], save_button}`. Currently ~50% of responses are prose-only (e.g., Alex's fridge query returned paragraphs, no card; his craving query returned a perfect card). Inconsistent = not trusted.
- **Why**: This is the feature that makes Fuel Good's chat better than ChatGPT (ChatGPT won't track score, won't save). If the card render is flaky, the moat doesn't hold.
- **Effort**: 4–6 hours. Agent prompt + parser + retry logic.
- **Files**: `backend/app/agents/healthify.py`, `backend/app/routers/chat.py`, `frontend/app/(tabs)/chat/*`.
- **Success**: 10 consecutive diverse prompts (craving, fridge, ingredient, cuisine, swap) all return a card. Add a pytest that asserts the agent's JSON shape.
- **Priority**: **P0**. Overlaps with deferred Batch 8 (N11 chat reliability).

### R3. Remove "Needs Work" red label on day-0 / <3 logs

- **What**: Flex Budget screen shows "0 Needs Work" in red on day 1 when the user has logged 0 meals. Guard the tier-label logic: if `logs_this_week < 3`, return a neutral label like *"Ready to start"* with gray color.
- **Why**: Punitive framing on day 0 contradicts the whole anti-Noom brand. Single-line fix with outsized emotional impact.
- **Effort**: 30 minutes.
- **Files**: `frontend/app/(tabs)/(home)/flex.tsx` (~line 50 in `getTierLabel`).
- **Success**: Brand-new user sees gray "Ready to start" instead of red "Needs Work."
- **Priority**: **P0**. Overlaps with deferred Batch 11 item N32.

### R4. Onboarding asks "how many meals do you typically eat per day?"

- **What**: Add a question in onboarding-v2 goal-context or a new screen: "Typical meals per day?" with chips (1 / 2 / 3 / 4 / 5+). Scale the 80%-clean-eating denominator to `meals_per_day × 7`, not hardcoded 21.
- **Why**: Alex does IF and eats ~15 meals/week. "21 meals remaining" is mathematically wrong for him and for the Attia-adjacent longevity segment. Since this segment IS the target user, fixing the assumption unlocks the market.
- **Effort**: 4 hours. Schema + onboarding screen + `fuel_settings.expected_meals_per_week` propagation.
- **Files**: `backend/app/models/user.py` or `fuel_settings`, `frontend/app/(auth)/onboarding.tsx`, `backend/app/routers/fuel.py`.
- **Success**: A user who picks "2 meals/day" sees "14 meals/week" + "11 clean target" on Flex Budget.
- **Priority**: **P0**.

---

## Group B — Elevate the Core Behaviors to Tab Level (P0, 3 items)

The quote: *make existing behaviors easier*. Alex already scans at grocery, asks AI for recipes, and eats from a plan. Each should be a persistent tab or near-zero-friction surface.

### R5. Scanner becomes a first-class tab

- **What**: Replace or augment the bottom tab bar to include Scan as a primary tab (not under the + menu 3 taps deep). Two options: (a) replace Track with Scan and move Track under Home drill-down; (b) add a 5th tab and accept the density.
- **Why**: Scanning products is THE Yuka-user pre-existing behavior. Fuel Good's scanner is better (it adds score + swap suggestions) but invisible. Research shows Yuka has 40M+ users — this is a 10M+ addressable-users behavior already in market.
- **Effort**: 1 day. Tab bar rework + navigation plumbing.
- **Files**: `frontend/app/(tabs)/_layout.tsx`, icon assets, routing.
- **Success**: Scanner ≤1 tap from any screen. A/B the entry rate pre/post change.
- **Priority**: **P0**.

### R6. Recipe catalog expansion: 79 → 150+ (P0 sprint), 250+ by Month 3

- **What**: The biggest retention lever in this plan. Currently breakfast=8, lunch=13, dinner=26. At 21 meals/week over 4 weeks, users see the same breakfast 4x. Add: 22 breakfasts, 37 lunches, 24 dinners to reach 30/50/50. Prioritize: pescatarian lunches/dinners (unblocks Jordan persona), West African (Derrick), Japanese breakfast (Haruki), Mexican family meals (Elena).
- **Why**: Research: "The best app is the one you'll actually use consistently. If too complicated, you'll give up." Menu repetition is the silent killer. Plan variety = retention.
- **Effort**: 2 weeks. Options: (a) hire a recipe developer + photographer; (b) AI-generate via existing pipeline + human-QA; (c) license from a recipe publisher. Recommendation: (b) + (a) combined — 50 AI-generated passing QA + 20 hand-crafted halo recipes.
- **Files**: `backend/official_meals.json`, `backend/scripts/import_wholefood_site_recipes.py`, new image CDN.
- **Success**: `/api/recipes/filters` returns total ≥ 150. Regression: every persona plan ≥ 15 unique meals in 21 slots.
- **Priority**: **P0**. Overlaps with deferred Batch 12 (N19).

### R7. Pantry feature — chat remembers staples

- **What**: Add a "Pantry" screen under Profile. User marks staples they always have (olive oil, garlic, rice, eggs, Greek yogurt, etc.). Chat agent auto-includes pantry context when generating recipes. Update `healthify.py` to fetch pantry and inject into prompt context.
- **Why**: THIS is the chat-vs-ChatGPT moat. ChatGPT forgets. Fuel Good remembers. The "what's in my fridge" chip becomes "what's in my pantry + fridge" — Alex just enters what's NEW (salmon, bok choy) and pantry fills in the rest.
- **Effort**: 1 week. New table, CRUD endpoints, settings UI, agent prompt update.
- **Files**: `backend/app/models/pantry.py` (new), `backend/app/routers/pantry.py` (new), `frontend/app/(tabs)/profile/pantry.tsx` (new), `backend/app/agents/healthify.py` (context injection).
- **Success**: After setting up pantry with 8 items, Alex asks "dinner with salmon" — response ingredients includes pantry items by name.
- **Priority**: **P0** (this is the chat moat).

---

## Group C — Close the Loops (P1, 4 items)

Each existing feature's output should create the next action. Right now: scan → result → dead end. Chat → card → dead end. Plan → meal → log ✅ (this one works).

### R8. Scan history on Home + one-tap "add to grocery list"

- **What**: Add a "Recent Scans" card to Home showing last 5-10 scans with score badges. Each scan result page gets an "Add to this week's grocery list" CTA that writes to the existing grocery tab.
- **Why**: Closes the Yuka-like behavior into the Fuel Good flow. After scanning 5 items at Whole Foods, Alex comes home, opens the app, and the evidence of his behavior is the first thing he sees.
- **Effort**: 2–3 days.
- **Files**: `frontend/app/(tabs)/(home)/index.tsx`, `frontend/app/scan/*`, `backend/app/routers/grocery.py`.
- **Success**: Alex scans 5 products → Home shows "5 scans this week · 3 whole-food · 1 avoid" card; each scan result has "Add to list" button that persists.
- **Priority**: **P1**.

### R9. Ultra-processed scan result suggests a whole-food swap in-line

- **What**: When scan returns `tier == "ultra_processed"`, call the chat agent with context `{product_name, ingredients_flagged}` and render ONE swap suggestion below the score. "Coke scored 19. Try: LaCroix + fresh lime (Fuel 92). Tap to add to grocery list."
- **Why**: This is the nutrition literacy promise from the README ("the app educates without lecturing"). Currently the scan result is a dead end; adding the swap closes the educational loop and gives a constructive next action.
- **Effort**: 3–4 days. Agent integration + UI.
- **Files**: `backend/app/routers/scan.py`, `backend/app/agents/ingredient_swapper.py` (already exists!), `frontend/app/scan/index.tsx`.
- **Success**: Scanning Coke surfaces "Try sparkling water with lemon — Fuel 95" as a tappable chip.
- **Priority**: **P1**.

### R10. "Regenerate just this meal" per plan card

- **What**: On the generated meal plan, every meal card gets a 🎲 icon. Tap → swap that ONE meal with another recipe matching the same slot + preferences. Currently users only pick Include/Avoid at plan-build-time.
- **Why**: Alex gets to Thursday, doesn't feel like Gochujang Chicken tonight. Without this feature, he cooks something off-plan → breaks the zero-friction logging loop. One-tap swap keeps him in the plan.
- **Effort**: 3–4 days. Backend alternatives endpoint exists (`/meal-plans/items/{id}/alternatives`) — wire up frontend.
- **Files**: `frontend/app/(tabs)/meals/*` or `frontend/app/(tabs)/(home)/index.tsx`, leverage `backend/app/routers/meal_plan.py` alternatives endpoint.
- **Success**: Tap 🎲 on any meal → swap happens in <2 seconds, new meal respects dietary/protein prefs.
- **Priority**: **P1**.

### R11. "Plan your flex" — proactively bank clean meals around a known indulgence

- **What**: New onboarding quick-action and home CTA: "Got a pizza night this week?" → user picks the day → app shifts the plan to overweight clean meals Mon–Fri so the flex arrives guilt-free. Push Friday morning notification: *"You earned tonight's flex. Enjoy."*
- **Why**: This is the flex system taken to its emotional endpoint. It's the single most differentiated feature in the plan. No competitor has proactive flex-planning. This is the feature in the tweet.
- **Effort**: 1 week. UI + planning-engine tweak + notification.
- **Files**: `backend/app/agents/meal_planner_fallback.py`, `frontend/app/(tabs)/(home)/flex.tsx`, notification cron.
- **Success**: Alex sets "flex on Saturday" Monday. By Saturday, his clean meal count is ≥19/week instead of 17. Friday morning push delivered.
- **Priority**: **P1**. This is the flagship feature recommendation.

---

## Group D — Friction Reduction (P1, 2 items)

Data-entry friction is the #1 reason users quit nutrition apps (research consensus). Every friction point removed compounds.

### R12. Apple Health sync (weight + activity)

- **What**: HealthKit integration: pull weight history + daily step/workout counts. Auto-update `weight_lb` in metabolic profile when user changes on Health.app. Auto-adjust activity multiplier based on 7-day average.
- **Why**: Alex wears a Whoop, logs weight on a Renpho scale, does Peloton. Asking him to re-enter weight every 2 weeks = data-entry tax. Pulling from Health cuts this tax to zero.
- **Effort**: 3–4 days. HealthKit permissions + background sync.
- **Files**: `frontend/services/healthkit.ts` (new), `backend/app/routers/metabolic.py` weight update path.
- **Success**: Alex updates Renpho → Fuel Good updates weight + recomputes targets within 24h. No manual entry.
- **Priority**: **P1**.

### R13. Share Healthify recipe card via iMessage

- **What**: On every chat-generated recipe card, add an iOS Share Sheet button. Sends title + ingredients + nutrition as a rich preview link.
- **Why**: Alex's wife Emma is the secondary user. When Alex finds a recipe he likes, sharing it is how she becomes a co-user — and how Fuel Good gets its best referral channel.
- **Effort**: 1 day. React Native `Share` API + deep link.
- **Files**: `frontend/app/(tabs)/chat/recipe.tsx`.
- **Success**: Tap Share → iMessage sheet with "Healthified Mac & Cheese [tap to open in Fuel Good]" preview.
- **Priority**: **P1**.

---

## Group E — Simplify the Scoring / Gamification Ceremony (P1, 4 items)

The app currently shows 2 parallel scores × 4 sub-scores × 8 tier labels × 5 daily quests × 3 streak counters. That's cognitive load in a category (wellness) where simplicity wins.

### R14. Single headline "Daily Score" on Home with Fuel/MES drill-down

- **What**: The Home card currently shows two rings — Fuel (0-100) and MES (0-100). Replace with one "Daily Score" ring (weighted composite). Tap → drill-down shows Fuel + MES + sub-scores. Matches Whoop's proven pattern.
- **Why**: Alex the biohacker can handle both scores. His wife Emma can't. Simplifying to one score by default widens the addressable audience.
- **Effort**: 3 days. Backend composite endpoint already exists (`/metabolic/score/composite`). Frontend rework.
- **Files**: `frontend/app/(tabs)/(home)/index.tsx`, `frontend/components/MetabolicRing.tsx`.
- **Success**: Home shows one "84 Daily Score" ring. Tap → drill-down shows Fuel 92 / MES 76 with explanation.
- **Priority**: **P1**.

### R15. Consolidate 3 streak counters to 1 canonical

- **What**: `/fuel/streak`, `/game/stats.current_streak`, `/game/nutrition_streak`, `/metabolic/streak` → one canonical streak on `User.current_streak`. Deprecate the others or make them compute from the canonical. Document in ARCHITECTURE.md.
- **Why**: Currently three endpoints return three different numbers for the same user. UI inconsistency. This is the N13 item carried over from the fix plan.
- **Effort**: 2 days.
- **Files**: `backend/app/routers/fuel.py`, `backend/app/routers/gamification.py`, `backend/app/routers/metabolic.py`.
- **Success**: All three endpoints return identical `current_streak` at any moment.
- **Priority**: **P1**. Carryover from deferred Batch 10.

### R16. Dedupe 5 daily quests → 3 meaningful

- **What**: Currently users get 5 daily quests (general + logging + quality + metabolic + fuel). Reduce to 3: one behavior quest ("Log Breakfast"), one quality quest ("Fuel Score 90+ Meal"), one progression quest ("Complete today's plan"). The fiber-quest dedupe I shipped in Batch 10 was one step; this is the broader simplification.
- **Why**: 5 quests is "we built all the things" energy. 3 is the sweet spot per behavioral research (cf. Whoop's 3 daily goals).
- **Effort**: 2 days. `_generate_quests` rewrite + tests.
- **Files**: `backend/app/routers/gamification.py`.
- **Success**: `/api/game/daily-quests` returns 3 quests, distinct goal types.
- **Priority**: **P1**.

### R17. Retire the dismissal-ladder paywall; single transparent price

- **What**: Delete the $59.99→$29.99→$11.99 dismiss-to-discount ladder in `onboarding-v2/paywall.tsx`. Ship one price driven by `/api/billing/config`: **$9.99/mo or $59.99/yr**. (Research: Noom's $62M BBB-complaint problem is a neon-sign warning against dark-pattern pricing.)
- **Why**: Trust is the brand. The ladder is legally and ethically wobbly in the EU/UK (dark-pattern regulation tightening). Also my QA flagged this as N10.
- **Effort**: 1 day.
- **Files**: `frontend/app/onboarding-v2/paywall.tsx`, `backend/app/services/billing.py` config.
- **Success**: Every visitor sees the same prices. Paywall has no hidden discount layer.
- **Priority**: **P1**. Carryover from deferred Batch 7.

---

## Group F — Cook Mode + Dessert UX (P2, 3 items)

### R18. Cook mode: smart timers detected from step text

- **What**: Cook mode step text contains phrases like "Preheat oven to 375°F", "Cook for 25 minutes", "Sauté until browned (~8 min)". Run a light regex/NLP on each step. Surface a "Start 25-min timer" inline CTA when a time mention is detected.
- **Why**: Alex is cooking from his phone while his hands are messy. Taking the app's guidance and turning it into an actual kitchen tool. The existing cook-mode is passive; timers make it active.
- **Effort**: 3 days.
- **Files**: `frontend/app/cook/[id].tsx`, time-parsing util.
- **Success**: Chicken Sausage Scramble step 2 ("Cook turkey 8-10 min") shows "Start 10-min timer" button.
- **Priority**: **P2**.

### R19. Dessert celebration mode

- **What**: When user opens cook mode on a dessert (`meal_type == "dessert"` OR `tags` includes "dessert"), the header reads "Flex treat time. You earned it 🍫" instead of the generic cook UI. Subtle but reinforces the brand emotion.
- **Why**: The dessert moment IS the brand moment. Don't render it as generic.
- **Effort**: Half a day. Conditional header.
- **Files**: `frontend/app/cook/[id].tsx`.
- **Success**: Dark Chocolate Avocado Mousse cook mode shows celebration header.
- **Priority**: **P2**.

### R20. Cook mode ingredient checkboxes persist across app restarts

- **What**: Current ingredient check-off state is local React state — lost on app quit. Persist to `AsyncStorage` keyed by recipe_id.
- **Why**: Cooking takes 45+ minutes. User quits app mid-cook (text, call). Comes back, loses progress.
- **Effort**: 1 day.
- **Files**: `frontend/app/cook/[id].tsx`.
- **Success**: Check 3 ingredients, force-quit app, reopen cook mode — same 3 checked.
- **Priority**: **P2**.

---

## Group G — Testability + CI (Maintenance, 3 items)

### R21. Add testIDs to interactive elements that Maestro can't target

- **What**: Add `accessibilityIdentifier` / `testID` to: + menu rows (Log/Scan/Plan/Chat), commitment radio options, health-conditions toggles, paywall tiers, cook-mode Next/Previous, chat send button. My QA run repeatedly failed on coord-taps.
- **Why**: Without stable selectors, the Maestro flows I wrote can't run in CI. Without CI flows, every frontend change risks silent breakage. Also solves QA item N46.
- **Effort**: 2–3 days. Touches ~15 components.
- **Files**: scattered across `frontend/app/`.
- **Success**: Existing `runs/flows/*-full.yaml` persona flows run end-to-end in CI without coord-tap fallbacks.
- **Priority**: **P1** (blocks all other UI testing).

### R22. Jest snapshot tests for chat recipe card schema

- **What**: Add `frontend/__tests__/chat/recipe-card.test.tsx` that renders a fixture chat response and asserts the card has `title, fuel_score, ingredients, save_button` present. Plus a pytest that asserts the agent returns the JSON schema.
- **Why**: Pair this with R2. Enforce card-rendering reliability at both ends.
- **Effort**: 1 day.
- **Files**: new tests.
- **Success**: `npm test` in `frontend/` runs card-schema assertions.
- **Priority**: **P1**. Depends on R2.

### R23. Scoring calibration regression battery

- **What**: The test file I scaffolded in Batch 4 (`test_scoring_calibration.py`) was deferred. Ship it with ≥15 parameterized fixtures: Coke / Diet Coke / Pepsi / Red Bull / Gatorade / Oreos / Lay's / La Croix / whole milk / rolled oats / avocado / plain chicken breast / Ezekiel bread / quinoa / kombucha. Lock expected tier boundaries.
- **Why**: Scoring is the app's integrity. Every new edge case ("why did my LaCroix score 84?") should add a test, not be debugged in prod.
- **Effort**: 1 day.
- **Files**: `backend/tests/test_scoring_calibration.py` (new).
- **Success**: 15 parametrize'd cases pass. Coke ≤ 20, La Croix ≥ 85, etc.
- **Priority**: **P1**.

---

## Group H — UX Polish Bundle (P2/P3, carryover from deferred Batch 11)

### R24. Remaining UX polish bundle (10+ small items)

- **What**: The unshipped UX-polish items from the prior fix plan, consolidated:
  - N23: Onboarding step 2 missing back button
  - N24: Flavor picker needs "Select 2–4" helper text under disabled Continue
  - N27: KeyboardAvoidingView wrapping body-stats screen
  - N30: Commitment CTA testIDs (overlaps with R21)
  - N31: Reframe "4 flex meals available" as pre-allocated not earned on day 0
  - N33: Coach quick-starts filter out disliked proteins
  - N35: Logging Streak should start at 0 not 1 for fresh users
  - N36: Settings renders raw IDs instead of labels (`salmon` → "Salmon")
  - N37: "ISM" acronym explanation
  - N39/N44: Empty-state copy that says "low-carb breakfasts" shouldn't show to non-low-carb users
  - N43: Seed data fix "1 Pound 90 10 ground beef" → "1 pound 90/10 ground beef"
- **Why**: None individually critical; collectively they lift polish perception. Ship as one sprint.
- **Effort**: 1 sprint (~1 week).
- **Files**: Scattered frontend + `backend/official_meals.json`.
- **Success**: Before/after screenshot pairs for each. No visual regressions.
- **Priority**: **P2**. Carryover from deferred Batch 11.

---

## Summary Table

| # | Initiative | Group | Priority | Effort | Depends on |
|---|---|---|---|---|---|
| R1 | Meal reveal personalization | A Trust | P0 | 1–2h | — |
| R2 | Chat always returns recipe card | A Trust | P0 | 4–6h | — |
| R3 | Remove day-0 "Needs Work" shame | A Trust | P0 | 30m | — |
| R4 | Meals-per-day onboarding Q | A Trust | P0 | 4h | — |
| R5 | Scanner as first-class tab | B Core | P0 | 1d | — |
| R6 | Recipe catalog 79 → 150+ → 250 | B Core | P0 | 2wk | — |
| R7 | Pantry feature (chat moat) | B Core | P0 | 1wk | — |
| R8 | Scan history on Home + add-to-list | C Loops | P1 | 2–3d | R5 |
| R9 | Ultra-processed scan → swap suggestion | C Loops | P1 | 3–4d | R5 |
| R10 | "Regenerate just this meal" per card | C Loops | P1 | 3–4d | — |
| R11 | "Plan your flex" proactive banking | C Loops | P1 | 1wk | — |
| R12 | Apple Health sync (weight + activity) | D Friction | P1 | 3–4d | — |
| R13 | Share recipe via iMessage | D Friction | P1 | 1d | R2 |
| R14 | Single headline Daily Score | E Simplify | P1 | 3d | — |
| R15 | Consolidate 3 streaks → 1 | E Simplify | P1 | 2d | — |
| R16 | Dedupe 5 quests → 3 | E Simplify | P1 | 2d | — |
| R17 | Retire dismissal-ladder pricing | E Simplify | P1 | 1d | — |
| R18 | Cook mode smart timers | F Cook | P2 | 3d | — |
| R19 | Dessert celebration mode | F Cook | P2 | 0.5d | — |
| R20 | Cook mode checkboxes persist | F Cook | P2 | 1d | — |
| R21 | testIDs across UI | G Test | P1 | 2–3d | — |
| R22 | Jest recipe-card schema tests | G Test | P1 | 1d | R2 |
| R23 | Scoring calibration battery | G Test | P1 | 1d | — |
| R24 | UX polish bundle (10 items) | H Polish | P2 | 1wk | R21 |

**Totals**: 24 initiatives. Effort estimate: ~10 engineering weeks sequenced across 3 months. P0 bucket alone = ~3 weeks and covers the biggest retention risks.

---

## Suggested Sequencing (if you want a recommendation)

**Sprint 1 (2 weeks) — Trust + Core P0**: R1, R2, R3, R4, R5, R17, R21, R23. *(Ship before marketing scales.)*

**Sprint 2 (2 weeks) — Pantry + Scan loop + Catalog**: R6 (ongoing catalog), R7, R8, R9, R22. *(Delivers the chat moat + scan-behavior loop.)*

**Sprint 3 (2 weeks) — Engagement + Plan flex**: R10, R11, R14, R15, R16. *(Amplifies the flex feature that differentiates the brand.)*

**Sprint 4 (2 weeks) — Friction + Polish**: R12, R13, R18, R19, R20, R24. *(Delight + retention compounding.)*

---

## Pricing Decision (separate approval)

If R17 (retire dismissal ladder) ships, recommend:

- **Monthly**: $9.99
- **Annual**: $59.99 (44% savings badge)
- **Lifetime**: $149.99 (retain as-is)
- **Free trial**: 7 days (unchanged)

Rationale: ZOE sells $30+/mo for LESS actionable personalization. Fuel Good's bundle (scan + plan + chat + flex) is worth $10/mo to Alex-types. The prior onboarding-paywall ladder (low-end $11.99) under-priced the product AND was dark-pattern-adjacent. Price honestly.

Approve/skip separately: **P-pricing**.

---

## Ask

Reply with approvals using the R-numbers, e.g.:
- *"yes R1–R5, R7, R11, R17, R21–R23; skip R6, R13, R19; defer R8–R10 to next quarter"*

Or for bulk:
- *"approve Sprint 1 + Sprint 2 as proposed; reject R4 because [reason]; add R-pricing"*

I'll execute against whatever you approve, one initiative at a time, with the verify → fix → retest loop we established in the prior fix plan.
