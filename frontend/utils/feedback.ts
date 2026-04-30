/**
 * Feedback — semantic helpers for haptic + (future) sound feedback.
 *
 * Born from UI Audit Pass 6 + Pass 7 findings: the codebase had 38 bare
 * `Haptics.impactAsync(...)` call-sites with no shared semantic layer. Same
 * gestures fired different intensities across screens (e.g. step advance was
 * Success in cook but Light in onboarding). Pass 6 recommended a unifying
 * layer; pass 7 added a sound dimension on top.
 *
 * Use these helpers instead of calling `Haptics.*` directly. Each method
 * encodes the *meaning* of the action, not the mechanism — so if we later
 * decide tier-up should fire Heavy instead of Success, we change one line
 * here and the entire app updates.
 *
 * The optional `{ sound: true }` flag is a no-op today (the app has zero
 * audio playback per pass-7 sound inventory) but the API shape lets us wire
 * `expo-av` later without refactoring every site. When sound lands, ship a
 * small audio bundle (~60 KB gzipped) and switch the `playSound` stub for a
 * real implementation.
 *
 * Important: haptics fire regardless of iOS Reduce Motion setting (pass-7
 * critical accessibility finding) — they're tactile, not motion. The OS
 * itself respects user-level "haptics off" preferences in iOS Settings →
 * Sounds & Haptics, which we don't need to override.
 */
import * as Haptics from 'expo-haptics';

type FeedbackOptions = { sound?: boolean };

// Stub: no audio playback today. Pass-7 inventory recommends `expo-av` + 8
// sound assets. Once installed, replace this stub with `Audio.Sound.playAsync`.
function playSound(_key: SoundKey): void {
  // intentional no-op
}

type SoundKey =
  | 'tap'
  | 'select'
  | 'commit'
  | 'purchase'
  | 'celebrate'
  | 'warn'
  | 'error';

export const Feedback = {
  /**
   * Lightweight UI tap. Use for: option chips, secondary buttons, "next" on a
   * non-final cook step, "skip", "dismiss".
   */
  tap(opts: FeedbackOptions = {}) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (opts.sound) playSound('tap');
  },

  /**
   * Picker-style state change. Use for: Fuel↔MES ring toggle, segmented
   * controls, tri-state pickers, mode switches. Distinct from `tap` so that
   * "I changed something" feels different from "I pressed something".
   */
  select(opts: FeedbackOptions = {}) {
    Haptics.selectionAsync();
    if (opts.sound) playSound('select');
  },

  /**
   * Primary CTA / commit-level action. Use for: "Enable notifications",
   * "Continue past gate", "Start trial preview", "See options". One step
   * heavier than `tap` to signal "this matters".
   */
  commit(opts: FeedbackOptions = {}) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (opts.sound) playSound('commit');
  },

  /**
   * High-stakes action — financial commitment, destructive confirm. Per Apple
   * HIG, Heavy impact for actions where the user has to feel the weight before
   * the action takes effect. Pass-6 audit: paywall purchase fixed Medium → Heavy
   * via this helper.
   */
  purchase(opts: FeedbackOptions = {}) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (opts.sound) playSound('purchase');
  },

  /**
   * Celebration / victory moment. Use for: cook celebration, first meal of
   * day, tier-up, level-up, achievement unlock, scan-result success.
   * Pairs naturally with sound on the highest-leverage moments.
   */
  celebrate(opts: FeedbackOptions = {}) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (opts.sound) playSound('celebrate');
  },

  /**
   * Soft warning — caution but not failure. Use for: confirmation prompts
   * before potentially-undesired actions, validation hints.
   */
  warn(opts: FeedbackOptions = {}) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (opts.sound) playSound('warn');
  },

  /**
   * Hard error — destructive failure, validation failure. Use sparingly;
   * most "errors" should be `warn` instead.
   */
  error(opts: FeedbackOptions = {}) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (opts.sound) playSound('error');
  },
};

export type { SoundKey };
