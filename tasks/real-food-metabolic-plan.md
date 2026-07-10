# Real Food + Metabolic Efficiency — Product Reframe Plan (2026-07-10)

**Supersedes:** `tasks/flex-meals-plan.md` (2026-05-06) and the plan doc on `plan/weekly-clean-baseline` (2026-05-08). Both moved in the right direction; this plan commits fully to the two-pillar product.

**Goal:** Focus the entire app on two things:
1. **Eating real food** — the 80% Real Food Tracker. Users scan/log everything (curated meals, home cooking, the burger, the dessert) into one 21-meal week and always know where they stand against their 80% real-food goal and how much room they have left.
2. **Being metabolically efficient** — the Metabolic Score. Curated meals carry a metabolic score; users get daily and weekly scores showing how metabolically efficient they've been.

**Outcome target:** an app people open daily (the tracker answers "do I have room for this?" in the moment), retain weekly (the recap proves the philosophy), and pay for over time (the metabolic pillar is the premium moat).

**Positioning:** "Yuka for your whole diet" + a software-only metabolic read. Do NOT compete with Cal AI / MyFitnessPal on calorie counting — that space consolidated (MFP acquired Cal AI, March 2026). Yuka proved real-food scanning demand (85M users) but has no meal layer, no weekly goal, no personalization, no daily-open loop. That's our wedge.

---

## 1. Context — what exists today (verified 2026-07-10 on `main`)

**Backend (the tracker math already exists):**
- `compute_flex_budget()` in `backend/app/services/fuel_score.py` (~line 728) already computes `clean_meals_target = ceil(expected_meals × clean_pct/100)` (21 × 80% = 17), meals below target, and remaining room. This IS the 80% tracker — wrongly framed as a "flex budget."
- Per-user settings on `User` (`backend/app/models/user.py:47-49`): `fuel_target=80`, `expected_meals_per_week=21`, `clean_eating_pct=80`.
- `GET /fuel/weekly` (`backend/app/routers/fuel.py:167-255`) returns `avg_fuel_score`, `meal_count`, `target_met`, `flex_budget`, 7-day `daily_breakdown`.
- **Known gap:** snacks/desserts are excluded from flex counting (`exclude_snacks=True`, `fuel.py` ~line 679) — contradicts the "scan my dessert to see if I have room" scenario.
- MES engine (`backend/app/services/metabolic_engine.py`) is fully personalized (Mifflin-St Jeor TDEE, insulin-sensitivity modifier, profile-aware weights/thresholds, clinical safety flags). Per-meal AND daily scores persist in `metabolic_scores` (`scope="meal"|"daily"`), written by `on_food_log_created` after every log.
- **Known gap:** no weekly MES rollup — home screen fakes a weekly average client-side.
- All `/metabolic/*` endpoints already gated by `require_premium_user` (`backend/app/routers/metabolic.py`, 13 routes).
- Curated recipes store `fuel_score` (default 100) and have MES/pairing/glycemic fields (`backend/app/models/recipe.py`).
- Notifications worker exists (`backend/app/services/notifications.py`, poll loop, quiet hours, weekly send caps) — but **no weekly recap job**.

**Frontend:**
- Flex ticket system live: `FlexBudgetCard`, `FlexInsightsCard`, `FlexSummaryCard`, `FlexMealsEarned`, `SmartFlexCard`, `FlexUnlockedToast`, `FlexTicketRow`, dedicated screen `frontend/app/(tabs)/(home)/flex.tsx` (622 lines, pizza/burger/dessert tag chips → `logManualFlex`).
- `frontend/app/(tabs)/(home)/flex-onboarding.tsx` lets users pick Relaxed 70% / Balanced 80% / Strict 90% — keep this as the tracker's goal setting.
- MES is branded "Energy" (tiers: Energy Drain / Steady Burn / Elite Fuel etc. in `TIER_CONFIG`, `frontend/stores/metabolicBudgetStore.ts`).
- **Hard paywall on the whole app:** `frontend/app/_layout.tsx` (~line 233) redirects any non-premium/non-trial user to `/subscribe`. No free tier exists. `skipBillingGate = __DEV__`.
- Two onboarding flows: live `frontend/app/(auth)/onboarding.tsx` (14 steps → `/subscribe`); dormant `frontend/app/onboarding-v2/` (15 screens incl. its own paywall — nothing routes to it).
- Three overlapping streaks fetched on quests screen (gamification, fuel, metabolic).
- Dead components: `EmptyState.tsx`, `LevelUpSheet.tsx`, `TriStateProteinSelector.tsx`. Legacy `flex_points_*` fields alongside credit fields in `frontend/stores/fuelStore.ts:22-34`. Stale `metabolic_engine.py.bak` in backend.
- Pricing inconsistency: backend billing config says $9.99/mo, $49.99/yr, $149.99 lifetime; frontend fallback says $59.99/yr (`frontend/app/subscribe.tsx`).

---

## 2. Product decisions locked in this plan

1. **The 80% Real Food Tracker replaces the flex system entirely.** No tickets, no budget metaphor, no separate flex screen. One week, 21 meals, one question: "am I at 80% real food, and how much room do I have?"
2. **Meal counts are the headline; the weekly Fuel average is secondary.** "14 of 17 real-food meals · room for 2 more" is the primary display. The 0-100 weekly average remains for tiers and trends.
3. **A meal counts as "real food" when its fuel_score ≥ the user's `fuel_target` (default 80).** Below that, it's a "room-for-life" meal — neutral language, never "cheat"/"flex"/"failed."
4. **Snacks and desserts count toward the week.** Scanning a dessert must answer "do I have room for this?" — that's the core use case.
5. **Under-logging must not read as either perfection or failure.** The tracker reports against *logged* meals mid-week ("11 of 13 logged meals were real food") and only against the full 21-meal expectation in the weekly recap. Never red before the user acts (day-0 rule, already established).
6. **MES is renamed "Metabolic Score" everywhere.** "Energy" undersells the moat; "metabolic" is the term the 2026 market (Levels/Lumen/Zoe/CGM wave, post-GLP-1 maintenance cohort) searches for.
7. **Freemium replaces the hard paywall.** Free = real-food pillar (scanner with daily cap + 80% tracker + weekly Fuel Score). Premium = metabolic pillar (Metabolic Score daily/weekly, Coach, meal plans, Healthify, unlimited scans). This matches the existing server-side gating boundary — `/metabolic/*` is already premium.
8. **Curated meals are the easiest path to staying at 80%,** and they carry both badges: "Fuel 100 · Metabolic 87." Taste-first presentation stays (per the weekly-clean-baseline plan).
9. **One streak: consecutive weeks at goal.** Daily streaks are fragile and off-philosophy.
10. **No new scoring engines.** All work is reframing + aggregation on top of `compute_fuel_score`, `compute_flex_budget` (renamed), and `metabolic_engine`.

---

## 3. The two surfaces that define the product

### Home hero — "How is my week going?"
```
This week: 14 real-food meals of 17 goal        [ring/bar viz]
Weekly Fuel 86 — Strong
Room for 2 more off-baseline meals. Dinner out fits.
```
Premium adds: `Metabolic Score this week: 78 — trending up`

### Scan result — "Do I have room for this?"
The burger-spot moment. After any scan (meal, barcode, label):
```
Smash Burger — Fuel 38
Your week: still on track. This uses 3 of your 4 room-for-life meals.
Metabolic 45 — heavy carb load, expect an energy dip. [premium]
[Log it] [Don't log]
```
No shame either way. If the week can't absorb it: "This would take you past your room for this week — your call. Next clean meal starts rebuilding."

---

## 4. Phased implementation plan

### Phase 0 — Spec lock ✅ RESOLVED 2026-07-10
- [x] **Naming:** feature = **Real Food Tracker**; sub-target meals = **room-for-life meals**; MES = **Metabolic Score** everywhere user-facing.
- [x] **Snack/dessert weighting:** a snack/dessert scoring **< target consumes a room slot** (same as a low main meal — the dessert-scan use case). A snack/dessert scoring **≥ target counts toward neither** the real-food meal count nor room — it only lifts the weekly average (healthy snacks are free wins, and they shouldn't inflate the meal count against the 21-meal denominator).
- [x] **Tracker math:** `room_total = expected_meals − clean_meals_target` (4 at 80%/21). `room_used` = count of ALL logs (mains + snacks/desserts) below target. Budget-shrinkage rule from `compute_flex_budget` retained. Room at 0 → neutral copy ("your call — next clean meal rebuilds"), never blocking.
- [x] **Partial-week rule:** mid-week surfaces report on a logged basis ("11 of 13 logged meals were real food · room used 2 of 4"); only the weekly recap judges against the full 21. Day-0 is neutral, never red.
- [x] **Free scan cap:** **3 AI scans/day** free (meal photo + label image + smart). **Barcode lookups uncapped** — they're DB lookups, near-zero marginal cost, and the grocery-store loop is the acquisition hook. Premium = unlimited.
- [x] **Metabolic Score tiers:** Drained / Sluggish / Steady / Efficient / Optimized (maps 1:1 onto existing 5-tier thresholds).
- [x] **Recap push fallback:** recap card shown on first app-open of a new week regardless of push permission.
- [x] **`expected_meals_per_week`:** stays 21, not user-editable in v1.
- [x] Copy table locked (see §5).
- [x] Mockups: skipped as separate artifacts — §3 surface specs are the canonical visual spec; build directly against them.

### Phase 1 — 80% Real Food Tracker (~3-4 days)
**Backend:**
- [ ] Extend `compute_flex_budget()` output with tracker-framed fields: `real_food_meals`, `logged_meals`, `real_food_goal`, `room_total`, `room_used`, `room_remaining`. Keep old field names in the response during migration; remove in Phase 5.
- [ ] Include snacks/desserts in week counting (`backend/app/routers/fuel.py` ~line 679): count them toward logged meals and room usage. Decide weighting in Phase 0 (proposal: a dessert/snack counts as a meal slot only when fuel_score < target; high-scoring snacks count toward neither — they're free wins shown in the average).
- [ ] `expected_meals_per_week` stays the denominator for the weekly recap; mid-week endpoints also return logged-meals-basis numbers per decision #5.
- [ ] Tests: golden cases for "17/21 week with 4 low meals," dessert counting, under-logged week, day-0.
**Frontend:**
- [ ] New `RealFoodTrackerCard` as the Home hero (replaces `FlexSummaryCard`/`FlexBudgetCard` placement) — meal-count headline, weekly avg + tier secondary, room-remaining line.
- [ ] Scan result screen (`frontend/app/scan/index.tsx`): add the week-impact block (before/after room + weekly avg) rendered from a refetched `/fuel/weekly` after scoring, before the user decides to log. Both meal scans and barcode/label scans.
- [ ] Keep `flex-onboarding.tsx` goal-picker (70/80/90%) but rebrand copy to "your real-food goal."
- [ ] One-tap "log an off-plan meal" (absorbs `logManualFlex` at score 35) inside the normal add-menu on Track — the dedicated flex screen goes away in Phase 5.
- [ ] Optimistic refetch of `/fuel/weekly` after every log so the tracker animates immediately.

### Phase 2 — Metabolic pillar (~2-3 days)
- [ ] Backend: `GET /metabolic/score/weekly` — aggregates `metabolic_scores` rows with `scope="daily"` over the week (avg + per-day list + trend vs. prior week). Premium-gated like its siblings.
- [ ] Rename user-facing "Energy" → "Metabolic Score": `TIER_CONFIG` in `frontend/stores/metabolicBudgetStore.ts`, `EnergyHeroCard`, `EnergyBudgetCard`, `mes-breakdown.tsx` copy. Tier names become metabolic-themed (e.g., Sluggish / Steady / Efficient / Optimized — finalize in Phase 0).
- [ ] Home hero (premium): weekly Metabolic Score line sourced from the new endpoint (delete the client-side fake weekly average).
- [ ] Curated meal cards (`BrowseView`, `MyPlanView`, recipe detail): show "Fuel 100 · Metabolic {mes}" badge pair.
- [ ] Scan result (premium): Metabolic Score line with one plain-language consequence ("expect an energy dip").

### Phase 3 — Freemium restructure (~2-3 days)
- [ ] Remove the whole-app gate in `frontend/app/_layout.tsx` (~line 233). Free users land on Home with tracker + scanner + Track basics.
- [ ] Gate premium surfaces at the feature level: Metabolic Score displays, Coach tab, meal-plan generation, Healthify — each shows a contextual upsell card in place ("See how this week affected your metabolism → Premium") instead of a redirect.
- [ ] Backend: scan rate-limit for free users (N/day per Phase 0 decision) on `/scan/*` routes; return a friendly limit payload the paywall can render. Scans are the real marginal cost (Gemini race + Claude ensemble) — cap, don't gate.
- [ ] Keep `/metabolic/*` server-side gating as is (already correct).
- [ ] Onboarding (`frontend/app/(auth)/onboarding.tsx`): end at Home with the tracker primed + a soft trial offer, not a hard `/subscribe` wall (line ~673). Trial still promoted; just not mandatory to enter the app.
- [ ] Fix pricing inconsistency: align `frontend/app/subscribe.tsx` fallback ($59.99/yr) with backend billing config ($49.99/yr) — backend is authoritative.
- [ ] Verify RevenueCat flows still pass App Store 3.1.1 requirements (both paywall surfaces carry Terms/Privacy/auto-renew copy — see lessons.md 2026-04-16).

### Phase 4 — Weekly recap moment (~2 days)
- [ ] Backend: `weekly_recap` notification category in `backend/app/services/notifications.py` — fires Sunday evening local time (respect quiet hours), exempt from or prioritized within the ≤3/week cap. Payload: real-food meal count, weekly Fuel avg + tier, room-for-life meals enjoyed, weekly Metabolic Score (premium).
- [ ] Backend: `GET /fuel/recap` (or extend `/fuel/weekly` with `week_offset=-1`) so the client can render last week's story.
- [ ] Frontend: recap screen — "17 real-food meals. Fuel 87 — Strong. Pizza night and brunch fit. You proved it works." Deep-link target of the push.
- [ ] Celebration for weeks at goal; warm non-shame framing for weeks below ("Mixed week — your next clean meal starts the rebuild").
- [ ] Streak consolidation: "weeks at goal" becomes the single streak surfaced on Home/recap/quests (backend `WeeklyFuelSummary.streak_weeks` exists; wire it).

### Phase 5 — Cleanup & deprecation (~1-2 days)
- [ ] Delete flex components after import audit: `FlexBudgetCard`, `FlexMealsEarned`, `SmartFlexCard`, `FlexUnlockedToast`, `FlexTicketRow`, `FlexInsightsCard`, `FlexSummaryCard`, `frontend/app/(tabs)/(home)/flex.tsx`.
- [ ] Remove legacy `flex_points_*` fields from `frontend/stores/fuelStore.ts` and backend response once no consumer remains.
- [ ] Sweep all user-facing "flex" strings → tracker language (grep frontend + backend copy, incl. `/fuel/flex-suggestions` output).
- [ ] **onboarding-v2 decision:** either route the live funnel into it or delete the 15 screens + hooks + its paywall. Two funnels means neither improves. (Recommend: harvest `plan-preview`/`live-scan` ideas into the live flow, then delete.)
- [ ] Delete dead components: `EmptyState.tsx`, `LevelUpSheet.tsx` (or actually mount it for level-ups), `TriStateProteinSelector.tsx`.
- [ ] Delete `backend/app/services/metabolic_engine.py.bak`.
- [ ] Remove dead `if (false)` free-tier branch in `onboarding-v2/paywall.tsx` (moot if v2 deleted).

### Phase 6 — Verification (~1-2 days)
- [ ] Persona runs (planner / curated eater / scanner-tracker, per `runs/` methodology): each can answer "am I at 80%?" and "do I have room for dessert?" at any point in the week.
- [ ] Burger-spot E2E on simulator: scan burger → week impact shown → log → scan dessert → room math correct → recap next Sunday reflects it.
- [ ] Free-tier E2E: fresh account, no payment → Home works, scanner capped correctly, metabolic surfaces upsell, trial purchasable.
- [ ] No "flex," "cheat," red day-0 states, or "Needs Work" strings anywhere (grep both layers — lesson 2026-04-23).
- [ ] Weekly recap fires on schedule for a seeded test account; deep link lands on recap screen.
- [ ] Fresh-account provisioning per audit lessons (`runs/provision_*.py` pattern); verify recipe catalog seeded before persona runs.

---

## 5. Copy table (canonical)

| Avoid | Use |
|---|---|
| "Flex meals available/used/earned" | "Room for 2 more this week" / "3 room-for-life meals enjoyed" |
| "Cheat meal" / "guilt-free treat" | "Room-for-life meal" |
| "0 FUEL THIS WEEK" / red empty ring | "Your week starts with your first log" |
| "You used a flex" after a low scan | "Still on track — 14 of your logged meals were real food" |
| "Energy Score" / "Steady Burn" | "Metabolic Score" + metabolic tier names |
| "Needs Work" | "Ready to start" / "Rebuilding" |
| Calorie-first framing anywhere | Real-food-first, metabolic-second framing |

---

## 6. Open questions

All Phase-0 questions resolved 2026-07-10 — see Phase 0 section for the locked answers.

## 7. Out of scope for this pass

- Android billing (iOS-only launch stands).
- CGM integrations, social sharing/leaderboards, B2B data plays.
- New scoring engines or schema redesign beyond the weekly MES aggregate.
- Restaurant menu integration.

## 8. Success criteria

- A user standing in a burger spot can scan and know within 5 seconds whether the burger and a dessert fit their week.
- A free user gets real value (scanner + tracker) and hits a natural, non-punitive premium boundary at the metabolic layer.
- The word "flex" appears nowhere user-facing; nobody sees red before logging anything.
- Weekly recap delivers the proof moment every Sunday; "weeks at goal" streak is the single streak.
- Curated meals visibly carry both scores and are the obvious easiest path to staying at 80%.
