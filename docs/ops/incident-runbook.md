# Incident Runbook

## Auth Outage

Symptoms:
- Login failures
- Social sign-in failures
- Session refresh loops

Actions:
1. Check backend logs for `/api/auth/*` errors and request IDs.
2. Validate Apple and Google provider availability.
3. Confirm `SECRET_KEY`, OAuth IDs, and bundle ID alignment.
4. If production-only, compare staging env vars to production.
5. If rollback is faster than fix, revert backend to last known good release.

## AI Provider Outage

Symptoms:
- Scan failures
- Chat timeouts
- Meal plan generation delays

Actions:
1. Confirm AI provider status page.
2. Check rate limiting, key validity, and quota usage.
3. Switch to alternate provider only if already validated in staging.
4. Update support messaging if AI features are materially degraded.

## Client Crash/Error Spike

Symptoms:
- Increased `/api/telemetry/client-error` volume
- Support reports from the same screen or action

Actions:
1. Review telemetry event source, version, and release channel.
2. Correlate with backend `X-Request-Id` and request logs where applicable.
3. Reproduce on the same build/device class.
4. Pause external rollout if the issue blocks auth, onboarding, or scan flows.

## Production Rollback

1. Roll back backend deployment to previous image/revision.
2. If the issue is build-specific, expire the current TestFlight build and keep prior build active.
3. Verify `/health`, auth, scan, and chat smoke tests after rollback.
