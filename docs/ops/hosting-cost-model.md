# Hosting and Cost Model

## Default Low-Cost Stack

- **Backend**: low-cost managed container/app platform.
- **Database**: low-cost managed PostgreSQL with backups.
- **Monitoring**: health check monitor plus platform logs.
- **Error tracking**: start with backend logs plus client telemetry endpoint; optionally layer a third-party tool later.

Suggested starting vendors:
- Backend app platform: Render or Railway
- Database: Neon Postgres or the platform's managed PostgreSQL
- Uptime monitoring: Better Stack, UptimeRobot, or equivalent low-cost monitor

Before signing up, verify current pricing on official vendor pricing pages.

## AI Cost Model

Track three cost centers:

| Feature | Cost driver | Guardrail |
| --- | --- | --- |
| Meal scan | Image + prompt tokens | Daily per-user scan cap and timeout fallback |
| AI chat | Prompt + response tokens | Session-level message cap and aggressive timeout |
| Meal plan generation | Larger prompt/response payloads | Lower daily cap than chat |

## Budget Worksheet

Set and review monthly targets:

- Max infra budget: `$50-150/month` for early TestFlight and low traffic.
- Max AI cost per monthly active user: define after first real usage sample.
- Alert threshold: 70% of monthly AI budget.
- Hard cap response: tighten rate limits, disable high-cost flows, or switch to fallback mode.

## Payment Processing

Deferred until monetization is confirmed.

If subscriptions are added later:
- App Store IAP rules will apply on iOS.
- External payment processors should not be implemented until product and platform policy are final.
