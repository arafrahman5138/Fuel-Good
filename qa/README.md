# Physical Device QA Suite

This folder is for release checks that require a real phone or TestFlight/dev build behavior. It intentionally excludes flows we can cover with local unit tests, simulator-only checks, or normal browser/manual API testing.

Run these files before every production candidate:

1. `device-test-matrix.md`
2. `device-auth-and-session.md`
3. `device-paywall-and-billing.md`
4. `device-camera-and-media.md`
5. `device-notifications-and-deeplinks.md`
6. `device-lifecycle-network-and-links.md`
7. `release-signoff-template.md`

Minimum hardware coverage:

- 2 physical iPhones
- 1 current iOS version, 1 previous supported iOS version
- 1 clean install path
- 1 upgrade/reinstall path
- 1 Sandbox Apple ID for StoreKit
- 1 device that has never granted notifications/camera/photos to this build

Core device-only surfaces in this app:

- Apple Sign-In
- Google OAuth redirect and return-to-app flow
- SecureStore token persistence across relaunch/lock/background
- RevenueCat and StoreKit purchase flows
- Push permission, token registration, delivery, open tracking, and routing
- Camera capture and photo-library permissions
- External links to App Store subscriptions, legal pages, support, and mail
- Foreground/background resume behavior and entitlement re-sync
- Notification-triggered deep links and route guarding on physical hardware

Pass rule:

- No blocker or major issue may remain open.
- Any flaky behavior seen more than once on the same build is a release risk and must be logged.
- Record device model, iOS version, build number, account used, and repro steps for every failure.
