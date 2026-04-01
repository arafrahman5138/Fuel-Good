# Render Deployment

## Services

Use the production API service defined in [`render.yaml`](/Users/arafrahman/Desktop/Fuel-Good/render.yaml):

- production API web service

The API service runs `uvicorn app.main:app`.

Production is the default hosted environment. Create temporary staging services only when you need to rehearse risky migrations or validate notification behavior before release.

## Required Environment Variables

Set these in production:

- `ENVIRONMENT`
- `DATABASE_URL` using the Supabase direct or pooler Postgres connection string
- `SECRET_KEY`
- `CORS_ALLOWED_ORIGINS`
- `LLM_PROVIDER=gemini`
- `GOOGLE_API_KEY` or `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APPLE_BUNDLE_ID`
- `SUPPORT_EMAIL`
- `PRIVACY_POLICY_URL`
- `TERMS_URL`
- `SUPPORT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_MEAL_SCANS_BUCKET`
- `SUPABASE_STORAGE_LABEL_SCANS_BUCKET`
- `SUPABASE_SIGNED_URL_TTL_SECONDS`
- `NOTIFICATION_RUNNER_SECRET`
- `NOTIFICATION_CRON_BATCH_SIZE`
- `NOTIFICATION_CRON_USER_LIMIT`
- `EXPO_PUSH_ACCESS_TOKEN` if using Expo access-token-authenticated sends

Hosted env flags:

- API: `RUN_NOTIFICATION_SCHEDULER=false`
- Hosted envs: `RUN_STARTUP_SEEDING=false`, `ALLOW_DEV_DB_BOOTSTRAP=false`

## Deploy Sequence

1. Provision managed Postgres.
   Supabase is the default production database provider.
2. Set all production secrets.
3. Deploy the production API.
4. Configure Supabase Cron to call `POST /api/internal/notifications/run` every `5 minutes` with header `x-notification-runner-secret`.
5. Confirm `GET /health` returns `scheduler_enabled=false` and `llm_provider=gemini`.
6. Run the hosted smoke test:
   `BASE_URL=https://<production-api-host> MODE=health backend/scripts/smoke_test.sh`
7. In Supabase, create private buckets `meal-scans` and `label-scans`, enable Realtime for `food_logs`, `daily_nutrition_summary`, and `users`, and verify `pgvector` is enabled.
8. If needed, create temporary staging services for high-risk rehearsals only.
