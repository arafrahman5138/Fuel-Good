# Fuel Good App - Bug Report

## Testing Environment
- **Device**: iPhone 15 Pro (iOS 17.5) Simulator
- **Backend**: localhost:8000 (development)
- **Date**: 2026-04-01

---

## Bug #1: Onboarding safe area cutoff (FIXED)
- **Severity**: P1 (Major visual)
- **Screen**: Onboarding (all steps)
- **Issue**: The "5-minute setup" badge and progress bar were being cut off by the Dynamic Island/notch area. The content was rendering under the status bar.
- **Root Cause**: `onboarding.tsx` used `paddingTop: Spacing.xxxl` (~32px) instead of respecting safe area insets. The screen uses a plain `<View>` + `<ScrollView>` without `SafeAreaView` or `useSafeAreaInsets()`.
- **Fix Applied**: Added `useSafeAreaInsets()` hook and applied `paddingTop: insets.top + Spacing.lg` to the ScrollView content, and `paddingBottom: Math.max(insets.bottom, Spacing.xxxl)` to the footer.
- **File**: `frontend/app/(auth)/onboarding.tsx`

## Bug #2: StoreReview triggered during onboarding (FIXED)
- **Severity**: P1 (Blocks onboarding flow)
- **Screen**: Onboarding Step 12 → 13 transition
- **Issue**: `StoreReview.requestReview()` is called when the user leaves the meal suggestions step (step 12). This triggers an iOS rating dialog during onboarding, before the user has even used the app. In Expo Go, this dialog is nearly impossible to dismiss, completely blocking the onboarding flow.
- **Root Cause**: Premature trigger point. The review prompt is placed at "peak excitement" but the user hasn't experienced the app yet.
- **Fix Applied**: Commented out the StoreReview call. Should be moved to a post-first-week milestone (e.g., after completing 7 days of logging or earning a streak achievement).
- **File**: `frontend/app/(auth)/onboarding.tsx` (line ~512)

## Bug #3: Expo Go crashes on iOS 26.2 (iPhone 17 Pro Max)
- **Severity**: P2 (Environment-specific)
- **Screen**: App launch
- **Issue**: Expo Go 54.0.6 crashes with a native SIGSEGV in the Hermes JS engine on iOS 26.2 simulator. The crash happens after the bundle downloads and starts executing. Works fine on iOS 17.5.
- **Root Cause**: Likely Hermes engine incompatibility with iOS 26.2 beta. The crash trace shows `hermes + 686320` as the crashing frame with `EXC_BAD_ACCESS (KERN_INVALID_ADDRESS)`.
- **Recommendation**: Test with a development build for iOS 26.2, or wait for Expo Go update with iOS 26 compatibility.

---

## Observations (Not Bugs)

### Onboarding Flow
- 14-step onboarding is comprehensive but long; "5-minute setup" label is accurate
- Personalized targets (protein, carbs, fiber, fat, TDEE) calculate correctly
- Meal suggestions are well-curated with Fuel 100 scores
- Progress bar works correctly and updates per step
- Back navigation works on all steps except step 12 (by design)
