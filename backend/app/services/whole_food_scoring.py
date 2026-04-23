from __future__ import annotations

import re
from typing import Any


SEED_OILS = {
    "canola oil",
    "soybean oil",
    "sunflower oil",
    "safflower oil",
    "corn oil",
    "cottonseed oil",
    "grapeseed oil",
    "rice bran oil",
    "vegetable oil",
}

ADDED_SUGARS = {
    "sugar",
    "cane sugar",
    "brown sugar",
    "invert sugar",
    "corn syrup",
    "high fructose corn syrup",
    "glucose syrup",
    "fructose",
    "dextrose",
    "maltodextrin",
    "evaporated cane juice",
    "tapioca syrup",
    "rice syrup",
    "agave nectar",
    "agave syrup",
    "coconut sugar",
    "date syrup",
    "maple syrup",
    "brown rice syrup",
    "barley malt",
    "barley malt syrup",
    "fruit juice concentrate",
    "malt syrup",
    "molasses",
    "treacle",
    "muscovado",
    "panela",
    "jaggery",
    "demerara",
    "sucrose",
    "maltose",
    "galactose",
}

REFINED_FLOURS = {
    "enriched wheat flour",
    "bleached wheat flour",
    "wheat flour",
    "white flour",
    "enriched flour",
    "refined flour",
}

ARTIFICIAL_ADDITIVES = {
    "artificial flavor",
    "artificial flavours",
    "artificial flavoring",
    "artificial colouring",
    "artificial coloring",
    "red 40",
    "yellow 5",
    "yellow 6",
    "blue 1",
    "blue 2",
    "red 3",
    "green 3",
    "sucralose",
    "aspartame",
    "acesulfame potassium",
    "potassium sorbate",
    "sodium benzoate",
    "bht",
    "bha",
    "tbhq",
    "nitrites",
    "nitrates",
    "sodium nitrite",
    "sodium nitrate",
    "titanium dioxide",
    "caramel color",
    "fd&c",
    "partially hydrogenated",
}

EMULSIFIERS_AND_GUMS = {
    "soy lecithin",
    "lecithin",
    "mono and diglycerides",
    "diglycerides",
    "guar gum",
    "xanthan gum",
    "gellan gum",
    "carrageenan",
    "polysorbate 80",
    "cellulose gum",
    "datem",
    "sodium stearoyl lactylate",
    "calcium stearate",
    "methylcellulose",
    "locust bean gum",
}

PROTEIN_ISOLATES = {
    "soy protein isolate",
    "pea protein isolate",
    "whey protein isolate",
    "milk protein isolate",
}

WHOLE_FOOD_FIRST_INGREDIENT_HINTS = {
    "chicken",
    "beef",
    "turkey",
    "salmon",
    "pork",
    "lamb",
    "shrimp",
    "tuna",
    "cod",
    "trout",
    "sardines",
    "eggs",
    "oats",
    "almonds",
    "cashews",
    "walnuts",
    "peanuts",
    "pecans",
    "macadamia",
    "dates",
    "apples",
    "banana",
    "avocado",
    "coconut",
    "milk",
    "greek yogurt",
    "lentils",
    "beans",
    "chickpeas",
    "brown rice",
    "quinoa",
    "sweet potato",
    "sweet potatoes",
    "hemp seeds",
    "chia seeds",
    "flaxseed",
}


def _normalize(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _split_ingredients(ingredients_text: str | None) -> list[str]:
    if not ingredients_text:
        return []
    normalized = _normalize(ingredients_text)
    normalized = normalized.replace("ingredients:", "").strip()
    parts = re.split(r",|\(|\)|;|\.", normalized)
    items = []
    for part in parts:
        item = re.sub(r"\[[^\]]*\]", "", part).strip(" :-")
        if item:
            items.append(item)
    return items


def _find_matches(ingredients: list[str], terms: set[str]) -> list[str]:
    """Find ingredient strings that match any term in the dictionary.

    Phase 1 fix for audit bug D: label OCR garbles words ("Soy Wey Protein
    Isolate" for "Soy Whey Protein Isolate"). We run exact word-boundary
    matching first (fast, precise), then fall through to Levenshtein-based
    fuzzy matching for short ingredient strings that look like OCR noise.
    """
    compiled = {term: re.compile(r"\b" + re.escape(term) + r"\b") for term in terms}
    matches: list[str] = []
    for item in ingredients:
        if any(pattern.search(item) for pattern in compiled.values()):
            matches.append(item)
            continue
        # Fuzzy match — only fire when the ingredient is non-trivially long
        # so we don't false-positive on short words.
        if len(item) < 5:
            continue
        if _fuzzy_match_any(item, terms):
            matches.append(item)
    seen: set[str] = set()
    deduped: list[str] = []
    for item in matches:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


def _fuzzy_match_any(item: str, terms: set[str]) -> bool:
    """Return True if ``item`` fuzzy-matches any term in ``terms``.

    We split ``item`` into word windows and match each window against the
    term set. This catches multi-word OCR garble like "soy wey protein
    isolate" matching "soy protein isolate" even though the middle token
    ("wey") doesn't appear in the reference.
    """
    words = re.findall(r"[a-z]+", item)
    if not words:
        return False
    for term in terms:
        term_len = len(term.split())
        if term_len == 0:
            continue
        # Single-word terms: check each word directly at edit distance ≤ 1.
        if term_len == 1:
            for w in words:
                if len(w) >= 4 and _edit_distance_le(w, term, 1):
                    return True
            continue
        # Multi-word terms: slide a window of width term_len over the item.
        for i in range(len(words) - term_len + 1):
            window = " ".join(words[i:i + term_len])
            # Allow edit distance proportional to term length (≤ 2 for 2-3 words)
            allowed = 2 if term_len <= 3 else 3
            if _edit_distance_le(window, term, allowed):
                return True
    return False


def _edit_distance_le(a: str, b: str, limit: int) -> bool:
    """Levenshtein distance bounded — returns True iff distance ≤ ``limit``.

    Cheap early-exit implementation (O(len(a) * len(b))) — only run on short
    strings and bounded by ``limit`` so it doesn't dominate the scan pipeline.
    """
    if abs(len(a) - len(b)) > limit:
        return False
    if a == b:
        return True
    if limit <= 0:
        return False
    # Standard DP
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * len(b)
        min_row = i
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            if curr[j] < min_row:
                min_row = curr[j]
        if min_row > limit:
            return False
        prev = curr
    return prev[-1] <= limit


def _get_float(payload: dict[str, Any], *keys: str) -> float:
    for key in keys:
        value = payload.get(key)
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return 0.0


FLAG_EXPLANATIONS = {
    "seed_oils": {
        "title": "Seed Oils",
        "explanation": "Industrial seed oils like canola, soybean, and sunflower oil are high in omega-6 fatty acids. Excess omega-6 can promote inflammation when not balanced with omega-3s. Look for olive oil, avocado oil, coconut oil, or butter instead.",
        "look_for": "Olive oil, avocado oil, coconut oil, butter, ghee",
    },
    "added_sugars": {
        "title": "Added Sugars",
        "explanation": "Added sugars spike blood glucose, leading to energy crashes and increased hunger. They appear under many names — corn syrup, dextrose, maltodextrin, and more. Short ingredient lists with no sugar variants are the goal.",
        "look_for": "Products sweetened with whole fruit, honey (in small amounts), or no sweetener",
    },
    "refined_flours": {
        "title": "Refined Flours",
        "explanation": "Refined flour has been stripped of the bran and germ — the parts with fiber, vitamins, and minerals. It digests quickly like sugar. Whole grain or sprouted grain versions retain the nutrition.",
        "look_for": "Whole wheat flour, almond flour, oat flour, sprouted grain flour",
    },
    "artificial_additives": {
        "title": "Artificial Additives",
        "explanation": "Artificial colors, flavors, and preservatives are synthetic compounds your body doesn't need. Some (like BHT, BHA, certain dyes) have been linked to health concerns in research. Simpler ingredient lists avoid these.",
        "look_for": "Products using natural preservatives like vitamin E (tocopherols) or citric acid",
    },
    "gums_or_emulsifiers": {
        "title": "Gums & Emulsifiers",
        "explanation": "Gums and emulsifiers (xanthan gum, carrageenan, lecithin) improve texture and shelf life. While most are safe in small amounts, some people experience digestive sensitivity. They signal a more processed product.",
        "look_for": "Products that use whole-food thickeners or don't need stabilizers",
    },
    "protein_isolates": {
        "title": "Protein Isolates",
        "explanation": "Protein isolates are heavily processed extractions — the protein is stripped from the whole food. While not harmful, they indicate a highly engineered product rather than real food. Whole-food protein sources are preferable.",
        "look_for": "Whole eggs, Greek yogurt, nuts, legumes, real meat for protein",
    },
}


def _build_flag_explanations(
    *,
    seed_oils: list[str],
    added_sugars: list[str],
    refined_flours: list[str],
    additives: list[str],
    gums: list[str],
    isolates: list[str],
) -> list[dict[str, str]]:
    """Return education explanations only for detected flag categories."""
    explanations = []
    if seed_oils:
        explanations.append({**FLAG_EXPLANATIONS["seed_oils"], "detected": seed_oils[:3]})
    if added_sugars:
        explanations.append({**FLAG_EXPLANATIONS["added_sugars"], "detected": added_sugars[:3]})
    if refined_flours:
        explanations.append({**FLAG_EXPLANATIONS["refined_flours"], "detected": refined_flours[:3]})
    if additives:
        explanations.append({**FLAG_EXPLANATIONS["artificial_additives"], "detected": additives[:3]})
    if gums:
        explanations.append({**FLAG_EXPLANATIONS["gums_or_emulsifiers"], "detected": gums[:3]})
    if isolates:
        explanations.append({**FLAG_EXPLANATIONS["protein_isolates"], "detected": isolates[:3]})
    return explanations


#: Batch 4 fix (QA N6/N7): beverage category check. Before this, Coca-Cola
#: UPC 049000028911 scored 82/100 "Mostly good" because the ingredient count
#: (~6) awarded +6 and "Relatively short ingredient list" highlighted as a
#: POSITIVE even though HFCS, phosphoric acid, and artificial sweeteners are
#: present. A sugary beverage that carries ultra-processed red flags must
#: land in the ultra_processed tier (<20) regardless of ingredient brevity.
_BEVERAGE_NAME_TOKENS = (
    "cola", "soda", "soft drink", "pop", "fizzy",
    "energy drink", "sports drink", "juice drink",
    "sweetened beverage", "frappucc", "flavored water",
    "sparkling juice", "iced tea", "sweet tea",
    "refresh", "gatorade", "powerade", "sprite",
    "mountain dew", "pepsi", "coke", "coca", "7-up", "7up",
    "rc cola", "dr pepper",
)
_ARTIFICIAL_SWEETENER_TOKENS = (
    "aspartame", "sucralose", "acesulfame", "acesulfame-k", "acesulfame potassium",
    "saccharin", "neotame", "advantame", "stevia glycoside",
)
ULTRA_PROCESSED_BEVERAGE_PENALTY = -55
ULTRA_PROCESSED_BEVERAGE_CEILING = 19  # guaranteed below "mixed" tier (50)


def _is_sweetened_beverage(
    product_name: str,
    ingredient_text: str,
    added_sugars: list[str],
    sugar_g: float,
) -> tuple[bool, list[str]]:
    """Return (is_sweetened_beverage, reasons).

    A product is treated as a sweetened beverage when its name suggests soda
    /juice drink / energy drink AND it carries either an added-sugar match or
    an artificial sweetener. Returns the matching reasons for the output.
    """
    text = f"{product_name} {ingredient_text}".lower()
    beverage_hits = [tok for tok in _BEVERAGE_NAME_TOKENS if tok in text]
    if not beverage_hits:
        return False, []
    sweetener_hits = [tok for tok in _ARTIFICIAL_SWEETENER_TOKENS if tok in text]
    if not added_sugars and not sweetener_hits and sugar_g < 10:
        # E.g. plain sparkling water — "sparkling juice" caught by name but
        # no sugar present.
        return False, []
    reasons = []
    if beverage_hits:
        reasons.append(f"Beverage category ({beverage_hits[0]})")
    if added_sugars:
        reasons.append("added sugars detected")
    if sweetener_hits:
        reasons.append(f"artificial sweeteners ({sweetener_hits[0]})")
    return True, reasons


def analyze_whole_food_product(payload: dict[str, Any]) -> dict[str, Any]:
    ingredients = _split_ingredients(payload.get("ingredients_text"))
    ingredient_count = len(ingredients)
    product_name = str(payload.get("product_name") or payload.get("brand") or "").lower()
    ingredient_text = " ".join(ingredients).lower()

    protein_g = _get_float(payload, "protein_g", "protein")
    fiber_g = _get_float(payload, "fiber_g", "fiber")
    sugar_g = _get_float(payload, "sugar_g", "sugar")
    carbs_g = _get_float(payload, "carbs_g", "carbs")
    sodium_mg = _get_float(payload, "sodium_mg", "sodium")
    calories = _get_float(payload, "calories")

    seed_oils = _find_matches(ingredients, SEED_OILS)
    added_sugars = _find_matches(ingredients, ADDED_SUGARS)
    refined_flours = _find_matches(ingredients, REFINED_FLOURS)
    additives = _find_matches(ingredients, ARTIFICIAL_ADDITIVES)
    gums = _find_matches(ingredients, EMULSIFIERS_AND_GUMS)
    isolates = _find_matches(ingredients, PROTEIN_ISOLATES)

    score = 92.0
    highlights: list[str] = []
    concerns: list[str] = []
    reasoning: list[str] = []

    # Batch 4: sweetened-beverage detection short-circuits the positive
    # signals of a short ingredient list. Coke has 6 ingredients but those
    # ingredients are all ultra-processed — it must not benefit from brevity.
    is_bev, bev_reasons = _is_sweetened_beverage(product_name, ingredient_text, added_sugars, sugar_g)
    if is_bev:
        score += ULTRA_PROCESSED_BEVERAGE_PENALTY
        concerns.append("Sweetened beverage: ultra-processed regardless of ingredient count.")
        reasoning.append("Beverage override: " + "; ".join(bev_reasons))

    # R23 generalization (Sprint 1 scoring-calibration battery): the
    # short-ingredient-list bonus was rescuing ultra-processed snacks whose
    # whole pitch is seed-oil + salt + potato (Lay's Chips scored 83 "solid"
    # pre-fix). Suppress the positive ingredient-count signal whenever a
    # *major* red flag fires: seed oils, added sugars, refined flours,
    # or the beverage-category penalty. The penalties for those red flags
    # still apply below — we just stop giving simultaneous credit for the
    # short list. Artificial additives and gums are left as "minor" — they
    # don't suppress the bonus on their own because some legitimate
    # minimally-processed foods (e.g., a sparkling water with "natural flavor")
    # contain one ambiguous token.
    # Phase 1 audit-bug fix: isolates and artificial additives also count as
    # "major red flags" — a 4-ingredient protein bar with soy isolate + sucralose
    # no longer gets the short-ingredient-list bonus.
    has_major_red_flag = bool(is_bev or seed_oils or added_sugars or refined_flours or isolates or additives)

    if ingredient_count == 0:
        score -= 14
        concerns.append("Ingredient list is missing, so the product is harder to trust.")
    elif ingredient_count <= 5 and not has_major_red_flag:
        score += 6
        highlights.append("Very short ingredient list.")
    elif ingredient_count <= 10 and not has_major_red_flag:
        score += 3
        highlights.append("Relatively short ingredient list.")
    elif ingredient_count > 20:
        score -= 12
        concerns.append("Long ingredient list usually signals a more processed product.")
    elif ingredient_count > 12:
        score -= 6
        concerns.append("Moderately long ingredient list.")

    if seed_oils:
        penalty = min(24, 14 + max(0, len(seed_oils) - 1) * 4)
        score -= penalty
        concerns.append("Contains industrial seed oils.")
        reasoning.append(f"Seed oils found: {', '.join(seed_oils[:3])}.")

    if added_sugars:
        penalty = min(20, 10 + max(0, len(added_sugars) - 1) * 3)
        score -= penalty
        concerns.append("Contains added sugars.")
        reasoning.append(f"Added sugar ingredients found: {', '.join(added_sugars[:3])}.")

    if refined_flours:
        score -= 12
        concerns.append("Uses refined flour instead of a whole-food carbohydrate source.")

    if additives:
        penalty = min(24, 12 + max(0, len(additives) - 1) * 4)
        score -= penalty
        concerns.append("Contains artificial additives or preservatives.")
        reasoning.append(f"Artificial additives found: {', '.join(additives[:3])}.")

    if gums:
        score -= min(10, 6 + max(0, len(gums) - 1) * 2)
        concerns.append("Includes gums or emulsifiers.")

    if isolates:
        score -= 6
        concerns.append("Uses protein isolates rather than mostly intact foods.")

    if fiber_g >= 5:
        score += 8
        highlights.append("Good fiber per serving.")
    elif fiber_g >= 3:
        score += 5
        highlights.append("Decent fiber per serving.")

    if protein_g >= 15:
        score += 6
        highlights.append("Strong protein per serving.")
    elif protein_g >= 8:
        score += 3
        highlights.append("Moderate protein per serving.")

    if sugar_g > 20:
        score -= 12
        concerns.append("High sugar load per serving.")
    elif sugar_g > 12:
        score -= 6
        concerns.append("Moderate sugar load per serving.")
    elif sugar_g <= 6 and ingredient_count > 0:
        score += 3
        highlights.append("Reasonable sugar level per serving.")

    if sodium_mg > 800:
        score -= 12
        concerns.append("Very high sodium per serving.")
    elif sodium_mg > 500:
        score -= 8
        concerns.append("High sodium per serving.")
    elif sodium_mg > 300:
        score -= 4

    if carbs_g > 0 and fiber_g > 0 and fiber_g / max(carbs_g, 1.0) >= 0.18:
        score += 4
        highlights.append("Carbs come with meaningful fiber.")

    first_ingredient = ingredients[0] if ingredients else ""
    if first_ingredient and any(re.search(r"\b" + re.escape(hint) + r"\b", first_ingredient) for hint in WHOLE_FOOD_FIRST_INGREDIENT_HINTS):
        score += 4
        highlights.append("Starts with a recognizable whole-food ingredient.")

    if calories > 0 and protein_g >= 10 and sugar_g <= 8 and not additives and not seed_oils:
        score += 4
        highlights.append("Macros are relatively aligned with a whole-food product.")

    # Batch 4: sweetened beverages always land ultra_processed even if some
    # redeeming macros sneak in (e.g., 15 g protein from a sugary recovery
    # drink still shouldn't read "solid" tier).
    if is_bev:
        score = min(score, float(ULTRA_PROCESSED_BEVERAGE_CEILING))

    # Phase 1 audit-bug fix (Bug E): tier floors driven by concerns + red flags.
    # Previously a protein bar with isolates + sucralose could still land in
    # the "whole_food" tier if its macros were balanced. A product the
    # classifier flagged as concerning cannot honestly read "whole food".
    #
    # Cap severity scales with how many categories of red flags co-occur:
    # a "healthwashed" single-red-flag product sits in mixed (≤60); a
    # product combining serious flags with added sugar or refined flour
    # is ultra-processed and capped in the 30s.
    serious_flags = bool(isolates or additives or seed_oils)
    also_sweetened = bool(added_sugars or refined_flours)
    if serious_flags and also_sweetened:
        score = min(score, 34.9)  # ultra_processed tier
    elif serious_flags:
        score = min(score, 59.9)  # below whole_food (85) and solid (70) tiers
    elif added_sugars or refined_flours:
        score = min(score, 69.9)  # below solid (70)
    elif concerns:
        score = min(score, 84.9)  # below whole_food (85)

    score = max(0.0, min(100.0, round(score, 1)))

    if score >= 85:
        tier = "whole_food"
        verdict = "Great choice"
        summary = "This looks very close to a real-food product with minimal processing."
        action = "This is a strong pantry pick for a whole-food lifestyle."
    elif score >= 70:
        tier = "solid"
        verdict = "Mostly good"
        summary = "This is fairly clean, but there are a few things worth watching."
        action = "Reasonable option. Compare brands if you want an even cleaner label."
    elif score >= 50:
        tier = "mixed"
        verdict = "Mixed bag"
        summary = "This product has some redeeming qualities, but it is noticeably processed."
        action = "Okay occasionally, but not ideal as a staple."
    else:
        tier = "ultra_processed"
        verdict = "Not a great fit"
        summary = "This product is heavily processed and does not align well with a whole-food approach."
        action = "Best used rarely. Look for a version with fewer ingredients and less processing."

    return {
        "score": score,
        "tier": tier,
        "verdict": verdict,
        "summary": summary,
        "recommended_action": action,
        "highlights": highlights[:4],
        "concerns": concerns[:5],
        "reasoning": reasoning[:4],
        "ingredient_count": ingredient_count,
        "nutrition_snapshot": {
            "calories": calories,
            "protein_g": protein_g,
            "fiber_g": fiber_g,
            "sugar_g": sugar_g,
            "carbs_g": carbs_g,
            "sodium_mg": sodium_mg,
        },
        "processing_flags": {
            "seed_oils": seed_oils,
            "added_sugars": added_sugars,
            "refined_flours": refined_flours,
            "artificial_additives": additives,
            "gums_or_emulsifiers": gums,
            "protein_isolates": isolates,
        },
        "flag_explanations": _build_flag_explanations(
            seed_oils=seed_oils,
            added_sugars=added_sugars,
            refined_flours=refined_flours,
            additives=additives,
            gums=gums,
            isolates=isolates,
        ),
    }
