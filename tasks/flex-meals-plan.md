# Flex Meals — Reframe Plan (2026-05-06)

> **SUPERSEDED (2026-07-10):** replaced by [real-food-metabolic-plan.md](real-food-metabolic-plan.md), which retires the flex/ticket system entirely in favor of the 80% Real Food Tracker + Metabolic Score two-pillar product. Kept for historical context only.

**Goal:** Reframe the existing flex/cheat-meal feature around the *running weekly score* as the primary mental model, with discrete flex tickets as a *reward event* layered on top.

**Outcome target:** user retention, perceived value rooted in the **presence-of-good** philosophy, and tight cross-feature pull through curated meals + Coach. The product positions itself as the only nutrition app that *gives the user permission to indulge* — track consistently, earn permission, enjoy guilt-free, come back to track again.

---

## 1. Context — what exists today (~40% shipped)

The feature is more built out than it appears. Audit findings:

**Backend (mostly live):**
- `WeeklyFuelSummary` schema includes `flex_meals_used`, `flex_budget_total`, `flex_budget_remaining` (`backend/app/models/fuel.py`)
- `compute_flex_budget()` runs on every `/fuel/weekly` and `/fuel/health-pulse` fetch (`backend/app/services/fuel_score.py`, called from `backend/app/routers/fuel.py:193, 505`)
- Fuel Score is already 0–100 continuous with 5-tier classification (`whole_food` ≥85, `mostly_clean` ≥70, `mixed` ≥50, `processed` ≥30, `ultra_processed` <30)
- Manual flex logging works end-to-end: `POST /fuel/flex-log` (`backend/app/routers/fuel.py:635`) → `FoodLog` with `source_type="manual_flex"` → recomputed budget in response
- `clean_eating_pct` (default 80%) and `expected_meals_per_week` (default 21) live on user settings

**Frontend (visible but mis-framed):**
- 7 flex components already exist: `FlexBudgetCard`, `FlexInsightsCard`, `FlexSummaryCard`, `FlexMealsEarned`, `SmartFlexCard`, `FlexUnlockedToast`, `FlexTicketRow`
- Dedicated flex screen at `frontend/app/(tabs)/(home)/flex.tsx` with manual cheat-meal logging UI (tag-based: pizza / burger / takeout / dessert / drinks / other)
- Track tab (`frontend/app/(tabs)/chronometer/index.tsx`) renders the calendar with a 5-tier gradient color legend (Whole Food / Mostly Clean / Mixed / Processed / Flex) — but the gradient is only used as legend decoration, not as a continuous quantity
- Onboarding `plan-preview.tsx` shows a `FlexTicketRow` with projected flex count derived from goal + activity

**What's broken / mis-framed:**
1. **Scan → flex feedback loop is invisible.** Scanning a low-score meal silently spends a flex on the next `/fuel/weekly` fetch with no tie-back UI.
2. **Tickets are framed as a depleting budget you start with**, not a reward you earn — directly contradicts presence-of-good philosophy.
3. **Empty state shows a red "0 FUEL THIS WEEK" ring** with a red apple icon — shame-coded on day 0.
4. **The earn mechanic is buried** as a small footer caption ("Log 3 more → earn flex points") under Today's Plan.
5. **Coach has no inline presence on Home** — it's only a tab destination, not the assistant that closes the gap when user is below pace.
6. **`FlexUnlockedToast` exists but is never triggered** — the celebration moment for the unlock is built and dormant.
7. **Snacks/desserts don't count against flex** (`backend/app/routers/fuel.py:679`) — but the user mental model expects them to.
8. **Two duplicated `FlexExplainerModal` definitions** (in `FlexMealsEarned` and `FlexInsightsCard`).
9. **`SmartFlexCard` and `FlexMealsEarned` are subsumed by `FlexInsightsCard`** — likely dead code.
10. **Onboarding shows projected flex but never collects a flex-mode preference** (No Flex / 1 Flex Day / 3 Flex Meals from `EARNED_FLEX_README.md` is unbuilt).

---

## 2. Core philosophy commitment

> **Show what the user is building, not what they have left to spend.**

Every component on Home and Track must answer: *what direction is this user going?* Not: *how much budget do they have?* The data is identical; the emotional valence is opposite.

Concretely this means:
- The fuel_score is the source of truth (continuous gradient, not categorical bucket).
- Bucketing into "flex meals used" was a UX simplification that throws information away — a 75-score wrap and a 30-score donut both count as "1 flex" today, but they're nothing alike.
- Tickets are not retired — they're repurposed.

---

## 3. Mental model — Gradient = state, Ticket = event

| | Gradient (state) | Ticket (event) |
|---|---|---|
| **Cadence** | Continuous, updates every meal | Discrete, fires at thresholds |
| **Surface** | Always visible (Home hero, Track) | Moment-based (toast, hero card when fresh) |
| **Purpose** | Show direction + pace | Celebrate consistency reward |
| **Framing** | "On pace for an 87 week" | "You earned a flex tonight — enjoy it" |
| **Psychology** | Daily check-in motivation | Variable-ratio reinforcement |
| **Maps to existing code** | `fuel_score`, `projected_weekly_avg` | `FlexUnlockedToast`, ticket UI in `FlexInsightsCard` |

Tickets do **not** start the week pre-allocated. The user starts at 0 tickets and earns them through high-score meals. This is the inversion that flips the psychology from absence-of-bad to presence-of-good using the same UI element.

---

## 4. Retention loop — how cross-feature pull works

1. User opens app → sees weekly gradient + "2 high-score meals from your next flex unlock"
2. Taps prompt → **Coach** suggests three curated meals that fit the gap (this is the new contract — Coach must return curated suggestions, not just chat)
3. User logs a curated meal → score rises → ticket unlocks with `FlexUnlockedToast`
4. User goes out for the burger → scans it → ticket spent, no shame, score still strong because they front-loaded
5. Next week resets, gradient persists in monthly trend, user feels both indulged and on-track

Every step requires another feature of the app. **Curated meals is the cheapest path to earning flex. Coach is the bridge from "behind pace" to "use this curated meal."** Features stop being parallel modules and become a single mechanism.

---

## 5. Component-level reframe

| Current | Reframed | Why |
|---|---|---|
| Red "0 FUEL" ring on empty state | Neutral pace bar: *"First meal of the week sets your pace"* | No shame on day 0 |
| "FUEL THIS WEEK" single number | Week timeline: 7 columns, each colored by daily avg using the existing 5-tier gradient, today highlighted, future dotted | Makes pace visible and progressive |
| "4 flex meals available — guilt-free anytime" | Until earned: *"5 high-score meals to your next flex"* progress bar.<br>Once earned: gold ticket + *"You earned a flex tonight — enjoy it"* CTA | Tickets become event, not budget |
| "Log 3 more → earn flex points" (footer caption) | Hero card directly under pace timeline | The unlock loop is the product |
| Coach as separate tab | Inline pull-card on Home when below pace: *"3 high-score meals would close the gap — show me"* → curated meals carousel → log directly | Coach + curated meals stop being parallel modules |
| Calendar with empty grid + small legend | Calendar where each past day is *filled* with its score color, weekly chip on top *"This week: 87 avg, 1 flex earned"*, "Last 4 weeks" trend strip | Long-term presence without streak fragility |
| Scan result: just a number | Score appears in its gradient color → week timeline column animates up → if it crossed unlock threshold, gold ticket animates in | Every scan is a visible advancement |

## 6. Copy audit

| Today | Reframed |
|---|---|
| "Use them guilt-free anytime" | "Use them when you've earned them" |
| "Your day is a blank slate" | "First meal sets the pace" |
| "READY TO FUEL" | (delete — content-free) |
| "0 FUEL THIS WEEK" | "Week pace begins" / on data: "On track for an 87 week" |
| "4 flex meals available" | "0 of 5 meals to your first flex" / "1 flex meal earned this week" |
| "No meals logged" | "Log your first meal to start the week" |
| "flex meals used" (anywhere) | "high-score meals this week" |

## 7. New Home hierarchy (top → bottom)

1. **Pace hero** — week timeline (gradient columns) + running avg + projection
2. **Unlock card** — progress to next flex *or* earned-flex CTA (gold, animated when fresh)
3. **Coach pull** — only when below pace; surfaces 3 curated meals that close the gap
4. **Today's curated plan** — same as today, but each meal shows its contribution to unlock progress
5. **Today's nutrition rings** — unchanged, lives at bottom

---

## 8. Phased implementation plan

### Phase 0 — UX spec lock (~½ day, before any code)
- [ ] Six annotated mockups: Home empty, Home mid-week, Home post-unlock, scan result, Track week, Track month
- [ ] Lock copy audit table above as the canonical strings
- [ ] Confirm with user: keep tickets as event-only, retire as budget — alignment check before code

### Phase 1 — Pace hero + unlock card on Home (~2-3 days)
- [ ] Build `WeekPaceTimeline` component — 7 columns, gradient-filled by daily avg, today highlighted
- [ ] Replace `FlexBudgetCard` ring on `frontend/app/(tabs)/(home)/index.tsx` with pace timeline
- [ ] Build `UnlockProgressCard` — replaces "X flex meals available" row; shows progress bar OR earned ticket CTA depending on state
- [ ] Wire `FlexUnlockedToast` to fire when `flex_available` increases vs. previous fetch (currently un-triggered)
- [ ] Optimistic refetch of `/fuel/weekly` after every scan or meal-log so the timeline animates immediately

### Phase 2 — Coach pull-card + curated meal bridge (~2-3 days)
- [ ] Add inline `CoachPullCard` on Home, visible only when below-pace (running avg < target)
- [ ] Define new endpoint or extend `/fuel/health-pulse` to return 3 suggested curated meals that would close the gap (filter by `meal_type` slot, `fuel_score >= 85`, dietary preferences)
- [ ] Tap → curated carousel → log inline → score advances → CoachPullCard re-evaluates
- [ ] Healthify agent: when scanning a low-score meal, attach a "next time, try this" curated suggestion in the response

### Phase 3 — Track tab calendar + monthly trend (~2 days)
- [ ] Fill calendar day cells with daily-avg gradient color (data already in `weekly.daily_breakdown`)
- [ ] Add weekly chip above calendar: "This week: {avg} avg, {flex_earned} flex earned"
- [ ] Add "Last 4 weeks" trend strip — sparkline of weekly avgs
- [ ] Replace red empty-state ring with neutral pace bar matching Home

### Phase 4 — Scan-to-flex feedback loop (~1-2 days)
- [ ] After scan log, show inline post-log moment: score in gradient color → pace timeline animates → if `flex_available` increased, fire `FlexUnlockedToast`; if score < target, show "you used a flex" indicator
- [ ] Make snacks/desserts count toward weekly avg (extend `backend/app/routers/fuel.py:679` to include `snack` in `flex_counted` set, or treat dessert as its own category)
- [ ] No new schema needed — fuel_score classification already implicit

### Phase 5 — Cleanup & deprecation (~½ day)
- [ ] Delete `SmartFlexCard` and `FlexMealsEarned` (subsumed by `FlexInsightsCard` + new components)
- [ ] Extract single shared `FlexExplainerModal` (currently duplicated in two components)
- [ ] Audit imports before deleting; update any lingering references
- [ ] Update onboarding flex preview copy to match the earned framing (`frontend/app/onboarding-v2/plan-preview.tsx`)

### Phase 6 — Empty state + day-0 polish (~½ day)
- [ ] All "0 FUEL" red ring instances → neutral "pace begins" copy
- [ ] First-meal-logged moment: small celebratory animation + "Pace started: you're on track"
- [ ] Audit onboarding for any remaining absence-framing copy

### Phase 7 — Verification (~1 day)
- [ ] Run all 6 personas (`runs/captures/`) through the new flow; capture before/after screenshots
- [ ] Verify scan → unlock loop closes end-to-end on simulator
- [ ] Confirm no red empty states remain on day 0
- [ ] Update `tasks/lessons.md` with copy/UX framing patterns

---

## 9. Decisions locked in this plan

1. **Gradient is primary, tickets are event-only.** No ticket-as-budget representation anywhere.
2. **Tickets are earned, not pre-allocated.** Users start the week with 0 tickets.
3. **Snacks/desserts count toward the weekly running average** (no separate dessert budget).
4. **Coach + curated meals are the unlock mechanism**, not parallel features.
5. **Classification stays implicit** (fuel_score-based). No new `is_flex` field on `FoodLog`.
6. **EARNED_FLEX_README mode preference (No Flex / 1 Flex Day / 3 Flex Meals) is deferred** — single mode for v1, evaluate after retention data.
7. **No backend schema changes.** All work is UI reframing on top of existing data.

## 10. Open questions to resolve in Phase 0

- **Unlock threshold:** how many high-score meals trigger a flex ticket? `EARNED_FLEX_README` recommended 12 qualifying meals → 3 flex; closer to 5 qualifying → 1 flex feels more responsive for daily-engagement.
- **Pace projection math:** linear extrapolation from current avg, or weighted by remaining meals? Display as "on pace for {n}" or as a gauge?
- **Visualization:** filled column heights (taller = more meals that day) or uniform columns colored by avg? The latter is simpler and more readable.

## 11. Out of scope for this pass

- EARNED_FLEX_README weekly mode preference UI
- Flex Day (calendar-locked single-day flex)
- Social sharing / leaderboard around flex
- Streak bonuses tied to flex
- Meal-level MES for desserts
- Backend schema changes

---

## 12. Success criteria

- A new user logging their first three meals never sees a red ring or "0" framing.
- Scanning any meal triggers a visible pace-timeline animation within 1 second.
- The first earned flex ticket fires `FlexUnlockedToast` with celebratory copy.
- A user below pace is offered curated meals from Home without leaving Home.
- The phrase "flex meals used" appears nowhere in the app.
