# Render Deployment

## Services

Use four Render services defined in [`render.yaml`](/Users/arafrahman/Desktop/Real-Food/render.yaml):

- staging API web service
- staging notification worker
- production API web service
- production notification worker

The API service runs `uvicorn app.main:app`.  
The worker runs `python run_notification_worker.py`.

## Required Environment Variables

Set these in both staging and production:

- `ENVIRONMENT`
- `DATABASE_URL`
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
- `EXPO_PUSH_ACCESS_TOKEN` if using Expo access-token-authenticated sends

Role-specific flags:

- API: `RUN_NOTIFICATION_SCHEDULER=false`
- Worker: `RUN_NOTIFICATION_SCHEDULER=true`
- Hosted envs: `RUN_STARTUP_SEEDING=false`

## Deploy Sequence

1. Provision managed Postgres.
2. Set all secrets in staging.
3. Deploy staging API and worker.
4. Confirm `GET /health` on staging returns `scheduler_enabled=false` and `llm_provider=gemini`.
5. Run hosted smoke test:
   `BASE_URL=https://<staging-api-host> MODE=health backend/scripts/smoke_test.sh`
6. Repeat for production after staging signoff.
