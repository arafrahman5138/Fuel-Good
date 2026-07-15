# 5-Persona Month-of-Use QA Report — Fuel Good

**Date:** 2026-07-10/11 · **Build:** `main` @ bd4a219 (post two-pillar pivot) · **Environment:** local backend (real freemium gating via `ALLOW_OPEN_PREMIUM_IN_NON_PRODUCTION=false`), Expo Go on iPhone 17 Pro simulator, live Gemini scans, 117-recipe curated catalog.

**Method:** 5 distinct personas each simulated 30 days of realistic use (2026-06-11 → 07-10) via 411 backdated API logs shaped by per-persona behavior models, followed by live simulator passes per persona (onboarding, browsing, logging, scanning, quota walls, coach, recap, calendar, settings, accessibility). One additional fresh account (Nina) walked the full 14-step onboarding in the UI. Supporting data: [runs/api_analysis.md](runs/api_analysis.md) (21 API-level findings), [runs/*_month.json](runs/) (full capture of every response), ~60 annotated screenshots in [captures/](captures/).

| Persona | Profile | Tier | Month shape |
|---|---|---|---|
| Jordan, 27M | Gym rat, muscle gain, scans everything | Premium | 134 logs, 97% of days, 93% clean |
| Priya, 34F | Vegetarian mom, dinner-only logger | **Free** | 50 logs, ~60% of days |
| Frank, 58M | Hypertension + pre-diabetes, big portions | Premium | 84 logs, high-sodium diet |
| Sofia, 22F | Student, sweet tooth, burst logger | Free → Premium day 16 | 41 logs, 4-day finals gap |
| Marcus, 41M | Biohacker, MES-obsessive, edge-case magnet | Premium | 102 logs + 9 edge cases |

---

## Executive summary

The two-pillar pivot is real and visible: the Real Food Tracker loop (log → "11 of 17" → weekly recap → streak) is coherent, warm, and differentiated, and the scanner is genuinely excellent — fast, accurate, and uniquely integrated with the weekly tracker ("Logging this makes it 11 of 17 real-food meals this week" on the scan result is the best moment in the app). Zero shame-coded copy was found anywhere, including empty weeks — a stated brand goal, achieved.

But the month simulation exposed that **the scoring spine has a credibility hole (curated recipes hardcoded to Fuel 100 — including chocolate chip cookies, which also count as "real-food meals")**, **the clinical safety system is unreachable dead code** (no UI collects hypertension/lactation/IBD, and even when set via API the sodium ceiling never fired), and **a cross-account data leak** shows the previous user's macros to the next user on the same device. The premium pillar underdelivers in this build: Coach replies failed to render, meal-plan generation silently returns an empty week when embeddings are missing, meal suggestions returned `[]` for every premium persona, and achievements never unlock. Free-tier monetization moments are squandered (the scan-quota wall is a bare "Scan failed" alert with no upgrade button).

**Verdict by persona (would they be paying in month 2?):** Jordan yes (scanner+tracker earn it, despite false "over budget" warnings). Marcus no — the metabolic pillar he'd pay for is the app's buggiest area (streak stuck at 1, "Week 71" mystery badge, coach broken, empty suggestions). Priya stays free but retained (tracker+3 scans is genuinely useful; nothing sells her the upgrade). Sofia churns from premium back to free — the recap that converted her keeps praising her dessert-heavy weeks (85 "Strong"), so the product she bought has nothing left to coach. Frank is the saddest case: the one persona the metabolic moat was built for gets "Weekly Fuel 83.4 — a strong average" on a 1,600mg-sodium diet because the safety flags he needs can't be entered anywhere.

---

## P0 — Ship-blockers

| # | Finding | Evidence |
|---|---|---|
| P0-1 | **Account deletion is broken (HTTP 500)** for any user with XP history — `xp_transactions` FK has no cascade and the delete path misses it. App Store Guideline 5.1.1(v) + GDPR exposure. The audit's B9 cascade migration was never done. | `DELETE /api/auth/account` → 500; `ForeignKeyViolation: xp_transactions_user_id_fkey` in server log. Also: **no Settings UI for deletion exists at all**, so the feature is doubly dead. |
| P0-2 | **Cross-account data leak on shared device.** Logout does not clear the metabolic/nutrition zustand stores: free-tier Priya's Metabolic screen displayed exactly Jordan's same-day totals (81g protein / 82g carbs / 24g fiber) from the previous session. | captures/priya-06-metab-free.png vs Jordan's logged totals (40+33+8 P, 12+54+16 C). |
| P0-3 | **Hypertension sodium ceiling never fires.** (a) No frontend surface collects hypertension/lactation/IBD/ED-recovery — `grep` of `frontend/` returns zero hits, onboarding's health step only asks IR/prediabetes/T2D; (b) even set via API (`hypertension: true`, 148/92), Frank's targets came back `sodium_mg: 2300`, not ≤1500. The clinical-safety moat is dead code end-to-end. | frank_month.json provision.targets; onboarding capture ob-16. |
| P0-4 | **Curated recipes are hardcoded Fuel 100 — desserts included — and UI-logged desserts count as real-food meals.** All 188 curated logs across personas scored exactly 100.0 (Chocolate Chip Cookies, Baklava, 5 ice creams), while an equivalent manual "grilled chicken salad" scores 89.6 and a *scanned* cookie ~40. Live test: logging Chocolate Chip Cookies moved Sofia's tracker 2/17 → **3/17 real-food meals** (the "Log This Meal" path sends `meal_type: "meal"` for dessert-role recipes) and consumed no room. 17 cookies = a perfect "Strong" week. The intent (healthified desserts) doesn't survive contact with the scoring asymmetry. | api_analysis F5; captures/sofia-04/06/07. |

## P1 — Break trust or revenue

| # | Finding | Evidence |
|---|---|---|
| P1-1 | **"Today's Fuel" card divides all targets by 3** and labels the result as the day's budget: Jordan saw "1041/798 CAL — 243 over" in red (real budget ~2394) plus false "over" flags on every macro, while the Metabolic view on the same tab showed the correct 178g protein. Every multi-meal user gets falsely shamed by mid-day. When targets haven't loaded it renders literal `0/0`. | captures/jordan-29→31; jordan-03. |
| P1-2 | **Coach chat replies fail to render** ("Response was interrupted") while the server returns 200 — the `message` field is a `{'role','content'}` object where the client expects a string; retry re-sends and duplicates the user bubble. Flagship premium feature, failed 3/3 attempts. (Verify against prod provider; local Gemini also logged `truncated_json_repaired`.) | captures/marcus-02; server log `healthify.request.completed` 200 + UI failure. |
| P1-3 | **Streak displays are wrong or frozen.** Track tab: "21 weeks Fuel Streak / Best 21w" on a 30-day account (day-count with a weeks label); Priya "Best 10w". Metabolic streak ignores backdated logs (Jordan: 13 consecutive qualifying days → streak 1). Recap's "weeks at goal" (correct: 4) disagrees with both, and `goal_met=false` can coexist with a growing streak because they track different conditions. The April streak canonicalization did not stick. | captures/jordan-07, priya-04; api_analysis F2/F7/F12. |
| P1-4 | **Scan-quota wall is an error dialog, not an upsell.** After the 3rd free scan: plain OS alert titled **"Scan failed"** with only an OK button — no Go Premium action, no barcode shortcut, and no "1 scan left" indicator anywhere pre-wall. This is the freemium model's #1 conversion moment. | captures/priya-08-quota-wall.png. (Backend 402 + copy are well designed; the UI discards both.) |
| P1-5 | **Free tier both leaks and hides premium.** Leaks: full Metabolic Score UI renders for free users (with stale/leaked data per P0-2), and `health_pulse` returns `metabolic.score` to free accounts; Sofia's pre-conversion free days retroactively got MES scores. Hides: nothing on the free Home/Track advertises the metabolic pillar — the only gates ever encountered are Coach and My Plan. The premium pillar is simultaneously given away and unmarketed. | captures/priya-06; api_analysis F4. |
| P1-6 | **Meal-plan generation silently returns an empty 7-day plan** (200 OK, `items: []`, warnings buried in JSON) when `recipe_embeddings` is empty — which is the state after every `restore_meals.py` re-seed. Premium "Create Plan" → blank week with no error. Same root cause as `meal_suggestions: []` for all premium personas all month. | Live repro post-wipe; `recipe_embeddings: 0`. |
| P1-7 | **Scan logging silently adds a pairing item.** Jordan logged a scanned steak; the app also logged "Kale and White Bean Salad" (145 kcal, `fuel_score: null`) he never chose — unasked calories in his day and a null score in the data. | captures/jordan-29; `/api/nutrition/logs?date=2026-07-11` dump. |
| P1-8 | **Onboarding meal reveal ignores dietary preference** — vegetarian Nina's "great day" was salmon + two chicken dinners, one screen after she declared Vegetarian (the recap screen right after correctly lists "Vegetarian", so the data is there). April's P0 #2, still broken for diet. Protein prefs screen also offers meats to vegetarians. | captures/ob-17, ob-11. |

## P2 — Quality and correctness

- **Protein target = bodyweight-in-lb for everyone** — 232g/day for sedentary 58-year-old Frank (42% of calories), 142g for 5'3" Priya; `target_weight_lb` equals current weight even on a loss goal. Internally consistent, practically unreachable, and credibility-costing with the Attia crowd it targets (api_analysis F6).
- **`room_used` exceeds `room_total` in 15 of 25 weeks** (worst 13/4) and recap celebrates "7 room-for-life meals fit" against a budget of 4. The credit-model semantics may be intentional but the numbers read as broken (F3).
- **Same-day recipe dedup swallows intentional repeats** — meal-preppers logging the same recipe for lunch and dinner lose the second log silently (F8).
- **Recommendations ignore preferences and personalization**: nutrition-gaps suggestions are byte-identical for all 5 personas and offer vegetarian Priya "Gochujang Chicken Skewers" (twice — it doubles as the fiber pick) (F9).
- **Achievements are dead** (`[]`, 0 unlocked after Marcus's perfect 30/30 month) while XP/levels/quests all work — three-and-a-half progression systems, one of them a stub (F10).
- **No input bounds**: 10-serving 3,200-kcal lasagna accepted without confirmation (the 5,622-kcal day still scored MES 67 "good"); 500-char titles stored untruncated. (Correct: future/91-day dates 422, empty log 400, double-tap dedup works.)
- **Transient instability in Expo Go**: two spontaneous reloads mid-session (recipe browse → login screen), FAB overlay wedged and swallowed tab taps after deep-link navigation; scan-result screen renders `NaNg` when a macro is missing and displays garbled OCR product names verbatim ("Facouard 1% tanseorgh").
- **Silent form validation everywhere**: signup with invalid email/empty password, Body & Goals wizard with empty fields — Continue/Create just does nothing. No inline errors, no toasts. Three separate surfaces confirmed.
- **Settings "Health Context" opens a 3-step re-onboarding wizard on the Track tab with nothing prefilled** (placeholders instead of the user's saved 142/5'3"/34) and a reduced Sex option set (M/F vs onboarding's 4 options). Frank would re-enter everything or bail.
- **"Best streak" from a different unit**, "⚡ Week 71" badge showing the same value for two different users, "MEA 61 · May Dip" unexplained jargon chips on the MES screen.

## P3 — Polish

- Copy: "1 real-food meals" (recap banner), "Achievements 0/–", weekly ring paired with "First meal sets the pace" day-0 copy, recap "Weekly Fuel 89.3" vs tile "89", onboarding still uses "FLEX" badges the pivot retired, "Logged to **Chronometer**" vs tab named **Track** (and Cronometer is a competitor's name), paywall bullets overclaim ("Full access to… scans and tracking" — those are free), RevenueCat vendor jargon user-visible in the paywall fallback ("Open RevenueCat Paywall"), debug panel on subscribe screen (verify `__DEV__`-gated).
- Alphabetical default sort puts the photo-less recipes first — first browse impression is all gradient placeholders even though later pages have good photography; "20 recipes found" is actually "loaded so far."
- XXXL Dynamic Type: body text scales, but the Fuel ring numerals, week strip, and status chips don't — the numbers a low-vision user most needs.
- Free Coach tab is one small card in a screen of white space; no locked-preview to sell the feature.
- Onboarding personalized-snapshot and Fuel-explainer screens are excellent; the "5-minute setup" chip is honest; targets screen is clear (modulo the protein math above).

---

## Strengths (keep and build on)

1. **The scanner is the moat in practice.** Correct identification, honest confidence labels, Whole-Food Pass chip, per-scan Fuel+Metabolic badges, edit/refine and re-analyze affordances, favorites, ~fast results — and the tracker-context line on every result ("Logging this makes it 11 of 17") converts a utility into the habit loop. No competitor tested (Yuka, Cal AI) closes that loop.
2. **The weekly recap is a genuine proof moment.** "18 real-food meals — and 6 room-for-life meals fit. This is the proof: a strong baseline makes room for real life. Goal met — week won." Accurate to the data, warm, zero shame even for Sofia's empty finals week.
3. **Day-0 experience** — "Your week starts with your first log", "First meal sets the pace", room framed as permission ("Pizza night? Covered."). The April shame-fix held everywhere.
4. **The goal configurator** (Relaxed 70/Balanced 80/Strict 90 with explicit math) is the clearest piece of product thinking in the app.
5. **Calendar history** with the 4-color legend + room dots reads a month at a glance; backdated data rendered flawlessly across June/July.
6. **Recipe detail** is the best screen in the app: MES badge with tier, grouped check-off ingredients, one-tap log with instant tracker feedback.
7. **Backend correctness where it counts**: date validation, dedup guard, quota enforcement (3 free scans exact, barcode exempt), premium 402s on all 11 metabolic endpoints, XP math exact (50/log), zero unexpected 5xx across ~700 QA calls (the one 500 is P0-1).
8. **Metabolic morning coaching** ("Start with protein… aim for 30-40g in your first meal" + food chips) is exactly what Marcus pays for — when the data pipeline behind it works.

## Over-engineered (candidates to cut or consolidate)

- **Four progression systems** (XP/levels, achievements, daily quests, streaks) for a real-food app — achievements are a dead stub, XP is invisible utility ("+50" for everything), quests duplicate the tracker's job. The pivot's "one streak" thesis argues for exactly one visible system: weeks-at-goal.
- **Five tier vocabularies for the same concept**: spec'd Drained→Optimized appears nowhere; APIs emit critical/low/moderate/good/optimal; quests say "Stable"; health-pulse says "Rebuilding"; UI shows Efficient/Strong. Pick one ladder.
- **Legacy flex machinery still live** (`/fuel/flex-suggestions`, `/fuel/flex-log`, flex_points_* fields, FLEX onboarding badges) alongside the room-for-life rebrand — two mental models, one of them supposedly deleted.
- **Three-plus paths to the same actions** (scan: FAB, hero tile, quick-action card, deep link; log: FAB, meals tab, food-meals screen) while the paywall has zero paths from the free home.
- **Backend clinical-flag engine** (lactation kcal, IBD fiber floors, ED suppression, BP fields) with no intake UI — either build the front door (recommended, it's the moat) or stop maintaining it.

## Under-engineered (gaps that need real work)

- **Scoring integrity**: one code path for fuel scores regardless of source (curated recipes must run the same scorer as manual/scan; desserts must carry `meal_type: dessert` from the UI).
- **Freemium conversion surface**: quota-wall upsell with an upgrade CTA + remaining-scans indicator; metabolic-pillar teaser (locked cards with real previews) on free Home/Track; Sofia-style recap moments as upgrade triggers.
- **Session/store lifecycle**: clear all user stores on logout (P0-2) and on 401; free-tier 402s should render designed empty/upsell states, not stale data or scary "couldn't load" banners.
- **Form UX foundation**: inline validation + error states on every input surface; prefill edit screens from saved profile; testIDs on all inputs (the April lesson — still zero e2e coverage possible).
- **Data-pipeline resilience**: seed/restore must rebuild embeddings + MES backfills, or generation endpoints should 503 with a clear message instead of silently returning empty plans.
- **Safety-flag intake**: one "Health context" sheet (hypertension, meds-adjacent conditions, lactation) + verified target overrides + a visible "why your targets differ" explainer. This is Frank's entire retention story.
- **Serving-size sanity**: confirm dialog above ~3 servings or ~2,000 kcal per log; title length caps.

## Environment caveats

Expo Go (not the native build): RevenueCat purchase flow untestable (paywall fallback state captured instead), push delivery not exercised (recap deep link tested via banner), auth resets on every reload amplified the P0-2 leak's visibility (but the store-not-cleared bug is real regardless). Chat render failure should be re-verified against the prod LLM provider. Meal-plan/grocery UI screens went uncaptured (dev DB was wiped mid-campaign by a parallel session's pytest run — all month data had already been captured; the empty-plan bug was found *because* of the wipe). Ensemble/USDA scan stages off locally (placeholder keys).

## Top 10 recommended actions

1. Fix account deletion cascade + add the Settings entry point (P0-1) — App Store blocker.
2. Clear user stores on logout/401 (P0-2) — privacy.
3. Run curated recipes through the real fuel scorer; send `meal_type: "dessert"` from dessert logging (P0-4).
4. Build the health-context intake UI and integration-test the sodium ceiling round-trip (P0-3) — the moat.
5. Fix the Today's Fuel ÷3 denominators and `0/0` state (P1-1).
6. Fix Coach message contract (object vs string) + retry-in-place (P1-2).
7. Replace the quota-wall alert with an upsell sheet + add a scans-remaining pill (P1-4).
8. One streak, one number, one unit everywhere (P1-3).
9. Make plan generation fail loudly when embeddings are missing; rebuild aux data in restore scripts (P1-6).
10. Make the scan pairing opt-in (P1-7) and filter the meal reveal + protein prefs by dietary choice (P1-8).

*Full API-level evidence: [runs/api_analysis.md](runs/api_analysis.md). Raw month data: [runs/](runs/). Screenshots: [captures/](captures/).*
