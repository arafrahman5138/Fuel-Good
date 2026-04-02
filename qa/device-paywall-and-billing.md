# Device QA: Paywall And Billing

This app uses RevenueCat plus StoreKit on iOS. These flows are not valid to sign off from local browser testing or Expo Go.

## Preconditions

- Real iPhone build
- RevenueCat iOS API key configured in build
- Backend billing config and sync endpoints healthy
- Release-candidate paywall testing must run against a backend with `ENVIRONMENT=production`
- App Store Connect subscriptions live:
  - `premium_monthly_999`
  - `premium_annual_4999`
- RevenueCat entitlement `premium` and offering `default` configured
- Sandbox Apple ID or TestFlight purchase environment ready

## B1. Free User Hits Paywall After Onboarding

Steps:

1. Register a new free account.
2. Complete onboarding.
3. Observe the post-onboarding route.
4. Force quit and reopen.

Expected:

- User lands on paywall.
- Paywall persists after relaunch.
- Premium tabs and screens are not reachable.
- `GET /api/billing/status` shows `requires_paywall = true`.

## B2. Complimentary Override Bypasses Paywall

Steps:

1. Log in with a complimentary override account.
2. Relaunch app.
3. Background and foreground app.

Expected:

- User enters the premium app shell with no purchase.
- Foreground billing sync does not kick user back to paywall.
- `GET /api/billing/status` shows `store = manual_override`.

## B3. Monthly Trial Purchase

Steps:

1. Log in with a fresh purchaseable account.
2. Start the monthly plan from paywall.
3. Complete native App Store purchase sheet.
4. Wait for app return.
5. Visit chat, browse, scan, meal plan, profile, and chronometer.

Expected:

- Purchase sheet appears and completes.
- App unlocks immediately after purchase.
- Entitlement stays unlocked across screens and relaunch.
- No stale paywall flash remains after success.

## B4. Annual Trial Purchase

Steps:

1. Repeat B3 with annual plan.

Expected:

- Annual purchase succeeds.
- It unlocks the same premium entitlement.

## B5. Restore Purchases

Steps:

1. Use an account with an existing purchase.
2. Delete app from device.
3. Reinstall same build.
4. Log in.
5. Use `Restore Purchases` if needed.

Expected:

- Restore succeeds.
- Access is restored without duplicate or inconsistent state.
- Restore failure message is clear if nothing is restorable.

## B6. Manage Subscription Link

Run from:

- paywall
- settings

Steps:

1. Tap `Manage Subscription`.

Expected:

- Opens App Store subscription management page.
- Does not dead-end on a broken URL.

## B7. Cancellation During Trial

Steps:

1. Start a sandbox trial.
2. Cancel in App Store subscriptions before expiry.
3. Reopen app immediately after cancellation.

Expected:

- Access remains active until trial end.
- App does not revoke premium early on cancellation alone.

## B8. Expiration Or Billing Issue

Steps:

1. Use an expired or billing-problem sandbox account.
2. Relaunch app.
3. Attempt premium entry points.

Expected:

- User is returned to paywall.
- Premium screens are not usable.

## B9. Paywall Cannot Be Bypassed

Run with a free account.

Steps:

1. Try to navigate using visible UI.
2. Reopen app from a stale last-opened premium screen if applicable.
3. Use a notification deep link if one exists.
4. Attempt known routes such as tabs, scan, browse detail, meal plan, chat, settings.

Expected:

- User is redirected back to paywall.
- Premium data does not briefly render before redirect.

## B10. Error Handling On Real Network Conditions

Steps:

1. Turn on airplane mode on the paywall.
2. Attempt restore.
3. Re-enable network.
4. Retry purchase/restore.

Expected:

- Human-readable errors.
- No crash.
- Recovery works after connectivity returns.

## B11. Billing State After Foreground Sync

Run with:

- free user
- active subscriber
- complimentary override

Steps:

1. Log in.
2. Background app for at least 1 minute.
3. Reopen app.

Expected:

- Billing sync preserves the correct entitlement.
- No user flips to the wrong state during foreground refresh.

## Release Blockers In This Area

- Purchase succeeds in StoreKit but app stays locked
- Restore says success but entitlement stays free
- Free user reaches premium content
- Premium user is bounced to paywall after foreground or relaunch
- Manage Subscription link is broken
