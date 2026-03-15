# Device QA: Notifications And Deep Links

These tests require a physical device because they depend on native push permission state, Expo push token issuance, OS delivery behavior, and notification-open routing.

## Preconditions

- Real iPhone build with `expo-notifications`
- EAS project ID configured for push token generation
- Backend notifications service healthy
- Ability to inspect backend logs or notification records during test

## D1. Push Permission Prompt From Product Trigger

The app can prompt from meal-plan generation, saving recipes, or streak-related moments.

Steps:

1. Start from a device that has not answered push permissions for this build.
2. Trigger a flow that should request push permission:
   - generate a meal plan
   - save a recipe
   - streak-related usage

Expected:

- Native push prompt appears at an intentional moment.
- Allow path returns to app cleanly.
- Deny path does not crash or loop prompts.

## D2. Push Token Registration After Grant

Steps:

1. Grant push permissions.
2. Relaunch app.
3. Watch backend logs or DB.

Expected:

- Device receives an Expo push token.
- Token is registered with device id, platform, app version, and timezone.

## D3. Notification Settings Screen

Steps:

1. Open `Push Notifications` in settings.
2. Toggle master switch.
3. Toggle several categories.
4. Change quiet hours and meal reminder windows.
5. Force quit and relaunch app.

Expected:

- Preferences load correctly.
- Updates save successfully.
- State persists after relaunch.
- Failed saves show readable errors and roll back visibly.

## D4. Foreground Push Delivery

Steps:

1. Send a test push while app is foregrounded.

Expected:

- Foreground notification banner/list presentation appears.
- App stays stable.

## D5. Background Push Delivery And Open

Steps:

1. Background app.
2. Send a push with a route payload.
3. Tap the notification.

Expected:

- Notification is delivered.
- Tapping opens the app and routes to the intended screen.
- Backend records `notification_opened` and deep-link event.

## D6. Terminated-App Push Open

Steps:

1. Force quit app.
2. Send a push with a route payload.
3. Tap notification.

Expected:

- App cold-starts successfully.
- User lands on the intended route once initialization completes.
- No blank screen or wrong-route race.

## D7. Route Guarding From Notification Open

Run with:

- free account
- premium account

Steps:

1. Send a premium-route notification payload.
2. Open it while logged in as each account type.

Expected:

- Premium user reaches the destination.
- Free user is redirected to paywall and does not view premium content.

## D8. Notification Category Respect

Steps:

1. Disable one or more categories in notification settings.
2. Trigger backend conditions for those categories if possible.

Expected:

- Disabled categories do not send.
- Enabled categories still behave normally.

## D9. Push Permission Denied State

Steps:

1. Deny push permission on first prompt.
2. Trigger prompt-worthy flows again.

Expected:

- App does not keep re-requesting permission incorrectly.
- Core flows still work without push access.

## D10. Timezone And Scheduling Sanity

Steps:

1. Confirm device timezone.
2. Register push token.
3. Inspect backend preference/timezone state.

Expected:

- Device timezone is captured correctly.
- Quiet-hour and meal-window schedules align with that timezone.

## Release Blockers In This Area

- Push permission prompt crashes or dead-ends
- Token never registers after permission grant
- Notification tap opens wrong screen or nothing
- Free user can use push deep link to bypass paywall
- Notification settings fail to persist on device
