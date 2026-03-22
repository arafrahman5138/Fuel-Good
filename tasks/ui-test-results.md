# UI End-to-End Test Results — March 21, 2026

## Test Method
- Created premium test user (tester@fuelgood.app) with full access
- Logged 4 meals (breakfast, lunch, dinner, snack) via API
- Generated meal plan via API
- Browser-based UI testing via Expo web preview
- Comprehensive API testing of all 30+ endpoints
- Code inspection of frontend stores, components, and backend services

---

## Bugs Found

### Critical (3)

| # | Bug | Impact | File(s) | Root Cause |
|---|-----|--------|---------|------------|
| C1 | **`/api/metabolic/remaining-budget` and `/api/metabolic/score/daily` return 500** | Metabolic tab is completely broken for all users. Health pulse metabolic dimension always shows 0. EnergyBudgetCard can't render remaining nutrients. | `backend/app/services/metabolic_engine.py:1040` | `getattr(budget, "tdee", 0)` returns `None` (attribute exists but is NULL in DB) instead of default `0`. `float(None)` raises TypeError. |
| C2 | **Meal plan generation produces 0 items** — empty plans for all users with "balanced" dietary preference | Users who select "balanced" diet (eat everything) get completely empty meal plans. The entire meal plan feature is non-functional for them. | `backend/app/agents/meal_planner_fallback.py:117-121` | `_matches_dietary()` requires ALL user dietary prefs to be present as recipe dietary_tags. "balanced" is a lifestyle preference, not a dietary restriction — but no recipe has a "balanced" tag. Every recipe gets filtered out. |
| C3 | **All manual meal logs score exactly 50.0** regardless of nutritional quality | Fuel Score system is meaningless for manual entries. Users logging healthy home-cooked meals see the same 50 score as junk food. This cascades: all manual meals count as "flex used," instantly exhausting the flex budget. | `backend/app/services/fuel_score.py:283-291` | `_score_manual()` only checks `ingredients_text` (always None for manual logs). When None, returns hardcoded 50.0 without examining the actual nutrition data. |

### High (2)

| # | Bug | Impact | File(s) | Root Cause |
|---|-----|--------|---------|------------|
| H1 | **Flex budget immediately exhausted on any manual logging** | New user logs 4 healthy meals → all 4 count as "flex used" → 0 flex remaining. The flex meal reward system is broken for manual loggers. | Cascading from C3 | All manual scores = 50 < 80 target → every meal is "flex." |
| H2 | **Silent failure when logging flex meals** | User taps "Log Flex Meal," API fails, no error message shown. User has no idea why it didn't work. | `frontend/app/food/flex.tsx:128-143` | `handleLogFlex()` has no `else` clause for `result === null`. The Zustand store sets `error` but the component doesn't read it. |

### Medium (4)

| # | Bug | Impact | File(s) | Root Cause |
|---|-----|--------|---------|------------|
| M1 | **"Stay Under 200g Sugar" quest shows "200/200"** | Looks like user consumed 200g sugar when they consumed ~0g. Confusing inverted progress display for ceiling-type quests. | `backend/app/routers/gamification.py:459-462` | For ceiling quests, when under budget, `current_value` is set to `target_value`, making progress bar show "full" even though actual consumption is near 0. |
| M2 | **Meal detail page has no "Log Meal" CTA** | User reads entire recipe (ingredients, steps, nutrition) but there's no action button at the bottom to log it or cook it. Only small header icons. | `frontend/app/food/meal-detail.tsx` | No bottom action bar / sticky CTA button implemented. |
| M3 | **`transform-origin` React DOM warning on every page** | Console floods with warnings. While not visible to users, indicates RN Web style compatibility issue that could affect animations. | Multiple components | CSS property `transform-origin` used instead of React-style `transformOrigin` in animated components. |
| M4 | **4 remaining `date.today()` instances** (non-fuel) | Meal plan and chat context could use wrong date after 7pm ET. | `meal_plan.py:221`, `chat.py:460`, `healthify.py:149,223` | Same class of bug as Bug 7 (fixed in fuel/gamification) but not yet fixed in these files. |

### Low (4)

| # | Bug | Impact | File(s) | Root Cause |
|---|-----|--------|---------|------------|
| L1 | **Streak number inconsistency** | Game stats: `current_streak=1`, Fuel streak: `current_streak=0`. Different concepts but shown in same UI context. | Game router vs fuel router | Two independent streak systems with different semantics. |
| L2 | **All micronutrients are 0.0** for manual meals | Nutrition detail view shows 0 for all vitamins/minerals. | Nutrition log creation | Manual nutrition_snapshot doesn't include micronutrient data. |
| L3 | **Dead `flexMealsEarned` prop** on EnergyHeroCard | Prop passed but never rendered. Dead code. | `index.tsx:857`, `EnergyHeroCard.tsx` | Component accepts prop but has no rendering logic for it. |
| L4 | **`No internet connection` banner always visible in web** | Web preview always shows red "No internet connection" bar. | Network detection logic | RN Web navigator.onLine or NetInfo module reports false positive. |

---

## Screens Tested

| Screen | Status | Notes |
|--------|--------|-------|
| Login | ✅ Pass | Clean UI, proper validation, successful auth |
| Home | ⚠️ Partial | Greeting, week strip, fuel score, flex card, today's plan all render. Flex count misleading (C3). |
| Eat (Kitchen Hub) | ✅ Pass | Meals, Meal Prep, Desserts, My Plan cards render correctly |
| Meal List | ✅ Pass | 20 recipes, filters, search, fuel scores, nutrition badges |
| Meal Detail | ⚠️ Partial | Full recipe renders (nutrition, ingredients, steps, pairing). Missing bottom CTA (M2). |
| Chronometer | ⚠️ Partial | Fuel tab works, Metabolic tab broken (C1), tab switching unreliable on web |
| Chat | ⚠️ N/A | Backend returns 503 (AI service timeout) — expected without OpenAI key |
| Scan | ✅ Pass | Camera fallback handled gracefully on web, image picker available |
| Profile | ✅ Pass | Correct user data, entitlement shows premium |

---

## Fix Status

### Phase 1 — Ship Blockers ✅ ALL FIXED

| Fix | Status | Verification |
|-----|--------|-------------|
| C1: `_normalize_budget` None crash | ✅ Fixed | `/api/metabolic/remaining-budget` returns 200 (was 500). Health pulse metabolic=80.5 (was 0.0) |
| C2: Meal plan "balanced" dietary filter | ✅ Fixed | Plan generates 21 items (was 0). Avg MES=83.7 |
| C3: Manual fuel score heuristic | ✅ Fixed | "Grilled Salmon with Quinoa" scores 80.0 (was 50.0). High protein+fiber+low sugar → higher scores |

### Phase 2 — UX Fixes ✅ ALL FIXED

| Fix | Status | Verification |
|-----|--------|-------------|
| H2: Flex meal logging error feedback | ✅ Fixed | `Alert.alert()` on failure in `flex.tsx` |
| M1: Sugar ceiling quest progress | ✅ Fixed | Returns actual sugar consumed, inverted completion logic with meal-logged guard |
| M2: Meal detail CTA | ❌ Not a bug | CTA exists in header popover (⊕ button → "Log to Chronometer" / "Add to Plate") |
| M4: Remaining `date.today()` instances | ✅ Fixed | `meal_plan.py`, `chat.py`, `healthify.py` all converted to UTC |

### Phase 3 — Polish

| Fix | Status | Notes |
|-----|--------|-------|
| M3: `transform-origin` warnings | ⬜ External | Comes from RN Web library internals, not our code |
| L1: Streak semantics | ⬜ Design needed | Game streak vs fuel streak are different concepts |
| L2: Micronutrient estimation | ⬜ Future | Requires nutrition API or user input |

### Files Changed
- `backend/app/services/metabolic_engine.py` — None-safe budget normalization
- `backend/app/agents/meal_planner_fallback.py` — Non-restrictive dietary preference skip-list
- `backend/app/services/fuel_score.py` — Nutrition-based manual scoring heuristic
- `backend/app/routers/gamification.py` — Sugar ceiling quest display + inverted completion
- `backend/app/routers/meal_plan.py` — UTC date fix
- `backend/app/routers/chat.py` — UTC date fix
- `backend/app/agents/healthify.py` — UTC date fix
- `frontend/app/food/flex.tsx` — Error feedback on flex logging failure
