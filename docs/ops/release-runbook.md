# Release Runbook

## Goal

Ship **iOS TestFlight first** with a reproducible path to production App Store release.

## Environments

| Environment | Mobile build profile | Backend target | Notes |
| --- | --- | --- | --- |
| Development | local Expo | local FastAPI | Developer workflow only |
| Preview | `eas build --profile preview --platform ios` | production backend by default | Internal TestFlight and QA |
| Production | `eas build --profile production --platform ios` | production backend | External TestFlight or App Store |

## Release Owners

- Engineering owner: prepares backend release, env vars, and EAS build.
- Product owner: approves App Store copy, screenshots, and legal docs.
- Ops owner: confirms Apple account, certificates, support inbox, and monitoring.

## One-Time Setup

1. Create or connect the Expo project to EAS.
2. Add Apple credentials and confirm `com.fuelgood.app`.
3. Configure EAS secrets for all `EXPO_PUBLIC_*` release variables.
4. Provision the production Render API and notification worker services. Add temporary staging only if you need a migration or notification rehearsal.
5. Create the production Supabase project, enable `pgvector`, create private `meal-scans` and `label-scans` Storage buckets, and enable Realtime for `food_logs`, `daily_nutrition_summary`, and `users`.
6. Publish privacy policy, terms, and support pages to public HTTPS URLs.
7. If monetization is included, create App Store subscription products. Do not use Stripe checkout for iOS digital access.
8. Create RevenueCat products and entitlement mapping:
   - entitlement: `premium`
   - offering: `default`
   - product ids: `premium_monthly_999`, `premium_annual_4999`
   - attach a `7-day` introductory free trial to both products in App Store Connect
9. Configure backend env vars for `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTHORIZATION`, product metadata, Supabase URL, service role key, and Supabase-backed `DATABASE_URL`.
10. Configure frontend release env vars for `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and legal/support URLs.
11. Register RevenueCat webhook delivery to the production `/api/billing/webhook/revenuecat` endpoint and verify the authorization header.

## Backend Release Procedure

1. Confirm `ENVIRONMENT=production`, strong `SECRET_KEY`, non-local `CORS_ALLOWED_ORIGINS`, `LLM_PROVIDER=gemini`, and `RUN_STARTUP_SEEDING=false`.
2. Run database migrations against Supabase Postgres.
3. Confirm RevenueCat API key, webhook authorization secret, product ids, and entitlement id are set in the backend environment.
4. Deploy API service with `RUN_NOTIFICATION_SCHEDULER=false`.
5. Deploy notification worker with `RUN_NOTIFICATION_SCHEDULER=true`.
6. Confirm `/health` returns `healthy` and correct environment.
7. Verify structured logs are visible in the hosting platform and notification worker heartbeat logs are present.

## iOS Preview Release Procedure

1. Set preview env vars and ensure the production backend is healthy unless you intentionally spun up temporary staging.
2. Run `cd frontend && npm ci && npm run typecheck`.
3. Run `eas build --profile preview --platform ios`.
4. Install build via internal TestFlight.
5. Execute [`docs/qa/testflight-qa-checklist.md`](../qa/testflight-qa-checklist.md).
6. Execute [`docs/qa/paywall-device-readme.md`](../qa/paywall-device-readme.md) for subscription-specific device validation.
7. Validate push opt-in, token registration, and one scheduled notification on a physical device.
8. Validate the paywall, monthly trial, annual trial, restore purchases, and App Store subscription management link.
9. Validate Supabase Storage uploads for meal scans and label scans, chronometer realtime refresh, and billing realtime refresh.

## Production Release Procedure

1. Confirm preview build passed on physical devices.
2. Confirm legal URLs and support inbox are live.
3. Confirm App Store metadata and screenshots are ready.
4. Confirm RevenueCat dashboard, webhook delivery, and entitlement mapping are live in production.
5. If monetization is enabled, confirm App Store subscription products, introductory trials, and review notes are configured.
6. Run `eas build --profile production --platform ios`.
7. Submit to TestFlight or App Store.
8. Watch logs, telemetry, webhook delivery, push delivery logs, and support email for the first 24 hours.

## Rollback

1. If backend issues occur, roll back the backend deployment first.
2. If mobile-only regression is isolated, stop TestFlight rollout and expire the bad build.
3. Update support messaging and status page if an outage is user-visible.
