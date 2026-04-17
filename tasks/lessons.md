# Lessons Learned

Self-improvement log per the CLAUDE.md workflow. Add rules for future sessions so the same mistake isn't made twice.

---

## 2026-04-17 (Session 2, Opus 4.7)

### Alembic "current == head" does not prove the schema is current

**Observation**: After a `downgrade -1` followed by `upgrade head`, the
alembic_version table reported the new head revision, but the new
columns were never actually added to the table. The ALTER TABLE
statements had silently not run during the upgrade pass, yet the
version row got bumped.

**Rule**: Never trust `alembic current` as proof a migration landed.
After applying any migration that adds columns, run a
`SELECT column_name FROM information_schema.columns WHERE ...` query
against the target DB and assert the expected columns are present.
Same goes for any migration that drops or renames: verify the actual
schema, not the version pointer.

**Recovery**: If you find drift, `UPDATE alembic_version SET version_num='<prior>'`
then re-run `alembic upgrade head`. Don't stamp forward and manually
ALTER - the two state machines will drift again next time.

---

### `expo run:ios` can be blocked by an unrelated cocoapods/Ruby regression

**Observation**: `npx expo run:ios` died at `pod install` with
`UnicodeNormalize.normalize: Unicode Normalization not appropriate for
ASCII-8BIT` inside cocoapods 1.16.2 on Ruby 4.0.1. This is a Ruby 4.0
regression, not an app problem.

**Rule**: When `expo run:ios` fails during the pod step with a Ruby
error, DO NOT spend time debugging the app or pods. Fall back to
installing the existing DerivedData `FuelGood.app` onto the simulator
and run `npx expo start` separately; the simulator app loads JS from
metro at runtime, so all JS/TS changes are testable without a fresh
native build. Only changes to native modules / Info.plist / Podfile
need a fresh pod install. The install-existing-app path is:

    xcrun simctl install <device> <path/to/FuelGood.app>
    npx expo start --port 8081 &
    xcrun simctl launch <device> com.fuelgood.ios

---

### Simulator taps require idb (not osascript) unless accessibility is granted

**Observation**: `osascript -e 'click button ...'` on the Simulator
app fails with "osascript is not allowed assistive access" on macOS
without an explicit accessibility grant. This blocks automated UI
walkthroughs via AppleScript entirely.

**Rule**: For simulator UI automation, use `idb` (fb-idb). It is
installed at `/Users/arafrahman/Library/Python/3.13/bin/idb`. Connect
once with `idb connect <udid>`, then use `idb ui tap`, `idb ui text`,
`idb ui swipe`, and `idb ui describe-all` (which returns a JSON
accessibility tree with exact frame coordinates). Add idb's bin dir
to PATH at the top of the session since it's not on the default PATH.

---

### "Simulator" verification means iOS simulator, not web preview

**Observation**: The user redirected from `expo start --web` to the
iOS simulator mid-verification. React Native Web renders differently
from iOS (different Share API, no native camera, different scroll
physics), so web is only a compile / basic-render smoke test.

**Rule**: When the user says "simulator" or "iOS" in a verification
context, boot `xcrun simctl` + Simulator.app. When they say "preview"
generically, ask which platform. Don't assume web = same-as-iOS.

---

### Local DB state ≠ the DB the running backend uses

**Observation**: A uvicorn process from an earlier session (started at
10:10 AM, pre-migration) was still running on :8000 and serving
requests from the SAME local DB that Session 2 had just migrated. The
preview_start call silently failed to bind to :8000 because it was
already occupied. The backend had the new CODE loaded in-memory but
the DB it queried was whatever the old process was connected to - in
our case the same DB, but if it had been a remote Supabase instance
the story would have been very different.

**Rule**: Before running any Phase C verification that talks to the
backend, `ps aux | grep uvicorn` and `curl /health` to confirm which
process is answering and reload if the version is stale. Don't assume
`preview_start` actually started your server - check `preview_list`.
