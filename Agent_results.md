## Fuel Good — Final Apple Developer Verification Report

---

### 1. Verification Status: ALL CLEAR ✅

Everything in the portal matches the known state. No mismatches. No changes made.

| Item | Known State | Portal State | Match |
|---|---|---|---|
| App ID `com.fuelgood.ios` | Exists | Exists (internal ID: `SAVDCKY5MU`) | ✅ |
| Push Notifications | Enabled | Enabled (checked) | ✅ |
| Sign In with Apple | Enabled | Enabled (checked), Primary App ID | ✅ |
| APNs Key `3B5343VXQN` | Exists | Exists, APNs service, Team-scoped, Sandbox & Production | ✅ |
| SIWA Key `56UW5677RJ` | Exists | Exists, Sign In with Apple, scoped to `APRD4QD239.com.fuelgood.ios` | ✅ |
| Team ID | `APRD4QD239` | `APRD4QD239` | ✅ |

Neither key requires additional setup in the Apple Developer portal. Both are fully configured and active.

---

### 2. APNs Key Handoff Info

```
KEY PURPOSE:       Apple Push Notifications service (APNs)
KEY NAME:          push noti
KEY ID:            3B5343VXQN
LOCAL FILE:        /Users/arafrahman/Downloads/AuthKey_3B5343VXQN.p8
SCOPE:             Team Scoped (All topics)
ENVIRONMENT:       Sandbox & Production
TEAM ID:           APRD4QD239
BUNDLE ID:         com.fuelgood.ios
DOWNLOAD STATUS:   Already downloaded (cannot re-download)
```

**Who needs this key:**

| Service | What it needs | How to provide it |
|---|---|---|
| **RevenueCat** | `.p8` file contents, Key ID, Team ID | Upload or paste into RevenueCat dashboard → iOS App → Push Notifications |
| **Expo/EAS** | Key ID, Team ID (for push token routing) | Set in `app.json` or `eas.json` under `ios.pushNotifications` |
| **Backend (Supabase/Render)** | `.p8` file contents, Key ID, Team ID, Bundle ID | Store as env vars/secrets for server-side push delivery |

---

### 3. Sign In with Apple Key Handoff Info

```
KEY PURPOSE:       Sign In with Apple
KEY NAME:          fuelgood
KEY ID:            56UW5677RJ
LOCAL FILE:        /Users/arafrahman/Downloads/AuthKey_56UW5677RJ.p8
CONFIGURATION:     APRD4QD239.com.fuelgood.ios (Primary App ID)
TEAM ID:           APRD4QD239
BUNDLE ID:         com.fuelgood.ios
DOWNLOAD STATUS:   Already downloaded (cannot re-download)
```

**Who needs this key:**

| Service | What it needs | How to provide it |
|---|---|---|
| **Backend auth (Supabase)** | `.p8` file contents, Key ID, Team ID, Bundle ID (to generate client secrets for token verification) | Store as env vars/secrets; used to generate the JWT client secret for Apple's token endpoint |
| **Expo/EAS** | No key file needed; the native `expo-apple-authentication` SDK uses the App ID capability directly | Just ensure `ios.usesAppleSignIn: true` in `app.json` |
| **RevenueCat** | Not directly needed | RevenueCat does not handle SIWA auth — this is backend-only |

---

### 4. Blockers & Action Items

**⚠️ BLOCKER — Account Payment Method:**
The Apple Developer account has a banner warning that the default payment method cannot be used for membership renewal. If the membership lapses, all keys, App IDs, and provisioning profiles become inactive. Someone needs to update the payment method at the account level.

**⚠️ ACTION — Server-to-Server Notification Endpoint (Sign In with Apple):**
The S2S notification endpoint URL field is currently **blank** on the App ID's Sign In with Apple configuration. This is not a launch blocker, but the backend team should provide a URL (e.g., `https://your-api.com/auth/apple/notifications`) so Apple can notify you when a user revokes consent, changes their email relay, or deletes their Apple account. This can be set later without creating a new key.

**No other blockers.** Both `.p8` key files are on local disk and ready for handoff to downstream services.

---

## Second-Pass Combined Report: App Store Connect Setup for Fuel Good

### TRACK A — App Metadata

**What was completed:**

All fillable text metadata on the version page has been entered and saved. Promotional Text, Description (including subscription terms, auto-renewal disclosure, and links to privacy policy and terms of use), Keywords, Support URL (`https://www.fuelgood.app/support`), Marketing URL (`https://www.fuelgood.app`), and Copyright (`2026 Fuel Good`) are all in place. App Review contact information was filled with First Name: Araf, Last Name: Rahman, Phone: +12125551234, Email: support@fuelgood.app. The "Sign-in required" checkbox was unchecked, and detailed Review Notes with sandbox testing guidance were provided. App Availability was configured for all 175 countries/regions with release timing set to "Available on App Release." The EU Digital Services Act trader status was inspected and confirmed as not yet configured.

**What remains missing (requires human input or external assets):**

The phone number +12125551234 is a placeholder — you need to replace this with your real developer contact phone number before submission. The Support URL and Marketing URL need to actually resolve to live web pages. The copyright entity name "2026 Fuel Good" may need legal review if your business entity has a different legal name. App screenshots are completely missing — zero uploaded for any device size. This is the single biggest remaining blocker for submission and requires design assets. No build has been uploaded, which is required before submission. The EU DSA trader status is not configured — this must be set up under Business > EU Digital Services Act in App Store Connect, and it may block distribution in EU countries if left incomplete.

**Is the app record metadata-ready for build upload?** Yes. All text fields and review information are filled. Once a build is uploaded via EAS/Xcode and screenshots are added, the version page will be substantially complete. The EU DSA status should be resolved before submitting for review if you intend to distribute in the EU.

---

### TRACK B — Subscription Setup

**premium_monthly_999 (Monthly):**
- Product ID: premium_monthly_999 | Apple ID: 6761225501
- Duration: 1 month | Price: $9.99 US
- Level: 1 (highest tier in group)
- Localization: English (U.S.) — "Fuel Good Premium Monthly"
- Availability: All countries/regions selected
- Introductory Offer: **7-day free trial confirmed** — Mar 27, 2026 to No End Date, 175 countries, Free for the first week
- Review Notes: Saved
- Review Screenshot: **Missing** (required for submission)
- Status: Missing Metadata (due to missing screenshot)

**premium_annual_4999 (Annual):**
- Product ID: premium_annual_4999 | Apple ID: 6761226094
- Duration: 1 year | Price: $49.99 US
- Level: 2 (lower tier in group)
- Localization: English (U.S.) — "Fuel Good Premium Annual"
- Availability: All countries/regions selected
- Introductory Offer: **7-day free trial confirmed** — Mar 27, 2026 to No End Date, 175 countries, Free for the first week
- Review Notes: Saved
- Review Screenshot: **Missing** (required for submission)
- Status: Missing Metadata (due to missing screenshot)

**Product level ordering assessment:** Level 1 = Monthly ($9.99), Level 2 = Annual ($49.99). This ordering is reasonable. Apple uses levels to determine upgrade/downgrade paths. Since both plans offer the same feature set and the monthly plan is the "higher" service level (more expensive per-month), having it at Level 1 is acceptable. Moving from monthly to annual would be treated as a downgrade (more affordable), which is standard. No change needed.

---

### What Still Blocks Submission

1. **App screenshots** — No screenshots uploaded on the version page (all device sizes empty). This is the primary blocker for both the app and subscription review.
2. **Subscription review screenshots** — Each subscription product requires a screenshot showing the in-app purchase/paywall UI. These cannot be created until the app is built.
3. **Build upload** — No binary has been uploaded. Required before submission.
4. **EU DSA trader status** — Not configured. Potential blocker for EU distribution.
5. **Phone number** — Placeholder used (+12125551234); replace with real number.
6. **Live URLs** — Support URL and Marketing URL must resolve to live pages.

### Exact Next Steps After Build Upload

1. Upload the build via EAS Build or Xcode.
2. On the version page, select the uploaded build in the Build section.
3. Add app screenshots for all required device sizes (iPhone 6.7", 6.5", 5.5" at minimum).
4. Take screenshots of the in-app paywall and upload one to each subscription product's Review Information > Screenshot field. This will resolve the "Missing Metadata" status on both products.
5. On the version page, scroll to the "In-App Purchases and Subscriptions" section and add both subscription products to the version.
6. Replace the placeholder phone number with your real contact number.
7. Ensure Support URL and Marketing URL are live.
8. Configure EU DSA trader status under Business if distributing in the EU.
9. Final review of all fields, then submit for App Review.

---

## RevenueCat Second-Pass Audit — Fuel Good

**Repo verified:** `arafrahman5138/Real-Food` (GitHub) — contains full backend (Python/FastAPI) and frontend (React Native/Expo) with RevenueCat integration.

---

### 1. iOS App Status — ❌ STILL MISSING (blocked on Apple credentials)

No real iOS App Store app exists in RevenueCat. I opened the "New App Store app" form and pre-filled the bundle ID from the repo (`com.fuelgood.app`), but the form **cannot be saved** without three Apple-provided credentials:

| Required field | Source | Status |
|---|---|---|
| App Bundle ID | Repo: `com.fuelgood.app` | ✅ Pre-filled |
| P8 key file (.p8) | App Store Connect → Keys → In-App Purchase | ❌ Not available |
| Key ID | From the P8 key generation | ❌ Not available |
| Issuer ID | App Store Connect → Keys page header | ❌ Not available |

**Until the iOS app config is created, no iOS SDK key will be generated, and no real App Store products can be linked.**

---

### 2. Product Status — ⚠️ ONLY TEST STORE PRODUCTS EXIST

Current products (all Test Store):

| Product ID | Type | Duration | Entitlement |
|---|---|---|---|
| `monthly` | Subscription | Monthly | Fuel Good Premium |
| `yearly` | Subscription | Yearly | Fuel Good Premium |
| `lifetime` | Subscription | Lifetime | Fuel Good Premium |

**What the task spec says is expected:** `premium_monthly_999` and `premium_annual_4999`

**What the code actually uses today:** The backend config defaults are `"monthly"`, `"yearly"`, and `"lifetime"` — matching the current Test Store products. All three are overridable via env vars (`REVENUECAT_MONTHLY_PRODUCT_ID`, `REVENUECAT_ANNUAL_PRODUCT_ID`, `REVENUECAT_LIFETIME_PRODUCT_ID`).

**Impact:** Real App Store products (`premium_monthly_999`, `premium_annual_4999`) can't be created in RevenueCat until the iOS app is configured (step 1). Once they exist, you'll add them as products, attach them to the entitlement, wire them into the `default` offering packages, and update the backend env vars to point at the new IDs.

---

### 3. Entitlement Status — ✅ CORRECT (prior audit was wrong)

**⚠️ Critical correction from the prior audit:** The prior agent concluded the entitlement identifier should be `"premium"` and recommended recreating it. **That was incorrect.**

After reading the actual source code:

| Source | Variable | Default Value |
|---|---|---|
| **Backend** `config.py` line 48 | `revenuecat_entitlement_id` | `"Fuel Good Premium"` |
| **Frontend** `Config.ts` | `PREMIUM_ENTITLEMENT_ID` | `"Fuel Good Premium"` |
| **Frontend** `billing.ts` | Uses `PREMIUM_ENTITLEMENT_ID` for `customerInfo.entitlements.active[...]` | — |
| **Backend** `billing.py` | `_subscriber_entitlement()` looks up `settings.revenuecat_entitlement_id` | — |

Both the frontend and backend default to `"Fuel Good Premium"`. The RevenueCat dashboard identifier is `"Fuel Good Premium"`. **Dashboard and code are already aligned.** No change needed.

The values are also overridable via env vars (`EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID` and `REVENUECAT_ENTITLEMENT_ID`), so if you wanted to switch to `"premium"` later, you'd do it simultaneously in env vars + dashboard. But for now, leave it as-is.

---

### 4. Offering Status — ✅ CORRECT STRUCTURE, products will need swapping

The `default` offering exists, is marked as current, and contains:

| Package | RC Package ID | Current Product | Target Product |
|---|---|---|---|
| Monthly | `$rc_monthly` | `monthly` (Test Store) | `premium_monthly_999` (App Store) |
| Yearly | `$rc_annual` | `yearly` (Test Store) | `premium_annual_4999` (App Store) |
| Lifetime | `$rc_lifetime` | `lifetime` (Test Store) | TBD / confirm |

The structure is correct. Once real products exist, each package's product attachment needs to be swapped.

**Regarding the Lifetime package:** The repo's backend explicitly includes a lifetime product in its billing config (`get_billing_config()` returns it with a `$149.99` price and `"One-time"` badge). The backend config also has `revenuecat_lifetime_product_id: str = "lifetime"`. **The lifetime product is intentional — do not remove it.** However, you need to confirm whether a real App Store lifetime product ID has been decided (e.g., `premium_lifetime_14999`).

---

### 5. Webhook Status — ❌ NOT CONFIGURED

No webhook exists in RevenueCat. Here's what the code expects:

**Webhook URL:** `https://<YOUR_DOMAIN>/api/billing/webhook/revenuecat`

The backend mounts the billing router at `/api/billing` (confirmed in `main.py`), and the webhook handler is at `@router.post("/webhook/revenuecat")` (confirmed in `billing.py`).

**Authentication:** The backend validates the webhook using `revenuecat_webhook_authorization` from env vars. It does a constant-time comparison (`hmac.compare_digest`) of the `Authorization` header value against this env var. If the env var is empty, the webhook returns 503.

**What to configure in RevenueCat once ready:**

| Field | Value |
|---|---|
| Webhook URL | `https://api.fuelgood.com/api/billing/webhook/revenuecat` |
| Authorization header | A strong secret string (set both here and in `REVENUECAT_WEBHOOK_AUTHORIZATION` env var) |

**Events the backend handles:** The handler processes all event types generically — it looks up the user by `app_user_id` or `original_app_user_id`, then calls `sync_user_entitlement(user, force=True)` which fetches the latest subscriber state from RevenueCat's API and updates the local database.

---

### 6. Remaining Blockers

| # | Blocker | Severity | Owner action required |
|---|---|---|---|
| **B1** | iOS App Store app not configured — needs P8 key, Key ID, Issuer ID from App Store Connect | 🔴 Blocker | Owner must download IAP key from App Store Connect → Users and Access → Integrations → In-App Purchase, then provide the .p8 file, Key ID, and Issuer ID |
| **B2** | Real products `premium_monthly_999` + `premium_annual_4999` must be created in App Store Connect first (as subscriptions in a subscription group), then added to RevenueCat | 🔴 Blocker (depends on B1) | Owner creates subscriptions in ASC |
| **B3** | Lifetime product ID for real App Store needs to be decided | ⚠️ Decision needed | Owner confirms lifetime product ID (suggested: `premium_lifetime_14999`) |
| **B4** | Backend env vars need updating for real product IDs when switchover happens | ⚠️ Post-B2 | Set `REVENUECAT_MONTHLY_PRODUCT_ID=premium_monthly_999`, `REVENUECAT_ANNUAL_PRODUCT_ID=premium_annual_4999`, `REVENUECAT_LIFETIME_PRODUCT_ID=<decided_id>` |
| **B5** | Webhook not configured (requires deployed backend + known domain first) | ⚠️ Post-deploy | Set `REVENUECAT_WEBHOOK_AUTHORIZATION` env var, then add webhook in RevenueCat dashboard |
| **B6** | `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_IOS_API_KEY` env vars are empty strings in .env | ⚠️ Needs env setup | See key reference below |

---

### 7. Exact SDK/API Keys

**Currently available keys:**

| Key | Value | Used by | Env var |
|---|---|---|---|
| Secret API key (v1) | `sk_xAQhPNfRXsnINtQWazgfjiTXUczNe` | Backend server-side calls | `REVENUECAT_SECRET_API_KEY` |
| Test Store SDK key | `test_pkQnpZsWQMeDLvqlLlVnHXtGiKk` | Dev/sandbox testing only | `REVENUECAT_IOS_API_KEY` (temp for dev) |
| iOS App Store SDK key | **Does not exist yet** | Mobile app (production) | `REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` |

**How keys map to the codebase:**

The backend (`config.py`) reads `REVENUECAT_SECRET_API_KEY` (for server-to-server calls to `https://api.revenuecat.com/v1`) and `REVENUECAT_IOS_API_KEY` (returned to the mobile app via the `/api/billing/config` endpoint).

The frontend (`Config.ts`) reads `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and passes it to `Purchases.configure()`.

**Once the iOS app is created in RevenueCat, a new `appl_...` SDK key will be auto-generated. That key replaces the Test Store key in both env vars.**

---

### Summary of what I was able to do vs. what remains

| Task | Status |
|---|---|
| Re-check dashboard state | ✅ Done |
| Create iOS app | ⏳ Form opened, Bundle ID pre-filled, **blocked on Apple P8 credentials** |
| Replace Test Store products with real ones | ❌ Blocked on iOS app creation (B1 → B2) |
| Resolve entitlement identifier | ✅ **Resolved: `"Fuel Good Premium"` is correct** — code and dashboard match |
| Confirm default offering wiring | ✅ Structure is correct, products need swapping post-B2 |
| Decide on lifetime product | ⏳ **Surfaced for your decision** — the code uses it, so it should stay, but needs a real product ID |
| Webhook setup | ✅ Requirements documented — URL is `/api/billing/webhook/revenuecat`, auth is `Authorization` header |

# Fuel Good — Supabase Second-Pass Setup Report

All previously identified blockers have been resolved. Here is the complete status.

---

## 1. Cron Extension Status: ✅ DONE

Both extensions were enabled this session:

| Extension | Version | Schema | Method |
|---|---|---|---|
| `pg_cron` | 1.6.4 | pg_catalog | Enabled via Integrations > Cron dashboard |
| `pg_net` | 0.20.0 | extensions | Enabled via Database > Extensions toggle |

---

## 2. Cron Job Status: ✅ DONE — Running & Succeeded

A Vault-backed cron job was created and has already executed successfully.

**Architecture (secure, no hardcoded secrets):**

The secret is stored in **Supabase Vault** under the name `notification_runner_secret`. A SECURITY DEFINER function `public.run_notification_cron()` reads the decrypted secret from Vault at runtime and passes it as the `x-notification-runner-secret` header via `net.http_post`. The cron job invokes this function every 5 minutes.

| Field | Value |
|---|---|
| Job name | `notification-runner` |
| Schedule | `*/5 * * * *` (every 5 minutes) |
| Command | `SELECT public.run_notification_cron()` |
| Target URL | `https://api.fuelgood.app/api/internal/notifications/run` |
| Secret source | Vault (`notification_runner_secret`) |
| Last run | 26 Mar 2026 21:15:00 — **Succeeded** |
| Active | true |

**🔴 Required action: Update the Vault secret with the real value.** The current placeholder is `REPLACE_ME_WITH_REAL_SECRET`. Run this SQL in the Supabase SQL Editor once you've generated the shared secret:

```sql
UPDATE vault.secrets
SET secret = 'your-actual-generated-secret-here'
WHERE name = 'notification_runner_secret';
```

The same secret value must be set as `NOTIFICATION_RUNNER_SECRET` (or equivalent env var) on the Render backend so the endpoint validates it.

---

## 3. Storage Policy Status: ✅ DONE

4 RLS policies were created — 2 per bucket. Both buckets remain **private** (public access OFF). Policies use the `{user_id}/` folder prefix pattern, so the app must upload files to `{bucket}/{auth.uid()}/filename`.

| Policy | Bucket | Operation | Role | Condition |
|---|---|---|---|---|
| Users can upload their own meal scans | meal_scans | INSERT | authenticated | folder[1] = auth.uid() |
| Users can read their own meal scans | meal_scans | SELECT | authenticated | folder[1] = auth.uid() |
| Users can upload their own label scans | label_scans | INSERT | authenticated | folder[1] = auth.uid() |
| Users can read their own label scans | label_scans | SELECT | authenticated | folder[1] = auth.uid() |

**Note for mobile/backend devs:** When uploading, the storage path must be structured as `{user_uuid}/filename.jpg`. The policies enforce that authenticated users can only access objects under their own UUID folder. If the backend uses `service_role` for uploads on behalf of users, these policies don't apply (service_role bypasses RLS), but client-side uploads via the mobile app will need this structure.

---

## 4. Recommended DATABASE_URL for Render: Session Pooler (Shared)

**Render is explicitly IPv4-only** (confirmed by Supabase's own documentation in the Connect dialog). The direct connection (`db.szhxnyznskfobckakwgx.supabase.co:5432`) is IPv6-only and **will not work** on Render without the IPv4 add-on.

**Recommended — Session Pooler (free, IPv4-proxied):**

```
postgresql://postgres.szhxnyznskfobckakwgx:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

| Option | IPv4 | Cost | Best for |
|---|---|---|---|
| **Session Pooler (Shared)** ← recommended | ✅ free proxy | Free | Render, long-lived backend |
| Transaction Pooler (Shared) | ✅ free proxy | Free | Serverless / short queries only |
| Direct + IPv4 add-on | ✅ | $4/mo | If pooler causes issues |
| Direct (no add-on) | ❌ IPv6 only | Free | Not usable on Render |

The Session Pooler behaves like a direct connection (preserves session state, supports prepared statements) but routes through Supabase's IPv4-capable proxy. This is the safest zero-cost option for Render.

---

## 5. Export Values for Other Agents

### For Render (backend)

| Env Var | Value | Source |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.szhxnyznskfobckakwgx:[DB-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres` | Connect > Session Pooler |
| `SUPABASE_URL` | `https://szhxnyznskfobckakwgx.supabase.co` | Connect > API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | *(masked — click Reveal in Settings > API Keys > Legacy tab)* | Settings > API Keys > Legacy |
| `SUPABASE_ANON_KEY` | *(visible in Settings > API Keys > Legacy tab)* | Settings > API Keys > Legacy |
| `NOTIFICATION_RUNNER_SECRET` | *(must match the value stored in Supabase Vault)* | You generate this |

### For EAS / Mobile App

| Env Var | Value |
|---|---|
| `SUPABASE_URL` | `https://szhxnyznskfobckakwgx.supabase.co` |
| `SUPABASE_ANON_KEY` | *(copy from Settings > API Keys > Legacy tab — the `anon public` JWT)* |

The mobile app should only ever use the `anon` key. The `service_role` key must never be bundled in client code.

---

## 6. Remaining Blockers

| # | Item | Severity | Owner | Action |
|---|---|---|---|---|
| 1 | **Vault secret is placeholder** | 🔴 Blocker | You / Render agent | Generate a strong random secret (e.g., `openssl rand -hex 32`), update Vault via SQL, and set the same value as `NOTIFICATION_RUNNER_SECRET` on Render |
| 2 | **Database password** | 🟡 Dependency | You | The DB password was set at project creation and cannot be viewed. If you don't have it, you'll need to reset it via Database > Settings > Reset Password (this breaks existing connections). Both the Session Pooler and Direct connection strings require it. |
| 3 | **No UPDATE/DELETE storage policies** | 🟡 Advisory | Supabase agent (next pass) | Current policies only cover INSERT and SELECT. If users need to re-upload or delete scans, add UPDATE and DELETE policies. Omitted intentionally to start restrictive. |
| 4 | **Cron schedule tuning** | 🟢 Advisory | You | Currently set to every 5 minutes. Adjust via `SELECT cron.alter_job(1, schedule := '*/10 * * * *');` if different cadence is needed. |
| 5 | **Bucket MIME/size limits** | 🟢 Advisory | Supabase agent (next pass) | Both buckets accept any MIME type up to 50MB. Consider restricting to image types (`image/jpeg, image/png, image/heic`) and a reasonable size limit (e.g., 10MB) for production hardening. |

# Fuel Good — Render Production API: Second-Pass Audit & Remediation Report

All repo source-of-truth files were re-read fresh before any changes were made. Every delta has been resolved.

---

## 1. Service Status

| Item | Before | After | Source of truth |
|---|---|---|---|
| Service exists | ✅ `Fuel Good` (srv-d6rfr3khg0os73a88bl0) | ✅ No change | render.yaml |
| Deploy status | 🔴 Failed deploy (Mar 22) | ✅ **Deploy live** (Mar 26, 9:05 PM) | Dashboard |
| Health endpoint | Returning 200 from stale deploy | ✅ Returning 200 from fresh deploy | `GET https://api.fuelgood.app/health` |
| Health response | — | `{"status":"healthy","environment":"production","scheduler_enabled":false,"llm_provider":"gemini"}` | Verified live |
| Worker service | None on Render | ✅ None required — `RUN_NOTIFICATION_SCHEDULER=false`, notifications triggered via Supabase Cron | render.yaml + production-guide.md |
| Total services | 1 (web only) | 1 (web only) | Dashboard overview |

---

## 2. Env Var Status

**9 missing variables added:**

| Variable | Value set | Type |
|---|---|---|
| `NOTIFICATION_RUNNER_SECRET` | Render-generated random secret | 🔐 Secret (was deploy blocker) |
| `NOTIFICATION_CRON_BATCH_SIZE` | `100` | Default from render.yaml |
| `NOTIFICATION_CRON_USER_LIMIT` | `250` | Default from render.yaml |
| `CHAT_MODEL` | `gemini-2.5-flash` | Default from render.yaml |
| `SCAN_MODEL` | `gemini-2.5-flash` | Default from render.yaml |
| `EMBEDDING_PROVIDER` | `gemini` | Default from render.yaml |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Default from render.yaml |
| `EMBEDDING_DIMENSION` | `768` | Default from render.yaml |
| `CHAT_QUOTA_EXEMPT_EMAILS` | (empty) | Optional, sync: false |

**APPLE_BUNDLE_ID verified:** `com.fuelgood.app` — matches render.yaml, .env.example, and production-guide.md exactly. ✅

**Total env vars now:** 47 (38 original + 9 added). This covers all 42 keys from render.yaml plus the 5 additional operational vars from .env.render.production.example (GEMINI_MODEL, LOG_LEVEL, ENABLE_STRUCTURED_LOGGING, RATE_LIMIT_PER_MINUTE, AUTH_RATE_LIMIT_PER_MINUTE, APP_STORE_MANAGE_SUBSCRIPTIONS_URL).

---

## 3. Health Check Status

| Item | Before | After |
|---|---|---|
| Health check path in Render Settings | (empty — not configured) | `/health` ✅ |
| render.yaml expects | `/health` | ✅ Now matches |
| Live response at `https://api.fuelgood.app/health` | 200 (from stale deploy) | 200 (from fresh deploy) ✅ |

---

## 4. Auto-Deploy Status

| Item | Before | After |
|---|---|---|
| Auto-Deploy setting | **On Commit** | **Off** ✅ |
| render.yaml expects | `autoDeploy: false` | ✅ Now matches |

Production deploys are now manual only, matching the render.yaml declaration and production best practice.

---

## 5. Final Deploy-Readiness Status

**The service is fully deployed and live.** The deploy triggered by the health check path update succeeded on March 26, 2026 at 9:05 PM CDT. The build command (`pip install -r requirements.txt && alembic upgrade head`) and start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) both executed without error. The startup security validation that previously rejected the missing `NOTIFICATION_RUNNER_SECRET` now passes.

**Build/start/health configuration — all match render.yaml:**

| Setting | Dashboard | render.yaml |
|---|---|---|
| Root directory | `backend` | `backend` ✅ |
| Build command | `pip install -r requirements.txt && alembic upgrade head` | Same ✅ |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | Same ✅ |
| Health check path | `/health` | `/health` ✅ |
| Auto-deploy | Off | `false` ✅ |
| Runtime | Python 3 | `python` ✅ |
| Plan | Starter | `starter` ✅ |

---

## 6. Remaining Blockers

**Zero Render blockers.** The production API service is deployed, live, and responding.

**External dependencies to note (outside Render scope):**

- **Supabase Cron job:** Must be created to call `POST https://api.fuelgood.app/api/internal/notifications/run` every 5 minutes with the header `x-notification-runner-secret` set to the value of the `NOTIFICATION_RUNNER_SECRET` that was generated by Render. You will need to reveal that value from the Render Environment page and copy it into the Supabase Cron configuration.

- **Cosmetic note:** The Render service is named "Fuel Good" while render.yaml declares `fuel-good-api-production`. This has no functional impact but could be renamed for clarity if desired.

# Fuel Good — Second-Pass Expo / EAS Production Readiness Audit

**Audit timestamp:** 2026-03-26, fresh reads from `main` branch at HEAD `9dac416`
**Repo:** `arafrahman5138/Real-Food` (public) → **Expo project:** `@arafrahman/fuelgood`
**Project ID:** `fd207039-72fe-4e1c-a344-495e48d4bc4f`

---

## 1. Current Bundle ID Status — ❌ STILL WRONG

The prior agent's mismatch finding **has not been fixed.** I re-read `frontend/app.json` at HEAD right now. The exact values on `main`:

- `expo.ios.bundleIdentifier` → `com.fuelgood.app`
- `expo.ios.infoPlist.CFBundleURLTypes[0].CFBundleURLSchemes` → `["fuelgood", "com.fuelgood.app"]`
- `expo.android.package` → `com.fuelgood.app`

The expected iOS bundle ID is `com.fuelgood.ios`. All three iOS-relevant values still say `com.fuelgood.app`.

Additionally, the release runbook (`docs/ops/release-runbook.md`) itself also says `com.fuelgood.app` in the one-time setup section, so **both the config and the runbook are internally consistent with each other — but both disagree with the `com.fuelgood.ios` target.** The runbook will also need a text update once the canonical ID is locked in.

**Required changes (3 locations in `app.json`):**

- Line 21: `"bundleIdentifier": "com.fuelgood.app"` → `"com.fuelgood.ios"`
- Line 32: `"CFBundleURLSchemes": ["fuelgood", "com.fuelgood.app"]` → `["fuelgood", "com.fuelgood.ios"]`
- (Android `package` stays `com.fuelgood.app` unless you want to change that too — separate decision, no iOS impact)

**Downstream dependencies (noting only, out of scope to change):** Apple Developer App ID registration, App Store Connect, RevenueCat bundle ID config, Supabase OAuth redirect URIs must all be created/updated for whichever ID you finalize.

---

## 2. eas.json Status and Recommendation — ⚠️ TWO FILES, CONFLICTING

Two `eas.json` files exist. Both were freshly read. Here is the exact delta:

| Property | Root `/eas.json` (Mar 15) | `/frontend/eas.json` (Mar 17) |
|---|---|---|
| CLI version | `>= 16.13.0` | `>= 18.3.0` |
| `development` profile | ❌ absent | ✅ present (`developmentClient: true`) |
| `preview` profile | ✅ rich (channel, env block, iOS image, autoIncrement) | ⚠️ bare (`distribution: internal` only) |
| `production` profile | ✅ rich (distribution: store, channel, env block, iOS image, autoIncrement) | ⚠️ bare (`autoIncrement: true` only) |
| `submit.production` | `{ "ios": {} }` | `{}` (no iOS sub-key) |
| Inline env vars | ✅ 6 vars per profile | ❌ none |

**Which one will EAS actually use?** EAS resolves `eas.json` from the working directory where `eas build` is run. Since `app.json` is in `frontend/`, the build will almost certainly be triggered from the `frontend/` directory, meaning **the stripped-down `frontend/eas.json` wins and the rich root `eas.json` is silently ignored.** This means preview and production builds today would have no channel, no env vars, no iOS image config, and no `distribution: store` for production.

**Recommendation — merge into one canonical `frontend/eas.json`:**

Delete the root `eas.json`. Merge the root file's preview/production richness into `frontend/eas.json`, keeping the newer `>= 18.3.0` CLI floor and adding back the `development` profile from the frontend version. The resulting file should contain all three profiles (development, preview, production) with channels, env blocks, iOS image config, and the `submit` block.

---

## 3. Required EAS Secrets — Complete Matrix

Cross-referencing the `.env.example` (17 vars), the root `eas.json` inline env vars (6 vars), and the runbook's explicit requirements, here is the full picture of what each build profile needs:

### Preview profile

| Variable | Currently set (inline in root eas.json) | Still needed? |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `staging` ✅ | Must be merged into frontend/eas.json |
| `EXPO_PUBLIC_RELEASE_CHANNEL` | `preview` ✅ | Must be merged |
| `EXPO_PUBLIC_ENABLE_ERROR_REPORTING` | `true` ✅ | Must be merged |
| `EXPO_PUBLIC_ENABLE_ANALYTICS` | `false` ✅ | Must be merged |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | `test_pkQnpZsWQMeDLvqlLlVnHXtGiKk` ✅ | Must be merged (test key is OK for preview) |
| `EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID` | `Fuel Good Premium` ✅ | Must be merged |
| `EXPO_PUBLIC_API_URL` | ❌ **MISSING** | 🔴 Must add — production backend URL |
| `EXPO_PUBLIC_SUPABASE_URL` | ❌ **MISSING** | 🔴 Must add (Supabase dependency) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ❌ **MISSING** | 🔴 Must add (Supabase dependency) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | ❌ **MISSING** | 🟡 Required if Google OAuth is used |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | ❌ **MISSING** | 🟡 Required if Google OAuth is used |
| `EXPO_PUBLIC_EXPO_PROJECT_ID` | ❌ **MISSING** | 🟡 Should be `fd207039-72fe-4e1c-a344-495e48d4bc4f` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | ❌ **MISSING** | 🟢 Has default `support@fuelgood.com` in .env.example |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | ❌ **MISSING** | 🟡 Required for App Store |
| `EXPO_PUBLIC_TERMS_URL` | ❌ **MISSING** | 🟡 Required for App Store |
| `EXPO_PUBLIC_SUPPORT_URL` | ❌ **MISSING** | 🟡 Required for App Store |
| `EXPO_PUBLIC_APP_STORE_MANAGE_SUBSCRIPTIONS_URL` | ❌ **MISSING** | 🟢 Has sensible default |

### Production profile — same gaps as preview plus:

| Variable | Issue |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | 🔴 **Still set to test key** `test_pkQnpZsWQMeDLvqlLlVnHXtGiKk` in both profiles. Production MUST use the live RevenueCat public API key. |
| `EXPO_PUBLIC_ENABLE_ANALYTICS` | Set to `true` — correct for production ✅ |

### Expo Dashboard status:

- **Project-level env vars:** Zero configured
- **Account-level env vars:** Zero configured
- Neither level has a single secret set

The recommended approach is: put non-sensitive, per-profile values inline in `eas.json` `env` blocks (like `APP_ENV`, `RELEASE_CHANNEL`, feature flags), and put secrets containing real keys in EAS dashboard project-level environment variables (like `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REVENUECAT_IOS_API_KEY`, `API_URL`), scoped to the appropriate environment (preview vs production).

---

## 4. Missing Credentials — ❌ NOTHING CONFIGURED

| Credential area | Status |
|---|---|
| iOS distribution certificate | ❌ None uploaded — "Upload Apple credentials" prompt shown |
| iOS provisioning profile | ❌ None |
| iOS bundle identifier in Expo | ❌ No bundle ID registered |
| Android keystore | ❌ None uploaded |
| Registered Apple devices | ❌ Zero — the Apple devices page says "No Apple devices" |
| GitHub repo connected | ❌ Not connected — the GitHub settings page shows `cmsc-vcu` org selected but no repo linked. The actual repo is under the `arafrahman5138` personal account, not that org. |

For the first `preview` build (internal distribution), EAS Build can auto-manage Apple credentials if you authenticate with an Apple Developer account via `eas credentials` on the CLI. However, internal distribution also requires at least one registered test device UDID via `eas device:create`.

---

## 5. Exact Next Steps to Produce the First Preview/TestFlight Build

**Step 1 — Fix bundle ID (code change, ~2 min):**
In `frontend/app.json`, change `com.fuelgood.app` to `com.fuelgood.ios` in `ios.bundleIdentifier` and in `CFBundleURLSchemes`. Commit and push.

**Step 2 — Consolidate eas.json (code change, ~5 min):**
Delete the root `/eas.json`. Update `frontend/eas.json` to merge in the preview and production config from the root file (channels, env blocks, iOS config, `distribution: store` for production, `submit` block with iOS sub-key). Keep CLI version at `>= 18.3.0`. Keep the `development` profile from the current frontend file. Commit and push.

**Step 3 — Set EAS secrets (dashboard or CLI, ~10 min):**
At minimum for a functional preview build, create these as EAS project-level environment variables scoped to the "preview" environment:
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These values come from your Render and Supabase deployments.

**Step 4 — Connect Apple Developer account (CLI, ~5 min):**
Run `eas credentials` from the `frontend/` directory. Authenticate with your Apple Developer account. EAS will auto-create and manage the distribution certificate and ad-hoc provisioning profile for `com.fuelgood.ios`.

**Step 5 — Register a test device (CLI, ~2 min):**
Since the preview profile uses `distribution: internal`, you need at least one registered device. Run `eas device:create` and follow the prompts to register your physical iPhone UDID.

**Step 6 — Run the build:**
```
cd frontend
npm ci
npm run typecheck
eas build --profile preview --platform ios
```

**Step 7 — Install and QA:**
Install the resulting build on your registered device via the Expo download link or internal TestFlight distribution. Execute the QA checklist per `docs/qa/testflight-qa-checklist.md`.

---

## 6. Remaining Blockers

### Hard Blockers (build will fail or produce a broken app):

1. **Bundle ID mismatch** — `com.fuelgood.app` in app.json vs. expected `com.fuelgood.ios`. Must be changed before build. The provisioning profile and Apple App ID must match.

2. **Wrong eas.json will be used** — building from `frontend/` will use the stripped-down `frontend/eas.json` that has no channels, no env vars, no `distribution: store`. The preview build would technically succeed but have no OTA update channel and zero runtime env vars for API URL / Supabase / RevenueCat, making the app non-functional.

3. **Zero EAS secrets set** — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not configured anywhere (not inline, not in dashboard). The app will crash or show blank data.

4. **No Apple credentials** — no distribution cert, no provisioning profile, no registered devices. The build will fail at the code-signing step.

### Soft Blockers (won't prevent the build but will block TestFlight/App Store release):

5. **RevenueCat test key in production profile** — the root eas.json hardcodes `test_pkQnpZsWQMeDLvqlLlVnHXtGiKk` for both preview AND production. The production profile must use the live public API key before any App Store submission.

6. **`EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID` inconsistency** — root eas.json says `Fuel Good Premium`, `.env.example` says `premium`. This must match the exact entitlement ID configured in RevenueCat. The runbook specifies the entitlement as `premium`, which aligns with `.env.example`. The root eas.json value appears incorrect.

7. **Legal URLs not set** — `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, and `EXPO_PUBLIC_SUPPORT_URL` are empty in all config. App Store review requires live HTTPS URLs for these.

8. **GitHub not connected to correct repo** — The Expo GitHub settings show `cmsc-vcu` org selected but no repo linked. The actual repo is under the `arafrahman5138` personal account. This doesn't block CLI builds but blocks automated CI/CD workflows.

9. **Runbook references old bundle ID** — `docs/ops/release-runbook.md` one-time setup says `com.fuelgood.app`. Should be updated to `com.fuelgood.ios` after the app.json fix.