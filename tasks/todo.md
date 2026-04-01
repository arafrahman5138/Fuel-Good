# Work Plans - Fuel Good Project

---

# UI Enhancement Plan — "Make It Feel Premium"

## Audit Summary

After a thorough audit of every screen and component, the app has a solid foundation (good dark theme, glass tab bar, gradient cards). But there are clear gaps vs apps like Robinhood/Duolingo/Oura that make those apps feel *premium*. The main themes:

1. **Micro-interactions are sparse** — Most touchable elements only use `activeOpacity`. No scale, no haptics, no spring physics.
2. **Empty/loading states are bare** — Plain text or basic spinners instead of skeleton screens and animated illustrations.
3. **Visual hierarchy is flat in places** — Settings, preferences, food detail all feel like uniform lists with no breathing room.
4. **Celebration moments are muted** — Logging a meal, hitting a streak, leveling up should feel *rewarding*.
5. **Button gradient is too subtle** — Primary CTA doesn't pop enough.
6. **Some text is too small** — Macro labels at 9-10px, XP bar text, ring labels are hard to read.

## Implementation Plan

### Phase 1: Core Polish (Highest Visual Impact)

- [x] **1. Enhance Button.tsx** — Make primary gradient more vibrant (`#22C55E → #059669`), add `usePressScale` to all variants, increase disabled state contrast
- [x] **2. Add press-scale to all card components** — GradientCard, CompositeMealCard, EnergyHeroCard, TodayProgressCard menu items, meals.tsx action cards — anywhere with `activeOpacity` should also scale
- [x] **3. Improve empty states** — Home (no meals logged), TodayProgressCard, food search empty, chronometer empty — add animated icons, gradient containers, stronger CTAs
- [x] **4. Settings/Preferences visual grouping** — Add section cards with subtle surface backgrounds, visual separators, expand/collapse animations for budget editor
- [x] **5. Enhance FuelScoreRing** — Minimum opacity 0.3 at score 0, increase label font sizes, smoother toggle animation (200ms instead of 100ms)

### Phase 2: Micro-Interactions & Animations

- [x] **6. Staggered entrance animations** — Profile achievements, meal plan cards, search results, cook mode ingredients — items fade/slide in sequentially
- [x] **7. ChipSelector polish** — Add press scale, smooth background color transition on select, scroll fade hints for horizontal chips
- [x] **8. Progress bar animations** — EnergyHeroCard progress bar animate width on update, XPBar increase height to 8px and add gradient fill, macro ring counters
- [x] **9. Cook mode celebration** — Step completion gets bounce/check animation, recipe completion gets confetti moment
- [x] **10. Food detail color-coded macros** — Color dots for protein/carbs/fat, animated counter when quantity changes, log success celebration animation

### Phase 3: Premium Feel

- [x] **11. Skeleton loaders** — Replace ActivityIndicator with shimmer/skeleton cards for async content (home dashboard, search results, recipe detail)
- [x] **12. Subscribe page hero** — Add subtle gradient animation/shift, elevate recommended plan card with glow shadow, animated feature checkmarks
- [x] **13. Login/Auth polish** — Input focus animations (accent underline), animated error entry, social button press feedback
- [x] **14. Onboarding progress** — Add animated progress bar showing step X/16, step transition animations (slide/fade), completion celebration
- [x] **15. Scan screen** — Add scanning animation overlay, result card entrance animations, haptic on scan complete

## Design Principles for Implementation
- Use `react-native-reanimated` for all new animations (spring physics, not linear)
- Haptic feedback via `expo-haptics` on meaningful interactions
- Keep animations under 300ms — snappy, not sluggish
- Consistent `usePressScale(0.97)` on all interactive cards
- Minimum font size: 11px for any visible text

---

# Structural Audit Plan

## Overview
Full structural audit of the Fuel Good codebase (~72K lines): React Native/Expo frontend, FastAPI backend, Next.js website.

## Tasks

### 1. Dead Code Removal
- [ ] Scan all frontend files for unused imports
- [ ] Identify unreferenced functions and duplicate components
- [ ] Find orphaned files never imported anywhere
- [ ] Output list of every file and function to delete
- [ ] Remove dead code

### 2. Folder Restructure
- [x] Propose feature-based folder structure (see structural-audit.md)
- [ ] Migrate to feature-based folders (future)

### 3. Hardcoded Value Extraction
- [ ] Find hardcoded strings, color hexes, API URLs
- [ ] Find API keys, timeout values, magic numbers
- [ ] Move all into config files with named exports grouped by category

### 4. Naming Standardization
- [ ] Audit variable names, function names, file names
- [ ] Flag vague names (temp, data, handler, stuff, thing, utils2)
- [ ] Suggest specific descriptive replacements

### 5. Scalability Risks
- [ ] List top 5 things that will break at 10K daily active users
- [ ] For each risk, explain failure mode
- [ ] Provide specific fix with code examples

### 6. Worst File Rewrite
- [x] Identify the single messiest file in the project (scan/index.tsx — 2,992 lines)
- [x] Created useScanState.ts reducer hook to consolidate 32 useState calls
- [ ] Complete rewrite of scan/index.tsx using new hooks (future)

### 7. Documentation
- [ ] Write comprehensive README.md covering what the app does
- [ ] Include how to run locally, folder structure, environment variables

## Review
(To be filled after completion)

---

# Onboarding V2 Optimization Plan

## Goal
Maximize conversion rate and revenue without requiring external assets (video, food photography). All items are code-implementable.

---

## Phase 1: High-Impact Conversion Levers (Revenue-Direct)

These directly affect whether someone pays at the paywall.

- [x] **1.1 — Add "Generating Your Plan" loading screen**
  Insert a new screen between `commitment.tsx` and `paywall.tsx`. Show 8-10 seconds of animated progress messages:
  - "Analyzing your metabolism..."
  - "Building your meal plan..."
  - "Calculating your flex meals..."
  - "Personalizing your scanner..."
  - Final checkmark: "Your plan is ready"

  **Why:** Adds sunk cost (10 more seconds invested), creates anticipation ("I need to see MY plan"), and makes the paywall feel like it's gating something custom-built. This is the #1 pattern in high-converting health apps.

- [x] **1.2 — Add loss aversion copy on paywall dismiss**
  When user taps X to dismiss paywall, show a brief "what you'll lose" message before showing the discount. Examples:
  - "Without Fuel Good, you won't know what's really in your food."
  - "You'll lose your personalized meal plan and scanner access."

  **Why:** Loss aversion is 2x stronger than gain framing. Currently the dismiss just silently bumps a discount — pair it with emotional weight.

- [x] **1.3 — Fix commitment screen objection timing**
  Change auto-navigate from 2.5s to showing a "See my options →" CTA button instead. User taps when ready.

  **Why:** 2.5s isn't enough to read and process the objection response. Forcing navigation before the response lands undermines the objection handling.

- [x] **1.4 — Rethink the 80% discount on 3rd paywall**
  Replace the 80% discount (3rd dismiss) with a limited free tier entry. Show: "Try Fuel Good free with limited features — 3 scans/week, no meal plans." Add a prominent "Or unlock everything for just $11.99/year" as the alternative.

  **Why:** 80% discount trains users to always dismiss twice. A limited free tier gets them using the app (converts better long-term via in-app upgrade prompts) without devaluing the product.

---

## Phase 2: Engagement & Depth (Hook Users)

These increase time-in-onboarding and emotional investment.

- [x] **2.1 — Upgrade the video hook with richer animations**
  Make the existing animated scenes more cinematic:
  - Dramatic before/after comparison (red flags animating in → swap to clean alternative with green score pop)
  - Particle/confetti effect when Fuel Score hits 100 on the swap
  - Smooth cross-fade transitions instead of opacity toggles
  - Subtle background gradient shift per scene (warm → cool → green)

- [x] **2.2 — Merge problem statement into the video hook**
  Remove `problem-statement.tsx` as a standalone screen. Add the problem statement text as the opening of Scene 1 in video-hook.

  **Why:** Eliminates one tap/screen. Every unnecessary screen is a drop-off point.

- [x] **2.3 — Personalize plan preview copy based on goal**
  Change headline from generic "Your week with Fuel Good" to goal-specific:
  - energy → "Your energy transformation week"
  - weight → "Your fat loss week with Fuel Good"
  - cleaner → "Your clean eating week"
  - muscle → "Your muscle fuel week"

- [x] **2.4 — Rethink social proof screen**
  Replace hard-coded "12,400+" stat with a "What you'll get" recap that summarizes their personalized plan (goal, flex meals, meal types, scanner). Reinforces sunk cost and value simultaneously.

---

## Phase 3: Growth & Data (Revenue Indirect)

- [x] **3.1 — Add notification permission request**
  Custom "Enable Notifications" card after live scan (post-aha moment). Frame: "Get daily meal suggestions and flex meal reminders." Preview notification appearance.

- [x] **3.2 — Add attribution question**
  Single question early in onboarding (after energy-check): "How did you find Fuel Good?" Options: App Store, TikTok, Instagram, YouTube, Friend/Family, Other.

- [x] **3.3 — Add "premium preview" label to scan result**
  After scan result in `live-scan.tsx`, add badge: "Premium members see this for every product they scan."

---

## Phase 4: Polish & Micro-Interactions

- [x] **4.1 — Add selection micro-interactions to question screens**
  Card glow/pulse on select, subtle checkmark animation, 400ms delay before auto-advance.

- [x] **4.2 — Improve paywall CTA framing**
  "Start your 7-day free trial" → "Try Free for 7 Days" (shorter, punchier). Add: "Cancel anytime. No charge until day 8."

---

## Implementation Order

**Sprint 1 (ship first):** 1.1, 1.2, 1.3
**Sprint 2 (engagement):** 2.2, 2.3, 1.4
**Sprint 3 (growth):** 3.1, 3.2, 3.3
**Sprint 4 (polish):** 2.1, 2.4, 4.1, 4.2

## Success Metrics
- **Primary:** Paywall conversion rate (target: 10%+)
- **Secondary:** Onboarding completion rate (hook → paywall)
- **Tertiary:** Time in onboarding (target: 10-15 min)
- **Per-screen:** Drop-off rate at each step
