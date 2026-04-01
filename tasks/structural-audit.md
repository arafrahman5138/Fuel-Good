# Structural Audit Report — Fuel Good

**Date:** 2026-03-18
**Codebase:** ~72,700 lines across React Native/Expo frontend, FastAPI backend, Next.js website

---

## 1. Dead Code Removal

### Files Deleted (10 orphaned files)

| File | Reason |
|------|--------|
| `frontend/components/CollapsibleNutritionRow.tsx` | Never imported anywhere |
| `frontend/components/EnergyImpactPreview.tsx` | Never imported anywhere |
| `frontend/components/FlexTicketsCard.tsx` | Duplicate of `FlexMealsEarned.tsx` |
| `frontend/components/FuelTargetPicker.tsx` | Never imported anywhere |
| `frontend/components/HealthPulseCard.tsx` | Never imported anywhere |
| `frontend/components/MealTypePicker.tsx` | Never imported anywhere |
| `frontend/components/QuickGlanceRow.tsx` | Never imported anywhere |
| `frontend/components/TodaysMealsCard.tsx` | Never imported anywhere |
| `frontend/hooks/useResponsive.ts` | Hook never used by any component |
| `backend/app/agents/meal_planner.py` | Replaced by `meal_planner_fallback.py` |

### Code Removed

| Location | What | Reason |
|----------|------|--------|
| `frontend/hooks/useAnimations.ts` | `useToastAnimation()` | Never called from any component |
| `backend/app/routers/auth.py` | `_normalize_email()` | Moved to shared `app/utils.py` |
| `backend/app/services/chat_limits.py` | `_normalize_email()` | Moved to shared `app/utils.py` |

### Shared Utility Created

- **`backend/app/utils.py`** — `normalize_email()` function extracted to eliminate duplication

---

## 2. Folder Restructure Proposal

### Current: Organized by file type (acceptable for this project size)

The current structure is reasonable for a ~72K line project. A full feature-based restructure is **not recommended** at this time because:
- Expo Router requires file-based routing in `app/`
- The backend already has clear separation (routers → services → models → agents)
- The cost of restructuring outweighs the benefit at the current codebase size

### Recommended Incremental Improvements

```
frontend/components/
  ├── MealsTab/          ✅ Already exists (good pattern)
  ├── energy/            ← Group: EnergyHeroCard, EnergyBudgetCard, EnergyImpactPreview
  ├── gamification/      ← Group: FuelStreakBadge, MetabolicStreakBadge, FlexMealsEarned
  └── shared/            ← Group: Button, Shadows, LoadingPhaseText, TypingIndicator
```

---

## 3. Hardcoded Value Extraction

### New Config Files Created

| File | Purpose |
|------|---------|
| `frontend/constants/Animations.ts` | Animation durations, delays, spring configs |
| `frontend/constants/Thresholds.ts` | MES tiers, streak tiers, flex thresholds, accent colors |

### Remaining Hardcoded Values to Address (by priority)

**HIGH — Colors not using `Colors.ts`:**
- `FlexInsightsCard.tsx` — 5 hardcoded hex colors
- `EnergyHeroCard.tsx` — 9 hardcoded hex colors in tier configs
- `FuelStreakBadge.tsx` — 3 streak tier colors (`#FFD700`, `#C0C0C0`, `#CD7F32`)
- `Config.ts:169-182` — Health benefit option colors

**MEDIUM — Notification timing (backend):**
- `notifications.py` has 15+ hardcoded `timedelta()` values for cooldowns
- Consider moving to a `NOTIFICATION_COOLDOWNS` dict in `config.py`

**LOW — Inline padding/margin values:**
- Many components use `paddingHorizontal: 10`, `paddingVertical: 14` etc.
- These are typical for React Native and acceptable as-is

---

## 4. Naming Standardization

### Critical Issues (38+ single-letter variables)

**Worst offenders by file:**

| File | Variables | Fix |
|------|-----------|-----|
| `app/(tabs)/index.tsx:49-51` | `y`, `m`, `d` | `year`, `month`, `day` |
| `app/(tabs)/index.tsx:1204` | `s` | `styles` |
| `app/(tabs)/chronometer.tsx:469,479,495` | `c` | `dailyComparison` |
| `app/(auth)/onboarding.tsx:362-364` | `w`, `a`, `g` | `weightNumeric`, `ageNumeric`, `selectedGoal` |
| `app/scan/index.tsx:311` | `n` | `nutritionData` |
| `app/settings.tsx:86-88` | `pw`, `fw`, `sw` | `proteinWeight`, `fiberWeight`, `sugarWeight` |
| `services/api.ts:487,615` | `qs` | `queryString` |

### Recommended Linting Rule

Add to `.eslintrc`: `"id-length": ["warn", { "min": 2, "exceptions": ["i", "j", "k"] }]`

---

## 5. Scalability Risks (Top 5)

### Risk 1: Unbounded In-Memory Rate Limiter
- **File:** `backend/app/main.py:218`
- **Issue:** `_rate_buckets` dictionary grows indefinitely — never cleans up expired IP:path entries
- **Failure at 10K DAU:** Memory leak → OOM crash after days/weeks
- **Fix:** Add periodic cleanup of stale buckets (sweep every hour, remove entries older than 2× window)

### Risk 2: Missing Database Connection Pool Configuration
- **File:** `backend/app/db.py:14`
- **Issue:** `create_engine(settings.database_url)` uses defaults (pool_size=5, no pre-ping)
- **Failure at 10K DAU:** Connection pool exhausted → 504 errors, cascading timeouts
- **Fix:** Add `pool_size=20, max_overflow=40, pool_pre_ping=True, pool_recycle=3600`

### Risk 3: N+1 Query in Recipe Browse
- **File:** `backend/app/routers/recipes.py:298`
- **Issue:** `query.all()` loads ALL recipes into memory, then filters in Python; pairing lookups trigger additional queries per recipe
- **Failure at 10K DAU:** Database CPU 100%, p99 latency >30s on browse endpoint
- **Fix:** Push filtering into SQL, paginate before loading, batch-load pairings

### Risk 4: LLM Calls Without Retry/Backoff
- **File:** `backend/app/agents/llm_provider.py:14-19`
- **Issue:** No retry policy, no connection pooling for LLM API calls
- **Failure at 10K DAU:** Single Gemini latency spike blocks all concurrent chat requests
- **Fix:** Add `tenacity` retry with exponential backoff, configure `request_timeout=15`

### Risk 5: Notification Scheduler Loads All Users at Once
- **File:** `backend/app/services/notifications.py:360`
- **Issue:** `user_query.all()` loads all user IDs into a list, processes sequentially, no batching of Expo Push API calls
- **Failure at 10K DAU:** 3+ hour processing time, stale data, duplicate notifications
- **Fix:** Paginate users (100 at a time), batch Expo Push API calls

---

## 6. Worst File Rewrite

**File:** `backend/import_wholefood_site_recipes.py` (1,011 lines → 1,050 lines rewritten)

### Problems Fixed

| Issue | Before | After |
|-------|--------|-------|
| Mixed concerns | 6+ responsibilities in one file | Clear sections with descriptive headers |
| Naming | `t`, `m`, `h`, `s`, `p` everywhere | Full descriptive names |
| Error handling | Bare `except Exception` | `logger.exception()` with context |
| DB transaction management | No `finally:` block | `try/finally: db.close()` |
| Code duplication | `infer_protein_types` / `infer_carb_types` nearly identical | Unified via `_infer_types_from_ingredients()` |
| Constants | Magic numbers inline | Named constants at top of file |
| Function naming | `twist_title()`, `twist_steps()` | `_format_title()`, `_format_steps()` |
| Single responsibility | `import_recipes()` = 150-line function doing everything | Extracted `_process_single_recipe()` |

---

## 7. Documentation

**Updated:** `README.md` — expanded project structure tree to include all directories and their purposes.

The existing README was already comprehensive (features, tech stack, getting started, environment variables). The update adds:
- Complete folder tree with descriptions for every directory
- New `tasks/` directory reference
- New constants files (`Animations.ts`, `Thresholds.ts`)
- `backend/app/utils.py` reference

---

## Summary of Changes

| Category | Items Changed |
|----------|--------------|
| Files deleted | 10 orphaned/unused files |
| Functions removed | 3 (unused hooks, duplicates) |
| Files created | 4 (`utils.py`, `Animations.ts`, `Thresholds.ts`, `structural-audit.md`) |
| Files rewritten | 1 (`import_wholefood_site_recipes.py`) |
| Files modified | 4 (`auth.py`, `chat_limits.py`, `useAnimations.ts`, `README.md`) |
