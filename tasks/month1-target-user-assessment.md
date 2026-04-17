# Fuel Good — Month 1 Target-User Assessment

**Date**: 2026-04-16
**Persona simulated**: Alex Chen, 35, Sr. PM in SF, $180k, reads Attia's *Outlive* + listens to Huberman, has tried MyFitnessPal (quit after 2 weeks), uses Yuka at the grocery store, cooks 3x/week + DoorDash 3x/week, wants energy/sharper focus/look good at 40
**Method**: Live iOS simulator (iPhone 17 Pro Max, iOS 26.2) driven via Maestro + `xcrun simctl`. Live backend (`localhost:8000`). Parallel market research on Reddit, competitor reviews, and industry coverage.
**Scope**: Week 1 simulated live (25+ screenshots); Weeks 2–4 projected from observed behavior patterns grounded in research and the codebase.

---

## Executive Verdict

**Would Alex pay $9.99/month after the 7-day trial?** → **Yes, with conviction.**
**Would Alex still be paying at Month 3?** → **Maybe. Depends on whether recipe catalog expands and the scanner becomes a habit.**
**Would Alex still be paying at Month 6?** → **Only if the Healthify chat becomes his go-to substitute-a-craving tool and the app learns his cooking style over time.**

**Composite Score: 7.2 / 10**
- Utility (does it do a thing he needs?) — **8 / 10**
- Polish (does it feel premium?) — **7 / 10**
- Habit-formation hooks (will he open it daily?) — **6 / 10**
- Moat vs. free alternatives (why not just Yuka + ChatGPT?) — **7 / 10**

**This is a real product with a real wedge.** Fuel Good is not trying to be MyFitnessPal or Noom — it's carving out a legitimate middle ground between "scan-and-forget" (Yuka) and "count-every-gram" (Cronometer). The reward-framing around flex meals is the single most differentiated emotional mechanic I've seen in the nutrition category in years. The research backs this up: users are actively migrating away from calorie counting (see sources below) and no app owns "eat whole food without obsessing" credibly yet.

**The honest risk:** it's tightly engineered where it counts (engine, scoring, plan generation) and under-engineered where users actually *touch* it (scanner discovery, chat recipe cards, meal-reveal personalization). The next 90 days of product work determine whether this becomes a beloved utility or another dashboard that dies in the app graveyard.

---

## 1. Is the app user-friendly / easy to use?

**Short answer: mostly yes, with three sharp edges.**

### What works

**Onboarding copy is among the best in the category.**
- *"Most of what's sold as food wasn't food 50 years ago. You're here because you want better."* — first screen. Attia-core messaging. Alex emotionally committed before he even entered his weight.
- *"Be honest — no judgment. This helps us help you."* — on the processed-food frequency question. **This is the opposite of Noom's BJ Fogg behavior-manipulation playbook.** Research confirms Noom has 2,000+ BBB complaints and a $56M class-action settlement over dark-pattern billing — Fuel Good's genuine tone is a competitive asset.
- *"You already know something is off."* — validates rather than sells. This is the tone of a co-conspirator, not a coach.

**The meal plan builder is the hero flow.**
- 2-step wizard. Step 1: pre-filled preferences + Plan Style (Meal Prep / Balanced / Variety). Step 2: per-meal **Include / Avoid** cards with MES scores visible. This is **genuinely novel**. MyFitnessPal doesn't have it. Cronometer doesn't have it. Noom's meal plans are linear not curational.
- Alex's reaction: *"This is the first screen where I actually feel like the app* made *me a plan, not just a dashboard."*

**The "Today's Plan" on Home with per-meal "+" to log is the right habit mechanic.**
- Visible Fuel Score (100) and MES (82) per meal card.
- *"Log 3 more → earn flex points"* — this is the quote in action: Alex already eats 3 meals/day, the app just adds a tap to turn that into progress.

**The Flex Budget screen is the pitch crystallized into math.**
- *"80% Clean goal = 17 clean meals + 4 guilt-free treats per week."*
- *"Eat clean — meals scoring 80+ keep your budget full."*
- *"Fresh budget every Monday — use them or lose them."*
- This is the best gamification copy in any health app I've seen. Streaks without shame. Rewards without restriction language. It makes the whole philosophy understandable in one screen.

**Healthify chat delivered a legitimate recipe card for a craving prompt.**
- Alex's prompt: *"Healthify a mac and cheese craving. I want the comfort, without the crash."*
- Response: **"Healthified Chicken Mac and Cheese with Hidden Veggies"** — prose explanation ("packed in fiber from whole wheat pasta and hidden veggies") + structured recipe card with ingredients. This is the feature doing what the README promises.

### What hurts

**The + menu has terrible discoverability and navigation failure modes.**
- The bottom-right "+" floating button opens a 4-row menu (Log Meal / Scan / Create New Plan / New Chat with AI) with no testIDs, no accessibility labels per row, and inconsistent tap-target bounds. A user's finger will work, but automation breaks. More importantly, **Scan buried 3 taps deep under a floating menu is the wrong IA** — scanning is the behavior users already do with Yuka; it should be a first-class tab or a sticky CTA.
- **Recommendation (applying the quote):** replace the Track tab with a Scan tab, or add a 5th tab for Scan. The behavior Alex already does is "scan things at the grocery store." Making it easier = making it one tap from the home screen.

**Meal reveal personalization is demonstrably false.**
- Alex marked **salmon and shrimp as liked**, **lamb as disliked**. The reveal screen showed: Chicken Sausage Scramble, Baked Ziti, Bang Bang Chicken, Beef & Broccoli. Zero salmon. Zero shrimp. The copy says *"Here's what a great day looks like for you"* — but it wasn't tuned for him at all.
- **Trust cost:** this is at minute 4 of Week 1. If Alex catches the mismatch, he starts second-guessing every subsequent recommendation.

**Chat sometimes returns prose without the recipe card.**
- First chat query ("what's for dinner with salmon + bok choy + rice"): returned 2 paragraphs of useful advice but **no structured recipe card, no ingredients list, no Save button**.
- Second chat query ("healthify mac and cheese"): returned a beautiful recipe card.
- **The inconsistency is the problem.** If a user's first chat disappoints, they don't retry. Every Healthify response needs to render as a saveable recipe card — the format should not depend on the model's whim.

**"0 Needs Work" in red on day 0 is punitive.**
- A brand-new user who has logged zero meals sees a bright red "Needs Work" label on their Flex Budget. That's shame-coded. Either hide this for the first 3 days or change the copy to a neutral "Let's get started."

**The weekly goal assumes 21 meals/week.**
- *"21 meals remaining"* / *"17 clean meals target."* Alex eats ~15 meals/week (intermittent fasting, skips breakfast most days). The math framework breaks for a whole segment of the target market — especially the Attia-adjacent longevity crowd that Fuel Good's own copy attracts.
- **Fix:** ask "how many meals do you typically eat per day?" in onboarding. Scale the 80% target accordingly.

---

## 2. Is it over-engineered, under-engineered, or tightly engineered?

**Verdict: Tightly engineered in the engine room; under-engineered at the user surface; over-engineered in scoring ceremony.**

### Tightly engineered (good):

- **Metabolic engine** (`backend/app/services/metabolic_engine.py`). Proper Mifflin-St Jeor TDEE, ISM multipliers for insulin resistance, carb curve calculation, protein targets scaled to body weight + goal, per-condition sugar ceilings. This is clinical-grade math. Evidence: the 5 personas in my QA run all produced directionally correct calorie/macro targets after the Batch 1 fix. The *lactation +350 kcal bonus*, *HTN 1500 mg sodium cap*, and *IBD fiber floor inversion* I added in Batch 2 all compose cleanly with the existing pipeline.
- **Fuel Score calibration** — post-Batch-4-fix, it correctly scores Coca-Cola ≤20 (ultra-processed) and Oreos at 0 while plain sparkling water stays ≥85. The beverage penalty override is surgical.
- **Recipe filtering pipeline** (`backend/app/agents/meal_planner_fallback.py`). Dietary tag + ingredient-level inference + allergy filter + liked-proteins bias + cooking-time soft signal + MES budget alignment + random tiebreak. 21 meals get generated deterministically with 14+ unique titles per persona. Sophisticated.

### Over-engineered (the ceremony around scoring):

- **Two parallel scoring systems (Fuel Score + MES) with four sub-scores each.** The README explains this well ("Fuel = real food, MES = metabolic balance"). But the UI surfaces it as *four numbers per meal card* — Fuel 100, MES 82, plus a Projected Daily Score ring, plus a Weekly Average. For Alex, the Attia-reader, this is tolerable. For his wife Emma, the nutrition-curious skeptic who would be a prime secondary user, it's immediately overwhelming.
- **The tier system has 8 visible labels** (whole_food / solid / mixed / ultra_processed for Fuel; critical / at_risk / safe / optimal for MES). That's an L3 org chart's worth of taxonomy for a nutrition app.
- **Three parallel streak counters** (fuel.streak, game.current_streak, game.nutrition_streak) in the API. I documented this in QA but the fix was deferred — it's a symptom of the same "we built all the things" instinct.
- **Four daily quests per day** (general + logging + quality + metabolic + fuel — that's actually five). No user will engage with five distinct daily quests. Three would hit harder.

**Simplification suggestion:** Show one number by default — "Daily Score" — which is a weighted composite of Fuel + MES. Put Fuel/MES breakdown in a "What went into this" tap. This is exactly what Whoop does with its single "Recovery" score hiding HRV/RHR/sleep debt underneath. Alex already trusts that model.

### Under-engineered (the surfaces users actually touch):

- **Scanner discoverability.** Three taps deep, no tab, no home-screen CTA. Given research shows Yuka-style scan-at-grocery is a massive pre-existing behavior, this should be a tab, period.
- **Chat → Recipe card rendering.** Sometimes cards, sometimes prose. The schema exists, the parser is not consistently enforcing it. Should be 100% reliable.
- **Meal reveal personalization.** Hardcoded fallback list still dominates even though the onboarding captured flavor, dietary, and protein preferences. Low-hanging fruit: hit `/recipes/browse` with `protein_type` filter.
- **Testability.** The + menu and several other interactive elements lack `testID` / `accessibilityIdentifier` attributes. Maestro flows break on coord-taps. This is a sign the team isn't running end-to-end flows in CI.
- **Empty-state copy contradicts the reward philosophy.** "0 Needs Work" in red on day 0.

---

## 3. Which features could be enhanced, and how?

### Must-fix (P0, ordered by ROI)

1. **Reliable chat recipe-card rendering.** Every Healthify response should be a card with `{title, fuel_score, mes_score, ingredients, steps, save_button}`. Non-negotiable — this is the moat feature.
2. **Meal reveal honors preferences.** Use `liked_proteins` + `flavor_preferences` as a filter on the fallback `/recipes/browse` call. Alex must see salmon on the reveal screen when he marked salmon as liked.
3. **Scanner is a tab.** Move from under the + menu to a persistent tab (replace one existing tab or add a 5th).
4. **Hide "Needs Work" label for first 3 days + on fewer than 3 logs.**
5. **Meals-per-day onboarding question.** Default 21 is wrong for IF/OMAD/2MAD users (a meaningful slice of the Attia-adjacent market).

### Should-enhance (P1)

6. **Simplified headline score.** Show "Daily Score" (single number) on home. Make Fuel/MES a drill-down, not the primary display.
7. **Chat "What's in my fridge?" needs to be structured.** It's one of the 3 prominent quick-starts. The response should prompt for 2-4 ingredients with chips (salmon / chicken / eggs / veg you have on hand), then return a card, not a prose dump.
8. **Meal plan builder: "Regenerate just this meal" per card.** Right now you pick Include/Avoid at build-time. Give users a 🎲 button per slot in the generated plan to swap that one meal.
9. **Scan history on Home.** After Alex scans 5 products at the grocery store, he should see a compact "Your recent scans: 1 ultra-processed, 2 solid, 2 whole-food" snapshot on the home screen — closing the loop between scan behavior and Fuel Score progress.
10. **Cook mode needs smart timers.** The current cook mode shows step 1 ("Preheat oven to 375°F") as plain text. Add a "Start timer" button inline for any step with a time mention — detect "25 min" / "until browned" with a light regex. This makes existing cooking behavior *easier*.

### Nice-to-have (P2)

11. **Share recipe to text message.** When a chat-generated recipe card resolves, give Alex one tap to send it to his wife.
12. **Apple Health integration.** Sync weight + activity from Health.app to reduce manual entry. The research is clear: data-entry friction is the #1 reason people quit nutrition apps.
13. **"Cook this week" shopping list.** Grocery tab exists in the codebase — but tighten its wiring to cook-mode completion status. Check off ingredients as Alex cooks through the week.
14. **Dessert mode.** The cook mode works identically for desserts. But the framing should celebrate: "This is your flex — enjoy it guilt-free." Dessert cook mode should feel like a reward, not another recipe.
15. **"Explain my score" chat prompt must render a structured breakdown.** One of the quick-start chips, but the response needs to show a component bar chart (protein / fiber / sugar / fat contribution), not prose.

---

## 4. Is this an app users will come back to? (Retention analysis)

### Habit strength score — will Alex open it daily?

| Week | Open rate projection | Why |
|---|---|---|
| Week 1 | **7/7 days** | Novelty + onboarding momentum + first chat wins |
| Week 2 | **5/7 days** | Drops on DoorDash days unless scanning becomes a pre-order habit |
| Week 3 | **4/7 days** | Meal plan rotation boredom hits — 79 recipes can't sustain 21 meals × 3 weeks of variety |
| Week 4 | **4/7 days** | Renewal moment. If chat + scan have become real utilities, Alex renews. If not, churn. |

### Research-grounded retention math

From the competitor research:
- **3-week quit point is the universal danger zone** for nutrition apps. The friction of manual entry is the #1 reason users churn.
- **"The best app is the one you'll actually use consistently. If it's too complicated, you'll give up"** — this is the Reddit consensus.
- **Data-entry friction is the existential threat.** MyFitnessPal has a 14M-food database and users still quit because searching for "grilled chicken breast" returns 400 results.

Fuel Good's genuine advantage: **the Today's Plan one-tap-to-log mechanic.** Alex doesn't search a database — he taps a "+" next to a pre-selected meal. That's the "make existing behavior easier" quote in action. *If he cooks from the plan*, logging is zero friction.

The risk: **if the plan goes stale (79 recipes, breakfast only 8), he falls off the plan and now has to manually log or scan — which is where MyFitnessPal lost him before.**

### The single retention driver

**Recipe catalog expansion from 79 → 250+ is the single biggest retention lever.** Not the Alembic migration. Not the UI polish. Adding 3x the recipe variety. The research backs this up: every successful nutrition app has either a massive food database (MyFitnessPal, Cronometer) or an endlessly rotating content engine (Noom's daily lessons). Fuel Good currently has neither.

### Renewal decision forecast

**Alex at the Week 4 renewal checkpoint:** He'll renew *if* during his 28 days he had:
- **≥2 "wow" chat moments** (likely — Healthify is strong when it works)
- **≥5 scans that changed a grocery decision** (moderate — depends on fixing scanner discoverability)
- **≥10 meals logged in one tap from the plan** (likely if the plan isn't boring by week 3)
- **≥1 dessert / flex meal logged without guilt** (this is the emotional moat — if it works, it's sticky)

### Who should Fuel Good prioritize as a customer?

From the research + my 5 QA personas + Alex:

- **PRIORITIZE: the wellness-curious high-earner (Alex-type).** Reads Attia/Huberman, pays for Whoop, already scans at the grocery store, tired of calorie counting. $15-20/mo wellness app budget. LTV if retained: $180/year × 3 years = ~$540 × low CAC → unit economics work.
- **DEPRIORITIZE: the weight-loss-obsessive.** They'll use MyFitnessPal or MacroFactor for calorie trend-tracking. Fuel Good's "presence of the good" framing doesn't promise a number on the scale going down.
- **MIDDLE: the new-parent / postpartum user (like persona Elena).** Big segment, but requires the safety features (lactation, PCOS, gestational diabetes) that I shipped in Batch 2 but the UI hasn't been built to capture yet. Unlock with onboarding additions.

---

## 5. Competitive positioning (research-grounded)

| App | Their position | What they do that FG doesn't | What FG does that they don't |
|---|---|---|---|
| **MyFitnessPal** | "Calorie + macro tracker with social" | 14M-food database; community forums | Reward-framed flex meals; zero calorie obsession |
| **Cronometer** | "Scientific micronutrient tracker" | USDA-verified data; 80+ nutrients | Personalized meal plans; chat |
| **Yuka** | "Scan-and-rate at the grocery" | Massive product database; independent/trustworthy brand | Meal planning; cook mode; recipe library |
| **Noom** | "Behavioral psych for weight loss" | Daily lessons; 1:1 coaching | Non-manipulative tone; no dark-pattern billing |
| **ZOE** | "Microbiome-driven personalization" | Actual gut/blood biomarker panels | $30/mo vs. ZOE's $360+ initial |
| **MacroFactor** | "Adaptive calorie algorithm from Reddit r/fitness" | Weight-trend-based TDEE auto-adjustment | Scanner; chat; recipe library |
| **Lifesum / YAZIO** | "Gentle habit building" | Clean UI; quick-log features | More opinionated about food quality |

**The Fuel Good positioning that wins:** *"The nutrition app for people who've stopped counting calories but still want to know if they're on track."*

This is a **real, growing segment** (research confirms intuitive-eating transition is mainstream). No competitor owns it credibly.

**Where Fuel Good is weakest vs. alternatives:**
- Scanner accuracy + database size (vs Yuka's millions of products; FG's 79 recipes + external OpenFoodFacts path that still 502s on some UPCs)
- Food-search breadth (Cronometer / MyFitnessPal win for "what did I just eat" manual logging)
- Community (MyFitnessPal's forums retain users through social accountability)

**Where Fuel Good is unambiguously strongest:**
- **Reward framing** around flex meals. Literally no competitor ties "clean eating this week → earn guilt-free pizza" as a game mechanic. This is the emotional moat.
- **Healthify chat** for craving substitution. ChatGPT can do this in general but won't track your Fuel Score, won't save the recipe, won't respect your stored preferences. The integrated loop matters.
- **Tone.** Non-manipulative, non-shaming, non-"your body is a problem" copy. In a category dominated by Noom and its 2,000 BBB complaints, this is a brand asset.

---

## 6. Priority Recommendations (grounded in "make existing behaviors easier")

The quote: *"People will only do a thing they already do. If people are trying to do a thing and you make it easier, that's a good idea."*

**Three behaviors Alex already does that Fuel Good should make 10x easier:**

### Behavior 1: Alex scans products at the grocery store (Yuka habit)

**Make it easier:**
- **Tab-level scan**, not + menu. One tap from home.
- **Scan history on home screen.** "You scanned 8 items this week — 5 whole-food, 2 solid, 1 avoid. Nice job."
- **Scan-to-cart flow.** After scanning a product, offer "Add to this week's grocery list" — close the loop from scan-behavior to plan-behavior.
- **If product is ultra-processed, suggest one whole-food swap** via the existing chat infra. "This got a 19. Try [alternative]? (Tap to see why.)"

### Behavior 2: Alex asks ChatGPT things like "what can I make with salmon + bok choy?"

**Make it easier:**
- **The chat IS the product.** Make it the default tab. Not Coach → Chat. Just Chat, always one tap away.
- **Every response must be a structured recipe card.** Enforce the schema at the agent layer.
- **Save/share/cook buttons on every card.** Right now I can't tell if the card is savable.
- **Pull his pantry.** Add a "Pantry" screen where Alex can mark staples he has (olive oil, garlic, rice, eggs). The chat auto-uses them. This is the wedge vs. ChatGPT — ChatGPT forgets; Fuel Good remembers.

### Behavior 3: Alex feels guilty about Friday pizza, then eats it anyway

**Make it easier:**
- **The Flex Budget IS the emotional feature.** Lean all the way in. Push a *celebratory* notification on Friday: "You earned 3 flex meals this week. Use one tonight, guilt-free."
- **"Plan your flex"** feature. Alex inputs "I'm going out Saturday, want Neapolitan pizza" on Monday. The app adjusts the week's plan to bank extra clean meals Mon-Fri. That's truly novel.
- **The dessert flow in cook mode should be a celebration screen**, not a generic recipe. "Dessert time. You earned it."
- **Take away the red "Needs Work" on Day 1.** Replace with "Your week starts Monday — let's build the baseline."

---

## 7. How to make this a successful, profitable app

Based on the research + my persona walk-through + the 46-finding QA report + the 28 fixes I shipped, here's the sequenced path:

### Next 30 days (ship before any marketing)

1. **Fix meal reveal to filter by liked_proteins + flavor_preferences.** 2-hour fix. Kills the trust-cost of minute 4.
2. **Make every chat response a structured recipe card.** Enforce the agent output schema.
3. **Move Scan to a tab.** 4-hour IA change. Matches actual user behavior.
4. **Fix "Needs Work" day-0 shame.** 30-minute copy/guard change.
5. **Expand recipe library to 150+.** Hire a recipe developer or use the existing AI pipeline to generate + human-QA 70 new recipes. Focus: pescatarian lunches/dinners, West African, Japanese breakfast, Mexican family meals.

### Next 60 days (before paid acquisition scales)

6. **Apple Health sync** (weight + activity). Cuts data-entry friction materially.
7. **Scan history + one-tap-add-to-grocery-list.** Closes the scan-to-action loop.
8. **Pantry feature.** Chat pulls pantry contents automatically.
9. **Meals-per-day personalization** (don't assume 21).
10. **"Plan your flex" feature.** Book a cheat meal; app adjusts the plan around it.

### Next 90 days (unlock the next LTV tier)

11. **"Explain my score" conversational drill-down.** Real coaching via chat.
12. **Simplified single score on home** with Fuel/MES as drill-downs.
13. **Cook-mode smart timers.**
14. **Social/share surface.** Send a Healthified recipe card to a partner via iMessage in one tap.

### Pricing recommendation

**$9.99/mo or $59.99/yr (not $49.99).** The research shows ZOE gets $30+/mo for less actionable personalization. Fuel Good's chat + scan + plan + flex is worth more than $9.99/mo to Alex-types. The onboarding paywall dismissal ladder ($59.99→$29.99→$11.99) is dark-pattern-adjacent and should be retired — **trust is the single most valuable brand asset in this category** (see: Noom lawsuits). Price honestly, retain honestly.

---

## 8. The single most important thing

**The Flex Budget screen is the heart of this app.**

Every product decision should ask: *does this reinforce the "eat clean, earn your flex" loop, or does it distract from it?*

Right now the app has too many scores, too many tabs, too many quests. Simplify toward the flex loop. The research, the persona walk-through, and the competitive analysis all converge on the same conclusion: **the flex framing is what no one else has. Protect it. Amplify it. Make every other feature in the app serve it.**

If Fuel Good does that, it wins.

---

## Appendix A: Sources

### Research on competitor retention / positioning

- [Best Fitness App According to Reddit (2026) — Cora App](https://www.corahealth.app/blog/best-fitness-app-reddit)
- [Cronometer vs. MyFitnessPal: Comparing Macro Tracking — Katelyman Nutrition](https://www.katelymannutrition.com/blog/cronometer-vs-mfp)
- [Best Calorie Counting Apps 2026 | Ranked by AI & Ease of Use — Welling.ai](https://www.welling.ai/articles/best-calorie-counting-app-program)
- [Noom Weight Loss App Generates Thousands of Consumer Complaints to BBB — Subscription Insider](https://www.subscriptioninsider.com/monetization/auto-renew-subscription/weight-loss-app-noom-generates-thousands-of-consumer-complaints-to-bbb)
- [Noom's Alleged Lack of Business Transparency Could Cost The Weight-Loss App $62 Million — SUBTA](https://subta.com/nooms-alleged-lack-of-business-transparency-could-cost-the-weight-loss-app-62-million/)
- [ZOE Reviews | Read Customer Service Reviews — Trustpilot](https://www.trustpilot.com/review/zoe.com)
- [Best Websites Like Yuka App in 2025 — Octalsoftware](https://www.octalsoftware.com/blog/websites-like-yuka-app)
- [Apps Like Yuka for Food and Cosmetic Scanning in 2025 — Emizentech](https://emizentech.com/blog/apps-like-yuka.html)
- [Yuka Alternatives: Top 12 Barcode Scanners & Similar Apps — AlternativeTo](https://alternativeto.net/software/yuka/)

### Research on "clean eating without calorie counting" segment

- [Food tracker without calories | See How You Eat App](https://seehowyoueat.com/food-tracker-without-calories/)
- [How to Switch from Calorie Counting to Intuitive Eating — Dietitian Hannah](https://dietitianhannah.com/blog/how-to-switch-from-counting-macros-to-intuitive-eating)
- [How to Transition from Tracking Macros to Intuitive Eating — Kate Lyman Nutrition](https://www.katelymannutrition.com/blog/tracking-is-temporary)
- [Best Diet Tracking Apps 2025: Reddit Reviews, Real Costs & Clinical Evidence — Digital Health Coach UK](https://digitalhealthcoachuk.net/%F0%9F%A5%97-best-diet-tracking-apps-2025-reddit-reviews-real-costs-clinical-evidence/)
- [Reddit Users Discuss the Best Calorie Counting Apps — FoodBuddy](https://foodbuddy.my/blog/reddit-users-discuss-the-best-calorie-counting-apps)

### Evidence from the simulator walk-through

- 30+ screenshots under `/Users/arafrahman/Desktop/Fuel-Good/runs/captures/alex/` documenting every screen Alex saw in Week 1.
- Prior QA report with 46 findings: `tasks/persona-qa-report-2026-04-16.md`
- 8 batches of fixes shipped this session: `tasks/fix-completion-report.md`
