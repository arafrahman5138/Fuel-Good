# Paywall Device Test README

Use this on a physical iPhone with an iOS dev build or TestFlight build. Do not treat Expo Go as a valid billing test environment for StoreKit or RevenueCat purchase flows.

## Goal

Verify that:
- non-premium users cannot access premium features after onboarding
- complimentary override users bypass the paywall
- monthly and annual subscriptions unlock the app correctly
- restore, expiration, cancellation, and relaunch behavior are correct
- there is no practical navigation or deep-link bypass on device

## Preconditions

- Backend is running against PostgreSQL, not SQLite.
- `REVENUECAT_*` backend env vars are set.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is set in the frontend build env.
- App Store Connect has both subscriptions configured:
  - `premium_monthly_999`
  - `premium_annual_4999`
- Both products have a 7-day introductory free trial.
- RevenueCat entitlement `premium` and offering `default` are configured.
- RevenueCat webhook is pointed at `/api/billing/webhook/revenuecat`.
- Test on a real iPhone signed into a Sandbox Apple ID or installed through TestFlight.

## Test Accounts

Prepare these accounts before testing:

- `Comp account`
  - example: `rahmanaraf99@gmail.com`
  - has backend complimentary override
- `Fresh free account`
  - brand new email with no purchase and no override
- `Monthly subscriber`
  - fresh account that will start the monthly trial
- `Annual subscriber`
  - fresh account that will start the annual trial
- `Expired account`
  - optional but useful; either wait for sandbox expiration or use a tester you already expired

## Build Rules

- Use `eas build --profile preview --platform ios` or a dev client.
- Fully uninstall old builds before testing restore edge cases.
- Before each scenario, note:
  - device model
  - iOS version
  - app build number
  - backend environment

## Scenario 1: Fresh User Hits Paywall

1. Install the app fresh.
2. Register with the `Fresh free account`.
3. Complete onboarding.
4. Confirm the app routes to the paywall instead of tabs.
5. Kill the app and reopen it.
6. Confirm it still opens to the paywall.

Expected:
- onboarding succeeds
- paywall appears immediately after onboarding
- tabs, browse, scan, meal plan, chat, and profile content are not reachable

## Scenario 2: Complimentary Override Bypasses Paywall

1. Log in with the `Comp account`.
2. Confirm login does not leave you stuck on `/subscribe`.
3. Force quit and reopen the app.
4. Background the app for 30 seconds and reopen it.
5. Log out and log back in again.

Expected:
- user lands in the app, not on the paywall
- access remains unlocked after relaunch and foreground refresh
- no subscription purchase is required

## Scenario 3: Monthly Trial Purchase

1. Log in with the `Monthly subscriber`.
2. Complete onboarding.
3. On the paywall, tap the monthly plan.
4. Complete the App Store purchase flow.
5. Wait for the app to return to the main app shell.
6. Visit chat, browse, scan, chronometer, profile, and meal plan areas.
7. Open Manage Subscription.

Expected:
- purchase flow succeeds
- app unlocks immediately
- all premium screens work
- manage subscription opens the App Store subscriptions page

## Scenario 4: Annual Trial Purchase

1. Repeat the prior scenario with the `Annual subscriber`.
2. Select the annual plan instead of monthly.

Expected:
- annual purchase succeeds
- app unlocks immediately
- annual plan is treated as the same `premium` entitlement

## Scenario 5: Restore Purchases

1. Use the `Monthly subscriber` or `Annual subscriber`.
2. Delete the app from the phone.
3. Reinstall the same build.
4. Log in again.
5. Use `Restore Purchases` from the paywall if needed.

Expected:
- restore succeeds without creating a duplicate account state
- entitlement returns and the user regains access

## Scenario 6: Paywall Cannot Be Bypassed by Navigation

Run this with the `Fresh free account` after onboarding.

1. Try to open tabs from any visible UI path.
2. Try push-notification entry points if available.
3. Try any saved deep links you use during development.
4. Open these routes manually if your build supports deep-link testing:
  - home tab
  - meals tab
  - chat tab
  - browse recipe
  - food search
  - scan
  - meal plan builder
  - settings

Expected:
- user is redirected back to `/subscribe`
- no premium content loads before redirect
- no premium API-backed content becomes visible

## Scenario 7: App Relaunch and Foreground Sync

Run this with:
- `Comp account`
- `Monthly subscriber`
- `Fresh free account`

For each account:

1. Log in.
2. Background the app for 1 minute.
3. Reopen it.
4. Force quit and relaunch it.
5. Toggle airplane mode briefly, then reconnect and reopen.

Expected:
- premium users remain unlocked
- non-premium users remain on the paywall
- state does not flip incorrectly after refresh

## Scenario 8: Cancel During Trial

1. Start a monthly or annual trial.
2. Cancel the subscription in App Store subscriptions before the trial ends.
3. Reopen the app.
4. Check access again before the trial actually expires.

Expected:
- access remains available until the trial end date
- app does not immediately revoke premium on cancellation alone

## Scenario 9: Expiration or Billing Failure

This usually needs Sandbox timing or an account already in that state.

1. Use an expired or billing-issue tester.
2. Reopen the app.
3. Try entering premium screens.

Expected:
- app returns the user to the paywall
- premium routes are no longer usable

## Scenario 10: Logged-Out Legal and Support Access

1. Log out from the paywall.
2. Open Terms.
3. Open Privacy.
4. Open Support.

Expected:
- these links work while logged out
- user does not need premium to reach legal/support pages

## Scenario 11: Error Handling

1. Disable network on the phone while on the paywall.
2. Tap restore purchases.
3. Re-enable network.
4. Try again.
5. If possible, test with RevenueCat temporarily unreachable in a non-production environment.

Expected:
- errors are readable
- app does not crash
- retry works once connectivity returns

## Scenario 12: Backend Consistency Check

For each account state, verify on the backend:

- `GET /api/auth/me`
- `GET /api/billing/status`

Expected:
- free user: `requires_paywall = true`
- subscriber in trial: `access_level = premium`, `subscription_state = trialing`
- active subscriber: `access_level = premium`, `subscription_state = active`
- complimentary override: `access_level = premium`, `store = manual_override`, `requires_paywall = false`

## High-Risk Regressions To Watch

- User completes onboarding and lands in tabs without a subscription.
- Complimentary users get stuck on the paywall.
- Restore succeeds in App Store but the app stays locked.
- Background refresh flips a premium user to free incorrectly.
- Canceling during trial removes access too early.
- A deep link opens premium content before redirect.
- App only guards UI while premium APIs still respond for free users.

## Pass Criteria

Ship only if all of these are true:

- fresh users cannot get past the paywall without entitlement
- complimentary override users always bypass the paywall
- monthly and annual trials unlock the app immediately
- restore works on reinstall
- expired or blocked billing state returns users to the paywall
- no route or deep-link bypass is found on device
- backend entitlement state matches what the device shows

## Notes

- Sandbox subscription timing is compressed by Apple. Document exact times when testing cancellation and expiration.
- If a result is ambiguous, capture:
  - screenshots
  - device logs
  - backend request IDs
  - RevenueCat customer state
