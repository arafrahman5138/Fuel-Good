# Fuel Good — Onboarding Implementation Spec

> This is the source-of-truth spec for building the onboarding flow.
> Every screen, component, animation, and copy decision is defined here.

---

## Architecture Overview

The onboarding is a **14-screen flow** organized into 3 acts.
It lives in the React Native frontend as a self-contained navigation stack.

```
frontend/
  src/
    screens/
      onboarding/
        OnboardingNavigator.tsx    # Stack navigator for the full flow
        hooks/
          useOnboardingState.ts    # Shared state across all screens
          useOnboardingAnalytics.ts # Screen-level event tracking
        screens/
          VideoHookScreen.tsx       # Screen 1
          ProblemStatementScreen.tsx # Screen 2
          EnergyCheckScreen.tsx     # Screen 3
          DietHistoryScreen.tsx     # Screen 4
          MirrorScreen.tsx          # Screen 5
          MealRevealScreen.tsx      # Screen 6
          GoalContextScreen.tsx     # Screen 7
          PlanPreviewScreen.tsx     # Screen 8
          LiveScanScreen.tsx        # Screen 9
          SocialProofScreen.tsx     # Screen 10
          CommitmentScreen.tsx      # Screen 11
          PaywallScreen.tsx         # Screen 12 (also handles 13 & 14 via discount state)
        components/
          OnboardingProgress.tsx    # Progress dots
          OptionCard.tsx            # Tappable answer cards
          MirrorCard.tsx            # Personalized reflection display
          FuelScoreRing.tsx         # Animated score circle
          FlexTicketRow.tsx         # Animated ticket earn display
          WeeklyBarChart.tsx        # Animated weekly score bars
          MealCard.tsx              # Meal reveal card with score badge
```

---

## Shared State: `useOnboardingState`

All screens read from and write to a shared onboarding context.
This state drives personalization (mirror screens) and is sent to the backend on completion.

```typescript
interface OnboardingState {
  // Screen 3
  energyFeeling: 'energized' | 'fine' | 'tired' | 'depends';

  // Screen 4
  dietHistory: 'fall_off' | 'bored' | 'restricted' | 'lost';

  // Screen 7
  primaryGoal: 'energy' | 'weight' | 'cleaner' | 'muscle';
  ageRange: string;
  height: number;
  weight: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

  // Screen 11
  committed: boolean;

  // Screen 12-14
  paywallDismissCount: 0 | 1 | 2;

  // Analytics
  scanCompleted: boolean;
  reviewPromptShown: boolean;
  reviewLeft: boolean;
  startedAt: Date;
  completedAt: Date | null;
}
```

---

## Screen-by-Screen Spec

---

### Screen 1: Video Hook — "The Scan Reveal"

**Act:** 1 (The Hook)
**Timing:** 0–15 seconds
**Purpose:** Create an emotional reaction before cognitive evaluation

#### What to build

An auto-playing, looping video that shows the Fuel Good scanner in action.
This is NOT a screen with text and a button. The video IS the screen.

#### Video content (produce separately or use the HTML prototype as reference)

1. A hand scanning a "healthy" granola bar barcode
2. The Fuel Score animating down to 25 in red
3. Ingredient flags appearing: Seed Oils, Added Sugar, Refined Flour
4. A swap suggestion sliding in (whole-food alternative, score 95)
5. Flex meal tickets filling up as clean meals are logged

#### Copy

- Top text (subtle, over video): `"You think this is healthy?"`
- After reveal: `"Scan anything. Know the truth."`

#### Components

- Full-screen video player (react-native-video or Expo AV)
- No skip button for first 10 seconds, then show a subtle "Continue →" at bottom
- Progress dots visible at bottom

#### Implementation notes

- Video file should be bundled locally (not streamed) for instant playback
- Preload on app install if possible
- Dark background, no status bar visible during playback
- The HTML prototype at `onboarding-video.html` in the project root is the animation reference

---

### Screen 2: Problem Statement

**Act:** 1 (The Hook)
**Timing:** 15–25 seconds
**Purpose:** Frame the problem in the user's language

#### Copy

- Headline: `"Healthy eating shouldn't feel like punishment."`
- Subtext: `"No calorie counting. No restriction. Just eat real food — and earn your cheat meals."`
- CTA button: `"Show me how"` (green, full-width)

#### Design

- Dark background, centered text
- Headline in white, 28px bold
- Subtext in gray, 16px
- Button uses the app's primary green (#22C55E)

#### Implementation notes

- Simple animated fade-in on headline, then subtext, then button (staggered 300ms)
- Tapping "Show me how" navigates to Screen 3

---

### Screen 3: Energy Check

**Act:** 2 (The Experience) — Phase 1: Self-Reflection
**Timing:** ~30 seconds
**Purpose:** Make the user admit the problem to themselves

#### Copy

- Question: `"How do you usually feel after meals?"`

#### Options (single select, use `OptionCard` component)

| Option | State value | Expected majority pick |
|--------|-------------|----------------------|
| Energized and focused | `energized` | ~10% |
| Fine, nothing special | `fine` | ~20% |
| Tired or foggy | `tired` | ~35% |
| Depends on the day | `depends` | ~35% |

#### Design

- Large tappable cards, one per option
- Selected card gets green border + checkmark
- Auto-advance 500ms after selection

#### Analytics events

- `onboarding_energy_check_viewed`
- `onboarding_energy_check_answered` with `{ value: string }`

---

### Screen 4: Diet History

**Act:** 2 (The Experience) — Phase 1: Self-Reflection
**Timing:** ~45 seconds
**Purpose:** User articulates their own frustration

#### Copy

- Question: `"What happens when you try to eat healthier?"`

#### Options (single select)

| Option | State value |
|--------|-------------|
| I do great for a while, then fall off | `fall_off` |
| I get bored of the food | `bored` |
| I feel restricted and give up | `restricted` |
| I don't know where to start | `lost` |

#### Design

- Same card layout as Screen 3
- Auto-advance on selection

#### Analytics events

- `onboarding_diet_history_viewed`
- `onboarding_diet_history_answered` with `{ value: string }`

---

### Screen 5: The Mirror

**Act:** 2 (The Experience) — Phase 1: Self-Reflection
**Timing:** ~1 minute
**Purpose:** Make the user feel seen. Create personalization.

#### Logic

Build the copy dynamically from `onboardingState.energyFeeling` and `onboardingState.dietHistory`:

```typescript
const mirrorCopy = getMirrorCopy(state.energyFeeling, state.dietHistory);

// Example output:
// "You said you feel foggy after meals and that diets feel restrictive.
//  That's not a willpower problem — it's a system problem.
//  Most nutrition apps add more restriction. Fuel Good does the opposite."
```

#### Copy matrix (build all combinations)

| Energy | Diet | Mirror text |
|--------|------|-------------|
| tired | restricted | "You said you feel foggy after meals and that diets feel restrictive. That's not a willpower problem — it's a system problem." |
| tired | fall_off | "You said you feel tired after eating and that healthy streaks don't stick. Your food is crashing your energy — and willpower can't fix that." |
| depends | bored | "You said your energy is inconsistent and healthy food bores you. What if clean eating meant Shawarma Bowls and Smash Burgers?" |
| ... | ... | Build all 16 combinations |

#### Design

- `MirrorCard` component with a subtle green left border
- Personalized text in larger font (18px)
- Below the mirror text: `"Fuel Good does the opposite."` in green, bold
- CTA: `"Show me"` button

---

### Screen 6: The Meal Reveal

**Act:** 2 (The Experience) — Phase 2: Belief Break
**Timing:** ~1.5 minutes
**Purpose:** Destroy the mental model of "healthy = boring"

#### Copy

- Headline: `"This is what Fuel Score 100 looks like."`
- Subtext: `"All whole food. All delicious. No compromises."`

#### Content

Show 3–4 `MealCard` components in a horizontal scroll or vertical stack.
Each card shows:

| Meal | Visual note | Badge |
|------|------------|-------|
| Chicken Shawarma Bowl | Vibrant, generous, colorful | Fuel 100 |
| Homestyle Smash Burger | Stacked, indulgent, not "diet food" | Fuel 100 |
| Turkish Eggs with Whipped Feta | Beautiful plating, rich colors | Fuel 100 |

#### MealCard component spec

```
┌─────────────────────────┐
│  [Meal photo]           │
│                         │
│  ┌──────┐               │
│  │100   │ Fuel Score    │
│  └──────┘               │
│  Chicken Shawarma Bowl  │
│  All whole food         │
│  ingredients            │
└─────────────────────────┘
```

#### Critical implementation note

- Meals appear ONLY here in the entire onboarding. This is a reveal, not a catalog.
- Use the best food photography available. These images sell the entire concept.
- If food photos aren't ready, use placeholder images that are clearly appetizing (not stock health food)

---

### Screen 7: Goal & Body Context

**Act:** 2 (The Experience) — Phase 3: Data Collection
**Timing:** ~2 minutes
**Purpose:** Collect personalization data (framed as building their plan)

#### Subscreens (can be 2–3 quick-tap screens or one scrollable form)

**7a — Primary Goal**
- Question: `"What matters most to you right now?"`
- Options: Feel more energy / Lose weight / Eat cleaner / Build muscle

**7b — Body Context**
- Age range selector (18-24, 25-34, 35-44, 45-54, 55+)
- Height picker
- Weight picker
- These feed MES personalization on the backend

**7c — Activity Level**
- Question: `"How active are you?"`
- Options: Sedentary / Lightly active / Moderately active / Very active

#### Frame as

- Top text: `"Let's build your plan"`
- Subtext: `"We'll use this to personalize your scores and predictions."`

---

### Screen 8: Plan Preview (Mirror #2)

**Act:** 2 (The Experience) — Phase 3: Data Collection
**Timing:** ~2.5 minutes
**Purpose:** Show the reward system with their personalized numbers

#### Content

Uses `WeeklyBarChart` and `FlexTicketRow` components.

- Show an animated weekly projection:
  - Mon–Fri bars at Fuel 100 (green)
  - Sat–Sun bars at Fuel 35/45 (amber, labeled "Flex")
  - Weekly average: 87.6 — "Strong tier"
- Below the chart: `"Even with 2 cheat meals, your body stays well-fueled."`
- Animate 4 flex tickets filling in one by one

#### Copy

- Headline: `"Your week with Fuel Good"`
- After animation: `"Eat clean. Earn [X] guilt-free cheat meals."`
  - X is calculated from their goal/activity (typically 3–4)

---

### Screen 9: Live Scan Experience

**Act:** 2 (The Experience) — Phase 4: Core Feature Trial
**Timing:** ~4 minutes
**Purpose:** The emotional peak. User experiences the core feature.

#### Flow

1. Show: `"Try it yourself. Scan something in your kitchen."`
2. Open camera with barcode scanner overlay
3. On successful scan: show full Fuel Score result
   - Score ring animation (use `FuelScoreRing`)
   - Ingredient flags
   - MES estimate
   - Swap suggestion if score < 70
4. If user skips/cancels camera: show a pre-loaded result
   - Default: Coca-Cola → Fuel 8
   - Shows the aha moment even without a real scan

#### Critical: Review Modal

**Immediately after the scan result renders**, trigger the App Store review prompt:

```typescript
import * as StoreReview from 'expo-store-review';

// After scan result animation completes (~2s delay)
setTimeout(async () => {
  if (await StoreReview.hasAction()) {
    await StoreReview.requestReview();
    updateState({ reviewPromptShown: true });
  }
}, 2000);
```

**Why here:** This is peak excitement. The user just had their aha moment. Even users who never pay will leave a review at this moment. Reviews compound organic growth forever.

#### Analytics events

- `onboarding_scan_started`
- `onboarding_scan_completed` with `{ barcode, fuelScore }`
- `onboarding_scan_skipped`
- `onboarding_review_prompted`
- `onboarding_review_left`

---

### Screen 10: Social Proof

**Act:** 2 (The Experience)
**Timing:** ~5 minutes
**Purpose:** Validation that this works for people like them

#### Content

Keep it to ONE screen. Don't oversell.

- Key stat: `"12,400+ people improved their energy in the first week"` (update with real numbers when available)
- One testimonial: real user photo, specific result, 2 sentences max
- App Store rating badge (only show if 4.5+ stars)

---

### Screen 11: The Commitment Question

**Act:** 3 (The Commit)
**Timing:** ~6 minutes
**Purpose:** Cialdini's commitment principle — get an active "yes"

#### Copy

- Headline: `"Are you ready to start earning your cheat meals?"`

#### Buttons

- Primary (green, large): `"Yes, let's go"`
  - Sets `state.committed = true`
  - Navigates to Paywall (Screen 12)
- Secondary (muted, smaller): `"Not yet"`
  - Routes to a recovery screen: `"What's holding you back?"`
  - Options: "Too expensive" / "Not sure it works" / "Just browsing"
  - Each option shows a tailored response, then routes to paywall anyway

#### Why this works

When someone actively says "yes" to a question about commitment, they are 2–3x more likely to convert on the next screen. This is Robert Cialdini's commitment and consistency principle. The "yes" primes the paywall.

---

### Screen 12–14: Paywall (Discount Cascade)

**Act:** 3 (The Commit)
**Purpose:** Convert investment into purchase

#### Implementation

This is ONE component (`PaywallScreen`) with internal state tracking `paywallDismissCount`.

```typescript
function PaywallScreen() {
  const { paywallDismissCount, updateState } = useOnboardingState();

  const discount = paywallDismissCount === 0 ? 0
                 : paywallDismissCount === 1 ? 50
                 : 80;

  const handleDismiss = () => {
    if (paywallDismissCount < 2) {
      updateState({ paywallDismissCount: paywallDismissCount + 1 });
    } else {
      // Enter free tier
      navigateToHome();
    }
  };
  // ...
}
```

#### Screen 12 — Full Price (dismiss count: 0)

- Headline: `"Start fueling good"`
- Show annual plan (best value) and weekly plan (price anchor)
- Feature list: Scanner, Meal Plans, Flex System, Healthify AI, Gamification
- CTA: `"Start your 7-day free trial"`
- Small X button in top corner to dismiss
- This is a **hard paywall** — no way to proceed except subscribe or dismiss

#### Screen 13 — 50% Off (dismiss count: 1)

- Headline: `"Wait — here's 50% off to get started."`
- Show crossed-out original price with discounted rate
- Add urgency: `"This offer won't appear again"`
- Same CTA with updated price

#### Screen 14 — 80% Off (dismiss count: 2)

- Headline: `"Okay, final offer. 80% off — just for you."`
- Maximum discount, last chance
- If dismissed: enter limited free tier
  - Free tier gets: scan-only (3/day), no meal plans, no flex system
  - This gives a taste but gates the reward loop behind subscription

#### RevenueCat integration

```typescript
// Use RevenueCat promotional offers for the discount cascade
import Purchases from 'react-native-purchases';

const offering = await Purchases.getOfferings();
const pkg = discount === 0  ? offering.current.annual
          : discount === 50 ? offering.current.availablePackages.find(p => p.identifier === 'annual_50_off')
          : offering.current.availablePackages.find(p => p.identifier === 'annual_80_off');
```

Set up 3 products in RevenueCat:
- `fuel_good_annual` — full price
- `fuel_good_annual_50` — 50% introductory offer
- `fuel_good_annual_80` — 80% introductory offer

---

## Analytics Events Summary

Every screen must fire these events for iteration:

| Event | Screen | Properties |
|-------|--------|-----------|
| `onboarding_started` | 1 | `{ timestamp }` |
| `onboarding_screen_viewed` | All | `{ screen_number, screen_name }` |
| `onboarding_screen_time` | All | `{ screen_number, duration_ms }` |
| `onboarding_energy_check_answered` | 3 | `{ value }` |
| `onboarding_diet_history_answered` | 4 | `{ value }` |
| `onboarding_goal_selected` | 7 | `{ goal }` |
| `onboarding_scan_completed` | 9 | `{ barcode, fuel_score }` |
| `onboarding_scan_skipped` | 9 | — |
| `onboarding_review_prompted` | 9 | — |
| `onboarding_review_left` | 9 | — |
| `onboarding_committed` | 11 | `{ committed: boolean }` |
| `onboarding_paywall_viewed` | 12-14 | `{ discount_percent }` |
| `onboarding_paywall_dismissed` | 12-14 | `{ discount_percent }` |
| `onboarding_trial_started` | 12-14 | `{ discount_percent, package_id }` |
| `onboarding_completed` | 14 | `{ total_duration_ms, converted: boolean }` |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trial conversion rate | 10%+ | RevenueCat trial starts / total installs |
| Onboarding completion rate | 70%+ | Users reaching paywall / users opening app |
| Scan completion (Screen 9) | 60%+ | Users completing scan / users reaching Screen 9 |
| Review prompt accept rate | 15%+ | Reviews left / review prompts shown |
| Paywall discount lift | 2–3x | Conversion at 80% off vs. full price |
| Time in onboarding | 5–10 min | Average session length through completion |

---

## Iteration Rules

1. Instrument every screen with analytics before shipping
2. Identify the biggest drop-off screen each week and redesign it first
3. A/B test one variable at a time: copy, button color, question order, video length
4. Test discount cascade ratios (50/80 vs 40/70 vs 30/60)
5. If review accept rate drops below 10%, move the prompt earlier
6. **Do not ship any other feature until conversion rate hits 10%**
