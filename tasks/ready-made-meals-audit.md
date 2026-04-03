# Ready-Made Meals Audit Report

**Date:** April 2, 2026
**Total recipes audited:** 213 (152 in seed_meals.py + 61 in seed_meals_global.py)
**Overall assessment:** Excellent flagship content with 35 specific issues to fix

---

## Executive Summary

The 213 curated recipes are diverse, well-written, and genuinely follow the whole-food philosophy. Titles are appealing, descriptions are enticing, cooking steps are clear, and nutrition data is internally consistent (macro math checks out for all recipes). This is production-quality content.

However, the audit uncovered **35 issues** across 5 categories that would undermine user trust if not fixed:

| Category | Count | Severity |
|----------|-------|----------|
| Dietary tag contradictions | 5 | P0 Critical (safety) |
| Time/category mislabeling | 26 | P1 High (UX) |
| Nutrition inaccuracies | 9 | P1 High (trust) |
| Missing images | All 213 | P2 Medium (appeal) |
| Servings/calorie confusion | 7 | P2 Medium (data) |

---

## P0 Critical: Dietary Tag Contradictions (5 recipes)

These recipes have ingredients that directly contradict their dietary tags. This is a **safety issue** for users with allergies or dietary restrictions.

### 1. Gado-Gado — "vegan" tag but contains eggs
- **File:** seed_meals_global.py
- **Tags:** vegan, gluten-free, dairy-free
- **Problem:** Contains 4 hard-boiled eggs (not vegan)
- **Fix:** Remove "vegan" tag, add "vegetarian" instead

### 2. Chana Masala — "vegan" + "dairy-free" but contains ghee
- **File:** seed_meals_global.py
- **Tags:** vegan, gluten-free, dairy-free
- **Problem:** Contains 2 tbsp ghee (dairy product, not vegan)
- **Fix:** Remove "vegan" and "dairy-free" tags, OR replace ghee with coconut oil in ingredients

### 3. Chicken Biryani — "dairy-free" but contains ghee + yogurt
- **File:** seed_meals_global.py
- **Tags:** gluten-free, dairy-free
- **Problem:** Contains 3 tbsp ghee + 0.5 cup Greek yogurt (both dairy)
- **Fix:** Remove "dairy-free" tag

### 4. Lamb Rogan Josh — "dairy-free" but contains ghee + yogurt
- **File:** seed_meals_global.py
- **Tags:** gluten-free, dairy-free
- **Problem:** Contains 3 tbsp ghee + 0.5 cup Greek yogurt (both dairy)
- **Fix:** Remove "dairy-free" tag

### 5. Doro Wot — "dairy-free" but contains ghee
- **File:** seed_meals_global.py
- **Tags:** gluten-free, dairy-free
- **Problem:** Contains 3 tbsp ghee (dairy)
- **Fix:** Remove "dairy-free" tag, OR replace ghee with coconut oil

---

## P1 High: Time/Category Mislabeling (26 recipes)

These recipes are categorized as "quick" but have cook times of 25-55 minutes. Users expecting 15-20 minute quick meals will be disappointed.

**Worst offenders (40+ minutes):**
| Recipe | Prep | Cook | Total | Category |
|--------|------|------|-------|----------|
| Loaded Baked Potato | 5 | 50 | 55 | quick |
| Stuffed Sweet Potatoes | 5 | 45 | 50 | quick |
| Crispy Baked Chicken Wings | 5 | 40 | 45 | quick |
| Soto Ayam | 15 | 30 | 45 | quick |

**Moderate offenders (25-40 minutes):**
One-Pan Chicken Thighs, Baked Falafel Bowl, Roasted Chickpeas, Sweet Potato Brownies, Chana Masala, Kimchi Jjigae, Misir Wot, Trinidadian Doubles, Spiced Sweet Potato Fries, Mixed Berry Crumble, Stuffed Bell Peppers, Mediterranean Stuffed Tomatoes, Sun-Dried Tomato and Olive Chicken, Roasted Cauliflower Tacos, Poached Pears, Palak Paneer, Dal Tadka, Aloo Gobi, Keema Matar, Tom Kha Gai, Roasted Brussels Sprouts with Bacon, Lentil Soup

**Fix:** Recategorize recipes with total_time > 30 minutes from "quick" to "sit_down" or "bulk_cook".

---

## P1 High: Nutrition Inaccuracies (9 recipes)

### Low fiber in salads (fiber underestimated)
| Recipe | Stated Fiber | Expected | Issue |
|--------|-------------|----------|-------|
| Curried Egg Salad | 1g | 3-5g | Has celery + cilantro; fiber too low |
| Watermelon and Feta Salad | 1g | 2-4g | Watermelon has some fiber |
| Grilled Chicken Caesar Salad | 3g | 5-7g | Full head romaine = more fiber |
| Grilled Peach and Arugula Salad | 3g | 4-6g | Arugula + peach have fiber |
| Shrimp and Mango Salad | 3g | 4-6g | Mango + greens |
| Smoked Mackerel Salad | 3g | 4-6g | Mixed greens |
| Chicken Salad with Grapes/Pecans | 3g | 4-6g | Pecans are high fiber |

### Low protein for egg dishes
| Recipe | Stated Protein | Expected | Issue |
|--------|---------------|----------|-------|
| Baked Eggs in Avocado | 14g | 20-24g | 4 eggs should give ~24g protein |

### Low protein for labeled meal
| Recipe | Stated Protein | Expected | Issue |
|--------|---------------|----------|-------|
| Guacamole with Veggie Sticks | 5g | N/A | Not a meal — should be snack category |

---

## P2 Medium: Missing Images (All 213 recipes)

No recipes have `image_url` set during seeding. The app shows gradient placeholders with icons, which look acceptable but significantly reduce meal appeal. For a "eat healthy AND delicious" value prop, food photography is critical.

**Fix:** Run the `/api/images/generate-batch` endpoint to generate AI images for all recipes, OR source actual food photography.

---

## P2 Medium: Servings/Calorie Confusion (7 recipes)

These recipes declare `servings=2` but nutrition values appear to be per-serving, not total. Users dividing by 2 will get half the actual nutrition.

| Recipe | Servings | Calories | Likely Issue |
|--------|----------|----------|-------------|
| Broiled Grapefruit | 2 | 100 | Per-serving, not total (should be 200) |
| Chicken Bone Broth | 10 | 60 | Per-serving, correct but very low per cup |
| Miso Soup with Tofu | 2 | 120 | Per-serving, not total |
| Hard-Boiled Eggs | 2 | 140 | Per-serving (2 eggs per serving) |
| Egg Drop Soup | 2 | 180 | Per-serving, not total |
| Kimchi Fried Cauliflower Rice | 2 | 240 | Per-serving, not total |
| Bone Broth Ramen | 2 | 240 | Per-serving, not total |

**Fix:** Verify each recipe's nutrition represents the FULL recipe, then divide by servings for display. OR change these to servings=1 if the stated calories are per-serving.

---

## What's Working Well

- **213 unique recipes** with no duplicates — excellent variety
- **Global cuisine diversity**: Indian, Thai, Korean, Mexican, Ethiopian, Japanese, Italian, Middle Eastern, Caribbean, and more
- **Macro math is correct**: protein×4 + carbs×4 + fat×9 ≈ calories for all 213 recipes (within ±15%)
- **Well-written content**: Titles are appetizing, descriptions are enticing, steps are clear and logical
- **Ingredient lists are complete**: All steps reference ingredients that exist in the list
- **Whole-food philosophy maintained**: No seed oils, no refined flour, no artificial ingredients across the board
- **Good fallback for missing images**: Gradient placeholders with icons look clean

---

## Recommendations by Priority

### Must Fix (P0)
1. Fix 5 dietary tag contradictions (safety issue for users with restrictions)

### Should Fix Before Launch (P1)
2. Recategorize 26 recipes from "quick" to appropriate time category
3. Audit and correct fiber values for 7 salad recipes
4. Fix protein value for Baked Eggs in Avocado (14g → ~22g)
5. Move Guacamole with Veggie Sticks to snack category

### Should Fix (P2)
6. Generate images for all 213 recipes (critical for meal appeal)
7. Clarify servings/calories convention for 7 recipes
8. Decide ghee policy: either remove "dairy-free" tags from ghee recipes, or replace ghee with coconut oil in ingredients
