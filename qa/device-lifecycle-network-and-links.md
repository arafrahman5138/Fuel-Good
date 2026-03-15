# Device QA: Lifecycle, Network, And External Links

This checklist covers physical-device behaviors tied to app state, OS handoff, link opening, and unreliable connectivity.

## Preconditions

- Real iPhone
- Build with valid legal/support/subscription URLs
- At least one free account and one premium account

## E1. Background And Foreground Resume

Run with:

- free account
- premium account

Steps:

1. Open the app on a meaningful screen.
2. Background for 1 minute.
3. Reopen.
4. Repeat after 5+ minutes if practical.

Expected:

- App resumes without white screen, crash, or lost navigation stack.
- Streak sync and billing sync do not corrupt state.
- User remains in the correct entitlement state.

## E2. Force Quit And Cold Relaunch

Steps:

1. Open app.
2. Force quit from app switcher.
3. Relaunch.

Expected:

- Cold start succeeds repeatedly.
- No infinite loading overlay.

## E3. Connectivity Loss During Active Use

Steps:

1. While using chat, scan, browse, meal plan, or settings, enable airplane mode.
2. Attempt an action.
3. Re-enable connectivity.
4. Retry.

Expected:

- Errors are readable.
- UI remains responsive.
- Retrying after reconnect works.

## E4. Connectivity Loss During Auth/Billing/Scan

Steps:

1. Interrupt network mid-flow during:
   - login
   - restore purchases
   - scan analysis
   - meal-plan generation

Expected:

- No app crash.
- User is returned to a recoverable state.
- Retry is possible after reconnecting.

## E5. Settings Links

Steps:

1. Open settings.
2. Open:
   - Privacy Policy
   - Terms of Service
   - Support email
   - Support Center if configured
   - Manage Subscription

Expected:

- Each link hands off correctly to Safari, Mail, or App Store.
- Broken build-time URLs show a clear fallback alert instead of silent failure.

## E6. Logged-Out Legal And Support Access

Steps:

1. Log out from paywall or settings.
2. Open available legal/support actions from logged-out surfaces.

Expected:

- Legal/support links remain reachable while logged out.

## E7. App Upgrade / Reinstall Sanity

Steps:

1. Install older internal build if available.
2. Upgrade to candidate build.
3. Verify auth, entitlement, and preferences.
4. Delete and reinstall candidate build.

Expected:

- Upgrade does not corrupt session or entitlement.
- Reinstall path behaves correctly for free and subscriber accounts.

## E8. Onboarding Completion Review Prompt

The onboarding screen may request in-app review on device.

Steps:

1. Complete onboarding on a fresh account.

Expected:

- Review request, if shown, does not block navigation.
- App still routes to paywall or app shell correctly afterward.

## E9. Orientation / Safe-Area Sanity

Even though the app is portrait-oriented, verify device chrome on real hardware.

Steps:

1. Use screens with full-screen/modal presentation:
   - login
   - subscribe
   - scan
   - settings
2. Observe notch, home-indicator, keyboard, and header spacing.

Expected:

- No clipped controls or unusable bottom actions on physical screen dimensions.

## Release Blockers In This Area

- Foreground resume changes entitlement incorrectly
- External legal/support/subscription links are broken
- Offline state crashes core flows
- Reinstall/upgrade breaks auth persistence or route gating
