# Chat Context

This file captures the current working context for the `feature/ai-scan-v1` branch.

## Current branch

- `feature/ai-scan-v1`

## Primary focus of this branch

- Unified scan flow
- Meal scan UX redesign
- Camera-first capture experience
- Deterministic meal result review + logging

## High-level product decisions

### Unified scan

The scan feature is one entry point with 3 modes:

- `Scan Food`
- `Barcode`
- `Food Label`

### Meal scan flow

The meal scan frontend was redesigned into 3 states:

1. `Capture`
2. `Review`
3. `Result`

### Score handling

- MES should be consistent across browse, recipe detail, and Chronometer.
- Recipe detail now uses canonical MES fields instead of legacy inflated fallback logic.
- Chronometer and Home were adjusted to use explicit local date keys and focus-based refreshes.

### Logging behavior

- Meal scans log to Chronometer after review.
- Scan result arrays are normalized on the frontend so missing response fields do not crash rendering.

## Scan screen work completed

### Capture state

- Replaced the old stacked white-card scan page with a capture-first flow.
- Added live `CameraView` usage when native camera support is available.
- Added branded fallback background when live preview is unavailable.
- Reworked the capture screen to use Fuel Good colors instead of the earlier red placeholder.
- Added custom frame corners and a branded overlay.

### Review state

- Large selected image preview
- Compact context chips:
  - meal type
  - portion size
  - home vs restaurant
- Single primary `Analyze Meal` CTA

### Result state

- One summary hero
- MES ring if eligible
- Macro cards
- Editable ingredient chips
- `Upgrade next time`
- `Recover today`
- Sticky bottom actions:
  - `Recompute`
  - `Log to Chronometer`

### Label cleanup

Incomplete meal names are cleaned before display.

Examples of stripped trailing fragments:

- `with`
- `and`
- `in`
- `on`
- `over`
- `under`

Fallback behavior:

- use cleaned model title if valid
- otherwise derive a name from detected ingredients
- otherwise show `Detected meal`

## Scan bugs fixed recently

### Permission crash

Fixed missing permission handling for:

- camera
- photo library

Behavior now:

- permissions are requested before launch
- denied permission shows alert instead of red-screen crash

### Render crash

Fixed `.map()` on undefined for meal scan result fields.

Frontend now normalizes:

- `estimated_ingredients`
- `normalized_ingredients`
- `whole_food_flags`
- `upgrade_suggestions`
- `recovery_plan`

### Gemini 404 issue

Backend default Gemini model was updated from:

- `gemini-2.0-flash`

to:

- `gemini-2.5-flash`

Relevant files:

- [backend/app/config.py](/Users/arafrahman/Desktop/Real-Food/backend/app/config.py)
- [backend/.env](/Users/arafrahman/Desktop/Real-Food/backend/.env)

## Current scan UX issues already discussed

The user explicitly disliked:

- overly large mode buttons
- overlapping header buttons and frame corners
- duplicate help/question-mark actions
- generic alert-style help popup
- unfinished scan labels like `Chicken Patties with`
- layouts that feel copied from another app instead of using Fuel Good branding

## Current scan UX direction

The intended visual direction is:

- modern
- sleek
- clean
- clearly Fuel Good branded
- not a direct copy of the earlier reference image

Design constraints called out by the user:

- use one consistent radius family
- use one text color family
- use one base spacing system
- use one icon set consistently

## Recent home / chronometer work relevant to this branch

### Home

- Daily Fuel hero updated
- status pills stack vertically by design
- 2x2 macro grid added
- quick actions redesigned into a more coherent card system
- segmented panel heights were tuned multiple times to keep the 3 states visually aligned

### Chronometer

- macro bars replaced with 2x2 macro ring cards
- card widths widened
- explicit local date key used to avoid Home/Chrono mismatches
- focus refresh added to reduce stale meal/MES state

## Known backend date issue

There is still a backend timezone problem for user-facing “today” defaults.

Problem:

- backend routes still default “today” using UTC in places

Impact:

- late-night logs can appear under the wrong local day

Relevant files:

- [backend/app/routers/nutrition.py](/Users/arafrahman/Desktop/Real-Food/backend/app/routers/nutrition.py)
- [backend/app/routers/metabolic.py](/Users/arafrahman/Desktop/Real-Food/backend/app/routers/metabolic.py)
- [backend/app/routers/scan.py](/Users/arafrahman/Desktop/Real-Food/backend/app/routers/scan.py)

Recommended fix:

- send local date from client for all log actions
- stop defaulting to `datetime.utcnow().date()` for user-facing “today”
- longer-term store user timezone

## Files most actively changed in this branch

- [frontend/app/scan/index.tsx](/Users/arafrahman/Desktop/Real-Food/frontend/app/scan/index.tsx)
- [frontend/app/(tabs)/index.tsx](/Users/arafrahman/Desktop/Real-Food/frontend/app/(tabs)/index.tsx)
- [frontend/app/(tabs)/chronometer.tsx](/Users/arafrahman/Desktop/Real-Food/frontend/app/(tabs)/chronometer.tsx)
- [frontend/components/EnergyBudgetCard.tsx](/Users/arafrahman/Desktop/Real-Food/frontend/components/EnergyBudgetCard.tsx)
- [frontend/components/GlassTabBar.tsx](/Users/arafrahman/Desktop/Real-Food/frontend/components/GlassTabBar.tsx)
- [frontend/app/_layout.tsx](/Users/arafrahman/Desktop/Real-Food/frontend/app/_layout.tsx)
- [backend/app/config.py](/Users/arafrahman/Desktop/Real-Food/backend/app/config.py)

## Current validation status

Frontend:

- `cd frontend && npx tsc --noEmit` passes after the recent scan work

Backend:

- targeted compile checks for updated files have been run successfully during this branch

## Remaining high-value next steps

1. Continue tightening the capture screen spacing and control sizing.
2. Add subtle motion to the capture frame and state transitions.
3. Fix the backend timezone handling for “today”.
4. Run end-to-end on a physical iPhone after each capture-screen adjustment.
5. If live camera preview still does not show on device, rebuild/reinstall the app binary so the native camera module is definitely present.
