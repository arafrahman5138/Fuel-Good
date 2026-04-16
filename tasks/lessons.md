# Lessons — Fuel Good

## 2026-04-16 — iOS App Store prep

- **Expo managed privacy manifest**: use `expo-build-properties` plugin's
  `ios.privacyManifests` key rather than hand-editing a `PrivacyInfo.xcprivacy`
  file. Managed workflow regenerates the iOS project on every build and would
  wipe a hand-placed file.
- **Paywall legal copy (Guideline 3.1.1(a))**: the onboarding paywall is a
  separate surface from `subscribe.tsx`. Both need Terms + Privacy links and
  auto-renew disclosure — easy to miss the onboarding one because it isn't in
  the tab stack.
- **`allowFontScaling={false}` ≠ safe**: replace with `maxFontSizeMultiplier`
  so Dynamic Type still works within a capped range.
- **File upload validation order**: magic bytes first, `content_type` is
  client-controlled and spoofable. Always use `detected_mime` for storage.
- **SQLite DB files**: never commit `*.db`. Add `backend/*.db` to `.gitignore`
  and `git rm --cached` any that slipped in.
- **Notification retries need persistent state**: `retry_count` +
  `next_retry_at` columns beat in-memory queues because the worker can crash
  and resume cleanly. Added via `ensure_legacy_schema_columns` instead of a
  fresh Alembic migration to avoid coordination with deploy.
- **Supervised async tasks**: inner loop should catch per-item failures; outer
  supervisor (in `lifespan`) should restart on unhandled exceptions. Both
  layers are needed — a single try/except isn't enough.
