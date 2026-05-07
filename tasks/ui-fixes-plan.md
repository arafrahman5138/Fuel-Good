# Fuel Good — UI Fixes Plan

> 🧪 **Simulator QA completed 2026-04-21** — full walkthrough report at [tasks/qa-report-2026-04-21.md](qa-report-2026-04-21.md). 22 items PASS runtime, 5 PASS code-only (runtime blocked by infra/state), 2 DEFER (backend state), 1 affordance regression (2.5 Sunday peek), 3 BLOCKED by hardware/infra. Two new minor bugs surfaced: Appearance segmented-control a11y roles missing, Track Metabolic toggle confirmed unresponsive (pass-2 7.3).


*Consolidates findings from [ui-audit.md](ui-audit.md), [ui-audit-pass2.md](ui-audit-pass2.md), and [ui-audit-pass3.md](ui-audit-pass3.md). Groups issues by **touch-point** (shared primitive vs single screen) and sequences into phases so shared-primitive fixes cascade through the app instead of being redone per-screen.*

**Scope**: 43 distinct issues across three passes. Paywall and accessibility are explicitly out-of-scope (separate follow-ups noted at the end).

**Guiding principle**: Each phase ends with a verifiable change you can see in the app. No phase spans more than 2 days of work so slip doesn't cascade. Within a phase, items are ordered by visibility — the thing a user notices first ships first.

---

## Phase 0 — Quick wins (≈ 4 hours)

High-visibility, low-effort fixes you can ship same-day to stop the bleeding. Do these before starting Phase 1 so users see immediate polish.

### 0.1 Round calorie displays to integers
**Files**: `frontend/components/MealScoreSheet.tsx`, `frontend/app/(tabs)/meals/recipe/[id].tsx`, anywhere `recipe.calories` renders with `.toFixed()` or raw float.
**Change**: `Math.round(cal)` everywhere. "662.5 Calories" → "663 Calories".
**Verify**: Open Beef Kebab Rice Plate detail page, no decimals shown.

### 0.2 Wire `returnKeyType` + `onSubmitEditing` on the four broken forms
**Files**:
- `frontend/app/(tabs)/(home)/food-search.tsx` — Food Database search input
- `frontend/app/(tabs)/chat/index.tsx` — Coach chat input bar
- `frontend/app/(auth)/login.tsx` — Email → Password → Submit
- `frontend/app/(auth)/forgot-password.tsx` — Email field

**Change**:
```tsx
<TextInput returnKeyType="search" onSubmitEditing={handleSubmit} />
```
For multi-field forms: `returnKeyType="next"` on all but last, chain `onSubmitEditing={() => passwordRef.current?.focus()}`.

**Verify**: Type in Food Database → press Enter → results load. Same on Coach input.

### 0.3 Unify the three "Create plan" CTAs
**Problem**: Home says "Create Plan", Home + button menu says "Create New Plan", Meals tab says "Create Meal Plan", Plan builder modal says "Build your week".
**Files**: `frontend/app/(tabs)/(home)/index.tsx`, `frontend/app/(tabs)/meals/index.tsx`, `frontend/app/meal-plan-builder.tsx`, `frontend/components/QuickActionsMenu.tsx`.
**Change**: Pick one verb + noun: **"Create Meal Plan"** everywhere. Modal header stays "Meal Plan".
**Verify**: Grep the frontend for the three old strings — all should be replaced.

### 0.4 Apply `MacroColors` app-wide
**Existing tokens**: `frontend/constants/Colors.ts` already defines per-macro greens (they're just not used outside Today's Fuel detail and Track Metabolic).
**Files**: `frontend/components/MacroRing.tsx` (or wherever the 4-macro row renders on Home / Weekly Fuel).
**Change**: Use `MacroColors.protein`, `MacroColors.carb`, `MacroColors.fiber`, `MacroColors.fat` per ring instead of the single `primary` green.
**Verify**: Home and Weekly Fuel macro readouts show distinct green/orange/pink rings matching Today's Fuel.

**Phase 0 deliverable**: 4 small PRs, all ship same-day.

---

## Phase 1 — Critical empty states & safe areas (≈ 1.5 days)

The most user-visible bugs: a new user sees these in their first 30 seconds. Every fix here is a "critical first-impression" upgrade.

### 1.1 Red empty-state Fuel ring → neutral

**Problem** (pass 1–3): The Fuel ring renders red `#EF4444` when `weeklyFuel === 0` across Home, Weekly Fuel detail, Track, Today's Fuel detail, and Flex Budget. Red reads as error/danger — new users see "you're failing" before doing anything wrong.

**Files**:
- `frontend/components/FuelScoreRing.tsx` — the ring component
- `frontend/constants/Colors.ts` — add `ScoreColors.neutral`

**Change**:
```ts
// Colors.ts (add)
ScoreColors: {
  neutral: '#3A3A45',       // empty state
  neutralMuted: '#2A2A35',  // track behind ring
  // existing: excellent, strong, decent, mixed, flex
}
```
In `FuelScoreRing`:
```tsx
const ringColor = weeklyScore === 0
  ? ScoreColors.neutral
  : getScoreTierColor(weeklyScore);
```
Change the empty-state caption from "Your day is a blank slate — make it count" (paired with red) to keep the copy but on neutral ring.

**Verify**: Fresh account right after onboarding → Home → ring is muted grey, not red. Log one meal → ring turns green ELITE FUEL.

### 1.2 Fix the transient red-ring flash after first log

**Problem** (pass 3): After tapping "Log & Finish" in Cook mode, the user lands on Home and briefly sees a red ring *before* the server response arrives and the ring turns green. That split-second looks broken.

**Files**: `frontend/stores/fuelStore.ts` (or wherever Fuel aggregate is fetched), `frontend/app/cook/[id].tsx` (post-log navigation).

**Change**: On log success, optimistically update `fuelStore.weeklyScore` locally (add logged meal's Fuel 100 to the running average) before server reconciliation. On reconciliation, reconcile silently.

**Verify**: Cook → Log & Finish → Home should show green ring immediately, no red flash.

### 1.3 Safe-area insets on scrollable onboarding + Track

**Problem** (pass 1): Dynamic Island / notch overlaps content on: onboarding body screen (scrolled), Track calendar, Plan builder step 1.

**Files**:
- `frontend/app/onboarding-v2/mirror.tsx` (body screen)
- `frontend/app/(tabs)/chronometer/index.tsx` (Track)
- `frontend/app/meal-plan-builder.tsx`

**Change**: Wrap scrollable content in `SafeAreaView edges={['top']}` from `react-native-safe-area-context`. Alternatively add a blurred header with `BlurView` at top.

**Verify**: Scroll down on the body screen until "Mostly sedentary" is near the notch — should stay clear, not overlap.

### 1.4 Replace generic "Loading recipes…" with skeleton + retry

**Problem** (pass 1–2): Browse, Meal Prep, Desserts all show a crossed-knives spinner + "Loading recipes…" forever when the backend returns no data. Food Database shows "No results yet" permanently even after submit.

**Files**:
- `frontend/app/(tabs)/meals/browse.tsx`
- `frontend/app/(tabs)/(home)/food-search.tsx`
- New shared component: `frontend/components/EmptyState.tsx` (see 1.6)

**Change**:
- Replace indefinite `ActivityIndicator` with skeleton recipe cards (3–6 grey placeholder blocks matching the real card geometry).
- Add a 10-second timeout — after timeout, swap to `<EmptyState variant="error" title="Couldn't load recipes" action="Retry" onAction={refetch} />`.
- For Food Database with a submitted query returning zero results: show "No matches for '{query}' — try a different search" with example chips.

**Verify**: Throttle network in simulator → Browse shows skeletons → after 10s shows retry card.

### 1.5 Fix Grocery list error-as-empty-state

**Problem** (pass 1): Grocery tab shows "Unable to load grocery list · Retry" when user has no plan — this is a first-run expectation, not an error.

**Files**: `frontend/app/(tabs)/meals/index.tsx` (Grocery section) or wherever `GET /api/grocery/current` is consumed.

**Change**:
```tsx
if (!activePlan) {
  return <EmptyState
    icon="shopping-cart"
    title="Your grocery list builds with your plan"
    subtitle="Create a meal plan and we'll auto-generate a week of groceries for you."
    action="Create Meal Plan"
    onAction={() => router.push('/meal-plan-builder')}
  />;
}
if (error) {
  return <EmptyState variant="error" ... />;
}
```

**Verify**: Fresh user with no plan → Grocery tab shows helpful empty state, not error.

### 1.6 Create shared `EmptyState` component

**Why**: At least 6 surfaces need it (Browse, Food Database, Grocery, Saved Recipes, Achievements, Track empty).

**File**: new `frontend/components/EmptyState.tsx`

**API**:
```tsx
interface Props {
  icon?: string;             // lucide icon name
  title: string;             // "No saved recipes yet"
  subtitle?: string;         // "Browse meals and tap bookmark to save"
  action?: string;           // CTA label
  onAction?: () => void;     // CTA handler
  variant?: 'default' | 'error';  // error shows retry styling
}
```

**Verify**: Each of 6 surfaces uses this component, styling is consistent.

**Phase 1 deliverable**: Empty states across the app feel intentional and helpful, not broken. First-run user sees no red ring, no indefinite spinners, no "Unable to load" errors.

---

## Phase 2 — Navigation & hierarchy (≈ 1.5 days)

Fixes that rebalance the app's information architecture. Users notice because they can find things.

### 2.1 Unify tab bar style across all tabs

**Problem** (pass 1): Home shows a floating glass pill tab bar with the + button isolated on the right. Meals/Track/Coach/Profile show a wider flat bar with a separate circular + button. Switching tabs creates subtle vertigo.

**Files**: `frontend/components/GlassTabBar.tsx`, `frontend/app/(tabs)/_layout.tsx`.

**Decision**: Pick the floating glass pill (more distinctive, more "Fuel Good") and use it everywhere. The + button stays to the right of the pill.

**Change**: Remove the conditional render that swaps tab bar style per route. Make `GlassTabBar` the single tab bar for all 5 tabs.

**Verify**: Switch between all 5 tabs — tab bar shape, size, and + button position stay identical.

### 2.2 Promote Metabolic Coach from buried sub-toggle to Home

**Problem** (pass 3): Metabolic Coach is one of the app's best features (4 color-coded insight rows, "Try these foods" chips, Ask Healthify CTAs per insight) but is hidden 3 taps deep: Profile → Track → Metabolic toggle → scroll below fold.

**Files**:
- `frontend/app/(tabs)/(home)/index.tsx` — add a new section
- `frontend/components/MetabolicCoachCard.tsx` — new (pull the 4-insight UI out of `metabolic-coach.tsx`)
- `frontend/app/(tabs)/(home)/metabolic-coach.tsx` — keeps the full page

**Change**: Add a `<MetabolicCoachCard />` below "Today's Plan" on Home, showing the top 2 most-relevant insights and a "See all insights →" link into the full page.

**Verify**: Home scroll — Metabolic Coach card is visible within the first viewport or two without going to Track.

### 2.3 Header pattern unification

**Problem** (pass 1–2): 4 different header patterns in the app:
1. Back arrow + pill title (Fuel Weekly, Flex, Settings, Meals subsections)
2. X + title (Plan Builder, Scan modal)
3. No back + title + gear (Profile overview)
4. Greeting + flame + avatar (Home)

**Files**: `frontend/components/AppScreenHeader.tsx` (exists, underused).

**Decision**: 2 canonical patterns:
- **Stack screens**: Back arrow + title pill (variant: `"stack"`)
- **Modals**: X + title (variant: `"modal"`)

Profile overview and Home stay as-is (tab root screens).

**Change**: Refactor every nested screen to use `<AppScreenHeader variant="stack" title="…" />` or `"modal"`. Remove ad-hoc header JSX.

**Verify**: Navigate into every nested screen (Fuel Weekly, Flex, Plan Builder, Recipe Detail, Cook) — back arrow / X placement is consistent.

### 2.4 Elevate Quests & Streaks

**Problem** (pass 2): Quests is buried at Profile → Quests & Streaks. It's a great retention feature (streaks, XP bar, daily quests with +50/+60 XP rewards) that users rarely see.

**Files**: `frontend/app/(tabs)/(home)/index.tsx`, `frontend/components/StreakChip.tsx` (new).

**Change**: Add a small `<StreakChip />` next to the flame badge in Home's top-right, showing "Day 3 · 33% today" as a pill that expands to show active quests on tap (or links to the full Quests page).

**Verify**: Home → top-right shows flame + chip → tap chip → Quests page or bottom sheet.

### 2.5 Meal Plan day selector horizontal scroll affordance

**Problem** (pass 3): Day selector shows Mon–Sat; Sunday is off-screen with no visual hint.

**Files**: `frontend/app/(tabs)/meals/index.tsx` (or wherever the 7-day pill row renders).

**Change**: Add a right-edge gradient fade + show 1.5 days of Sunday peeking from the right edge. Makes horizontal-scroll discoverable.

**Verify**: On the plan screen, Sunday's first letter "S" is visible under a fade on the right edge.

**Phase 2 deliverable**: App's important features are surfaced, not buried. Tab bar consistent. Headers predictable.

---

## Phase 3 — Form & input fixes (≈ 1 day)

Fixes to input surfaces that users interact with frequently. Most bugs here are functional, not aesthetic.

### 3.1 Tri-state Proteins chip (or split into two steps)

**Problem** (pass 1–2): Liked Proteins screen shows "Proteins you like" and "Proteins to avoid" with **identical lists** of 9 chips. User can select Chicken in both, producing undefined behaviour.

**Files**:
- `frontend/app/(tabs)/profile/preferences.tsx` Liked Proteins section
- `frontend/app/onboarding-v2/mirror.tsx` protein pref step
- `frontend/components/TriStateChip.tsx` (new)

**Change**:
```tsx
// Three states: neutral (default grey) → liked (green) → avoided (red)
<TriStateChip label="Chicken" state={likedState.chicken} onChange={setChicken} />
```
Tap cycles neutral → like → avoid → neutral.

**Verify**: Tap Chicken chip three times — cycles through grey → green "liked" → red "avoided" → grey.

### 3.2 Settings edit sub-pages → native iOS modal pattern

**Problem** (pass 2): Every Settings sub-page (Dietary, Flavor, Allergies, Liked Proteins, Household Size) renders as a full-page view with "Cancel / Save" inline at the bottom. Fights iOS expectations (modal + top-right Done).

**Files**: `frontend/app/(tabs)/profile/preferences.tsx` + each sub-page.

**Change**: Present each as a modal with `presentation: 'formSheet'` in the Stack.Screen options. Native header with "Cancel" left and "Done" right. Remove inline Cancel/Save.

**Verify**: Tap Dietary Preferences from Settings — opens as a sheet, has native top bar, swipe down dismisses.

### 3.3 Sign-up form field focus chain

**Problem** (pass 1–2): During automation I noticed password field sometimes didn't receive focus. Manual test is inconclusive but `onSubmitEditing` chain is missing.

**Files**: `frontend/app/(auth)/login.tsx`.

**Change**:
```tsx
const emailRef = useRef<TextInput>(null);
const passwordRef = useRef<TextInput>(null);

<TextInput ref={nameRef} returnKeyType="next"
  onSubmitEditing={() => emailRef.current?.focus()} />
<TextInput ref={emailRef} returnKeyType="next"
  onSubmitEditing={() => passwordRef.current?.focus()} />
<TextInput ref={passwordRef} returnKeyType="done"
  onSubmitEditing={handleSubmit} secureTextEntry />
```
Also add a **password-visibility toggle** (eye icon).

**Verify**: Sign up form — tap first field → type → press Return → focus moves to next. Eye toggles password visibility.

### 3.4 Forgot password: split into 2 steps

**Problem** (pass 1): One screen with two CTAs ("Request Reset", "Save New Password") stacked — both look equally tappable even when second isn't actionable.

**Files**: `frontend/app/(auth)/forgot-password.tsx`.

**Change**: Disable "Save New Password" until email-request step completes. Or split into two screens with a 2-dot progress indicator.

**Verify**: Before tapping Request Reset, the Save button is visibly disabled.

**Phase 3 deliverable**: Every form in the app submits on Return, has proper focus chain, and preferences are stored without ambiguous state.

---

## Phase 4 — Component polish (≈ 2 days)

> ✅ **Phase 4 landed 2026-04-21** — all 10 items (4.1 aspect ratio, 4.2 fallback tiles, 4.3 "+ Log", 4.4 cook celebration, 4.5 Include/Avoid, 4.6 onboarding header, 4.7 filter fade, 4.8 avatar edit-photo, 4.9 selective Healthify CTA, 4.10 meal-prep chip z-order) shipped. Next: Phase 5.

Per-screen details that add up to a premium feel.

### 4.1 Recipe imagery crop standardisation

**Problem** (pass 3): Some recipe photos are landscape with plate centered, some are square zooms. Grid looks uneven.

**Files**: `frontend/components/MealImage.tsx` or `RecipeCard`.

**Change**: Force `aspectRatio: 4/3` on all recipe hero images. Use `resizeMode: 'cover'` so composition is consistent.

**Verify**: Browse grid — all cards have uniformly-sized hero images.

### 4.2 Fallback-gradient recipe tiles should look like illustrations, not missing photos

**Problem** (pass 3): Recipes without photos show an orange/amber gradient with a small X icon — looks like a missing-image error.

**Files**: `frontend/components/MealImage.tsx` fallback branch.

**Change**: Generate a subtle illustration fallback (faint food-related icon over a gradient tied to the meal category). Or generate placeholder photography server-side.

**Verify**: Scroll to Air Fryer Gochujang Chicken Skewers (no photo) — the tile looks *intended*, not broken.

### 4.3 Meal card action pills — label the + explicitly

**Problem** (pass 3): Each meal card has "+ / Prepped / Bulk Cook / Replace" pills. The lone + is ambiguous.

**Files**: `frontend/components/MealCard.tsx` or wherever plan-day meal rows render.

**Change**: "+ " → "+ Log" (or "✓ Log" if already logged). Add aria-label.

**Verify**: Tap + Log on a plan meal → marks it as logged, plan row shows check.

### 4.4 Cook completion celebration upgrade

**Problem** (pass 3): "You cooked it! +50 XP earned" completion screen exists but the reward is a small pill below the title. Should be the hero element.

**Files**: `frontend/app/cook/[id].tsx` completion state.

**Change**:
- XP pill → full-width callout with `+50` at 48pt, "XP earned" below at 14pt
- Add a subtle sparkle animation (`react-native-reanimated`) on mount
- Trigger `Haptics.notificationAsync(Success)` on screen mount
- Add a confetti or ring-pulse animation

**Verify**: Complete a cook → last step → Log & Finish → full-width XP payoff feels rewarding.

### 4.5 Include/Avoid buttons on plan step 2 — differentiate

**Problem** (pass 3): Equal visual weight. Avoid is rarer and more consequential.

**Files**: `frontend/app/meal-plan-builder.tsx` step 2.

**Change**: "Include" is the primary style (green filled). "Avoid" is secondary (grey ghost with a small X icon) — smaller hit target and muted so users don't accidentally tap it.

**Verify**: Visual weight difference is clear at arm's length.

### 4.6 Onboarding progress header unification

**Problem** (pass 1): "5-minute setup" pill and the progress bar below it are two separate components and feel detached.

**Files**: `frontend/components/onboarding-v2/ProgressBar.tsx`, `frontend/components/onboarding-v2/OnboardingHeader.tsx` (new).

**Change**: One component renders pill + bar together with consistent margin. Pill color fills as bar fills.

**Verify**: Every onboarding screen has one unified header at top, not two.

### 4.7 Filter chip overflow on Browse

**Problem** (pass 1): "Protein / Carb / Cook Time / Me…" — last chip truncates visibly.

**Files**: `frontend/app/(tabs)/meals/browse.tsx` filter ScrollView.

**Change**: Wrap filter chips in `ScrollView horizontal showsHorizontalScrollIndicator={false}` with a right-edge fade like in 2.5. Or use `<ScrollView horizontal>` + `paddingRight: 60` so truncation is clearly a scroll affordance.

**Verify**: Swipe the chip row — scrolls smoothly, all filter categories accessible.

### 4.8 Profile avatar camera overlay repositioning

**Problem** (pass 1): The small camera-edit badge overlaps the avatar's bottom-right, partly covering the T letter in "Tester".

**Files**: `frontend/app/(tabs)/profile/index.tsx`.

**Change**: Move camera edit out of the avatar: add a separate "Edit photo" text button below the name.

**Verify**: Avatar T is fully visible. Edit photo is a separate tap target.

### 4.9 Metabolic insights "Ask Healthify" pill — show selectively

**Problem** (pass 3): All 4 insight rows have the same Ask Healthify CTA — overuse weakens the affordance.

**Files**: `frontend/app/(tabs)/(home)/metabolic-coach.tsx`.

**Change**: Show Ask Healthify only on insights where AI help meaningfully adds value: the low-score / energy-crash one and the "protein to go" one. Drop it from "fiber remaining" and "flex meals available" — those are self-explanatory.

**Verify**: Scroll coach insights — 2 out of 4 rows have the pill.

### 4.10 "Tap to meal prep" chip z-order

**Problem** (pass 3): Chip partially covers the tag row below it on recipe detail.

**Files**: `frontend/app/(tabs)/meals/recipe/[id].tsx`.

**Change**: Add `marginBottom: 12` or reflow so the chip and tags don't collide.

**Verify**: Recipe detail — chip sits above tags with clear spacing.

**Phase 4 deliverable**: Every card, chip, and modal feels polished. Shared primitives are consistent.

---

## Phase 5 — Light-mode re-art (≈ 2 days)

> ✅ **Phase 5 landed 2026-04-21** — all 5 items (5.1 shadow tokens, 5.2 light gradient stops, 5.3 avatar outline stroke on light, 5.4 theme-aware drawer shadow, 5.5 backdrop opacity 0.55 → 0.7) shipped. Next: Phase 6.

Pass 1 and 2 both flagged that light mode is a mechanical token swap. Fix by re-art-directing shadows, gradients, and glows for light backgrounds.

### 5.1 Card elevation tokens for light mode

**Problem** (pass 1): Dark-mode cards have subtle glow + border; light-mode cards have only a thin border. Flat.

**Files**: `frontend/constants/Colors.ts`, `frontend/components/Card.tsx`.

**Change**: Add `shadowTokens`:
```ts
shadow: {
  card: {
    dark: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: {width: 0, height: 4} },
    light: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: {width: 0, height: 2} },
  }
}
```
Apply to `<Card />` and every card-styled container.

**Verify**: Light mode Home — cards visibly *float*, not just bordered.

### 5.2 Recurate gradient stops for light mode

**Problem** (pass 1): Healthify gradient (deep teal→cyan) is striking on dark, washes to pastel on light.

**Files**: `frontend/constants/Colors.ts` — `gradient.card`, `gradient.hero`, `gradient.primary`.

**Change**: Define separate gradient stops for light mode instead of sharing:
```ts
gradient: {
  primary: {
    dark: ['#22C55E', '#16A34A'],
    light: ['#16A34A', '#0E7D3A'],  // deeper stops for light bg
  },
  hero: {
    dark: ['#16A34A', '#0D9488', '#0891B2'],
    light: ['#15803D', '#0F766E', '#155E75'],
  }
}
```

**Verify**: Healthify a Craving card has the same visual punch on light and dark.

### 5.3 Light-mode avatar glow ring

**Problem** (pass 2): Green glow ring on Profile avatar is artefact-y on light mode.

**Files**: `frontend/app/(tabs)/profile/index.tsx`.

**Change**: Use a subtle green *outline* (2pt stroke, 50% opacity) instead of a blur-glow for light mode.

**Verify**: Profile avatar has a clean green ring in both modes.

### 5.4 Light-mode Chat History drawer shadow

**Problem** (pass 2): Drawer blends with left edge — no shadow/border to separate from background.

**Files**: `frontend/components/ChatHistoryDrawer.tsx`.

**Change**: Add right-edge shadow (blur 20pt, opacity 0.15, offset 4pt) on light mode.

**Verify**: Open drawer in light mode — clearly separated from the chat behind it.

### 5.5 Chat History drawer backdrop opacity

**Problem** (pass 2): Right-side overlay showing previous chat is too transparent — distracting.

**Files**: same drawer component.

**Change**: Backdrop opacity 0.5 → 0.7.

**Verify**: Open drawer — right edge is dimmed enough to focus on drawer.

**Phase 5 deliverable**: Light mode no longer feels like an afterthought. Card shadows, gradients, and drawers all look intentional.

---

## Phase 6 — Delight (≈ 1.5 days)

> ✅ **Phase 6 landed 2026-04-21** — all 5 items (6.1 ring entrance anim, 6.2 haptics coverage incl. chronometer add-menu Medium impact, 6.3 flex-earned pulse + Success haptic on FlexBudgetCard, 6.4 quest completion celebration, 6.5 LevelUpSheet full-screen) shipped. Phases 0–6 complete; only Phase 7 (paywall, a11y, device testing) remains, requires external setup.

The README specifically calls out "celebration design" as a pillar. This phase ships the dopamine.

### 6.1 Ring entrance animation (Fuel Score + MES)

**Files**: `frontend/components/FuelScoreRing.tsx`.

**Change**: Use `react-native-reanimated` to animate the ring value from `0` to `currentScore` over 800ms on mount with an easing curve (`Easing.out(Easing.cubic)`).

**Verify**: Open Home from cold start → ring sweeps from 0 to current value.

### 6.2 Haptics on key actions

**Files**: wherever primary CTAs exist.

**Change**: Add `expo-haptics` calls:
- `Haptics.selectionAsync()` on chip / tab selection
- `Haptics.impactAsync('Medium')` on primary button tap (Sign In, Log Meal, etc.)
- `Haptics.notificationAsync('Success')` on meal logged, cook complete, quest completed
- `Haptics.notificationAsync('Warning')` on deletion confirms

**Verify**: Tap Continue in onboarding → feel a light tap. Cook complete → feel a success pattern.

### 6.3 Flex ticket earned celebration

**Problem**: Earning a flex meal is a core reward loop moment — currently no visual treatment.

**Files**: `frontend/components/FlexBudgetCard.tsx`, wherever `flexEarned` transitions happen.

**Change**: When `flexEarned` goes from n → n+1, trigger a ring-pulse animation on the flex ticket card, a particle burst behind it, and Success haptic.

**Verify**: Manually set `flexEarned = 3` in the store, log a meal that would bump to 4 → see the animation.

### 6.4 Quest completion celebration

**Files**: `frontend/app/(tabs)/profile/quests.tsx`.

**Change**: When a quest's progress crosses 100%, the row pulses green, the "+60 XP" pill scales up briefly, Success haptic fires.

**Verify**: Log 3 meals → "Log All 3 Meals" quest completes → visible celebration.

### 6.5 Level-up full-screen moment

**Problem**: Crossing into Level 2 is a big moment — currently just a number tick.

**Files**: new `frontend/components/LevelUpSheet.tsx`.

**Change**: When `level` increments, present a full-screen sheet with:
- "Level 2" display-size with shimmer
- "Unlocked: …" line (if relevant)
- "Continue" CTA
- Confetti animation
- Haptics pattern

**Verify**: Log enough XP to hit Level 2 → see sheet on next screen load.

**Phase 6 deliverable**: App feels alive. Every success moment is celebrated without being cheesy.

---

## Phase 7 — Blocked items (require external setup)

> 🟡 **Phase 7 partially landed 2026-04-21** — codebase-fixable slice done: WCAG AA contrast fix (textTertiary darkened in both themes in `constants/Colors.ts`); paywall CTA / Restore / Terms / Privacy got `accessibilityRole` + `accessibilityLabel`, and the CTA arrow icon is now VoiceOver-hidden to avoid duplicate readout. **Still blocked**: 7.1 paywall runtime capture (needs RevenueCat sandbox reconfig), 7.2 Dynamic Type rollout to 303 hardcoded fontSize sites across 66 files (separate multi-day sprint), 7.3 hit-target testing (needs physical device).

Items that can't be completed without infrastructure changes.

### 7.1 Paywall audit (Critical)

**Blocker**: Every test account gets auto-granted Premium, so the paywall is never shown. This is a separate fix track:

**Options**:
1. Configure RevenueCat sandbox to NOT grant premium to new users in dev builds
2. Add a dev-only toggle in `authStore` to force `user.isPremium = false`
3. Test on production build on a real device (paying sandbox account)

**Next steps after unblocking**: capture paywall in both themes, audit per pass-1 rubric, add to audit docs.

### 7.2 Accessibility pass (VoiceOver + Dynamic Type + contrast)

**Problem** (pass 1): Chip labels with unicode icon prefixes (`\uf536, Savory`) may read poorly on VoiceOver. Several body text colors fail WCAG AA. Font sizes are hardcoded, breaking Dynamic Type at 200%.

**Separate project**: Allocate 2-3 days for an A11Y-focused pass. Add `accessibilityLabel` overrides to every icon-prefixed chip. Replace hardcoded `fontSize` with `useDynamicType()` hook. Darken `textTertiary` and `textSecondary` to pass 4.5:1 on body.

### 7.3 Production device testing for hit-target issues

**Flagged in pass 2**: Track Fuel/Metabolic toggle unreliable during automation — may be a tap-target size bug on real device. Requires 30 min manual testing on real hardware.

---

## Shared-primitive vs single-screen cascade

Many of these fixes cascade from shared components. Doing them in the right order saves rework:

```
Phase 0.4 (MacroColors) ─┐
Phase 1.6 (EmptyState)   │
Phase 2.1 (TabBar)       ├─→ Used by 10+ screens
Phase 2.3 (AppHeader)    │
Phase 4.6 (OnboardingHeader) ┘
```

Do shared primitives first — single-screen fixes in later phases then pull from the updated components automatically.

---

## Total effort & sequencing

| Phase | Days | User-visible delta |
|-------|------|---------------------|
| 0 — Quick wins | 0.5 | Calories integer, Enter-to-submit, macro colors app-wide |
| 1 — Empty states | 1.5 | No more red rings / loading spinners / broken-looking empty states |
| 2 — Navigation | 1.5 | Tab bar unified, Metabolic Coach surfaced, headers consistent |
| 3 — Forms | 1.0 | Preferences work correctly, passwords usable, field focus chained |
| 4 — Component polish | 2.0 | Images consistent, celebrations bigger, chips clearer |
| 5 — Light mode | 2.0 | Light mode feels as intentional as dark |
| 6 — Delight | 1.5 | Haptics + ring animations + flex/quest/level celebrations |
| **Total** | **10 days** | All 43 audit issues resolved |
| 7 — Blocked | — | Paywall + A11y + real-device testing (separate track) |

**Recommended sprint**: 2 weeks with one designer + one engineer. Phase 0–2 in week 1 (highest impact + shared primitives). Phase 3–6 in week 2. Phase 7 as ongoing.

---

## Verification workflow

After each phase:

1. **Run the Maestro regression suite**:
   ```bash
   maestro test tasks/ui-audit/flows/
   maestro test tasks/ui-audit-pass2/flows/
   maestro test tasks/ui-audit-pass3/flows/
   ```
   Each flow's `takeScreenshot` produces a new PNG. Diff against the audit baselines — regressions shouldn't introduce red pixels where there weren't any, or shift tab-bar layout.

2. **Walk the core user journey manually**:
   - Fresh account → onboarding → Home (ring should be neutral, not red)
   - Tap Create Meal Plan → step 1 → step 2 → Generate → populated plan
   - Tap a meal → recipe detail → Cook → complete all steps → celebration → Home (green ring)
   - Toggle Fuel ↔ Metabolic on Track → both surfaces render
   - Settings → edit Dietary Preferences → modal presents correctly
   - Light mode toggle → walk same journey

3. **Screenshot the 5 hero screens in both themes** and diff against the pass-1–3 baselines in `tasks/ui-audit/`, `tasks/ui-audit-pass2/`, `tasks/ui-audit-pass3/`.

---

## Success criteria

The audit is "closed" when:

- [ ] All 43 distinct issues from passes 1–3 have either landed as a PR or been explicitly deferred with a reason
- [ ] Every `ui-audit*/flows/*.yaml` passes end-to-end on a seeded dev build
- [ ] Fresh-user journey (install → onboarding → first log) shows no red empty-state ring
- [ ] Metabolic Coach is reachable within 1 tap from Home
- [ ] Light-mode screenshots of the 5 main tabs have visible card elevation
- [ ] Cook completion screen has been manually verified to haptic + visually celebrate
- [ ] Paywall has been separately captured and audited (pass 4)
