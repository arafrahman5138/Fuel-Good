I went through the second-pass report and sanity-checked it against the repo. A few agent findings are stale, so the real remaining work is a bit smaller than it looks.

The two stale items are:
- the iOS bundle ID is already `com.fuelgood.ios` in [app.json](/Users/arafrahman/Desktop/Real-Food/frontend/app.json)
- Render’s expected Apple bundle ID is already `com.fuelgood.ios` in [render.yaml](/Users/arafrahman/Desktop/Real-Food/render.yaml), [config.py](/Users/arafrahman/Desktop/Real-Food/backend/app/config.py), and [release-runbook.md](/Users/arafrahman/Desktop/Real-Food/docs/ops/release-runbook.md)

So here’s what’s actually left.

**Still Needed**

1. Apple / account admin
- Update the Apple Developer payment method so the membership doesn’t lapse.
- Optional but good: add the Sign in with Apple server-to-server notification URL later.

2. App Store Connect
- Replace the placeholder review phone number with your real number.
- Upload app screenshots for required iPhone sizes.
- Upload the first iOS build.
- Set EU DSA trader status if you want EU distribution.
- Make sure `https://www.fuelgood.app` and `https://www.fuelgood.app/support` are live.

3. App Store subscriptions
- Upload one review screenshot for each subscription product.
- Attach both subscriptions to the app version after the first build is uploaded.

4. RevenueCat
- This is the biggest remaining setup item.
- Create/configure the real iOS app in RevenueCat.
- Add the real App Store products:
  - `premium_monthly_999`
  - `premium_annual_4999`
- Swap the `default` offering off the Test Store products.
- Decide whether you are keeping a lifetime product, and if yes, choose its real product ID.
- Create the RevenueCat webhook pointing to your production API.
- Replace the test public key in mobile config with the live iOS RevenueCat SDK key once RevenueCat generates it.

5. Supabase
- Replace the placeholder Vault secret `REPLACE_ME_WITH_REAL_SECRET` with a real generated secret.
- Make sure Render uses the exact same value for `NOTIFICATION_RUNNER_SECRET`.
- If you want users to replace/delete scans from the app, add storage `UPDATE`/`DELETE` policies.
- Optional hardening: restrict scan bucket MIME types and size limits.
- Confirm you still have the DB password, or reset it if needed for Render’s pooler connection.

6. Render
- No current blocker from the report, but one dependency remains:
- copy the real notification runner secret into Render so it matches Supabase Vault.

7. Expo / EAS
- The bundle ID issue is already fixed in code, so ignore that part of the agent report.
- You still need to reconcile the two EAS configs:
  - [eas.json](/Users/arafrahman/Desktop/Real-Food/eas.json)
  - [eas.json](/Users/arafrahman/Desktop/Real-Food/frontend/eas.json)
- Set the missing EAS env vars/secrets, especially:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - legal/support URLs
- Replace the RevenueCat test key in the production build config after RevenueCat is ready.
- Connect Apple credentials in EAS and register at least one physical iPhone if you want an internal preview build.

**Recommended Order**

1. Finish RevenueCat
2. Set the real shared notification secret in Supabase Vault and Render
3. Clean up EAS config and env vars
4. Build/upload first iOS build
5. Upload app screenshots + subscription screenshots
6. Attach subscriptions to the app version
7. Final App Store review pass

**Bottom line**
You are past the Apple ID / bundle ID problems. The real remaining blockers are now mostly operational: RevenueCat, EAS env/config, screenshots, first build upload, and the shared notification secret.

If you want, I can turn this into a strict launch checklist in [Agent_results.md](/Users/arafrahman/Desktop/Real-Food/Agent_results.md) or a new `docs/ops/LAUNCH_REMAINING.md` so you can work through it cleanly.