# iOS App Store Production Readiness Audit — Fuel Good

**Date:** 2026-04-16
**Branch:** `claude/ios-app-store-audit-fJ1Nk`
**Scope:** Full-stack audit across iOS config, UX, payments, backend, privacy/legal.

---

## Verdict: **NOT READY — 7 blockers must ship before submission**

The foundation is strong: modern Expo SDK 54, clean codebase hygiene (no stray console/TODOs), proper secret/CORS handling on backend, good legal copy already drafted, Apple Sign-In + RevenueCat + Sentry already wired. But the app will be **rejected on submission** (or silently break in production) because of a handful of concrete, fixable issues. Estimated 3–5 engineering days to reach submittable state.

---

## 🚨 Blockers (fix before TestFlight external / App Store submission)

| # | Area | File(s) | Issue |
|---|------|---------|-------|
| B1 | Payments | `frontend/eas.json:29,48` | Production profile uses **`test_pkQnpZsWQMeDLvqlLlVnHXtGiKk`** — a RevenueCat test/sandbox key. `billing.ts:47-49` failsafe will disable billing in prod. Purchases literally cannot happen. |
| B2 | Privacy | repo-wide | **`PrivacyInfo.xcprivacy` missing.** Apple mandates a Privacy Manifest since May 2024 for all new submissions. Sentry/PostHog/RevenueCat data use must be declared. |
| B3 | Legal | `frontend/app/onboarding-v2/paywall.tsx` (full file) | Onboarding paywall has **no Terms of Service or Privacy Policy links**. Guideline 3.1.1(a) hard-rejects. |
| B4 | Legal URLs | `frontend/constants/Config.ts:58-60` | `PRIVACY_POLICY_URL`, `TERMS_URL`, `SUPPORT_URL` are hardcoded to `fuelgood.app/…` but those pages are not live. Hosted content in `docs/legal/` must be published. |
| B5 | Content moderation | `metabolic-coach.tsx`, `stores/chatStore.ts` | AI-generated chat/coach content has **no report/flag UI** — required since mid-2023 for any generated-content feature. |
| B6 | Build hygiene | `frontend/tmp_probe.js`, `tmp_signup.js`, `tmp_toggle_signup.js` | Playwright dev scripts committed at the frontend root. Delete before build. |
| B7 | Permissions UX | `frontend/app/scan/index.tsx` | Camera + photo library OS prompts fire without a pre-permission rationale screen. Reviewers reject this pattern; copy the style from `onboarding-v2/notification-permission.tsx`. |

Backend has blockers for production *operation* (not App Store review) that should ship at the same time:

| # | Area | File(s) | Issue |
|---|------|---------|-------|
| B8 | Data integrity | `backend/real_food.db` | SQLite DB checked into git. `.gitignore` it; production must use the Render-provisioned Postgres (render.yaml already handles this, but stray file risks local overrides). |
| B9 | Account deletion | `backend/app/routers/auth.py:433` | `db.delete(current_user)` relies on cascades that aren't explicitly set. Guideline 5.1.1(v) requires **full** account + data deletion. Add `ondelete='CASCADE'` via Alembic migration across all user-owned tables and verify in staging. |
| B10 | Reliability | `backend/app/services/notifications.py:~980` | `notification_scheduler_loop` swallows all exceptions, sleeps 900s, loses messages. No retry queue. Users silently miss reminders. |

---

## 🟠 High-priority (ship with v1.0 but not submission blockers)

### iOS / UX
- **No global `ErrorBoundary`** at `frontend/app/_layout.tsx`. Sentry catches, but a render exception white-screens the app. Wrap `<Stack>` with a fallback UI + "Restart" action.
- **`allowFontScaling={false}`** on `chat/index.tsx:562,1319` breaks Dynamic Type — accessibility regression.
- **Accessibility labels missing** across main screens. Only `GlassTabBar` is covered. Add `accessibilityLabel/Role/Hint` to cards, meal items, form inputs.
- **OfflineBanner pings Google** (`components/OfflineBanner.tsx:24`). Swap to `@react-native-community/netinfo` or hit your own `/health` endpoint — reviewers flag external "phone home" calls, and 15s poll is slow.
- **ATT / NSUserTrackingUsageDescription**: PostHog is enabled in prod (`eas.json:47`). If it uses IDFA at all, add the Info.plist string, otherwise confirm "not tracking across apps" in PostHog config.
- **apple-app-site-association** must be served at `https://fuelgood.app/.well-known/apple-app-site-association` to make `applinks:fuelgood.app` (`app.json:49-51`) work. Not verifiable from repo.

### Payments
- **Auto-renew disclosure incomplete** on `onboarding-v2/paywall.tsx:236-282`. Needs explicit "auto-renews at $11.99/year unless cancelled" near the price. Guideline 3.1.2(a).
- **Account deletion logs out even if API fails** (`settings.tsx:553-595`). Check response; keep user on screen and show an error on failure.

### Backend
- **Sentry not integrated server-side.** Frontend has it, backend logs errors to stdout only. Hook `sentry_sdk` into `app/main.py` with matching DSN; add alert for >5% error rate.
- **DB pool (`backend/app/db.py:16`)** is `pool_size=10, max_overflow=20`. Meal-scan endpoints run 3–5 queries each; 5 concurrent scans saturate the pool. Bump to 20/30 and add `pool_timeout=30`.
- **File upload validation order** (`backend/app/routers/scan.py:~200`): MIME check (spoofable) runs before magic-byte check. Reverse it.
- **RevenueCat webhook 503s** (`backend/app/routers/billing.py:52`) when auth env var is unset — no alerting path. Add structured log + monitor.
- **Sentry dSYM auto-upload disabled** (`eas.json:51`: `SENTRY_DISABLE_AUTO_UPLOAD=true`). Crashes won't symbolicate without manual upload. Flip this on or document the manual step.

---

## 🟡 Medium-priority (polish within 2 weeks post-launch)

**UX**
- No skeleton/error/retry states on home, meals, chat data fetches — see `tasks/todo.md` Phase 3 item 11 (already partially done for recipes).
- Verify `KeyboardAvoidingView` / `useBottomTabBarHeight` on every input screen, especially `chat/index.tsx` bottom composer.
- Home indicator / Dynamic Island safe-area audit across all screens (GlassTabBar is correct; others not verified).
- Camera/photo denial fallback UI (link to iOS Settings).

**Payments**
- Consider surfacing RevenueCat native paywall as the primary upgrade path — better auto-renew disclosure out of the box than custom cards.

**Backend**
- 6-digit password reset codes are brute-forceable within current rate limits. Move to 8-digit or 12-char alphanumeric.
- Soft-delete (`deleted_at`) instead of hard-delete for safer recovery windows; filter in queries.
- PII in logs (`auth.py:429,435` logs `user_id`) — switch to request-id correlation.
- Outbound timeouts audit across all `httpx.AsyncClient` uses; enforce a 30s ceiling globally.
- In-process rate limiter (`main.py:245-250`) breaks on horizontal scale. Document as single-instance-only or move to Redis before scaling.

**Privacy/Legal**
- Confirm `support@fuelgood.com` inbox is live and monitored (checklist item not yet done).
- Add data-export ("Download my data") option for GDPR posture — not required, but increasingly expected.

---

## 🟢 Low-priority (nice to have)

- App Store Connect metadata (subtitle, description, keywords) — managed in App Store Connect, not `app.json`; verify before submission.
- `/ready` probe on backend (`pg_extension vector` + basic DB ping).
- Migrate generated meal images from Render ephemeral disk (`/static/meal-images`) to Supabase Storage — already used for scans.
- N+1 query sweep in `nutrition.py`, `meal_plan.py`, `recipes.py` routers.
- Blue-green deploy for Alembic migrations (`render.yaml:23` runs migrations inline on deploy).

---

## ✅ What's already good

- Expo SDK 54.0.33, RN 0.81.5 — current, not pinned to EOL versions.
- Bundle ID, versioning, splash/icon assets, Apple Sign-In enabled, non-exempt encryption declared.
- All iOS permission strings present and descriptive (`app.json:37-48`).
- Apple Sign-In server-side JWKS verification wired correctly (`auth.py:~105-130`).
- Bcrypt password hashing (12 rounds), JWT expiration sane, SECRET_KEY enforced, CORS wildcard rejected in prod.
- Privacy policy + ToS written (`docs/legal/`) with the right no-medical-claim language.
- Delete Account flow present in UI (`settings.tsx:553-595`) — just needs cascade fix and error handling.
- RevenueCat Customer Center + App Store manage-subscription URL both exposed.
- `expo-notifications` plugin and Sentry Expo plugin wired; deep link handler (`_layout.tsx:94-123`) handles cold-start + background robustly.
- Clean codebase hygiene — no stray `console.log`, `TODO`, `@ts-ignore` across the frontend.
- UI polish pass (Phases 1-4 in `tasks/todo.md`) already shipped — haptics, skeletons, spring animations, celebration moments.

---

## Recommended ship order

**Sprint 1 (2 days) — unblock submission:**
B1 RevenueCat prod key → B6 delete tmp_*.js → B3 add paywall legal links → B4 publish legal URLs → B2 Privacy Manifest → B7 camera/photo pre-permission screen → B5 chat report-abuse UI.

**Sprint 2 (2 days) — hardening:**
B8-B10 backend (cascade deletes + notification retry + DB file cleanup). ErrorBoundary. `allowFontScaling` fix. Auto-renew copy. Account-deletion error handling. Sentry dSYM + server-side Sentry. DB pool bump. File upload order.

**Sprint 3 (post-launch):** Medium-priority list above.

---

## Final call

**The app is ~90% of the way there.** None of the blockers are architectural — they're all concrete, 30-minute-to-1-day fixes. After Sprint 1, I'd submit to TestFlight external review; after Sprint 2, submit to the App Store. Confidence in first-submission approval after both sprints: high, conditional on Privacy Manifest being correctly populated and apple-app-site-association being hosted.
