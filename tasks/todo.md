# Work Plans - Real-Food Project

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

- [ ] **1. Enhance Button.tsx** — Make primary gradient more vibrant (`#22C55E → #059669`), add `usePressScale` to all variants, increase disabled state contrast
- [ ] **2. Add press-scale to all card components** — GradientCard, CompositeMealCard, EnergyHeroCard, TodayProgressCard menu items, meals.tsx action cards — anywhere with `activeOpacity` should also scale
- [ ] **3. Improve empty states** — Home (no meals logged), TodayProgressCard, food search empty, chronometer empty — add animated icons, gradient containers, stronger CTAs
- [ ] **4. Settings/Preferences visual grouping** — Add section cards with subtle surface backgrounds, visual separators, expand/collapse animations for budget editor
- [ ] **5. Enhance FuelScoreRing** — Minimum opacity 0.3 at score 0, increase label font sizes, smoother toggle animation (200ms instead of 100ms)

### Phase 2: Micro-Interactions & Animations

- [ ] **6. Staggered entrance animations** — Profile achievements, meal plan cards, search results, cook mode ingredients — items fade/slide in sequentially
- [ ] **7. ChipSelector polish** — Add press scale, smooth background color transition on select, scroll fade hints for horizontal chips
- [ ] **8. Progress bar animations** — EnergyHeroCard progress bar animate width on update, XPBar increase height to 8px and add gradient fill, macro ring counters
- [ ] **9. Cook mode celebration** — Step completion gets bounce/check animation, recipe completion gets confetti moment
- [ ] **10. Food detail color-coded macros** — Color dots for protein/carbs/fat, animated counter when quantity changes, log success celebration animation

### Phase 3: Premium Feel

- [ ] **11. Skeleton loaders** — Replace ActivityIndicator with shimmer/skeleton cards for async content (home dashboard, search results, recipe detail)
- [ ] **12. Subscribe page hero** — Add subtle gradient animation/shift, elevate recommended plan card with glow shadow, animated feature checkmarks
- [ ] **13. Login/Auth polish** — Input focus animations (accent underline), animated error entry, social button press feedback
- [ ] **14. Onboarding progress** — Add animated progress bar showing step X/16, step transition animations (slide/fade), completion celebration
- [ ] **15. Scan screen** — Add scanning animation overlay, result card entrance animations, haptic on scan complete

## Design Principles for Implementation
- Use `react-native-reanimated` for all new animations (spring physics, not linear)
- Haptic feedback via `expo-haptics` on meaningful interactions
- Keep animations under 300ms — snappy, not sluggish
- Consistent `usePressScale(0.97)` on all interactive cards
- Minimum font size: 11px for any visible text

---

# Structural Audit Plan

## Overview
Full structural audit of the Real-Food codebase (~72K lines): React Native/Expo frontend, FastAPI backend, Next.js website.

## Tasks

### 1. Dead Code Removal
- [ ] Scan all frontend files for unused imports
- [ ] Identify unreferenced functions and duplicate components
- [ ] Find orphaned files never imported anywhere
- [ ] Output list of every file and function to delete
- [ ] Remove dead code

### 2. Folder Restructure
- [ ] Propose feature-based folder structure (before/after tree)
- [ ] Each feature gets its own folder with components, hooks, utils, types

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
- [ ] Identify the single messiest file in the project
- [ ] Rewrite it completely with clean naming, proper error handling
- [ ] Add inline comments explaining every decision

### 7. Documentation
- [ ] Write comprehensive README.md covering what the app does
- [ ] Include how to run locally, folder structure, environment variables

## Review
(To be filled after completion)
