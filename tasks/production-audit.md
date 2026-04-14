# Production Audit: Fuel Good App
**Date:** 2026-04-11  
**Status:** CONDITIONALLY READY - 4 blocking issues, 8 critical fixes needed

---

## Self-Prompt for Thorough Audit

> "Act as a staff-level mobile engineer + security reviewer preparing this app for App Store submission. Audit every layer — frontend (React Native/Expo), backend (FastAPI/Python), infrastructure (Render/Supabase/RevenueCat), and operational readiness. For each area, check: (1) Does it work correctly? (2) Does it fail gracefully? (3) Can it be exploited? (4) Will Apple reject it? (5) Will it scale to 10K users? Think about: authentication edge cases (expired tokens, revoked OAuth, race conditions), billing loopholes (free premium access, webhook replay, trial abuse), data integrity (concurrent writes, partial failures, orphaned records), network failures (airplane mode, slow 3G, timeout cascading), privacy compliance (GDPR data export, account deletion, analytics consent), App Store guidelines (IAP-only payments, permission justifications, crash-free launch), and operational gaps (monitoring blind spots, secret rotation, backup verification). Flag everything as BLOCKING, CRITICAL, HIGH, MEDIUM, or LOW."

---

## Audit Results

### BLOCKING ISSUES (Must fix before App Store submission)

#### B1. No React Error Boundaries
- **Risk:** Unhandled JS exceptions crash the entire app with no recovery UI. Apple may reject for poor crash handling.
- **Fix:** Wrap root layout, tab navigator, and modal routes with ErrorBoundary components that show a "Something went wrong" fallback with retry.
- **Files:** `frontend/app/_layout.tsx`, `frontend/app/(tabs)/_layout.tsx`

#### B2. Silent Billing Failures Mask Premium Bypass
- **Risk:** `catch(() => {})` in billing bootstrap (3 instances in `_layout.tsx` lines 161, 187, 257) silently swallows RevenueCat errors. If billing sync fails, users may get premium access without paying, or free users may be incorrectly locked out.
- **Fix:** Log errors via Sentry, set a `billingError` state, and show a retry option. Never silently pass billing checks.
- **Files:** `frontend/app/_layout.tsx`, `frontend/services/billing.ts`

#### B3. RevenueCat Using Test API Key in Production Build
- **Risk:** `eas.json` production profile has `test_pkQnpZsWQMeDLvqlLlVnHXtGiKk` — App Store purchases will fail or not be tracked.
- **Fix:** Replace with production RevenueCat API key before submission.
- **File:** `frontend/eas.json` (line ~48)

#### B4. Legal URLs Must Be Live
- **Risk:** `https://fuelgood.app/privacy` and `https://fuelgood.app/terms` are configured in app.json but may not be deployed yet. Apple requires live, accessible URLs.
- **Fix:** Verify these URLs return 200 with actual content before submission.
- **Files:** `frontend/app.json`, `backend/app/config.py`

---

### CRITICAL ISSUES (Fix before launch, potential data/revenue loss)

#### C1. Backend Billing Fetch Returns Empty Dict on Failure
- **Risk:** `fetch_revenuecat_subscriber()` returns `{}` on network error. Downstream code may interpret missing entitlements as "no subscription" or worse, allow premium access if default handling is wrong.
- **Fix:** Raise an explicit error on fetch failure. Never return empty data for billing state.
- **File:** `backend/app/services/billing.py`

#### C2. Premium Auth Decorator Edge Case
- **Risk:** `require_premium_user()` checks `entitlement.access_level != "premium"` — if `access_level` is `None` (edge case from C1), the comparison passes type checks but could behave unexpectedly.
- **Fix:** Use positive assertion: `access_level == "premium" and not requires_paywall`.
- **File:** `backend/app/auth.py`

#### C3. In-Memory Rate Limiter Lost on Restart
- **Risk:** Rate limiting state is in-process memory. On Render restart/deploy, all rate limits reset — enabling brute-force windows during deploys.
- **Fix:** Acceptable for single-instance MVP, but document the risk and plan Redis migration before scaling.
- **File:** `backend/app/main.py` (lines 241-379)

#### C4. Runtime Schema Migration on Startup
- **Risk:** `ensure_legacy_schema_columns()` runs DDL on every startup. In multi-instance or zero-downtime deploys, concurrent DDL can cause table locks or race conditions.
- **Fix:** Move all schema changes to Alembic migrations only. Remove runtime DDL.
- **File:** `backend/app/db.py` (lines 80-266)

#### C5. 550+ TODO/FIXME Comments
- **Risk:** Some may flag incomplete features, known bugs, or security shortcuts that shipped unfinished.
- **Fix:** Triage all TODOs — resolve or defer with justification. Critical ones in auth/billing/scan must be resolved.
- **Scope:** Both `frontend/` and `backend/`

#### C6. Minimal Frontend Test Coverage
- **Risk:** Only 5 test files (~520 lines) covering API client, billing, analytics, offline queue, and auth store. No tests for: paywall enforcement, onboarding flow, scan fallback, meal plan generation, or subscription state transitions.
- **Fix:** Add integration tests for the 5 highest-risk flows before launch.
- **Files:** `frontend/__tests__/`

#### C7. scan/index.tsx is 2,992 Lines
- **Risk:** Massive single-file component is fragile, hard to test, and likely contains hidden bugs. Identified in existing structural audit as "worst file."
- **Fix:** Refactor into smaller composable components before launch. At minimum, extract camera, barcode, and result display logic.
- **File:** `frontend/app/scan/index.tsx`

#### C8. No Account Deletion Flow
- **Risk:** Apple requires apps to offer account deletion (App Store Review Guideline 5.1.1(v)). If this is missing, the app will be rejected.
- **Fix:** Verify account deletion exists in Profile settings. If not, implement it with backend `DELETE /api/auth/account` endpoint that cascades user data.
- **Check:** `frontend/app/(tabs)/profile/`, `backend/app/routers/auth.py`

---

### HIGH PRIORITY (Fix before or shortly after launch)

#### H1. Missing useEffect Cleanup in Key Screens
- 261 useEffect hooks found; several in `_layout.tsx` and scan screens lack proper cleanup
- Risk: Memory leaks, state updates on unmounted components, battery drain

#### H2. `as any` Type Coercion (3 instances)
- Bypasses TypeScript safety in notifications, API client, and error reporting
- Risk: Runtime crashes from unexpected types

#### H3. Image Compression Quality for Scans
- Meal scans compressed to 50%, product labels to 65%
- Risk: OCR/AI accuracy degradation — needs validation testing

#### H4. Social Auth Timeout (10 seconds)
- Google/Apple token validation has 10s timeout
- Risk: Failures on slow networks (test on 3G throttled connection)

#### H5. No Structured Logging Aggregation
- Backend logs JSON to stdout but no log aggregation service configured
- Risk: Can't debug production issues without log access

#### H6. Push Notification End-to-End Untested
- Expo push tokens registered but no documented E2E test of notification delivery
- Risk: Users opt in but never receive notifications

#### H7. Offline Read-Only Cache Missing
- Mutations queue offline, but queries fail immediately
- Risk: App shows blank screens when offline (home feed, chronometer)

#### H8. Android Not Production-Ready
- RevenueCat Android not configured, no Play Store submission profile
- Risk: None if iOS-only launch, but document the gap

---

### MEDIUM PRIORITY (Post-launch)

- M1. Temporary test files in source (`tmp_probe.js`, `tmp_signup.js`, etc.)
- M2. No secret rotation policy documented
- M3. No database backup verification drill completed
- M4. PostHog analytics only in production — no staging validation
- M5. Meal plan 2-week auto-expiry has no user notification
- M6. No admin dashboard for monitoring AI call failures or quota overages
- M7. Chat concurrent request semaphore is global (max 5) — could bottleneck under load
- M8. Supabase signed URLs expire after 1 hour — scanned meal images may break in old logs

---

### LOW PRIORITY (Nice-to-have)

- L1. Replace console.log with structured logger in remaining files
- L2. Add API documentation beyond auto-generated FastAPI docs
- L3. Localization support (English-only currently)
- L4. iPad-specific layout optimization
- L5. Dark mode testing across all screens

---

### PASSING CHECKS

| Area | Status | Notes |
|------|--------|-------|
| JWT Auth | PASS | bcrypt 12 rounds, access + refresh tokens, proper expiry |
| CORS | PASS | Environment-specific, blocks localhost in prod |
| Security Headers | PASS | HSTS, X-Frame-Options, X-Content-Type-Options |
| HMAC Webhook Verification | PASS | Constant-time comparison for RevenueCat + notifications |
| Camera/Photo Permissions | PASS | Descriptive strings present in app.json |
| Non-Exempt Encryption | PASS | `usesNonExemptEncryption: false` set |
| Deep Linking | PASS | `fuelgood://` scheme + universal links configured |
| Sentry Error Reporting | PASS | Configured with org/project, breadcrumbs, sampling |
| Database Pooling | PASS | pool_size=10, max_overflow=20, pre_ping, recycle=300s |
| Alembic Migrations | PASS | 22 migration files, proper up/downgrade chains |
| Offline Mutation Queue | PASS | AsyncStorage persistence, dedup, 3 retries |
| Token Refresh | PASS | Silent refresh on 401, single retry per request |
| Subscription Gating | PASS | `require_premium_user` dependency on all premium routes |
| Expo OTA Updates | PASS | EAS Updates configured with fallback to cache |
| Multi-LLM Provider | PASS | Gemini/OpenAI/Anthropic/Ollama with runtime selection |

---

## Pre-Submission Checklist

- [ ] Fix B1: Add ErrorBoundary components
- [ ] Fix B2: Handle billing errors explicitly (no silent catch)
- [ ] Fix B3: Swap RevenueCat test key for production key
- [ ] Fix B4: Verify legal URLs are live and returning content
- [ ] Fix C1: Backend billing fetch must raise on failure
- [ ] Fix C2: Positive premium assertion in auth decorator
- [ ] Fix C5: Triage TODO comments (at minimum auth/billing/scan)
- [ ] Fix C8: Verify account deletion flow exists (Apple requirement)
- [ ] TestFlight build on 2+ physical iPhones
- [ ] Test subscription purchase + restore + cancel flow
- [ ] Test offline behavior (airplane mode for 30 seconds, then reconnect)
- [ ] Test scan feature with real food photos (camera + gallery)
- [ ] Test push notification delivery end-to-end
- [ ] App Store metadata: screenshots, description, keywords, categories
- [ ] Apple Developer account active and paid
- [ ] Signing certificates and provisioning profiles configured in EAS
