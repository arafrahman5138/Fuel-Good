# Meal Construction Instructions

## Purpose
Use this workflow whenever a user sends a meal via:
- link
- screenshot
- pasted recipe text
- social media post

The goal is to turn that source into a Real-Food meal draft that fits the app's meal model, includes MES details, and is **not written to the database until the user explicitly approves**.

---

## Non-Negotiables
- Do **not** add anything to the DB until the user approves.
- Always rename the meal into a clean, app-friendly Real-Food title.
- Always rewrite the instructions in natural language so they feel easy to follow in-app.
- Always send the MES score and the full draft details back to the user before asking for approval.
- Always recalculate nutrition from the actual ingredient assumptions used in the draft. Do not reuse source macros after ingredient swaps.
- If meal-prep components are requested, check whether matching components already exist before creating new ones.
- If a default pairing is needed, check whether a good existing veggie side already exists before creating a new one.

---

## Intake Questions
When the user sends a meal, ask these questions first:

1. Should we create meal-prep components for this meal?
2. Should this meal have a default pairing?
3. Do you want me to hold this as a draft only, or prepare it in final DB-ready format for approval?

Default assumptions if the user does not answer clearly:
- Meal-prep components: `no`
- Default pairing: `yes` for bowls, plates, rice meals, wraps, burrito-style meals, and heavier sit-down meals
- Save behavior: `draft only until approval`

---

## Source Review
If the meal comes from a link:
- Extract the core title, ingredients, flavor direction, cooking method, and serving style.
- Ignore brand-heavy wording, filler, and promotional text.

If the meal comes from a screenshot:
- Read the visible title, ingredients, macros, captions, and instructions.
- Infer missing details carefully from the visible content.
- Flag any uncertain ingredients or steps instead of pretending they were clearly shown.

If the source is incomplete:
- Build the draft from the clearest visible structure.
- Call out what was inferred.

### Macro accuracy rule
- Use explicit ingredient assumptions for macro-sensitive items such as noodle type, pasta brand/style, beef leanness, oil amount, sweetener amount, and serving count.
- If the user changes a core ingredient, recalculate the macros from that new ingredient choice instead of carrying over the source nutrition panel.
- If a branded product is not specified, state the generic assumption used.

---

## Step 1: Classify the Meal
Decide whether the meal should be:
- `full_meal` only
- `full_meal` plus default pairing
- `full_meal` plus meal-prep components
- `full_meal` plus meal-prep components plus default pairing

Use these rules:

### Meal + default pairing
Use this when the meal should behave like a single complete recipe and the pairing is just a recommended side.

Examples:
- chicken plate with salad on the side
- skewers with a recommended bean salad
- potato bowl with a slaw served alongside

### Meal-prep components + default pairing
Use this when the meal is better modeled as reusable parts.

Usually create or reuse:
- protein
- rice or carb base
- veggie component if the meal truly has one as part of the bowl build
- sauce if it is distinct

Then add a default pairing separately if the meal still benefits from a recommended veggie side.

Examples:
- burrito bowls
- shawarma bowls
- rice bowls with reusable protein + carb bases

---

## Step 2: Check Existing Data First
Before creating anything new, check both:
- `backend/official_meals.json`
- live DB records if available

Look for:
- the full meal already existing under the same or a very similar name
- reusable protein components
- reusable carb components
- reusable veggie sides
- reusable sauces
- existing default pairing candidates that already fit the flavor profile

Prefer reuse over duplication.

### Match standard
Treat items as reusable matches when they are materially the same in:
- cuisine direction
- core seasoning profile
- role in the meal
- ingredient identity

Do not reuse something that is only vaguely similar.

---

## Step 3: Meal-Prep Component Decision
If the user says meal-prep components are needed:

### Check for existing components
Check whether the following already exist in DB/JSON:
- protein
- rice or carb base
- veggie component
- sauce

### If a component already exists
- Reuse it
- Keep naming consistent with existing conventions

### If a component does not exist
Create only the missing component(s).

### Component rules
- Protein component: focused, reusable, and clearly seasoned
- Carb component: plain enough to reuse, but still flavor-aligned
- Veggie component: only create if it is truly part of the bowl or assembly
- Sauce component: create only if the sauce is meaningful and reusable

Do not force all four component types if the source meal does not need them.

---

## Step 4: Default Pairing Decision
If the meal needs a default pairing:

### First check for an existing veggie side
Search for an existing veggie side that fits:
- cuisine
- acid level
- texture
- ingredient harmony
- MES improvement potential

Good pairing examples:
- slaws
- chopped salads
- cucumber-herb salads
- cabbage-lime sides
- lemony veggie salads

### If a good existing pairing exists
- Reuse it
- Explain why it fits

### If no good pairing exists
Create a new veggie side that:
- fits the meal's flavor profile
- improves fiber and veggie density
- ideally includes acid and/or healthy fat
- reads naturally as a side someone would actually eat with the meal

Avoid random pairings that only optimize MES numerically.

---

## Step 5: Rename the Meal
Always rename the meal before presenting it back.

### Naming rules
- Keep it short and app-friendly
- Preserve the core flavor identity
- Remove awkward source phrasing
- Avoid generic names like `Chicken Bowl`
- Avoid creator-brand phrasing or viral caption language

Good examples:
- `Smoky Chicken Potato Fiesta Bowl`
- `Tomato Chicken Burrito Bowl`
- `Lemon Herb Chicken Rice Plate`

---

## Step 6: Rewrite the Instructions
Rewrite the steps in natural language.

### Instruction rules
- Write like a helpful home cook, not like scraped recipe text
- Keep steps clear and sequential
- Add a slight Real-Food twist to improve clarity, flow, or flavor
- Preserve the spirit of the source meal
- If there is a default pairing, mention when it should be served
- If there are components, write component steps separately and include assembly

### Tone target
- conversational
- natural
- practical
- easy to follow in-app

Avoid:
- robotic phrasing
- overlong chef narration
- direct copy from source text

---

## Step 7: Build the Full Draft
Before asking for approval, prepare the complete meal package.

## Include
- final meal title
- short app-friendly description
- ingredients
- rewritten steps
- prep time
- cook time
- total time
- servings
- tags
- flavor profile
- dietary tags
- cuisine
- health benefits
- protein type
- carb type
- recipe role
- `is_component`
- `meal_group_id` strategy if components are involved
- default pairing choice if applicable
- component composition if applicable
- full nutrition estimate
- MES score details

### If components are included
Also provide:
- each component title
- each component role
- component ingredients
- component steps
- whether it already existed or is newly proposed

### If a default pairing is included
Also provide:
- pairing title
- why it was chosen
- whether it already existed or is newly proposed
- expected MES improvement

---

## Step 8: MES Reporting
Always send MES information back with the draft.

### Use the current MES method
Calculate and report MES using the app's current scoring model:
- compute the base meal MES from the meal nutrition
- if there is a default pairing, compute the combined meal + pairing nutrition
- apply the pairing-adjusted logic on top of the combined nutrition when available

This means default pairings should not be treated as a simple note on the side. They should use the same paired scoring logic already used in the app.

### Default pairing rule
For any meal with a default pairing, the default pairing should support a true pairing-adjusted MES path.

That means:
- prefer an existing veggie side with a valid `pairing_synergy_profile`
- if the best flavor-fit side does not have a `pairing_synergy_profile`, either choose another good-fit existing side that does, or create/update a side so the pairing-adjusted score is real
- do not finalize a default pairing if the paired score is only a macro-added combined score unless that limitation is explicitly called out and approved

Standard expectation:
- `mes_default_pairing_adjusted_score` should reflect actual pairing adjustment logic
- `mes_default_pairing_gis_bonus` should be present when the side qualifies
- `mes_default_pairing_synergy_bonus` should be present when the side qualifies
- `mes_default_pairing_reasons` should explain why the pairing improved the score

### Pairing-adjusted scoring details
When a default pairing exists, include these when available:
- macro-based combined score
- pairing GIS bonus
- pairing synergy bonus
- pairing reasons

Pairing logic should reward things like:
- fiber-rich veggie sides
- acid from lemon, lime, or vinegar
- healthy fat
- high veggie density
- timing effects like `before_meal` when relevant

## Report
- base meal MES score
- MES tier
- MES sub-scores if available
- paired MES score if there is a default pairing
- default pairing delta
- pairing reasons

### Preferred MES fields
When building the draft, align to the current stored field pattern where possible:
- `mes_score`
- `mes_display_score`
- `mes_tier`
- `mes_sub_scores`
- `mes_score_with_default_pairing`
- `mes_default_pairing_delta`
- `mes_default_pairing_adjusted_score`
- `mes_default_pairing_synergy_bonus`
- `mes_default_pairing_gis_bonus`
- `mes_default_pairing_reasons`

If exact MES cannot be computed yet:
- state that the score is an estimate
- explain what still needs to be computed

---

## Step 9: Approval Gate
After drafting, send the user:

1. the proposed meal
2. any proposed new components
3. any proposed default pairing
4. MES details
5. a clear statement that nothing has been added to the DB yet

Then ask for approval before:
- inserting recipes
- updating existing recipes
- exporting JSON
- modifying meal relationships

---

## Recommended Response Format
When presenting the draft, use this structure:

### Meal
- title
- description
- why the rename works

### Modeling
- meal only, meal + default pairing, or meal-prep components + default pairing
- what will be reused
- what would be newly created

### Components
- protein
- carb
- veggie
- sauce

### Default Pairing
- pairing title
- reuse vs new
- why it fits

### Nutrition and MES
- calories
- protein
- carbs
- fat
- fiber
- sugar
- MES score
- MES tier
- paired MES score if applicable
- MES delta

### Approval
- explicitly state that nothing has been added to the DB yet
- ask whether to proceed

---

## DB-Ready Rule
Do not write to the DB until the user says some version of:
- `approve`
- `go ahead`
- `add it`
- `save this`

Until then, keep everything as a draft proposal only.

---

## Quick Decision Checklist
- Did I ask whether meal-prep components are needed?
- Did I ask whether it needs a default pairing?
- Did I check existing DB/JSON entries before proposing new records?
- Did I rename the meal?
- Did I rewrite the instructions naturally?
- Did I choose reuse over duplication where appropriate?
- Did I include MES details?
- Did I clearly state that nothing has been added to the DB yet?
