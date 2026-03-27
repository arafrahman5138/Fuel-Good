# UX Simplification Session — March 24, 2026

## Overview

Full audit and simplification of the Fuel Good app's frontend UX. The app had strong backend architecture but was surfacing too much complexity to users at once — competing scores, multiple streaks, analytics dashboards on the home screen, and a 17-step onboarding. This session brought it down to a focused, enjoyable experience without removing any backend capability.

**Guiding principle**: Progressive disclosure — hide depth behind taps, not scrolls.

---

## Audit Findings

### Verdict: Over-Engineered UX, Correctly Engineered Backend

| Area | Rating | Issue |
|------|--------|-------|
| Backend architecture | Correct | Clean separation, good patterns, production-grade |
| AI/Scoring systems | Correct | Sound algorithms, useful features |
| Frontend UX | Over-engineered | Too much exposed at once, cognitive overload |
| Onboarding | Over-engineered | 17 steps with redundant screens |
| Home Screen | Over-engineered | 10 API calls, 8+ sections, competing metrics |
| Chrono Tab | Over-engineered | 3 sub-views including unused NutriScore |

---

## Changes Made

### Phase 1: Onboarding Refinement (17 steps → 14 steps)

**File**: `frontend/app/(auth)/onboarding.tsx`

Following the ONBOARDING.md philosophy (longer is fine as long as every screen adds value), we kept the narrative structure but eliminated fatigue:

- **Merged steps 7+8** → "Any dietary goals or allergies?" — dietary restrictions and allergies on one screen with a divider
- **Merged steps 9+10** → "Protein & ingredient preferences" — liked proteins, disliked proteins, and disliked ingredients on one screen
- **Removed step 14** (standalone loading screen) → loading animation now happens inline at the start of the aha moment screen
- **Added progress milestone pills** on step 3 ("Great — we already know enough to start personalizing") and step 9 ("Almost there — let's see what your ideal day looks like")
- **Improved aha moment (step 12)**: meals now show "Fuel 100" badges and human-readable "Energy: High/Good/Moderate" labels instead of raw MES numbers
- **Added haptic feedback** on all Continue taps and the "I'm committed" button

### Phase 2: Home Screen Simplification

**File**: `frontend/app/(tabs)/index.tsx`

Removed competing sections to focus on: Score → Plan → Discovery → Actions.

- **Removed Daily Quests section** entirely from home (moved to dedicated page)
- **Reordered**: "Recommended For You" now appears ABOVE Quick Actions (discovery higher in scroll)
- **Removed 2 API calls** from home screen load (`fetchQuests`, `fetchStats`)
- Removed imports: `useGamificationStore`, `StreakBadge`, `MetabolicStreakBadge`

**New home layout (top to bottom)**:
1. Header + Week Strip (with single streak badge)
2. EnergyHeroCard (Fuel Score + MES with toggle — unchanged)
3. FlexSummaryCard (flex tickets — unchanged)
4. Today's Plan (meal log buttons — unchanged)
5. TodayProgressCard (daily fuel/energy/macros — unchanged)
6. Recommended For You (recipe carousel — moved up)
7. Quick Actions (Healthify, Scan, Meal Plans, Groceries, Browse, Saved)
8. Daily Tip

### Phase 3: Chrono Tab — Removed NutriScore & Nutrients

**File**: `frontend/app/(tabs)/chronometer.tsx`

The Nutrients sub-view wasn't a feature being actively sold. Removed it entirely.

- Removed the "Nutrients" view mode option (tab now has Fuel + Metabolic only)
- Removed all NutriScore JSX: hero card, macros section, micronutrients, nutrition gap coach, score history chart, nutrient detail modal
- Removed related state, hooks, computed values, and helper functions
- Removed unused styles (~20 style definitions)
- **Deleted**: `frontend/components/NutriScoreHeroCard.tsx`

### Phase 4: Unified Streak

**File**: `frontend/app/(tabs)/index.tsx`

Replaced 3 competing streak badges with 1 clear signal.

- Removed: `MetabolicStreakBadge`, nutrition streak leaf badge, `StreakBadge`
- Added: single tappable flame badge showing fuel streak count
- Tapping navigates to the new Quests & Achievements page
- Applied to both the intro header and sticky header

### Phase 5: Tab Renaming

**File**: `frontend/app/(tabs)/_layout.tsx`

| Before | After | Rationale |
|--------|-------|-----------|
| "Eat" | "Meals" | Clearer — it's recipes + meal plans |
| "Chrono" | "Track" | Self-explanatory for any user |
| "Chat" | "Coach" | Sounds like a helpful advisor, not a chatroom |

### New: Quests & Achievements Page

**File**: `frontend/app/quests.tsx` (NEW)

Dedicated page for gamification content moved off the home screen:

- Streak overview cards (Fuel Streak, Energy Streak, Level)
- XP progress bar
- Daily quests with full progress bars, XP badges, ceiling/floor logic
- Link to achievements in Profile
- Pull-to-refresh support
- Accessible from: home header streak badge tap + Profile screen link

**File**: `frontend/app/(tabs)/profile.tsx` — added "Quests & Streaks" navigation card above the tab selector.

---

## Files Modified

| File | Action | Summary |
|------|--------|---------|
| `frontend/app/(auth)/onboarding.tsx` | Modified | Merged steps, added milestones, improved aha moment, haptics |
| `frontend/app/(tabs)/index.tsx` | Modified | Removed quests, reordered sections, unified streak badge |
| `frontend/app/(tabs)/chronometer.tsx` | Modified | Removed nutrients tab/view, NutriScore, and all related code |
| `frontend/app/(tabs)/_layout.tsx` | Modified | Renamed tabs: Meals, Track, Coach |
| `frontend/app/(tabs)/profile.tsx` | Modified | Added Quests & Streaks navigation link |
| `frontend/app/quests.tsx` | Created | New quests & achievements page |
| `frontend/components/NutriScoreHeroCard.tsx` | Deleted | No longer used |

---

## Verification

- TypeScript type check: **0 errors** (`npx tsc --noEmit` clean)
- All files verified non-empty and reasonable size
- NutriScoreHeroCard.tsx confirmed deleted
- No backend changes required — all changes are frontend-only

---

## What Was NOT Changed

- **EnergyHeroCard** — kept as-is with dual Fuel/MES rings and toggle
- **FlexSummaryCard** — kept as-is
- **TodayProgressCard** — kept as-is
- **Quick Actions** — kept all 6 items (Healthify, Scan, 4 grid items)
- **Daily Tip** — kept at bottom of home
- **Backend** — zero changes to any Python files, models, routes, or services
- **Flex onboarding, metabolic onboarding, scan flows, chat flows** — all untouched
