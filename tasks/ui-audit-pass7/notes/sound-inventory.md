# Sound / Audio Inventory & Recommendations (Pass 7)

## Current state
- **Audio dependencies in package.json**: NONE
- **Audio playback call-sites**: NONE (zero grep results across all .ts/.tsx files)
- **Audio asset files**: NONE (no .mp3, .m4a, .wav, .aac, .ogg files found in `/frontend/assets/` or subdirs)

**Evidence**:
- `package.json` has `expo-haptics` but no `expo-av`, `expo-audio`, `react-native-sound`, or `react-native-track-player`
- `grep -rn "expo-av|expo-audio|Audio\.|playAsync|loadAsync|Sound\.|useSound" --include="*.ts" --include="*.tsx"` returned zero matches
- `grep -rn "\.mp3|\.m4a|\.wav|\.aac" --include="*.ts" --include="*.tsx"` returned zero matches
- `find . -path ./node_modules -prune -o \( -name "*.mp3" -o -name "*.m4a" -o -name "*.wav" -o -name "*.aac" \) -print` returned zero matches
- `/frontend/assets/` contains only `fonts/` and `images/`; no `sounds/` directory exists

## Verdict
**Hypothesis confirmed**: The Fuel Good app currently has zero audio playback. No `expo-av` dependency, no sound assets, no playback calls anywhere in the codebase. The app is purely visual + haptic. This is a significant missing layer in the feedback stack given the sophistication of the haptic system (38 call-sites per pass 6 audit).

---

## Where sound *could* meaningfully fire (recommendations)

### P0 — Critical surfaces (celebration + commitment moments)

**1. Cook celebration / "You cooked it!" screen**
- **Sound**: Celebratory short chime or notification tone (300–500ms duration) — fire immediately when `CookCompleteModal` mounts
- **Rationale**: Pass 6 flags this as the highest-priority animation gap; sound pairs perfectly with the success card, checkmark draw, and "+50 XP bounce" animations. This is the app's #1 victory moment; audio absence is glaring compared to haptics (Success) already firing. Recommend a bright, brief "completion" sound — think iOS "achievement unlocked" tone but Fuel Good branded.
- **Paired with**: `CookCompleteModal.tsx:53` (Success haptic + card mount animation already here)

**2. First meal of day / score 0 → 100 ring fill**
- **Sound**: Uplifting ascending tone or progressive "fuel-up" sound (500–800ms) — fade in as ring fills
- **Rationale**: This is the rarest moment for most users — the transition from empty to "Elite day" is celebratory. Audio would reinforce the visual ring-fill animation + "today's Fuel" state change. Consider a subtle ascending 3-note or glissando that completes as the ring fully loads.
- **Paired with**: Ring fill animation (from R08 deferred capture); likely paired with Haptics.Success on threshold cross

**3. Tier-up / score threshold crossing (89 → 90, Decent → Strong, etc.)**
- **Sound**: Notification-style "level up" chime — fire when tier threshold crosses
- **Rationale**: This moment doesn't have a dedicated animation surface today (LevelUpSheet fires Success haptic + staggered Medium, but no visual animation of the *crossing*). Audio + haptic alone would elevate this to feel more momentous. A short metallic or musical "ding" reinforces the tier milestone.
- **Paired with**: `LevelUpSheet.tsx:55` (Success + staggered Medium haptics already here; animation TBD)

### P1 — High-impact surfaces (meaningful daily workflows)

**4. Meal logged successfully from Home Today's Plan (+)**
- **Sound**: Subtle confirmation tone (200–300ms) — fire on "confirm log" button, not on "+". Light, non-intrusive, but audible enough to confirm network sync success.
- **Rationale**: Pass 6 flags this as Gap G1: "logging a meal from Today's Plan has no haptic feedback at all yet probably has a checkmark/state animation." Sound pairs naturally with the Light haptic on confirm. Prevents silent failures where user thinks meal didn't save.
- **Paired with**: Gap G1 from pass 6; recommend `Feedback.commit()` semantic + confirmation sound together

**5. Coach response complete / "Analyzing nutrition…" → recipe card appears**
- **Sound**: Subtle completion chime or "ready" beep (100–200ms) — fire when streaming ends and recipe card mounts
- **Rationale**: Pass 6 grades Coach streaming as **A−** (strong spinner + progressive text reveal). Audio would complete the feedback loop: visual spinner + text progression + haptic (already Light on send button per chat/index.tsx:130) + sound on completion = complete presence cue. Prevents user from missing the moment the analysis finishes.
- **Paired with**: `app/(tabs)/chat/index.tsx:130` (Light haptic on send); recipe card mount animation (P2 in pass 6)

### P2 — Polish surfaces (refinement + delight)

**6. Scan result appears / "Meal logged" confirmation**
- **Sound**: Soft notification ping (100–150ms) — fire on result arrival
- **Rationale**: The Scan flow correctly fires Success haptics on result (scan/index.tsx:418, 510, 535, 574). Audio reinforces that the meal has been captured, especially useful when the user was holding the camera and might not have seen the haptic register.
- **Paired with**: `app/scan/index.tsx:418, 510, 574` (Success haptics); no animation found so pure audio-haptic pair

**7. Pull-to-refresh trigger / refresh starts**
- **Sound**: Brief mechanical "pull-click" or refresh whirr (150–250ms) — fire on release once threshold crossed
- **Rationale**: Pass 6 flags this as Gap G6. Audio + Medium haptic together confirm the pull gesture was registered and refresh is starting. Common on Android; underused on iOS but high-polish apps include it.
- **Paired with**: Gap G6; pair with recommended `Feedback.commit()` haptic

**8. Level-up animation sequence (celebratory staggered feedback)**
- **Sound**: Short musical sequence (3–5 notes ascending, 400–600ms total) — layer over the already-staggered Success + Medium + Medium haptic pattern
- **Rationale**: Pass 6 notes the LevelUpSheet has a creative staggered haptic pattern (Success at 0ms, Medium at 220ms, Medium at 420ms). Audio can extend this: play a short 3-note melody timed to the haptic sequence (e.g., low note @ Success, mid @ first Medium, high @ second Medium). This creates a fully multisensory celebration.
- **Paired with**: `components/LevelUpSheet.tsx:55–57` (staggered haptics already here)

---

## Anti-pattern surfaces — explicitly don't add sound here

**1. Tab bar switching** (GlassTabBar:244)
- **Why not**: Tab switches are frequent navigation (many per session). Firing sound on every tab tap would be audibly exhausting — users would mute it or disable it immediately. Some premium apps suppress tab-bar audio entirely; many use only haptics. If sound is added elsewhere, *explicitly exclude* tab bar.

**2. Every button tap / lightweight CTAs** (paywall dismiss, commitment "not yet", onboarding "continue", etc.)
- **Why not**: The app already fires Light haptics on ~16 lightweight actions. Adding sound to all of them would flood the audio channel with noise. Sound should be reserved for *significant* actions (commits, victories, meaningful logs). Lightweight navigation buttons (continue, skip, dismiss) should remain haptic-only.

**3. Option/chip selection** (goal-context age, sex toggle)
- **Why not**: Onboarding chip taps are rapid-fire (user selects age, then sex, then 3+ other fields in quick succession). Audio on each would be annoying. These correctly fire Light haptic; keep them haptic-only.

---

## Implementation cost estimate

- **Dependency**: `expo-av` (~trivial install; ~100KB uncompressed, ~30KB gzipped)
- **Asset budget**: 8 sounds (Cook celebration, First meal, Tier-up, Meal log confirm, Coach complete, Scan result, Pull-refresh, Level-up sequence) at ~10–50KB each (mostly short SFX) = ~200KB total uncompressed (~60KB gzipped)
- **Per-site wiring**: Extend `frontend/utils/feedback.ts` (proposed in pass 6) to include optional sound callbacks:
  ```ts
  export const Feedback = {
    tap: (sound?: boolean) => { Haptics.impactAsync(...); if (sound) playSound('tap'); },
    commit: (sound?: boolean) => { Haptics.impactAsync(...); if (sound) playSound('commit'); },
    celebrate: (sound?: boolean) => { Haptics.notificationAsync(...); if (sound) playSound('celebrate'); },
    // ... rest
  };
  ```
  This keeps individual site refactoring minimal (~1-2 lines per site to add `{sound: true}` flag). Only P0–P1 surfaces would have sound=true by default.

- **Estimated dev effort**:
  - Dependency setup + sound asset import: 30 min
  - Extend `feedback.ts` with sound layer: 1 hour
  - Refactor 8 high-priority sites to wire sound: 2–3 hours
  - Sound design / asset sourcing (or commissioning): 2–4 hours (this is the biggest lever; reusing iOS system sounds or Expo-bundled tones reduces this to ~30 min)
  - Testing (haptic + audio alignment on device): 1 hour
  - **Total**: ~7–9 hours, heavily front-loaded by sound asset sourcing

---

## Cross-cut observation: sound + haptic + animation trinity

Pass 6 identified 3 distinct feedback tiers:
1. **Haptics** (38 sites): system-level, always-on, works in silent mode
2. **Animation** (7 video captures): visual motion, can be reduced-motion disabled
3. **Sound** (0 sites today): audio, can be system-muted, requires asset budget

**Key insight**: The app's hierarchy is **incomplete without sound**, especially at celebration moments. The cook celebration is the clearest example:
- ✓ Haptic: `CookCompleteModal:53` fires Success
- ✓ Animation: Card should slide up + checkmark draw + XP bounce (currently TBD, flagged as P0 in pass 6)
- ✗ **Sound: MISSING** — no audio cue at all

A fully-polished app would fire **all three together** on victory moments. Similarly:
- **First meal of day**: ring fill animation + Haptics.Success + uplifting tone → feels complete
- **Tier-up**: LevelUpSheet staggered haptics + animation TBD + "level up" chime → feels momentous
- **Coach response complete**: spinner animation + Light haptic on send + "ready" chime on completion → feels responsive

**Recommendation**: When pass 6 P0/P1 animations land, prioritize wiring sound to the same surfaces. The gap between "haptics already here" and "sound is missing" is visible in pass 6's evaluation.

---

## Summary for prioritization

**Implement in order**:
1. **P0**: Cook celebration + First meal of day (these have no animation yet, so sound is even more critical to fill the void)
2. **P1**: Meal log confirm, Coach complete (higher-frequency interactions where audio-haptic sync is noticeable)
3. **P2**: Scan result, Pull-refresh, Level-up sequence (lower frequency, but meaningful for polish)
4. **Never**: Tab bar, lightweight CTAs, option selection

**Quick win**: If sound assets are constrained, use iOS system sounds (`UINotificationFeedback`, `UIImpactFeedback` audio analogs) or Expo-bundled tones for the first pass. This adds zero asset overhead and gives the team time to commission custom Fuel Good branded audio.

