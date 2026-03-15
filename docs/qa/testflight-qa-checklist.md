# TestFlight QA Checklist

Run this on at least two physical iPhones before external TestFlight.

For subscription and paywall validation, also run [`paywall-device-readme.md`](./paywall-device-readme.md).

## Auth

- Email registration succeeds.
- Email login succeeds.
- Logout clears the session.
- Expired session refreshes or sends the user back to login.
- Apple Sign-In succeeds.
- Google Sign-In succeeds.

## Onboarding and Core Navigation

- New user reaches onboarding after first auth.
- Returning user lands on the main tabs.
- Settings screen opens privacy, terms, and support actions correctly.

## Scan and AI Flows

- Barcode scan works on device camera.
- Meal image scan uploads and returns a result.
- Permission denial for camera is handled gracefully.
- Permission denial for photo library is handled gracefully.
- AI chat returns responses without hanging.
- Meal plan generation completes and renders.

## Reliability Checks

- Turn on airplane mode and confirm errors are user-readable.
- Background the app for 5+ minutes, return, and confirm session state is sane.
- Trigger a bad request or timeout and confirm the app does not crash.
- Watch backend logs for request IDs and client telemetry while testing.

## Performance Notes

- Check for visible memory growth during repeated scan attempts.
- Check that chat and scan screens remain responsive after multiple uses.
- Record device model, iOS version, build number, and any crash/error details.
