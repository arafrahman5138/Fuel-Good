# Device Test Matrix

Use this as the execution grid for the detailed files in this folder.

## Device Matrix

| Device | iOS | Build | Install Type | Apple ID Type | Tester | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Device A |  |  | Fresh install | Sandbox/TestFlight |  |  |
| Device B |  |  | Upgrade/reinstall | Sandbox/TestFlight |  |  |

## Account Matrix

| Account | Purpose | Needed For |
| --- | --- | --- |
| Fresh email account | New user without premium | onboarding, paywall, route guard |
| Apple Sign-In account | Native Apple auth | social login |
| Google Sign-In account | OAuth redirect flow | social login |
| Complimentary override account | premium without purchase | entitlement bypass |
| Monthly sandbox subscriber | trial/purchase/restore | billing |
| Annual sandbox subscriber | annual flow | billing |
| Expired or billing-issue account | entitlement revocation | billing regression |

## Execution Order

1. Auth and session
2. Paywall and billing
3. Camera and media
4. Notifications and deep links
5. Lifecycle, network, and external links
6. Final release signoff

## Exit Criteria

- All critical flows pass on at least one fresh install and one relaunch/reinstall device.
- Billing passes on at least one real device with sandbox/testflight StoreKit.
- Push prompt, token registration, at least one received push, and one push-open route pass on device.
- Camera capture and photo-library paths both pass on device.
- No unauthorized premium bypass exists from deep link, notification, relaunch, or stale session state.
