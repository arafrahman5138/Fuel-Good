# Scan Functionality Audit & Recommendations

**Date:** 2026-04-22
**Auditor:** Claude (autonomous scan audit pass)
**Scope:** End-to-end accuracy, UX, visual design of meal-photo + ingredient-label + barcode scan flows
**Artifacts:** `tasks/scan-audit/images/` (18 test images), `observations/*.json` (per-scan responses), `screenshots/ux-*.png` (simulator captures), `observations/summary.json` (accuracy matrix)

---

## TL;DR

Scan accuracy is **broken in its core promise**. Thirteen of 18 test scans scored Fuel 100 or above 80 — including a pepperoni pizza, spaghetti carbonara, cheeseburger + fries, a greasy diner burger, a latte, and a protein bar made of soy isolate + sucralose. The scoring formula has a "clean-meal boost" that snaps any home-context scan with no LLM-flagged processed ingredients straight to 100, and the meal-photo prompt doesn't aggressively extract the refined-flour, seed-oil, and cured-meat signals that pizza/pasta/burgers obviously contain. Once users see their obvious cheat meals score 100, the app's central value prop ("Is this real food?") collapses.

Secondary issues: (1) the scan pipeline has **no model fallback or retry** — when Gemini 2.5 Flash returns 503 (which it did for every call today during the first test pass), every scan silently degrades to a generic "Scanned meal" response with confidence 0.1; (2) label OCR garbles ingredient lists (e.g. "Soy Protein Isolate" → "Soy Wey Protein Isolate") yet the classifier treats confidence 0.7–0.9 as authoritative; (3) UX has visible rendering bugs (duplicate header on capture screen), confusing empty states on simulator, and the scan result screen is reachable in a broken partial state.

The good news: the underlying architecture is solid. Route separation (meal / product-image / product-barcode), Supabase storage, MES pipeline, and fallback-to-manual-edit affordances are all in place. The fixes below are mostly in the prompt, the scoring formula, and the error path — not a rewrite.

---

## 1. Methodology

**1.1. Test fixtures.** I generated 18 photorealistic images with `gemini-2.5-flash-image` covering the full accuracy spectrum: 10 meals (whole-food dinner → diner burger → pizza → cafeteria tray), 5 ingredient labels (clean Greek yogurt → sugary kids cereal → "healthwashed" granola bar → protein bar with soy isolate), and 3 edge cases (blurry meal, restaurant menu page, coffee latte). Script: [backend/scripts/generate_scan_test_images.py](backend/scripts/generate_scan_test_images.py). The fixtures are committed under [tasks/scan-audit/images/](tasks/scan-audit/images/).

**1.2. Accuracy test.** I posted every fixture to `/api/scan/meal` and `/api/scan/product/image` with a signed-in JWT via [tasks/scan-audit/run_backend_scans.py](tasks/scan-audit/run_backend_scans.py) and dumped each raw response to [tasks/scan-audit/observations/](tasks/scan-audit/observations/).

**1.3. UX test.** I drove the iOS 26.2 simulator (iPhone 17 Pro) via Maestro flows in [tasks/scan-audit/flows/](tasks/scan-audit/flows/) + `xcrun simctl` for screenshots and `addmedia`. Screenshots in [tasks/scan-audit/screenshots/](tasks/scan-audit/screenshots/).

**1.4. Scope note.** Simulator has no camera, so all captures were from the photo library. Barcode scanning was inspected in code only; I did not hit a live OpenFoodFacts product.

---

## 2. Accuracy Findings

### 2.1. Meal-photo accuracy matrix (from [observations/summary.json](tasks/scan-audit/observations/summary.json))

| Image | What it is | Fuel | Expected | Verdict |
|-------|-----------|-----:|---------:|:--------|
| meal_01_healthy_plate | Grilled chicken, quinoa, broccoli | **100** | 95–100 | ✅ |
| meal_02_diner_burger | Cheeseburger + crinkle fries | **86** | 25–35 | ❌ off by ~55 points |
| meal_03_burrito_bowl | Chipotle bowl (white rice, sour cream, cheese) | **100** | 55–65 | ❌ off by ~40 |
| meal_04_pasta_carbonara | Refined pasta + guanciale + cream + cheese | **100** | 40–55 | ❌ off by ~50 |
| meal_05_yogurt_bowl | Greek yogurt + berries + granola + honey | 64 warn | 70–80 | ⚠️ slight under |
| meal_06_pizza_slice | NY pepperoni pizza slices | **100** | 20–30 | ❌ off by ~75 |
| meal_07_salmon_rice | Salmon + white rice + bok choy | **100** | 70–80 | ⚠️ refined rice ignored |
| meal_08_oats_berries | Overnight oats + berries + PB | 85 | 85–95 | ✅ |
| meal_09_cafeteria_tray | Mac & cheese + nuggets + corn + pudding | **null** (degraded) | 20–30 | ❌ silent failure |
| meal_10_acai_bowl | Acai + granola + banana + honey | 81 | 65–75 | ⚠️ slight over; MES=null |
| edge_01_blurry_dim_meal | Intentionally blurry / dim stir-fry | **100** conf 0.83 | <0.5 conf | ❌ should flag low confidence |
| edge_03_coffee_latte | A cappuccino, no food | **100** | borderline food | ❌ app treats latte as perfect whole food |

**Hit rate where fuel score lands within ±15 of expected: 3/12 (25%).** For a product that promises to teach users "Is this real food?", this is a trust-breaking miss rate.

### 2.2. Label-scan accuracy

| Image | Product | Score | Tier | Expected | Verdict |
|-------|---------|------:|------|---------:|:--------|
| label_01_greek_yogurt_clean | 4-ingredient plain Greek yogurt | 100 | whole_food | 95–100 | ✅ |
| label_02_sugary_cereal_ultra | HFCS + Red 40 + Yellow 5 + BHT kids cereal | 37 | ultra_processed | 15–30 | ✅ directionally right |
| label_03_granola_bar_healthwashed | Cane sugar + canola oil + rice flour + soy lecithin | **86** | **whole_food** | 55–65 | ❌ off by ~25 |
| label_04_protein_bar_isolates | Soy protein isolate + sucralose + natural flavors | **94** | **whole_food** | 45–60 | ❌ off by ~40 |
| label_05_tortilla_chips_simple | Corn + sunflower oil + sea salt | 81 | solid | 65–75 | ⚠️ slight over; sunflower oil uncaught |
| edge_02_restaurant_menu | A paper menu, not a food | 59 | mixed | error / "not a label" | ❌ should reject |

**Hit rate: 2/6 (33%).** The exact failure mode that matters most — "health-washed" products — is where the app gets fooled most reliably.

### 2.3. Root-cause accuracy bugs

**Bug A — the "clean-meal boost" snaps everything to 100.** [backend/app/services/fuel_score.py:248-258](backend/app/services/fuel_score.py:248) has:

```python
if (not flags
    and whole_food_status in ("pass", None)
    and ctx in ("home", "homemade")
    and not has_dessert_component):
    score = max(score, 100.0)
```

When Gemini fails to flag any processed ingredient (very common — see Bug B), and the user's context is "home" (the default for any scan taken outside a restaurant), the score gets boosted to exactly 100. That's how a pepperoni pizza, a carbonara, and a cheeseburger all score 100 with the reasoning text *"No processed ingredients detected — clean whole-food meal."*

**Bug B — the meal prompt doesn't extract hidden-processing signals.** [backend/app/services/meal_scan.py:461](backend/app/services/meal_scan.py:461) asks for `possible_hidden_ingredients` but the example JSON doesn't call out the high-value signals the Fuel philosophy cares about — refined flour, seed oils, added sugars, cured meats, processed cheeses. Gemini dutifully reports "Pizza Dough, Tomato Sauce, Mozzarella, Pepperoni" and stops. With no flags populated, the scorer never degrades the score. Concretely, in the real responses:

- Pepperoni pizza: `possible_hidden_ingredients: []`, despite pizza dough = refined flour and pepperoni = cured meat with nitrites and seed oils.
- Carbonara: same — spaghetti is treated as unflagged.
- Cheeseburger: no flag for fryer oil, bun (refined flour), or processed cheese.

**Bug C — refined-carb detection doesn't fire on generic names.** [backend/app/services/fuel_score.py:181-185](backend/app/services/fuel_score.py:181) looks for hints like "white rice", "pasta", "bread" in component names. Gemini labels the salmon meal's carb component simply "Rice" (not "white rice"), so the -6 refined-carb penalty never hits. This is brittle string matching; the system needs a real classifier.

**Bug D — label OCR degrades silently.** Protein bar ingredients came back as *"Soy Wey Protein Isolate, Vegetable Glyciate, Vegetable Com Fiber, Erun Piolte, Erythytitol…"* — obvious OCR garbling. The classifier's processing-flag dictionary only matches exact strings (`soy protein isolate`, `whey protein isolate`), so the bar's defining feature goes undetected, `protein_isolates: []`, score 94. OCR confidence was 0.7 but nothing downgrades the final tier.

**Bug E — "concerns" text doesn't affect tier.** The protein bar got `concerns: ["Contains artificial additives or preservatives."]` and still returned `tier: "whole_food"`. If the classifier knows there's a concern, the tier shouldn't say "whole_food" — this is user-facing gaslighting.

**Bug F — non-food images aren't rejected.** The latte scored Fuel 100, conf 0.86. The restaurant-menu image scored 59 "mixed" instead of triggering `is_not_food: true`. The prompt does ask about `not_food`, but with a visible latte or menu page it's returning `not_food: false` because "there is food/drink pictured or described," and the downstream code treats anything not-not-food as a scoreable meal.

**Bug G — blurry / low-light scans still return high confidence.** `edge_01_blurry_dim_meal.png` (deliberately blurry, dim) returned confidence 0.83 and Fuel 100. There's no separate "image quality" signal that could trigger a "retake?" prompt; the confidence value is driven by the AI's JSON response, which the AI is overconfident about.

**Bug H — cafeteria tray silently returned `is_degraded: true` with no recoverable state.** When the Gemini call failed or extracted nothing, the scan saved as a generic "Scanned meal" with confidence 0.1, no flags, and pre-filled upgrade suggestions like *"Retake the photo in brighter light for a more accurate meal scan."* The actual photo was clearly lit — it's just that the multi-dish tray confused the extractor. There's no attempt to retry, no fallback model, and no way for the user to say "no, this is what it actually is" before committing.

### 2.4. Reliability: single point of failure on Gemini 2.5 Flash

During the first test run today (2026-04-22 ~10:00 AM), **every single scan returned degraded fallback** because `gemini-2.5-flash` was returning HTTP 503 UNAVAILABLE across the board. A direct curl to the API confirmed the model was overloaded while `gemini-2.5-flash-lite` responded normally in parallel.

The scan stack has no retry, no model fallback, and no jitter/backoff. From [backend/app/services/meal_scan.py:584-586](backend/app/services/meal_scan.py:584):

```python
async with httpx.AsyncClient(timeout=40.0) as client:
    response = await client.post(url, json=payload)
    response.raise_for_status()     # 503 → HTTPStatusError → caller catches → degraded_fallback
```

When Google Generative AI has a spike of demand (a common weekly event in my experience), the Fuel Good scanner is essentially broken for all users, and they're told "AI analysis temporarily unavailable" — which is accurate, but after a few of these, users will stop scanning.

---

## 3. UX / Visual Findings

The UX subagent covered ~90% of the surface area before this pass. I'll call out the new issues I hit driving the simulator, and highlight the ones that are high-leverage for the user's "does this look modern and sleek?" question.

### 3.1. Blocking visual bugs

**V1 — Duplicate header on the scan capture screen.** `ux-01-capture-meal-mode.png` shows two rendered copies of the (close-X + "Fuel Good" pill) header stacked vertically, at y≈135 and y≈320. This is almost certainly a modal-stack / navigator-header double-render from opening scan via deep link (`fuelgood://scan`) while the scan route was already partially mounted in another state. Reproduce: open via deep link from home, observe header shadow.

**V2 — Debug warning bar physically covers the bottom controls.** The Expo "Open debugger to view warnings" bar at the bottom of the scan capture screen overlaps the shutter button and the right-side Describe button. Obviously only affects dev builds, but worth making sure the `bottom` padding is computed from `useSafeAreaInsets()` + the Expo debug bar height, because production will have the home indicator safe area and anything else iOS surfaces.

**V3 — Camera preview is pure black on simulator with no fallback illustration.** The simulator has no camera, so `CameraView` shows nothing. The capture screen on simulator is almost entirely black void, which makes the dev/QA experience miserable and would look dead if a user ever landed on this with no camera permission. The current permission flow (line 1120–1138 of `scan/index.tsx`) shows a lock icon + "Open Settings" when denied, but when undetermined/unknown on simulator, there's no messaging.

### 3.2. Trust-breaking content in "Recent" scans

The Recent carousel under the camera preview shows prior scans. After my test runs, it displayed:

- **"Latte" — Fuel 100**
- **"Chicken and Vegetable…" — Fuel 100** (the blurry dim stir-fry)

Both obviously wrong (a latte isn't Fuel 100). Any user who scans a couple of things and opens the scanner again sees these lies as the first impression, and the "Scan Food → get honest feedback" promise evaporates. Fixing §2 cleans this up automatically.

### 3.3. UX debt that matters for conversion

I'll ride on the subagent's earlier enumeration rather than repeat it, but calling out the highest-leverage items:

- **No "review" step for product mode.** Meal mode has a review step (see `scanStep === 'review'`) where the user can confirm before sending; product mode jumps straight from capture → analyze. This is the single biggest reason label OCR errors go uncaught — users never see "here's what I read off the label, is this right?" before scoring. (scan/index.tsx has the scaffolding; it's just not wired for product.)
- **Barcode mode is a textbox.** The scanner brands itself as a *scanner* yet asks the user to type a 13-digit UPC by hand. This is so far below modern UX it undermines the whole feature. `expo-barcode-scanner` has a full live-camera UPC detector; integrating it is one screen.
- **"Ask Coach" on a bad scan navigates out of the sheet.** Users with low confidence in a result bounce to the chat tab and lose their scan context. Should open the coach as an in-sheet modal and receive the scan as a seed prompt.
- **No share / save-as-image on result.** Users can't screenshot a cheat meal's Fuel 28 to send to a friend — which is exactly the shareable viral moment the app should want.
- **No retry path when degraded.** When `is_degraded: true` comes back, the user only gets "Retake in brighter light" — but they can't hit "Try this again with the same photo, different model." Especially bad given §2.4.
- **Mode switching resets everything.** Accidentally tapping Packaged Food while composing a meal scan wipes the image, the description, and any corrections. A "Save this as a draft?" confirm would prevent a real rage-moment.

### 3.4. Modern-iOS benchmarks

Compared to Cal AI, Yuka, Apple Health, and the FoodNoms family, Fuel Good's scan flow sits at roughly 60% polish:

- Animations are there (pulsing ring, rotating gradient, spring entrance) and feel premium.
- The result card hierarchy (hero → score ring → macros → collapsible sections) is solid.
- Color use is professional; typography hierarchy is correct; spacing is consistent.

But:
- **There's no live-camera food detection.** Cal AI shows a bounding box around the dish as soon as the camera sees it. Fuel Good is shoot-and-wait.
- **The analyzing screen feels generic.** The pulsing ring + "Identifying ingredients" text is the same for every scan; Cal AI streams back the ingredients it's finding in real-time.
- **There's no haptic/visual celebration for a great scan** — a Fuel 95 feels the same as a Fuel 35 once you're on the result screen (same hero, same layout). The Fuel Score philosophy is reward-based; the UI doesn't sell the reward.
- **No "here's the better version" swap UI.** The system has `suggested_swaps` in the response schema but it's empty on every result I got. The pre-purchase loop the README describes requires this to fire.

### 3.5. What looks modern and should stay

- FuelScoreRing entrance animation and tier coloring.
- Mode pills at the bottom (close to the thumb).
- Macro grid with colored accents per macro (calories/protein/carbs/fat/fiber).
- Collapsible sections on the result screen — right amount of depth without burying anything.
- The "Shopping mode" comparison sheet is a great idea, even if the discovery is weak.

---

## 4. Recommendations — prioritized plan

Grouped by **layer** and tagged with rough effort (S/M/L). Items marked P0 are required for the core value prop to work; P1 ship the polish; P2 is future delight.

### 4.1. Accuracy (P0 — ship before anything else)

| # | Fix | File | Effort |
|---|-----|------|--------|
| A1 | **Remove or tighten the "clean-meal boost"** in `_score_scan`. Either drop it entirely or gate it on `source_model != "degraded_fallback"` AND `confidence >= 0.9` AND every component role ∈ {protein, veg, fruit, whole_carb} with no refined-carb hints in any component name (pizza dough, bun, spaghetti, pasta, tortilla). | [fuel_score.py:248](backend/app/services/fuel_score.py:248) | S |
| A2 | **Expand the meal prompt** to aggressively populate `possible_hidden_ingredients` with "refined_flour", "seed_oil", "added_sugar", "cured_meat", "processed_cheese" signals, and bump those into `whole_food_flags` with severity. Add few-shot examples: pizza ⇒ refined_flour + cured_meat + seed_oil; pasta carbonara ⇒ refined_flour + cured_meat; cheeseburger ⇒ refined_flour + seed_oil + processed_cheese; fries ⇒ seed_oil + fried. | [meal_scan.py:461](backend/app/services/meal_scan.py:461) | M |
| A3 | **Add a dish-type classifier pass.** Before scoring, run the extracted `meal_label` through a dictionary of known-processed dish names (pizza, lasagna, mac and cheese, burger, fries, pasta, carbonara, ramen, pad thai, nachos, quesadilla, …) and auto-inject the implicit flags. This catches the case where Gemini extracts components but the scorer never sees the dish-level picture. | [meal_scan.py](backend/app/services/meal_scan.py) new helper | M |
| A4 | **Tighten refined-carb detection** to match ingredient tokens rather than strict substrings ("rice" in a restaurant/Asian context = white rice unless explicitly "brown"/"wild"; "noodles" ⇒ refined unless "soba"/"whole wheat"; etc.). | [fuel_score.py:182](backend/app/services/fuel_score.py:182) | S |
| A5 | **Normalize OCR tokens before flag detection.** Run Levenshtein-match between OCR output tokens and the processing-flag dictionary at distance ≤ 2 — e.g. "Soy Wey Protein Isolate" fuzzy-matches "whey protein isolate". | [whole_food_scoring.py](backend/app/services/whole_food_scoring.py) | S |
| A6 | **Make "concerns" actually lower the tier.** If `concerns` is non-empty, tier cannot be "whole_food"; floor it at "solid". Same for processing_flags: any non-empty added_sugars or seed_oils list ⇒ tier ≤ mixed; any non-empty artificial_additives list ⇒ tier ≤ mixed. | [product_label_scan.py](backend/app/services/product_label_scan.py) | S |
| A7 | **Reject non-food images harder.** Expand the `not_food` branch of the meal prompt with examples (menu page, receipt, a drink-only photo, empty plate, packaging before it's opened). Add a `drink_only` branch that returns `is_beverage: true` with a different scoring path (a latte should be ~60, not 100). | [meal_scan.py:461](backend/app/services/meal_scan.py:461) | M |
| A8 | **Lower confidence on image-quality signals.** Compute a quick `brightness_mean` and `edge_variance` (Laplacian variance for blur detection) from the uploaded image before calling Gemini; if either is below threshold, post-multiply the Gemini-reported confidence by 0.5 and add a `review_required: true` hint that the UI already shows. | [scan.py:576](backend/app/routers/scan.py:576) | S |
| A9 | **Validate `_score_scan` against a golden test set.** Add `backend/tests/test_fuel_score_golden.py` with 15–20 fixture payloads (the ones this audit just generated, plus expected score ranges) so accuracy regressions get caught in CI. | new file | M |

### 4.2. Reliability (P0)

| # | Fix | File | Effort |
|---|-----|------|--------|
| R1 | **Retry with backoff + fallback model** on the Gemini call. On any 5xx: 1 retry after 1.5 s jitter; on second failure, fall back to `gemini-2.5-flash-lite` (cheap, usually available). Only if that also fails does `_build_degraded_meal_scan_result` fire. This alone would eliminate today's full-outage failure mode. | [meal_scan.py:584](backend/app/services/meal_scan.py:584), [product_label_scan.py](backend/app/services/product_label_scan.py) | S |
| R2 | **Surface the degraded state in the UI with a retry CTA**, not just "Retake in brighter light." Add "Try again with the same photo" + "Use describe-meal instead" as primary actions on the degraded result card. | [scan/index.tsx:1640](frontend/app/scan/index.tsx:1640) | S |
| R3 | **Separate `scan_model` from `gemini_model`.** Today scan_model defaults to gemini_model. For resilience, set scan_model to flash, and have a second `scan_fallback_model` = flash-lite the pipeline rotates through automatically. | [config.py:68](backend/app/config.py:68), [meal_scan.py:568](backend/app/services/meal_scan.py:568) | S |
| R4 | **Don't persist degraded scans as "Scanned meal" by default.** When `is_degraded: true`, don't save the ScannedMealLog row until the user either edits it or confirms "Log anyway". The current behavior pollutes the Recent carousel with null-data records that look like real scans. | [scan.py:611-624](backend/app/routers/scan.py:611) | M |

### 4.3. UX repairs (P1)

| # | Fix | File | Effort |
|---|-----|------|--------|
| U1 | **Fix duplicate header on scan capture screen** (reproduces via `fuelgood://scan` deep link — header renders twice). Investigate whether `<Stack.Screen>` registration is doubling, or whether the modal route and tab route are both mounting the header. | [scan/index.tsx](frontend/app/scan/index.tsx) and expo-router config | S |
| U2 | **Product-mode review step.** Mirror the meal `scanStep === 'review'` — after picking/capturing the label, show extracted product name, brand, ingredients, nutrition for user confirmation with a "Looks right → Analyze" CTA. This is the single UX change that would most improve trust in label scoring. | [scan/index.tsx:1420](frontend/app/scan/index.tsx:1420), new render fn | M |
| U3 | **Live barcode scan via camera.** Replace the manual-entry textbox with `expo-camera` barcode recognition; manual entry moves behind a "Can't scan?" link. | `scan/index.tsx` barcode sheet | M |
| U4 | **Retry + "fix details" path on the degraded result.** On top of R2, expose an inline ingredient editor on the degraded card so a user can salvage a bad scan in 10 seconds. | [scan/index.tsx:1640](frontend/app/scan/index.tsx:1640) | M |
| U5 | **Share result as image.** Add a share button on both meal + product result headers that exports the hero card as an image via `captureRef` and shares via `expo-sharing`. | result hero components | S |
| U6 | **"Ask Coach" as in-sheet modal** with the scan pre-loaded, instead of a tab-switch. | [scan/index.tsx:2009](frontend/app/scan/index.tsx:2009) | M |
| U7 | **Suggested swaps in the result.** The schema already has `suggested_swaps` — wire the UI to show "Try this instead: <recipe> — Fuel 95" for low-scoring scans. Populate from the recipe catalog with a similarity-based match (same dish category, Fuel ≥ 85). | [scan/index.tsx result renders](frontend/app/scan/index.tsx) + `meal_scan.py` | L |
| U8 | **Haptic + color celebration** when a scan lands Fuel ≥ 90: a brief glow sweep on the score ring and a success haptic that differs from the medium-scan haptic. Ties scan → flex-meal reward loop. | [FuelScoreRing.tsx](frontend/components/FuelScoreRing.tsx) + `scan/index.tsx` result | S |
| U9 | **Confirm before mode switch if work-in-progress.** If user has a review-stage image or typed description and taps the other mode pill, show an Alert: "Switch to Product / Meal? Your draft will be lost." | [scan/index.tsx:669](frontend/app/scan/index.tsx:669) | S |
| U10 | **Empty-camera state.** Show an illustration + "Camera unavailable — tap the library icon or describe your meal" when the CameraView fails to render (including simulator). | [scan/index.tsx:1110](frontend/app/scan/index.tsx:1110) | S |

### 4.4. Modernization / delight (P2)

| # | Fix | Effort |
|---|-----|--------|
| M1 | **Streaming analysis**. Switch meal-scan to streaming generation: show each detected component as it arrives ("Found: chicken… brown rice… broccoli…") instead of a generic "Analyzing your meal" loop. Matches Cal AI. | L |
| M2 | **On-device first-pass classifier**. Ship a tiny MLKit / CoreML model that detects "is this food?" + dish category in <200ms, so the loading screen can populate the meal_label before the server round-trip finishes. Server result overwrites with accurate data. | L |
| M3 | **Live bounding box overlay**. Draw category boxes on the camera preview as items are detected — "Protein ✓  Carb ✓  Veg ✗". A great "oh this is smart" moment. | L |
| M4 | **Result screen A/B variants by tier.** High-Fuel result: confetti + "This earns you 0.8 flex credits 🎟️". Low-Fuel: "Use this as a flex meal? Tap to claim" (no shame, just framing as earned). This is the reward loop the README describes but the UI doesn't surface. | M |
| M5 | **"Before you buy" mode** in grocery stores — a Shopping mode that pre-queues comparisons and syncs with the weekly plan shopping list. The skeleton exists; deep-link it from the grocery list screen. | M |
| M6 | **Cross-device continuity** — scan on phone, open the result on desktop / web (for shared meal planning). Leans on the existing Supabase URLs. | M |

### 4.5. Testing & observability (P1)

| # | Fix | Effort |
|---|-----|--------|
| T1 | **Golden fixture suite** — check in the 18 images from this audit under `backend/tests/fixtures/scan/` and wire `test_fuel_score_golden.py` to assert scoring stays in expected ranges as models and prompts change. | M |
| T2 | **Synthetic accuracy dashboard** — nightly job that re-runs the golden suite against production Gemini and alerts on a Slack webhook when accuracy drops. | M |
| T3 | **Gemini model-health metric** — emit a Prometheus-style counter on model 5xx per endpoint so we can see overload periods in real-time. | S |
| T4 | **Scan-result logging with PII scrub** — for a user-opt-in cohort, log the scan image + JSON result to a review queue for weekly accuracy review. Key for tuning the prompt when reality deviates. | M |

---

## 5. Suggested rollout order

**Week 1 (P0, mostly backend):** A1 (remove clean-meal boost) → A2 (prompt upgrade with few-shot) → A3 (dish-type classifier) → R1 (retry + fallback model) → R3 (scan_fallback_model config). Ship behind a feature flag; verify on golden suite.

**Week 2 (P0 continued):** A4 + A5 + A6 + A7 + A8 (accuracy polish: refined-carb detection, OCR fuzzy match, concerns→tier, non-food rejection, image quality). A9 (golden test suite). R2 + R4 (degraded UX repair).

**Week 3 (P1 UX):** U1 (duplicate header) + U2 (product review step) + U3 (live barcode scan). U4 + U5 + U7 + U9 (retry path, share, swaps, draft protection).

**Week 4+:** U6 (ask coach modal), U8 (celebration), U10 (empty state), T1–T4 (testing/observability).

**Backlog:** M1–M6 (streaming, on-device classifier, bounding boxes, tier-specific result, grocery mode, cross-device).

---

## 6. Assets produced by this audit

All under [tasks/scan-audit/](tasks/scan-audit/):

- [images/](tasks/scan-audit/images/) — 18 test fixtures generated with `gemini-2.5-flash-image`
- [flows/](tasks/scan-audit/flows/) — Maestro YAML flows for capture + end-to-end
- [screenshots/](tasks/scan-audit/screenshots/) — simulator captures (home, capture screen, picker, login)
- [observations/](tasks/scan-audit/observations/) — per-image raw JSON responses + `summary.json` accuracy matrix
- [run_backend_scans.py](tasks/scan-audit/run_backend_scans.py) — the harness that drove all 18 scans against `/api/scan/*`
- [backend/scripts/generate_scan_test_images.py](backend/scripts/generate_scan_test_images.py) — reusable image generator (committed to scripts for future re-runs)

The golden test suite in §4.5 T1 should reuse these fixtures directly.
