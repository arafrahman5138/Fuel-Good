# Production Guide

## Hosted Setup

- Render `Starter` web service for the production API
- Supabase for production Postgres, Storage, Realtime, backups, and pgvector
- Vercel for the `fuelgood.app` marketing website and legal pages
- EAS `preview` -> production API by default
- EAS `production` -> production API
- Temporary staging is optional, not required

## Pre-Deployment Todo List

- Create the Supabase production project in the same region as Render.
- Enable Postgres `pgvector`.
- Create private Storage buckets `meal-scans` and `label-scans`.
- Enable Realtime for `food_logs`, `daily_nutrition_summary`, and `users`.
- Create the production Render API service from [`render.yaml`](/Users/arafrahman/Desktop/Fuel-Good/render.yaml).
- Point `api.fuelgood.app` at the production API service.
- Create a Supabase Cron job that calls `POST https://api.fuelgood.app/api/internal/notifications/run` every `5 minutes` with header `x-notification-runner-secret: <NOTIFICATION_RUNNER_SECRET>`.
- Only create temporary staging services if you need migration rehearsal or scheduled notification QA before release.

- Deploy the `fuelgood.app` website via Vercel:
  - Connect the GitHub repo and set the root directory to `website/`.
  - Set framework preset to Next.js.
  - Add environment variable `NEXT_PUBLIC_GA_ID` for Google Analytics if configured.
  - Add custom domain `fuelgood.app` in Vercel project settings.
  - Configure DNS: `fuelgood.app` A record or CNAME pointing to Vercel, `www.fuelgood.app` redirect to apex.
  - Vercel provides automatic HTTPS (required for `.app` TLD).
  - Verify `https://fuelgood.app`, `https://fuelgood.app/privacy`, `https://fuelgood.app/terms`, and `https://fuelgood.app/support` resolve correctly.

- Set backend production secrets:
  `DATABASE_URL`, `SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `LLM_PROVIDER=gemini`, `GOOGLE_API_KEY` or `GEMINI_API_KEY`, OAuth credentials, support/legal URLs, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_MEAL_SCANS_BUCKET`, `SUPABASE_STORAGE_LABEL_SCANS_BUCKET`, `SUPABASE_SIGNED_URL_TTL_SECONDS`, `NOTIFICATION_RUNNER_SECRET`, `NOTIFICATION_CRON_BATCH_SIZE`, `NOTIFICATION_CRON_USER_LIMIT`, and any Expo push token auth secret if used.
- Set hosted runtime flags:
  `RUN_NOTIFICATION_SCHEDULER=false`, `RUN_STARTUP_SEEDING=false`, `ALLOW_DEV_DB_BOOTSTRAP=false`.
- Set EAS secrets:
  `EXPO_PUBLIC_API_URL`, Google OAuth client IDs, legal/support URLs, `EXPO_PUBLIC_EXPO_PROJECT_ID`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Set RevenueCat secrets and identifiers:
  `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_IOS_API_KEY`, `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_ENTITLEMENT_ID`, `REVENUECAT_OFFERING_ID`, `REVENUECAT_MONTHLY_PRODUCT_ID`, `REVENUECAT_ANNUAL_PRODUCT_ID`, and `REVENUECAT_TRIAL_DAYS`.
- Set frontend RevenueCat env values in EAS:
  `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID`, and optionally `EXPO_PUBLIC_APP_STORE_MANAGE_SUBSCRIPTIONS_URL`.

- Confirm the Apple Developer account is active.
- Confirm bundle ID `com.fuelgood.ios` matches in Expo, Apple, and OAuth provider settings.
- Configure Sign in with Apple.
- Verify Google OAuth production credentials.
- In App Store Connect, create the auto-renewable subscription group and both products used by the app:
  monthly `premium_monthly_999` and annual `premium_annual_4999`.
- Attach the `7-day` free trial to both products in App Store Connect.
- Create the matching RevenueCat app, entitlement `premium`, current offering, and package mapping for the monthly and annual products.
- Register the RevenueCat webhook to the production billing endpoint:
  `/api/billing/webhook/revenuecat`.
- Set and verify the RevenueCat webhook authorization header value.

- Publish privacy policy, terms of service, and support pages over HTTPS.
  These are served by the Vercel-hosted website at `https://fuelgood.app/privacy`, `https://fuelgood.app/terms`, and `https://fuelgood.app/support`.
- Set backend legal URL env vars: `PRIVACY_POLICY_URL=https://fuelgood.app/privacy`, `TERMS_URL=https://fuelgood.app/terms`, `SUPPORT_URL=https://fuelgood.app/support`.
- Confirm the support inbox is monitored and receives email.
- Choose and configure the outbound email provider if launch requires transactional email notifications.
- Send real test emails and confirm delivery and reply handling.

- Run `alembic upgrade head` on production.
- Deploy the production API.
- Verify production `GET /health`.
- Trigger the Supabase Cron endpoint once manually and confirm the run summary looks sane.
- Run the hosted smoke test against production with [`backend/scripts/smoke_test.sh`](/Users/arafrahman/Desktop/Fuel-Good/backend/scripts/smoke_test.sh).

- Build the iOS preview app with EAS.
- Install the preview/TestFlight build on at least 2 physical iPhones.
- Verify email sign-in, Apple sign-in, Google sign-in, meal plans, scan flows, and Gemini-backed AI flows.
- Verify the paywall loads current RevenueCat offerings on iOS.
- Verify the monthly trial purchase flow.
- Verify the annual trial purchase flow.
- Verify restore purchases.
- Verify the App Store manage subscription link opens correctly.
- Verify entitlement sync updates the backend after purchase and restore.
- Verify expired or inactive accounts are sent back to the paywall.
- Verify push permission prompt, token registration, opt-out, and at least one event-triggered push.
- Verify Supabase-backed meal scan image storage, label scan image storage, signed URL access, chronometer realtime refresh, and billing realtime refresh.
- Validate one scheduled notification through the Supabase Cron endpoint before release.

- Confirm API logs and Supabase Cron execution logs are visible.
- Confirm Supabase DB logs and Storage logs are visible.
- Confirm RevenueCat webhook delivery succeeds in production.
- Confirm new purchases update user entitlement state in production without manual intervention.

- Finalize App Store icon, screenshots, subtitle, keywords, promotional text, and description.
- Keep iOS launch free unless Apple IAP is fully implemented for digital access.
- Build the iOS production app with EAS.
- Submit to TestFlight or the App Store.

- Monitor API health, cron-triggered notification runs, push delivery, email delivery, and support inbox for the first 24 hours.
