# Onboarding Audit: Fuel Good vs. Best-in-Class Apps

## Tweet Insights Summary

**Tweet 1 — Jose (Brainrot/Clandle analysis by Cesar):**
- Start with a short video demo — instant clarity
- Clearly show the problem the app solves
- Smooth animations and interactions throughout
- Collect user data early
- Explain how the app solves the problem
- Ask for a review mid-onboarding
- Hard paywall → close = 50% discount → close again = 80% discount

**Tweet 2 — Cesar (Cal AI analysis):**
- Short demo video first
- Deep personalization throughout
- Full of animations and cool interactions
- Prompts for review mid-onboarding
- Generates a personalized plan
- Soft paywall with "free" trial (via annual plan)
- Heavily pushes annual plan with 75% discount
- Monthly plan without trial as second option

**Tweet 3 — Jose (TikTok onboarding):**
- Even TikTok teaches users to swipe — nothing is "obvious enough"
- You need to hand-hold users through your core interaction

---

## Your ONBOARDING.md Principles (and Honest Assessment)

Your doc captures the right philosophy — it's closely aligned with what these successful apps actually do. But there are a few areas where I'd push back or add nuance:

### Where your doc is strong:
- Three-act structure (problem → aha → paywall) ✅ you've implemented this
- Mirroring answers back ✅ your 16-combo matrix is excellent
- Sunk cost via 10-15 min investment ✅ you have 12 screens
- Core feature demo during onboarding ✅ live scan exists
- Review request at peak excitement ✅ you trigger it post-scan
- Commitment before paywall ✅ commitment screen with objection handling

### Where your doc needs updating:
- **"Don't do anything else other than getting your onboarding right"** — this is right in spirit, but you should also A/B test paywall strategies, not just the onboarding flow itself
- **Missing from doc: video demo hook** — every top app starts with a VIDEO, not animated UI components. This is the single biggest gap.

---

## Screen-by-Screen Audit of Your Current Onboarding

### Screen 1: Video Hook (video-hook.tsx) — NEEDS WORK

**What you have:** 4 auto-advancing animated "scenes" built with React Native Animated (score counters, ingredient flags, bar charts, feature pills). No actual video.

**The problem:** This is NOT a video. It's a sequence of animated UI components. Every top-performing app in the tweets (Brainrot, Cal AI, Clandle) starts with an actual pre-recorded video demo of the app in action. There's a massive difference:

- A real video shows the actual app, real food being scanned, real results — it builds instant trust
- Animated UI components feel like a "loading screen" or marketing pitch
- Video creates emotional resonance; animated counters create cognitive load

**Recommendation:** Replace with a 15-20 second screen recording of someone using the app — scanning a product, seeing the score, getting a swap suggestion. Overlay text if needed. This is your single highest-impact change.

### Screen 2: Problem Statement (problem-statement.tsx) — GOOD BUT REORDER

**What you have:** "Healthy eating shouldn't feel like punishment. No calorie counting. No restriction. Just eat real food — and earn your cheat meals."

**Issue:** This comes after the "video hook" but before any questions. The best apps (Brainrot, Clandle) weave the problem statement into the video itself. Having it as a standalone static screen feels like dead weight.

**Recommendation:** Merge this into the video hook. The video should end with the problem statement as a text overlay, then immediately transition to questions. One fewer tap = less drop-off.

### Screen 3-4: Energy Check + Diet History — SOLID

These are well-designed question screens that serve the dual purpose outlined in your ONBOARDING.md: collecting data AND making users self-reflect. The options are well-crafted — "fall off," "bored," "restricted," "lost" all carry emotional weight.

**Minor improvement:** Add a subtle progress animation or micro-interaction when they select an answer (brief color pulse, slight card expansion). Cal AI is noted for "cool interactions" — these small touches matter.

### Screen 5: Mirror — EXCELLENT

Your 16-combo matrix is genuinely impressive. Lines like "You said you feel tired after eating and healthy food bores you. What if the food that fuels you also excites you?" are strong.

**One concern:** The mirror screen goes directly to meal-reveal, skipping goal-context. But the mirror references the user's problem — the natural next thought is "so how do we fix this?" which should flow into seeing the solution (meals), not collecting more data. Your current flow (mirror → meal-reveal → goal-context) is actually correct psychologically.

### Screen 6: Meal Reveal — GOOD, BUT MISSING PHOTOS

**What you have:** Three MealCards (Shawarma Bowl, Smash Burger, Turkish Eggs) with text descriptions and fuel scores.

**The problem:** No food photography. This is a food app. The meal reveal is supposed to make users drool. Text descriptions of meals with score badges don't create desire — photos do.

**Recommendation:** Add actual meal photos. Even placeholder photos are better than none. This screen should be your most visually striking screen. The user should think "wait, I can eat THAT and it's healthy?" That's a second aha moment.

### Screen 7: Goal Context — FINE BUT LONG

6 sub-steps (goal, age, height, weight, sex, activity) in one screen. This is a lot of data collection in sequence.

**Recommendation:** Consider whether you actually need all of this during onboarding. Height/weight/sex/activity are needed for metabolic calculations, but do users need to see those results during onboarding? If not, you could defer some of these to post-paywall setup and reduce friction. Cal AI collects this data but weaves it throughout the flow rather than batching it.

### Screen 8: Plan Preview — GOOD

Shows the weekly bar chart, average score, and flex tickets earned. Personalizes based on goal and activity level.

**Improvement:** The plan preview shows a generic week. It should use the user's actual goal to frame the narrative. If they said "lose weight" → "Your fat loss week: 5 clean days, 2 flex meals, still averaging 87.6." If they said "more energy" → "Your energy week: feel the difference by day 3." Personalization should be reflected in the copy, not just the flex count.

### Screen 9: Live Scan — YOUR BEST SCREEN

This is your core feature demo and aha moment. The scan → result → flags → swap flow is well-paced. The staggered flag reveals build suspense. The swap suggestion delivers the payoff.

**What's working:** Review prompt triggers right after scan completion (peak excitement). The "Show me an example" fallback is smart for users who aren't near food. The scanning animation with corner brackets and moving bar is polished.

**Improvement:** After the scan result, you should explicitly call out: "This is what premium members see every time they scan." Frame it as a preview of ongoing value, not a one-time demo.

### Screen 10: Social Proof — NEEDS RETHINKING

**What you have:** "12,400+ people improved energy in week one," one testimonial, and a 4.8 star rating badge.

**Problems:**
1. If you're a new app, these numbers may not be real yet — and users can check. Fake social proof destroys trust faster than no social proof.
2. One testimonial feels thin. Three minimum.
3. The screen is passive — user just reads and taps Continue.

**Recommendation:** If you have real reviews, show 3-4 short ones. If you don't have real numbers, drop this screen entirely and replace it with a "what you'll get" recap screen that summarizes the personalized plan. Fake social proof is worse than none.

### Screen 11: Commitment — STRONG

The "Are you ready?" → "Yes, let's go" / "Not yet" → objection handling flow is textbook Cialdini. The three objection responses are well-written.

**Issue:** The auto-navigate to paywall after 2.5s of showing the objection response is too fast. The user barely has time to read "We have a plan for every budget. And it pays for itself in groceries saved." before being shipped to the paywall. Give them 4-5 seconds, or better yet, add a "See plans" CTA button that lets them proceed when ready.

### Screen 12: Paywall — GOOD MECHANICS, NEEDS POLISH

**What's working:**
- Escalating discounts (full → 50% → 80%) match the Brainrot strategy exactly
- Feature list is clear
- CTA pulse animation adds urgency
- "Restore purchases" link at bottom

**Issues and recommendations:**

1. **Free trial framing:** Your CTA says "Start your 7-day free trial" but you don't emphasize this enough. Cal AI's strategy is to frame the annual plan AS a free trial — "Try free for 7 days, then $59.99/year." The word "free" should be the biggest thing on the screen.

2. **Missing "generating your plan" loading screen:** Top apps (Cal AI, Noom, etc.) add a fake "generating your personalized plan" loading screen right before the paywall. It takes 5-10 seconds with progress animations and shows things like "Analyzing your profile... Building your meal plan... Calculating your flex meals..." This does two things: builds anticipation and adds more sunk cost time. You should insert this between commitment and paywall.

3. **No "what you'll lose" framing:** When users dismiss the paywall, you show a discount. But you should also remind them what they're giving up: "Without Fuel Good, you won't know what's really in your food." Loss aversion is stronger than discount attraction.

4. **Weekly plan pricing is too visible at full price:** At $4.99/week, that's $260/year vs $60/year for annual. The weekly option makes the annual look cheap, which is good — but it also signals "this app is expensive." Consider hiding the weekly option behind a "see all plans" toggle, or making the annual the only visible option initially (Cal AI does this).

---

## What's Missing Entirely

### 1. Real Video Demo (CRITICAL)
Every app cited in the tweets leads with video. You have animated components pretending to be a video. Record a 15-20 second screen capture of the app in action and use it.

### 2. "Generating Your Plan" Loading Screen (HIGH IMPACT)
Insert between commitment and paywall. Fake 8-10 second loading with progress messages: "Analyzing your metabolism...", "Building your meal plan...", "Calculating your flex meals..." End with a checkmark and "Your plan is ready." This is a standard pattern in top health apps and significantly increases paywall conversion because:
- More sunk cost (10 more seconds invested)
- Creates anticipation ("I need to see MY plan")
- Makes the paywall feel like it's gating something that was just built for them

### 3. Notification Permission Request
No notification opt-in anywhere in onboarding. Best practice is to request this right after a positive moment (post-scan or post-meal-reveal), framed as "Get daily meal reminders and flex updates." Notifications are your primary re-engagement channel — this is a revenue lever.

### 4. Contextual Data Collection (Where did you hear about us?)
Clandle collects "where you discovered the app" during onboarding. This is marketing gold for attribution — helps you know which channels actually convert. Add one question: "How did you find Fuel Good?" with options like App Store, TikTok, Instagram, Friend, Other.

### 5. Food Photos in Meal Reveal
Already mentioned above — this is a food app without food photos in its onboarding.

---

## Challenging Your ONBOARDING.md Ideas

### "The longer your onboarding, the better it converts"
**Partially disagree.** Length only helps if every screen is emotionally engaging or builds investment. Your goal-context screen (height/weight/sex) is pure data collection with zero emotional engagement. That's where users check out. Length works when it's psychological depth, not form fields.

### "Show your review modal right after the core feature"
**Agree, but with a caveat.** You trigger `StoreReview.requestReview()` after a 3-second delay post-scan. But on iOS, Apple throttles this — users might only see it once per year regardless of when you call it. Make sure you're also tracking whether the prompt actually appeared (iOS doesn't tell you), and if it didn't, consider showing your own custom "Rate us" card later in the app.

### "At least 10% conversion rate"
**This depends entirely on your acquisition channel.** If you're running paid ads, 10% is ambitious. If you're getting organic App Store traffic, 10% is achievable. The more important metric is revenue per install, not conversion rate — because a 5% conversion rate with a $60 annual plan beats a 15% conversion rate with a $12 annual plan (your 80% discount).

### Your escalating discount strategy (50% → 80%)
**This works but has a risk.** Users who discover this pattern (through reviews, TikTok, Reddit) will always dismiss twice to get 80% off. You're training your most engaged users to never pay full price. Consider: first dismiss = 50% off with 24-hour timer, second dismiss = free tier with limited features (not 80% off). The scarcity + free tier combination often outperforms deep discounts.

---

## Priority-Ordered Action Items

1. **Record and insert real video demo** — Replace animated scenes with actual app footage
2. **Add "generating your plan" loading screen** — Between commitment and paywall
3. **Add food photography to meal reveal** — This is a food app, show food
4. **Add notification permission request** — After scan or meal reveal
5. **Increase objection response display time** — 2.5s → 5s or add explicit CTA
6. **Add attribution question** — "How did you find Fuel Good?"
7. **Merge problem statement into video** — Eliminate one tap
8. **Rethink social proof screen** — Use real data or replace with value recap
9. **Add "what you'll lose" copy to paywall dismissal** — Loss aversion framing
10. **Reconsider 80% discount on third paywall** — Risk of training users to dismiss
11. **Personalize plan preview copy** — Match headline to user's stated goal
12. **Consider deferring height/weight/sex** — Reduce friction in goal-context
