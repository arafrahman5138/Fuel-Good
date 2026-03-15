# Device QA: Camera And Media

These flows depend on `expo-camera`, `expo-image-picker`, native permission prompts, and real photo capture behavior.

## Preconditions

- Real iPhone with working camera
- Build has camera and photo-library permission strings
- Test device has not already granted permissions for at least one pass of this checklist

## C1. First-Time Camera Permission Prompt

Steps:

1. Open scan screen from the app.
2. Trigger a camera capture path.

Expected:

- Native camera permission prompt appears.
- Allow path continues into camera usage.
- Deny path shows a readable app message and avoids crash.

## C2. First-Time Photo Library Permission Prompt

Steps:

1. Open scan screen.
2. Trigger a library image path for meal scan.

Expected:

- Native photo-library prompt appears.
- Allow path opens photo picker.
- Deny path shows a readable app message.

## C3. Meal Scan: Native Camera Capture

Steps:

1. Open scan in meal mode.
2. Capture a meal with in-app camera preview if available.
3. Wait for analysis.

Expected:

- Camera preview renders.
- Capture succeeds.
- Analysis request runs and returns a result or handled error.
- No frozen spinner after capture.

## C4. Meal Scan: Image From Library

Steps:

1. Choose a meal image from the photo library.
2. Wait for analysis.

Expected:

- Library selection returns to app.
- Analysis begins automatically.
- Result screen renders correctly.

## C5. Meal Scan: Not-Food Handling

Steps:

1. Submit a clear non-food image.

Expected:

- App shows the not-food response cleanly.
- User can recover and scan again.

## C6. Meal Scan: Recompute And Log

Steps:

1. Scan a valid meal.
2. Edit meal label/ingredients if supported.
3. Recompute.
4. Log the meal.

Expected:

- Recompute completes.
- Log succeeds.
- Success state/modal appears.
- Repeated logging does not duplicate unexpectedly.

## C7. Product Scan: Label Photo From Camera

Steps:

1. Switch to product mode.
2. Capture a product label image.
3. Wait for analysis.

Expected:

- Capture succeeds.
- Product result renders without layout breakage.
- Recoverable/low-confidence cases open the edit path when expected.

## C8. Product Scan: Label Photo From Library

Steps:

1. Use a saved label image from photo library.

Expected:

- Same correctness as camera capture path.

## C9. Product Scan: Manual Barcode Entry

Steps:

1. Enter a valid barcode manually.
2. Analyze.
3. Repeat with blank input and invalid input if possible.

Expected:

- Valid code returns a result or a handled backend miss.
- Blank input is blocked with readable validation.
- Failure path returns user to a usable state.

## C10. Product Scan: Manual Label Editing

Steps:

1. Open manual label editing path.
2. Enter product name, brand, ingredients, and optional nutrition fields.
3. Analyze.

Expected:

- Manual scoring works from device keyboard flow.
- Numeric fields do not corrupt or freeze on iOS keyboard input.

## C11. Repeated Capture Stability

Steps:

1. Perform 5 to 10 mixed scans in one session:
   - meal camera
   - meal library
   - product camera
   - product library
2. Switch between scan modes.

Expected:

- Camera preview keeps working.
- No noticeable memory-related slowdown.
- No stale image/result from the previous mode leaks into the next one.

## C12. Permission Recovery

Steps:

1. Deny camera/photos permissions.
2. Attempt scan flows again.
3. Re-enable permissions in iOS Settings.
4. Return to app and retry.

Expected:

- App fails gracefully while denied.
- After enabling in Settings, scanning works without reinstall.

## Release Blockers In This Area

- Native permission prompt never appears
- Camera preview black screen
- Capture returns but analysis never starts
- Denied permission crashes or traps the user
- Result/logging path breaks only after real photo capture
