# Lessons Learned

Self-improvement log per the CLAUDE.md workflow. Add rules for future sessions so the same mistake isn't made twice.

---

## 2026-07-14 (pass-8 remediation)

### Capture harnesses need a foreground assertion, not just md5 checks

**Observation**: The pass-9 reviewer found P01-P04 were iOS SPRINGBOARD screenshots — Expo Go had crashed mid-batch and simctl screenshots happily captured the home screen. Maestro steps even reported COMPLETED for taps in the same window. md5-dupe checking (the pass-8 lesson) caught the P03==P04 duplicate but not the wrong-app frames.

**Rule**: Before every capture batch, assert the foreground app: `xcrun simctl spawn booted launchctl list | grep -q UIKitApplication:host.exp.Exponent` or cheaper — screenshot + assert the glass tab bar's pixel band exists. Add it to the harness, don't rely on reviewers to catch it. And when a Maestro flow reports success but screenshots look wrong, believe the screenshots.

### The drift-guard allowlist ratchet works

The `__tests__/design-system-guards.test.ts` pattern (hex-grep + primary allowlist that agents must empty + staleness ratchet that fails when an allowlisted file becomes clean) turned "migration complete" into a machine-checkable state and caught a NEW file (RecipeCard.tsx) introducing hardcoded hexes DURING the migration itself. Reuse this pattern for any consolidate-N-implementations refactor.

### Parallel same-repo agents: expect transient tsc/jest noise

With 6 agents editing disjoint files, each agent's full-repo tsc/jest runs see siblings' in-flight states (duplicate identifiers, missing imports, guard failures naming other files). Brief agents to report-but-not-chase failures in files they don't own; the coordinator runs the authoritative gate after ALL agents land. Every "failure" in this pass resolved at the gate (tsc 0, 62/62).

---

## 2026-07-13 (UI audit pass 8)

### md5-check capture sets before review — silent tap failures produce stale duplicates

**Observation**: A reviewer agent md5-hashed its batch and proved 4 "different" screens were byte-identical (settings captures were actually the quests screen; dark profile was home-mid). Maestro taps on unlabeled icon buttons fail SILENTLY and the flow keeps screenshotting the old screen.

**Rule**: (a) After any multi-screen capture flow, run `md5 -q *.png | sort | uniq -d` and re-capture duplicates; (b) anchor every post-nav screenshot with an `extendedWaitUntil` on screen-distinctive text; (c) tell reviewer agents to md5-check their batch first. Also: icon-only controls with no accessibilityLabel (builder ✕, settings gear) are unautomatable AND unreviewable — file them as a11y P1s, not automation nuisances.

### The blank-screen wedge is reproducible via navigation churn

Rapid profile↔settings↔tab cycles (esp. dark mode) can wedge the app into tab-bar-alive/content-blank — survives further navigation, ErrorBoundary silent. If a capture comes back blank, don't assume a load race: screenshot twice a few seconds apart; a persistent blank is the bug itself (filed as pass-8 P1 #1).

---

## 2026-07-11 (5-persona month QA campaign)

### The dev DB is shared mutable state — capture everything at generation time

**Observation**: A parallel session's pytest run wiped dev Postgres mid-campaign, deleting all 5 persona accounts and 411 logs hours after creation. Nothing was lost because the driver had dumped every API response to `runs/*_month.json` at call time, and the analysis agent ran before the wipe. The wipe even *surfaced* a bug (empty meal plans when `recipe_embeddings=0` after re-seed).

**Rule**: Any QA campaign that provisions DB state must treat the dev DB as ephemeral: (a) dump every response to JSON as you go, never plan a "second pass" over live accounts; (b) run analysis agents early, on files not accounts; (c) after any restore/re-seed, check auxiliary tables too (`recipe_embeddings`, MES backfills) — `restore_meals.py` rebuilds recipes only, and plan generation degrades silently to an empty plan.

### Simulator month-simulation methodology that worked

- Backdating via the `date` field on POST /nutrition/logs (≤90 days) + behavior-modeled RNG per persona gives a realistic month in ~10 min for 5 users. Throttle to <120 req/min (server rate limit) and retry 429s.
- `source_type: "scan"` requires a real `source_id` — backfill historical scans as manual logs; exercise the real scan path live only.
- Scan quota counts *today's* requests regardless of the log's backdate — burn quota via API, then capture the wall UI on the 4th attempt.
- Premium per-user via `access_override_level='premium'` (survives `ALLOW_OPEN_PREMIUM_IN_NON_PRODUCTION=false`, which is required to see any freemium behavior).
- Expo Go signup password field silently rejects Maestro `inputText` (iOS strong-password overlay on `newPassword` fields). Register via API, sign in via the login form (which accepts input fine). Login≠signup for automation.
- Maestro text matchers collide with page content for tab-bar taps ("Meals" matches "Today's Meals") — use fixed points: Home (50,813), Meals (127,813), Track (204,813), Coach (281,813), FAB (359,814) on iPhone 17 Pro. The FAB overlay swallows tab taps if left open.
- Keyboard-avoidance scrolling invalidates coordinate taps mid-form; dismiss the keyboard between fields by tapping a static title area, then tap the next placeholder.

### Cross-account leak testing requires sequential logins on one device

**Observation**: The P0 store-leak (Priya seeing Jordan's macros) is only visible when two accounts sign in back-to-back in one app install. Fresh-account-per-pass hygiene (the 04-29 lesson) would have *hidden* it.

**Rule**: In any multi-persona pass, deliberately include at least one A→logout→B sequence and diff B's rendered numbers against A's session data. Zustand stores + logout is a standing suspect.

---

## 2026-05-02 (Native modules cannot ship via OTA — verify before pushing)

### `eas update` cannot add a native module to an existing binary

**Observation**: I shipped an OTA that added `expo-image` (replacing `react-native` Image) to fix slow image loads. The OTA published successfully — but expo-image has Swift native code (`Image.swift`, `Blurhash.swift`, etc.) that has to be compiled into the app binary. A bundle that imports `expo-image` against a binary without it would crash at runtime on the user's device. I had to ship a rollback OTA (revert commit + republish) within minutes.

**Rule**: Before adding ANY new package as part of an OTA, check the package for native code:

```
# If either of these directories has files, the package has native code
# and cannot be added via eas update — only via eas build:
ls node_modules/<pkg>/ios/
ls node_modules/<pkg>/android/
```

Pure-JS packages (lodash, date-fns, etc.) ship fine via OTA. Anything with `ios/` Swift/ObjC files or `android/` Java/Kotlin files needs `eas build` (which the user must explicitly approve, per the EAS quota rule). Packages that ARE already in the build (existing dependencies) can be safely upgraded via OTA as long as the major version doesn't introduce new native APIs.

**Concrete examples that need `eas build`**: expo-image, expo-camera, expo-notifications (any new push integration), react-native-reanimated upgrades, anything `expo install` warns about.

**Recovery procedure if a bad OTA ships**:
1. `git revert` the offending commit
2. `eas update --branch production --message "ROLLBACK: ..."` immediately to overwrite
3. The next launch on user devices auto-pulls the rollback OTA

The window of risk is ~30s-5min between the bad OTA and the rollback. Aim to be at the keyboard when shipping perf-related OTAs so this loop is fast.

---

## 2026-05-02 (Perf audit — duplicate API traffic was the dominant win)

### When the user reports "feels sluggish," check production request logs FIRST

**Observation**: User reported the app felt sluggish on a physical device. Two parallel Explore agents produced lengthy frontend audits flagging dozens of perf issues across 4 categories (animations, memoization, network waterfalls, bundle bloat). Reading them, it was tempting to start optimizing whatever sounded biggest. But the **actual smoking gun came from one query against Render request logs**: in a 2-second window, 10+ exact-duplicate `/api/...` GETs fired (e.g., `/api/fuel/settings` called twice in 100ms, `/api/metabolic/profile` twice in 175ms, etc). That single observation told me ~50% of the user's network traffic was redundant — the highest-leverage fix by far.

**Rule**: For any perf complaint on a networked app, before reading code, pull the last hour of `request.completed` logs from the prod backend (Render MCP `list_logs --text=duration_ms`). Look for: (a) the same URL+params hit multiple times within milliseconds, (b) tight bursts of N requests on every focus event. The frontend audit confirms the *cause* (mount + selectedDayKey + useFocusEffect effects all firing on first render); the logs prove it's actually happening to real users right now.

### React.memo without stable props is theater

**Observation**: Wrapping `TodayProgressCard` in `React.memo` had zero effect until I also memoized the parent's inline object props (`calories={{ consumed, target }}` → `calories={caloriesObj}`). React.memo only short-circuits if the shallow-compared props are referentially stable. Inline `{}` literals and `.map()` calls in JSX defeat it entirely.

**Rule**: When wrapping a child in React.memo, **always audit the parent's call site in the same commit**. Convert any inline `{...}`, `[...]`, `() => {...}`, or `.map()` results passed as props into `useMemo` / `useCallback` values. Otherwise the memo is dead code that misleads future maintainers into thinking the optimization happened.

---

## 2026-05-02 (EAS quota discipline)

### Never run `eas build` or `eas submit` without explicit user approval

**Observation**: User clarified mid-session that they want explicit approval before any EAS build or submit, because the free tier caps at 30 builds/month and errored builds still consume the quota. I had been correctly using `eas update` (OTA, unlimited) for JS-only fixes, but the user wanted the rule made explicit going forward and asked for an ongoing build counter.

**Rule**:
- **`eas update`** (OTA JS bundle) — safe to run autonomously for JS/TS/asset-only changes. Does NOT count against the build quota. This is the default for any change that doesn't touch native code, app config (`app.json`/`app.config.*`), entitlements, or native dependencies.
- **`eas build`** — REQUIRES explicit user approval before running. Counts 1 against the 30/month free quota whether it succeeds or errors. Only needed when native code, dependencies (`ios/`, `android/`, `Podfile`, native modules), entitlements, or runtime version changes.
- **`eas submit`** — REQUIRES explicit user approval. Pushes to App Store Connect / Play Console.

**When unsure if a change requires a build vs. an update**: it requires a build only if the JS bundle alone won't pick it up. JS, TSX, styles, copy, image assets bundled with the JS → OTA. Anything in `ios/`, `android/`, `app.json` → build.

**Track build count each session**: at the start of any deploy-adjacent work, run:
```
eas build:list --limit=30 --json --non-interactive | python3 -c "import json,sys; from datetime import datetime,timezone; d=json.load(sys.stdin); now=datetime.now(timezone.utc); m=[b for b in d if datetime.fromisoformat(b['createdAt'].replace('Z','+00:00')).year==now.year and datetime.fromisoformat(b['createdAt'].replace('Z','+00:00')).month==now.month]; print(f'{len(m)}/30 builds used this month ({now.strftime(\"%B %Y\")})')"
```
Report the count to the user when relevant.

---

## 2026-04-29 (UI Audit Pass 7 — empty-state + reduce motion + sound)

### Each audit pass should provision its own fresh API account

**Observation**: Across 6 prior passes, only the very first capture session had a true zero-state Home — every subsequent pass inherited the persona's accumulated state (logged meals, XP, streak). Pass 5's F4 fix (empty-state ring color) was implemented but **never visually verified on a fresh account** because pass 5 + pass 6 reused `pass5tester` who already had a meal logged. Pass 7 finally confirmed F4 by provisioning a brand-new `pass7tester` account.

**Rule**: Every audit pass that involves empty-state surfaces (Home, Today's Plan, Profile XP=0, etc.) should provision a fresh API account at the start: `cp runs/provision_pass5.py runs/provision_passN.py`, swap email/name, run it. Cost is ~30 sec; benefit is a clean visual baseline that prior passes can't fake.

### Reduce-motion can be toggled programmatically via `simctl spawn defaults`

**Observation**: Pass 7 needed to verify `isReduceMotionEnabled()` guards in the codebase actually fire. Two paths considered: (a) UI navigation through iOS Settings → Accessibility → Motion → Reduce Motion (slow, requires Maestro flow), (b) `defaults write` directly to the simulator's accessibility plist (fast, programmatic).

**Rule**: For accessibility-setting toggles in the simulator, use:
```
xcrun simctl spawn booted defaults write com.apple.Accessibility ReduceMotionEnabled -bool true
xcrun simctl terminate booted <bundleID>  # cold-launch so the app re-reads accessibility on mount
xcrun simctl launch booted <bundleID>
```
And to verify the toggle landed:
```
xcrun simctl spawn booted defaults read com.apple.Accessibility ReduceMotionEnabled  # returns "1" or "0"
```
Always disable at end of pass: `... -bool false`. Other accessibility keys exposed: `BoldTextEnabled`, `IncreaseContrastEnabled`, `DarkenSystemColorsEnabled`, `InvertColorsEnabled`, `LargerTextEnabled`. Pass 8+ can pattern-match this for full WCAG verification.

### Combine related captures when they happen together (R04 + R08 example)

**Observation**: Pass 6's plan listed R04 (meal-log animation) and R08 (ring-fill from 0) as separate captures. Pass 7 actually captured them — and discovered they're **the same event**: the very first "+" tap fills the ring AND animates the meal row checkmark AND fills the macro rings AND updates the tagline. Trying to capture them separately would have required artificially reverting state between captures.

**Rule**: When planning animation captures, look for moments that happen *simultaneously* and bundle them into one recording. Naming convention: `R04-R08-<combined-description>.mp4`. The frame review subagent can still grade each animation aspect independently from a single video.

### When dispatching multiple parallel subagents, write the doc structure FIRST

**Observation**: Pass 7 dispatched two background subagents (sound inventory + animation review). The sound inventory finished while I was still capturing videos. If I'd waited until both finished before writing any doc, I'd lose ~5 minutes of synthesis time. Instead I started drafting the synthesis doc with sound findings filled in, leaving placeholders for animation findings.

**Rule**: After dispatching parallel subagents, **immediately start drafting the synthesis doc structure** with placeholder sections. As each subagent completes, fold its findings into the matching section. This pipelines the work and avoids end-of-pass crunch.

---

## 2026-04-29 (UI Audit Pass 6 — motion + haptics)

### Animation audit needs video, not screenshots — extract keyframes for subagent review

**Observation**: Static screenshots completely miss motion. Pass 6's tab-transition finding ("zero animation between tabs") is invisible from a single frame; only frame-by-frame comparison across a video reveals it. Read tool can't process MP4 directly, so videos must be sampled into PNG keyframes first.

**Rule**: For motion audits, the rig is:
1. `xcrun simctl io booted recordVideo --codec h264 path.mp4 &` (background process, capture PID)
2. Run a Maestro flow that triggers the animation
3. `kill -INT $RECPID` to stop the recording cleanly
4. `ffmpeg -y -ss <pct*duration> -i video.mp4 -frames:v 1 -vf scale=600:-1 frame.png` for 5 keyframes per video at 5/25/50/75/95% of duration
5. Delegate keyframe review to an Explore subagent — frames are <320 KB each so all 5 can be read without "photo too large" failures

The 600-px width scaling is critical — native iPhone Pro Max simulator captures are 1320 px wide, full-resolution PNGs would blow past the 1 MB threshold. 600px preserves enough visual detail for design grading.

### Haptics audits are pure static analysis — no sim needed

**Observation**: A complete haptics inventory of 38 call-sites took one Explore subagent ~100s in the background while I was running video captures. No simulator interaction needed; everything is in `grep -rn "Haptics\." frontend/` + reading 10 lines of context per match.

**Rule**: For haptics audits, dispatch the inventory subagent **in parallel** with any other work. It's IO-only on the codebase. Don't sequentialize it with simulator capture.

### Maestro `tapOn` failures during a recording session leave you mid-state

**Observation**: R07 (Settings modal) failed mid-flow because `tapOn: "Open profile"` couldn't find the element (we were on Coach tab, not Home). The recording captured a static screen and the subagent reviewer falsely graded it "A". Lesson: **a Maestro failure during a recording corrupts the capture even if the video file is non-empty.**

**Rule**: Always check the Maestro flow's exit status before trusting a recording. If any step in the flow logged FAILED, mark the recording as a capture artifact in the audit doc and re-capture in the next pass. Don't let a subagent grade a failed capture as a real animation finding.

### Don't sleep through ScheduleWakeup polling — agents notify automatically

**Observation**: I tried to use `ScheduleWakeup` to poll for an animation-review subagent's completion. Wrong tool — that's for `/loop` mode. Background subagents send a system notification when they complete; just wait for it.

**Rule**: When a subagent runs in the background, do NOT poll, do NOT sleep, do NOT use `ScheduleWakeup`. Continue with other useful work (drafting structure, reviewing other findings) and let the notification arrive. The runtime tells you "you'll be notified automatically" — believe it.

---

## 2026-04-29 (UI Audit Pass 5)

### Maestro `tapOn` matches against accessibilityText, which often has a leading comma

**Observation**: Repeatedly hit `Element not found: Text matching regex: X` failures on buttons that I could clearly see on screen. Cause: React Native renders buttons with composite accessibilityText like `", Cook"` or `", Get tips for this step"` — the leading comma comes from an empty icon-label sibling. Maestro's `tapOn` does substring match but the regex compiles strict; `"Cook"` won't match `", Cook"` reliably.

**Rule**: When `tapOn: "X"` fails on a visible button:
1. Run `maestro hierarchy 2>&1 | grep accessibilityText | grep -v '""'` to see the actual matchable strings
2. Use `tapOn: ".*X.*"` regex with wildcards — this handles the leading comma case
3. For accessibility-labeled wrappers ("Open recipe X, breakfast"), use the full accessibility label as the regex
4. Fall back to `tapOn: { point: "X%, Y%" }` only as last resort — point-based taps are brittle across screen-size changes

### Provision API accounts for capture sessions, but expect onboarding to still trigger

**Observation**: Pass 5's `runs/provision_pass5.py` set up a complete profile via API (preferences, metabolic profile, meal plan) but the app *still* showed the onboarding funnel after login. The onboarding-completion flag is a separate state.

**Rule**: For any UI capture that needs a populated app state, plan for two phases: (a) API provisioning for data, (b) Maestro flow to walk through onboarding. Don't assume API state shortcuts the UI flow. Reuse pass-3's onboarding-walk patterns.

### Maestro `runFlow: when: visible:` skips silently when timing is wrong — prefer `extendedWaitUntil`

**Observation**: My first onboarding flow used `runFlow: when: visible:` for each conditional screen. Most blocks SKIPPED because the screen hadn't rendered when the check fired — flow advanced through generic "Continue" taps and stalled. Switching to `extendedWaitUntil: visible: X timeout: 8000` made every screen wait until ready before tapping.

**Rule**: For multi-screen sequential flows, default to `extendedWaitUntil` not `runFlow when:`. Reserve `runFlow when:` for genuinely-optional screens like permission modals.

### Aggressive swipe-up gestures dismiss modals — use `swipe: start: ... end: ...` carefully

**Observation**: A `swipe: start: "50%,80%" end: "50%,30%"` after the AI tip rendered dismissed Cook Mode (likely interpreted as swipe-to-dismiss). Lost progress in a 5-step flow.

**Rule**: For modal screens or full-screen overlays, prefer scrolling within content via shorter swipes (`50%,70% → 50%,40%`) rather than near-edge gestures that may trigger dismiss. Test the gesture in isolation first if the screen is modal.

### simctl screenshots can be 2 MB+ — keep them out of main context

**Observation**: Some screenshots from native iPhone Pro Max sims are 2.4 MB. Reading these in main context caused pass-4 to crash with "photo too large". Pass-5 avoided this by delegating image analysis to Explore subagents.

**Rule**: For image-heavy audits, the default pattern is:
1. Capture with `xcrun simctl io booted screenshot path.png`
2. Inline-read smaller (<1 MB) images for quick checks
3. Delegate larger images and bulk review to parallel Explore subagents
4. Ask each subagent to skip "photo too large" failures and report which it skipped — recapture those at lower resolution if needed

### Light/dark parity needs separate captures, not just appearance toggle mid-flow

**Observation**: I tried to toggle `xcrun simctl ui booted appearance light` mid-flow to capture both modes from one Maestro session. The app got logged out (likely due to a state-reset trigger) and I had to re-authenticate, losing some captures.

**Rule**: For dark/light parity, run two separate full sessions — one in each mode — rather than mid-session toggling. Cleaner state, more reliable comparisons.

### After completing a pass: log the methodology improvements alongside the visual findings

**Observation**: Each audit pass surfaces tooling lessons (Maestro selectors, simctl quirks, subagent delegation) that are easy to forget by the next pass. These belong in `lessons.md`, not buried in the pass doc's "Methodology note" section.

**Rule**: At the end of every audit pass, dedicate 5 min to extracting tooling lessons into `lessons.md` even if the visual findings doc already mentions them. The next pass starts smoother.

---

## 2026-04-29 (UI Audit Pass 4)

### Image-heavy audits crash main context with "photo too large" — delegate to subagents

**Observation**: The first pass-4 session crashed mid-audit when reading 2.4 MB recipe-detail screenshots. The error directs you to start a new session, which loses all in-flight findings.

**Rule**: For any audit involving more than ~10 screenshots, **never read images directly in the main context**. Spawn parallel Explore subagents (one per app section: onboarding / home / meals / track-coach / etc.), each reviewing 13–28 images and reporting back a ~1k-word markdown summary. Then synthesize the doc from summaries, not raw images.

**Why it works**: Subagent context is disposable — even if one crashes, the others continue. Main context only ever sees the markdown summaries (~6k tokens total) instead of ~75 MB of PNG data.

**How to apply**: Default pattern for `ui-audit-pass*.md`, `responsive-audit-*.md`, `simulator-ui-audit-*.md`, and any visual QA pass. Brief each subagent with: (a) the screenshot list, (b) the prior-pass markdown for tone/grading rubric, (c) instructions to skip any "photo too large" failures and note them, (d) an output cap of 1–1.5k words. Launch multiple in a single message for parallelism.

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

---

## 2026-04-16 — iOS App Store prep

- **Expo managed privacy manifest**: use `expo-build-properties` plugin's
  `ios.privacyManifests` key rather than hand-editing a `PrivacyInfo.xcprivacy`
  file. Managed workflow regenerates the iOS project on every build and would
  wipe a hand-placed file.
- **Paywall legal copy (Guideline 3.1.1(a))**: the onboarding paywall is a
  separate surface from `subscribe.tsx`. Both need Terms + Privacy links and
  auto-renew disclosure - easy to miss the onboarding one because it isn't in
  the tab stack.
- **`allowFontScaling={false}` != safe**: replace with `maxFontSizeMultiplier`
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
  layers are needed - a single try/except isn't enough.

---

## 2026-04-23 (Session, Opus 4.7) — target-user replay methodology

### Fresh-DB gotcha: restored backend is not a seeded backend

**Observation**: Ran a full target-user replay against `localhost:8000`; the
backend responded 200 to `/health` and all endpoints, but `/api/recipes/browse`
returned `total: 0`. The DB existed but had zero recipes. No error surfaced
anywhere — meal plan generation would have silently produced empty plans.

**Rule**: Before any target-user / persona assessment, always verify recipe
catalog size. One-line check:
`python3 -c "from app.db import SessionLocal; from app.models.recipe import Recipe; from sqlalchemy import func; db=SessionLocal(); print(db.query(func.count(Recipe.id)).scalar())"`
If it's 0 or far below expected (<50 for this project), run
`python3 restore_meals.py` before provisioning personas.

### Maestro coord-taps are a crutch; missing testIDs are a real bug

**Observation**: The sign-in + body-measurement flows broke repeatedly because
the TextInput components have no `testID` / `accessibilityIdentifier`. Fell back
to percentage-based `point` taps, which is brittle across device sizes and
rotates. `tapOn: below: "Weight"` that worked at 04-16 does NOT work today — the
form layout evolved and the child-relationship changed.

**Rule**: When writing Maestro flows for any persona run, if a tap needs
coordinates or `below:` selectors that feel fragile, stop and flag the missing
`testID` as a P1 *app-level* bug. The app has no end-to-end coverage in CI if
flows can't re-run against an evolved layout. Cite the missing testIDs in the
assessment; don't work around them silently.

### Don't fight the simulator past the point of diminishing returns

**Observation**: Spent ~30 min trying to get Maestro to reliably input 4 text
fields (weight/height feet/height inches/age). Each attempt cost a sim
restart. The actual assessment value was in code-review + API-exercise of the
downstream logic — not in the specific simulator tap.

**Rule**: For a target-user replay, cap simulator-UI time at the part that's
uniquely UI (copy, visual hierarchy, layout, micro-interactions). Switch to
API + code inspection for the part that's data-flow / logic / algorithm. Make
the methodology hybrid explicit in the report; don't apologize for it.

### Personas are API tokens, not sim state

**Observation**: Provisioned Maya via API (created account + metabolic profile
+ preferences), then signed into the simulator with those credentials, and the
sim still walked her through onboarding from scratch. The frontend treats
onboarding as a local-state / `AsyncStorage` concern, not a server-derived
truth. `onboarding_step_completed` on the server model is not read by the
client on first load.

**Rule**: If you need to test post-onboarding screens via UI without
re-walking onboarding, you must either (a) wire through the client's
AsyncStorage flag directly, or (b) accept that the fastest path is to walk
onboarding *once* on the simulator to pass through it, then evaluate
post-onboarding flows from there. The API-provisioned profile is useful for
backend-logic exercise, not for UI state bypass.

### Fixing a P0 on one surface ≠ fixing it everywhere the surface is rendered

**Observation**: The 04-16 R3 fix wrapped "Needs Work" → "Ready to start" logic
in the `getTierLabel()` helper inside [(home)/flex.tsx](frontend/app/(tabs)/(home)/flex.tsx).
The same shame-coded tier label reappears on `/api/fuel/health-pulse`, which
a separate home-screen tile renders. The backend returns `tier_label: "Needs Work"`
directly on Day-0; the frontend renders whatever the API returns.

**Rule**: When fixing a copy / UX issue that surfaces on multiple screens
and is computed at multiple layers (client + server), sweep *all* layers
before declaring the P0 done. Grep for the exact bad string across the
backend routers AND the frontend components. "Fixed on flex.tsx" is not
"fixed on day-0 first impression."

### Health-flag safety features should be integration-tested, not just unit-tested

**Observation**: `HYPERTENSION_SODIUM_CEILING_MG = 1500` is a named constant
with a comment referencing the AHA guideline. The fix is 1-line of override
code in `nutrition.py`. It has no integration test. It is silently broken at
runtime for any user whose profile captured height as inches-only (the most
common input format for a US user on the iOS UI), because the narrow guard
`_profile_has_core_setup()` only accepts `height_cm` or `height_ft`.

**Rule**: Any clinical / safety / regulatory flag (hypertension sodium cap,
lactation kcal add, IBD fiber floor, ED-recovery restriction suppression)
deserves a *round-trip integration test*: provision a user via the same API
path the iOS app uses, fetch `/api/nutrition/targets`, assert the expected
cap/floor. These features are the app's differential moat; they cannot be
allowed to silently not fire.

### When a bug protects an irrelevant path, the fix must broaden the path check

**Observation**: `_profile_has_core_setup` was a reasonable defensive check
at some point — don't sync targets from a half-built profile. But it was
written against one set of height inputs (cm, ft) and blocked another
(inches). The fix is not "remove the guard" — it's "make the guard accept
all valid height shapes."

**Rule**: When a guard function is too narrow, read the schema it guards
against FIRST. The metabolic profile accepts `height_cm | height_ft+in |
height_in` (all documented in Pydantic). A guard that checks two of three
forms is a logic error disguised as a boundary check.

### Always run a baseline-delta pass before declaring a P0 didn't ship

**Observation**: P0 #3 from 04-16 was "make scan a tab." Current tab layout
still has no scan tab — surface-level conclusion would be "didn't ship." But
code inspection showed scan was promoted to a hero tile on the home screen
with behavior-event tracking. A thoughtful alternative implementation.
Reporting this as "partial / alternative" is more useful than "didn't ship."

**Rule**: For every baseline P0, do *two* checks before writing a
status verdict: (1) does the literal fix exist, and (2) does a functional
equivalent or alternative exist. A "partial / alternative" column in the P0
delta table is more honest than binary shipped/not-shipped.

---

## 2026-05-19 (Scoring data drift — the dictionary disagreed with the LLM)

### When a user reports a "wrong score," the leak is usually data, not logic

**Observation**: User scanned a chicken+beef+rice+salad bowl. The LLM
correctly tagged it `whole_food_status="pass"` (green "Whole-Food Pass"
chip in the UI), but the score came back **85** instead of 100. The fuel
scorer logic was fine. The bug was in [nova_dict.json:96-101](backend/app/data/nova_dict.json:96):
plain `"rice"`, `"white rice"`, `"jasmine rice"`, `"basmati rice"`, and
`"sushi rice"` were all tagged `"refined_flour"`. That tag adds a
medium-severity flag, which trips the `med_count == 1: cap = min(cap, 85)`
rule at [fuel_score.py:430](backend/app/services/fuel_score.py:430). So the LLM said "all whole food" and
the dictionary said "refined flour" — and the dictionary won.

**Rule**: When a user reports a score that disagrees with the UI's
own classification chip (Whole-Food Pass vs. <100 score), the two
signals are pointing in opposite directions and one of them is wrong.
**Check the data file before the scoring logic.** Specifically:

1. Pull the live scan from Render logs (search by meal name or
   `request_id` near the screenshot's timestamp).
2. Read the `meal_scan.completed bytes=… usda=X/Y` line — `usda=0/N`
   often hints that fallback heuristics (the NOVA dict) carried the score.
3. Open `nova_dict.json` and search for each ingredient name. Misclassified
   single-ingredient entries (plain rice tagged refined_flour, plain
   potatoes tagged something processed, etc.) are the #1 source of
   "obvious whole food meal scored < 100" bugs.
4. Fix at the data layer. Don't add escape hatches in `fuel_score.py` unless
   the rule itself is wrong (it usually isn't).

### Test fixture ranges encode the OLD calibration — always re-check upper bounds after a data fix

**Observation**: After removing the `refined_flour` tag from rice, the
`salmon_white_rice` golden fixture (range `70-95`) and `burrito_bowl`
(range `55-90`) both started failing because their ceilings were silently
being held down by the rice tag. The previous upper bounds reflected the
buggy calibration, not the intended one.

**Rule**: When changing a tag/penalty in the scoring data, grep all golden
test ranges that involve that ingredient. Any range whose upper bound was
"just under" the cap that's about to disappear will need to be widened.
Tag the bumped range with a dated comment so a future reader knows it
was a calibration shift, not a regression.

### `render logs --text` is the fastest path to find a specific scan

**Observation**: The user said "I scanned this the other day." No
timestamp, no scan_id. `render logs --text "/api/scan"` over a 3-day
window narrowed it to one POST `/api/scan/smart` at 23:54:38 UTC, with
the request_id and (one second earlier) the `meal_scan.completed` line
showing model + ingredient count. Took ~10 seconds.

**Rule**: For user-reported scan issues, the playbook is:
1. `render logs --resources <srv-id> --start <D-3> --end <D+1> --text "/api/scan" --limit 100`
2. Identify the POST by approximate time-of-day from the screenshot.
3. Pull a tight window (`--start T-15s --end T+15s`) to get full context:
   the `meal_scan.completed` log line, request_id, any storage failures.
4. The score itself is NOT logged — you can only infer it from the
   inputs + the scoring code. If this becomes a recurring debugging need,
   add a `logger.info("fuel_score.computed score=%s reasoning=%s")` line
   after the `compute_fuel_score` call.

---

## 2026-07-11 (Multi-file pytest runs can wipe the dev Postgres DB)

### DB-backed test files are import-order dependent — running several together binds drop_all to the WRONG database

**Observation**: Running `pytest tests/test_meal_scan_envelope.py tests/test_scan_cache_consistency.py ...` wiped the local Postgres dev DB (users, 117 seeded recipes — everything). Cause: the first collected file imported `app.services.meal_scan` → `app.db` WITHOUT setting `DATABASE_URL`, so `SessionLocal` bound to the Postgres URL from `backend/.env`. The later test file's module-level `os.environ["DATABASE_URL"] = sqlite:...` came too late — its `setUp` ran `Base.metadata.drop_all(bind=SessionLocal.kw["bind"])` against Postgres.

**Rules**:
1. Any new backend test file that imports ANYTHING from `app.*` must set `os.environ["DATABASE_URL"] = "sqlite:///..."` BEFORE the first app import — even if the test itself never touches the DB (it poisons/binds the engine for every file collected after it).
2. Prefer running DB-backed test files individually, or export `DATABASE_URL=sqlite:///test.sqlite3` on the pytest command line for multi-file runs.
3. Recovery: `alembic upgrade heads`, `python seed_db.py` (117 recipes), `scripts/seed_common_foods.py`, `scripts/seed_food_catalog.py`, re-register QA accounts.

### Alembic env.py silently skipped migrations (fixed 2026-07-11, check prod)

`_bootstrap_existing_schema` left an auto-begun transaction open → Alembic never committed (DDL rolled back); `_normalize_alembic_version` then stamped the head on ANY alembic run (even `alembic current`), marking unapplied migrations as applied. Fixed in backend/alembic/env.py. If a deploy "ran" a migration but the column is missing, this is why — audit prod schema vs alembic_version.
