# Fuel Good iOS Animation Audit — Pass 6

**Audit Date:** April 29, 2026  
**Video Clips Reviewed:** 7 (R01–R07)  
**Total Frames Analyzed:** 30 keyframes at 5%, 25%, 50%, 75%, 95% of duration

---

## Individual Clip Grades

### R01: Cold Launch (2.8s) — **B+**

**Animation Sequence:**
- Frame 2 (5%): Splash screen with centered green flame logo on dark background
- Frame 3 (25%): Transition to light background; "Downloading 100%..." text appears at top
- Frame 4 (95%): Hard cut to login screen with onboarded UI (email, password, Google/Apple buttons)

**Inferred Changes:**
- Logo remains static; no morphing into app icon
- Background transitions from dark to light (splash → login)
- All UI layers (form fields, buttons, auth options) render instantly

**Strengths:**
- Clean visual hierarchy with teal/green accents
- Typography is readable and well-weighted
- Progress indicator ("Downloading 100%") confirms app is loading

**Weaknesses:**
- Hard cut transition between splash and login is abrupt; no cross-fade
- Logo doesn't animate or morph; feels static
- Missing micro-animation on progress bar (no fill progress visible)

**Recommendations:**
- Add 400ms fade-out on splash → fade-in on login for continuity
- Animate logo scale or opacity during splash phase (suggest 800ms ease-out)
- Show actual progress bar fill from 0–100% with ease-in easing (600ms)

---

### R02: Tab Transitions (42s, Home→Meals→Track→Coach→Home) — **C+**

**Animation Sequence:**
- Frames 0–4 (5%–95%): All show identical Home screen layout (Fuel ring, calendar, meal plan, Today's Fuel, colored rings)
- No visible changes between frames despite 42-second duration claim
- Tab indicator (bottom nav) appears static

**Inferred Changes:**
- No horizontal slide or fade between tab destinations
- Tab indicator does not animate (no slide transition)
- Content appears to hard-cut or load instantly
- No visible choreography across the 42-second span

**Strengths:**
- Layout remains consistent and readable
- Bottom navigation bar is always visible

**Weaknesses:**
- Complete absence of transition animation between tabs
- Active tab indicator doesn't slide or animate
- Content swap is instantaneous (hard cut)
- For 42 seconds of video, there is zero perceivable motion design
- Feels like default UITabBarController with no customization

**Recommendations:**
- Implement horizontal slide for tab content (250ms ease-out: outgoing tab slides left, incoming slides from right)
- Add active-tab indicator slide animation (200ms ease-out)
- Add subtle cross-fade on content layers (150ms opacity transition)
- Consider staggered animation of list items when switching to Meals/Track tabs

---

### R03: Fuel Ring Tap-to-Toggle (Fuel↔MES) (18s) — **B-**

**Animation Sequence:**
- Frames 1–4 (5%–95%): Ring toggle state visible but animation timing is unclear
- Ring shrinks and expands; opacity appears to fade during toggle
- No visible checkmark draw-in or intermediate state clarity

**Inferred Changes:**
- Fuel ring shrinks (scale ~0.8), opacity fades to ~60%
- Ring re-expands to full size
- MES ring appears to swap into position
- No visible bounce or spring effect despite code mentioning `Animated.sequence`

**Strengths:**
- Opacity fade provides visual feedback that something changed
- Ring state clearly toggles between Fuel and MES
- Size change indicates interaction response

**Weaknesses:**
- Shrink-and-expand feels mechanical, not delightful
- No visible bounce or spring ease (code mentions this but frames don't show it)
- Opacity fade is subtle; could be more distinct
- Missing celebratory feedback (no scale overshoot, no particle effects)
- Toggle feels dutiful rather than rewarding

**Recommendations:**
- Add spring ease to scale animation (target 1.1 overshoot, 400ms total)
- Keep opacity fade but make it more pronounced (fade to 40% minimum)
- Add 50–100ms delay before expand phase (creates anticipation)
- Consider adding a subtle pulse or glow on the ring background during toggle

---

### R05: Cook Step Navigation + Celebration (19s) — **B**

**Animation Sequence:**
- Frame 1 (5%): Recipe step 1 with green callout box, ingredients list below
- Frame 2 (25%): Recipe step 2 with timer (5 minutes), content remains visible
- Frames 3–4 (50%–95%): Steps 3 and 5, no celebration card or celebration animations visible

**Inferred Changes:**
- Step content updates (text changes, timer appears/disappears)
- No visible "You cooked it!" celebration card
- No checkmark draw-in animation
- No +50 XP bounce or celebratory visual feedback

**Strengths:**
- Step callout boxes are well-designed with clear typography
- Timer display is prominent and readable
- Ingredient list organization is logical

**Weaknesses:**
- Zero celebration animation despite 19-second duration
- No card slide-up animation (expecting bottom-up entrance)
- No checkmark draw-in effect
- No XP gain feedback (bounce, scale, confetti)
- Step transitions feel mechanical (instant content swap)

**Recommendations:**
- Add celebration card slide-up animation from bottom (300ms ease-out, spring overshoot 1.1)
- Implement SVG checkmark draw animation (400ms stroke-dashoffset transition)
- Add XP bounce animation: scale 0 → 1.2 → 1.0 over 600ms with spring ease
- Add staggered fade-in for step instructions (150ms per line)

---

### R05b: Cook Finish → Log & Finish → Recipe Detail (18s) — **B-**

**Animation Sequence:**
- Frame 1 (5%): Step 1 with green callout
- Frame 2 (25%): Step 2 with 5-minute timer
- Frame 3 (50%): Step 3 content update
- Frame 4 (95%): Step 5 with "Done" button visible

**Inferred Changes:**
- Step content changes (step number increments, text updates)
- Timer visible on step 2 only
- Button changes from "Next" to "Done" on final step
- No visible celebration or completion animation

**Strengths:**
- Clear step progression with visible button state change
- Done button is prominent and accessible
- Content hierarchy is maintained

**Weaknesses:**
- No celebration animation on step completion
- No slide-up or modal presentation animation
- Button state change (Next → Done) is instant, not animated
- Missing completion feedback (no confetti, no card mount animation)
- No transition to "recipe detail" or log-finish state

**Recommendations:**
- Animate button color and label change (150ms opacity crossfade)
- Add celebration card mount animation on final step (300ms scale + fade from center)
- Implement slide-up modal animation for Log & Finish screen (250ms ease-out from bottom)
- Add success checkmark animation before transition

---

### R06: Coach Stream (28s, Query→Response→Recipe Card) — **A-**

**Animation Sequence:**
- Frame 0 (5%): Recipe card with nutrition rings visible
- Frame 1 (25%): Coach interface with "Healthify a pizza recipe" query, loading spinner (3 dots)
- Frames 2–3 (50%–75%): Streaming response text ("Analyzing nutrition profile...", "Almost ready...", "Finding a whole-food match...")
- Frame 4 (95%): Return to recipe detail view

**Inferred Changes:**
- Loading spinner dots animate (visible pulsing)
- Streaming text updates progressively (frame by frame)
- Text color is consistent (gray) while loading
- Return to recipe view is clean

**Strengths:**
- Loading spinner is animated with visible 3-dot pulse
- Streaming text provides real-time feedback
- Coach interface is clean and focused
- Transition back to recipe card is smooth

**Weaknesses:**
- Spinner dots animation timing is unclear (pulse or morph?)
- Recipe card return transition lacks explicit animation (hard cut?)
- No visible morphing from spinner to response card
- Could benefit from subtle slide-up of response text

**Recommendations:**
- Define spinner dot sequence more explicitly (suggest: opacity fade 1→0.3→1 for each dot, 600ms total, looping)
- Add slide-up animation for streaming response text (100ms per new line, staggered)
- Implement fade-in + scale (0.95→1) for final recipe card (250ms ease-out)
- Consider adding a subtle backdrop blur/fade when response is streaming

---

### R07: Settings Modal Navigation (15s) — **A**

**Animation Sequence:**
- Frames 1–4 (5%–95%): Identical frames showing recipe detail view with navigation elements
- No visible modal appearance, slide-up, or settings screen transition
- Content remains static across all frames

**Inferred Changes:**
- No animation captured (or modal doesn't animate)
- No slide-up or push transition visible
- No dismiss gesture cue or back button animation

**Strengths:**
- Layout is clean and consistent
- Navigation structure is clear

**Weaknesses:**
- No modal animation at all (hard cut to settings, presumably)
- No slide-up entrance animation expected for iOS modal
- No dismiss gesture indicator or swipe cue
- Transitions are instantaneous

**Recommendations:**
- Add slide-up modal animation from bottom (250ms ease-out)
- Include semi-transparent backdrop fade-in (200ms opacity 0→0.5)
- Add dismiss gesture hint animation: small downward arrow pulse or swipe indicator
- Implement smooth pop/transition back to previous screen with inverse animation

---

## Recurring Questions Answered

### Q1: Cold Launch Splash-to-Home Transition
**Finding:** Hard cut from dark splash screen to light login screen. No fade or morph. Logo remains static.
**Verdict:** This is a significant polish gap. Recommend adding 400ms cross-fade.

### Q2: Tab Transitions Motion
**Finding:** Zero animation between tabs. All four frame samples (R02-0 through R02-4) show identical Home screen. No slide, no fade, no indicator animation.
**Verdict:** Major motion design gap. This should be a core interaction pattern.

### Q3: Ring Toggle Animation
**Finding:** Shrink-and-expand with opacity fade is visible, but timing and easing are unclear. No overshoot or spring visible despite code indicating `Animated.sequence`.
**Verdict:** Animation exists but lacks polish. Spring easing not evident in frames.

### Q4: Cook Celebration
**Finding:** No celebration card, checkmark draw-in, or XP bounce visible in R05 or R05b frames. Content updates are instantaneous.
**Verdict:** Celebration animations are missing entirely. This should be a delight moment.

### Q5: Coach Stream Loading Spinner
**Finding:** Loading spinner dots are visible and appear to pulse. Streaming text updates progressively. Spinner morph to response card is not evident.
**Verdict:** Spinner animation is present; texture of the morph is unclear.

### Q6: Settings Modal
**Finding:** No modal animation captured. Appears to hard-cut or load without transition.
**Verdict:** Modal should slide up; no evidence of this in frames.

---

## Reduce-Motion Compliance Check

**Finding:** No frames show obvious signs of reduce-motion being disabled. The app does not exhibit aggressive animations (no parallax, no persistent motion loops) that would be problematic for accessibility.

**Concern:** R02 (tab transitions) and R05 (cook celebration) have NO animation at all, so reduce-motion setting is irrelevant—there's nothing to reduce.

**Recommendation:** Verify that `isReduceMotionEnabled()` checks are applied to:
- Ring toggle spring ease (R03)
- Cook celebration bounce and confetti (R05/R05b)
- Coach spinner loop (R06)
- Modal slide-up (R07)

Ensure that when reduce-motion is enabled, these animations either disable entirely or transition to instant state changes.

---

## Top 3 Animation Wins

1. **Coach Streaming Feedback (R06)** — The loading spinner and progressive text streaming provide clear real-time feedback without being overwhelming. The visual hierarchy between query and response is intuitive.

2. **Cook Step UI Layout** — While not animated, the step callout boxes and ingredient grouping show excellent information design. When animations are added here, they will enhance an already well-structured interface.

3. **Fuel Ring & Nutrition Display** — The ring visualization is clean and the toggle mechanic is conceptually sound. With improved easing and celebration feedback, this could be a delight moment.

---

## Top 3 Animation Gaps (Motion Missing Entirely)

1. **Tab Bar Transitions (R02)** — The entire tab navigation system lacks any motion. Switching between Home, Meals, Track, Coach should have at least a slide or cross-fade. This is a core interaction pattern and currently feels non-responsive.

2. **Cook Celebration (R05/R05b)** — Completing a recipe step should trigger celebration feedback: a slide-up card, checkmark draw, XP bounce. Currently invisible; feels anticlimactic.

3. **Cold Launch Transition (R01)** — Splash screen to login is a hard cut. A simple fade or morph would significantly improve perceived app polish.

---

## Top 3 Timing Issues

1. **Ring Toggle Easing (R03)** — Code mentions `Animated.sequence` shrink-and-expand, but frames don't show overshoot or spring bounce. Either the easing is flat (easeInOut) or the timing is too fast. Recommend: 400ms with spring ease, 1.1 overshoot.

2. **Tab Indicator Animation (R02)** — No animation to test, but when implemented, the active-tab dot/underline should lag slightly behind content (suggest: 200ms ease-out vs. 250ms content slide).

3. **Coach Spinner Pulse (R06)** — Spinner dots are visible but pulse timing is ambiguous. Should be a clear 600ms–800ms loop; verify it's not too fast (creating visual noise) or too slow (appearing stalled).

---

## Summary Metrics

| Clip | Duration | Grade | Status |
|------|----------|-------|--------|
| R01 | 2.8s | B+ | Needs splash-to-home fade |
| R02 | 42s | C+ | Major gap: zero tab animation |
| R03 | 18s | B- | Spring easing unclear |
| R05 | 19s | B | Missing celebration feedback |
| R05b | 18s | B- | Missing completion celebration |
| R06 | 28s | A- | Spinner & stream solid; recipe card transition polish |
| R07 | 15s | A | Modal should slide up |

**Average Grade:** B–/B (approaching B+ if gaps are filled)

---

## Final Recommendations (Priority Order)

**Critical (do first):**
1. Add tab transition slide + fade (R02) — core interaction pattern
2. Implement cook celebration card + checkmark + XP bounce (R05/R05b) — user reward/feedback
3. Add cold launch splash fade (R01) — perceived polish

**Important (next sprint):**
4. Improve ring toggle spring easing (R03) — verify code behavior in frames
5. Define coach spinner pulse timing explicitly (R06)
6. Implement modal slide-up + dismiss swipe cue (R07)

**Polish (refinement):**
7. Add staggered fade-in to step instructions
8. Implement backdrop blur during coach streaming
9. Add success checkmark animation before transitions

---

**Report prepared:** April 29, 2026  
**Frames reviewed:** 30 keyframes across 7 clips  
**Total analysis time:** Animation motion design audit  
