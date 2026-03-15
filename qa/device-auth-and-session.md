# Device QA: Auth And Session

These tests cover hardware/native behaviors that local runs do not fully validate: Apple auth, Google redirect handoff, SecureStore persistence, lock/unlock, and foreground token refresh.

## Preconditions

- Real iPhone build, not Expo Go
- Backend reachable over the environment used for release
- Legal/support URLs configured in build env
- Google OAuth client IDs configured if Google sign-in is expected in this build
- Test accounts prepared

## A1. Fresh Email Registration On Device

Steps:

1. Install the build fresh.
2. Register a brand-new email/password account.
3. Complete required onboarding.
4. Let the app route naturally after onboarding.

Expected:

- Keyboard/input behavior is normal.
- Registration succeeds without frozen loading state.
- Onboarding completes.
- User lands on `/subscribe` if not premium.
- App review prompt, if shown after onboarding, does not block navigation or break the flow.

## A2. Existing Email Login

Steps:

1. Launch app from a clean logged-out state.
2. Log in with an existing email/password account.
3. Force quit.
4. Reopen app.

Expected:

- Login succeeds on device.
- Session persists after force quit.
- User returns to the correct post-login route for the account entitlement state.

## A3. Apple Sign-In

Steps:

1. From login, tap `Apple`.
2. Complete the native Apple sheet.
3. Repeat once with cancel.
4. Repeat once with an already used Apple account if available.

Expected:

- Native Apple sign-in sheet appears.
- Successful sign-in returns to the app and creates/logs into the correct account.
- Cancel path returns cleanly with no stuck spinner.
- Repeat sign-in still resolves to the same user and does not orphan the session.

## A4. Google OAuth Redirect Roundtrip

Steps:

1. From login, tap `Google`.
2. Complete the browser/system auth flow.
3. Confirm return to app via the custom scheme.
4. Repeat once with user cancellation.

Expected:

- Browser/system auth opens correctly.
- Redirect returns to the installed app.
- Login completes and routes correctly.
- Cancel path does not leave the screen hanging or broken.

## A5. SecureStore Persistence Through Device Events

Steps:

1. Log in successfully.
2. Background app for 30 seconds.
3. Reopen app.
4. Lock device for 1 minute.
5. Unlock and reopen app.
6. Force quit and relaunch app.
7. If practical, reboot the phone and reopen app.

Expected:

- Session remains valid after background, lock/unlock, and relaunch.
- App does not show a broken loading state while reading tokens from `SecureStore`.
- User is either restored cleanly or sent to login cleanly.
- No incorrect premium downgrade/upgrade occurs after foreground sync.

## A6. Expired Access Token / Refresh Token Recovery

Steps:

1. Log in on device.
2. Leave app backgrounded long enough to force token refresh behavior if you have a short-lived staging token setup.
3. Reopen app.

Expected:

- Session refreshes without visible corruption.
- If refresh fails, user is returned to login without crashes or infinite spinners.

## A7. Logout Hygiene

Steps:

1. Log in.
2. Open settings.
3. Sign out.
4. Force quit and relaunch.

Expected:

- Sign-out confirmation works.
- Auth tokens are cleared.
- Relaunch shows login, not prior account content.

## A8. Route Gating By Account State

Run with:

- free account
- premium account
- complimentary override account

Steps:

1. Log in with each account type.
2. Relaunch app.
3. Background and foreground app.

Expected:

- Free user remains gated to allowed routes only.
- Premium and complimentary users go to the app shell.
- Route state does not oscillate after billing sync on foreground.

## Failure Notes To Capture

- Which provider failed: email, Apple, Google
- Whether failure happened before auth sheet, during redirect, or after return to app
- Whether force quit/relaunch changed behavior
- Device lock state when issue occurred
