# UI Audit Pass 8 — Look & Feel ("Anti-Vibecode") — 2026-07-13

**Method:** 62 captures on iPhone 17 Pro simulator (light full-app sweep on a month-populated account, 10-screen dark-mode parity set, XXXL Dynamic Type), reviewed by three parallel design-reviewer agents against a shared rubric (radius/spacing/shadow consistency, baseline alignment, clipping/collisions, chip/pill consistency, contrast, density, placeholder art, icon language), plus coordinator observations during capture. Captures: `tasks/ui-audit-pass8/captures/`.

## Coordinator observations (found during capture, pre-review)

1. **P1 — Meal-plan builder can trap the user.** The screen enters with content scrolled so the "✕ Meal Plan / Step 1 of 2" header sits under the status bar; the "Build your Week" title renders THROUGH the clock/notch. The ✕ is icon-only, unlabeled (absent from the accessibility tree — VoiceOver users get nothing), and its hit target failed repeated coordinate taps. Escape required killing the app.
2. **P1 (a11y/testability) — icon-only controls are invisible to the accessibility tree** across the app (builder ✕, several header buttons): no labels, no bounds. This blocks VoiceOver AND any UI test automation.
3. **P2 — Ring adjacency chips** ("+20d" gold chip + "1d" grey chip beside "First meal sets the pace") read as debug artifacts — unclear meaning, mixed styles, tiny type.
4. **P2 — Meals "Kitchen Hub"** uses six pastel gradient cards each in a different hue (green/teal/orange/blue/purple/lavender) — reads more "template" than "system"; hue assignment is arbitrary (why is Saved purple?).
5. Save-password iOS sheet interrupts first-run right on top of Home (timing, minor).

## Batch A — Home / Track / Recap / Quests / XXXL

Grades: recap A−; home B− to B; track-fuel B; track-metabolic C+ to B−; quests B; **home-mid D (render bug)**; XXXL C.

**P1 broken:**
- **Tab-bar translucency bug (L02):** the deep-purple "Scan Food" gradient card scrolls UNDER the glass tab bar unblurred — sharp purple band + clipped dark corner poking out of the bar. The bar material isn't blurring/scrimming content. Fix: real blur material + opaque scrim layer behind the pill.
- **XXXL type: "Welcome Back" wraps mid-word** ("Welcom / e Back") on login (X01/X02); status-bar time also invisible (light-on-light). Fix: `minimumScaleFactor`/word-wrap-safe sizing at accessibility sizes.
- **FAB detached + edge-clipped (L01/L33):** the "+" circle floats off the tab pill, clipped by the right screen edge and above the bar's vertical center. Inset ~16pt and align to the pill, or integrate it.

**P2 inconsistencies:**
- "REAL FOOD THIS WEEK" progress row renders as a full-width strip of gray dashes — looks like an unfinished skeleton; needs a filled state + count label.
- Metabolic view chip chaos (L19): four status pills ("130g protein left", "32g fiber left"…) in four pastel hues with four icon styles, above four mini-cards each with a differently-colored state word. One pill style + neutral tint; reserve color for the state word.
- "Try These Foods" chips use colored food glyphs that read as mixed emoji (L20) — replace with monochrome SF Symbols.
- Calendar cells double-marked: colored dot + orange pencil corner badge on every date, 5-item legend (L16). Consolidate to one indicator.
- Cryptic unlabeled chips: "⚡20d", "1d", header "🔥1" — no legend anywhere (L01/L33).
- Quest stat tiles mix icon-chip treatments; "+20 XP" pills low-contrast gray (L24).

**P3:** underlined web-style text links ("Change goal (80%)", "Score settings") → buttons/chevron rows; recap metric icons are mixed metaphors (the Weekly Fuel glyph reads as a game controller); "Daily Tip" body text slightly low-contrast; two stacked feature cards use two unrelated gradient families (blue-purple vs green-teal).

## Batch B — Meals / Recipe / Plan Builder / Scan

Grades: saved/my-plan empty states A−; scan result A−/B+; meals hub B+; desserts B; browse C+; **plan builder scrolled D (P1 broken)**.

**P1 broken:**
- **Plan-builder status-bar collision** (5 captures): "Build your week" + intro copy render THROUGH the clock, wifi and battery glyphs when scrolled. Needs safe-area top inset + sticky compact header; content must never scroll under the status bar.
- **Black rectangular artifact** over the header region in one builder capture (L12e) — misrendered overlay/blur layer; investigate the header background.
- **Placeholder art in browse** (L06): photo-less recipes render a saturated orange gradient with a faint ✕, mixed into rows of real photography. Neutral branded placeholder (muted logo on surface tint) + photo-less sorted last. (Backend photo-first sort shipped in the fix pass — verify it's live; the capture still showed a gradient card first.)
- **Camera screen status bar dark-on-dark** (L35): clock nearly invisible; force light status-bar style in scan mode.
- **Grocery error contradiction** (L10): "0 items / 0%" stat card renders above "Unable to load grocery list" + Retry. Hide stats when erroring.

**P2 inconsistencies:**
- Chip anarchy: three chip styles in one builder card stack (filled green / tinted / outlined "None Added"); Full-Meals filter chips (caret dropdowns) vs Meal-Prep chips (dot pills) are two different languages; category chip rows hard-clip the last chip mid-word ("Pastr…", "Veggi…") — add trailing fade/padding.
- Recipe-card metadata schema drift: browse cards show Fuel+Metabolic pills, dessert cards only Fuel; four numbers on one card use two treatments (tinted pills vs inline colored text). Pick one.
- Uneven card heights in browse grid: unclamped title/description lengths push pill rows off a shared baseline. Enforce 2-line clamps.
- Scan macro grid rhythm: 2×2 + lone full-width "Fiber" tile; use 3+2 or compact 5-across.
- Plan-builder ✕ tap target under 44pt and unlabeled (pairs with coordinator finding #1).
- "New Plan" header button + "Create Meal Plan" CTA duplicate the same action on the empty plan screen.

**P3:** cal·protein line in warning-pink reads as an error color (browse/desserts); hub card chevrons are tiny floating `>` glyphs; hub icon/text not on a shared inset grid; saved-empty-state CTA floats high in dead vertical space; "Scan barcode" chip orphaned above the shutter.

## Batch C — Dark mode parity / Profile / Settings / Coach

Grades: dark coach A; dark meals-hub A−; dark recipe A−; dark profile A−; dark home B+/B; dark browse B; quests C+.

**Where it renders, dark mode is genuinely well-executed** — correct surface tiers, no white-card leaks, gradient cards adapt, coach/profile show real light↔dark craft.

**P1 / must-verify:**
- **Dark Track captured completely blank** (tab bar only, no content) — re-captured below to distinguish render bug from capture race. → RESOLVED on re-capture: content renders in dark; the original was a load race. See D06b/D07b.
- Original capture set had integrity failures (settings shots were actually Quests; dark profile mislabeled) — settings/health-context re-captured below.

**P2:**
- Bright-orange no-photo placeholder is far louder in dark (D04) — muted dark tile + monochrome icon.
- Calorie text red on placeholder cards vs green on photo cards — semantic color drift; red should mean warning only.
- Empty macro/fuel rings nearly vanish on black (D01/D02) — raise unfilled ring stroke, add faint track.
- "Last Week's Recap" card present on light home, absent on dark home — parity check needed (may be dismissed-state, not theming).

**P3:** "0" glued to "2459" in Today's Fuel (needs "0 / 2,459 cal" with baseline discipline); dark recipe body copy one contrast step too low; "Quests & Streaks" plain default disclosure row; quests rows flat grey (default-looking) with "Hit 129g Protein" vs "0/129.9" rounding mismatch.

## Batch D — Settings / dark Track re-captures

Settings top B+, mid B, lower B; dark Track (metabolic) B−. Key finds: **clipped subtitle "…streak saves, and foll…" (P1 copy truncation)**; three different trailing affordances (chevron / expand caret / external-link) mixed in one list; icon-tile tint assignment reads arbitrary (green vs grey vs multi-hue with no semantic logic); Sign Out and Delete Account styled identically (destructive parity — make Sign Out neutral); "1 person(s)"; version number in a heavy bordered card; macro hue mapping differs between summary chips and macro cards on the same screen (carbs = pink chip / amber card); "Good" state shown on a 0%-logged Carbs card; Metabolic Coach card clipped by tab bar (missing bottom safe-area padding).

## NEW P1 found during re-capture — intermittent blank screen

After navigation churn (profile ↔ settings ↔ tab cycles in dark mode), **Home renders completely blank — tab bar alive, content tree dead** — and persists across further screenshots (wedged, not a load race). Matches the byte-identical blank D06/D07 captures the reviewer flagged. The root ErrorBoundary does not catch it. Repro: rapid sequences of avatar → settings → back → tab switches. Needs Sentry breadcrumbs / render-path investigation (suspect: a crashed screen leaving the navigator with an empty scene, or an animated container stuck at opacity 0).

**Capture gap:** the new Health Context screen (S05/S06) resisted two capture attempts (flow died mid-navigation; second attempt hit the blank-screen wedge). Screen is code-reviewed but not visually audited — carry to next pass.

## Cross-cutting design-system recommendations

1. **One chip system.** The single loudest vibecoded tell app-wide: filled/tinted/outlined chips, dropdown-caret vs dot-icon filter pills, four pastel hues for four macros on one screen, different hues for the same macro across components. Define ONE chip component (shape, height, radius, tint logic: neutral container + colored state word) and one **fixed per-macro color map** used everywhere.
2. **Placeholder art.** Replace the saturated orange gradient + ✕ for photo-less recipes with a muted surface-tint tile + monochrome brand mark; keep photo-less items sorted last (partially shipped).
3. **Safe areas + materials.** Three findings share a root cause of ad-hoc header/scroll handling: plan-builder status-bar collision, tab-bar failing to blur scrolled content (purple bleed), Metabolic Coach card clipped at bottom. Standardize: every screen gets safe-area-inset-aware sticky headers and the tab bar gets a real material + scrim.
4. **Icon language.** Mixed emoji-style colored food glyphs, mixed-metaphor recap icons, arbitrary icon-tile tints in settings. Pick monochrome SF-Symbol-style glyphs on a single tint logic.
5. **Number formatting discipline.** "0" glued to "2459"; "129g" vs "0/129.9"; recap "89.3" vs tile "89"; "1 person(s)". One formatting util: thousands separators, consistent rounding, real pluralization.
6. **A11y floor:** every icon-only control gets an accessibilityLabel (builder ✕ invisible to the tree); XXXL must not split words mid-word; camera view forces light status-bar style.
7. **Affordance grammar:** chevron = navigate, caret = expand, external-link = leaves app — never mixed in one list; no underlined web-style links.

## Ranked master list

**P1 (broken — fix first):**
1. Intermittent blank screen after navigation churn (wedged, ErrorBoundary silent) — new, reproducible.
2. Plan-builder: status-bar collision on scroll + unlabeled sub-44pt ✕ (can trap users) + black header artifact in one capture.
3. Tab bar doesn't blur/scrim scrolled content (purple gradient bleeds through, clipped corner).
4. XXXL: "Welcome Back" splits mid-word; ring numerals/status-bar contrast issues at accessibility sizes.
5. FAB detached from tab pill and clipped by screen edge.
6. Settings notification subtitle truncates mid-word ("…and foll…").
7. Camera status bar dark-on-dark (invisible clock).
8. Grocery: error banner + "0 items / 0%" stat card shown simultaneously.

**P2 (consistency — the "not vibecoded" work):** one chip system + per-macro color map; neutral placeholder art; recipe-card metadata schema (Fuel+Metabolic on all cards, one treatment for numbers); 2-line clamps so browse card baselines align; calendar single-indicator (drop pencil corner badges); labeled or removed cryptic chips ("⚡20d", "1d", "🔥1"); empty rings visible on dark; macro grid rhythm on scan result (3+2); trailing-affordance grammar; icon-tile tint logic; destructive-action parity (Sign Out ≠ Delete); "Last Week's Recap" light/dark parity check.

**P3 (refinement):** underlined text links → buttons; version card → footer line; cal·protein warning-pink → neutral; chip rows hard-clipping last chip (add fade); recap icon metaphors; dark recipe body contrast +1 step; hub chevrons; quests visual flatness + XP pill contrast; "0 / 2,459 cal" formatting; duplicate New Plan/Create CTAs on empty plan; redundant "No meals logged" pill+row on metabolic Track.

## Verdict

The bones are good — dark mode shows real craft (correct surface tiers, no white-card leaks), the scan result and recap screens hit the modern-consumer bar, and empty states are mostly intentional. What makes it read "vibecoded" is not any one screen but **system drift**: four chip styles, arbitrary tint assignment, three trailing-affordance styles, two number formats, loud placeholder art, and three safe-area/material bugs. The P1 list is short and mechanical; the P2 "one system" work (chips, colors, icons, formatting) is where the sleekness comes from.
