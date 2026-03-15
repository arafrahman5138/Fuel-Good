Metabolic Coach Audit — Fix Plan
Context
The app has two disconnected "coach" systems: a rule-based Metabolic Coach (Chronometer tab) that shows MES scores and hardcoded insights, and an AI-powered Healthify Chat (Chat tab) that generates healthified recipes via RAG + LLM. Neither system knows about the other, and critically, the Healthify chat has zero personalization — it generates the same recipe for a T2D user (90g carb ceiling) as for an athlete (175g carb ceiling). The recently-fixed personalized MES engine (build_metabolic_budget, compute_meal_mes) is not used by either system for recipe generation or dynamic coaching.

Issues Found
#	Issue	Severity
1	Healthify chat has no user context — no profile, no budget, no remaining macros. Generates same recipe for everyone.	Critical
2	No MES score on healthify recipes — user sees nutrition comparison but not how it impacts their score. compute_meal_mes() exists but isn't called.	High
3	Coach insights are hardcoded rules — "Your protein is low" is the same message whether you need 20g or 80g more. No awareness of profile, time of day, or health conditions.	High
4	Food suggestions are static arrays — same hardcoded list for everyone, ignoring allergies, dietary restrictions, preferences.	Medium
5	Quick chat suggestions are generic — "Pizza", "Pancakes" suggested to IR/T2D users.	Medium
6	Coach and Chat are disconnected — Coach says "you need protein" but can't generate a recipe. Chat generates recipes without knowing remaining budget.	Medium
Fix Plan (prioritized)
Step 1: Make Healthify Agent Profile-Aware
Files: backend/app/agents/healthify.py, backend/app/routers/chat.py

Add user_id: str | None = None parameter to healthify_agent(). Build a user context block and inject it into the system prompt.

In healthify.py:

Add new function _build_user_context(db, user_id):

Calls load_budget_for_user(db, user_id) → ComputedBudget
Queries MetabolicProfile for goal, activity_level, insulin_resistant, type_2_diabetes
Queries daily nutrition totals for today (protein/fiber/carbs consumed so far)
Computes remaining budget
Returns a natural-language context block:

User context (tailor the recipe to these constraints):
- Goal: fat_loss | Activity: active
- Health: insulin resistant — LOW carb ceiling (76g/day)
- Protein target: 180g/day (92g remaining today)
- Fiber target: 32g/day (18g remaining today)
- Carb headroom: 28g remaining today
- Calorie target: ~1800 kcal/day
IMPORTANT: Keep this recipe under ~30g net carbs per serving.
Prioritize protein-dense ingredients.
If user_id is None or profile doesn't exist, returns empty string (backward compatible)
Update GENERATE_PROMPT — append {user_context} block or build the system message dynamically at call time

Thread user context through all paths:

_generate_healthified_payload(user_input, history, retrieved_context, user_context) — inject into system message
_answer_general_question(user_input, history, user_context) — inject so Q&A is also personalized
Streaming path (line 438-456) — inject context into the HumanMessage alongside retrieved context
_retrieved_response() — no change needed (recipe already exists)
In chat.py:

Pass current_user.id to healthify_agent() in both endpoints:
Line 85: healthify_agent(db, request.message, messages[:-1], user_id=current_user.id)
Streaming endpoint: same change
Imports needed in healthify.py:

from app.services.metabolic_engine import load_budget_for_user, compute_meal_mes
from app.models.metabolic_profile import MetabolicProfile
from app.models.nutrition import FoodLog
from datetime import date
Step 2: Add MES Score + Projected Daily Score to Healthify Recipes
Files: backend/app/agents/healthify.py, backend/app/schemas/chat.py, frontend/app/(tabs)/chat.tsx

In healthify.py:

Add new function _compute_recipe_mes(db, user_id, nutrition_data):

Takes the healthified_estimate (or nutrition_info for retrieved recipes)
Maps to compute_meal_mes() format: {protein_g, carbs_g, fiber_g, fat_g, calories}
Returns {meal_score, meal_tier, projected_daily_score, projected_daily_tier} or None
Call this after payload is built in both _generate_healthified_payload() and _retrieved_response():


if user_id:
    mes = _compute_recipe_mes(db, user_id, payload.get("nutrition"))
    if mes:
        payload["mes_score"] = mes
For projected daily: query today's nutrition totals, add the recipe's nutrition, run compute_daily_mes() on the combined totals

In chat.py:

ChatResponse already returns arbitrary dict fields, so mes_score will pass through. But add mes_score: Optional[dict] = None to the schema for clarity.
In chat.tsx:

After normalizeAssistantPayload(), check for mes_score in the raw response
Display a MES badge on the recipe card (reuse existing MealMESBadge component or similar pill style):
"This meal: 82 MES (Good)"
"Your day with this meal: 76 MES (Good)"
Step 3: Profile-Aware Chat Suggestions
Files: backend/app/routers/chat.py, frontend/app/(tabs)/chat.tsx, frontend/services/api.ts

In chat.py:

Add endpoint GET /chat/suggestions:

@router.get("/suggestions")
async def get_chat_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
Logic (rule-based, no LLM call):
Load user profile (goal, activity_level, insulin_resistant, type_2_diabetes)
Load remaining budget for today
Curate suggestions from categorized pools:
Base pool: Always include 2-3 "fun" healthifiable meals (the discovery aspect)
Goal-aware pool: Fat loss → lighter meals ("Grilled Chicken Caesar", "Turkey Lettuce Wraps"); Muscle gain → protein-heavy ("Steak and Eggs", "Protein Overnight Oats")
IR/T2D pool: Low-carb options ("Cauliflower Fried Rice", "Zucchini Lasagna") instead of "Pancakes"/"Ice Cream"
Budget-aware: If high protein remaining → prioritize protein-forward suggestions; if carb headroom tight → favor low-carb
Return 8 suggestions as [{label: str, query: str}]
In api.ts:

Add chatApi.getSuggestions() method
In chat.tsx:

Fetch suggestions on mount via API, fall back to current SUGGESTIONS array if API fails
Replace hardcoded array with dynamic data
Step 4: Dynamic Coach Insights
Files: backend/app/routers/metabolic.py, backend/app/schemas/metabolic.py, frontend/services/api.ts, frontend/stores/metabolicBudgetStore.ts, frontend/components/MetabolicCoach.tsx, frontend/app/food/metabolic-coach.tsx

In metabolic.py:

Add endpoint GET /metabolic/coach-insights:

@router.get("/coach-insights")
async def get_coach_insights(
    date_str: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
Generates 3-6 personalized insights using full context:
Profile: goal, health conditions, ISM
Budget: protein target, carb ceiling, fiber target, calorie target
Daily state: meals logged, remaining macros, current score, current tier
Time context: morning/afternoon/evening affects advice
Profile-specific messaging:
IR user: "Your insulin sensitivity means carbs hit harder. With 28g of headroom, lean into protein and fats."
Muscle gain user with 80g protein remaining: "You still need 80g protein — that's roughly a chicken breast + a shake. Don't leave this until your last meal."
T2D user in optimal tier: "Even with T2D, you're crushing it at 87 MES. Your carb management is on point."
Each insight: {icon, title, body, accent, priority, action?}
Optional action field: {type: "chat", query: "high-protein dinner under 25g carbs"} or {type: "browse"} — enables deep linking
In metabolic.py (schema):

Add CoachInsight and CoachInsightsResponse schemas
In frontend (MetabolicCoach.tsx, metabolic-coach.tsx):

Add fetchCoachInsights() to store
Replace generateInsights() with API-driven insights
Keep current generateInsights() as immediate fallback while API loads
When insight has an action, render a small CTA button
Step 5: Budget-Aware Food Suggestions
Files: backend/app/routers/metabolic.py, frontend/components/MetabolicCoach.tsx, frontend/app/food/metabolic-coach.tsx

In metabolic.py:

Include food suggestions as part of the GET /metabolic/coach-insights response (or separate endpoint GET /metabolic/food-suggestions)
Logic:
Load user's remaining budget, allergies, dietary preferences, disliked ingredients
Query the local food catalog or recipe database for whole foods that:
Fill the largest macro gap (protein-rich if protein is the gap, fiber-rich if fiber)
Respect allergies and dislikes
Are low-carb if carb headroom is tight
Return categorized food suggestions: {category, foods: [{name, icon, color}]}
In frontend:

Replace getSuggestedFoods() static arrays with API data
Keep static arrays as offline fallback
Step 6: Coach-to-Chat Deep Linking
Files: frontend/components/MetabolicCoach.tsx, frontend/app/food/metabolic-coach.tsx, frontend/app/(tabs)/chat.tsx

Add a "What should I eat next?" CTA on the Metabolic Coach card and full screen

Auto-generates a chat query from remaining budget: "I need a dinner with at least 40g protein, under 25g carbs, and some fiber"
Navigates to chat tab with pre-filled query
In chat.tsx:

Accept route params ?prefill=...
On mount, if prefill param exists, populate the input and optionally auto-send
Insight action buttons (from Step 4) also use this mechanism

Files to Modify (ordered)
Order	File	Changes
1	backend/app/agents/healthify.py	Add _build_user_context(), _compute_recipe_mes(), thread user_id + context through all paths
2	backend/app/routers/chat.py	Pass current_user.id to agent, add GET /suggestions endpoint
3	backend/app/schemas/chat.py	Add mes_score to ChatResponse
4	frontend/app/(tabs)/chat.tsx	Display MES badges on recipes, dynamic suggestions, accept prefill params
5	frontend/services/api.ts	Add chatApi.getSuggestions(), metabolicApi.getCoachInsights()
6	backend/app/routers/metabolic.py	Add GET /metabolic/coach-insights endpoint
7	backend/app/schemas/metabolic.py	Add CoachInsight, CoachInsightsResponse schemas
8	frontend/stores/metabolicBudgetStore.ts	Add coachInsights state, fetchCoachInsights()
9	frontend/components/MetabolicCoach.tsx	Replace static insights/foods with API data, add action CTAs
10	frontend/app/food/metabolic-coach.tsx	Replace static insights/foods with API data, add "What should I eat?" CTA
Verification
Profile-aware healthify test: Send "mac and cheese" as an IR user (90g carb ceiling) and as an athlete (175g ceiling). Verify the IR recipe has significantly fewer carbs per serving.

MES badge test: Send any meal through healthify, verify the response includes mes_score with meal_score, meal_tier, projected_daily_score, projected_daily_tier. Verify the frontend displays it.

Chat suggestions test: Load chat as IR user vs athlete. Verify different quick suggestions appear (no "Pancakes" for IR user).

Coach insights test: Log 2 meals, verify coach insights reference the user's specific remaining budget, goal, and health conditions. Verify IR user gets carb-specific warnings.

Deep link test: Tap "What should I eat?" on the coach, verify it navigates to chat with a contextual pre-filled query.

Fallback test: Disable the backend, verify coach falls back to current hardcoded insights and suggestions with no crash.