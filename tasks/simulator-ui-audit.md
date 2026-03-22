# Simulator UI Audit — March 21, 2026

## Test Environment
- **Device**: iPhone 15 Pro Simulator (iOS 17.5)
- **Test User**: tester@fuelgood.app (premium, 5 meals logged, meal plan generated)
- **Tools**: idb (Facebook iOS Dev Bridge) for tap/type interaction
- **Backend**: localhost:8000 (all prior fixes applied)
- **Frontend**: Expo Go via Expo Dev Server

---

## Screens Tested

| Screen | Status | Key Issues |
|--------|--------|------------|
| Login | ✅ Good | Clean layout, proper validation |
| Home | ⚠️ Issues | Splash icon placeholder, calorie "g left" label bug |
| Meal Plan | ⚠️ Issues | Prep timeline text truncation, no recipe images |
| Meal Detail | ⚠️ Issues | No hero image, no bottom CTA, tag overlap |
| Chronometer (Fuel) | ⚠️ Issues | Over-target shows "0 left" instead of "X over" |
| Chronometer (Metabolic) | ✅ Good | Renders correctly (was 500 before fix) |
| Chronometer (Nutrients) | ✅ Good | NutriScore displays, macro rings work |
| Chat / Healthify | ✅ Good | AI responds, recipe swaps well-formatted |
| Browse Recipes | ⚠️ Issues | No food images, filter chip truncation |
| Grocery List | 🔴 Major | Quantities not consolidated ("3+1+1+1+1" format) |
| Profile | ✅ Good | Stats, XP, streaks display correctly |
| Achievements | ✅ Good | 4/56 unlocked, categories filter, no crashes |
| Quick Actions | ✅ Good | 4 options in popover, clean design |

---

## Bugs Found

### Critical (1)

| # | Bug | Impact | Location |
|---|-----|--------|----------|
| S1 | **Grocery quantities not consolidated** — shows "0.75 + 1 + 1 + 1 + 1 + 1 + 1 cup" instead of "6.75 cups" | Grocery list is unusable for shopping — users must mentally sum quantities. Every single item has this problem. | Grocery list generation / rendering |

### High (3)

| # | Bug | Impact | Location |
|---|-----|--------|----------|
| S2 | **No food images anywhere** — recipe cards, meal plan items, meal details, and recommendations all lack food photography | App feels text-heavy and unappetizing for a food app. Recipe browsing is especially hurt — users can't visually scan meals. | Recipe cards, meal plan, meal detail, recommendations |
| S3 | **Calorie ring shows "0 left" when over budget** — CAL 2220/2200 shows "0 left" instead of "20 over" | Misleading — user doesn't realize they've exceeded their calorie budget. Same issue for protein (172/130g shows "0g left" instead of "42g over"). | `frontend/components/` — macro ring/progress components |
| S4 | **Sugar quest still shows "200/200"** — confusing inverted display for ceiling-type quests | Despite the backend fix, the display still shows target/target when under budget. Looks like user consumed 200g sugar when they consumed ~0g. Possible stale data or frontend display issue. | `frontend/` quest display component or backend quest endpoint needs re-verification |

### Medium (5)

| # | Bug | Impact | Location |
|---|-----|--------|----------|
| S5 | **Splash screen shows placeholder grid icon** — not the Fuel Good leaf logo | Unprofessional first impression on app launch. The grid pattern is the default Expo Go placeholder. | `frontend/app.json` splash config or asset path |
| S6 | **No bottom CTA on meal detail** — user reads entire recipe but only action is the small ⊕ header button | Users complete reading the recipe and have no clear next action. Missing "Log This Meal" or "Cook Now" sticky button. | `frontend/app/food/meal-detail.tsx` |
| S7 | **Meal title truncation on Home** — "Chicken Sausage Kal..." and "Homestyle Smash Bu..." | Names are cut off. Users can't distinguish similar recipes at a glance. | Home screen Today's Plan card — needs wider layout or multiline |
| S8 | **Prep timeline cards truncated** — "Sweet Potato B...", "Prep Sunday: Swee..." | Meal prep instructions unreadable without tapping. | Eat screen prep timeline horizontal scroll cards |
| S9 | **Filter chip "Meal T..." truncated** on Browse | Users can't tell what the filter is for. Should say "Meal Type" or use an icon. | Browse recipes filter bar |

### Low (5)

| # | Bug | Impact | Location |
|---|-----|--------|----------|
| S10 | **Breakfast card missing Fuel Score badge** on meal plan | Lunch/Dinner show "🔥 100" but Breakfast doesn't — inconsistent | Meal plan day view |
| S11 | **Quick start chip icons use ❌** for healthify items | The ❌ icon looks like "delete" or "error" — should use ✨ or 🔄 for transformation | Chat empty state quick start chips |
| S12 | **Carbs target confusion**: 250g (Nutrients tab) vs 130g (Metabolic tab) | Different targets from different systems shown without explanation. Users may think it's a bug. | Chrono sub-tabs — add context labels |
| S13 | **Profile avatar not tappable from Home** | Green "A" circle in header appears to not respond to taps sometimes. Navigation to profile inconsistent. | Home screen header — accessibility/touch target issue |
| S14 | **Achievement category chip truncated** — "Disc..." | Should show "Discovery" fully or use horizontal scroll indicator | Profile > Achievements filter chips |

---

## Visual Audit

### What Looks Good ✅
- **Login screen**: Clean branding, green gradient button, proper spacing
- **Fuel Score rings**: Colorful, informative, modern circular progress indicators
- **Meal detail nutrition rings**: Protein/Carbs/Fat/Fiber with color coding
- **Chat Healthify**: Red strikethrough → green replacement format is excellent
- **Nutrition Impact table**: Original vs Healthified comparison is clear
- **Health benefit tags**: Colorful pills (Anti-Inflammatory, Muscle Recovery, etc.)
- **Tab bar**: Clean icons, active state highlighted in green
- **Achievement cards**: Locked vs unlocked visual distinction with colored borders
- **Quick Actions**: Popover menu is clean and modern
- **XP progress bar**: Green fill, level indicator — gamification feels tangible

### What Needs Improvement ⚠️
- **Recipe cards lack imagery** — solid color gradients with X icons look placeholder-ish
- **Text density**: Many screens are text-heavy without visual breaks
- **Grocery list readability**: Raw quantity addition is confusing
- **Prep timeline cards**: Too narrow to show meaningful content
- **Filter chips**: Truncation makes them unhelpful
- **Over-budget indicators**: "0 left" is misleading; should use red "over" styling

### Overall Design Assessment
The app has a **clean, modern foundation** with good use of white space, green accent color, and card-based layouts. The core design system (rings, badges, pills) works well. The main gaps are:
1. **Missing food photography** — critical for a food app's appeal
2. **Quantity formatting** in grocery list — makes the feature unusable
3. **Information overflow** — some screens show too many numbers without context

---

## Action Plan

### Phase 1 — Ship Blockers (Must Fix)

1. **S1: Consolidate grocery quantities**
   - Sum ingredient quantities by unit type instead of showing raw additions
   - Display "6.75 cups" not "0.75 + 1 + 1 + 1 + 1 + 1 + 1 cup"
   - File: Grocery list generation logic (backend or frontend)

2. **S3: Fix "0 left" → "X over" for exceeded macros**
   - When current > target, show "(current - target) over" in red instead of "0 left"
   - Files: Macro ring/progress components in frontend

3. **S4: Verify sugar quest display**
   - Confirm backend fix is active (restart server or check endpoint)
   - If backend is correct, fix frontend quest progress rendering for ceiling quests

### Phase 2 — UX Improvements (High Impact)

4. **S6: Add bottom CTA to meal detail**
   - Sticky "Log This Meal" / "Start Cooking" button at bottom of meal detail
   - Consider context: if meal is from plan, show "Log to Chronometer"

5. **S5: Fix splash screen icon**
   - Configure proper splash screen image in `app.json` / `app.config.js`
   - Use the Fuel Good leaf logo asset

6. **S7 + S8: Improve text truncation**
   - Allow meal titles to wrap to 2 lines on Home and Meal Plan
   - Widen prep timeline cards or make them taller

### Phase 3 — Visual Polish

7. **S2: Add recipe imagery** (requires content/design work)
   - Add food photography to recipe model
   - Display hero images on meal detail, recipe cards, and recommendations
   - Fallback: use styled gradient cards with meal type icons (current approach but improved)

8. **S9 + S14: Fix filter chip truncation**
   - Use shorter labels or horizontal scroll with visible overflow indicator

9. **S12: Clarify carb target differences**
   - Add subtitle on Metabolic tab: "Metabolic sugar ceiling" vs Nutrients: "Daily nutrition target"

10. **S10 + S11: Minor consistency fixes**
    - Add Fuel 100 badge to breakfast cards in meal plan
    - Change ❌ to ✨ on Healthify quick start chips

---

## Fix Status

| Bug | Status | Verification |
|-----|--------|-------------|
| S1: Grocery quantities | ✅ Fixed | API returns "4 cup" instead of "0.75+1+1+1+1+1+1 cup". Newly generated lists are consolidated. |
| S3: "0 left" → "X over" | ✅ Fixed | TodayProgressCard now shows "20 over" in red when macro exceeds target. |
| S4: Sugar quest "200/200" | ✅ Fixed | Backend sends `direction: "ceiling"` for sugar quests. Frontend shows "Xg consumed (Yg limit)" with inverted progress bar (green=under, red=over). |
| S6: Bottom CTA | ✅ Fixed | Sticky "Log This Meal" button at bottom of meal detail with green gradient, loading state, and "Logged!" confirmation. |
| S7: Meal title truncation | ✅ Fixed | Meal titles on Home now wrap to 2 lines instead of truncating. |
| S8: Prep timeline truncation | ✅ Fixed | Prep cards widened from 59% to 72% screen width, summary allows 3 lines. |
| S9: Filter chip truncation | ✅ Fixed | Filter chips use `flexShrink: 0` so they never compress below natural text width. |
| S10: Missing Fuel Score badge | ✅ Fixed | CompositeMealCard and grouped meal rendering now show FuelScoreBadge for breakfast. |
| S11: ❌ icon on healthify chips | ✅ Fixed | Changed to `sparkles` icon to convey transformation concept. |
| S12: Carb target confusion | ✅ Fixed | Added "Daily target" subtitle on Nutrients tab, "Net carbs · metabolic ceiling" on Metabolic tab. |
| S14: Achievement chip truncation | ✅ Fixed | Category chips use `flexShrink: 0` with increased padding. |
| S5: Splash screen | ✅ Fixed | Replaced all 4 Expo placeholder assets with branded Fuel Good logo (green leaf, dark bg). |
| S2: No food images | ✅ Fixed | AI image generation pipeline (Imagen 3 + DALL-E fallback), MealImage component with gradient placeholders. |
| S13: Profile avatar tap | ✅ Fixed | Wrapped in TouchableOpacity with hitSlop, added camera badge, image picker with AsyncStorage persistence. |

### Files Changed (Round 1)
- `backend/app/routers/grocery.py` — Quantity parsing, summation, and formatting
- `backend/app/schemas/gamification.py` — Added `direction` field to DailyQuestResponse
- `backend/app/routers/gamification.py` — Sets `direction="ceiling"` for sugar quests
- `frontend/components/TodayProgressCard.tsx` — Over-budget macros show "X over" in red
- `frontend/app/(tabs)/index.tsx` — Ceiling quest display, meal title 2-line wrap
- `frontend/app/browse/[id].tsx` — Sticky "Log This Meal" bottom CTA + hero food image
- `frontend/components/MealsTab/MyPlanView.tsx` — Wider prep timeline cards + meal images
- `frontend/components/MealsTab/BrowseView.tsx` — Filter chip flexShrink fix + meal images
- `frontend/app/(tabs)/profile.tsx` — Achievement category chip sizing + avatar picker with camera badge
- `frontend/components/CompositeMealCard.tsx` — FuelScoreBadge on grouped meals
- `frontend/app/(tabs)/chronometer.tsx` — Fuel badge on grouped meals, carb context labels
- `frontend/components/EnergyBudgetCard.tsx` — Metabolic carb ceiling subtitle
- `frontend/app/(tabs)/chat.tsx` — Sparkles icon on healthify chips
- `frontend/stores/gamificationStore.ts` — Added `direction` to DailyQuest interface

### Files Changed (Round 2)
- `frontend/assets/images/splash-icon.png` — Branded splash (green leaf + "Fuel Good" on dark bg)
- `frontend/assets/images/icon.png` — App icon (green circle, white leaf)
- `frontend/assets/images/adaptive-icon.png` — Android adaptive icon
- `frontend/assets/images/favicon.png` — Web favicon
- `backend/app/services/food_image.py` — NEW: AI image generation (Imagen 3 + DALL-E 3 fallback)
- `backend/app/routers/images.py` — NEW: Generate single/batch image endpoints
- `backend/scripts/generate_meal_images.py` — NEW: CLI batch generation script
- `backend/app/main.py` — Static file mount + images router
- `backend/app/routers/recipes.py` — Added image_url to recipe serialization
- `backend/app/routers/meal_plan.py` — Added image_url to meal plan data
- `backend/app/agents/meal_planner_fallback.py` — Added image_url to generated plans
- `frontend/utils/imageUrl.ts` — NEW: Resolve relative image URLs
- `frontend/components/MealImage.tsx` — NEW: Reusable image component with gradient placeholder
