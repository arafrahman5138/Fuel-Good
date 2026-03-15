# Production Readiness Checklist

Status legend: `Present`, `Partial`, `Missing`, `Deferred`, `Blocked`

## App Store Assets

| Item | Status | Owner | Blocker | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| 1024x1024 app icon, no transparency | Partial | Product/Design | Final export not verified | Final source asset exported and checked in release folder |
| iPhone screenshots | Missing | Product/Design | Need TestFlight build | Screenshots captured for required App Store sizes |
| iPad screenshots | Missing | Product/Design | Need tablet layout verification | Screenshots captured or iPad support removed before release |
| App description, subtitle, keywords, promo text | Partial | Product | Final copy approval | Metadata doc approved and under App Store limits |
| Privacy policy URL live | Missing | Ops/Product | Hosting target needed | Public HTTPS URL reachable |
| Terms of service URL live | Missing | Ops/Product | Hosting target needed | Public HTTPS URL reachable |
| Support email monitored | Partial | Ops | Mailbox routing not documented | Inbox tested with a real inbound message |

## Technical Setup

| Item | Status | Owner | Blocker | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| Frontend env contract | Present | Engineering | None | `frontend/.env.example` maintained and used in EAS |
| Backend production env contract | Present | Engineering | None | `backend/.env.example` lists production-required variables |
| Render service manifest | Present | Engineering | Render account/project setup | `render.yaml` defines staging/production API + worker roles |
| EAS build profiles | Present | Engineering | Apple account/EAS project setup | `eas.json` supports preview and production |
| CI checks | Present | Engineering | GitHub secrets if later needed | Workflow runs backend compile, frontend typecheck, Expo config validation |
| Structured backend logging | Present | Engineering | None | JSON request logs with request IDs emitted in production |
| Mobile error reporting path | Present | Engineering | None | Global JS errors and API 5xxs are posted to backend telemetry |
| Third-party SDK inventory | Present | Engineering | Ongoing maintenance | Inventory doc tracks approved SDKs and update policy |
| Notification worker separation | Present | Engineering | Render worker setup | Scheduler runs in dedicated worker, not API replicas |
| TestFlight on real devices | Missing | QA/Product | Apple account, signed build | Internal TestFlight smoke suite completed on at least 2 physical iPhones |
| Memory/performance review | Missing | Engineering | TestFlight build needed | Scan, chat, and main navigation flows reviewed on device |

## Legal and Compliance

| Item | Status | Owner | Blocker | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| Privacy policy draft | Present | Product/Legal | Needs public hosting | Markdown policy approved and published |
| Terms of service draft | Present | Product/Legal | Needs public hosting | Markdown terms approved and published |
| Wellness-only disclaimer | Partial | Product/Engineering | In-app surface not added beyond docs/settings links | Disclaimer wording aligned across app, policy, and store copy |
| App Store privacy questionnaire | Present | Product/Ops | Final vendor list and URLs | Questionnaire doc completed and used during App Store Connect setup |
| Age rating review | Present | Product | Final App Store Connect entry | Age-rating guidance documented |
| COPPA review | Deferred | Product | Not targeting kids | Reopen only if product direction changes |

## Developer Accounts and Release Ownership

| Item | Status | Owner | Blocker | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| Apple Developer Program active | Blocked | Founder/Ops | External payment | Account is active and Team access granted |
| Google Play Console active | Deferred | Founder/Ops | Android not in first milestone | Required before Android release work starts |
| Bundle ID consistent across app, Apple services, OAuth | Partial | Engineering | Final Apple/OAuth console validation | Bundle ID matches `com.fuelgood.app` everywhere |
| Certificates/profiles ownership | Missing | Ops | Apple account access | Release runbook documents owner and renewal checks |

## Cost and Operations

| Item | Status | Owner | Blocker | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| Low-cost hosting decision | Present | Engineering/Ops | Final vendor signoff | Cost model selects low-cost managed app platform and DB |
| Backups and restore process | Present | Engineering/Ops | Hosting vendor setup | Backup/restore runbook completed and tested |
| Uptime monitoring | Partial | Ops | Monitor account setup | `/health` endpoint monitored and alert routing tested |
| Incident runbook | Present | Engineering/Ops | None | Auth outage, AI outage, and rollback procedures documented |
| AI cost model | Present | Product/Engineering | Update with current provider prices before launch | Per-feature usage assumptions and monthly caps documented |
| Payment processing | Deferred | Product | Monetization unconfirmed | If enabled for iOS digital access, use App Store IAP rather than Stripe checkout |

## Release Gates

- `preview` EAS build succeeds and installs on physical iPhones.
- Privacy policy, terms, and support contact are publicly reachable.
- Apple Sign-In, Google Sign-In, email auth, scan flows, and AI chat pass the TestFlight checklist.
- Push token registration, one scheduled notification, and one event-triggered notification pass on TestFlight.
- Backend boots with production env validation and emits structured logs.
- Backup restore drill has been completed once on the production database vendor.
