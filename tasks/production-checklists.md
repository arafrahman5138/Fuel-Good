# Production Checklists — Fuel Good

Generated 2026-03-30 from codebase audit + industry research.

---

## Part 1: Vibe Coding Checklist

AI-generated code has a ~25-45% security flaw rate (GitClear/Veracode 2025). This checklist catches the patterns AI gets wrong most often.

### A. Code Quality & Integrity

- [ ] **Two-pass review on all AI-generated files**: Re-prompt the AI as a "Security Engineer" to review its own output — catches 60%+ of issues
- [ ] **Search for dead/orphaned code**: AI often generates endpoints, components, or utilities that were abandoned mid-iteration but never removed
- [ ] **Search for TODO/FIXME/HACK comments**: AI leaves placeholders it never comes back to — `grep -rn "TODO\|FIXME\|HACK\|XXX" backend/ frontend/`
- [ ] **Verify no console.log/print leaking sensitive data**: AI loves debug logging — `grep -rn "console.log\|console.warn\|print(" backend/ frontend/src/`
- [ ] **Check for hardcoded test values**: AI often leaves test emails, IDs, or mock data in production code paths
- [ ] **Verify error messages don't leak internals**: AI generates verbose error messages with stack traces, file paths, query details
- [ ] **Audit AI-added dependencies**: Every package AI pulled in — do you actually need it? Is it maintained? Any known CVEs?
- [ ] **Pin all dependency versions**: AI uses `^` and `~` ranges freely — lock them down before production
- [ ] **Run `npm audit` on frontend**: Zero high/critical vulnerabilities before ship
- [ ] **Run `pip audit` or `safety check` on backend**: Zero high/critical vulnerabilities before ship
- [ ] **Check for duplicate logic**: AI often reimplements the same thing in multiple places instead of reusing
- [ ] **Verify all async/await has error handling**: AI frequently generates unhandled promise rejections
- [ ] **Check for race conditions in state management**: AI-generated Zustand stores often have race conditions in async flows

### B. AI-Specific Gotchas

- [ ] **Verify no hallucinated package names**: AI sometimes imports packages that don't exist — they could be typosquatted on npm
- [ ] **Check for AI-generated comments that are wrong**: AI writes confident but incorrect comments — misleads future developers
- [ ] **Verify API response shapes match frontend expectations**: AI often generates mismatched types between backend schemas and frontend interfaces
- [ ] **Test all edge cases AI skipped**: AI handles the happy path well but misses: empty arrays, null values, network failures, expired tokens, deleted records
- [ ] **Verify no sensitive data in git history**: AI-assisted commits sometimes include secrets — run `git log --all --diff-filter=A -- "*.env"` to check

---

## Part 2: App Security Checklist

Specific to your stack: React Native/Expo + FastAPI + PostgreSQL + Supabase + RevenueCat.

### 1. CRITICAL — Do Before Launch

#### Secrets & Keys

- [ ] **ROTATE ALL API KEYS** — Your keys were in git history (commit `8aaf756`). Even though `.env` is now gitignored, anyone who cloned the repo has your keys:
  - Anthropic API key (`sk-ant-api03-...`)
  - Gemini/Google API key (`AIzaSy...`)
  - Google OAuth client secret (`GOCSPX-...`)
  - USDA API key
  - Expo push access token
  - RevenueCat secret API key (`sk_xAQ...`)
  - Resend API key (`re_j43...`)
- [ ] **Scrub git history** using BFG Repo Cleaner or `git filter-repo` to remove the old `.env` from all commits
- [ ] **Add pre-commit secret scanning hook** (e.g., `detect-secrets` or `gitleaks`) to prevent this from happening again
- [ ] **Verify `.env` is NOT in any git commit**: `git log --all --name-only | grep "\.env$"` should return nothing after cleanup
- [ ] **Verify production env vars are set in Render dashboard**, not in code — your `render.yaml` correctly uses `sync: false` for secrets

#### Authentication

- [ ] **Replace dev secret key**: `config.py` line 10 has `"dev-secret-key-change-in-production"` — production MUST use a 32+ char random key (your validation enforces this, but verify it's actually set)
- [ ] **Verify token refresh flow under real conditions**: Test what happens when access token expires mid-session
- [ ] **Test social auth (Google/Apple) end-to-end on production URLs**: OAuth redirect URIs must match production, not localhost
- [ ] **Verify password reset code doesn't leak in production**: Dev mode returns the code in the response (auth.py line 255) — confirm `ENVIRONMENT=production` is set in Render

#### Database

- [ ] **Enable Supabase RLS on all tables** — Currently NO RLS policies exist. Your app relies entirely on FastAPI middleware for authorization. If anyone gets the Supabase connection string, they bypass all access controls
  - Priority tables: `users`, `food_logs`, `chat_sessions`, `meal_plans`, `daily_nutrition_summary`
  - Every table with a `user_id` column needs: `USING (auth.uid() = user_id)` policy
- [ ] **Restrict direct database access** via Supabase Network Restrictions (Settings > Database > Network)
- [ ] **Enable SSL enforcement** on Supabase database connection

### 2. HIGH — Fix Before Public Launch

#### API Security

- [ ] **Restrict `/health` endpoint** — Currently exposes `environment`, `scheduler_enabled`, `llm_provider`, `startup_seeding_enabled` to anyone. Strip to just `{"status": "healthy"}` or add auth
- [ ] **Move rate limiting to Redis/external store** — Current in-memory rate limiter (main.py lines 231-304) resets on every server restart and doesn't work across multiple Render instances
- [ ] **Add per-user rate limits on expensive endpoints**: Image generation, AI scanning, recipe embedding, and chat are costly — rate limit per user, not just per IP
- [ ] **Validate file upload magic bytes** — Currently only checks `Content-Type` header which is trivially spoofed. Add actual file signature validation for image uploads (scan.py)
- [ ] **Verify CORS origins are set for production** — Default is localhost only (config.py line 17). Set `CORS_ALLOWED_ORIGINS` in Render to your actual production domains
- [ ] **Test webhook authentication**: Verify RevenueCat webhook `authorization` header matches what's configured in Render

#### Mobile App Security

- [x] **Token storage is secure** — Already using `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (authStore.ts). Well done
- [x] **No secrets in frontend code** — Verified. Only `EXPO_PUBLIC_*` variables exposed, all are safe public keys
- [x] **Supabase service_role key is backend-only** — Verified. Frontend only has anon key
- [ ] **Disable Android Auto Backup** — Prevents sensitive data from leaking to Google cloud backups. Add to `AndroidManifest.xml`: `android:allowBackup="false"`
- [ ] **Enable App Transport Security (ATS) for iOS** — Verify all API calls use HTTPS, no HTTP exceptions
- [ ] **Test deep links for open redirect vulnerabilities** — Verify URL scheme handlers validate destinations
- [ ] **Review Expo OTA updates security** — If using EAS Update, ensure update signing is enabled

#### Dependency Security

- [ ] **Run `npm audit --production`** in frontend/ and fix all high/critical
- [ ] **Run `pip audit`** in backend/ and fix all high/critical
- [ ] **Review `expo-auth-session` version** for known CVEs (you're on ^7.0.10)
- [ ] **Enable Dependabot or Renovate** on your GitHub repo for automated vulnerability alerts

### 3. MEDIUM — Fix Before Scaling

#### Data Privacy & Compliance

- [ ] **Implement account deletion** — Required by Apple App Store. Verify `/api/auth/account` DELETE endpoint works end-to-end (cascading deletes on all user data)
- [ ] **Configure Apple App Privacy labels** — Declare: health/fitness data, dietary info, purchase history, device identifiers
- [ ] **Configure Google Play Data Safety** — Same disclosures
- [ ] **Verify privacy policy covers**: AI processing of food photos, Supabase storage of images, RevenueCat subscription data, push notification tokens
- [ ] **Add data export endpoint** — GDPR right to data portability
- [ ] **Verify food scan images have retention policy** — Are Supabase `meal-scans` bucket images deleted after a period, or stored forever?

#### Error Handling & Monitoring

- [ ] **Set up Sentry (or equivalent)** for both frontend and backend crash reporting
- [ ] **Verify production error responses are generic**: No stack traces, no file paths, no SQL queries
- [ ] **Add health check monitoring** — Uptime alerts on your Render service
- [ ] **Set up alerting on high error rates** — Catch issues before users report them

#### RevenueCat Specific

- [ ] **Enable Trusted Entitlements** — Cryptographically verifies subscription status responses haven't been tampered with (requires iOS SDK 4.25.0+, Android SDK 6.6.0+)
- [ ] **Check `VerificationResult` in code** — The SDK does NOT auto-reject failed verifications; you must handle it
- [ ] **Enable 2FA on all RevenueCat collaborator accounts**
- [ ] **Verify production RevenueCat API key** — You're currently using test key (`test_pkQnp...`) in frontend. Switch to production key before launch
- [ ] **Never put RevenueCat secret key in frontend** — Verified safe, but re-check after any billing code changes

#### Infrastructure

- [ ] **Upgrade from Supabase Free Plan** — Free tier pauses after inactivity, which would kill your app in production
- [ ] **Enable Supabase Point-in-Time Recovery (PITR)** if database grows past 4GB
- [ ] **Configure automated database backups** and test restore
- [ ] **Set up separate staging environment** on Render for testing before production deploys

### 4. LOW — Good Hygiene

- [ ] **Add Content-Security-Policy header** to backend responses (defense-in-depth)
- [ ] **Consider shortening refresh token TTL** — Currently 30 days. 7-14 days with rotation is safer
- [ ] **Implement token revocation** — Currently no way to force-logout a user
- [ ] **Increase password reset code entropy** — Currently 6-digit numeric (~1M combinations). Consider 8-char alphanumeric
- [ ] **Add request logging with correlation IDs** for debugging production issues
- [ ] **Implement SSL certificate pinning** for critical API connections (prevents MITM)
- [ ] **Add CAPTCHA to signup/login** if you see bot abuse
- [ ] **Review Supabase Realtime subscriptions** — Ensure no sensitive data leaks through broadcast channels

---

## Quick Reference: What's Already Secure

These were verified during the audit — no action needed:

| Area | Status | Details |
|------|--------|---------|
| Token storage | Secure | `expo-secure-store` with keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| Frontend secrets | Clean | Only `EXPO_PUBLIC_*` vars exposed, all safe |
| Supabase service key | Backend-only | Frontend uses anon key only |
| SQL injection | Protected | SQLAlchemy ORM with parameterized queries throughout |
| Password hashing | Strong | bcrypt with 12 rounds |
| CORS (config) | Restrictive | Localhost-only default, production validation exists |
| Security headers | Good | HSTS, X-Frame-Options, nosniff, referrer-policy all set |
| Webhook auth | Proper | HMAC constant-time comparison on RevenueCat + notification webhooks |
| JWT implementation | Solid | Proper signing, expiration, user validation |
| File upload limits | Enforced | 8MB max, MIME whitelist, empty file check |

---

## Sources

- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Vibe Coding Master Checklist](https://supabase.com/blog/the-vibe-coding-master-checklist)
- [OWASP Mobile Application Security](https://mas.owasp.org/)
- [React Native Security Docs](https://reactnative.dev/docs/security)
- [RevenueCat Trusted Entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements)
- [Invicti Vibe Coding Security Checklist](https://www.invicti.com/blog/web-security/vibe-coding-security-checklist-how-to-secure-ai-generated-apps)
- [astoj/vibe-security GitHub](https://github.com/astoj/vibe-security)
- [Fingerprint Vibe Coding Security Checklist](https://fingerprint.com/blog/vibe-coding-security-checklist/)
- [Cloud Security Alliance Secure Vibe Coding Guide](https://cloudsecurityalliance.org/blog/2025/04/09/secure-vibe-coding-guide)
- [Palo Alto Unit 42 Securing Vibe Coding Tools](https://unit42.paloaltonetworks.com/securing-vibe-coding-tools/)
