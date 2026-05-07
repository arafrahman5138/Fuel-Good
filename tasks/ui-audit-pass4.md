# Fuel Good iOS UI Audit — Pass 4 (2026-04-29)

*Fourth dark-mode pass. Companion to [pass 1](ui-audit.md), [pass 2](ui-audit-pass2.md), and [pass 3](ui-audit-pass3.md). Pass 3 ran the seed script and saw the app data-rich for the first time. This pass walks the **complete user funnel from cold-launch through a full session** — 76 screenshots covering login → signup → 13-step onboarding → premium modal → home → flex → today's plan → meal plan builder → kitchen hub → meals browse → recipe detail → desserts → track (fuel + metabolic) → coach (init → typed → response → drawer) → profile.*

**Scope**: 76 new dark-mode screenshots in [tasks/ui-audit-pass4/screenshots/dark/](ui-audit-pass4/screenshots/dark/). Combined with prior passes, ~263 total screenshots.

---

## The single most important finding

**Pass 3 said the app looks like a premium product once seeded. Pass 4 confirms that — but reveals the *journey to that premium state* is where the cracks show.** The first 15 minutes of a brand-new user's life (signup → 13-step onboarding → premium modal → first home view) are uneven: onboarding itself is genuinely strong (A/A- across the board), but the **handoff into the empty home state** undoes some of that good will. Two specific moments in pass 4 erode trust right after onboarding completes:

1. The **red empty-state Fuel ring** still dominates first-load Home (flagged Critical in pass 3 — *not fixed*).
2. The **Flex Budget entry card** also uses red ("FLEX DAY · 0 meals · 4 flex left"), which doubles down on the red-as-danger reading and confuses Flex's reward semantics with Fuel's penalty semantics.

A user who just spent 15 minutes telling Fuel Good about their PCOS, runs, and flavor preferences shouldn't be greeted by two red rings that read as "you're already failing." This is the highest-impact polish item left in the app.

---

## Pass 3 findings — what changed

| # | Pass 3 finding | Pass 4 status |
|---|----------------|---------------|
| 1 | **Empty-state red Fuel ring** (Critical) | **Not fixed.** Visible on [20-home-empty](ui-audit-pass4/screenshots/dark/20-home-empty.png) immediately after onboarding completes. "READY TO FUEL" badge doesn't mitigate the crimson hero ring. |
| 2 | **"THIS WEEK" all-caps reads as a verdict, not a counter** | **Not fixed.** Still all-caps on the empty Home ring. |
| 3 | **Recipe card cal+protein both mustard/amber** (no visual separation) | **Not fixed.** Persists across [31-meals-browse](ui-audit-pass4/screenshots/dark/31-meals-browse.png) and [33-meals-desserts](ui-audit-pass4/screenshots/dark/33-meals-desserts.png). Should split: cal = neutral grey, protein = brand green. |
| 4 | **Filter chip row truncates ("Me…")** in Browse | **Not fixed.** Still cut off right edge. No horizontal-scroll affordance added. |
| 5 | **Recipe hero photos not uniformly cropped** | **Partially fixed.** Most cards now ~1:1; a few still landscape (Gochujang vs Baked Ziti). |
| 6 | **Metabolic toggle had weak active-state visual** | **FIXED.** [41-track-metabolic](ui-audit-pass4/screenshots/dark/41-track-metabolic.png) shows orange-filled active toggle vs grey ghost — strong differentiation. |
| 7 | **Healthify recipe-card response schema = high-water mark** | **Possible regression.** [52-coach-response](ui-audit-pass4/screenshots/dark/52-coach-response.png) through 52e show **plain-text only** — no inline recipe cards, no MES pills, no images. Either query-dependent (some prompts get cards, some don't) or a real regression. **Verify before shipping.** |
| 8 | **7-day MES chart on Track** | **Possible regression.** [40-track](ui-audit-pass4/screenshots/dark/40-track.png) shows month calendar with day-29 selected but **no per-day MES bar chart** under the "1 week" header. Pass 3 captured a 7-bar visualization here. |
| 9 | **Coach drawer overlay should darken background** | **Not fixed.** [53-coach-drawer](ui-audit-pass4/screenshots/dark/53-coach-drawer.png) — chat thread behind drawer remains fully visible/undarkened. |
| 10 | **Cook mode = excellent** (A grade) | **Not captured this pass** — no cook-mode screenshots in pass 4. Re-test next pass. |

**Net change**: 1 win (metabolic toggle), ~5 unfixed pass-3 items still present, 2 possible regressions to verify. The visual debt graph is **flat to slightly negative since pass 3** despite landing other features.

---

## New screens captured (not seen in prior passes)

### Auth & Onboarding (login → premium modal)

13-step funnel captured end-to-end. Average grade: **A-/A**. Onboarding is the strongest stretch of the app.

#### Login + Signup
[01-login](ui-audit-pass4/screenshots/dark/01-login.png) · [02-signup](ui-audit-pass4/screenshots/dark/02-signup.png) · [02-signup-filled](ui-audit-pass4/screenshots/dark/02-signup-filled.png)

**Grade**: A-
**What works**: Centered hierarchy, Fuel Good brand visible, dark-mode contrast on email/password fields is good, Apple/Google secondary options keep the page uncluttered, "Forgot password?" in brand green is discoverable.
**What's subpar**:
- **No back affordance from Login** — a user who hits Login by mistake from a marketing link has no way out without signing in.
- **Sign In button visually merges with the home indicator / safe-area inset** — needs ~16pt bottom padding.
- **No password-strength indicator on signup** — users only learn requirements on submit failure.
- Password placeholder reads "Enter password" — could set expectations with "At least 8 characters."
**Priority**: Low

#### Post-signup welcome
[03-after-signup](ui-audit-pass4/screenshots/dark/03-after-signup.png)

**Grade**: A
**What works**: Brand voice lands ("Most of what's sold as food wasn't food 50 years ago…"), 5-minute setup expectation is set top-left, logo reassures.
**What's subpar**: Headline "You already know something is off" is bold but slightly ominous for a user who *just* committed their email. Soften to "You're here because you want better."
**Priority**: Low

#### Goal context, diet history, mirror snapshot
[05-onb-goal-context](ui-audit-pass4/screenshots/dark/05-onb-goal-context.png) · [05b-onb-goal-context-selected](ui-audit-pass4/screenshots/dark/05b-onb-goal-context-selected.png) · [06-onb-diet-history](ui-audit-pass4/screenshots/dark/06-onb-diet-history.png) · [07-onb-mirror-snapshot](ui-audit-pass4/screenshots/dark/07-onb-mirror-snapshot.png)

**Grade**: A
**What works**: "What brought you here?" is conversational, "Tap what resonates. No wrong answers." de-risks the choice. The Mirror Snapshot ("You eat ultra-processed food a few times a day. 60% of average American diet…") is data-driven personalization that earns trust early.
**What's subpar**:
- Selected state on resonance chips is **outline-only with checkmark, no fill** — feels uncertain on dark mode. Add 12% green fill.
- Mirror Snapshot's three text blocks (intro / stat / "Your snapshot") have no dividers — hierarchy is flat.
**Priority**: Low

#### Fuel & Flex explainers
[08-onb-fuel-explainer](ui-audit-pass4/screenshots/dark/08-onb-fuel-explainer.png) · [09-onb-flex-explainer](ui-audit-pass4/screenshots/dark/09-onb-flex-explainer.png)

**Grade**: A
**What works**: 08's green "85 FUEL" ring teaches the scoring system in one frame. 09's 7-day calendar (Mon–Sun, mostly green checkmarks + one amber Friday + two orange flex days) teaches the reward system viscerally. "You don't have to be perfect" headline is a brand-defining moment — anti-Noom positioning made tangible.
**What's subpar**:
- Fuel ring is **static** — no "see how it moves" affordance to suggest the ring will respond to logging.
- Flex calendar's day labels are small; weekend days could be color-tinted to anchor the "flex weekend" mental model.
**Priority**: Low

#### Flavor, dietary, protein preferences
[10-onb-flavor-prefs](ui-audit-pass4/screenshots/dark/10-onb-flavor-prefs.png) · [10b-onb-flavor-selected](ui-audit-pass4/screenshots/dark/10b-onb-flavor-selected.png) · [11-onb-dietary](ui-audit-pass4/screenshots/dark/11-onb-dietary.png) · [12-onb-protein](ui-audit-pass4/screenshots/dark/12-onb-protein.png) · [12b-onb-protein-selected](ui-audit-pass4/screenshots/dark/12b-onb-protein-selected.png)

**Grade**: A-
**What works**: Multi-select chip flow with clear "Pick 2–4 flavors" guidance. Selected state in 10b/12b is bright green outline + checkmark — clear. Three-part protein flow (Like / Avoid / Ingredients dislike) is comprehensive.
**What's subpar**:
- **Flavor chip icons are too small (~16pt)** — Savory leaf, Sweet drop, Tangy lemon are hard to distinguish. Bump to 20–24pt.
- **"Vegetarian" appears under "Proteins you like"** — it's a diet, not a protein. Should be in Dietary.
- Allergies header is sized smaller than Dietary header — section weight is unbalanced.
- Three sequential like/avoid/dislike sections feel repetitive — consider a single tri-state chip (love / neutral / avoid).
**Priority**: Medium (information-architecture fix on protein page)

#### Body stats funnel
[13-onb-body-stats](ui-audit-pass4/screenshots/dark/13-onb-body-stats.png) → [13f-onb-body-activity](ui-audit-pass4/screenshots/dark/13f-onb-body-activity.png) (6 screens)

**Grade**: A
**What works**: Dual-unit Height (ft + in) is correctly US-centric. Activity Level options (sedentary → daily training) are comprehensive. Selected states in 13d–13f use bright green fill — clear.
**What's subpar**:
- **Weight field has no unit suffix** — placeholder "e.g. 165" but no "lbs" tag. Add inline unit.
- **Height ft/in fields run together** with no visible divider.
- **Goal-row icons (lose body fat ↓ / build muscle +) are tiny (~14pt)** vs the 16pt+ button text — visual mismatch.
- Meal-frequency buttons (2/3/4/5+) are ghost-styled and disappear into the background until selected.
**Priority**: Medium

#### Energy check, personal targets, meal reveal, commitment
[14-onb-energy-check](ui-audit-pass4/screenshots/dark/14-onb-energy-check.png) · [15-onb-personal-targets](ui-audit-pass4/screenshots/dark/15-onb-personal-targets.png) · [16-onb-meal-reveal](ui-audit-pass4/screenshots/dark/16-onb-meal-reveal.png) · [16b-onb-meal-reveal-scrolled](ui-audit-pass4/screenshots/dark/16b-onb-meal-reveal-scrolled.png) · [17-onb-commitment](ui-audit-pass4/screenshots/dark/17-onb-commitment.png) · [17b-onb-commitment-selected](ui-audit-pass4/screenshots/dark/17b-onb-commitment-selected.png)

**Grade**: A (16-meal-reveal is **A+** — best moment of onboarding)
**What works**: 16 shows a green "85 FUEL SCORE" ring + amber "57 PROJECTED DAILY SCORE" + breakfast/lunch/dinner/dessert flex meals each with Fuel + Energy labels. The copy "Three meals, a dessert, and real food. Every one scores Fuel 100." is the strongest persuasion moment in the funnel. 17 summarizes onboarding in a 3-bullet checklist with personalization recap card. "Yes, I'm all in" CTA is large, filled, brand-green.
**What's subpar**:
- **15-personal-targets shows 165g Protein / 132g Carb ceiling / 30g Fiber / 71g Fat in white text** — no MacroColors applied. The target screen is the *one* place in onboarding that should color-code macros to teach the visual language used elsewhere.
- **Meal-reveal cards are text-only** — no recipe hero photos. Pass 3 confirmed photos exist for 117 seeded recipes. Adding photos here would make the reveal feel like the "meal magazine" promised in marketing.
- **Energy-Level chip colors are inconsistent** in 16 — Moderate (amber), Good (green), High (green) — no ramp, just two tiers. Add a 4-step ramp (low/moderate/good/high) with consistent semantics.
- "Pass4 Tester's profile" recap card (17) is cramped at 12pt; bump to 14pt.
**Priority**: Medium (15-personal-targets MacroColors)

#### Premium modal & first-home reveal
[18-onb-premium-modal](ui-audit-pass4/screenshots/dark/18-onb-premium-modal.png)

**Grade**: B+
**What works**: "Premium Active · You already have premium access" modal with OK button is clear. "+ Create Plan" CTA below is inviting. Tab bar is visible — anchors orientation.
**What's subpar**:
- **Modal has no opaque backing card** — text floats over a semi-transparent dark overlay; readable but low-contrast.
- **Red Fuel ring already visible behind the modal** — undermines the "premium access" celebration. The ring should be neutral grey on a brand-new account that has logged zero meals.
- **Tab bar shows only Home as labeled** — labels should appear consistently for all tabs, not just the active one.
**Priority**: Critical (red ring under modal) · Medium (modal styling)

---

### Home, Flex Budget, Today's Plan, Meal Plan Builder

#### Home (empty state)
[20-home-empty](ui-audit-pass4/screenshots/dark/20-home-empty.png) · [20b](ui-audit-pass4/screenshots/dark/20b-home-scrolled-1.png) · [20c](ui-audit-pass4/screenshots/dark/20c-home-scrolled-2.png) · [20d](ui-audit-pass4/screenshots/dark/20d-home-scrolled-3.png) · [20e-home-top](ui-audit-pass4/screenshots/dark/20e-home-top.png) · [22-home-after-back](ui-audit-pass4/screenshots/dark/22-home-after-back.png) · [60-home-back](ui-audit-pass4/screenshots/dark/60-home-back.png)

**Grade**: B-
**What works**: Day-of-week selector (Sun–Sat) is functional. "4 flex meals available" pill is a strong amber accent. "Today's Plan" and "Today's Fuel" cards have clear empty-state copy. "+ Create Plan" CTA is unmissable.
**What's subpar**:
- **Red Fuel ring** (see "single most important finding" above) — Critical, unfixed.
- **"Your personal chef is ready"** card is visually orphaned from the rest of Home — no clear connection to "Today's Plan" above.
- **No visual hierarchy between cards** — Today's Plan (blank), Today's Fuel (blank), Create Plan (CTA), and Flex pill all compete for attention.
**Priority**: Critical (ring), Medium (hierarchy)

#### Flex Budget entry & detail
[21-home-flex](ui-audit-pass4/screenshots/dark/21-home-flex.png) · [21b-flex-scrolled](ui-audit-pass4/screenshots/dark/21b-flex-scrolled.png) · [23-flex-detail](ui-audit-pass4/screenshots/dark/23-flex-detail.png) · [23b-flex-detail-scrolled](ui-audit-pass4/screenshots/dark/23b-flex-detail-scrolled.png)

**Grade**: A- (entry) / A (detail)
**What works (entry)**: Full-screen overlay with back chevron, "Weekly Fuel" toggle chip with green dot, day-by-day list with "TODAY" badge on Wed.
**What works (detail)**: "Your Flex Budget" with 4 amber flex-meal pills, "How Flex Works" 4-bullet education with color-coded icons (green/amber/teal/purple), "Log a Cheat Meal" affordance, "This Week" accounting (0 used, 21 remaining).
**What's subpar**:
- **Flex day card uses the SAME RED as the empty Fuel ring** — semantic confusion. Flex should be amber or neutral; red signals penalty, not reward. **High priority.**
- "Rest day" label repeated on every weekday is visual noise — only mark non-flex days.
- The 4 educational bullets in 23b use 4 different colors (purple/teal/green/amber) — too many accents, doesn't map to MacroColors. Consolidate to 2.
- Three stat values (80% / 0 / 0) on detail screen don't visually connect to their labels — could use pill backgrounds or table layout.
**Priority**: High (red Flex card), Medium (color rationalization)

#### Today's Plan (empty)
[24-today-plan-empty](ui-audit-pass4/screenshots/dark/24-today-plan-empty.png)

**Grade**: C+
**What works**: Title clear. "+ Create Meal Plan" CTA prominent. "New Plan" secondary CTA top-right.
**What's subpar**:
- Empty-state value-prop ("low-carb breakfasts, higher-MES lunches and dinners, built-in prep guidance") is **buried in 14pt body copy** — users will tap Create before reading it.
- Empty-state icon is a generic grey grid — no warmth or visual hint of what's coming.
- No time-to-complete affordance ("takes ~2 minutes") to set expectation.
- This is the **weakest empty state in the app**.
**Priority**: Medium

#### Meal Plan Builder
[25-meal-plan-builder](ui-audit-pass4/screenshots/dark/25-meal-plan-builder.png) · [25b-meal-plan-builder-scrolled](ui-audit-pass4/screenshots/dark/25b-meal-plan-builder-scrolled.png)

**Grade**: A-
**What works**: "Step 1 of 2" with green progress bar at 50%. Flavor preferences shown as filled chips ("Spicy, Savory, Umami" in green). Plan Style icons (meal prep vs balanced) with green border on selection. Inline Edit affordances on Restrictions and Allergies.
**What's subpar**:
- **Three separate Edit affordances** (Restrictions, Allergies, Plan Style) require leaving the flow each time — should be inline-toggleable.
- "Spicy, Savory, Umami" green chips don't make it clear whether these are *current* selections or *suggested* ones — needs label "Your preferences:" vs "Pick preferences:".
- Plan Style shows only 2 options (meal prep / balanced); they're left-aligned and look off-balance. Center them.
**Priority**: Medium

#### Kitchen Hub
[26-home-after-back-2](ui-audit-pass4/screenshots/dark/26-home-after-back-2.png) · [30-meals-hub](ui-audit-pass4/screenshots/dark/30-meals-hub.png)

**Grade**: A
**What works**: 6-card 2×3 grid with strong color differentiation (Meals = green, Meal Prep = teal, Desserts = amber, My Plan = navy, Saved = purple, Grocery = forest green). Each card has icon + descriptive subtext. "Eat / What are you looking for?" header is friendly. **This is the most visually delightful navigation surface in the app.**
**What's subpar**:
- 6 cards with equal weight — no primary CTA, so users dwell deciding which to tap. Consider promoting Meals + My Plan as primary, demoting Saved + Grocery to a smaller row.
- Icon weights vary slightly between cards (Meals fork is cleaner than Desserts bulb) — unify to one icon set.
**Priority**: Low

---

### Meals → Browse, Recipe Detail, Desserts

#### Meals Browse
[31-meals-browse](ui-audit-pass4/screenshots/dark/31-meals-browse.png) · [31b](ui-audit-pass4/screenshots/dark/31b-meals-browse-scrolled.png)

**Grade**: A-
**What works**: 2-column grid with magazine-quality hero photos (Gochujang, Borek Rolls, Baked Ziti, Bang Bang Chicken). Time + difficulty pills (30m, easy / 50m, medium) in grey. Cal + protein pills in rust/amber. "20 recipes found" count. Filter chips: Full Meals (filled green) / Meal Prep (outlined) / Protein / Carb / Cook Time.
**What's subpar**:
- **Filter row truncates** ("Me…" cut off right) — pass 3 finding, still unfixed. Add horizontal-scroll affordance.
- **Cal + protein both rust/amber** — pass 3 finding, still unfixed. Split: cal = neutral grey, protein = brand green.
- Hero crop inconsistency continues (Gochujang landscape vs Baked Ziti square-ish) on a few cards.
**Priority**: Medium (both items pass-3 carryover)

#### Recipe Detail
[32-recipe-detail](ui-audit-pass4/screenshots/dark/32-recipe-detail.png) · [32d-recipe-scrolled-3](ui-audit-pass4/screenshots/dark/32d-recipe-scrolled-3.png) · swipe states [32i](ui-audit-pass4/screenshots/dark/32i-recipe-swiped.png) · [32j](ui-audit-pass4/screenshots/dark/32j-recipe-swiped-2.png)

**Grade**: A (maintained from pass 3)
**What works**: Magazine-quality hero of plated Gochujang Chicken, full-width. Title + description below image with no z-order conflict. Fixed bottom CTAs: "Cook" (ghost) + "Log This Meal" (filled green) clearly separated. Top-right info-circle + bookmark icons intuitive.
**What's subpar**:
- **4-stat pill row (Servings / Time / Calories / Difficulty) appears to be missing or scrolled out of frame** in the captured top view. Pass 3's recipe detail had these above-fold. **Verify before claiming regression.**
- Description body copy at ~14pt light-grey on dark — serviceable but bumps to 16pt would improve readability.
- Swipe-between-recipes interaction (32i, 32j) has no affordance hint or "3 of 20" counter.
**Priority**: High (verify stats row), Low (other items)

#### Desserts
[33-meals-desserts](ui-audit-pass4/screenshots/dark/33-meals-desserts.png)

**Grade**: A
**What works**: Same browse grid pattern with category chips (Cookies / Cake / Pie / Bars / Pastries). "15 recipes found" count. Cottage Cheese Ice Cream variants with consistent hero crops.
**What's subpar**:
- Same truncated filter row.
- Same cal/protein color collision.
- Multiple variants of Cottage Cheese Ice Cream visible in grid — if intentional, label by flavor more clearly; if not, dedupe.
**Priority**: Medium

---

### Track (Fuel + Metabolic)

#### Track — Fuel view
[40-track](ui-audit-pass4/screenshots/dark/40-track.png) · [40b-track-scrolled](ui-audit-pass4/screenshots/dark/40b-track-scrolled.png) · [40c-track-scrolled-2](ui-audit-pass4/screenshots/dark/40c-track-scrolled-2.png)

**Grade**: B+
**What works**: Fuel/Metabolic toggle clean. Calendar month view (April 2026) shows day 29 selected with green ring. Week-glance legend (Whole Food / Mostly Clean / Mixed / Processed / Flex) is clear color taxonomy.
**What's subpar**:
- **Possible regression: 7-day MES bar chart is missing.** Pass 3 captured a 7-bar day-of-week chart with MES values per day. Pass 4 shows only a blank date row under the "1 week" header. Verify.
- Metabolic toggle label is faint grey vs Fuel's bright green — improved on Metabolic *view*, but the toggle itself is still subtle on Fuel view.
**Priority**: High (verify chart regression)

#### Track — Metabolic view
[41-track-metabolic](ui-audit-pass4/screenshots/dark/41-track-metabolic.png) · [41b-track-metabolic-scrolled](ui-audit-pass4/screenshots/dark/41b-track-metabolic-scrolled.png)

**Grade**: A-
**What works**: **FIXED — Metabolic toggle now bright orange when active**. Strong contrast vs Fuel ghost state. Large red "0 MES" ring with "30g protein left / 30g fiber left" supporting pills. 4-tile macro breakdown: Protein (red icon, "Needs more"), Fat (orange), Fiber (blue), Carbs (green) — each with progress ring.
**What's subpar**:
- **Macro tiles use 5 different accent colors** (red / orange / blue / green + text accent) — visual overload on a screen that's already dominated by a red ring. Consolidate to 3 core macro colors mapped to MacroColors.
- **Red ring on Metabolic mirrors the red ring on empty Home** — users see red across two tabs and may dismiss the signal entirely (tabs become "the red ring app").
- **"Metabolic Coach" CTA still buried** — pass 3 flagged this; pass 4 shows the section header truncated at the fold.
**Priority**: Medium (color rationalization), High (Coach visibility)

---

### Coach

#### Coach — init / quick starts
[50-coach](ui-audit-pass4/screenshots/dark/50-coach.png) · [50b-coach-scrolled](ui-audit-pass4/screenshots/dark/50b-coach-scrolled.png) · [51-coach-typed](ui-audit-pass4/screenshots/dark/51-coach-typed.png)

**Grade**: A-
**What works**: Hero card with teal Healthify logo + "FUEL COACH / Your kitchen assistant" sets identity. **Quick Starts** chips (Turkey Meatballs / Salmon Power Bowl / Steak and Eggs / Beef and Broccoli / Protein Overnight Oats / Pizza / Ice Cream / Fried Chicken) — 8 items, discoverable. **CTA chips**: "What's in my fridge?" / "Explain my score" / "Quick 15-min meal" reduce cold-start friction. Input "Ask about any food…" with camera + send.
**What's subpar**:
- No system-welcome message ("Hi, I'm Healthify…") on cold open — feels slightly chillier than peer chat UIs.
- Quick Starts chips have no tap-feedback state visible (haptic / brief highlight) — minor.
**Priority**: Low

#### Coach — response (52* group)
[52-coach-response](ui-audit-pass4/screenshots/dark/52-coach-response.png) → [52e](ui-audit-pass4/screenshots/dark/52e-coach-response-scrolled.png)

**Grade**: A (text quality), B (schema quality)
**What works**: User message in bright green pill, AI in dark charcoal — clear contrast. Loading state shows animated 3-dot spinner with "Looking up nutrition info…" caption. Response wraps cleanly, no truncation across scrolls. Input bar fixed at bottom for quick follow-up.
**What's subpar**:
- **Possible regression: response is plain text only** — no inline recipe cards, no MES/Fuel pills, no embedded meal hero photos. Pass 3 graded the Healthify response schema as the app's design high-water mark *because* of those rich cards. Pass 4 shows none of them on this exchange. **Verify**: is this query-dependent ("What's a high-protein breakfast?" returns text; "Healthify a pizza" returns cards) or a real schema regression?
- **No Helpful / Not helpful reaction buttons** on the response — pass 2/3 captured these; missing here.
- **No Share or Copy affordance** on the response — reduces save-for-later utility.
**Priority**: High (verify schema regression — this is the app's hero feature)

#### Coach — drawer
[53-coach-drawer](ui-audit-pass4/screenshots/dark/53-coach-drawer.png)

**Grade**: B
**What works**: "Chat History" header with X close. "+ New Chat" with plus icon. Conversation row shows "What's a high protein breakfast?" with timestamp + message count. Trash icon for deletion. **"TRY ASKING"** section at bottom with 4 example prompts (Healthify a pizza / High-protein breakfast ideas / Clean snacks under 200 cal / Swap pasta).
**What's subpar**:
- **Background NOT darkened** when drawer slides in — pass 3 flagged Medium priority, still unfixed.
- Conversation row layout cramped — title + timestamp run together with no divider.
- Try-asking icons are generic leaf/fork/check, don't match the teal-Healthify brand color of the Coach hero.
**Priority**: Medium (drawer overlay darken)

---

### Profile / Saved

[61-profile](ui-audit-pass4/screenshots/dark/61-profile.png) · [61b-profile-scrolled](ui-audit-pass4/screenshots/dark/61b-profile-scrolled.png)

**Grade**: B
**Important caveat**: This appears to be a **Saved Recipes empty state** (likely sub-tab of Meals or accessed from a profile menu) — **not the full Profile screen** (account, goals, preferences, subscription management). The actual Profile/Settings view is **not captured in pass 4**. This should be tested next pass.

**What works**: Centered grey bookmark icon. Heading "No saved recipes yet" is direct. Subheading "Save recipes from Healthify or Browse to keep them on this device" explains the action.
**What's subpar**:
- **70%+ whitespace below the copy** — feels inefficient. Add a CTA ("Browse recipes →") or motivational hero.
- "On this device" is vague — does this sync across devices? Cloud-backed? Unclear.
- Bookmark icon at ~32pt grey is visually flat — no warmth or accent.
**Priority**: Critical (capture actual Profile next pass), Medium (empty-state visual)

---

## Top wins (pass 4)

1. **Onboarding is genuinely good (A/A-/A+ throughout).** 13 steps, no drop-off-inducing moments, and 16-meal-reveal is a moment of real magic — green Fuel ring + amber Projection ring + meal list with "Three meals, a dessert, and real food. Every one scores Fuel 100." This is a brand-defining frame.
2. **Metabolic toggle state is fixed** — pass 3's faint-grey-vs-faint-green issue is now bright orange vs grey ghost. Clear active-state.
3. **Kitchen Hub navigation is the most visually delightful surface in the app** — 6 color-coded cards with icons and clear subtext. Good entry point for casual exploration.

## Top issues (pass 4)

1. **Empty-state red Fuel ring is still present** after onboarding completes. 4 passes deep, this is the highest-impact unfixed item. Either swap to a neutral skeleton state, OR start the user at green with "Start your day" copy that reframes the score as something to *build* not *avoid*.
2. **Flex Budget entry card uses the same red** — compounds the red-ring problem and confuses Flex's reward semantics. Change to amber or neutral.
3. **Possible Healthify response-card regression** — pass 3's hero feature (rich recipe cards in chat) appears as plain text only in pass 4. **Highest-priority verification item.** If real, this is a major regression of the app's most differentiated feature.

## Possible regressions to verify

| Regression | Evidence | Confidence |
|------------|----------|------------|
| Healthify chat response schema = text-only | [52-coach-response](ui-audit-pass4/screenshots/dark/52-coach-response.png) → 52e all show plain text | Medium — could be query-dependent. **Try "Healthify a pizza" before declaring real.** |
| 7-day MES chart removed from Track Fuel | [40-track](ui-audit-pass4/screenshots/dark/40-track.png) shows blank date row vs pass 3's 7-bar chart | Medium — could be empty-state for a new account |
| Recipe Detail 4-stat pill row missing | [32-recipe-detail](ui-audit-pass4/screenshots/dark/32-recipe-detail.png) doesn't show servings/time/cal/difficulty above the fold | Low — might just be scrolled out of capture frame |

## Items unchanged since pass 3 (not yet addressed)

- Filter chip row truncation in Browse
- Calorie + protein color collision (both rust)
- Coach drawer overlay not darkened
- Metabolic Coach buried at bottom of Track tab
- Recipe hero photo aspect-ratio variation

---

## Prioritized action list

### P0 — Critical (block ship)
1. **Empty-state Fuel ring**: change from red to neutral grey OR start at green (reframes score from "danger" to "opportunity to build"). Apply to Home, Premium modal background, and any other empty-state surface.
2. **Verify Healthify response schema** isn't regressed — run "Healthify a pizza recipe" and "Quick 15-min meal" prompts; if text-only, restore card schema before next release.
3. **Capture and audit the actual Profile screen** — pass 4 missed it.

### P1 — High (next sprint)
4. **Flex Budget red card** → amber or neutral. Stop using red across Fuel + Flex; reserve red for actual penalty states.
5. **Cal/protein color split**: cal = neutral grey, protein = brand green. Apply across Browse, Desserts, and any recipe pill row.
6. **Filter chip overflow**: add horizontal-scroll affordance or move "More filters" to a dedicated icon.
7. **Verify 7-day MES chart** on Track Fuel — if removed accidentally, restore.
8. **Promote Metabolic Coach** — it's buried below the fold on a tab where users barely scroll.

### P2 — Medium (polish)
9. **Personal Targets MacroColors**: color-code the 4 macro values (165g Protein / 132g Carbs / 30g Fiber / 71g Fat) on [15-onb-personal-targets](ui-audit-pass4/screenshots/dark/15-onb-personal-targets.png) to teach the visual language used elsewhere.
10. **Meal-reveal recipe photos**: add hero images to the meal cards on [16-onb-meal-reveal](ui-audit-pass4/screenshots/dark/16-onb-meal-reveal.png) — this is the funnel's emotional peak and currently text-only.
11. **Today's Plan empty state**: surface the value-prop (low-carb breakfasts, etc.) more prominently; add time-to-complete.
12. **Coach drawer**: darken background overlay when drawer is open.
13. **Onboarding micro-fixes**: weight unit suffix, height ft/in divider, flavor-icon size bump, Vegetarian moved out of Proteins section.
14. **Recipe Detail**: confirm 4-stat pill row is above-fold; bump description body copy from 14pt → 16pt.

### P3 — Low (nice-to-have)
15. **Login back affordance**, signup password-strength indicator.
16. **Quick Starts haptic feedback** on Coach.
17. **Meal Plan Builder**: collapse 3 separate Edit affordances into one inline toggle.
18. **Kitchen Hub**: promote primary cards (Meals / My Plan), demote secondary (Saved / Grocery).

---

## What pass 5 should capture

- **Cook Mode** end-to-end (not captured this pass)
- **Actual Profile/Settings screen** (account, goals, subscription)
- **Healthify rich-card response**: query "Healthify a pizza recipe" and "Quick 15-min meal" to verify schema isn't regressed
- **Track 7-day MES chart**: log 3 days of meals via API time-travel, then capture Track Fuel to confirm the bar chart renders
- **Animations**: ring fill animation, meal-log celebration, XP burst — pass 4 is static-only, can't grade motion
- **Light mode**: every pass so far has been dark-only — light-mode parity is unverified

---

## Methodology note

Pass 4 was nearly lost to a "photo too large" error in the previous session — the recipe-detail 2.4 MB screenshots crashed the main context. Resolved by delegating screenshot review to four parallel Explore subagents, each reading 13–28 images and reporting findings. Total subagent context cost: ~6k tokens of summary. Total raw screenshot bytes avoided in main context: ~75 MB. This pattern (subagent screenshot review) is the right default for image-heavy audits and should be standard for pass 5+.
