# Weekly Clean Baseline — Product Reframe Plan (2026-05-08)

**Goal:** Reframe Fuel Good around the weekly clean baseline: users should be able to eat healthy, minimally processed whole foods most of the time, enjoy food that tastes good, feel better, and live without guilt when real life includes takeout, dessert, restaurants, or social meals.

**Outcome target:** retain paying customers by making the app feel useful no matter how they eat: generated meal plans, ad hoc curated meals, chat/Coach, home cooking, scanning, manual logging, restaurant meals, and desserts all feed the same weekly proof that they ate more healthy than unhealthy.

---

## 1. Product thesis

> **Fuel Good helps you eat clean most of the time, however you eat.**

The app should not assume every user follows a generated weekly plan. It should support three common modes equally well:

1. **Planner** — uses generated weekly plans for decision relief.
2. **Curated eater** — chooses Fuel Good meals ad hoc when they want something healthy and tasty.
3. **Tracker/scanner** — eats their own food, scans/logs meals, and checks whether the week was mostly clean.

The shared loop:

```text
Choose / Eat / Scan / Log -> Weekly Fuel Proof -> Feel Better -> Live Guilt Free
```

The weekly Fuel Score is the product's proof layer. It tells the user: "You ate clean most of the time this week." That proof creates permission to enjoy life without turning the app into food police.

---

## 2. Context — what exists today

**Backend (mostly live):**
- `WeeklyFuelSummary` includes `flex_meals_used`, `flex_budget_total`, `flex_budget_remaining` (`backend/app/models/fuel.py`).
- `compute_flex_budget()` runs on `/fuel/weekly` and `/fuel/health-pulse` (`backend/app/services/fuel_score.py`, called from `backend/app/routers/fuel.py`).
- Fuel Score is already 0-100 continuous with 5-tier classification (`whole_food` >=85, `mostly_clean` >=70, `mixed` >=50, `processed` >=30, `ultra_processed` <30).
- Manual flex logging works end-to-end via `POST /fuel/flex-log`.
- `clean_eating_pct` and `expected_meals_per_week` live on user settings.

**Frontend (visible but mis-framed):**
- Flex components exist: `FlexBudgetCard`, `FlexInsightsCard`, `FlexSummaryCard`, `FlexMealsEarned`, `SmartFlexCard`, `FlexUnlockedToast`, `FlexTicketRow`.
- Dedicated flex screen exists at `frontend/app/(tabs)/(home)/flex.tsx`.
- Track tab renders a calendar with tier colors, but the gradient is not yet the primary weekly story.
- Scan result UI already has correction affordances, but they are buried in the details flow.

**What's mis-framed:**
1. Flex is too central. The product promise is broader than earning cheat meals.
2. Low-score scans can be mentally interpreted as "you used a flex," even when the meal is mostly clean with one weaker component.
3. Tickets read like a budget/accounting system instead of emotional permission.
4. Empty states can feel shame-coded (`0 FUEL THIS WEEK`) before the user has done anything.
5. Scanner trust is fragile when inferred flags are presented too confidently.
6. Corrections exist for meal scans but are not visible enough to build user trust.
7. Meal plans are valuable, but not every retained user will use plans as their primary behavior.

---

## 3. Core philosophy commitment

> **Show the clean baseline the user is building, not a ledger of what they did wrong.**

Fuel Good should answer these questions in order:

1. **How is my week going?**
   "You're at 84 this week. Mostly clean."

2. **What is the easiest healthy next step?**
   Follow today's plan, cook a curated meal, scan lunch, log what you ate, or ask Coach.

3. **Do I have room for life?**
   "You've built a strong baseline. Dinner out still fits."

This keeps the product intuitive for users who plan, users who cook from curated meals, and users who mostly scan/log.

---

## 4. Mental model

| Layer | Purpose | User-facing framing |
|---|---|---|
| **Weekly Fuel Score** | Cumulative cleanliness proof | "You ate clean most of the time this week." |
| **Meal Fuel Score** | Weighted view of the meal | "Mostly clean, with one processed component." |
| **Flagged components** | Explain what affected the score | "The bread lowered the score because it may contain refined flour/seed oils." |
| **Corrections** | Build scanner trust | "If that's wrong, tell us what it was." |
| **Curated meals** | Taste-first whole-food inspiration | "Want shawarma bowls tonight?" |
| **Meal plans** | Decision relief for planners | "Your week is handled." |
| **Coach / chat** | Turn cravings into clean options | "Make this burger craving Fuel Good." |
| **Flex / Life meals** | Emotional permission | "Your clean baseline gives you room for life." |

Important distinction:

- Fuel Score is **not** an automatic flex classifier.
- A low or mixed component is **not** automatically a flex meal.
- Flex is intentional: dessert, pizza night, takeout, drinks, social meals, or anything the user chooses to enjoy without guilt.

Example:

```text
Meal: grilled meat + vegetables + healthy fats + processed bread
Result: mostly clean meal, bread flagged as the weaker component
Not: automatic cheat meal / automatic flex spent
```

---

## 5. Taste-first clean eating

The app should not motivate users through discipline alone. It should motivate through desire.

Fuel Good needs to repeatedly prove:

> **Healthy, minimally processed whole-food meals can be craveable, easy, and normal.**

That is where curated meals and chat/Coach become core retention features, not side features.

### Curated meals
- Lead with appetite appeal: flavor, cuisine, texture, comfort, and ease.
- Use Fuel Score as reinforcement, not the headline.
- Make whole-food meals feel like the desirable choice, not the responsible compromise.
- Show examples that break the "healthy is boring" assumption: shawarma bowls, smash burgers, tacos, pasta, Turkish eggs, high-protein desserts, takeout-style bowls.

### Coach / chat
- Act as the clean-eating translator.
- Turn cravings into whole-food versions: burgers, pasta, tacos, pizza-ish bowls, desserts, takeout-style meals.
- Help users choose a realistic clean next step based on time, ingredients, preferences, and the weekly baseline.
- Avoid lecturing. The tone should be: "You can still have something delicious; let's make it Fuel Good."

### Weekly proof
- After the user chooses a tasty clean meal, Fuel Score confirms the choice helped the week.
- The sequence is: appetite first, action second, proof third.
- This makes healthy eating feel rewarding before the score even appears.

---

## 6. Scan accuracy and speed strategy

The scanner must be trustworthy, but it cannot feel slow. Speed is part of the product experience.

**Target behavior: fast result first, smarter correction second.**

### Default fast path
- One fast vision/model pass.
- Deterministic scoring after extraction.
- Return a useful first result in ~3-5 seconds when possible.
- Show meal score, main components, major flags, and confidence.
- Do not run multiple models on every scan by default.

### Selective deep path
Run deeper analysis only when it is worth the latency/cost:

- Low confidence extraction.
- High-impact ambiguous component, such as bread/wrap/sauce/oil.
- Hidden-ingredient assumption, such as seed oils in restaurant food.
- Contradictory result, such as likely pizza scoring very high.
- User taps Refine or submits a correction.

### Trust ladder
1. Extract components: protein, vegetables, starches, bread/wraps, sauces, cooking fats, dessert, drinks, portions.
2. Score proportionally: one processed component lowers the meal, but does not define the entire meal.
3. Mark assumptions clearly: "Assumed standard bun may contain seed oils/refined flour."
4. Prompt correction when it matters: "If this was fresh sourdough, tell us."
5. Recompute before logging if the user corrects it.
6. Preserve correction metadata so future accuracy can improve.

---

## 7. Correction UX

Corrections should feel like a normal part of trusting the scan, not like homework.

**Current foundation:**
- Meal correction API exists: `PATCH /scan/meal/{scan_id}/correct` in `backend/app/routers/scan.py`.
- Frontend already calls it through `wholeFoodScanApi.correctMeal` in `frontend/services/api.ts`.
- The scan screen already has a correction textbox in `frontend/app/scan/index.tsx`, but it is too buried.

**Reframed UX:**

Show correction prompts near the flagged component:

```text
We flagged the bread because it looked like a standard processed bun.
If that's wrong, tell us what it was.
```

Example user correction:

```text
The bread was fresh sourdough from a local bakery, made with flour, water, salt, and starter.
```

Expected result:

```text
Updated: removed seed-oil assumption from bread.
Refined flour may still apply unless it was whole-grain sourdough.
```

Rules:
- Keep logging available from the first result.
- Make correction optional and contextual.
- Recompute score/flags quickly after correction.
- Reuse the original extraction where possible; do not restart the entire scan unless needed.
- Add product/barcode/label correction parity so packaged food assumptions can be fixed too.

---

## 8. Home hierarchy

Home should not assume the generated plan is the only path. It should adapt to the user's behavior.

1. **Weekly baseline hero**
   Running weekly Fuel Score, tier, trend, and warm interpretation.

2. **Best next healthy action**
   Contextual CTA based on the user's state:
   - Follow today's plan.
   - Cook a craveable curated meal.
   - Scan what you're about to eat.
   - Log your last meal.
   - Ask Coach to turn a craving into a clean option.

3. **Curated / plan options**
   Show generated plan meals if the user has a plan; otherwise show high-appeal curated meals. Lead with taste, then show Fuel Score as proof.

4. **Real-life permission**
   Lightweight flex/life copy only when relevant:
   - "You've built a strong baseline. Dinner out still fits."
   - "Mostly clean week. Enjoy dessert without spiraling."

5. **Nutrition detail**
   MES, macro/micro rings, streaks, quests, and deeper data live below the primary weekly story.

---

## 9. Component-level reframe

| Current | Reframed | Why |
|---|---|---|
| Red "0 FUEL" empty state | Neutral "Week starts with your first log" | No shame before action |
| Flex budget as hero | Weekly clean baseline as hero | Broader product promise |
| "4 flex meals available" | "Mostly clean week. Room for life." | Avoids accounting-heavy UX |
| Low scan implies flex | Low scan contributes to weekly average | Fuel Score is proof, not punishment |
| Flagged ingredients as verdict | Flagged components with confidence | More accurate and teachable |
| Hidden correction textbox | Contextual correction near flagged components | Builds trust without friction |
| Today's plan as assumed action | Best next healthy action | Supports planners and non-planners |
| Coach only as tab | Coach as craving-to-clean helper | Makes healthy eating feel tasty and realistic |
| Nutrition-led recipe cards | Taste-first curated meals with Fuel proof | Motivates through desire, not discipline |

---

## 10. Copy audit

| Avoid | Prefer |
|---|---|
| "0 FUEL THIS WEEK" | "Week starts with your first log" |
| "You used a flex" after any low scan | "This lowers your weekly average, but your week can still be mostly clean" |
| "4 flex meals available" | "You've built room for life this week" |
| "Bad / cheat / failed" | "Mostly clean / mixed / indulgent" |
| "Use them guilt-free anytime" | "Your clean baseline gives you room to enjoy it" |
| "No meals logged" | "Log your first meal to start your weekly baseline" |
| "READY TO FUEL" | Delete or replace with a specific action |
| "Eat this because it's healthy" | "Craving tacos? Make them Fuel Good tonight" |
| "High-score clean meal" as the headline | "Chicken shawarma bowl" first, "Fuel 100" second |

---

## 11. Phased implementation plan

### Phase 0 — Product spec lock
- [x] Rename this effort internally from Flex Meals Reframe to Weekly Clean Baseline.
- [x] Confirm the product thesis: "eat clean most of the time, however you eat."
- [x] Lock the rule that Fuel Score is not an automatic flex classifier.
- [x] Define how Home chooses the "best next healthy action."
- [x] Lock the taste-first principle: appetite appeal leads; Fuel Score proves.

### Phase 1 — Weekly baseline hero
- [ ] Build or adapt `WeekPaceTimeline` for weekly average, daily color, and trend.
- [x] Replace shame-coded empty states with neutral baseline-start copy.
- [x] Surface warm interpretation: "Mostly clean week," "Strong baseline," "Room for life."
- [x] Keep plans visible, but do not make them the only primary action.

### Phase 2 — Scanner trust and correction UX
- [x] Promote correction textbox near flagged components and confidence warnings.
- [x] Show inferred flags as assumptions, not facts.
- [x] Recompute score/flags before logging after correction.
- [x] Add product/barcode/label correction parity.
- [ ] Keep initial scan fast; deeper analysis only on low confidence or correction.

### Phase 3 — Component-weighted scan feedback
- [ ] Make scan results explain the whole meal composition, not just a single verdict.
- [x] Treat mixed meals proportionally: clean protein/veg/fats should count positively even if bread/sauce lowers the score.
- [x] Distinguish intentional indulgence from weaker components.
- [ ] Add QA fixtures for "mostly clean plus processed bread," restaurant oil assumptions, fresh sourdough correction, dessert, pizza, and takeout.

### Phase 4 — Best next healthy action
- [x] Add a Home card that adapts between plan meal, curated meal, scan, log, or Coach.
- [x] If below target, offer curated meals or Coach suggestions without framing the user as failing.
- [x] If on track, reinforce the baseline and suggest an easy next clean meal.
- [x] Ensure curated meal CTAs lead with craveable meal names and photos/descriptions before nutrition data.

### Phase 5 — Taste-first curated meals + Coach
- [x] Audit curated meal cards for appetite-first copy, imagery, and cuisine variety.
- [ ] Add Coach prompts that transform cravings into whole-food versions.
- [ ] Connect below-baseline states to tasty clean suggestions, not generic advice.
- [ ] Make Healthify-style transformations feel central: "tell us what you're craving, we'll make it Fuel Good."

### Phase 6 — Flex / life meals as supporting layer
- [x] Keep flex as emotional permission, not the main product engine.
- [x] Do not auto-spend flex on every low-score scan.
- [x] Let users intentionally mark a meal as a life/flex meal when it matches their intent.
- [x] Trigger celebrations for consistency milestones, not just flex unlocks.

### Phase 7 — Cleanup and deprecation
- [x] Audit old flex-budget components for accounting-heavy copy.
- [ ] Remove or rewrite duplicated/dead flex components after confirming imports.
- [ ] Extract shared explainer UI if still needed.
- [x] Update onboarding copy so users understand all three modes: plan, curated meals, scan/log.

### Phase 8 — Verification
- [ ] Run persona QA for planner, curated eater, and scanner/tracker users.
- [ ] Verify first scan result returns quickly and does not block on multi-model analysis.
- [ ] Verify corrections update score/flags before logging.
- [x] Verify no day-0 red/shame states remain.
- [x] Verify low-score components do not automatically become flex meals.
- [ ] Verify curated meals and Coach make whole-food choices feel tasty, not clinical.

---

## 12. Decisions locked in this plan

1. **Weekly clean baseline is primary.** Flex is supporting, not the center of the app.
2. **Fuel Score is cumulative proof.** It answers whether the user ate clean most of the time.
3. **Fuel Score is not an automatic flex classifier.**
4. **Mixed meals are scored proportionally.** One processed component should not define the whole meal.
5. **Scanner corrections are first-class.** Users can correct wrong assumptions before logging.
6. **Scanner speed matters.** First result should be fast; deeper analysis is selective.
7. **Meal plans are one path, not the only path.** The app must retain planners, curated eaters, and scanner/logging users.
8. **Taste comes before score.** Curated meals and Coach should make whole-food eating desirable before Fuel Score proves it.
9. **No shame framing.** The app helps users feel better and live guilt free.

## 13. Open questions to resolve in Phase 0

- **Home action ranking:** what priority order should choose between plan meal, curated meal, scan, log, and Coach?
- **Correction threshold:** when should the UI proactively ask for a correction vs hide it behind Refine?
- **Fast scan SLA:** should the product target be 3 seconds, 5 seconds, or "show progress by 3 seconds, result by 5"?
- **Flex language:** do we keep the term "flex meal" or shift user-facing language toward "life meal" / "room for life"?
- **Weekly interpretation:** should copy emphasize score number, tier label, or plain-language summary first?
- **Craving transformations:** should Coach always offer a whole-food version of a craving, or only when the user asks?

## 14. Out of scope for this pass

- Social sharing / leaderboard.
- Custom user-defined flex budgets.
- Full restaurant menu integration.
- Multi-image plate decomposition.
- Meal-level MES for desserts.
- Major backend schema redesign beyond correction metadata and product-scan correction parity.

---

## 15. Success criteria

- A non-plan user can scan/log all week and understand whether they ate more healthy than unhealthy.
- A planner still sees generated meal plans as high-value decision relief.
- A curated-meal user can choose healthy meals ad hoc without feeling outside the main loop.
- Curated meals and Coach make minimally processed whole-food choices feel craveable, not boring.
- A mostly clean meal with one processed component is explained proportionally, not labeled as a cheat meal.
- Scan results return fast enough that users do not abandon the flow.
- Users can correct wrong scan assumptions before logging.
- The app's emotional takeaway is: "I ate well most of the time, I feel better, and I can enjoy life without guilt."
