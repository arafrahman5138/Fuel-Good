# Scan Pipeline Design — Speed × Accuracy

**Date:** 2026-04-22
**Goal:** p50 ≤ 2.5s shutter-to-first-result, p99 ≤ 6s, and a NOVA-based scoring model that earns the 100-ceiling honestly.
**Scope:** `/api/scan/meal` + `/api/scan/product/image` + `frontend/app/scan/index.tsx`.

---

## 1. Today's pipeline (sequential, single-model, no cache)

```
shutter → client POST multipart
          → server reads bytes (sync)
          → server validates mime (sync)
          → server calls Gemini 2.5 Flash (up to 40s, no retry)
          → server uploads to Supabase (sync, after Gemini returns)
          → server runs fuel_score (sync)
          → server persists scan row (sync)
          → response → client renders result
```

p50 ≈ 3–5s. p99 = degraded fallback (full outage when Gemini 503s). Clean-meal boost fires without verifying any component is actually NOVA 1.

---

## 2. Target pipeline

```
shutter
  │
  ├─[client]─ render skeleton + blurhash                          0 ms
  │
  ├─[client]─ content-hash the image (sha256 first 64KB)         20 ms
  │                                                                │
  │     POST /api/scan/meal/stream  (SSE or chunked JSON) ────────┤
  │                                                                │
  ├─[server]─ cache lookup (Redis, keyed on hash + prompt-ver)   <5 ms
  │     ├─ HIT → stream cached result ─────────────────► DONE
  │     └─ MISS
  │
  ├─[server] FAN-OUT three tasks in parallel:
  │     ├─ A. image quality probe (PIL: Laplacian var + mean)   ~30 ms
  │     ├─ B. Supabase upload (async, fire-and-forget)       200–600 ms
  │     └─ C. Gemini extraction (streaming JSON)            1500–3500 ms
  │                                                                │
  ├─[server] as Gemini streams components:
  │     │   on each component: classify role, NOVA-tag, push SSE
  │     └─ on final: deterministic dish-classifier merges implicit flags
  │
  ├─[server] local scoring (no network): NOVA-weighted penalty     <5 ms
  │
  └─[server] persist + emit final SSE event ───────────────► DONE
```

Budget (meal scan, cache miss):
- First visible component on screen: **~1.2s** (Gemini TTFB)
- Full result: **~2.5s** p50
- Bad network / Gemini slow: race flash-lite at 3.0s; whichever wins, returns.
- Gemini 5xx both models: `degraded_fallback` with inline retry CTA.

---

## 3. Concrete changes

### 3.1 Transport: streaming endpoint

New route: `POST /api/scan/meal/stream` — Server-Sent Events (`text/event-stream`). Keep the existing `/api/scan/meal` as a blocking wrapper over the stream for backwards compat and for tests.

Event shape:
```
event: quality      data: {"blur_ok": true, "brightness_ok": true}
event: component    data: {"name":"Grilled chicken","role":"protein","nova":1}
event: component    data: {"name":"White rice","role":"carb","nova":2,"flags":["refined_flour"]}
event: component    data: {"name":"Broccoli","role":"veg","nova":1}
event: final        data: {<full result incl. fuel_score, reasoning, storage_ref>}
```

Client shows components as they arrive (Cal-AI-style "found …").

### 3.2 Fan-out on the server

Replace the sequential body of [scan_meal](backend/app/routers/scan.py:576) with:

```python
quality_task  = asyncio.create_task(probe_image_quality(image_bytes))
upload_task   = asyncio.create_task(maybe_upload_to_supabase(user_id, image_bytes, mime))
extract_stream = gemini_stream_meal(image_bytes, mime, context)  # async generator

async for chunk in extract_stream:
    yield sse("component", chunk)

quality  = await quality_task
storage  = await upload_task        # done in parallel with extraction
final    = merge_and_score(components, quality, dish_label)
yield sse("final", final)
```

**Why this matters:** Supabase upload (200–600ms) currently runs *after* Gemini returns. Moving it in parallel shaves that off the critical path entirely.

### 3.3 Gemini streaming

Swap the single POST in [meal_scan.py:584](backend/app/services/meal_scan.py:584) for `streamGenerateContent`:

```python
url = f".../models/{model}:streamGenerateContent?alt=sse&key={api_key}"
async with client.stream("POST", url, json=payload) as r:
    buffer = ""
    async for line in r.aiter_lines():
        if not line.startswith("data:"): continue
        buffer += extract_text(line)
        for component in partial_parse_components(buffer):
            yield component
```

We don't need fully-valid JSON to emit components — a permissive partial parser on the `"components":[…]` array is enough. Final JSON parse happens once stream closes.

### 3.4 Model racing + fallback

New helper in [meal_scan.py](backend/app/services/meal_scan.py):

```python
async def extract_with_race(image, mime, ctx):
    primary = asyncio.create_task(gemini_stream(FLASH, ...))
    try:
        async for ev in primary: yield ev
    except (HTTPStatusError, TimeoutError) as e:
        if already_streamed_components: raise  # don't double-stream
        lite = asyncio.create_task(gemini_stream(FLASH_LITE, ...))
        async for ev in lite: yield ev
```

Plus: if primary hasn't emitted its first token by **3.0s**, start `flash-lite` in parallel and consume whichever reaches `final` first. Cancel the loser.

Config additions in [config.py:68](backend/app/config.py):
- `scan_model = "gemini-2.5-flash"`
- `scan_fallback_model = "gemini-2.5-flash-lite"`
- `scan_race_threshold_ms = 3000`
- `scan_per_call_timeout_s = 8`  (down from 40 — we race instead of waiting)

### 3.5 Content-hash cache

Redis key: `scan:meal:v{PROMPT_VERSION}:{sha256_of_image}`. TTL 7 days.

Barcode scans: `scan:upc:{code}` — TTL 24h.
Label image: `scan:label:v{PROMPT_VERSION}:{sha256}` — TTL 7 days.

This single addition turns re-scanning the same item (grocery aisle compare, second take of same photo) into ~50ms instead of 3000ms.

Invalidate on:
- Prompt version bump (baked into key)
- User edits the result (purge key so next scan re-extracts)

### 3.6 Client-side instant feedback

In [scan/index.tsx:1640](frontend/app/scan/index.tsx:1640):

1. On shutter press: immediately render a skeleton result card with a blurhash backdrop of the captured frame. Push to `scanStep = 'analyzing'` in the same tick.
2. Open EventSource to the stream endpoint. Append each `component` event to a ticker above the skeleton: "Found: chicken ✓ — rice ✓ — broccoli ✓".
3. On `final`, swap skeleton → real card with a single fade crossfade. Haptic on score reveal.

If the SSE connection errors: fall back to the existing blocking POST. (Legacy path stays intact.)

---

## 4. Scoring rewrite (NOVA-based)

Replaces the heuristic block in [fuel_score.py:150-260](backend/app/services/fuel_score.py:150).

### 4.1 Per-component NOVA tagging

After Gemini returns components, run a deterministic local classifier that stamps each with a NOVA level 1-4:

```python
NOVA_PENALTY = {1: 0, 2: 3, 3: 10, 4: 22}  # per 100% mass fraction

def tag_component(comp: dict) -> dict:
    name  = normalize(comp["name"])
    role  = comp.get("role")
    # 1. exact-match dictionary (500 common ingredients → NOVA + flags)
    hit = NOVA_DICT.get(name)
    if hit: return {**comp, **hit}
    # 2. token-level fuzzy (handles OCR garble: "Soy Wey Protein Isolate" → whey_isolate NOVA 4)
    hit = fuzzy_match(name, NOVA_DICT, max_distance=2)
    if hit: return {**comp, **hit}
    # 3. role fallback: protein/veg/fruit → NOVA 1; carb unknown → NOVA 2
    return {**comp, "nova": default_nova_for(role)}
```

### 4.2 Dish-type implicit flags

Deterministic lookup keyed on `meal_label`:

```python
DISH_IMPLICIT_FLAGS = {
    "pizza":       [("refined_flour", "high"), ("processed_cheese", "medium"), ("cured_meat", "medium", "if_pepperoni")],
    "carbonara":   [("refined_flour", "high"), ("cured_meat", "medium")],
    "cheeseburger":[("refined_flour", "high"), ("processed_cheese", "medium"), ("seed_oil_fried", "medium")],
    "french fries":[("seed_oil_fried", "high")],
    "ramen":       [("refined_flour", "high"), ("sodium_high", "medium")],
    # ~60 dishes total
}
```

These merge into `whole_food_flags` **before** scoring. Any dish-implicit flag also forces `nova ≥ 3` on the matching component if Gemini under-classified it.

### 4.3 Scoring formula

```python
# base
score = 100.0

# per-component penalty by mass fraction × NOVA
for comp in components:
    w = comp.get("mass_fraction") or (1 / len(components))
    score -= w * NOVA_PENALTY[comp["nova"]]

# preparation modifier (fried/battered/sugared)
for comp in components:
    if "fried" in comp["methods"]:   score -= 6 * w
    if "battered" in comp["methods"]: score -= 4 * w
    if "added_sugar_g" in comp and comp["added_sugar_g"] > 10: score -= 5

# balance bonus (has protein + veg + whole carb)
if has_role({"protein","veg","whole_carb"}): score += 3

# tier floors
if any severity=="high" in flags: score = min(score, 55)
if concerns non-empty: tier ≤ "solid"
```

### 4.4 The "clean-meal 100" rule, done right

```python
if all(comp["nova"] <= 2 for comp in components) \
   and not any_high_severity_flag \
   and not has_dessert_component \
   and confidence >= 0.8 \
   and source_model != "degraded_fallback":
    score = max(score, 100)
```

Pizza fails this because dough is NOVA 3 and pepperoni is NOVA 4. Grilled chicken + quinoa + broccoli passes.

### 4.5 Confidence attenuation

```python
if quality.blur_ok is False or quality.brightness_ok is False:
    confidence *= 0.5
    review_required = True
```

Surfaces in the UI as "Image may be low quality — review before logging."

---

## 5. Accuracy harness

Before we ship, golden tests against the 18 fixtures from the audit:

```python
# backend/tests/test_fuel_score_golden.py
@pytest.mark.parametrize("fixture,expected_range", [
    ("meal_01_healthy_plate", (90, 100)),
    ("meal_02_diner_burger",  (20, 40)),
    ("meal_04_pasta_carbonara", (35, 55)),
    ("meal_06_pizza_slice",   (15, 35)),
    ("edge_03_coffee_latte",  (50, 70)),
    # …
])
def test_golden(fixture, expected_range):
    payload = load_fixture_response(fixture)
    result = score_scan(payload)
    assert expected_range[0] <= result.score <= expected_range[1]
```

CI fails if accuracy regresses. This is the single biggest lever for not backsliding.

---

## 6. Rollout phases

### Phase 1 — "Honest scoring" (ship in 1 PR)
1. NOVA dictionary (~500 ingredients) + dish implicit flags (~60 dishes)
2. Rewrite `_score_scan` to NOVA-weighted formula
3. Add golden test suite against audit fixtures
4. Expand meal prompt to emit `nova` and `mass_fraction` per component (so Gemini does some of the tagging itself; local pass backs it up)
5. Clean-meal boost gated on NOVA check

**Outcome:** pizza → Fuel ~25, carbonara → ~45, latte → ~60, salmon plate → ~92. No latency change yet.

### Phase 2 — "Never breaks" (retry + fallback, +1 PR)
1. Add `scan_fallback_model` config + race logic
2. Retry-once-with-jitter on primary 5xx
3. Degraded-result UI: "Try again" + "Describe instead" CTAs
4. Don't persist degraded scans unless user confirms

**Outcome:** Gemini 503 stops causing outages.

### Phase 3 — "Feels instant" (streaming + parallel fan-out, +1 PR)
1. New `/api/scan/meal/stream` SSE endpoint
2. Move Supabase upload to parallel task
3. Partial-JSON parser for Gemini stream
4. Client ticker animation for component arrivals
5. Content-hash Redis cache

**Outcome:** p50 ~2.5s perceived, cached scans ~50ms, grocery compare feels native.

### Phase 4 — "Delight" (optional)
- Haptic celebration for Fuel ≥ 90
- Suggested-swap card for Fuel < 60 (`suggested_swaps` already in schema, just wire UI)
- On-device "is this food?" MLKit pre-classifier (<200ms) — populates meal_label before server round-trip

---

## 7. What this plan deliberately doesn't do

- **No new ML model hosting.** We reuse Gemini + local dictionaries. No inference server to run.
- **No rewrite of the result screen.** The existing hero → score ring → collapsible sections layout is good; we just feed it better data, faster.
- **No per-user scoring personalization** (yet). Phase 4+ territory; for now, ground truth is philosophy-driven, not user-specific.
- **No change to barcode scoring.** OpenFoodFacts already returns structured ingredients; same NOVA tagging applies but the pipeline work is smaller.

---

## 8. Open questions for you

1. **Mass-fraction estimation**: Gemini is mediocre at "30% rice, 40% chicken, 30% veg." Acceptable to default to equal weighting when it's unsure, or do we want a plate-photo segmentation model later?
2. **NOVA dictionary ownership**: bake it into the repo as JSON, or put it in Supabase so we can tune without redeploying?
3. **Streaming priority**: is perceived speed (streaming) higher priority than total latency (parallel + cache)? Both ship cheap, but if we have to pick phase order, the scoring fix (Phase 1) unblocks trust, and Phase 2 prevents outages — Phase 3 is the polish.
