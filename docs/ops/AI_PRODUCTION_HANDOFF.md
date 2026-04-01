# Fuel Good Production Handoff

## Goal
Take Fuel Good from the current repo state to a production-ready iOS/TestFlight launch setup.

## Current Production Architecture
- API hosting: Render web service
- Database / storage / realtime / cron: Supabase
- Website / legal pages: Vercel at `fuelgood.app`
- Mobile builds: Expo + EAS
- iOS bundle ID: `com.fuelgood.ios`
- Android package: `com.fuelgood.app`
- Notifications: Supabase Cron calls the Render API endpoint
- Billing: RevenueCat + App Store subscriptions

## Repo References
- Production checklist: [production-guide.md](/Users/arafrahman/Desktop/Fuel-Good/docs/ops/production-guide.md)
- Release runbook: [release-runbook.md](/Users/arafrahman/Desktop/Fuel-Good/docs/ops/release-runbook.md)
- Render blueprint/env defaults: [render.yaml](/Users/arafrahman/Desktop/Fuel-Good/render.yaml)
- Backend production env template: [backend/.env.render.production.example](/Users/arafrahman/Desktop/Fuel-Good/backend/.env.render.production.example)
- Expo app config: [app.json](/Users/arafrahman/Desktop/Fuel-Good/frontend/app.json)

## Non-Negotiables
- Do not change the iOS bundle ID from `com.fuelgood.ios`
- Do not reintroduce a dedicated Render notification worker
- Use Supabase Cron for scheduled notification runs
- Keep app infra aligned with:
  - `api.fuelgood.app`
  - `fuelgood.app`
- Do not replace Apple IAP with Stripe for iOS digital access
- Do not make destructive infra changes without explicit confirmation

## Phase 1: Apple / App Store Connect

### 1. Apple Developer
Confirm:
- App ID exists for `com.fuelgood.ios`
- Capabilities enabled:
  - `Push Notifications`
  - `Sign in with Apple`

If missing:
- create or fix them in Apple Developer portal

### 2. App Store Connect
Create or confirm:
- app record using bundle ID `com.fuelgood.ios`
- app name chosen for store listing
- pricing set to `Free`

### 3. Subscriptions
Create:
- subscription group for premium access
- products:
  - `premium_monthly_999`
  - `premium_annual_4999`

Attach:
- `7-day` free trial to both if still intended

### 4. App metadata
Prepare or confirm:
- app name
- subtitle
- description
- keywords
- screenshots
- support URL
- privacy policy URL
- terms URL

## Phase 2: RevenueCat

### 5. RevenueCat app setup
Create or confirm:
- iOS app in RevenueCat tied to the correct App Store app
- entitlement:
  - `premium`
- offering:
  - `default`

Map products:
- `premium_monthly_999`
- `premium_annual_4999`

### 6. RevenueCat webhook
Configure webhook to:
- `POST /api/billing/webhook/revenuecat` on production API

Set:
- `REVENUECAT_WEBHOOK_AUTHORIZATION`

Verify:
- webhook authorization matches backend env
- webhook deliveries succeed

## Phase 3: Supabase Production

### 7. Supabase project
Create or confirm:
- production project in same region as Render

### 8. Database / extensions
Enable:
- `pgvector`

### 9. Storage
Create private buckets:
- `meal-scans`
- `label-scans`

### 10. Realtime
Enable Realtime for:
- `food_logs`
- `daily_nutrition_summary`
- `users`

### 11. Cron for notifications
Create a Supabase Cron job that calls:
- `POST https://api.fuelgood.app/api/internal/notifications/run`

Header required:
- `x-notification-runner-secret: <NOTIFICATION_RUNNER_SECRET>`

Cadence:
- every 5 minutes

### 12. Supabase values to collect
Collect:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- anon key for frontend

## Phase 4: Render Production API

### 13. Render service
Create or confirm:
- `fuel-good-api-production`

Use config from:
- [render.yaml](/Users/arafrahman/Desktop/Fuel-Good/render.yaml)

### 14. Backend production env vars
Set all required values from:
- [backend/.env.render.production.example](/Users/arafrahman/Desktop/Fuel-Good/backend/.env.render.production.example)

Critical vars:
- `DATABASE_URL`
- `SECRET_KEY`
- `CORS_ALLOWED_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATION_RUNNER_SECRET`
- `NOTIFICATION_CRON_BATCH_SIZE`
- `NOTIFICATION_CRON_USER_LIMIT`
- `GOOGLE_API_KEY`
- `APPLE_BUNDLE_ID=com.fuelgood.ios`
- RevenueCat keys
- support/legal URLs

### 15. Domain
Configure:
- `api.fuelgood.app` -> Render API service

Verify:
- TLS works
- `/health` returns healthy

### 16. Migrations
Run:
- `alembic upgrade head`

against production Supabase Postgres

## Phase 5: Website / Legal

### 17. Vercel site
Deploy website from:
- `website/`

Attach:
- `fuelgood.app`

### 18. Verify legal/support pages
Confirm these resolve publicly:
- `https://fuelgood.app/privacy`
- `https://fuelgood.app/terms`
- `https://fuelgood.app/support`

### 19. Backend legal URLs
Confirm backend env uses:
- `PRIVACY_POLICY_URL=https://fuelgood.app/privacy`
- `TERMS_URL=https://fuelgood.app/terms`
- `SUPPORT_URL=https://fuelgood.app/support`

## Phase 6: EAS / Frontend Release Config

### 20. Expo / EAS config
Confirm current iOS bundle ID in repo:
- `com.fuelgood.ios`

File:
- [app.json](/Users/arafrahman/Desktop/Fuel-Good/frontend/app.json)

### 21. EAS secrets / env vars
Set:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID`
- legal/support URLs
- `EXPO_PUBLIC_EXPO_PROJECT_ID` if required in release workflow

### 22. OAuth
Confirm production credentials for:
- Apple sign-in
- Google sign-in

Ensure they match:
- `com.fuelgood.ios`

## Phase 7: Production Verification

### 23. Backend verification
Verify:
- `GET /health`
- API logs visible
- Supabase logs visible
- RevenueCat webhook succeeds
- manual cron-triggered notification run succeeds

### 24. Core app verification on device
Use at least 2 physical iPhones and test:
- sign up / sign in
- Apple sign-in
- Google sign-in
- meal plans
- scans
- AI flows
- push permission + token registration
- scheduled notification via cron
- paywall loads
- monthly purchase
- annual purchase
- restore purchases
- entitlement sync
- manage subscription link

### 25. Storage / realtime verification
Verify:
- meal scan uploads to `meal-scans`
- label scan uploads to `label-scans`
- signed URLs work
- chronometer realtime refresh works
- billing/subscription realtime refresh works

## Phase 8: TestFlight / Submission

### 26. Preview build
Run:
- `eas build --profile preview --platform ios`

Install via TestFlight and validate all flows

### 27. Production build
After preview passes:
- `eas build --profile production --platform ios`

### 28. Submit
Submit to:
- internal TestFlight first
- external TestFlight or App Store after validation

## Deliverables Expected From The AI Agent
The agent should return:

1. A status table of each production area:
- Apple
- App Store Connect
- RevenueCat
- Supabase
- Render
- Vercel
- EAS
- Device QA

2. A list of missing secrets or credentials still needed

3. A list of tasks completed vs blocked

4. Exact values or IDs created:
- bundle ID
- subscription product IDs
- RevenueCat entitlement or offering
- Supabase project URL
- Render API URL
- App Store app record name

5. Final go or no-go launch recommendation

## Stop Conditions / Escalate To Human
The agent should stop and ask for human input if:
- App Store name is rejected and branding decision is needed
- bundle ID mismatch appears across Apple, Expo, OAuth, or RevenueCat
- RevenueCat product IDs need to change
- legal URLs are not live
- Apple sign-in or push requires credentials the agent cannot access
- a destructive infra change is required
- App Review or privacy answers require legal or product judgment

## Recommended Execution Order
1. Apple Developer
2. App Store Connect
3. RevenueCat
4. Supabase
5. Render
6. Vercel legal pages
7. EAS secrets
8. device QA
9. TestFlight build
10. production build and submission

## Ready-Made Assignment Prompt For The AI Agent

```text
You are taking over Fuel Good production launch setup.

Goal:
Get the app production-ready for iOS/TestFlight using the existing stack.

Stack:
- Render API
- Supabase Postgres/Storage/Realtime/Cron
- Vercel website at fuelgood.app
- Expo/EAS mobile app
- RevenueCat billing
- iOS bundle ID: com.fuelgood.ios

Repo references:
- docs/ops/production-guide.md
- docs/ops/release-runbook.md
- backend/.env.render.production.example
- render.yaml
- frontend/app.json

Rules:
- Do not change the iOS bundle ID
- Do not add a dedicated notification worker
- Use Supabase Cron for notifications
- Do not replace Apple IAP with Stripe for iOS digital access
- Avoid destructive infra changes without confirmation

Tasks:
1. Audit production readiness across Apple, App Store Connect, RevenueCat, Supabase, Render, Vercel, and EAS
2. List exactly what is already configured vs missing
3. Configure what can be configured safely
4. Surface blockers that need human credentials or decisions
5. Return a final status report with go/no-go recommendation

Deliverables:
- completed tasks
- remaining tasks
- missing secrets or credentials
- current production risks
- recommended next actions in priority order
```
