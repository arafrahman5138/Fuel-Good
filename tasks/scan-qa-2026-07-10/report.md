# Scan Accuracy QA — Gemini Image Suite (2026-07-10)

28 synthetic images generated with `gemini-2.5-flash-image` (10 meals healthy→unhealthy,
6 desserts, 5 nutrition labels, 5 grocery items, 2 edge cases), each with ground truth
(expected scan type, key components, kcal range, Fuel/label score range) in
[ground_truth.json](ground_truth.json). Full suite run against `POST /api/scan/smart`
on the local backend with a real Gemini key ([run_suite.py](run_suite.py), raw results in
`results/`), plus 5 end-to-end simulator scans through the app UI (Expo Go, iPhone 17 Pro,
Maestro flows in `flows/`, proof screenshots in `screenshots/`).

**Test-env caveat:** `ANTHROPIC_API_KEY` and `USDA_API_KEY` are placeholders locally, so the
Claude ensemble and USDA grounding stages were skipped (`ensemble_applied: false`). Production
runs those stages: nutrition numbers should be somewhat better there, latency somewhat worse.

## Headline results

| Metric | Result | Verdict |
|---|---|---|
| Scan-type classification | 27/28 (96.4%) | Strong |
| Component recall (meals, n=20) | 1.00 mean | Excellent — every ground-truth food found |
| Fuel score in expected range (meals) | 16/20 | Good, misses analyzed below |
| Label score in expected range | **2/7** | **Weakest area** |
| Calories in expected range (meals) | 12/20 | Portion estimation is the weak link |
| Latency | p50 7.8s, p90 11.7s, max 14.1s (labels 9–14s) | Slower than Cal AI's perceived ~2s |
| Simulator E2E | 5/5 scans completed & displayed | App ↔ API results consistent |

The one classification miss: `d03_dark_chocolate_squares` → `label` (the foil wrapper behind
the chocolate read as packaging). Defensible, but a meal-vs-product tiebreak on "is prepared
food the dominant subject" would fix it.

## Defects found (ranked)

### P0-1 — `/scan/smart` missing from the client's AI-timeout allowlist
`frontend/services/api.ts:30-38` grants the 90s `aiTimeout` to `/scan/meal` and
`/scan/product/image` but **not `/scan/smart`** — the endpoint the app actually uses. Smart
scans get the 15s default. Local label scans hit 14.1s *without* USDA/Claude stages; production
will regularly breach 15s → user-facing timeout errors on an otherwise-successful scan. One-line fix.

### P0-2 — Ingredient-overlap cache changes the score (same food, 30-pt swing)
Proven with identical thali scans minutes apart on the same account:
fresh scan → **Fuel 40**; cached scan (`source_model=…+cached`, `cache_source_id` pointing at the
fresh scan, identical ingredient list) → **Fuel 70**. Donuts drifted 28→30 the same way.
The cached path (`_check_ingredient_cache`, `meal_scan.py`) reuses grounding but recomputes the
Fuel score from lossy reconstructed inputs. Users will see different scores for the same meal
photo. Fix: persist the full component detail (NOVA, methods, mass fractions) in the cache — or
simply reuse the source scan's computed score verbatim.

### P1-3 — Label scoring is fooled by health-washing and too lenient on ultra-processed
- `l03_healthwashed_smoothie` (53g sugar from juice concentrates, "No Added Sugar\*" claim):
  scored **100/100**. Juice concentrates aren't treated as added sugar and total-sugar load is
  ignored.
- `l02_cola` (39g added sugar, HFCS, phosphoric acid): 34.9 — should be ≤25 (ultra tier).
- `l04_instant_noodles` (palm oil, MSG, TBHQ, Yellow 6): 34.9 — same.
- Clean labels scored correctly (beans 100, oats 100).

### P1-4 — Label scores are quantized to ~3 values
Across 7 label results the only scores emitted were **34.9, 59.0, 100.0**. The scorer snaps to
coarse buckets and can't distinguish "cola" from "granola bar with seed oils." Meal Fuel scores
show similar clustering (100/70/40/35/28/25).

### P1-5 — The fallback model serves most scans
10 of 12 logged scans were answered by `gemini-2.5-flash-lite` (the racer that starts at 3000ms,
`scan_race_threshold_ms`), not the primary `gemini-2.5-flash`. You pay for both calls and mostly
ship the weaker model's answer. Either raise the race threshold (~6–8s), or deliberately embrace
lite and validate its accuracy — right now it's accidental.

### P1-6 — Calorie/portion error, biased toward underestimating energy-dense foods
- Fried chicken basket: 420 kcal vs ~900+ real (−55%)
- Ice-cream sundae: 204 kcal vs ~600 (−65%)
- Whole rotisserie chicken: 450 kcal
- Sushi platter: 1130 kcal vs ~550 (+105%) — the one big overestimate
- Fruit salad 395 (+~80%), parfait 515 (+~35%)
This matches the published literature (portion size ~39% reliability across AI food apps) and
Cal AI's own weak spot. Food *identification* is solved; *quantity* is not.

### P2-7 — Front-of-pack grocery items get confident mid scores with zero ingredient data
Cheese-puff bag front and toaster-pastry box front (no ingredient panel visible) both scored
**59 "mixed"** with normal confidence. There is no evidence for 59 — these should route to
"scan the ingredients panel or barcode" with a low-confidence banner, not a specific number.

### P2-8 — Label result UI: `NaNg` fat, and carbs 0g alongside sugar 39g
Simulator screenshot `screenshots/` (cola scan): fat renders literally as **"NaNg"**; carbs shows
0g while sugar shows 39g. Missing-macro handling needs a null-guard + display fallback, and
sugar should never exceed carbs.

### P2-9 — Garbage OCR'd brand names displayed raw
Generated label's fake brand OCR'd to "Facouard 1% tanseorgh" and was shown as the product title.
Needs a sanity pass (dictionary/confidence check) with fallback to a generic name ("Cola, 2L").

### P2-10 — Cultural scoring bias
Home-style Indian thali (dal, rice, roti, palak paneer, raita) fresh-scanned at **Fuel 40** — the
same score as the fried-chicken-and-fries basket. Roti/ghee/paneer appear to resolve to harsh
NOVA classes. (The cached rescan gave 70, which is closer to fair — see P0-2.) Non-Western
home cooking shouldn't score like fast food; worth a NOVA-mapping audit for South Asian staples.

### Also noted
- Rotisserie supermarket chicken: Fuel 100 + "Whole-Food Pass" — too generous for a
  sodium-injected prepared item; kcal also badly under (450 for a whole bird).
- Apple pie à la mode: Fuel 55 — dessert penalty didn't bite.
- d05/d06 desserts correctly landed 28–30 with red flags. Bananas/avocados correctly 100.

## What's already good
- Smart classification (96%) incl. front-of-pack → label routing, and multi-dish thali handling.
- Component identification is effectively perfect on clear photos, including mixed cuisine.
- Meal-tier ordering is broadly correct: healthy plates 100 > sushi 70 > pasta 60s > burger 35 >
  ramen+hot dogs 25. The spectrum works; the calibration at the edges doesn't.
- The E2E app flow works and matches API results; result screen communicates tiers well.

## Optimization plan (benchmarked against Cal AI)

Cal AI research (sources in the research summary): confirmed multi-model routing ("different
models are better with different foods" — TechCrunch 2025), RAG against food databases instead of
LLM-emitted macros, a "Fix Results" describe-what's-wrong re-prompt, claimed 90% accuracy under
good lighting (marketing), only ~30% of logged calories come from photo scans (CNBC).

Ranked by impact/effort:

1. **Fix the `/scan/smart` timeout allowlist** (P0-1). One line, prevents production failures.
2. **Make cached scans return the original score verbatim** (P0-2). Consistency is trust; Cal AI's
   top user complaint category is inconsistency on repeat scans.
3. **Recalibrate the label scorer** (P1-3/4): treat juice concentrates + syrups as added sugar,
   add a total-sugar-per-serving penalty ramp, enforce the ultra-processed tier cap when
   HFCS/TBHQ/artificial colors present, and spread the score range so products differentiate.
   The scan suite here is a ready-made regression eval (`run_suite.py` exit-codes on it).
4. **Decide the model race deliberately** (P1-5): measure flash vs flash-lite on this suite;
   either raise `scan_race_threshold_ms` so the primary usually wins, or route by food type
   (Cal AI's confirmed tactic) — e.g. lite for single-item produce, flash for mixed plates/labels.
5. **Attack portion error** (P1-6), the industry-wide weak link: prompt for plate-diameter
   reference, add a one-tap "small/medium/large" confirm chip pre-result, and surface
   hidden-ingredient suggestions ("likely cooked in oil — add ~120 kcal?") as one-tap accepts.
   Even a single disambiguating tap would beat Cal AI on mixed dishes.
6. **Use the existing SSE stream** (`/scan/meal/stream`) in the app for progressive results —
   show identified components within ~2s while macros/score resolve. Closes the perceived-speed
   gap with Cal AI without model changes.
7. **Front-of-pack → barcode handoff** (P2-7): when a package front is detected with no
   ingredient panel, deep-link to barcode entry instead of emitting a made-up 59.
8. **Keep corrections as data**: the correction endpoint already exists; persist per-user
   corrections ("my usual oatmeal") — reviewers explicitly ding Cal AI for not learning.
9. **Publish an honest accuracy methodology** once label scoring is fixed — nobody in the
   space has a credible public benchmark; this suite is the seed of one.

## Repro
```
# generate images (needs GOOGLE_API_KEY in backend/.env)
backend/venv/bin/python tasks/scan-qa-2026-07-10/generate_images.py
# run API suite (writes results/summary.json)
TOKEN=... backend/venv/bin/python tasks/scan-qa-2026-07-10/run_suite.py
# simulator E2E (needs JAVA_HOME=/opt/homebrew/opt/openjdk@17, booted sim, Metro on :8081)
xcrun simctl addmedia booted tasks/scan-qa-2026-07-10/images/<name>.png
maestro test -e SLUG=<short> tasks/scan-qa-2026-07-10/flows/scan-one.yaml
```
Note: `simctl addmedia` dedupes identical files — re-adding the same PNG does NOT make it the
newest picker item. Uniquify bytes (PNG text chunk) per run; see report history.
