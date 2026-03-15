--
-- PostgreSQL database dump
--

\restrict UhgQt6nCFI7T5YicQKnwoFyUqqFn2jIrwlCIUqkOKiB45yCKLqSXj6N555z3pEt

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg12+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id character varying(36) NOT NULL,
    name character varying NOT NULL,
    description character varying NOT NULL,
    icon character varying,
    xp_reward integer,
    criteria json,
    category character varying,
    created_at timestamp without time zone
);


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    title character varying,
    messages json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: daily_nutrition_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_nutrition_summary (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    date date NOT NULL,
    totals_json json,
    comparison_json json,
    daily_score double precision,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: daily_quests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_quests (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    date date NOT NULL,
    quest_type character varying NOT NULL,
    title character varying NOT NULL,
    description character varying,
    target_value double precision,
    current_value double precision,
    xp_reward integer,
    completed boolean,
    completed_at timestamp without time zone,
    metadata_json json,
    created_at timestamp without time zone
);


--
-- Name: food_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_logs (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    date date NOT NULL,
    meal_type character varying,
    source_type character varying,
    source_id character varying,
    group_id character varying,
    group_mes_score double precision,
    group_mes_tier character varying,
    quantity double precision,
    servings double precision,
    title character varying,
    nutrition_snapshot json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: grocery_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grocery_lists (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    meal_plan_id character varying(36),
    items json,
    price_estimates json,
    total_estimated_cost double precision,
    created_at timestamp without time zone
);


--
-- Name: local_foods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.local_foods (
    id character varying(36) NOT NULL,
    name character varying NOT NULL,
    brand character varying,
    category character varying,
    source_kind character varying,
    aliases json,
    default_serving_label character varying,
    default_serving_grams double precision,
    serving_options json,
    nutrition_per_100g json,
    nutrition_per_serving json,
    mes_ready_nutrition json,
    micronutrients json,
    nutrition_info json,
    serving character varying,
    tags json,
    is_active boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: meal_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_plan_items (
    id character varying(36) NOT NULL,
    meal_plan_id character varying(36) NOT NULL,
    recipe_id character varying(36),
    day_of_week character varying NOT NULL,
    meal_type character varying NOT NULL,
    meal_category character varying,
    is_bulk_cook boolean,
    servings integer,
    recipe_data json
);


--
-- Name: meal_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_plans (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    week_start date NOT NULL,
    preferences_snapshot json,
    created_at timestamp without time zone
);


--
-- Name: metabolic_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metabolic_budgets (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    protein_target_g double precision,
    fiber_floor_g double precision,
    sugar_ceiling_g double precision,
    fat_target_g double precision,
    tdee double precision,
    calorie_target_kcal double precision,
    ism double precision,
    tier_thresholds_json json,
    weight_protein double precision,
    weight_fiber double precision,
    weight_sugar double precision,
    weight_fat double precision,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: metabolic_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metabolic_profiles (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    sex character varying,
    age integer,
    height_cm double precision,
    height_ft integer,
    height_in double precision,
    weight_lb double precision,
    body_fat_pct double precision,
    body_fat_method character varying,
    goal character varying,
    activity_level character varying,
    insulin_resistant boolean,
    prediabetes boolean,
    type_2_diabetes boolean,
    fasting_glucose_mgdl double precision,
    hba1c_pct double precision,
    triglycerides_mgdl double precision,
    target_weight_lb double precision,
    protein_target_g double precision,
    onboarding_step_completed integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: metabolic_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metabolic_scores (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    date date NOT NULL,
    scope character varying NOT NULL,
    food_log_id character varying(36),
    protein_score double precision,
    fiber_score double precision,
    sugar_score double precision,
    total_score double precision,
    display_score double precision,
    display_tier character varying,
    protein_g double precision,
    fiber_g double precision,
    sugar_g double precision,
    tier character varying,
    meal_context character varying,
    details_json json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: metabolic_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metabolic_streaks (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    current_streak integer,
    longest_streak integer,
    last_qualifying_date date,
    threshold double precision,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: notification_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_deliveries (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    push_token_id character varying(36),
    category character varying NOT NULL,
    status character varying,
    title character varying,
    body character varying,
    route character varying,
    metadata_json json,
    triggered_by_event character varying,
    eligibility_score integer,
    sent_at timestamp without time zone,
    opened_at timestamp without time zone,
    conversion_at timestamp without time zone,
    failure_reason character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: notification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_events (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    event_type character varying NOT NULL,
    source character varying,
    properties json,
    occurred_at timestamp without time zone,
    created_at timestamp without time zone
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    push_enabled boolean,
    timezone character varying,
    quiet_hours_start character varying,
    quiet_hours_end character varying,
    preferred_meal_window_start character varying,
    preferred_meal_window_end character varying,
    max_notifications_per_day integer,
    max_notifications_per_week integer,
    categories json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: nutrition_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_streaks (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    current_streak integer,
    longest_streak integer,
    last_qualifying_date date,
    threshold double precision,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: nutrition_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_targets (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    calories_target double precision,
    protein_g_target double precision,
    carbs_g_target double precision,
    fat_g_target double precision,
    fiber_g_target double precision,
    micronutrient_targets json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: recipe_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_embeddings (
    id character varying(36) NOT NULL,
    recipe_id character varying(36) NOT NULL,
    provider character varying NOT NULL,
    model character varying NOT NULL,
    text_hash character varying NOT NULL,
    vector json,
    updated_at timestamp without time zone
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id character varying(36) NOT NULL,
    title character varying NOT NULL,
    description text,
    ingredients json,
    steps json,
    prep_time_min integer,
    cook_time_min integer,
    total_time_min integer,
    servings integer,
    nutrition_info json,
    difficulty character varying,
    tags json,
    flavor_profile json,
    dietary_tags json,
    cuisine character varying,
    health_benefits json,
    protein_type json,
    carb_type json,
    is_ai_generated boolean,
    image_url character varying,
    created_at timestamp without time zone,
    recipe_role character varying,
    is_component boolean,
    meal_group_id character varying,
    default_pairing_ids json,
    needs_default_pairing boolean,
    component_composition json,
    is_mes_scoreable boolean,
    pairing_synergy_profile json
);


--
-- Name: saved_recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_recipes (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    recipe_id character varying(36) NOT NULL,
    saved_at timestamp without time zone
);


--
-- Name: scanned_meal_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scanned_meal_logs (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    image_url character varying,
    meal_label character varying NOT NULL,
    scan_mode character varying,
    meal_context character varying,
    meal_type character varying,
    portion_size character varying,
    source_context character varying,
    estimated_ingredients json,
    normalized_ingredients json,
    nutrition_estimate json,
    whole_food_status character varying,
    whole_food_flags json,
    suggested_swaps json,
    upgrade_suggestions json,
    recovery_plan json,
    mes_score double precision,
    mes_tier character varying,
    mes_sub_scores json,
    pairing_opportunity boolean,
    pairing_recommended_recipe_id character varying,
    pairing_recommended_title character varying,
    pairing_projected_mes double precision,
    pairing_projected_delta double precision,
    pairing_reasons json,
    pairing_timing character varying,
    confidence double precision,
    confidence_breakdown json,
    source_model character varying,
    grounding_source character varying,
    grounding_candidates json,
    prompt_version character varying,
    matched_recipe_id character varying,
    matched_recipe_confidence double precision,
    logged_food_log_id character varying(36),
    logged_to_chronometer boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    achievement_id character varying(36) NOT NULL,
    unlocked_at timestamp without time zone
);


--
-- Name: user_push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_push_tokens (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    expo_push_token character varying NOT NULL,
    device_id character varying,
    platform character varying,
    app_version character varying,
    enabled boolean,
    invalidated_at timestamp without time zone,
    last_seen_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(36) NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying,
    name character varying NOT NULL,
    auth_provider character varying,
    provider_subject character varying,
    dietary_preferences json,
    flavor_preferences json,
    allergies json,
    liked_ingredients json,
    disliked_ingredients json,
    protein_preferences json,
    cooking_time_budget json,
    household_size integer,
    budget_level character varying,
    xp_points integer,
    current_streak integer,
    longest_streak integer,
    last_active_date timestamp without time zone,
    revenuecat_customer_id character varying,
    subscription_product_id character varying,
    subscription_store character varying,
    subscription_status character varying,
    subscription_trial_started_at timestamp without time zone,
    subscription_trial_ends_at timestamp without time zone,
    subscription_current_period_ends_at timestamp without time zone,
    subscription_will_renew boolean,
    subscription_manage_url character varying,
    subscription_last_synced_at timestamp without time zone,
    access_override_level character varying,
    access_override_reason character varying,
    access_override_expires_at timestamp without time zone,
    access_override_updated_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: xp_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_transactions (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    amount integer NOT NULL,
    reason character varying NOT NULL,
    created_at timestamp without time zone
);


--
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievements (id, name, description, icon, xp_reward, criteria, category, created_at) FROM stdin;
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
5f6d9d12c001
a1b2c3d4e5f6
a3b4c5d6e7f8
\.


--
-- Data for Name: chat_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_sessions (id, user_id, title, messages, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: daily_nutrition_summary; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_nutrition_summary (id, user_id, date, totals_json, comparison_json, daily_score, created_at, updated_at) FROM stdin;
428ca6c9-98ea-4b7c-ae80-2cd305eecbe6	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	{"calories": 836.2, "protein": 64.5, "carbs": 62.2, "fat": 36.8, "fiber": 13.8, "vitamin_a_mcg": 0.0, "vitamin_c_mg": 0.0, "vitamin_d_mcg": 0.0, "vitamin_e_mg": 0.0, "vitamin_k_mcg": 0.0, "thiamin_b1_mg": 0.0, "riboflavin_b2_mg": 0.0, "niacin_b3_mg": 0.0, "vitamin_b6_mg": 0.0, "folate_mcg": 0.0, "vitamin_b12_mcg": 0.0, "choline_mg": 0.0, "calcium_mg": 0.0, "iron_mg": 0.0, "magnesium_mg": 0.0, "phosphorus_mg": 0.0, "potassium_mg": 0.0, "sodium_mg": 0.0, "zinc_mg": 0.0, "copper_mg": 0.0, "manganese_mg": 0.0, "selenium_mcg": 0.0, "iodine_mcg": 0.0, "omega3_g": 0.0}	{"calories": {"consumed": 836.2, "target": 2067.5, "pct": 40.44498186215236}, "protein": {"consumed": 64.5, "target": 165.0, "pct": 39.09090909090909}, "carbs": {"consumed": 62.2, "target": 155.0, "pct": 40.12903225806452}, "fat": {"consumed": 36.8, "target": 87.5, "pct": 42.05714285714286}, "fiber": {"consumed": 13.8, "target": 29.7, "pct": 46.46464646464647}, "vitamin_a_mcg": {"consumed": 0.0, "target": 900.0, "pct": 0.0}, "vitamin_c_mg": {"consumed": 0.0, "target": 90.0, "pct": 0.0}, "vitamin_d_mcg": {"consumed": 0.0, "target": 20.0, "pct": 0.0}, "vitamin_e_mg": {"consumed": 0.0, "target": 15.0, "pct": 0.0}, "vitamin_k_mcg": {"consumed": 0.0, "target": 120.0, "pct": 0.0}, "thiamin_b1_mg": {"consumed": 0.0, "target": 1.2, "pct": 0.0}, "riboflavin_b2_mg": {"consumed": 0.0, "target": 1.3, "pct": 0.0}, "niacin_b3_mg": {"consumed": 0.0, "target": 16.0, "pct": 0.0}, "vitamin_b6_mg": {"consumed": 0.0, "target": 1.7, "pct": 0.0}, "folate_mcg": {"consumed": 0.0, "target": 400.0, "pct": 0.0}, "vitamin_b12_mcg": {"consumed": 0.0, "target": 2.4, "pct": 0.0}, "choline_mg": {"consumed": 0.0, "target": 550.0, "pct": 0.0}, "calcium_mg": {"consumed": 0.0, "target": 1300.0, "pct": 0.0}, "iron_mg": {"consumed": 0.0, "target": 18.0, "pct": 0.0}, "magnesium_mg": {"consumed": 0.0, "target": 420.0, "pct": 0.0}, "phosphorus_mg": {"consumed": 0.0, "target": 1250.0, "pct": 0.0}, "potassium_mg": {"consumed": 0.0, "target": 4700.0, "pct": 0.0}, "sodium_mg": {"consumed": 0.0, "target": 2300.0, "pct": 0.0}, "zinc_mg": {"consumed": 0.0, "target": 11.0, "pct": 0.0}, "copper_mg": {"consumed": 0.0, "target": 0.9, "pct": 0.0}, "manganese_mg": {"consumed": 0.0, "target": 2.3, "pct": 0.0}, "selenium_mcg": {"consumed": 0.0, "target": 55.0, "pct": 0.0}, "iodine_mcg": {"consumed": 0.0, "target": 150.0, "pct": 0.0}, "omega3_g": {"consumed": 0.0, "target": 1.6, "pct": 0.0}}	25.2	2026-03-13 22:33:32.024979	2026-03-13 23:55:37.451078
\.


--
-- Data for Name: daily_quests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_quests (id, user_id, date, quest_type, title, description, target_value, current_value, xp_reward, completed, completed_at, metadata_json, created_at) FROM stdin;
150f1409-5e57-41b7-8fa0-1532a354d7be	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	general	Save a Recipe	Save a new recipe to your collection.	1	0	25	f	\N	{"key": "save_recipe"}	2026-03-13 22:33:31.946091
6c734e46-59a8-49cc-b1e7-1f308bf26bb9	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	logging	Log a Snack	Log a healthy snack.	1	0	20	f	\N	{"key": "log_snack"}	2026-03-13 22:33:31.946095
ba003a3d-c399-4a73-849b-ee21a6cd575f	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	quality	Hit 130g Protein	Reach your daily protein target of 130g.	130	0	60	f	\N	{"key": "hit_protein"}	2026-03-13 22:33:31.946097
1abc7ca9-b6c6-48d8-aed0-2d5a9fa83de8	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	metabolic	Budget Lockdown	Hit all 3 metabolic guardrails today.	1	0	100	f	\N	{"key": "budget_lockdown"}	2026-03-13 22:33:31.946097
\.


--
-- Data for Name: food_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.food_logs (id, user_id, date, meal_type, source_type, source_id, group_id, group_mes_score, group_mes_tier, quantity, servings, title, nutrition_snapshot, created_at, updated_at) FROM stdin;
e3704daf-cfda-498d-ae2a-17f050d9746e	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	breakfast	meal_plan	4d35ad59-e546-488a-af2f-c3c3609b733d	\N	\N	\N	1	1	Chicken Sausage Kale Scramble	{"calories": 470.0, "protein": 43.0, "protein_g": 43.0, "carbs": 11.0, "carbs_g": 11.0, "fat": 28.0, "fat_g": 28.0, "fiber": 7.0, "fiber_g": 7.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "mes_score": 92.8, "mes_display_score": 92.8}	2026-03-13 22:50:38.964211	2026-03-13 22:50:38.964215
3414d44a-1aa9-4cfb-a03c-1c1f682a331a	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	lunch	scan	d3c1eb1a-62bb-4980-b5fe-9d8d98944c22	a5fe4260-2533-4dba-8436-99d958f3acc9	47.6	shaky	1	1	Chicken and Rice with Mixed Salad	{"calories": 296.2, "protein": 19.5, "carbs": 41.2, "fat": 5.8, "fiber": 3.8, "whole_food_summary": "This looks very close to a real-food product with minimal processing.", "estimated": true, "meal_context": "full_meal", "scan_confidence": 0.71, "scan_confidence_breakdown": {"extraction": 0.85, "portion": 0.75, "grounding": 0.38, "nutrition": 0.6, "estimate_mode": "medium", "review_required": false}, "whole_food_status": "pass", "whole_food_flags": [], "scan_snapshot_id": "d3c1eb1a-62bb-4980-b5fe-9d8d98944c22", "scan_mes_score": 37.2, "scan_mes_tier": "low"}	2026-03-13 23:55:37.269938	2026-03-13 23:55:37.269951
213f8801-3067-4560-80d5-75fefd8c7d84	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	lunch	recipe	5fcd9514-aa74-4a39-9f7c-c5d21ab5a699	a5fe4260-2533-4dba-8436-99d958f3acc9	47.6	shaky	1	1	Cucumber Tomato Herb Salad	{"calories": 70, "protein": 2.0, "carbs": 10.0, "fat": 3.0, "fiber": 3.0, "sugar": 4.0}	2026-03-13 23:55:37.363037	2026-03-13 23:55:37.363048
\.


--
-- Data for Name: grocery_lists; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grocery_lists (id, user_id, meal_plan_id, items, price_estimates, total_estimated_cost, created_at) FROM stdin;
\.


--
-- Data for Name: local_foods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.local_foods (id, name, brand, category, source_kind, aliases, default_serving_label, default_serving_grams, serving_options, nutrition_per_100g, nutrition_per_serving, mes_ready_nutrition, micronutrients, nutrition_info, serving, tags, is_active, created_at, updated_at) FROM stdin;
20793876-c493-4f73-89f5-86c134ce293b	Greek Yogurt	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"protein": 17, "calories": 100, "calcium_mg": 180}	{"calories": 100.0, "protein": 17.0, "protein_g": 17.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "calcium_mg": 180.0}	{"calories": 100.0, "protein": 17.0, "protein_g": 17.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "calcium_mg": 180.0}	{}	{"calories": 100.0, "protein": 17.0, "protein_g": 17.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "calcium_mg": 180.0}	1 serving	["coach", "protein"]	t	2026-03-13 22:43:18.011335	2026-03-13 22:43:18.011337
cd2a8037-74aa-4892-ab46-5733a952e55e	Chicken Breast	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"protein": 31, "calories": 165}	{"calories": 165.0, "protein": 31.0, "protein_g": 31.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0}	{"calories": 165.0, "protein": 31.0, "protein_g": 31.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0}	{}	{"calories": 165.0, "protein": 31.0, "protein_g": 31.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0}	1 serving	["coach", "protein"]	t	2026-03-13 22:43:18.016585	2026-03-13 22:43:18.016587
98225bbc-3e5a-41df-b197-588f4df59a9e	Chia Seeds	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"fiber": 10, "omega3_g": 5, "protein": 5}	{"calories": 0.0, "protein": 5.0, "protein_g": 5.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 10.0, "fiber_g": 10.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 5.0}	{"calories": 0.0, "protein": 5.0, "protein_g": 5.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 10.0, "fiber_g": 10.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 5.0}	{}	{"calories": 0.0, "protein": 5.0, "protein_g": 5.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 10.0, "fiber_g": 10.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 5.0}	1 serving	["coach", "fiber"]	t	2026-03-13 22:43:18.024466	2026-03-13 22:43:18.024469
b50f696d-1ffa-45b6-bf7b-d95ae1a2cdbd	Black Beans	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"fiber": 8, "protein": 8, "iron_mg": 2.1}	{"calories": 0.0, "protein": 8.0, "protein_g": 8.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 8.0, "fiber_g": 8.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "iron_mg": 2.1}	{"calories": 0.0, "protein": 8.0, "protein_g": 8.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 8.0, "fiber_g": 8.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "iron_mg": 2.1}	{}	{"calories": 0.0, "protein": 8.0, "protein_g": 8.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 8.0, "fiber_g": 8.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "iron_mg": 2.1}	1 serving	["coach", "fiber"]	t	2026-03-13 22:43:18.028458	2026-03-13 22:43:18.02846
eb200548-37f0-421c-bb14-805b17bcbb8e	Red Bell Pepper	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"vitamin_c_mg": 95, "fiber": 2}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 2.0, "fiber_g": 2.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_c_mg": 95.0}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 2.0, "fiber_g": 2.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_c_mg": 95.0}	{}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 2.0, "fiber_g": 2.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_c_mg": 95.0}	1 serving	["coach", "vitamin_c_mg"]	t	2026-03-13 22:50:41.765152	2026-03-13 22:50:41.765153
999c873d-4479-4e7f-adaa-031f0756e1a6	Kiwi	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"vitamin_c_mg": 64, "fiber": 3}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 3.0, "fiber_g": 3.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_c_mg": 64.0}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 3.0, "fiber_g": 3.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_c_mg": 64.0}	{}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 3.0, "fiber_g": 3.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_c_mg": 64.0}	1 serving	["coach", "vitamin_c_mg"]	t	2026-03-13 22:50:41.769184	2026-03-13 22:50:41.769185
dab2aec6-c439-4c6e-9413-275e8d368ebe	Salmon	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"omega3_g": 2.2, "protein": 22, "vitamin_d_mcg": 11}	{"calories": 0.0, "protein": 22.0, "protein_g": 22.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 2.2, "vitamin_d_mcg": 11.0}	{"calories": 0.0, "protein": 22.0, "protein_g": 22.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 2.2, "vitamin_d_mcg": 11.0}	{}	{"calories": 0.0, "protein": 22.0, "protein_g": 22.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 2.2, "vitamin_d_mcg": 11.0}	1 serving	["coach", "vitamin_d_mcg"]	t	2026-03-13 22:50:41.774582	2026-03-13 22:50:41.774583
8b2456db-0460-4ecf-8523-74576e258062	Egg Yolk	\N	Coach Staples	coach_staple	[]	1 serving	100	[]	{"vitamin_d_mcg": 1.1, "vitamin_b12_mcg": 0.3}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_d_mcg": 1.1, "vitamin_b12_mcg": 0.3}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_d_mcg": 1.1, "vitamin_b12_mcg": 0.3}	{}	{"calories": 0.0, "protein": 0.0, "protein_g": 0.0, "carbs": 0.0, "carbs_g": 0.0, "fat": 0.0, "fat_g": 0.0, "fiber": 0.0, "fiber_g": 0.0, "sugar": 0.0, "sugar_g": 0.0, "omega3_g": 0.0, "vitamin_d_mcg": 1.1, "vitamin_b12_mcg": 0.3}	1 serving	["coach", "vitamin_d_mcg"]	t	2026-03-13 22:50:41.777606	2026-03-13 22:50:41.777607
\.


--
-- Data for Name: meal_plan_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meal_plan_items (id, meal_plan_id, recipe_id, day_of_week, meal_type, meal_category, is_bulk_cook, servings, recipe_data) FROM stdin;
15ed9280-a5b3-43e8-a5b5-9abed9b2993e	345beb88-3425-4c81-97f3-7af2c444f92d	b31cf8be-b884-4f87-a194-16a91ff6bd84	Monday	breakfast	quick	f	1	{"id": "b31cf8be-b884-4f87-a194-16a91ff6bd84", "title": "Turkey and Spinach Egg White Skillet", "description": "Lean ground turkey, egg whites, spinach, and avocado for a protein-heavy savory breakfast.", "ingredients": [{"name": "lean ground turkey", "quantity": "5", "unit": "oz", "category": "protein"}, {"name": "egg whites", "quantity": "0.75", "unit": "cup", "category": "protein"}, {"name": "fresh spinach", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "red pepper flakes", "quantity": "0.25", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}], "steps": ["Heat olive oil in a skillet and cook turkey until browned and cooked through.", "Add spinach and cook until wilted, then pour in egg whites and gently scramble together.", "Plate with sliced avocado and finish with salt and red pepper flakes."], "prep_time_min": 8, "cook_time_min": 10, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory"], "dietary_tags": ["gluten-free", "dairy-free"], "nutrition_estimate": {"calories": 430.0, "protein": 46.0, "carbs": 8.0, "fat": 22.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 86.2, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": null}
2aced5d4-d427-45b1-9d33-81583b58d952	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Monday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": "prepped"}
fb98089b-8916-45e0-ac5c-b7f08a818cd0	345beb88-3425-4c81-97f3-7af2c444f92d	306305ee-6a5a-4b6e-ae31-30a546530abe	Monday	dinner	bulk_cook	t	1	{"id": "306305ee-6a5a-4b6e-ae31-30a546530abe", "title": "Chicken Shawarma Bowl", "description": "Chicken shawarma bowl with 2/3 cup white basmati rice and kachumber salad.", "ingredients": [{"name": "chicken thighs", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cinnamon", "quantity": "pinch", "unit": "", "category": "spices"}, {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "white basmati rice", "quantity": "2/3", "unit": "cup cooked", "category": "grains"}, {"name": "cucumber, chopped", "quantity": "3/4", "unit": "cup", "category": "produce"}, {"name": "tomatoes, chopped", "quantity": "3/4", "unit": "cup", "category": "produce"}, {"name": "red onion, finely chopped", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "fresh cilantro, chopped", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "pinch", "unit": "", "category": "spices"}], "steps": ["Shawarma Chicken Thighs (Protein): Use 1 serving of Shawarma Chicken Thighs meal-prep component.", "White Rice (Carb): Add 2/3 cup cooked White Rice meal-prep component.", "Kachumber Salad (Veggie): Add 1.5 servings of Kachumber Salad meal-prep component.", "Assembly: Build the bowl with rice at the base, top with shawarma chicken thighs, and finish with kachumber salad."], "prep_time_min": 10, "cook_time_min": 20, "servings": 2, "difficulty": "easy", "flavor_profile": ["savory", "spicy", "umami", "fresh"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 420.0, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6}, "mes_display_score": 81.9, "mes_display_tier": "good", "composite_display_score": 81.9, "composite_display_tier": "good", "paired_recipe_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "paired_recipe_title": "Kachumber Salad", "meets_mes_target": true, "prep_group_id": "e95dc655-0ed6-4182-8dbf-1fee3bf1afe3", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Tuesday", "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": "prepped"}
f9b39c8c-4a6c-4f4e-81d9-e32336f6b1d6	345beb88-3425-4c81-97f3-7af2c444f92d	b31cf8be-b884-4f87-a194-16a91ff6bd84	Tuesday	breakfast	quick	f	1	{"id": "b31cf8be-b884-4f87-a194-16a91ff6bd84", "title": "Turkey and Spinach Egg White Skillet", "description": "Lean ground turkey, egg whites, spinach, and avocado for a protein-heavy savory breakfast.", "ingredients": [{"name": "lean ground turkey", "quantity": "5", "unit": "oz", "category": "protein"}, {"name": "egg whites", "quantity": "0.75", "unit": "cup", "category": "protein"}, {"name": "fresh spinach", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "red pepper flakes", "quantity": "0.25", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}], "steps": ["Heat olive oil in a skillet and cook turkey until browned and cooked through.", "Add spinach and cook until wilted, then pour in egg whites and gently scramble together.", "Plate with sliced avocado and finish with salt and red pepper flakes."], "prep_time_min": 8, "cook_time_min": 10, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory"], "dietary_tags": ["gluten-free", "dairy-free"], "nutrition_estimate": {"calories": 430.0, "protein": 46.0, "carbs": 8.0, "fat": 22.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 86.2, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 1, "prep_status": null}
ebb9d06b-e10a-41b3-ac3d-02590305491d	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Tuesday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 1, "prep_status": "reheat"}
65cd625d-6169-4fe0-91c8-778f21ae430e	345beb88-3425-4c81-97f3-7af2c444f92d	306305ee-6a5a-4b6e-ae31-30a546530abe	Tuesday	dinner	bulk_cook	t	1	{"id": "306305ee-6a5a-4b6e-ae31-30a546530abe", "title": "Chicken Shawarma Bowl", "description": "Chicken shawarma bowl with 2/3 cup white basmati rice and kachumber salad.", "ingredients": [{"name": "chicken thighs", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cinnamon", "quantity": "pinch", "unit": "", "category": "spices"}, {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "white basmati rice", "quantity": "2/3", "unit": "cup cooked", "category": "grains"}, {"name": "cucumber, chopped", "quantity": "3/4", "unit": "cup", "category": "produce"}, {"name": "tomatoes, chopped", "quantity": "3/4", "unit": "cup", "category": "produce"}, {"name": "red onion, finely chopped", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "fresh cilantro, chopped", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "pinch", "unit": "", "category": "spices"}], "steps": ["Shawarma Chicken Thighs (Protein): Use 1 serving of Shawarma Chicken Thighs meal-prep component.", "White Rice (Carb): Add 2/3 cup cooked White Rice meal-prep component.", "Kachumber Salad (Veggie): Add 1.5 servings of Kachumber Salad meal-prep component.", "Assembly: Build the bowl with rice at the base, top with shawarma chicken thighs, and finish with kachumber salad."], "prep_time_min": 10, "cook_time_min": 20, "servings": 2, "difficulty": "easy", "flavor_profile": ["savory", "spicy", "umami", "fresh"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 420.0, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6}, "mes_display_score": 81.9, "mes_display_tier": "good", "composite_display_score": 81.9, "composite_display_tier": "good", "paired_recipe_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "paired_recipe_title": "Kachumber Salad", "meets_mes_target": true, "prep_group_id": "e95dc655-0ed6-4182-8dbf-1fee3bf1afe3", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Tuesday", "is_prep_day": false, "is_reheat": true, "repeat_index": 1, "prep_status": "reheat"}
0ecb702a-6fe0-42c8-bfd0-d1265b104248	345beb88-3425-4c81-97f3-7af2c444f92d	2df15af1-1461-4afe-a490-f8a65889a8df	Wednesday	breakfast	quick	f	1	{"id": "2df15af1-1461-4afe-a490-f8a65889a8df", "title": "Smoked Salmon Omelet with Avocado", "description": "A folded omelet with smoked salmon, spinach, herbs, and creamy avocado.", "ingredients": [{"name": "eggs", "quantity": "3", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "smoked salmon", "quantity": "3", "unit": "oz", "category": "protein"}, {"name": "fresh spinach", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "fresh dill", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "grass-fed butter", "quantity": "1", "unit": "tsp", "category": "dairy"}], "steps": ["Whisk eggs and egg whites. Melt butter in a nonstick skillet and wilt the spinach.", "Pour in eggs, cook until almost set, then add smoked salmon and dill to one side.", "Fold the omelet and serve with sliced avocado."], "prep_time_min": 6, "cook_time_min": 8, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 460.0, "protein": 44.0, "carbs": 9.0, "fat": 28.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 85.6, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": null}
6993fc50-1c72-41d9-ac71-c73ae2bbc2d5	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Wednesday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 2, "prep_status": "reheat"}
cc75b751-cefe-4e20-b442-040fabe9aa7c	345beb88-3425-4c81-97f3-7af2c444f92d	f2e2813f-ebaf-4cd5-a2dc-28a9925df80b	Wednesday	dinner	bulk_cook	t	1	{"id": "f2e2813f-ebaf-4cd5-a2dc-28a9925df80b", "title": "Butter Chicken Bowl Plus", "description": "Composed bowl using prep components: 2 servings butter chicken thighs, 4/3 cups cooked white rice, and 3 servings kachumber salad across 2 total servings.", "ingredients": [{"name": "butter chicken thighs", "quantity": "2", "unit": "servings", "category": "protein"}, {"name": "white rice", "quantity": "4/3", "unit": "cups cooked", "category": "grains"}, {"name": "kachumber salad", "quantity": "3", "unit": "servings", "category": "produce"}], "steps": ["Protein Component: Add 2 servings of Butter Chicken Thighs meal-prep component.", "Carb Component: Add 4/3 cups cooked White Rice meal-prep component (2/3 cup per serving).", "Veggie Component: Add 3 servings of Kachumber Salad meal-prep component (1.5 servings per serving).", "Assembly: Divide into 2 bowls and serve."], "prep_time_min": 5, "cook_time_min": 10, "servings": 2, "difficulty": "easy", "flavor_profile": ["savory", "spicy", "umami", "fresh"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 420.0, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6}, "mes_display_score": 81.9, "mes_display_tier": "good", "composite_display_score": 81.9, "composite_display_tier": "good", "paired_recipe_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "paired_recipe_title": "Kachumber Salad", "meets_mes_target": true, "prep_group_id": "4f594ab6-1ac4-41f2-81d1-1df0e3d87e61", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Wednesday", "prep_window_end_day": "Thursday", "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": "prepped"}
cdeac22b-82b3-40d5-bef1-70ce134eb1cc	345beb88-3425-4c81-97f3-7af2c444f92d	2df15af1-1461-4afe-a490-f8a65889a8df	Thursday	breakfast	quick	f	1	{"id": "2df15af1-1461-4afe-a490-f8a65889a8df", "title": "Smoked Salmon Omelet with Avocado", "description": "A folded omelet with smoked salmon, spinach, herbs, and creamy avocado.", "ingredients": [{"name": "eggs", "quantity": "3", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "smoked salmon", "quantity": "3", "unit": "oz", "category": "protein"}, {"name": "fresh spinach", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "fresh dill", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "grass-fed butter", "quantity": "1", "unit": "tsp", "category": "dairy"}], "steps": ["Whisk eggs and egg whites. Melt butter in a nonstick skillet and wilt the spinach.", "Pour in eggs, cook until almost set, then add smoked salmon and dill to one side.", "Fold the omelet and serve with sliced avocado."], "prep_time_min": 6, "cook_time_min": 8, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 460.0, "protein": 44.0, "carbs": 9.0, "fat": 28.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 85.6, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 1, "prep_status": null}
0098fc71-29be-4118-99ef-dedf55bd5736	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Thursday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 3, "prep_status": "reheat"}
5144eb32-d0e1-447f-87ae-544d8714758a	345beb88-3425-4c81-97f3-7af2c444f92d	f2e2813f-ebaf-4cd5-a2dc-28a9925df80b	Thursday	dinner	bulk_cook	t	1	{"id": "f2e2813f-ebaf-4cd5-a2dc-28a9925df80b", "title": "Butter Chicken Bowl Plus", "description": "Composed bowl using prep components: 2 servings butter chicken thighs, 4/3 cups cooked white rice, and 3 servings kachumber salad across 2 total servings.", "ingredients": [{"name": "butter chicken thighs", "quantity": "2", "unit": "servings", "category": "protein"}, {"name": "white rice", "quantity": "4/3", "unit": "cups cooked", "category": "grains"}, {"name": "kachumber salad", "quantity": "3", "unit": "servings", "category": "produce"}], "steps": ["Protein Component: Add 2 servings of Butter Chicken Thighs meal-prep component.", "Carb Component: Add 4/3 cups cooked White Rice meal-prep component (2/3 cup per serving).", "Veggie Component: Add 3 servings of Kachumber Salad meal-prep component (1.5 servings per serving).", "Assembly: Divide into 2 bowls and serve."], "prep_time_min": 5, "cook_time_min": 10, "servings": 2, "difficulty": "easy", "flavor_profile": ["savory", "spicy", "umami", "fresh"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 420.0, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6}, "mes_display_score": 81.9, "mes_display_tier": "good", "composite_display_score": 81.9, "composite_display_tier": "good", "paired_recipe_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "paired_recipe_title": "Kachumber Salad", "meets_mes_target": true, "prep_group_id": "4f594ab6-1ac4-41f2-81d1-1df0e3d87e61", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Wednesday", "prep_window_end_day": "Thursday", "is_prep_day": false, "is_reheat": true, "repeat_index": 1, "prep_status": "reheat"}
4d35ad59-e546-488a-af2f-c3c3609b733d	345beb88-3425-4c81-97f3-7af2c444f92d	7f708980-7e30-4168-b036-e91848bf0fd3	Friday	breakfast	quick	f	1	{"id": "7f708980-7e30-4168-b036-e91848bf0fd3", "title": "Chicken Sausage Kale Scramble", "description": "Chicken sausage scrambled with eggs, kale, mushrooms, and feta for a low-carb breakfast.", "ingredients": [{"name": "chicken sausage", "quantity": "2", "unit": "links", "category": "protein"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "lacinato kale", "quantity": "1.5", "unit": "cups", "category": "produce"}, {"name": "mushrooms", "quantity": "0.75", "unit": "cup", "category": "produce"}, {"name": "feta cheese", "quantity": "1", "unit": "oz", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}], "steps": ["Slice the chicken sausage and brown it in olive oil.", "Add mushrooms and kale and cook until tender.", "Pour in eggs and egg whites, scramble until just set, and finish with feta."], "prep_time_min": 8, "cook_time_min": 10, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 470.0, "protein": 43.0, "carbs": 11.0, "fat": 28.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 85.0, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": null}
d57f714a-424c-447b-9653-7e373d9f94af	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Friday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 4, "prep_status": "reheat"}
70f0e90e-45a4-418b-be99-b55715632c83	345beb88-3425-4c81-97f3-7af2c444f92d	dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7	Friday	dinner	bulk_cook	t	1	{"id": "dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7", "title": "Bang Bang Chicken Skewers", "description": "Bang Bang Chicken Skewers in the air fryer and in under 30 minutes! This easy and healthy dinner packs so much flavor from the creamy bang bang sauce that\\u2019s a bit spicy and a bit sweet. Serve it with rice and some steamed broccoli for the complete meal! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "boneless skinless chicken thighs", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "low-sodium coconut aminos", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "oyster sauce", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "garlic paste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "ginger paste", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "chili powder", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "smoked paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "onion powder", "quantity": "3/4", "unit": "teaspoon", "category": "produce"}, {"name": "salt", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/4", "unit": "teaspoon", "category": "spices"}, {"name": "light coconut sugar", "quantity": "2", "unit": "tablespoons", "category": "sweetener"}, {"name": "mayonnaise", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "sweet chili sauce", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "minced garlic", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "rice vinegar", "quantity": "1", "unit": "tablespoon", "category": "grains"}, {"name": "sriracha, more to taste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "fresh parsley, finely chopped", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "red pepper flakes, optional for more spice", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}], "steps": ["Step 1: Preheat the air fryer or oven to 450\\u00b0F.", "Step 2: In a small bowl, make the bang bang sauce. Combine mayonnaise, sweet chili sauce, garlic, rice vinegar, sriracha, and parsley until smooth. Set aside.", "Step 3: To a bowl, add the chopped chicken along with soy sauce, olive oil, oyster sauce, garlic, ginger, chili powder, smoked paprika, onion powder, salt, black pepper, and light brown sugar. Mix together and if you have the time, let it marinate for 30 minutes.", "Step 4: After marinating, thread the chicken pieces onto skewers. If using wooden skewers, make sure they have soaked in water for 30 minutes to prevent them from burning. I like to add about 6 to 7 pieces onto each skewer.", "Step 5: Add the skewers to the air fryer and air fry for about 13 to 15 minutes at 450\\u00b0F until fully cooked and charred.", "Step 6: Drizzle bang bang sauce on top and add green onions to enjoy."], "prep_time_min": 15, "cook_time_min": 15, "servings": 4, "difficulty": "easy", "flavor_profile": ["sweet", "spicy", "umami"], "dietary_tags": ["dairy-free", "gluten-free"], "nutrition_estimate": {"calories": 380.0, "protein": 32.0, "carbs": 18.0, "fat": 20.0, "fiber": 1.0, "sugar": 0.0}, "mes_display_score": 84.8, "mes_display_tier": "good", "composite_display_score": 84.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "2871cfec-1857-4e76-93d5-995272beda48", "prep_day": "Wednesday", "prep_label": "Prep Wednesday", "prep_window_start_day": "Friday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": false, "repeat_index": 0, "prep_status": "prepped"}
99bcc586-b7b1-45c1-908b-0365ae626fa5	345beb88-3425-4c81-97f3-7af2c444f92d	7f708980-7e30-4168-b036-e91848bf0fd3	Saturday	breakfast	quick	f	1	{"id": "7f708980-7e30-4168-b036-e91848bf0fd3", "title": "Chicken Sausage Kale Scramble", "description": "Chicken sausage scrambled with eggs, kale, mushrooms, and feta for a low-carb breakfast.", "ingredients": [{"name": "chicken sausage", "quantity": "2", "unit": "links", "category": "protein"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "lacinato kale", "quantity": "1.5", "unit": "cups", "category": "produce"}, {"name": "mushrooms", "quantity": "0.75", "unit": "cup", "category": "produce"}, {"name": "feta cheese", "quantity": "1", "unit": "oz", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}], "steps": ["Slice the chicken sausage and brown it in olive oil.", "Add mushrooms and kale and cook until tender.", "Pour in eggs and egg whites, scramble until just set, and finish with feta."], "prep_time_min": 8, "cook_time_min": 10, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 470.0, "protein": 43.0, "carbs": 11.0, "fat": 28.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 85.0, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 1, "prep_status": null}
a1503657-76ac-444d-a2ac-7ca41ff8f4fe	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Saturday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 5, "prep_status": "reheat"}
af819fc8-3823-4b72-bf20-fcbf6c1e6d6a	345beb88-3425-4c81-97f3-7af2c444f92d	dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7	Saturday	dinner	bulk_cook	t	1	{"id": "dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7", "title": "Bang Bang Chicken Skewers", "description": "Bang Bang Chicken Skewers in the air fryer and in under 30 minutes! This easy and healthy dinner packs so much flavor from the creamy bang bang sauce that\\u2019s a bit spicy and a bit sweet. Serve it with rice and some steamed broccoli for the complete meal! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "boneless skinless chicken thighs", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "low-sodium coconut aminos", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "oyster sauce", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "garlic paste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "ginger paste", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "chili powder", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "smoked paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "onion powder", "quantity": "3/4", "unit": "teaspoon", "category": "produce"}, {"name": "salt", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/4", "unit": "teaspoon", "category": "spices"}, {"name": "light coconut sugar", "quantity": "2", "unit": "tablespoons", "category": "sweetener"}, {"name": "mayonnaise", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "sweet chili sauce", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "minced garlic", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "rice vinegar", "quantity": "1", "unit": "tablespoon", "category": "grains"}, {"name": "sriracha, more to taste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "fresh parsley, finely chopped", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "red pepper flakes, optional for more spice", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}], "steps": ["Step 1: Preheat the air fryer or oven to 450\\u00b0F.", "Step 2: In a small bowl, make the bang bang sauce. Combine mayonnaise, sweet chili sauce, garlic, rice vinegar, sriracha, and parsley until smooth. Set aside.", "Step 3: To a bowl, add the chopped chicken along with soy sauce, olive oil, oyster sauce, garlic, ginger, chili powder, smoked paprika, onion powder, salt, black pepper, and light brown sugar. Mix together and if you have the time, let it marinate for 30 minutes.", "Step 4: After marinating, thread the chicken pieces onto skewers. If using wooden skewers, make sure they have soaked in water for 30 minutes to prevent them from burning. I like to add about 6 to 7 pieces onto each skewer.", "Step 5: Add the skewers to the air fryer and air fry for about 13 to 15 minutes at 450\\u00b0F until fully cooked and charred.", "Step 6: Drizzle bang bang sauce on top and add green onions to enjoy."], "prep_time_min": 15, "cook_time_min": 15, "servings": 4, "difficulty": "easy", "flavor_profile": ["sweet", "spicy", "umami"], "dietary_tags": ["dairy-free", "gluten-free"], "nutrition_estimate": {"calories": 380.0, "protein": 32.0, "carbs": 18.0, "fat": 20.0, "fiber": 1.0, "sugar": 0.0}, "mes_display_score": 84.8, "mes_display_tier": "good", "composite_display_score": 84.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "2871cfec-1857-4e76-93d5-995272beda48", "prep_day": "Wednesday", "prep_label": "Prep Wednesday", "prep_window_start_day": "Friday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 1, "prep_status": "reheat"}
44504f4e-4c7e-44af-8b9b-fcd27b051256	345beb88-3425-4c81-97f3-7af2c444f92d	7f708980-7e30-4168-b036-e91848bf0fd3	Sunday	breakfast	quick	f	1	{"id": "7f708980-7e30-4168-b036-e91848bf0fd3", "title": "Chicken Sausage Kale Scramble", "description": "Chicken sausage scrambled with eggs, kale, mushrooms, and feta for a low-carb breakfast.", "ingredients": [{"name": "chicken sausage", "quantity": "2", "unit": "links", "category": "protein"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "lacinato kale", "quantity": "1.5", "unit": "cups", "category": "produce"}, {"name": "mushrooms", "quantity": "0.75", "unit": "cup", "category": "produce"}, {"name": "feta cheese", "quantity": "1", "unit": "oz", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}], "steps": ["Slice the chicken sausage and brown it in olive oil.", "Add mushrooms and kale and cook until tender.", "Pour in eggs and egg whites, scramble until just set, and finish with feta."], "prep_time_min": 8, "cook_time_min": 10, "servings": 1, "difficulty": "easy", "flavor_profile": ["savory"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 470.0, "protein": 43.0, "carbs": 11.0, "fat": 28.0, "fiber": 7.0, "sugar": 0.0}, "mes_display_score": 85.0, "mes_display_tier": "optimal", "composite_display_score": null, "composite_display_tier": null, "paired_recipe_id": null, "paired_recipe_title": null, "meets_mes_target": true, "prep_group_id": null, "prep_day": null, "prep_label": null, "prep_window_start_day": null, "prep_window_end_day": null, "is_prep_day": false, "is_reheat": false, "repeat_index": 2, "prep_status": null}
dd1271d8-950f-44b7-a651-0edd77e19843	345beb88-3425-4c81-97f3-7af2c444f92d	651c53a5-635a-4088-b226-5259046cf097	Sunday	lunch	bulk_cook	t	1	{"id": "651c53a5-635a-4088-b226-5259046cf097", "title": "Homestyle Smash Burger", "description": "Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese \\u2013 what could truly be better? It\\u2019s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}], "steps": ["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."], "prep_time_min": 35, "cook_time_min": 25, "servings": 4, "difficulty": "easy", "flavor_profile": ["savory", "umami"], "dietary_tags": ["gluten-free"], "nutrition_estimate": {"calories": 520.0, "protein": 32.0, "carbs": 38.0, "fat": 26.0, "fiber": 3.0, "sugar": 0.0}, "mes_display_score": 76.8, "mes_display_tier": "good", "composite_display_score": 76.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "prep_day": "Sunday", "prep_label": "Prep Sunday", "prep_window_start_day": "Monday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 6, "prep_status": "reheat"}
47732f56-bb54-422b-be48-79eb87215dbe	345beb88-3425-4c81-97f3-7af2c444f92d	dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7	Sunday	dinner	bulk_cook	t	1	{"id": "dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7", "title": "Bang Bang Chicken Skewers", "description": "Bang Bang Chicken Skewers in the air fryer and in under 30 minutes! This easy and healthy dinner packs so much flavor from the creamy bang bang sauce that\\u2019s a bit spicy and a bit sweet. Serve it with rice and some steamed broccoli for the complete meal! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).", "ingredients": [{"name": "boneless skinless chicken thighs", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "low-sodium coconut aminos", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "oyster sauce", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "garlic paste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "ginger paste", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "chili powder", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "smoked paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "onion powder", "quantity": "3/4", "unit": "teaspoon", "category": "produce"}, {"name": "salt", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/4", "unit": "teaspoon", "category": "spices"}, {"name": "light coconut sugar", "quantity": "2", "unit": "tablespoons", "category": "sweetener"}, {"name": "mayonnaise", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "sweet chili sauce", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "minced garlic", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "rice vinegar", "quantity": "1", "unit": "tablespoon", "category": "grains"}, {"name": "sriracha, more to taste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "fresh parsley, finely chopped", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "red pepper flakes, optional for more spice", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}], "steps": ["Step 1: Preheat the air fryer or oven to 450\\u00b0F.", "Step 2: In a small bowl, make the bang bang sauce. Combine mayonnaise, sweet chili sauce, garlic, rice vinegar, sriracha, and parsley until smooth. Set aside.", "Step 3: To a bowl, add the chopped chicken along with soy sauce, olive oil, oyster sauce, garlic, ginger, chili powder, smoked paprika, onion powder, salt, black pepper, and light brown sugar. Mix together and if you have the time, let it marinate for 30 minutes.", "Step 4: After marinating, thread the chicken pieces onto skewers. If using wooden skewers, make sure they have soaked in water for 30 minutes to prevent them from burning. I like to add about 6 to 7 pieces onto each skewer.", "Step 5: Add the skewers to the air fryer and air fry for about 13 to 15 minutes at 450\\u00b0F until fully cooked and charred.", "Step 6: Drizzle bang bang sauce on top and add green onions to enjoy."], "prep_time_min": 15, "cook_time_min": 15, "servings": 4, "difficulty": "easy", "flavor_profile": ["sweet", "spicy", "umami"], "dietary_tags": ["dairy-free", "gluten-free"], "nutrition_estimate": {"calories": 380.0, "protein": 32.0, "carbs": 18.0, "fat": 20.0, "fiber": 1.0, "sugar": 0.0}, "mes_display_score": 84.8, "mes_display_tier": "good", "composite_display_score": 84.8, "composite_display_tier": "good", "paired_recipe_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "paired_recipe_title": "Black Bean and Corn Salad", "meets_mes_target": true, "prep_group_id": "2871cfec-1857-4e76-93d5-995272beda48", "prep_day": "Wednesday", "prep_label": "Prep Wednesday", "prep_window_start_day": "Friday", "prep_window_end_day": "Sunday", "is_prep_day": false, "is_reheat": true, "repeat_index": 2, "prep_status": "reheat"}
\.


--
-- Data for Name: meal_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meal_plans (id, user_id, week_start, preferences_snapshot, created_at) FROM stdin;
345beb88-3425-4c81-97f3-7af2c444f92d	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-09	{"flavor_preferences": ["spicy", "savory", "sweet", "tangy", "mild", "umami"], "dietary_restrictions": ["none"], "allergies": ["nuts", "sesame"], "liked_ingredients": [], "disliked_ingredients": [], "protein_preferences": {"liked": [], "disliked": []}, "cooking_time_budget": {"quick": 4, "medium": 2, "long": 1}, "household_size": 1, "budget_level": "medium", "bulk_cook_preference": true, "meals_per_day": 3, "variety_mode": "balanced", "preferred_recipe_ids": ["b31cf8be-b884-4f87-a194-16a91ff6bd84", "2df15af1-1461-4afe-a490-f8a65889a8df", "7f708980-7e30-4168-b036-e91848bf0fd3", "7e19499a-29a9-4004-adcb-7c1d942c45ee", "651c53a5-635a-4088-b226-5259046cf097", "306305ee-6a5a-4b6e-ae31-30a546530abe", "f2e2813f-ebaf-4cd5-a2dc-28a9925df80b"], "avoided_recipe_ids": [], "generation_warnings": [], "prep_timeline": [{"prep_group_id": "c4c046cb-9da4-406c-b6c0-79288dec02cd", "recipe_id": "651c53a5-635a-4088-b226-5259046cf097", "recipe_title": "Homestyle Smash Burger", "meal_type": "lunch", "prep_day": "Sunday", "covers_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "servings_to_make": 7, "summary_text": "Prep Sunday: Homestyle Smash Burger for Monday-Sunday lunches"}, {"prep_group_id": "e95dc655-0ed6-4182-8dbf-1fee3bf1afe3", "recipe_id": "306305ee-6a5a-4b6e-ae31-30a546530abe", "recipe_title": "Chicken Shawarma Bowl", "meal_type": "dinner", "prep_day": "Sunday", "covers_days": ["Monday", "Tuesday"], "servings_to_make": 2, "summary_text": "Prep Sunday: Chicken Shawarma Bowl for Monday-Tuesday dinners"}, {"prep_group_id": "4f594ab6-1ac4-41f2-81d1-1df0e3d87e61", "recipe_id": "f2e2813f-ebaf-4cd5-a2dc-28a9925df80b", "recipe_title": "Butter Chicken Bowl Plus", "meal_type": "dinner", "prep_day": "Sunday", "covers_days": ["Wednesday", "Thursday"], "servings_to_make": 2, "summary_text": "Prep Sunday: Butter Chicken Bowl Plus for Wednesday-Thursday dinners"}, {"prep_group_id": "2871cfec-1857-4e76-93d5-995272beda48", "recipe_id": "dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7", "recipe_title": "Bang Bang Chicken Skewers", "meal_type": "dinner", "prep_day": "Wednesday", "covers_days": ["Friday", "Saturday", "Sunday"], "servings_to_make": 3, "summary_text": "Prep Wednesday: Bang Bang Chicken Skewers for Friday-Sunday dinners"}]}	2026-03-13 22:45:12.716566
\.


--
-- Data for Name: metabolic_budgets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.metabolic_budgets (id, user_id, protein_target_g, fiber_floor_g, sugar_ceiling_g, fat_target_g, tdee, calorie_target_kcal, ism, tier_thresholds_json, weight_protein, weight_fiber, weight_sugar, weight_fat, created_at, updated_at) FROM stdin;
3e482730-fe0e-4f36-9a1d-effffed683d8	be56146c-bff6-44d6-9b17-6bc36227d00e	165	29.7	155	87.5	2910.3	2067.5	0.85	{"optimal": 81, "good": 66, "moderate": 51, "low": 36}	0.316622691292876	0.2110817941952507	0.3139841688654354	0.158311345646438	2026-03-13 22:33:32.029566	2026-03-13 22:50:17.758161
\.


--
-- Data for Name: metabolic_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.metabolic_profiles (id, user_id, sex, age, height_cm, height_ft, height_in, weight_lb, body_fat_pct, body_fat_method, goal, activity_level, insulin_resistant, prediabetes, type_2_diabetes, fasting_glucose_mgdl, hba1c_pct, triglycerides_mgdl, target_weight_lb, protein_target_g, onboarding_step_completed, created_at, updated_at) FROM stdin;
d79c3caf-419e-43ea-a22d-36ac11693a9e	be56146c-bff6-44d6-9b17-6bc36227d00e	male	26	170.2	5	7	165	14	estimate	maintenance	active	f	f	f	\N	\N	\N	165	165	3	2026-03-13 22:50:17.733939	2026-03-13 22:50:17.73395
\.


--
-- Data for Name: metabolic_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.metabolic_scores (id, user_id, date, scope, food_log_id, protein_score, fiber_score, sugar_score, total_score, display_score, display_tier, protein_g, fiber_g, sugar_g, tier, meal_context, details_json, created_at, updated_at) FROM stdin;
f2c933be-70a6-41bf-b971-a186c40a129b	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	meal	e3704daf-cfda-498d-ae2a-17f050d9746e	73.8	71.2	100	84.1	84.1	optimal	43	7	11	optimal	full_meal	{"meal_context": "full_meal", "sub_scores": {"gis": 100.0, "pas": 73.8, "fs": 71.2, "fas": 90.4}, "weights_used": {"gis": 0.314, "protein": 0.317, "fiber": 0.211, "fat": 0.158}, "net_carbs_g": 4.0}	2026-03-13 22:50:39.002257	2026-03-13 22:50:39.002259
f7a1e5ec-6847-4dfc-a7b6-aa954cbf3c45	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	meal	3414d44a-1aa9-4cfb-a03c-1c1f682a331a	22.5	40.2	51.4	37.2	37.2	low	19.5	3.8	41.2	low	full_meal	{"meal_context": "full_meal", "sub_scores": {"gis": 51.4, "pas": 22.5, "fs": 40.2, "fas": 34.0}, "weights_used": {"gis": 0.314, "protein": 0.317, "fiber": 0.211, "fat": 0.158}, "net_carbs_g": 37.4}	2026-03-13 23:55:37.301422	2026-03-13 23:55:37.301432
be742f16-2e64-43d5-8a71-50e1375328eb	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	meal	213f8801-3067-4560-80d5-75fefd8c7d84	0	0	0	0	0	unscored	2	3	10	unscored	meal_component_veg	{"meal_context": "meal_component_veg", "unscored_reason": "Prep component \\u2014 add protein to see full MES."}	2026-03-13 23:55:37.3922	2026-03-13 23:55:37.392207
7235bbed-d1fa-42a2-9136-19d26dfb7507	be56146c-bff6-44d6-9b17-6bc36227d00e	2026-03-13	daily	\N	26.9	49.3	87.7	60.7	60.7	moderate	64.5	13.8	62.2	moderate	daily	{"dessert_sugar_g": 0.0, "sugar_overage_g": 0, "treat_impact": {"has_treats": false, "dessert_carbs_g": 0.0, "dessert_calories": 0.0, "protection_score": 0.0, "protection_buffer_g": 0.0, "treat_load_g": 0.0, "net_treat_load_g": 0.0, "mes_penalty_points": 0.0, "impact_level": "none"}, "sub_scores": {"gis": 87.7, "pas": 26.9, "fs": 49.3, "fas": 66.3}, "weights_used": {"gis": 0.314, "protein": 0.317, "fiber": 0.211, "fat": 0.158}, "net_carbs_g": 48.4, "fat_g": 36.8, "macro_only_total_score": 57.0, "pairing_synergy_daily_bonus": 3.7, "pairing_synergy_sources": [{"group_id": "a5fe4260-2533-4dba-8436-99d958f3acc9", "pairing_recipe_id": "5fcd9514-aa74-4a39-9f7c-c5d21ab5a699", "pairing_title": "Cucumber Tomato Herb Salad", "pairing_gis_bonus": 7.0, "pairing_synergy_bonus": 1.5, "pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"], "pairing_delta": 3.7}]}	2026-03-13 22:50:19.212712	2026-03-13 23:55:37.414556
\.


--
-- Data for Name: metabolic_streaks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.metabolic_streaks (id, user_id, current_streak, longest_streak, last_qualifying_date, threshold, created_at, updated_at) FROM stdin;
0c8f8aac-2543-426d-ba01-f7ba3ddb519d	be56146c-bff6-44d6-9b17-6bc36227d00e	1	1	2026-03-13	55	2026-03-13 22:33:32.071367	2026-03-13 23:55:37.426969
\.


--
-- Data for Name: notification_deliveries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_deliveries (id, user_id, push_token_id, category, status, title, body, route, metadata_json, triggered_by_event, eligibility_score, sent_at, opened_at, conversion_at, failure_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_events (id, user_id, event_type, source, properties, occurred_at, created_at) FROM stdin;
bf1b4618-771e-4df2-9e1c-537e4a59941c	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:16:06.757289	2026-03-13 22:16:06.757988
1a581739-8062-4b0e-9df7-198041b4d17f	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:16:47.722184	2026-03-13 22:16:47.722386
8decd2af-1ed4-405a-a10b-bab2ab8968b5	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:19:09.134804	2026-03-13 22:19:09.137055
52031c0e-423f-4ba5-939f-9ed5612e30e2	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:19:17.193608	2026-03-13 22:19:17.19377
8e798aa3-4c6c-4ec9-a32d-b1043f2e8511	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:20:14.913807	2026-03-13 22:20:14.914448
ee729c8d-7950-4bd5-86f9-1d230d54c8d6	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:21:46.820968	2026-03-13 22:21:46.821968
e656fb22-7600-48be-868c-ff0ac9878974	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:21:50.697714	2026-03-13 22:21:50.697869
eb233f35-4175-4890-9960-959457bb1440	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:23:43.567372	2026-03-13 22:23:43.568618
f703879a-30b2-495b-9b45-2641f1b03b4f	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:23:47.045751	2026-03-13 22:23:47.045882
2a99965a-37c0-485a-9dba-1970f95abe3c	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:27:56.13142	2026-03-13 22:27:56.132628
ad4e6650-7826-4fa9-83e4-c4957f002dfe	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:27:59.805046	2026-03-13 22:27:59.805192
c743e294-b6ed-415b-96cf-dd7ceb9fbf2b	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:29:23.0947	2026-03-13 22:29:23.095495
14d074e4-41da-4819-9384-e3d5eaa49f60	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:29:24.859448	2026-03-13 22:29:24.859593
b1d37410-f4fc-4bfa-a06d-db892861963a	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:29:26.331526	2026-03-13 22:29:26.331685
0acfa51f-00ee-4acb-a35d-7323920eaa98	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:30:05.554183	2026-03-13 22:30:05.554337
12e1f6fb-0376-4789-9b11-6bb4ac8582a1	be56146c-bff6-44d6-9b17-6bc36227d00e	recipe_browsed	server	{"recipe_id": "dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7", "recipe_title": "Bang Bang Chicken Skewers"}	2026-03-13 22:41:18.985492	2026-03-13 22:41:18.98827
5d049035-109f-4ae9-a1be-1d4b206c97d2	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:42:20.951261	2026-03-13 22:42:20.952005
8a3e712d-78ff-48dd-ba4b-02e79e39f9bc	be56146c-bff6-44d6-9b17-6bc36227d00e	app_opened	server	{}	2026-03-13 22:42:30.593778	2026-03-13 22:42:30.594555
dc99e02f-4a13-4ae8-99db-5c450421fb79	be56146c-bff6-44d6-9b17-6bc36227d00e	saved_recipes_viewed	server	{"count": 0}	2026-03-13 22:43:19.307907	2026-03-13 22:43:19.30869
c10bf7f6-d4b8-48d1-ac49-b427cecc3a72	be56146c-bff6-44d6-9b17-6bc36227d00e	meal_plan_created	server	{"meal_plan_id": "345beb88-3425-4c81-97f3-7af2c444f92d", "week_start": "2026-03-09"}	2026-03-13 22:45:12.745107	2026-03-13 22:45:12.746199
7fc646f9-6ece-4194-9a9e-5e50a86a1657	be56146c-bff6-44d6-9b17-6bc36227d00e	meal_plan_viewed	client	{"meal_plan_id": "345beb88-3425-4c81-97f3-7af2c444f92d", "timezone": "America/New_York", "local_hour": 18}	2026-03-13 22:45:13.095308	2026-03-13 22:45:13.095911
09406ebd-c3e7-4388-9fd6-79eea3cd1dd7	be56146c-bff6-44d6-9b17-6bc36227d00e	meal_plan_viewed	client	{"meal_plan_id": "345beb88-3425-4c81-97f3-7af2c444f92d", "timezone": "America/New_York", "local_hour": 18}	2026-03-13 22:45:13.14272	2026-03-13 22:45:13.143217
7b9486fc-d013-4389-a598-a176c3aa5b9f	be56146c-bff6-44d6-9b17-6bc36227d00e	meal_plan_viewed	server	{"meal_plan_id": "345beb88-3425-4c81-97f3-7af2c444f92d"}	2026-03-13 22:50:34.387327	2026-03-13 22:50:34.387733
a3be0435-16c6-4d19-9a32-d95cb6f77beb	be56146c-bff6-44d6-9b17-6bc36227d00e	food_logged_today	server	{"log_id": "e3704daf-cfda-498d-ae2a-17f050d9746e", "meal_type": "breakfast", "date": "2026-03-13"}	2026-03-13 22:50:39.013698	2026-03-13 22:50:39.013793
052068fc-1000-4dc8-9ad0-fb7c9befac0c	be56146c-bff6-44d6-9b17-6bc36227d00e	daily_mes_updated	server	{"date": "2026-03-13", "daily_score": 13.3}	2026-03-13 22:50:39.017329	2026-03-13 22:50:39.017433
dea3ae3f-38ca-4a41-8440-d0b4b8902105	be56146c-bff6-44d6-9b17-6bc36227d00e	recipe_browsed	server	{"recipe_id": "5fcd9514-aa74-4a39-9f7c-c5d21ab5a699", "recipe_title": "Cucumber Tomato Herb Salad"}	2026-03-13 23:55:44.033431	2026-03-13 23:55:44.034278
27957be7-b216-4721-a9be-ac9a97653e13	be56146c-bff6-44d6-9b17-6bc36227d00e	recipe_browsed	server	{"recipe_id": "5fcd9514-aa74-4a39-9f7c-c5d21ab5a699", "recipe_title": "Cucumber Tomato Herb Salad"}	2026-03-13 23:55:46.21495	2026-03-13 23:55:46.215304
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_preferences (id, user_id, push_enabled, timezone, quiet_hours_start, quiet_hours_end, preferred_meal_window_start, preferred_meal_window_end, max_notifications_per_day, max_notifications_per_week, categories, created_at, updated_at) FROM stdin;
e7242e88-2eff-43dd-9c67-3aa5db50eac3	be56146c-bff6-44d6-9b17-6bc36227d00e	t	America/New_York	21:30	08:00	17:00	19:30	1	3	{"plan": true, "cook": true, "grocery": true, "streak": true, "quest": true, "reactivation": true, "healthify": true, "promotional": false}	2026-03-13 22:16:06.765983	2026-03-13 22:45:13.108255
\.


--
-- Data for Name: nutrition_streaks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nutrition_streaks (id, user_id, current_streak, longest_streak, last_qualifying_date, threshold, created_at, updated_at) FROM stdin;
016d2974-5774-4a9e-b2ad-fb835c58f8b7	be56146c-bff6-44d6-9b17-6bc36227d00e	0	0	\N	60	2026-03-13 22:50:38.98325	2026-03-13 22:50:38.983252
\.


--
-- Data for Name: nutrition_targets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nutrition_targets (id, user_id, calories_target, protein_g_target, carbs_g_target, fat_g_target, fiber_g_target, micronutrient_targets, created_at, updated_at) FROM stdin;
337b1463-64b0-4e83-b01f-d2aec0025fe6	be56146c-bff6-44d6-9b17-6bc36227d00e	2067.5	165	155	87.5	29.7	{"vitamin_a_mcg": 900, "vitamin_c_mg": 90, "vitamin_d_mcg": 20, "vitamin_e_mg": 15, "vitamin_k_mcg": 120, "thiamin_b1_mg": 1.2, "riboflavin_b2_mg": 1.3, "niacin_b3_mg": 16, "vitamin_b6_mg": 1.7, "folate_mcg": 400, "vitamin_b12_mcg": 2.4, "choline_mg": 550, "calcium_mg": 1300, "iron_mg": 18, "magnesium_mg": 420, "phosphorus_mg": 1250, "potassium_mg": 4700, "sodium_mg": 2300, "zinc_mg": 11, "copper_mg": 0.9, "manganese_mg": 2.3, "selenium_mcg": 55, "iodine_mcg": 150, "omega3_g": 1.6}	2026-03-13 22:33:32.02009	2026-03-13 22:50:17.771504
\.


--
-- Data for Name: recipe_embeddings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipe_embeddings (id, recipe_id, provider, model, text_hash, vector, updated_at) FROM stdin;
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipes (id, title, description, ingredients, steps, prep_time_min, cook_time_min, total_time_min, servings, nutrition_info, difficulty, tags, flavor_profile, dietary_tags, cuisine, health_benefits, protein_type, carb_type, is_ai_generated, image_url, created_at, recipe_role, is_component, meal_group_id, default_pairing_ids, needs_default_pairing, component_composition, is_mes_scoreable, pairing_synergy_profile) FROM stdin;
d9382f04-200a-4cc2-9def-5088a2e37429	Chickpea Mac N' Beef	A one-pan beef and chickpea pasta skillet simmered in crushed tomatoes with onion, garlic, and paprika for a high-protein comfort meal.	[{"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "onion, chopped", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "90/10 ground beef", "quantity": "1", "unit": "lb", "category": "protein"}, {"name": "garlic powder", "quantity": "1", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1", "unit": "tsp", "category": "spices"}, {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "crushed tomatoes", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "dry chickpea pasta", "quantity": "85", "unit": "g", "category": "grains"}, {"name": "spinach, chopped (optional)", "quantity": "to taste", "unit": "", "category": "produce"}]	["Warm the olive oil in a large skillet or saute pan over medium heat. Add the chopped onion and cook for 2 to 3 minutes until it starts to soften.", "Add the 90/10 ground beef, garlic powder, paprika, salt, and black pepper. Cook for 6 to 8 minutes, breaking it up as it browns, until the beef is fully cooked and lightly browned.", "Stir in the crushed tomatoes, water or broth, and dry chickpea pasta. Mix well and bring everything to a gentle boil.", "Lower the heat, cover, and simmer for about 18 to 20 minutes, stirring once or twice, until the pasta is tender and the sauce has thickened.", "If you want extra greens, stir in chopped spinach at the end and let it wilt for 1 to 2 minutes.", "Serve hot. Eat the lemon garlic zucchini and mushrooms before or with the skillet."]	10	20	30	2	{"calories": 507.2, "protein": 43.8, "carbs": 36.7, "fat": 21.1, "fiber": 6.2, "sugar": 5.6}	easy	["dinner", "quick", "one_pan"]	["savory", "tomato-forward", "comforting"]	["dairy-free"]	american	["muscle_recovery", "gut_health", "blood_sugar"]	["beef"]	["chickpea_pasta"]	f	\N	2026-03-13 22:13:39.958754	full_meal	f	\N	["8dd68b28-4312-4fa6-b91c-9e65344e645b"]	t	null	t	null
8dd68b28-4312-4fa6-b91c-9e65344e645b	Lemon Garlic Zucchini and Mushrooms	Simple zucchini and mushrooms sauteed with garlic, olive oil, and lemon as a savory veggie side.	[{"name": "zucchini, diced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "mushrooms, sliced", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "garlic, minced", "quantity": "1", "unit": "clove", "category": "produce"}, {"name": "lemon juice", "quantity": "2", "unit": "tsp", "category": "produce"}, {"name": "salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}]	["Heat the olive oil in a skillet over medium heat.", "Add the mushrooms and zucchini with a pinch of salt and cook for 5 to 7 minutes, until tender and lightly golden.", "Stir in the garlic and cook for 30 seconds, just until fragrant.", "Turn off the heat, add the lemon juice, and finish with black pepper. Serve warm."]	10	8	18	2	{"calories": 46.0, "protein": 1.8, "carbs": 5.0, "fat": 2.6, "fiber": 1.6, "sugar": 2.6}	easy	["dinner", "side", "quick"]	["savory", "bright", "garlicky"]	["dairy-free", "gluten-free"]	american	["gut_health", "blood_sugar", "heart_health"]	[]	[]	f	\N	2026-03-13 22:13:39.958759	veg_side	f	\N	[]	f	null	f	{"fiber_class": "low", "acid": true, "healthy_fat": true, "veg_density": "high", "recommended_timing": "before_meal"}
6e3a09d3-110a-4584-bb8e-05556837cb36	Air Fryer Gochujang Chicken Skewers	If you’re bored of plain chicken and rice, these Korean-inspired skewers are about to change the game. They’re sweet, spicy, and so addicting with that gochujang marinade. Made in the air fryer, they cook up fast with the perfect charred, smoky flavor that takes them over the top. Whether you’re grilling them, baking them in the oven, or air frying, they’re an easy, bold dinner that’s ready in 30 minutes. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).	[{"name": "chicken thighs, cut into bite-sized pieces", "quantity": "1.5", "unit": "pounds", "category": "protein"}, {"name": "light coconut sugar", "quantity": "4", "unit": "tablespoons", "category": "sweetener"}, {"name": "gochujang paste", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "sesame oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "rice vinegar", "quantity": "1", "unit": "tablespoon", "category": "grains"}, {"name": "finely minced garlic", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "ginger paste", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "smoked paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "gochugaru, optional", "quantity": "1/2", "unit": "teaspoon", "category": "produce"}, {"name": "low-sodium coconut aminos", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "salt, or more to taste", "quantity": "3/4", "unit": "teaspoon", "category": "spices"}]	["Step 1: In a large bowl, whisk together the gochujang, brown sugar, sesame oil, rice vinegar, garlic, ginger paste, smoked paprika, gochugaru, soy sauce, and salt until smooth and well combined.", "Step 2: Add the chicken thigh pieces and mix well until fully coated in the marinade. If you have time, let it sit for 1 hour in the fridge\\u2014but you can also cook it right away.", "Step 3: Thread the chicken onto skewers, packing the pieces snugly but not too tightly.", "Step 4: Preheat the air fryer to 400\\u00b0F. Lightly grease the basket or tray, then arrange the skewers in a single layer, working in batches if needed.", "Step 5: Air fry for 12 to 15 minutes, flipping halfway through, until the chicken is cooked through and caramelized on the edges.", "Step 6: Serve warm with steamed rice, a sprinkle of sesame seeds, and sliced green onions if desired."]	15	15	30	6	{"calories": 320, "protein": 30, "carbs": 22, "fat": 12, "fiber": 2, "mes_score": 62.6, "mes_display_score": 62.6, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 80.0, "pas": 69.6, "fs": 20.0, "fas": 65.0}, "mes_score_with_default_pairing": 77.6, "mes_default_pairing_delta": 18.9, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 81.5, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	easy	["dinner", "quick"]	["sweet", "spicy", "umami"]	["dairy-free", "gluten-free"]	korean	["anti_inflammatory", "blood_sugar", "gut_health", "heart_health", "immune_support", "muscle_recovery"]	["chicken"]	[]	f	https://moribyan.com/wp-content/uploads/2025/04/IMG_0289.jpg	2026-03-13 22:16:25.731558	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
8516ac4e-36a2-4724-8e30-f053cf9a3a93	Almond Raspberry Scones	If you love that buttery, flaky almond croissant vibe but want something a little easier to make at home, these Almond Croissant Raspberry Scones are exactly the answer. They’re tender and flaky with just the right amount of almond flavor, loaded with juicy bursts of raspberries that balance out the richness perfectly. Topped with sliced almonds and a dusting of powdered sugar, they look and taste like something straight from your favorite bakery. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 3 whole-food ingredient swap(s).	[{"name": "\\u00be cups cassava flour, additional for dusting surface", "quantity": "1", "unit": "", "category": "produce"}, {"name": "\\u2153 cup almond flour", "quantity": "", "unit": "", "category": "produce"}, {"name": "baking powder", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "\\u00bd teaspoon salt", "quantity": "", "unit": "", "category": "spices"}, {"name": "\\u00bd cup monk fruit sweetener", "quantity": "", "unit": "", "category": "sweetener"}, {"name": "\\u00bd cup unsalted butter, chilled", "quantity": "", "unit": "", "category": "fats"}, {"name": "\\u00bd cup heavy cream", "quantity": "", "unit": "", "category": "dairy"}, {"name": "vanilla extract", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "\\u00bd teaspoon almond extract", "quantity": "", "unit": "", "category": "produce"}, {"name": "egg", "quantity": "1", "unit": "large", "category": "protein"}, {"name": "frozen raspberries", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "\\u00bc cup sliced almonds", "quantity": "", "unit": "", "category": "produce"}, {"name": "egg wash: 1 large egg + 1 tablespoon heavy cream or milk", "quantity": "", "unit": "", "category": "protein"}, {"name": "monk fruit powdered sweetener (for dusting)", "quantity": "", "unit": "", "category": "sweetener"}]	["Step 1: In a large bowl, whisk together the all-purpose flour, almond flour, baking powder, salt, and sugar.", "Step 2: Grate the chilled butter into the dry ingredients using a box grater. Massage gently with your hands to coat the butter in the flour mixture.", "Step 3: In a separate bowl, whisk together the heavy cream, vanilla extract, almond extract, and egg until smooth and combined.", "Step 4: Pour the wet ingredients into the dry mixture and stir just until a dough begins to form. Be careful not to overmix.", "Step 5: Gently fold in the frozen raspberries, trying not to crush them too much. A little bit of berry juice streaking is fine.", "Step 6: Turn the dough out onto a lightly floured surface and pat it into a circle about 1 inch thick.", "Step 7: Cut the circle into 8 wedges and place them on a parchment-lined baking sheet. Brush the tops of the chilled scones with the egg wash. Press the sliced almonds on top, gently pressing them in so they stick.", "Step 8: Chill the scones in the fridge for 20 minutes while you preheat the oven to help the butter in the dough get colder again.", "Step 9: Preheat the oven to 400\\u00b0F (200\\u00b0C). Bake for 18 to 20 minutes, until golden brown and set.", "Step 10: Let the scones cool for 5 to 10 minutes on the pan. Dust the tops with powdered sugar and enjoy warm!."]	35	25	60	8	{"calories": 310, "protein": 6, "carbs": 38, "fat": 15, "fiber": 3}	medium	["breakfast", "sit-down"]	["sweet"]	[]	french	["blood_sugar", "bone_health", "brain_health", "heart_health", "muscle_recovery"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2025/01/IMG_0551.jpg	2026-03-13 22:16:25.731565	dessert	f	\N	[]	\N	null	f	null
5fcd9514-aa74-4a39-9f7c-c5d21ab5a699	Cucumber Tomato Herb Salad	Fresh salad side that brightens rich bowls and boosts fiber.	[{"name": "cucumber", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "tomato", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "fresh parsley", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "pinch", "unit": "", "category": "spices"}]	["Toss the cucumber, tomato, and parsley together.", "Dress with olive oil, lemon juice, and a pinch of salt."]	8	0	8	2	{"calories": 70, "protein": 2.0, "carbs": 10.0, "fat": 3.0, "fiber": 3.0, "sugar": 4.0}	easy	["meal-prep", "whole-food", "veg_side", "veg_component", "salad", "red_pepper_bowl_group_v1"]	["fresh"]	["gluten-free", "dairy-free", "vegan"]	mediterranean	["detox_support", "skin_health"]	[]	[]	f	\N	2026-03-13 22:16:25.731576	veg_side	t	\N	[]	\N	null	f	{"acid": true, "fiber_class": "med", "healthy_fat": true, "veg_density": "high", "recommended_timing": "before_meal"}
c3e24871-9bd5-420f-85fb-8a39788e3724	Apple Cider Spice Loaf	There’s nothing that says fall quite like the smell of apple cider simmering on the stove. It fills the kitchen with that cozy mix of apples, cinnamon, and spice that makes you want to put on a sweater, light a candle, and bake something warm. Living here in Boston, one of my favorite New England weekend activities is going to different farms, trying every apple cider donut I can find, and deciding which one’s the best — it’s serious business at this point. There’s just something about biting into a warm, sugar-dusted donut with crisp air and colorful leaves all around that makes you fall in love with the season all over again. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 5 whole-food ingredient swap(s).	[{"name": "1\\u00be cups cassava flour", "quantity": "", "unit": "", "category": "produce"}, {"name": "1\\u00bd teaspoons ground cinnamon", "quantity": "", "unit": "", "category": "spices"}, {"name": "\\u00bc teaspoon nutmeg", "quantity": "", "unit": "", "category": "produce"}, {"name": "\\u00bc teaspoon cardamom", "quantity": "", "unit": "", "category": "produce"}, {"name": "baking soda", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "\\u00bd teaspoon baking powder", "quantity": "", "unit": "", "category": "produce"}, {"name": "\\u00bd teaspoon salt", "quantity": "", "unit": "", "category": "spices"}, {"name": "\\u00bc cup white monk fruit sweetener", "quantity": "", "unit": "", "category": "sweetener"}, {"name": "\\u00be cup light coconut sugar", "quantity": "", "unit": "", "category": "sweetener"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "\\u00bd cup extra virgin olive oil", "quantity": "", "unit": "", "category": "fats"}, {"name": "\\u00be cup reduced apple cider (start with 1\\u00bd cups and simmer 15\\u201320 minutes until it reduces to \\u00be cup)", "quantity": "", "unit": "", "category": "produce"}, {"name": "\\u00be cup unsweetened applesauce", "quantity": "", "unit": "", "category": "produce"}, {"name": "\\u00bd tablespoon vanilla extract", "quantity": "", "unit": "", "category": "produce"}, {"name": "\\u00bc cup monk fruit sweetener", "quantity": "", "unit": "", "category": "sweetener"}, {"name": "\\u00bd teaspoon cinnamon", "quantity": "", "unit": "", "category": "spices"}, {"name": "unsalted butter, melted (for brushing after baking)", "quantity": "2", "unit": "tablespoons", "category": "fats"}]	["Step 1: Preheat the oven: Set the oven to 350\\u00b0F (175\\u00b0C) and line a loaf pan with parchment paper, leaving some overhang on the sides for easy removal later.", "Step 2: Reduce the apple cider: In a small saucepan, simmer 1\\u00bd cups apple cider over medium heat for 15\\u201320 minutes until it reduces to about \\u00be cup and slightly thickens. Let it cool slightly before using.", "Step 3: Make the cinnamon sugar: In a small bowl, mix together the \\u00bc cup white sugar and \\u00bd teaspoon cinnamon until evenly combined. Set aside.", "Step 4: Mix the dry ingredients: In a large bowl, whisk together the flour, cinnamon, nutmeg, cardamom, baking soda, baking powder, and salt until evenly combined.", "Step 5: Mix the wet ingredients: In a separate bowl, whisk together both sugars, eggs, oil, reduced apple cider, applesauce, and vanilla extract until smooth.", "Step 6: Combine the batter: Pour the wet ingredients into the dry ingredients and whisk until just combined \\u2014 stop as soon as you no longer see streaks of flour.", "Step 7: Pour and top: Pour the batter into the lined loaf pan, spreading it evenly. Sprinkle half of the cinnamon sugar mixture evenly over the top.", "Step 8: Bake: Transfer the loaf pan to the oven and bake for 45 to 55 minutes, or until a toothpick inserted in the center comes out clean.", "Step 9: Finish with cinnamon sugar: Let the loaf cool for about 10 minutes, then lift it out of the pan and place it on a wire rack. Brush the top with melted butter and sprinkle the remaining cinnamon sugar evenly so it sticks beautifully.", "Step 10: Slice and serve: Once fully cooled, cut into thick slices and enjoy!."]	20	50	60	8	{"calories": 280, "protein": 4, "carbs": 42, "fat": 11, "fiber": 2}	medium	["snack", "sit-down"]	["sweet"]	[]	american	["anti_inflammatory", "blood_sugar", "brain_health", "gut_health", "heart_health", "muscle_recovery"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2025/10/IMG_2074.jpg	2026-03-13 22:16:25.731566	dessert	f	\N	[]	\N	null	f	null
5b3906f5-dcf4-4e0e-9346-592649762845	Avocado Quinoa Power Salad	This Avocado Quinoa Salad is a spot-on copycat of my all-time favorite from Mendocino Farms, where I actually used to work for a summer back in 2015. It’s loaded with crispy quinoa, fresh veggies, and a zesty chipotle vinaigrette that’s just irresistible. I loved it so much, I had to recreate it at home – and now you can too! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps.	[{"name": "honey", "quantity": "1/4", "unit": "cup", "category": "sweetener"}, {"name": "distilled white vinegar", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "Dijon mustard", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "pinch of salt", "quantity": "", "unit": "", "category": "spices"}, {"name": "paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "adobo chipotle paste", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "chili powder", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "neutral oil", "quantity": "1/2", "unit": "cup", "category": "fats"}, {"name": "water", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "cooked quinoa", "quantity": "8", "unit": "ounces", "category": "grains"}, {"name": "3 tablespoons avocado oil", "quantity": "2", "unit": "to", "category": "fats"}, {"name": "romaine lettuce, chopped", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "curly kale, massaged", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "Haas avocado, thinly sliced", "quantity": "1", "unit": "small", "category": "produce"}, {"name": "cherry tomatoes, chopped in half", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "black beans", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "thinly sliced red onions", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "roasted sweet corn", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "finely chopped cilantro", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "3 tablespoons cotija, crumbled", "quantity": "2", "unit": "to", "category": "produce"}]	["Step 1: In a blender or food processor, combine honey, distilled white vinegar, Dijon mustard, a pinch of salt, paprika, adobo chipotle paste, chili powder, neutral oil, and water.", "Step 2: Blend until the dressing is well emulsified.", "Step 3: Set the dressing aside.", "Step 4: Preheat your oven to 400\\u00b0F (205\\u00b0C).", "Step 5: Spread cooked quinoa on a baking sheet lined with parchment paper.", "Step 6: Drizzle avocado oil over the quinoa and toss to coat evenly.", "Step 7: Bake in the oven for 20-25 minutes, stirring halfway through, until the quinoa becomes golden and crispy. Keep an eye on it to prevent burning.", "Step 8: Once crispy, remove from the oven and let it cool.", "Step 9: In a large salad bowl, combine chopped romaine lettuce, chopped kale, diced avocados, diced tomatoes, drained and rinsed black beans, thinly sliced red onion, roasted corn, and chopped fresh cilantro.", "Step 10: Toss everything together until well mixed.", "Step 11: Once the quinoa has cooled, sprinkle it over the salad for a delightful crunch.", "Step 12: Drizzle the chipotle vinaigrette over the salad and toss to coat everything evenly.", "Step 13: Finish the salad by sprinkling crumbled cotija cheese on top.", "Step 14: Serve immediately and enjoy!."]	20	25	45	3	{"calories": 380, "protein": 12, "carbs": 34, "fat": 22, "fiber": 8}	easy	["quick", "meal-prep", "veg_side", "salad"]	["savory", "fresh"]	["vegetarian", "dairy-free", "gluten-free"]	american	["anti_inflammatory", "blood_sugar", "bone_health", "detox_support", "energy_boost", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	[]	["quinoa"]	f	https://moribyan.com/wp-content/uploads/2024/07/IMG_0144.jpg	2026-03-13 22:16:25.731566	veg_side	t	\N	["18b6eeaf-36a8-4dc1-bfee-b26bba3c5769", "131365e2-b77a-45bb-a6be-04a82c29cce3", "9e0e10bb-ba4d-41a8-bbe7-41167ef14a4e"]	\N	null	f	null
06ea19af-dd1a-48ff-b360-301fb5499cc9	Baked Ziti with Brown Rice Pasta	Let’s learn how to make BAKED ZITI, the perfect family dinner everyone will love! The creaminess of the ricotta, the crispy cheese layer on top, and the tangy but sweet pasta sauce turn this into the most memorable dish ever. It’s super easy to make and even prep ahead of time for those busy days. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 1 whole-food ingredient swap(s).	[{"name": "ziti brown rice + quinoa pasta", "quantity": "1", "unit": "pound", "category": "grains"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "90 10 ground beef", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "salt or to taste", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "finely minced garlic", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "Italian seasoning", "quantity": "1 1/2", "unit": "teaspoon", "category": "produce"}, {"name": "red pepper flakes", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "marinara sauce add 6 cups to make it extra saucy", "quantity": "5", "unit": "cups", "category": "produce"}, {"name": "heavy cream", "quantity": "1/2", "unit": "cup", "category": "dairy"}, {"name": "2 tablespoons chopped basil", "quantity": "1", "unit": "to", "category": "produce"}, {"name": "freshly grated parmesan", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "2 cups whole milk ricotta", "quantity": "1", "unit": "to", "category": "dairy"}, {"name": "freshly grated parmesan", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "3 cups shredded mozzarella", "quantity": "2", "unit": "to", "category": "produce"}]	["Step 1: Preheat oven to 375\\u00b0F.", "Step 2: To a large saucepan over medium-high heat, add the olive oil, ground beef, salt, black pepper, minced garlic, Italian seasoning, and red pepper flakes. As the meat browns, break it up with a wooden spoon, making sure to leave some big chunks too.", "Step 3: Once the meat is browned, add in the marinara sauce. Cover and let it simmer on low heat.", "Step 4: While the sauce simmers, bring a large pot of salted water to a boil. Add the pasta and make sure to cook about 2 minutes shy of al dente as the pasta will continue baking in the oven. Drain the pasta.", "Step 5: Uncover the sauce and add the heavy cream, chopped basil, and parmesan. Mix all together and combine with the cooked pasta.", "Step 6: To a large oven-safe casserole dish, add half of the pasta. Add dollops of ricotta on top. Then sprinkle the mozzarella and parmesan on top. Add the remaining pasta on top and add another layer of dollops of ricotta and cover with mozzarella and parmesan.", "Step 7: Transfer to the oven and bake for 20 minutes. Then turn the oven to broil just for a few minutes to crisp up the top. Make sure to watch it closely as it can burn very quickly! Take it out when it's golden and bubbly on top.", "Step 8: Enjoy warm!."]	45	20	65	2	{"calories": 520, "protein": 28, "carbs": 52, "fat": 22, "fiber": 4, "mes_score": 52.9, "mes_display_score": 52.9, "mes_tier": "low", "mes_display_tier": "low", "mes_sub_scores": {"gis": 35.5, "pas": 63.7, "fs": 42.5, "fas": 85.6}, "mes_score_with_default_pairing": 65.5, "mes_default_pairing_delta": 16.6, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 69.5, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	medium	["dinner", "sit-down"]	["savory", "umami"]	["gluten-free"]	italian	["anti_inflammatory", "energy_boost", "heart_health", "immune_support", "muscle_recovery"]	["beef"]	["noodles"]	f	https://moribyan.com/wp-content/uploads/2022/05/Baked-Ziti-2-scaled-1.jpg	2026-03-13 22:16:25.731567	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
3416542c-c4a7-4e6e-8116-a61b27e867bb	Banana Cake with Brown Butter Frosting	The most moist banana cake you’ll ever have and because it has bananas in it, it can even be breakfast! It’s finished off with a brown butter cream cheese frosting that makes this dessert irresistible! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 4 whole-food ingredient swap(s).	[{"name": "cassava flour", "quantity": "1 2/3", "unit": "cup", "category": "produce"}, {"name": "baking soda", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "baking powder", "quantity": "1/2", "unit": "teaspoon", "category": "produce"}, {"name": "salt", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "white monk fruit sweetener", "quantity": "2/3", "unit": "cup", "category": "sweetener"}, {"name": "light coconut sugar", "quantity": "1/3", "unit": "cup", "category": "sweetener"}, {"name": "unsalted butter, room temp", "quantity": "1/2", "unit": "cup", "category": "fats"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "smashed ripe banana", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "vanilla extract", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "whole milk", "quantity": "1", "unit": "cup", "category": "dairy"}, {"name": "cream cheese, room temperature", "quantity": "8", "unit": "oz", "category": "dairy"}, {"name": "unsalted butter, browned", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "monk fruit powdered sweetener", "quantity": "1 3/4", "unit": "cup", "category": "sweetener"}, {"name": "vanilla extract", "quantity": "1", "unit": "teaspoon", "category": "produce"}]	["Step 1: Preheat oven to 350\\u00b0F.", "Step 2: To a large mixing bowl, add the butter, light brown sugar, and white sugar. Use a mixer to beat the sugar and butter together until light and fluffy.", "Step 3: To the same bowl with the butter and sugar, add the eggs, smashed banana, vanilla, and milk. Whisk together again until smooth.", "Step 4: Now add all the dry ingredients to the wet. This includes all-purpose flour, baking soda, baking powder, and salt.", "Step 5: Combine together until you have a batter.", "Step 6: Line an 8 x 8 pan with parchment paper and transfer the batter.", "Step 7: Transfer to the oven and bake for 25 to 28 minutes until a toothpick comes out clean in the center.", "Step 8: Remove from the oven and allow to cool for about an hour before frosting.", "Step 9: Start by browning the butter.", "Step 10: To a pan over medium heat, add the butter. Cook for 5 to 6 minutes until it starts to bubble and then brown. Make sure not to cook it any further or it can burn. Transfer it to a bowl and allow it to cool so it's not hot. You can transfer it to the fridge for a few minutes until it sets solid at room temperature.", "Step 11: To a mixing bowl, add the browned butter, cream cheese, powdered sugar, and vanilla extract.", "Step 12: Beat for 1 to 2 minutes until fluffy and smooth.", "Step 13: Once the cake is cooled, add the frosting on top, adding as little or as much as you'd like.", "Step 14: Slice and enjoy!."]	90	30	120	12	{"calories": 380, "protein": 5, "carbs": 54, "fat": 16, "fiber": 2}	medium	["snack", "sit-down"]	["sweet"]	[]	american	["bone_health", "brain_health", "energy_boost", "muscle_recovery"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2023/12/IMG_9796-scaled.jpeg	2026-03-13 22:16:25.731567	dessert	f	\N	[]	\N	null	f	null
5a1c4008-e842-4264-9f79-7ecf732e32c1	Cottage Cheese Power Bowl with Turkey Bacon	A savory bowl of cottage cheese, turkey bacon, cucumber, tomatoes, hemp hearts, and pumpkin seeds.	[{"name": "low-fat cottage cheese", "quantity": "1.5", "unit": "cups", "category": "dairy"}, {"name": "turkey bacon", "quantity": "4", "unit": "slices", "category": "protein"}, {"name": "cucumber", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "cherry tomatoes", "quantity": "0.75", "unit": "cup", "category": "produce"}, {"name": "hemp hearts", "quantity": "1", "unit": "tbsp", "category": "seeds"}, {"name": "pumpkin seeds", "quantity": "1", "unit": "tbsp", "category": "seeds"}, {"name": "black pepper", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Cook turkey bacon until crisp and chop into bite-size pieces.", "Add cottage cheese to a bowl and top with cucumber, tomatoes, hemp hearts, and pumpkin seeds.", "Finish with turkey bacon and black pepper."]	7	6	13	1	{"calories": 430, "protein": 40, "carbs": 12, "fat": 20, "fiber": 6, "mes_score": 90.5, "mes_display_score": 90.5, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 99.5, "fs": 65.0, "fas": 84.0}}	easy	["breakfast", "quick"]	["savory"]	["gluten-free"]	american	["anti_inflammatory", "detox_support", "hormone_support", "skin_health"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.731574	full_meal	f	\N	[]	\N	null	t	null
dfc37c6b-0c6e-4d24-a7b7-e4cd72ec0ed7	Bang Bang Chicken Skewers	Bang Bang Chicken Skewers in the air fryer and in under 30 minutes! This easy and healthy dinner packs so much flavor from the creamy bang bang sauce that’s a bit spicy and a bit sweet. Serve it with rice and some steamed broccoli for the complete meal! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).	[{"name": "boneless skinless chicken thighs", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "low-sodium coconut aminos", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "oyster sauce", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "garlic paste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "ginger paste", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "chili powder", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "smoked paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "onion powder", "quantity": "3/4", "unit": "teaspoon", "category": "produce"}, {"name": "salt", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/4", "unit": "teaspoon", "category": "spices"}, {"name": "light coconut sugar", "quantity": "2", "unit": "tablespoons", "category": "sweetener"}, {"name": "mayonnaise", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "sweet chili sauce", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "minced garlic", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "rice vinegar", "quantity": "1", "unit": "tablespoon", "category": "grains"}, {"name": "sriracha, more to taste", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "fresh parsley, finely chopped", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "red pepper flakes, optional for more spice", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}]	["Step 1: Preheat the air fryer or oven to 450\\u00b0F.", "Step 2: In a small bowl, make the bang bang sauce. Combine mayonnaise, sweet chili sauce, garlic, rice vinegar, sriracha, and parsley until smooth. Set aside.", "Step 3: To a bowl, add the chopped chicken along with soy sauce, olive oil, oyster sauce, garlic, ginger, chili powder, smoked paprika, onion powder, salt, black pepper, and light brown sugar. Mix together and if you have the time, let it marinate for 30 minutes.", "Step 4: After marinating, thread the chicken pieces onto skewers. If using wooden skewers, make sure they have soaked in water for 30 minutes to prevent them from burning. I like to add about 6 to 7 pieces onto each skewer.", "Step 5: Add the skewers to the air fryer and air fry for about 13 to 15 minutes at 450\\u00b0F until fully cooked and charred.", "Step 6: Drizzle bang bang sauce on top and add green onions to enjoy."]	15	15	30	4	{"calories": 380, "protein": 32, "carbs": 18, "fat": 20, "fiber": 1, "mes_score": 67.4, "mes_display_score": 67.4, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 86.0, "pas": 75.6, "fs": 10.0, "fas": 84.0}, "mes_score_with_default_pairing": 80.8, "mes_default_pairing_delta": 17.4, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 84.8, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	easy	["dinner", "quick"]	["sweet", "spicy", "umami"]	["dairy-free", "gluten-free"]	chinese	["anti_inflammatory", "blood_sugar", "bone_health", "detox_support", "energy_boost", "gut_health", "heart_health", "immune_support", "muscle_recovery"]	["chicken"]	[]	f	https://moribyan.com/wp-content/uploads/2024/01/IMG_9898.jpg	2026-03-13 22:16:25.731568	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
25e84e4f-a93f-4dc0-b3c6-b2493a9360e7	Beef and Broccoli Stir-Fry	If you’re craving classic Chinese takeout, this beef and broccoli stir fry is about to become your new favorite. It’s everything you love about takeout — tender, melt-in-your-mouth steak paired with crisp broccoli — but made at home and even better. The sauce is perfectly balanced: savory with a touch of sweetness and just a hint of heat, clinging to every bite. Plus, it all comes together in one pan in under 30 minutes, making it a fantastic weeknight dinner when time is tight but you still want something special. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 4 whole-food ingredient swap(s).	[{"name": "flank, NY strip, or ribeye steak, thinly sliced against the grain", "quantity": "1", "unit": "pound", "category": "produce"}, {"name": "cornstarch", "quantity": "2", "unit": "tablespoons", "category": "produce"}, {"name": "dark coconut aminos", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "baking soda", "quantity": "1/2", "unit": "teaspoon", "category": "produce"}, {"name": "white pepper", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "salt", "quantity": "1/4", "unit": "teaspoon", "category": "spices"}, {"name": "broccoli florets", "quantity": "1", "unit": "pound", "category": "produce"}, {"name": "4 tablespoons neutral oil, as needed", "quantity": "3", "unit": "to", "category": "fats"}, {"name": "sesame oil", "quantity": "1", "unit": "teaspoon", "category": "fats"}, {"name": "minced garlic", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "ginger paste", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "low sodium beef broth", "quantity": "1/3", "unit": "cup", "category": "protein"}, {"name": "low sodium coconut aminos", "quantity": "2", "unit": "tablespoons", "category": "produce"}, {"name": "coconut sugar", "quantity": "1 1/2", "unit": "tablespoons", "category": "sweetener"}, {"name": "oyster sauce", "quantity": "1 1/2", "unit": "tablespoons", "category": "produce"}, {"name": "rice vinegar", "quantity": "1", "unit": "tablespoon", "category": "grains"}, {"name": "dark coconut aminos", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "cornstarch", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "white pepper", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "pinch of cayenne powder", "quantity": "", "unit": "", "category": "produce"}]	["Step 1: Marinate the steak: In a medium bowl, toss the sliced steak with cornstarch, dark soy sauce, baking soda, white pepper, and salt. Set aside.", "Step 2: Prepare the sauce: In another bowl or measuring cup, whisk beef broth, low sodium soy sauce, brown sugar, oyster sauce, rice vinegar, dark soy sauce, cornstarch, white pepper, and cayenne powder together until smooth. Set aside.", "Step 3: Cook the broccoli: Heat 1 tablespoon neutral oil in a large pan or wok over medium heat. Add broccoli and stir-fry briefly. Add a splash of water, cover, and steam for 2-3 minutes until broccoli is tender-crisp. Remove broccoli and set aside.", "Step 4: Cook the steak: Over medium-high heat, heat the wok or pan until it\\u2019s very hot, then add 1 1/2 to 2 tablespoons neutral oil. Add the marinated steak and stir-fry until just cooked through and seared, about 2-3 minutes. Remove and set aside.", "Step 5: Saut\\u00e9 aromatics: Lower the heat to medium-low. Add sesame oil and 1/2 tablespoon neutral oil to the pan. Add garlic and ginger, saut\\u00e9 gently until fragrant, about 30 seconds.", "Step 6: Combine: Return broccoli and steak to the pan. Pour in the sauce and toss everything together until the sauce thickens and coats evenly, about 1-2 minutes.", "Step 7: Serve hot with rice or noodles."]	10	20	30	4	{"calories": 380, "protein": 30, "carbs": 22, "fat": 18, "fiber": 4, "mes_score": 71.1, "mes_display_score": 71.1, "mes_tier": "good", "mes_display_tier": "good", "mes_sub_scores": {"gis": 84.0, "pas": 69.6, "fs": 42.5, "fas": 82.4}}	easy	["dinner", "quick"]	["savory", "umami"]	["dairy-free", "gluten-free"]	chinese	["anti_inflammatory", "blood_sugar", "detox_support", "gut_health", "heart_health", "hormone_support", "immune_support"]	["beef"]	[]	f	https://moribyan.com/wp-content/uploads/2025/08/IMG_1097.jpg	2026-03-13 22:16:25.731568	full_meal	f	\N	["18b6eeaf-36a8-4dc1-bfee-b26bba3c5769", "131365e2-b77a-45bb-a6be-04a82c29cce3", "9e0e10bb-ba4d-41a8-bbe7-41167ef14a4e"]	\N	null	t	null
05c621b2-c567-41d9-b440-ad6b4fd6f35b	Beef and Cheese Borek Rolls	Flavor-first recipe upgraded for clean whole-food eating. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 1 whole-food ingredient swap(s).	[{"name": "ground beef 85/15 or 90/10", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "minced garlic", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "paprika", "quantity": "2", "unit": "teaspoons", "category": "spices"}, {"name": "allspice", "quantity": "2", "unit": "teaspoons", "category": "spices"}, {"name": "coriander", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "salt or to taste", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "cumin", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "turmeric", "quantity": "1/2", "unit": "teaspoon", "category": "produce"}, {"name": "parsley finely chopped", "quantity": "2", "unit": "tablespoons", "category": "produce"}, {"name": "cilantro finely chopped", "quantity": "2", "unit": "tablespoons", "category": "produce"}, {"name": "roma tomatoes diced", "quantity": "2", "unit": "small", "category": "produce"}, {"name": "2 cups crumbled ackawi cheese more or less to taste", "quantity": "1", "unit": "to", "category": "dairy"}, {"name": "2 cups shredded mozzarella more or less to taste", "quantity": "1", "unit": "to", "category": "produce"}, {"name": "50 egg roll wrappers", "quantity": "40", "unit": "to", "category": "protein"}, {"name": "extra virgin olive oil for frying", "quantity": "", "unit": "", "category": "fats"}, {"name": "optional: avocado oil spray for air frying", "quantity": "", "unit": "", "category": "fats"}]	["Step 1: Heat a pan over medium heat and add olive oil and garlic. Sauce for a minute.", "Step 2: Add ground beef along with paprika, allspice, coriander, salt, cumin, black pepper, and turmeric.", "Step 3: Start to break up the ground beef with a spatula or wooden spoon.", "Step 4: Once the meat is browned and minced finely, turn off the heat and add parsley, cilantro, and chopped tomatoes. Mix and transfer to a bowl to cool to room temperature.", "Step 5: When the ground beef is at room temperature, add the ackawi cheese and mozzarella. Mix.", "Step 6: Grab an egg roll wrapper. Add about 2 tablespoons of filling along one edge.", "Step 7: Fold the left and right side in toward the center first and then roll until you get almost to the end. Brush the end with water and finish the last roll to seal tightly.", "Step 8: TO PAN FRY: Heat oil for frying in a pan. Drop the egg rolls in and don't overcrowd. Once golden brown on one side, about 2 to 3 minutes, flip over and allow the other side to get golden brown. Transfer to a plate lined with a paper towel to drain any excess oil.", "Step 9: TO AIR FRY: Set the air fryer to 375\\u00b0F. Spray the basket and egg rolls with avocado oil or vegetable oil spray. Cook for 5 to 6 minutes, then flip over and cook another 5 to 6 minutes or until golden and crispy all around.", "Step 10: Enjoy warm with your favorite dipping sauce!."]	1	25	26	2	{"calories": 420, "protein": 24, "carbs": 28, "fat": 24, "fiber": 2, "mes_score": 57.1, "mes_display_score": 57.1, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 70.0, "pas": 51.7, "fs": 20.0, "fas": 87.2}, "mes_score_with_default_pairing": 70.5, "mes_default_pairing_delta": 17.3, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 74.4, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	medium	["dinner", "sit-down"]	["savory", "umami"]	["gluten-free"]	middle_eastern	["anti_inflammatory", "blood_sugar", "brain_health", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["beef", "eggs"]	[]	f	https://moribyan.com/wp-content/uploads/2022/05/IMG_6726-scaled-1.jpg	2026-03-13 22:16:25.731569	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
8d5e91fc-7202-4dae-b4e2-0b19e6db2205	Beef and Lamb Sausage Rolls	Sausage rolls are a staple in the UK — something you’ll see in bakeries, cafés, grocery stores, and even train stations — and they’re popular for a reason. Flaky pastry wrapped around a savory filling is hard to beat, but I’ve always wanted to make my own version at home. The meat filling in this recipe is inspired by Bosnian ćevapi, using a beef-and-lamb mixture that stays incredibly juicy and tender inside crisp, golden puff pastry. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps.	[{"name": "ground beef", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "ground lamb", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "minced garlic", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "\\u00bd yellow onion, pur\\u00e9ed", "quantity": "", "unit": "", "category": "produce"}, {"name": "smoked paprika", "quantity": "2", "unit": "teaspoons", "category": "spices"}, {"name": "salt", "quantity": "2", "unit": "teaspoons", "category": "spices"}, {"name": "baking soda", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "black pepper", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "Dash of cayenne powder", "quantity": "", "unit": "", "category": "produce"}, {"name": "egg", "quantity": "1", "unit": "large", "category": "protein"}, {"name": "puff pastry, thawed", "quantity": "2", "unit": "sheets", "category": "produce"}, {"name": "egg", "quantity": "1", "unit": "large", "category": "protein"}, {"name": "heavy cream", "quantity": "1", "unit": "tablespoon", "category": "dairy"}]	["Step 1: Make the filling: In a large bowl, combine the ground beef, ground lamb, garlic, pur\\u00e9ed onion, smoked paprika, salt, baking soda, black pepper, cayenne, and egg. Mix until fully combined and smooth, without overmixing.", "Step 2: Prep the pastry: Lightly flour a work surface and roll out each puff pastry sheet just enough to smooth it out. Cut each sheet in half lengthwise to create four long rectangles.", "Step 3: Egg wash the pastry: Whisk together the egg and heavy cream. Brush egg wash along both long sides of each puff pastry rectangle.", "Step 4: Pipe the filling: Transfer the sausage mixture to a piping bag (or zip-top bag with the corner cut). Pipe a thick strip of filling slightly off-center, closer to one long edge, leaving enough pastry to fold over.", "Step 5: Fold, trim, and seal: Fold the pastry over the filling and press down right where the meat ends. A little excess pastry is fine, but if there\\u2019s too much overlap, trim some off so it doesn\\u2019t get doughy. Use a fork to press and seal the edge tightly.", "Step 6: Slice and finish: Cut each long strip into 1\\u00bd- to 2-inch pieces. Arrange on a parchment-lined baking sheet. Brush the tops with more egg wash and make 2 slits on the top of each one, not cutting all the way down but just to let some steam out as they cook. Then sprinkle the tops with sesame seeds.", "Step 7: Bake: Bake at 375\\u00b0F for 25 to 30 minutes, until the pastry is deeply golden and puffed and the filling is cooked through.", "Step 8: Cool and serve: Let cool slightly before serving."]	25	25	60	30	{"calories": 440, "protein": 26, "carbs": 22, "fat": 28, "fiber": 2, "mes_score": 62.9, "mes_display_score": 62.9, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 80.0, "pas": 57.7, "fs": 20.0, "fas": 90.4}, "mes_score_with_default_pairing": 75.9, "mes_default_pairing_delta": 16.9, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 79.8, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	medium	["dinner", "sit-down"]	["savory", "spicy"]	["gluten-free"]	middle_eastern	["anti_inflammatory", "brain_health", "energy_boost", "heart_health", "immune_support", "muscle_recovery"]	["beef", "eggs", "lamb"]	[]	f	https://moribyan.com/wp-content/uploads/2026/02/IMG_0286.jpg	2026-03-13 22:16:25.731569	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
331d6f6b-1128-466d-9f6d-1de9081b3794	Beef Chorizo and Chicken Pasta	Creamy pasta with beef chorizo AND chicken – double the protein, double the flavor! The best way to describe this pasta is flavorful. The beef chorizo adds so much spice to the sauce so you don’t even need to add much to the pasta for it to be the best you’ve ever had! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 1 whole-food ingredient swap(s).	[{"name": "chicken breast", "quantity": "1", "unit": "pound", "category": "protein"}, {"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "salt", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "paprika", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "garlic powder", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "black pepper", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "coriander", "quantity": "1/2", "unit": "teaspoon", "category": "produce"}, {"name": "oregano", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "unsalted butter", "quantity": "2", "unit": "tablespoons", "category": "fats"}, {"name": "minced garlic", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "tomato paste", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "heavy cream", "quantity": "2", "unit": "cups", "category": "dairy"}, {"name": "cream cheese", "quantity": "2", "unit": "tablespoons", "category": "dairy"}, {"name": "chili powder", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "dried basil", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "freshly grated parmesan, more to taste", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "rigatoni brown rice + quinoa pasta or penne", "quantity": "16", "unit": "ounces", "category": "grains"}, {"name": "beef chorizo", "quantity": "12", "unit": "ounces", "category": "protein"}, {"name": "2 tablespoons chopped parsley", "quantity": "1", "unit": "to", "category": "produce"}]	["Step 1: In a bowl, add the chicken, olive oil, salt, paprika, garlic powder, black pepper, cumin, coriander, and oregano. Mix to marinade evenly.", "Step 2: Heat an oiled skillet or pan over medium-high heat.", "Step 3: Add the marinated chicken to the pan and cook on each side until golden brown, about 3 minutes on each side. Then drop the heat to low and allow the chicken to cook through to the center or the temperature registers 165\\u00b0F. Remove the chicken from the pan.", "Step 4: Allow the chicken to cool for 5 to 10 minutes and then chop into small pieces. Set aside.", "Step 5: Cook pasta according to package directions in salted water.", "Step 6: Drain the pasta after cooked.", "Step 7: In a saucepan over medium heat, add the beef chorizo. Cook for 6 to 7 minutes until browned. Transfer the chorizo to a plate, leaving a bit of the oil in the pan.", "Step 8: In the same pan the chorizo was cooked in, melt down the butter and cook the garlic and tomato paste for 1 to 2 minutes.", "Step 9: Then add the heavy cream, cream cheese, chili powder, dried basil, parmesan, and the cooked chorizo. Whisk together and bring to a simmer for a few minutes to thicken.", "Step 10: Once it thickens, take off the heat and add back the pasta and parsley.", "Step 11: Mix together to combine and then enjoy!."]	10	35	45	6	{"calories": 560, "protein": 34, "carbs": 48, "fat": 24, "fiber": 3, "mes_score": 57.8, "mes_display_score": 57.8, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 40.0, "pas": 81.6, "fs": 31.2, "fas": 87.2}, "mes_score_with_default_pairing": 69.0, "mes_default_pairing_delta": 15.2, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 73.0, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	medium	["dinner", "sit-down"]	["savory", "spicy"]	["gluten-free"]	mexican	["anti_inflammatory", "blood_sugar", "bone_health", "energy_boost", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["beef", "chicken"]	["noodles"]	f	https://moribyan.com/wp-content/uploads/2023/03/IMG_0812-1.jpg	2026-03-13 22:16:25.731569	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
131365e2-b77a-45bb-a6be-04a82c29cce3	Black Bean and Corn Salad	Protein-packed black beans with sweet corn, cilantro, and lime — a fiber-rich Tex-Mex side.	[{"name": "black beans", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "corn kernels", "quantity": "0.5", "unit": "cup", "category": "produce"}, {"name": "red bell pepper", "quantity": "0.5", "unit": "", "category": "produce"}, {"name": "cilantro", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "lime juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Drain and rinse black beans. Dice bell pepper.", "Step 2: Toss all ingredients together. Chill 10 minutes before serving."]	8	0	8	2	{"calories": 165, "protein": 9.0, "carbs": 26.0, "fat": 3.0, "fiber": 9.0, "sugar": 3.0, "sodium_mg": 200}	easy	["side", "quick", "veg_side", "salad", "whole-food"]	["tangy", "savory"]	["vegetarian", "dairy-free", "gluten-free"]	mexican	["High fiber", "Plant protein", "Rich in folate"]	["vegetarian"]	[]	t	\N	2026-03-13 22:16:25.73157	veg_side	t	\N	[]	\N	null	f	{"acid": true, "fiber_class": "high", "healthy_fat": true, "veg_density": "high", "recommended_timing": "with_meal"}
4681fbb5-9c7e-4760-baf5-01e3c20781e6	Brown Rice	Meal-prep carb component using fluffy brown rice.	[{"name": "brown rice", "quantity": "1/2", "unit": "cup uncooked", "category": "grains"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "sea salt", "quantity": "pinch", "unit": "", "category": "spices"}]	["Rinse the brown rice well.", "Cook with water or broth and a pinch of salt until tender.", "Fluff and portion for meal prep."]	5	25	30	2	{"calories": 165, "protein": 3.5, "carbs": 34.0, "fat": 1.2, "fiber": 2.6, "sugar": 0.4}	easy	["meal-prep", "whole-food", "carb_base", "carb_component", "red_pepper_bowl_group_v1"]	["neutral"]	["gluten-free", "dairy-free", "vegan"]	global	["energy_boost"]	[]	["rice"]	f	\N	2026-03-13 22:16:25.73157	carb_base	t	\N	[]	\N	null	f	null
552b46b7-fd6d-472d-9a8f-582c3a7f20ec	Butter Chicken	Indian meal-prep protein component (high-protein butter chicken base).	[{"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "frozen peas", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "garam masala", "quantity": "1", "unit": "tbsp", "category": "spices"}, {"name": "paprika", "quantity": "1", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "black pepper", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "minced garlic", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "ginger paste", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "tomato sauce or crushed tomatoes", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "fat free greek yogurt", "quantity": "1/4", "unit": "cup", "category": "dairy"}, {"name": "fat free sour cream", "quantity": "1/4", "unit": "cup", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "2", "unit": "tsp", "category": "fats"}]	["Cut chicken into 1-2 inch cubes. Add to a bowl with olive oil, onions, frozen peas, garam masala, salt, pepper, chili powder, paprika, and turmeric; mix well.", "Cook in a hot pan for about 5 minutes or until the vegetables soften and chicken is almost cooked through.", "Add greek yogurt, sour cream, and crushed tomatoes. Bring to a gentle boil, then simmer 4-5 minutes until sauce thickens and chicken is fully cooked."]	10	20	30	2	{"calories": 260, "protein": 34, "carbs": 10, "fat": 8, "fiber": 2.5, "sugar": 3.5}	easy	["meal-prep", "whole-food", "butter_chicken_group_v1", "protein_base", "protein_component"]	["savory", "spicy", "umami"]	["gluten-free"]	indian	["anti_inflammatory", "bone_health", "energy_boost", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.73157	protein_base	t	\N	[]	\N	null	f	null
e64ffc8e-4f44-4aa5-89de-e2bef06a218c	Butter Chicken Bowl	Butter Chicken Bowl with chicken thighs, 2/3 cup cooked white rice, and 1.5 servings kachumber salad.	[{"name": "chicken thighs", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "frozen peas", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "garam masala", "quantity": "1", "unit": "tbsp", "category": "spices"}, {"name": "paprika", "quantity": "1", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "minced garlic", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "ginger paste", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "crushed tomatoes", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "fat free greek yogurt", "quantity": "1/4", "unit": "cup", "category": "dairy"}, {"name": "fat free sour cream", "quantity": "1/4", "unit": "cup", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "2", "unit": "tsp", "category": "fats"}, {"name": "white basmati rice", "quantity": "2/3", "unit": "cup cooked", "category": "grains"}, {"name": "cucumber, diced", "quantity": "1.5", "unit": "cups", "category": "produce"}, {"name": "tomatoes, diced", "quantity": "1.5", "unit": "cups", "category": "produce"}, {"name": "red onion, finely chopped", "quantity": "3/8", "unit": "cup", "category": "produce"}, {"name": "fresh cilantro", "quantity": "3", "unit": "tbsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1.5", "unit": "tbsp", "category": "produce"}]	["Butter Chicken: Cook chicken thighs with onion, peas, garlic, ginger, and spices. Add crushed tomatoes, Greek yogurt, and sour cream; simmer until thick and fully cooked.", "Rice: Prepare or warm 2/3 cup cooked white basmati rice.", "Kachumber Salad: Mix cucumber, tomatoes, red onion, cilantro, and lemon juice for a 1.5-serving salad.", "Assembly: Add rice to the bowl, top with butter chicken, and finish with the larger kachumber side."]	10	20	30	2	{"calories": 420.0, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6, "mes_score": 78.9, "mes_display_score": 78.9, "mes_tier": "good", "mes_display_tier": "good", "mes_sub_scores": {"gis": 68.0, "pas": 93.5, "fs": 82.5, "fas": 70.0}, "mes_score_with_default_pairing": 78.3, "mes_default_pairing_delta": 3.0, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 6.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "vegetable-forward side", "eat before meal"], "mes_default_pairing_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "mes_default_pairing_title": "Kachumber Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 81.9, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "vegetable-forward side", "eat before meal"]}	easy	["dinner", "sit-down", "whole-food", "butter_chicken_group_v1"]	["savory", "spicy", "umami", "fresh"]	["gluten-free"]	indian	["anti_inflammatory", "bone_health", "detox_support", "energy_boost", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	["rice"]	f	\N	2026-03-13 22:16:25.731571	full_meal	f	\N	["f5d803ea-14ef-4bf5-9f6b-737e67c3ade6"]	t	null	t	null
5713b88b-a4c3-4761-b602-d984b046792e	Garlic Yogurt Sauce	Meal prep sauce component for shawarma pairings.	[{"name": "fat free greek yogurt", "quantity": "1/2", "unit": "cup", "category": "dairy"}, {"name": "minced garlic", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Whisk yogurt, garlic, lemon juice, and salt until smooth.", "Chill before serving."]	5	0	5	8	{"calories": 28, "protein": 2.5, "carbs": 2, "fat": 0.2, "fiber": 0, "sugar": 1.2}	easy	["meal-prep", "whole-food", "shawarma_group_v1", "sauce"]	["tangy", "savory"]	["gluten-free", "vegetarian"]	middle_eastern	["bone_health", "detox_support", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	[]	[]	f	\N	2026-03-13 22:16:25.731577	sauce	t	\N	null	\N	null	f	null
f2e2813f-ebaf-4cd5-a2dc-28a9925df80b	Butter Chicken Bowl Plus	Composed bowl using prep components: 2 servings butter chicken thighs, 4/3 cups cooked white rice, and 3 servings kachumber salad across 2 total servings.	[{"name": "butter chicken thighs", "quantity": "2", "unit": "servings", "category": "protein"}, {"name": "white rice", "quantity": "4/3", "unit": "cups cooked", "category": "grains"}, {"name": "kachumber salad", "quantity": "3", "unit": "servings", "category": "produce"}]	["Protein Component: Add 2 servings of Butter Chicken Thighs meal-prep component.", "Carb Component: Add 4/3 cups cooked White Rice meal-prep component (2/3 cup per serving).", "Veggie Component: Add 3 servings of Kachumber Salad meal-prep component (1.5 servings per serving).", "Assembly: Divide into 2 bowls and serve."]	5	10	15	2	{"calories": 420.0, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6, "mes_score": 78.9, "mes_display_score": 78.9, "mes_tier": "good", "mes_display_tier": "good", "mes_sub_scores": {"gis": 68.0, "pas": 93.5, "fs": 82.5, "fas": 70.0}, "mes_score_with_default_pairing": 78.3, "mes_default_pairing_delta": 3.0, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 6.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "vegetable-forward side", "eat before meal"], "mes_default_pairing_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "mes_default_pairing_title": "Kachumber Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 81.9, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "vegetable-forward side", "eat before meal"]}	easy	["dinner", "sit-down", "whole-food", "butter_chicken_group_v2"]	["savory", "spicy", "umami", "fresh"]	["gluten-free"]	indian	["muscle_recovery"]	["chicken"]	["rice"]	f	\N	2026-03-13 22:16:25.731571	full_meal	f	\N	["f5d803ea-14ef-4bf5-9f6b-737e67c3ade6"]	t	{"protein_component_title": "Butter Chicken Thighs", "carb_component_title": "White Rice", "veg_component_title": "Kachumber Salad", "protein_servings_total": 2, "rice_cups_total": "4/3", "salad_servings_total": 3, "meal_servings_total": 2}	t	null
061ab365-7eb4-4195-8940-b402f190e042	Butter Chicken Thighs	Meal-prep protein component for butter chicken bowls.	[{"name": "chicken thighs", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "frozen peas", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "garam masala", "quantity": "1", "unit": "tbsp", "category": "spices"}, {"name": "paprika", "quantity": "1", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "minced garlic", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "ginger paste", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "crushed tomatoes", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "fat free greek yogurt", "quantity": "1/4", "unit": "cup", "category": "dairy"}, {"name": "fat free sour cream", "quantity": "1/4", "unit": "cup", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "2", "unit": "tsp", "category": "fats"}]	["Marinate chicken thighs with garlic, ginger, garam masala, paprika, chili powder, salt, and pepper.", "Sear chicken with sliced onion and peas until chicken is nearly cooked through.", "Add crushed tomatoes, Greek yogurt, and sour cream, then simmer until the sauce thickens and chicken is fully cooked.", "Portion into 2 meal-prep servings."]	10	20	30	2	{"calories": 300, "protein": 33.0, "carbs": 10.0, "fat": 15.0, "fiber": 2.5, "sugar": 3.5}	easy	["meal-prep", "whole-food", "protein_base", "protein_component", "butter_chicken_group_v2"]	["savory", "spicy", "umami"]	["gluten-free"]	indian	["anti_inflammatory", "bone_health", "energy_boost", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.731571	protein_base	t	\N	[]	\N	null	f	null
cb558ac2-8ddf-430f-9b9c-e458ccc7623c	Cassava Flour Beignets	Transport yourself to the magical streets of New Orleans with these fluffy pillow-like Beignets! Inspired by The Princess and the Frog movie and my own trip to Cafe du Monde, these beignets packed with a mountain top of powdered sugar will leave you speechless with every bite. Not to mention, they’re shockingly so easy to make from scratch! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 4 whole-food ingredient swap(s).	[{"name": "cassava flour", "quantity": "4", "unit": "cups", "category": "produce"}, {"name": "whole milk, warm", "quantity": "1 1/4", "unit": "cup", "category": "dairy"}, {"name": "active dry yeast", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "granulated monk fruit sweetener", "quantity": "1/2", "unit": "cup", "category": "sweetener"}, {"name": "salt", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "eggs, room temperature", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "unsalted butter, softened", "quantity": "6", "unit": "tablespoons", "category": "fats"}, {"name": "vanilla extract", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "extra virgin olive oil, for frying", "quantity": "", "unit": "", "category": "fats"}, {"name": "monk fruit powdered sweetener, for dusting", "quantity": "1", "unit": "cup", "category": "sweetener"}]	["Step 1: In a large mixing bowl, combine the warm milk and active dry yeast. Whisk together until the yeast is dissolved. Allow it to sit for about 5-10 minutes until it becomes frothy.", "Step 2: To the yeast mixture, add the granulated white sugar, salt, eggs, softened unsalted butter, and vanilla extract. Mix well until all the ingredients are combined.", "Step 3: Gradually add the all-purpose flour to the mixture, stirring continuously until a dough forms. It will be very soft and a bit sticky.", "Step 4: Knead the dough for about 3 to 4 minutes until it becomes smooth and elastic. You can use your hand, a wooden spatula, or a stand mixer with the hook attachment.", "Step 5: Place the kneaded dough into a lightly greased bowl, cover it with plastic wrap and a clean kitchen towel, and let it rise in a warm place for about 1 to 1 1/2 hours, or until it doubles in size.", "Step 6: Once the dough has risen, punch it down to release the air. Transfer it to a clean and floured surface.", "Step 7: Roll out the dough to about 1/2 inch thickness into a large square. Use a pizza cutter to cut squares about the size of 2.5 by 2.5 inches.", "Step 8: Cover them with a clean kitchen towel and let them rise again but this time only for about 15 to 20 minutes, just while the oil heats up.", "Step 9: In a deep pot or fryer pan, heat vegetable oil to 350\\u00b0F (175\\u00b0C).", "Step 10: Carefully add a few donuts to the hot oil, making sure not to overcrowd the pot. Fry for about 1-2 minutes on each side, or until they turn golden brown.", "Step 11: Once fried, remove the donuts from the oil using a slotted spoon and place them on a wire rack to drain any excess oil.", "Step 12: Repeat the frying process with the remaining donuts.", "Step 13: Once all the donuts are fried and cooled slightly, dust them very generously with powdered sugar to enjoy warm."]	60	20	120	20	{"calories": 300, "protein": 4, "carbs": 40, "fat": 14, "fiber": 1}	medium	["snack", "sit-down"]	["sweet"]	[]	french	["anti_inflammatory", "brain_health", "heart_health", "muscle_recovery"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2024/04/IMG_0036.jpg	2026-03-13 22:16:25.731572	dessert	f	\N	[]	\N	null	f	null
881a6ebb-d48f-4839-86bd-163a52e43677	Charred Zucchini with Herbs	Pan-charred zucchini with fresh herbs and a splash of balsamic — summer in a side dish.	[{"name": "zucchini", "quantity": "2", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "fresh basil", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "balsamic vinegar", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Slice zucchini into half-moons. Heat olive oil in skillet over high heat.", "Step 2: Cook zucchini 3-4 minutes per side until charred. Top with basil and balsamic."]	5	8	13	2	{"calories": 70, "protein": 2.0, "carbs": 6.0, "fat": 5.0, "fiber": 2.5, "sugar": 3.0, "sodium_mg": 130}	easy	["side", "quick", "veg_side", "whole-food"]	["savory", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	mediterranean	["Low calorie", "Rich in vitamin C", "Good potassium"]	[]	[]	t	\N	2026-03-13 22:16:25.731572	veg_side	t	\N	[]	\N	null	f	null
7f708980-7e30-4168-b036-e91848bf0fd3	Chicken Sausage Kale Scramble	Chicken sausage scrambled with eggs, kale, mushrooms, and feta for a low-carb breakfast.	[{"name": "chicken sausage", "quantity": "2", "unit": "links", "category": "protein"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "lacinato kale", "quantity": "1.5", "unit": "cups", "category": "produce"}, {"name": "mushrooms", "quantity": "0.75", "unit": "cup", "category": "produce"}, {"name": "feta cheese", "quantity": "1", "unit": "oz", "category": "dairy"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}]	["Slice the chicken sausage and brown it in olive oil.", "Add mushrooms and kale and cook until tender.", "Pour in eggs and egg whites, scramble until just set, and finish with feta."]	8	10	18	1	{"calories": 470, "protein": 43, "carbs": 11, "fat": 28, "fiber": 7, "mes_score": 92.8, "mes_display_score": 92.8, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 100.0, "fs": 71.2, "fas": 90.4}}	easy	["breakfast", "quick"]	["savory"]	["gluten-free"]	american	["anti_inflammatory", "bone_health", "brain_health", "detox_support", "heart_health", "immune_support", "muscle_recovery"]	["chicken", "eggs"]	[]	f	\N	2026-03-13 22:16:25.731572	full_meal	f	\N	[]	\N	null	t	null
306305ee-6a5a-4b6e-ae31-30a546530abe	Chicken Shawarma Bowl	Chicken shawarma bowl with 2/3 cup white basmati rice and kachumber salad.	[{"name": "chicken thighs", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cinnamon", "quantity": "pinch", "unit": "", "category": "spices"}, {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "white basmati rice", "quantity": "2/3", "unit": "cup cooked", "category": "grains"}, {"name": "cucumber, chopped", "quantity": "3/4", "unit": "cup", "category": "produce"}, {"name": "tomatoes, chopped", "quantity": "3/4", "unit": "cup", "category": "produce"}, {"name": "red onion, finely chopped", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "fresh cilantro, chopped", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "pinch", "unit": "", "category": "spices"}]	["Shawarma Chicken Thighs (Protein): Use 1 serving of Shawarma Chicken Thighs meal-prep component.", "White Rice (Carb): Add 2/3 cup cooked White Rice meal-prep component.", "Kachumber Salad (Veggie): Add 1.5 servings of Kachumber Salad meal-prep component.", "Assembly: Build the bowl with rice at the base, top with shawarma chicken thighs, and finish with kachumber salad."]	10	20	30	2	{"calories": 420, "protein": 38.0, "carbs": 36.0, "fat": 13.0, "fiber": 8.8, "sugar": 5.6, "mes_score": 78.9, "mes_display_score": 78.9, "mes_tier": "good", "mes_display_tier": "good", "mes_sub_scores": {"gis": 68.0, "pas": 93.5, "fs": 82.5, "fas": 70.0}, "mes_score_with_default_pairing": 78.3, "mes_default_pairing_delta": 3.0, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 6.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "vegetable-forward side", "eat before meal"], "mes_default_pairing_id": "f5d803ea-14ef-4bf5-9f6b-737e67c3ade6", "mes_default_pairing_title": "Kachumber Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 81.9, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "vegetable-forward side", "eat before meal"]}	easy	["shawarma_group_v2", "dinner", "sit-down", "whole-food"]	["savory", "spicy", "umami", "fresh"]	["gluten-free"]	middle_eastern	["anti_inflammatory", "blood_sugar", "detox_support", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	["rice"]	f	\N	2026-03-13 22:16:25.731573	full_meal	f	\N	["f5d803ea-14ef-4bf5-9f6b-737e67c3ade6"]	t	{"protein_component_title": "Shawarma Chicken Thighs", "carb_component_title": "White Rice", "veg_component_title": "Kachumber Salad", "rice_portion": "2/3 cup cooked", "salad_servings": 1.5}	t	null
491d40e4-c9b8-4930-a1d5-e5361258c91f	Chicken Shawarma Plate	Chicken shawarma plate with rice and garlic yogurt sauce, based on the provided recipe card.	[{"name": "brown rice (washed, uncooked)", "quantity": "1/2", "unit": "cup", "category": "grains"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "turmeric", "quantity": "1/4", "unit": "tsp", "category": "spices"}, {"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "black pepper", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cinnamon", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "fat free greek yogurt", "quantity": "1/2", "unit": "cup", "category": "dairy"}, {"name": "minced garlic", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "cucumber, chopped", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "tomatoes, chopped", "quantity": "1/2", "unit": "cup", "category": "produce"}]	["In a pot, add rice and water (or broth). Bring to a boil, then add salt and turmeric. Cover and simmer on low heat for 25 minutes or until liquid is absorbed.", "Meanwhile, cut chicken breast into 2-inch chunks. Add to a bowl with onions, olive oil, salt, pepper, cumin, paprika, and a touch of cinnamon. Mix well.", "In a hot pan, add chicken and onions. Cook 3\\u20134 minutes per side or until chicken is fully cooked and onions are soft and lightly charred.", "In a bowl, combine all garlic yogurt sauce ingredients. Serve over rice and chicken shawarma."]	10	30	40	2	{"calories": 399, "protein": 40, "carbs": 45, "fat": 5.5, "fiber": 6.7, "sugar": 5, "mes_score": 66.1, "mes_display_score": 66.1, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 50.1, "pas": 99.5, "fs": 69.4, "fas": 32.5}}	easy	["dinner", "sit-down", "whole-food", "shawarma_group_v1"]	["savory", "spicy", "umami"]	["gluten-free"]	middle_eastern	["anti_inflammatory", "blood_sugar", "bone_health", "brain_health", "detox_support", "energy_boost", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.731573	full_meal	f	\N	[]	\N	null	t	null
0b0ad124-6d44-4936-b2eb-921f57e9b939	Chocolate Chip Cookies	Flavor-forward meal reworked for clean whole-food cooking. Built with smarter whole-food swaps while keeping the original flavor profile.	[{"name": "{\\"@context\\":\\"https://schema.org\\",\\"@graph\\":[{\\"@type\\":\\"Article\\",\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#article\\",\\"isPartOf\\":{\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/\\"},\\"author\\":{\\"name\\":\\"adm_moribyan\\",\\"@id\\":\\"https://moribyan.com/#/schema/person/85a5774bbb450cfd31123df14708ad3f\\"},\\"headline\\":\\"Chocolate Chip Cookies\\",\\"datePublished\\":\\"2021-12-22T12:30:00+00:00\\",\\"dateModified\\":\\"2022-05-13T18:55:18+00:00\\",\\"mainEntityOfPage\\":{\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/\\"},\\"wordCount\\":576,\\"commentCount\\":229,\\"publisher\\":{\\"@id\\":\\"https://moribyan.com/#organization\\"},\\"image\\":{\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#primaryimage\\"},\\"thumbnailUrl\\":\\"https://moribyan.com/wp-content/uploads/2022/05/Chocolate-Chip-Cookies-4-scaled-1.jpg\\",\\"keywords\\":[\\"chocolate\\",\\"cookies\\"],\\"articleSection\\":[\\"Recipes\\"],\\"inLanguage\\":\\"en-US\\",\\"potentialAction\\":[{\\"@type\\":\\"CommentAction\\",\\"name\\":\\"Comment\\",\\"target\\":[\\"https://moribyan.com/chocolate-chip-cookies/#respond\\"]}]},{\\"@type\\":\\"WebPage\\",\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/\\",\\"url\\":\\"https://moribyan.com/chocolate-chip-cookies/\\",\\"name\\":\\"Chocolate Chip Cookies | Moribyan\\",\\"isPartOf\\":{\\"@id\\":\\"https://moribyan.com/#website\\"},\\"primaryImageOfPage\\":{\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#primaryimage\\"},\\"image\\":{\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#primaryimage\\"},\\"thumbnailUrl\\":\\"https://moribyan.com/wp-content/uploads/2022/05/Chocolate-Chip-Cookies-4-scaled-1.jpg\\",\\"datePublished\\":\\"2021-12-22T12:30:00+00:00\\",\\"dateModified\\":\\"2022-05-13T18:55:18+00:00\\",\\"description\\":\\"Chocolate Chip Cookies , Let\\u2019s learn how to make the best brown butter chocolate chip AND chunk cookies! They\\u2019re super chewy and perfectly crispy on the outside, everything you\\",\\"breadcrumb\\":{\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#breadcrumb\\"},\\"inLanguage\\":\\"en-US\\",\\"potentialAction\\":[{\\"@type\\":\\"ReadAction\\",\\"target\\":[\\"https://moribyan.com/chocolate-chip-cookies/\\"]}]},{\\"@type\\":\\"ImageObject\\",\\"inLanguage\\":\\"en-US\\",\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#primaryimage\\",\\"url\\":\\"https://moribyan.com/wp-content/uploads/2022/05/Chocolate-Chip-Cookies-4-scaled-1.jpg\\",\\"contentUrl\\":\\"https://moribyan.com/wp-content/uploads/2022/05/Chocolate-Chip-Cookies-4-scaled-1.jpg\\",\\"width\\":1500,\\"height\\":2250},{\\"@type\\":\\"BreadcrumbList\\",\\"@id\\":\\"https://moribyan.com/chocolate-chip-cookies/#breadcrumb\\",\\"itemListElement\\":[{\\"@type\\":\\"ListItem\\",\\"position\\":1,\\"name\\":\\"Home\\",\\"item\\":\\"https://moribyan.com/\\"},{\\"@type\\":\\"ListItem\\",\\"position\\":2,\\"name\\":\\"Lifestyle\\",\\"item\\":\\"https://moribyan.com/lifestyle/\\"},{\\"@type\\":\\"ListItem\\",\\"position\\":3,\\"name\\":\\"Chocolate Chip Cookies\\"}]},{\\"@type\\":\\"WebSite\\",\\"@id\\":\\"https://moribyan.com/#website\\",\\"url\\":\\"https://moribyan.com/\\",\\"name\\":\\"Moribyan\\",\\"description\\":\\"Delicious Recipes \\"at home and even better\\"\\",\\"publisher\\":{\\"@id\\":\\"https://moribyan.com/#organization\\"},\\"potentialAction\\":[{\\"@type\\":\\"SearchAction\\",\\"target\\":{\\"@type\\":\\"EntryPoint\\",\\"urlTemplate\\":\\"https://moribyan.com/?s={search_term_string}\\"},\\"query-input\\":{\\"@type\\":\\"PropertyValueSpecification\\",\\"valueRequired\\":true,\\"valueName\\":\\"search_term_string\\"}}],\\"inLanguage\\":\\"en-US\\"},{\\"@type\\":\\"Organization\\",\\"@id\\":\\"https://moribyan.com/#organization\\",\\"name\\":\\"Moribyan\\",\\"url\\":\\"https://moribyan.com/\\",\\"logo\\":{\\"@type\\":\\"ImageObject\\",\\"inLanguage\\":\\"en-US\\",\\"@id\\":\\"https://moribyan.com/#/schema/logo/image/\\",\\"url\\":\\"https://moribyan.com/wp-content/uploads/2022/06/Black-and-White-Minimalist-Initials-Logo-Template.png\\",\\"contentUrl\\":\\"https://moribyan.com/wp-content/uploads/2022/06/Black-and-White-Minimalist-Initials-Logo-Template.png\\",\\"width\\":512,\\"height\\":512,\\"caption\\":\\"Moribyan\\"},\\"image\\":{\\"@id\\":\\"https://moribyan.com/#/schema/logo/image/\\"}},{\\"@type\\":\\"Person\\",\\"@id\\":\\"https://moribyan.com/#/schema/person/85a5774bbb450cfd31123df14708ad3f\\",\\"name\\":\\"adm_moribyan\\",\\"image\\":{\\"@type\\":\\"ImageObject\\",\\"inLanguage\\":\\"en-US\\",\\"@id\\":\\"https://moribyan.com/#/schema/person/image/\\",\\"url\\":\\"https://secure.gravatar.com/avatar/49a73eb5bf7173aa63a25a6ec9c82ec39867c5a36b15e87e3568059134c8e66b?s=96&d=mm&r=g\\",\\"contentUrl\\":\\"https://secure.gravatar.com/avatar/49a73eb5bf7173aa63a25a6ec9c82ec39867c5a36b15e87e3568059134c8e66b?s=96&d=mm&r=g\\",\\"caption\\":\\"adm_moribyan\\"},\\"sameAs\\":[\\"https://moribyan.com\\"]}]} img:is([sizes=auto i],[sizes^=\\"auto,\\" i]){contain-intrinsic-size:3000px 1500px} /*# sourceURL=wp-img-auto-sizes-contain-inline-css */ .wp-block-button__link{align-content:center;box-sizing:border-box;cursor:pointer;display:inline-block;height:100%;text-align:center;word-break:break-word}.wp-block-button__link.aligncenter{text-align:center}.wp-block-button__link.alignright{text-align:right}:where(.wp-block-button__link){border-radius:9999px;box-shadow:none;padding:calc(.667em + 2px) calc(1.333em + 2px);text-decoration:none}.wp-block-button[style*=text-decoration] .wp-block-button__link{text-decoration:inherit}.wp-block-buttons>.wp-block-button.has-custom-width{max-width:none}.wp-block-buttons>.wp-block-button.has-custom-width .wp-block-button__link{width:100%}.wp-block-buttons>.wp-block-button.has-custom-font-size .wp-block-button__link{font-size:inherit}.wp-block-buttons>.wp-block-button.wp-block-button__width-25{width:calc(25% - var(--wp--style--block-gap, .5em)*.75)}.wp-block-buttons>.wp-block-button.wp-block-button__width-50{width:calc(50% - var(--wp--style--block-gap, .5em)*.5)}.wp-block-buttons>.wp-block-button.wp-block-button__width-75{width:calc(75% - var(--wp--style--block-gap, .5em)*.25)}.wp-block-buttons>.wp-block-button.wp-block-button__width-100{flex-basis:100%;width:100%}.wp-block-buttons.is-vertical>.wp-block-button.wp-block-button__width-25{width:25%}.wp-block-buttons.is-vertical>.wp-block-button.wp-block-button__width-50{width:50%}.wp-block-buttons.is-vertical>.wp-block-button.wp-block-button__width-75{width:75%}.wp-block-button.is-style-squared,.wp-block-button__link.wp-block-button.is-style-squared{border-radius:0}.wp-block-button.no-border-radius,.wp-block-button__link.no-border-radius{border-radius:0!important}:root :where(.wp-block-button .wp-block-button__link.is-style-outline),:root :where(.wp-block-button.is-style-outline>.wp-block-button__link){border:2px solid;padding:.667em 1.333em}:root :where(.wp-block-button .wp-block-button__link.is-style-outline:not(.has-text-color)),:root :where(.wp-block-button.is-style-outline>.wp-block-button__link:not(.has-text-color)){color:currentColor}:root :where(.wp-block-button .wp-block-button__link.is-style-outline:not(.has-background)),:root :where(.wp-block-button.is-style-outline>.wp-block-button__link:not(.has-background)){background-color:initial;background-image:none} /*# sourceURL=https://moribyan.com/wp-includes/blocks/button/style.min.css */ h1:where(.wp-block-heading).has-background,h2:where(.wp-block-heading).has-background,h3:where(.wp-block-heading).has-background,h4:where(.wp-block-heading).has-background,h5:where(.wp-block-heading).has-background,h6:where(.wp-block-heading).has-background{padding:1.25em 2.375em}h1.has-text-align-left[style*=writing-mode]:where([style*=vertical-lr]),h1.has-text-align-right[style*=writing-mode]:where([style*=vertical-rl]),h2.has-text-align-left[style*=writing-mode]:where([style*=vertical-lr]),h2.has-text-align-right[style*=writing-mode]:where([style*=vertical-rl]),h3.has-text-align-left[style*=writing-mode]:where([style*=vertical-lr]),h3.has-text-align-right[style*=writing-mode]:where([style*=vertical-rl]),h4.has-text-align-left[style*=writing-mode]:where([style*=vertical-lr]),h4.has-text-align-right[style*=writing-mode]:where([style*=vertical-rl]),h5.has-text-align-left[style*=writing-mode]:where([style*=vertical-lr]),h5.has-text-align-right[style*=writing-mode]:where([style*=vertical-rl]),h6.has-text-align-left[style*=writing-mode]:where([style*=vertical-lr]),h6.has-text-align-right[style*=writing-mode]:where([style*=vertical-rl]){rotate:180deg} /*# sourceURL=https://moribyan.com/wp-includes/blocks/heading/style.min.css */ .wp-block-image>a,.wp-block-image>figure>a{display:inline-block}.wp-block-image img{box-sizing:border-box;height:auto;max-width:100%;vertical-align:bottom}@media not (prefers-reduced-motion){.wp-block-image img.hide{visibility:hidden}.wp-block-image img.show{animation:show-content-image .4s}}.wp-block-image[style*=border-radius] img,.wp-block-image[style*=border-radius]>a{border-radius:inherit}.wp-block-image.has-custom-border img{box-sizing:border-box}.wp-block-image.aligncenter{text-align:center}.wp-block-image.alignfull>a,.wp-block-image.alignwide>a{width:100%}.wp-block-image.alignfull img,.wp-block-image.alignwide img{height:auto;width:100%}.wp-block-image .aligncenter,.wp-block-image .alignleft,.wp-block-image .alignright,.wp-block-image.aligncenter,.wp-block-image.alignleft,.wp-block-image.alignright{display:table}.wp-block-image .aligncenter>figcaption,.wp-block-image .alignleft>figcaption,.wp-block-image .alignright>figcaption,.wp-block-image.aligncenter>figcaption,.wp-block-image.alignleft>figcaption,.wp-block-image.alignright>figcaption{caption-side:bottom;display:table-caption}.wp-block-image .alignleft{float:left;margin:.5em 1em .5em 0}.wp-block-image .alignright{float:right;margin:.5em 0 .5em 1em}.wp-block-image .aligncenter{margin-left:auto;margin-right:auto}.wp-block-image :where(figcaption){margin-bottom:1em;margin-top:.5em}.wp-block-image.is-style-circle-mask img{border-radius:9999px}@supports ((-webkit-mask-image:none) or (mask-image:none)) or (-webkit-mask-image:none){.wp-block-image.is-style-circle-mask img{border-radius:0;-webkit-mask-image:url('data:image/svg+xml;utf8,');mask-image:url('data:image/svg+xml;utf8,');mask-mode:alpha;-webkit-mask-position:center;mask-position:center;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}}:root :where(.wp-block-image.is-style-rounded img,.wp-block-image .is-style-rounded img){border-radius:9999px}.wp-block-image figure{margin:0}.wp-lightbox-container{display:flex;flex-direction:column;position:relative}.wp-lightbox-container img{cursor:zoom-in}.wp-lightbox-container img:hover+button{opacity:1}.wp-lightbox-container button{align-items:center;backdrop-filter:blur(16px) saturate(180%);background-color:#5a5a5a40;border:none;border-radius:4px;cursor:zoom-in;display:flex;height:20px;justify-content:center;opacity:0;padding:0;position:absolute;right:16px;text-align:center;top:16px;width:20px;z-index:100}@media not (prefers-reduced-motion){.wp-lightbox-container button{transition:opacity .2s ease}}.wp-lightbox-container button:focus-visible{outline:3px auto #5a5a5a40;outline:3px auto -webkit-focus-ring-color;outline-offset:3px}.wp-lightbox-container button:hover{cursor:pointer;opacity:1}.wp-lightbox-container button:focus{opacity:1}.wp-lightbox-container button:focus,.wp-lightbox-container button:hover,.wp-lightbox-container button:not(:hover):not(:active):not(.has-background){background-color:#5a5a5a40;border:none}.wp-lightbox-overlay{box-sizing:border-box;cursor:zoom-out;height:100vh;left:0;overflow:hidden;position:fixed;top:0;visibility:hidden;width:100%;z-index:100000}.wp-lightbox-overlay .close-button{align-items:center;cursor:pointer;display:flex;justify-content:center;min-height:40px;min-width:40px;padding:0;position:absolute;right:calc(env(safe-area-inset-right) + 16px);top:calc(env(safe-area-inset-top) + 16px);z-index:5000000}.wp-lightbox-overlay .close-button:focus,.wp-lightbox-overlay .close-button:hover,.wp-lightbox-overlay .close-button:not(:hover):not(:active):not(.has-background){background:none;border:none}.wp-lightbox-overlay .lightbox-image-container{height:var(--wp--lightbox-container-height);left:50%;overflow:hidden;position:absolute;top:50%;transform:translate(-50%,-50%);transform-origin:top left;width:var(--wp--lightbox-container-width);z-index:9999999999}.wp-lightbox-overlay .wp-block-image{align-items:center;box-sizing:border-box;display:flex;height:100%;justify-content:center;margin:0;position:relative;transform-origin:0 0;width:100%;z-index:3000000}.wp-lightbox-overlay .wp-block-image img{height:var(--wp--lightbox-image-height);min-height:var(--wp--lightbox-image-height);min-width:var(--wp--lightbox-image-width);width:var(--wp--lightbox-image-width)}.wp-lightbox-overlay .wp-block-image figcaption{display:none}.wp-lightbox-overlay button{background:none;border:none}.wp-lightbox-overlay .scrim{background-color:#fff;height:100%;opacity:.9;position:absolute;width:100%;z-index:2000000}.wp-lightbox-overlay.active{visibility:visible}@media not (prefers-reduced-motion){.wp-lightbox-overlay.active{animation:turn-on-visibility .25s both}.wp-lightbox-overlay.active img{animation:turn-on-visibility .35s both}.wp-lightbox-overlay.show-closing-animation:not(.active){animation:turn-off-visibility .35s both}.wp-lightbox-overlay.show-closing-animation:not(.active) img{animation:turn-off-visibility .25s both}.wp-lightbox-overlay.zoom.active{animation:none;opacity:1;visibility:visible}.wp-lightbox-overlay.zoom.active .lightbox-image-container{animation:lightbox-zoom-in .4s}.wp-lightbox-overlay.zoom.active .lightbox-image-container img{animation:none}.wp-lightbox-overlay.zoom.active .scrim{animation:turn-on-visibility .4s forwards}.wp-lightbox-overlay.zoom.show-closing-animation:not(.active){animation:none}.wp-lightbox-overlay.zoom.show-closing-animation:not(.active) .lightbox-image-container{animation:lightbox-zoom-out .4s}.wp-lightbox-overlay.zoom.show-closing-animation:not(.active) .lightbox-image-container img{animation:none}.wp-lightbox-overlay.zoom.show-closing-animation:not(.active) .scrim{animation:turn-off-visibility .4s forwards}}@keyframes show-content-image{0%{visibility:hidden}99%{visibility:hidden}to{visibility:visible}}@keyframes turn-on-visibility{0%{opacity:0}to{opacity:1}}@keyframes turn-off-visibility{0%{opacity:1;visibility:visible}99%{opacity:0;visibility:visible}to{opacity:0;visibility:hidden}}@keyframes lightbox-zoom-in{0%{transform:translate(calc((-100vw + var(--wp--lightbox-scrollbar-width))/2 + var(--wp--lightbox-initial-left-position)),calc(-50vh + var(--wp--lightbox-initial-top-position))) scale(var(--wp--lightbox-scale))}to{transform:translate(-50%,-50%) scale(1)}}@keyframes lightbox-zoom-out{0%{transform:translate(-50%,-50%) scale(1);visibility:visible}99%{visibility:visible}to{transform:translate(calc((-100vw + var(--wp--lightbox-scrollbar-width))/2 + var(--wp--lightbox-initial-left-position)),calc(-50vh + var(--wp--lightbox-initial-top-position))) scale(var(--wp--lightbox-scale));visibility:hidden}} /*# sourceURL=https://moribyan.com/wp-includes/blocks/image/style.min.css */ ol,ul{box-sizing:border-box}:root :where(.wp-block-list.has-background){padding:1.25em 2.375em} /*# sourceURL=https://moribyan.com/wp-includes/blocks/list/style.min.css */ .wp-block-buttons{box-sizing:border-box}.wp-block-buttons.is-vertical{flex-direction:column}.wp-block-buttons.is-vertical>.wp-block-button:last-child{margin-bottom:0}.wp-block-buttons>.wp-block-button{display:inline-block;margin:0}.wp-block-buttons.is-content-justification-left{justify-content:flex-start}.wp-block-buttons.is-content-justification-left.is-vertical{align-items:flex-start}.wp-block-buttons.is-content-justification-center{justify-content:center}.wp-block-buttons.is-content-justification-center.is-vertical{align-items:center}.wp-block-buttons.is-content-justification-right{justify-content:flex-end}.wp-block-buttons.is-content-justification-right.is-vertical{align-items:flex-end}.wp-block-buttons.is-content-justification-space-between{justify-content:space-between}.wp-block-buttons.aligncenter{text-align:center}.wp-block-buttons:not(.is-content-justification-space-between,.is-content-justification-right,.is-content-justification-left,.is-content-justification-center) .wp-block-button.aligncenter{margin-left:auto;margin-right:auto;width:100%}.wp-block-buttons[style*=text-decoration] .wp-block-button,.wp-block-buttons[style*=text-decoration] .wp-block-button__link{text-decoration:inherit}.wp-block-buttons.has-custom-font-size .wp-block-button__link{font-size:inherit}.wp-block-buttons .wp-block-button__link{width:100%}.wp-block-button.aligncenter{text-align:center} /*# sourceURL=https://moribyan.com/wp-includes/blocks/buttons/style.min.css */ .wp-block-group{box-sizing:border-box}:where(.wp-block-group.wp-block-group-is-layout-constrained){position:relative} /*# sourceURL=https://moribyan.com/wp-includes/blocks/group/style.min.css */ .is-small-text{font-size:.875em}.is-regular-text{font-size:1em}.is-large-text{font-size:2.25em}.is-larger-text{font-size:3em}.has-drop-cap:not(:focus):first-letter{float:left;font-size:8.4em;font-style:normal;font-weight:100;line-height:.68;margin:.05em .1em 0 0;text-transform:uppercase}body.rtl .has-drop-cap:not(:focus):first-letter{float:none;margin-left:.1em}p.has-drop-cap.has-background{overflow:hidden}:root :where(p.has-background){padding:1.25em 2.375em}:where(p.has-text-color:not(.has-link-color)) a{color:inherit}p.has-text-align-left[style*=\\"writing-mode:vertical-lr\\"],p.has-text-align-right[style*=\\"writing-mode:vertical-rl\\"]{rotate:180deg} /*# sourceURL=https://moribyan.com/wp-includes/blocks/paragraph/style.min.css */ @charset \\"UTF-8\\";.wp-block-separator{border:none;border-top:2px solid}:root :where(.wp-block-separator.is-style-dots){height:auto;line-height:1;text-align:center}:root :where(.wp-block-separator.is-style-dots):before{color:currentColor;content:\\"\\u00b7\\u00b7\\u00b7\\";font-family:serif;font-size:1.5em;letter-spacing:2em;padding-left:2em}.wp-block-separator.is-style-dots{background:none!important;border:none!important} /*# sourceURL=https://moribyan.com/wp-includes/blocks/separator/style.min.css */ /*! This file is auto-generated */ .wp-block-button__link{color:#fff;background-color:#32373c;border-radius:9999px;box-shadow:none;text-decoration:none;padding:calc(.667em + 2px) calc(1.333em + 2px);font-size:1.125em}.wp-block-file__button{background:#32373c;color:#fff;text-decoration:none} /*# sourceURL=/wp-includes/css/classic-themes.min.css */ :root{--wp--preset--aspect-ratio--square: 1;--wp--preset--aspect-ratio--4-3: 4/3;--wp--preset--aspect-ratio--3-4: 3/4;--wp--preset--aspect-ratio--3-2: 3/2;--wp--preset--aspect-ratio--2-3: 2/3;--wp--preset--aspect-ratio--16-9: 16/9;--wp--preset--aspect-ratio--9-16: 9/16;--wp--preset--color--black: #000000;--wp--preset--color--cyan-bluish-gray: #abb8c3;--wp--preset--color--white: #ffffff;--wp--preset--color--pale-pink: #f78da7;--wp--preset--color--vivid-red: #cf2e2e;--wp--preset--color--luminous-vivid-orange: #ff6900;--wp--preset--color--luminous-vivid-amber: #fcb900;--wp--preset--color--light-green-cyan: #7bdcb5;--wp--preset--color--vivid-green-cyan: #00d084;--wp--preset--color--pale-cyan-blue: #8ed1fc;--wp--preset--color--vivid-cyan-blue: #0693e3;--wp--preset--color--vivid-purple: #9b51e0;--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple: linear-gradient(135deg,rgb(6,147,227) 0%,rgb(155,81,224) 100%);--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan: linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%);--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange: linear-gradient(135deg,rgb(252,185,0) 0%,rgb(255,105,0) 100%);--wp--preset--gradient--luminous-vivid-orange-to-vivid-red: linear-gradient(135deg,rgb(255,105,0) 0%,rgb(207,46,46) 100%);--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray: linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%);--wp--preset--gradient--cool-to-warm-spectrum: linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%);--wp--preset--gradient--blush-light-purple: linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%);--wp--preset--gradient--blush-bordeaux: linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%);--wp--preset--gradient--luminous-dusk: linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%);--wp--preset--gradient--pale-ocean: linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%);--wp--preset--gradient--electric-grass: linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%);--wp--preset--gradient--midnight: linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%);--wp--preset--font-size--small: 13px;--wp--preset--font-size--medium: 20px;--wp--preset--font-size--large: 36px;--wp--preset--font-size--x-large: 42px;--wp--preset--spacing--20: 0.44rem;--wp--preset--spacing--30: 0.67rem;--wp--preset--spacing--40: 1rem;--wp--preset--spacing--50: 1.5rem;--wp--preset--spacing--60: 2.25rem;--wp--preset--spacing--70: 3.38rem;--wp--preset--spacing--80: 5.06rem;--wp--preset--shadow--natural: 6px 6px 9px rgba(0, 0, 0, 0.2);--wp--preset--shadow--deep: 12px 12px 50px rgba(0, 0, 0, 0.4);--wp--preset--shadow--sharp: 6px 6px 0px rgba(0, 0, 0, 0.2);--wp--preset--shadow--outlined: 6px 6px 0px -3px rgb(255, 255, 255), 6px 6px rgb(0, 0, 0);--wp--preset--shadow--crisp: 6px 6px 0px rgb(0, 0, 0);}:where(.is-layout-flex){gap: 0.5em;}:where(.is-layout-grid){gap: 0.5em;}body .is-layout-flex{display: flex;}.is-layout-flex{flex-wrap: wrap;align-items: center;}.is-layout-flex > :is(*, div){margin: 0;}body .is-layout-grid{display: grid;}.is-layout-grid > :is(*, div){margin: 0;}:where(.wp-block-columns.is-layout-flex){gap: 2em;}:where(.wp-block-columns.is-layout-grid){gap: 2em;}:where(.wp-block-post-template.is-layout-flex){gap: 1.25em;}:where(.wp-block-post-template.is-layout-grid){gap: 1.25em;}.has-black-color{color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-color{color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-color{color: var(--wp--preset--color--white) !important;}.has-pale-pink-color{color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-color{color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-color{color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-color{color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-color{color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-color{color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-color{color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-color{color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-color{color: var(--wp--preset--color--vivid-purple) !important;}.has-black-background-color{background-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-background-color{background-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-background-color{background-color: var(--wp--preset--color--white) !important;}.has-pale-pink-background-color{background-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-background-color{background-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-background-color{background-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-background-color{background-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-background-color{background-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-background-color{background-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-background-color{background-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-background-color{background-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-background-color{background-color: var(--wp--preset--color--vivid-purple) !important;}.has-black-border-color{border-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-border-color{border-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-border-color{border-color: var(--wp--preset--color--white) !important;}.has-pale-pink-border-color{border-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-border-color{border-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-border-color{border-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-border-color{border-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-border-color{border-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-border-color{border-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-border-color{border-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-border-color{border-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-border-color{border-color: var(--wp--preset--color--vivid-purple) !important;}.has-vivid-cyan-blue-to-vivid-purple-gradient-background{background: var(--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple) !important;}.has-light-green-cyan-to-vivid-green-cyan-gradient-background{background: var(--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan) !important;}.has-luminous-vivid-amber-to-luminous-vivid-orange-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange) !important;}.has-luminous-vivid-orange-to-vivid-red-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-orange-to-vivid-red) !important;}.has-very-light-gray-to-cyan-bluish-gray-gradient-background{background: var(--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray) !important;}.has-cool-to-warm-spectrum-gradient-background{background: var(--wp--preset--gradient--cool-to-warm-spectrum) !important;}.has-blush-light-purple-gradient-background{background: var(--wp--preset--gradient--blush-light-purple) !important;}.has-blush-bordeaux-gradient-background{background: var(--wp--preset--gradient--blush-bordeaux) !important;}.has-luminous-dusk-gradient-background{background: var(--wp--preset--gradient--luminous-dusk) !important;}.has-pale-ocean-gradient-background{background: var(--wp--preset--gradient--pale-ocean) !important;}.has-electric-grass-gradient-background{background: var(--wp--preset--gradient--electric-grass) !important;}.has-midnight-gradient-background{background: var(--wp--preset--gradient--midnight) !important;}.has-small-font-size{font-size: var(--wp--preset--font-size--small) !important;}.has-medium-font-size{font-size: var(--wp--preset--font-size--medium) !important;}.has-large-font-size{font-size: var(--wp--preset--font-size--large) !important;}.has-x-large-font-size{font-size: var(--wp--preset--font-size--x-large) !important;} /*# sourceURL=global-styles-inline-css */ .woocommerce form .form-row .required { visibility: visible; } /*# sourceURL=woocommerce-inline-inline-css */ /* */ /* */ /* */ { \\"@context\\": \\"https://schema.org/\\", \\"@type\\": \\"recipe\\", \\"name\\": \\"Chocolate Chip Cookies\\", \\"image\\": \\"https://moribyan.com/wp-content/uploads/2022/05/Chocolate-Chip-Cookies-3-scaled-1.jpg\\", \\"aggregateRating\\": { \\"@type\\": \\"AggregateRating\\", \\"ratingValue\\": \\"5\\", \\"bestRating\\": \\"5\\", \\"ratingCount\\": \\"177\\" } } .woocommerce-product-gallery{ opacity: 1 !important; } /* MV CSS */ @media only screen and (max-width: 359px) { .single-content-desc { max-width: 100% !important; padding-left: 10px !important; padding-right: 10px !important; } .recipe-card-details { width: 100% !important; } .recipe-ingredient, .recipe-instruction, .recipe-notes { padding-left: 0px !important; padding-right: 0px !important; } .recipe-notes { margin-left: 0px !important; max-width: 100% !important; } #recipe-card { background: inherit !important; } } /* Mediavine font size CSS */ .single-content, .single-page .single-page-content .single-content strong { font-size: 18px; line-height: 1.6; } /* End MV CSS */ window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-16B9S3JQPQ'); (function(w, d, t, h, s, n) { w.FlodeskObject = n; var fn = function() { (w[n].q = w[n].q || []).push(arguments); }; w[n] = w[n] || fn; var f = d.getElementsByTagName(t)[0]; var v = '?v=' + Math.floor(new Date().getTime() / (120 * 1000)) * 60; var sm = d.createElement(t); sm.async = true; sm.type = 'module'; sm.src = h + s + '.mjs' + v; f.parentNode.insertBefore(sm, f); var sn = d.createElement(t); sn.async = true; sn.noModule = true; sn.src = h + s + '.js' + v; f.parentNode.insertBefore(sn, f); })(window, document, 'script', 'https://assets.flodesk.com', '/universal', 'fd'); .wp-container-core-buttons-is-layout-16018d1d{justify-content:center;} /*# sourceURL=core-block-supports-inline-css */ Moribyan Search Moribyan Recipes", "quantity": "", "unit": "", "category": "grains"}, {"name": "About", "quantity": "", "unit": "", "category": "produce"}, {"name": "Lifestyle", "quantity": "", "unit": "", "category": "produce"}, {"name": "Shop", "quantity": "", "unit": "", "category": "produce"}, {"name": "Contact", "quantity": "", "unit": "", "category": "produce"}, {"name": "Browning butter is such a simple way to elevate any recipe with an ingredient you already use in most baked goods. You basically cook the butter in a pan beyond its melting point until the milk solids start to toast. It unleashes a beautiful brown color to create a nutty and rich taste and aroma.", "quantity": "", "unit": "", "category": "fats"}, {"name": "coconut sugar allows cookies to spread more than monk fruit sweetener for that ultimate thin chewy cookie. Because of the molasses in coconut sugar, it helps keep the cookies a lot more moist than monk fruit sweetener and adds a more deep color to the cookies.", "quantity": "", "unit": "", "category": "sweetener"}, {"name": "This is all up to personal preference but I think the balance of half milk and half semi-sweet is out of this world. The semi-sweet adds a more bitter taste while the milk chocolate has a very creamy and sweet taste and in each bite, you get a bit of both. Of course you can always just use only semi-sweet chocolate.", "quantity": "", "unit": "", "category": "dairy"}, {"name": "Crumbl Copycat Churro Cookies", "quantity": "", "unit": "", "category": "produce"}, {"name": "Twix Cookies", "quantity": "", "unit": "", "category": "produce"}, {"name": "Biscoff White Chocolate Chip Cookies", "quantity": "", "unit": "", "category": "produce"}, {"name": "White Chocolate Cranberry Blondie Bars", "quantity": "", "unit": "", "category": "produce"}, {"name": "unsalted butter 2 sticks", "quantity": "1", "unit": "cup", "category": "fats"}, {"name": "coconut sugar light or dark", "quantity": "1 1/4", "unit": "cup", "category": "sweetener"}, {"name": "monk fruit sweetener", "quantity": "1/3", "unit": "cup", "category": "sweetener"}, {"name": "egg + 2 egg yolks room temperature", "quantity": "1", "unit": "large", "category": "protein"}, {"name": "vanilla extract", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "all purpose flour", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "baking soda", "quantity": "3/4", "unit": "teaspoon", "category": "produce"}, {"name": "salt", "quantity": "1", "unit": "teaspoon", "category": "spices"}, {"name": "milk chocolate chips", "quantity": "1", "unit": "cup", "category": "dairy"}, {"name": "semi sweet chocolate chunks", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "Preheat oven to 350\\u00b0F.", "quantity": "", "unit": "", "category": "produce"}, {"name": "In a small bowl, whisk together all purpose flour, baking soda, and salt.", "quantity": "", "unit": "", "category": "spices"}, {"name": "To a pan over medium heat, add the butter. Cook for 5 to 6 minutes until it starts to bubble and then brown. Make sure not to cook it any further or it can burn. Transfer it to a bowl and allow it to cool so it's not hot.", "quantity": "", "unit": "", "category": "fats"}, {"name": "In a large mixing bowl, add the coconut sugar and monk fruit sweetener. Pour in the butter and mix just until combined. Then add the egg and egg yolks and vanilla extract. Whisk until smooth and thick.", "quantity": "", "unit": "", "category": "protein"}, {"name": "Add the dry to the wet and fold in using a rubber spatula until a cookie dough forms.", "quantity": "", "unit": "", "category": "produce"}, {"name": "Mix in the milk chocolate and dark chocolate and let the dough rest for 15 to 20 minutes.", "quantity": "", "unit": "", "category": "dairy"}, {"name": "Line a sheet pan with parchment paper.", "quantity": "", "unit": "", "category": "produce"}, {"name": "Scoop out portions of the dough about the size of 1/4 to 1/3 measuring cup. Make sure to space them apart, 6 cookies per sheet.", "quantity": "", "unit": "", "category": "produce"}, {"name": "Pop in the oven to bake for about 10 minutes until the edges are golden brown and the center is still a bit soft. The cookies will continue baking out of the oven on the hot pan.", "quantity": "", "unit": "", "category": "produce"}, {"name": "Leave them on the pan for about 10 minutes or until firm before transferring them to a cooling rack to finish cooling and enjoy!", "quantity": "", "unit": "", "category": "produce"}, {"name": "Recipes", "quantity": "", "unit": "", "category": "produce"}, {"name": "About", "quantity": "", "unit": "", "category": "produce"}, {"name": "Lifestyle", "quantity": "", "unit": "", "category": "produce"}, {"name": "Shop", "quantity": "", "unit": "", "category": "produce"}, {"name": "Contact", "quantity": "", "unit": "", "category": "produce"}, {"name": "Privacy Policy", "quantity": "", "unit": "", "category": "produce"}]	["Step 1: Prep first \\u2014 Gather ingredients.", "Step 2: Cook using medium heat until done.", "Step 3: Finish and serve \\u2014 Serve and enjoy."]	0	0	0	2	{"calories": 460, "protein": 28.0, "carbs": 36.0, "fat": 20.0, "fiber": 6.0, "sugar": 6.0, "sodium_mg": 520, "micronutrients": {"vitamin_a_mcg": 180, "vitamin_c_mg": 55, "vitamin_d_mcg": 1.2, "vitamin_e_mg": 3.0, "vitamin_k_mcg": 60, "thiamin_mg": 0.3, "riboflavin_mg": 0.3, "niacin_mg": 4.0, "vitamin_b6_mg": 0.5, "folate_mcg": 90, "vitamin_b12_mcg": 0.8, "calcium_mg": 120, "iron_mg": 3.0, "magnesium_mg": 80, "phosphorus_mg": 220, "potassium_mg": 450, "zinc_mg": 2.0, "selenium_mcg": 12, "omega3_g": 0.2}}	easy	["dessert", "quick", "moribyan_com_import", "whole-food"]	["sweet"]	[]	global	["anti_inflammatory", "brain_health", "immune_support", "muscle_recovery", "skin_health"]	["eggs"]	["oats", "tortillas"]	f	\N	2026-03-13 22:16:25.731573	dessert	f	\N	[]	\N	null	f	null
0a823513-6446-45a3-b605-f9ba207ed52c	Cilantro Lime Cabbage Slaw	Crunchy cabbage slaw with lime and cilantro that brightens smoky bowls and adds a better metabolic buffer.	[{"name": "green cabbage, shredded", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "red cabbage, shredded", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "cilantro, chopped", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "lime juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "pinch", "unit": "", "category": "spices"}]	["Add the green cabbage, red cabbage, and cilantro to a bowl.", "Dress with lime juice, olive oil, and a pinch of salt.", "Toss well and let it sit for a few minutes so the cabbage softens slightly while staying crisp."]	8	0	8	2	{"calories": 85, "protein": 2.0, "carbs": 9.0, "fat": 5.0, "fiber": 4.0, "sugar": 3.0}	easy	["meal-prep", "whole-food", "veg_side", "veg_component", "salad", "fiesta_bowl_group_v1"]	["fresh", "tangy", "crunchy"]	["gluten-free", "dairy-free", "vegan"]	mexican	["detox_support", "hormone_support", "immune_support"]	[]	[]	f	\N	2026-03-13 22:16:25.731574	veg_side	t	fiesta_bowl_group_v1	[]	f	null	f	{"acid": true, "fiber_class": "med", "healthy_fat": true, "veg_density": "high", "recommended_timing": "before_meal"}
509a0794-9599-4e2e-8993-b4f45a4c00a9	Classic Apple Hand Pies	If you love the apple pie from McDonald’s, you’ll love this simple copycat recipe that you can make at home and even better! The pie is super flaky and crispy while the filling is so ooey and gooey with the most delicious apple spice flavor. Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).	[{"name": "pastry package (1 pound - 2 sheets)", "quantity": "1", "unit": "puff", "category": "produce"}, {"name": "egg", "quantity": "1", "unit": "large", "category": "protein"}, {"name": "whole milk", "quantity": "1", "unit": "tablespoon", "category": "dairy"}, {"name": "granny smith apples, peeled and cubed", "quantity": "2", "unit": "large", "category": "produce"}, {"name": "unsalted butter", "quantity": "3", "unit": "tablespoons", "category": "fats"}, {"name": "light coconut sugar", "quantity": "1/3", "unit": "cup", "category": "sweetener"}, {"name": "cinnamon", "quantity": "1 1/4", "unit": "teaspoon", "category": "spices"}, {"name": "pinch of salt", "quantity": "", "unit": "", "category": "spices"}, {"name": "vanilla extract", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "lemon juice", "quantity": "1/2", "unit": "tablespoon", "category": "produce"}, {"name": "cornstarch", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "water", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "white monk fruit sweetener", "quantity": "2", "unit": "tablespoons", "category": "sweetener"}, {"name": "cinnamon", "quantity": "1", "unit": "teaspoon", "category": "spices"}]	["Step 1: Whisk together the egg and milk in a small bowl. Set aside.", "Step 2: To a small bowl, combine sugar and cinnamon and set aside.", "Step 3: To a pan over medium heat, add the butter, apples, light brown sugar, cinnamon, salt, vanilla extract, and lemon juice.", "Step 4: Mix together and allow to simmer on low heat for 6 to 8 minutes until the apples are soft when poked with a fork.", "Step 5: Combine the water and cornstarch in a small bowl to make the cornstarch slurry and add this to the pan. Mix together to thicken the filling and then take off the heat and transfer to a bowl.", "Step 6: Preheat oven to 400\\u00b0F.", "Step 7: Spread the puff pastry on a baking sheet. Cut each sheet into four equal pieces.", "Step 8: Brush the edges of each piece with just a bit of egg wash.", "Step 9: Add the apple filling along one side and fold over. Press down on the edges to help seal it. Take a fork and press around to seal shut. Repeat with the reset.", "Step 10: Brush the tops with egg wash and sprinkle with cinnamon sugar.", "Step 11: Transfer to the oven and bake for 20 to 25 minutes or until golden brown.", "Step 12: Enjoy warm!."]	15	45	60	8	{"calories": 290, "protein": 3, "carbs": 44, "fat": 12, "fiber": 3}	medium	["snack", "sit-down"]	["sweet"]	["gluten-free"]	american	["anti_inflammatory", "blood_sugar", "brain_health", "detox_support", "immune_support", "muscle_recovery", "skin_health"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2022/11/IMG_9968.jpg	2026-03-13 22:16:25.731574	dessert	f	\N	[]	\N	null	f	null
eea41680-b2c4-4d52-b683-60c8bbcebb57	Creamy Avocado Verde Salsa	This copycat Avocado Verde Salsa from Taco Bell is a game-changer, blending the creamy goodness of ripe avocados with the zesty punch of green tomatillos, jalapeños, and a squeeze of fresh lime juice. It’s perfect for topping your tacos, dipping chips, or spreading on your favorite sandwiches, bringing that authentic flavor home. Super quick and easy to whip up, it’s the ultimate way to take your Mexican-inspired dishes to the next level! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps.	[{"name": "olive oil", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "6 tomatillos, peeled and chopped", "quantity": "5", "unit": "to", "category": "produce"}, {"name": "onion, chopped", "quantity": "1/3", "unit": "yellow", "category": "produce"}, {"name": "3 garlic cloves", "quantity": "2", "unit": "to", "category": "produce"}, {"name": "cilantro", "quantity": "1", "unit": "bunch", "category": "produce"}, {"name": "avocados", "quantity": "2", "unit": "large", "category": "produce"}, {"name": "juice of 1/2 lime", "quantity": "", "unit": "", "category": "produce"}, {"name": "\\u00f1os, seeds and stem removed", "quantity": "2", "unit": "jalape", "category": "produce"}, {"name": "salt, more to taste", "quantity": "1/2", "unit": "teaspoon", "category": "spices"}, {"name": "water", "quantity": "1/2", "unit": "cup", "category": "produce"}]	["Step 1: To a hot pan over medium heat, add the olive oil, tomatillos, jalape\\u00f1os, and onion. Sear for 4 to 5 minutes and then take off the heat.", "Step 2: Add the seared tomatillos, jalape\\u00f1os, and onions to a food processor along with the garlic cloves, cilantro, avocado, lime juice, water, and salt.", "Step 3: Blend until completely smooth.", "Step 4: Enjoy on tacos, in a burrito, or with a rice bowl. Transfer to a jar or air-tight container and store in the fridge for 3 to 4 days."]	5	15	30	2	{"calories": 60, "protein": 1, "carbs": 4, "fat": 5, "fiber": 2}	easy	["condiment", "quick"]	["savory", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	mexican	["anti_inflammatory", "detox_support", "heart_health", "immune_support", "skin_health"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2024/08/IMG_0656.jpg	2026-03-13 22:16:25.731575	sauce	t	\N	[]	\N	null	f	null
223c561e-d564-4fc7-a6ed-655b93e03d52	Creamy Banana Milk	With just four ingredients and five minutes, you can make your own batch of banana milk at home! And if you haven’t tried banana milk yet, you’re seriously missing out on this super popular drink in South Korea. It’s creamy, naturally sweet, and absolutely delicious on its own or as a dreamy addition to your coffee or matcha. Trust me, once you make it, you’ll wonder how you ever lived without it! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 1 whole-food ingredient swap(s).	[{"name": "whole milk", "quantity": "2", "unit": "cups", "category": "dairy"}, {"name": "bananas", "quantity": "2", "unit": "medium", "category": "produce"}, {"name": "vanilla extract", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "4 tablespoons granulated monk fruit sweetener", "quantity": "3", "unit": "to", "category": "sweetener"}, {"name": "pinch of salt, optional", "quantity": "", "unit": "", "category": "spices"}]	["Step 1: In a blender, combine the whole milk, bananas, vanilla extract, sugar, and a pinch of salt.", "Step 2: Blend the mixture on high speed until smooth and well combined.", "Step 3: Place a cheese cloth over a large bowl or pitcher and pour the blended mixture through the cloth to strain it. This will ensure a silky texture by removing any banana pulp.", "Step 4: Transfer the strained banana milk to a jug or container and chill in the refrigerator for at least 30 minutes before serving.", "Step 5: Give the banana milk a good stir before pouring it into glasses. Enjoy it on its own or in some coffee or matcha!."]	5	0	10	3	{"calories": 180, "protein": 6, "carbs": 32, "fat": 3, "fiber": 2}	easy	["snack", "quick"]	["sweet"]	["vegetarian", "gluten-free"]	korean	["energy_boost"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2024/07/IMG_0315.jpg	2026-03-13 22:16:25.731575	dessert	f	\N	null	\N	null	f	null
89b4e9ab-643b-49bc-9a12-eb41f00847c7	Creamy Red Pepper Chicken Rice Bowl	A chicken and brown rice bowl finished with creamy red pepper sauce, with a fresh herb salad as the default pairing.	[{"name": "red pepper chicken", "quantity": "1", "unit": "serving", "category": "protein"}, {"name": "brown rice", "quantity": "1", "unit": "serving", "category": "grains"}, {"name": "creamy red pepper sauce", "quantity": "1", "unit": "serving", "category": "sauce"}]	["Protein Component: Add 1 serving of Red Pepper Chicken.", "Carb Component: Add 1 serving of Brown Rice.", "Sauce Component: Spoon over 1 serving of Creamy Red Pepper Sauce.", "Assembly: Build the bowl and serve hot. Pair it with the default Cucumber Tomato Herb Salad for a more balanced plate."]	10	20	30	2	{"calories": 460, "protein": 41.5, "carbs": 47.0, "fat": 13.2, "fiber": 8.1, "sugar": 6.4, "mes_score": 73.5, "mes_display_score": 73.5, "mes_tier": "good", "mes_display_tier": "good", "mes_sub_scores": {"gis": 49.2, "pas": 100.0, "fs": 78.1, "fas": 71.0}, "mes_score_with_default_pairing": 74.1, "mes_default_pairing_delta": 4.6, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"], "mes_default_pairing_id": "5fcd9514-aa74-4a39-9f7c-c5d21ab5a699", "mes_default_pairing_title": "Cucumber Tomato Herb Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 78.1, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"]}	easy	["dinner", "red_pepper_bowl_group_v1", "sit-down", "whole-food"]	["savory", "creamy"]	["gluten-free"]	mediterranean	["energy_boost", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	["rice"]	f	\N	2026-03-13 22:16:25.731575	full_meal	f	red_pepper_bowl_group_v1	["5fcd9514-aa74-4a39-9f7c-c5d21ab5a699"]	t	{"protein_component_title": "Red Pepper Chicken", "carb_component_title": "Brown Rice", "sauce_component_title": "Creamy Red Pepper Sauce", "default_pairing_title": "Cucumber Tomato Herb Salad", "component_titles": ["Red Pepper Chicken", "Brown Rice", "Creamy Red Pepper Sauce"], "default_pairing_role": "veg_side"}	t	null
29b0f2d7-b366-4fb9-9ff8-c6c8d0f45a82	Creamy Red Pepper Sauce	Meal-prep sauce component made with red pepper, garlic, milk, and light cream cheese.	[{"name": "red bell pepper", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "garlic cloves", "quantity": "3", "unit": "cloves", "category": "produce"}, {"name": "water", "quantity": "1", "unit": "tbsp", "category": "other"}, {"name": "1% milk", "quantity": "1/2", "unit": "cup", "category": "dairy"}, {"name": "light cream cheese", "quantity": "2", "unit": "tbsp", "category": "dairy"}, {"name": "salt", "quantity": "pinch", "unit": "", "category": "spices"}, {"name": "onion powder", "quantity": "pinch", "unit": "", "category": "spices"}]	["Cook the bell pepper and garlic until soft and fragrant.", "Blend with milk, cream cheese, water, salt, and onion powder until smooth.", "Pour back into the pan and simmer briefly until creamy."]	10	10	20	2	{"calories": 90, "protein": 4.0, "carbs": 8.0, "fat": 4.0, "fiber": 1.5, "sugar": 4.0}	easy	["meal-prep", "whole-food", "sauce_component", "sauce", "red_pepper_bowl_group_v1"]	["creamy", "savory"]	["gluten-free", "vegetarian"]	mediterranean	["heart_health", "immune_support", "skin_health"]	[]	[]	f	\N	2026-03-13 22:16:25.731576	sauce	t	\N	[]	\N	null	f	null
7e19499a-29a9-4004-adcb-7c1d942c45ee	Greek Yogurt Chia Protein Bowl	Thick Greek yogurt mixed with chia, hemp hearts, almond butter, and a few berries.	[{"name": "plain Greek yogurt", "quantity": "1.5", "unit": "cups", "category": "dairy"}, {"name": "chia seeds", "quantity": "2", "unit": "tbsp", "category": "seeds"}, {"name": "hemp hearts", "quantity": "2", "unit": "tbsp", "category": "seeds"}, {"name": "almond butter", "quantity": "1", "unit": "tbsp", "category": "nuts"}, {"name": "raspberries", "quantity": "0.25", "unit": "cup", "category": "produce"}, {"name": "cinnamon", "quantity": "0.25", "unit": "tsp", "category": "spices"}]	["Spoon Greek yogurt into a bowl and stir in chia seeds and cinnamon.", "Top with hemp hearts, almond butter, and raspberries.", "Let sit 2 minutes so the chia slightly thickens before serving."]	5	0	5	1	{"calories": 440, "protein": 38, "carbs": 12, "fat": 22, "fiber": 10, "mes_score": 93.9, "mes_display_score": 93.9, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 93.5, "fs": 90.0, "fas": 85.6}}	easy	["breakfast", "quick"]	["mild"]	["gluten-free", "vegetarian"]	american	["anti_inflammatory", "blood_sugar", "bone_health", "energy_boost", "gut_health", "heart_health"]	[]	[]	f	\N	2026-03-13 22:16:25.731577	full_meal	f	\N	[]	\N	null	t	null
651c53a5-635a-4088-b226-5259046cf097	Homestyle Smash Burger	Making a Big Mac at home and even better is easier than you think! Two patties sandwiched between THREE BUNS and layers of Big Mac sauce, lettuce, onions, pickles, and cheese – what could truly be better? It’s juicy, saucy, comforting, and everything you want in the perfect burger! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).	[{"name": "mayonnaise", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "pickle relish, drained", "quantity": "4", "unit": "tablespoons", "category": "produce"}, {"name": "ketchup", "quantity": "3", "unit": "tablespoons", "category": "produce"}, {"name": "sugar", "quantity": "1", "unit": "teaspoon", "category": "sweetener"}, {"name": "white vinegar", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "buns, plus additional bottom buns for the middle sourdough bun", "quantity": "8", "unit": "hamburger", "category": "grains"}, {"name": "unsalted butter, softened", "quantity": "1/4", "unit": "cup", "category": "fats"}, {"name": "onion, diced", "quantity": "1", "unit": "white", "category": "produce"}, {"name": "dill pickle chips", "quantity": "", "unit": "", "category": "produce"}, {"name": "shredded iceberg lettuce", "quantity": "", "unit": "", "category": "produce"}, {"name": "80/20 ground beef", "quantity": "2", "unit": "pounds", "category": "protein"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "black pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "butter, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "extra virgin olive oil, split in half", "quantity": "1", "unit": "tablespoon", "category": "fats"}, {"name": "yellow mustard", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "American Cheese", "quantity": "8", "unit": "slices", "category": "dairy"}]	["Step 1: In a small bowl, mix together the mayonnaise, relish, ketchup, sugar, and vinegar. Set aside.", "Step 2: Weigh out 8 portions of 3.5 oz of ground beef or eye it out. Gently flatten the patty into a circle to desired thin or thickness, making sure to not mix or mold it too much. Sprinkle with salt and pepper on both sides. Set aside.", "Step 3: Brush the insides of the buns with butter.", "Step 4: Heat a pan or skillet over medium heat. Lay the buns butter side face down. Take them off the pan when a nice golden brown develops around the edges.", "Step 5: Over medium-high heat in a skillet or pan, add 1/2 a tablespoon of butter and 1/2 a tablespoon of vegetable oil. Add the patties in, two at a time or more if you have a large grill/skillet. Add a teaspoon of mustard on the raw side and spread evenly. It will take about 2-3 minutes for the patty to get a nice brown crust. Flip over and add a slice of American cheese on top of half the patties you cook since Big Macs only have 1 cheese but 2 patties. Let it cook for about 1 more minute for the cheese to melt. Take off the heat.", "Step 6: To the bottom bun, add sauce, lettuce, onion, patty, and cheese. Then add the middle bun, sauce, lettuce, onion, pickles, and the second patty. Add the top bun.", "Step 7: Enjoy warm!."]	35	25	60	4	{"calories": 520, "protein": 32, "carbs": 38, "fat": 26, "fiber": 3, "mes_score": 61.5, "mes_display_score": 61.5, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 55.0, "pas": 75.6, "fs": 31.2, "fas": 88.8}, "mes_score_with_default_pairing": 72.8, "mes_default_pairing_delta": 15.3, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"], "mes_default_pairing_id": "131365e2-b77a-45bb-a6be-04a82c29cce3", "mes_default_pairing_title": "Black Bean and Corn Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 76.8, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side"]}	easy	["lunch", "quick"]	["savory", "umami"]	["gluten-free"]	american	["anti_inflammatory", "heart_health"]	["beef"]	["sourdough_bread"]	f	https://moribyan.com/wp-content/uploads/2023/04/93E2CC42-CD42-4D54-8EEF-F41488BD51C1.jpeg	2026-03-13 22:16:25.731577	full_meal	f	\N	["131365e2-b77a-45bb-a6be-04a82c29cce3"]	t	null	t	null
f5d803ea-14ef-4bf5-9f6b-737e67c3ade6	Kachumber Salad	Fresh Indian-style salad side that pairs with curry dishes.	[{"name": "cucumber, diced", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "tomatoes, diced", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "red onion, finely chopped", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "fresh cilantro", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "black pepper", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Combine cucumber, tomato, onion, and cilantro in a bowl.", "Season with lemon juice, salt, and pepper.", "Chill and portion as a side salad."]	8	0	8	5	{"calories": 58, "protein": 2.1, "carbs": 12, "fat": 0.4, "fiber": 3.2, "sugar": 5.0}	easy	["meal-prep", "whole-food", "butter_chicken_group_v1", "veg_side", "salad", "veg_component"]	["fresh", "tangy"]	["gluten-free", "dairy-free", "vegan"]	indian	["anti_inflammatory", "detox_support", "immune_support", "skin_health"]	[]	[]	f	\N	2026-03-13 22:16:25.731578	veg_side	t	\N	[]	\N	null	f	{"acid": true, "fiber_class": "med", "healthy_fat": false, "veg_density": "high", "recommended_timing": "before_meal"}
9e0e10bb-ba4d-41a8-bbe7-41167ef14a4e	Kale and White Bean Salad	Hearty massaged kale with cannellini beans, lemon, and olive oil — a protein and fiber powerhouse side.	[{"name": "lacinato kale", "quantity": "4", "unit": "cups", "category": "produce"}, {"name": "cannellini beans", "quantity": "0.5", "unit": "cup", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "garlic clove", "quantity": "1", "unit": "", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: De-stem kale and chop. Massage with olive oil and lemon juice for 2 minutes until tender.", "Step 2: Toss with beans, minced garlic, and salt. Let rest 5 minutes before serving."]	10	0	10	2	{"calories": 145, "protein": 7.5, "carbs": 16.0, "fat": 6.0, "fiber": 7.0, "sugar": 1.5, "sodium_mg": 190}	easy	["side", "quick", "veg_side", "salad", "whole-food"]	["savory", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	mediterranean	["High fiber", "High iron", "Rich in vitamin K", "Plant protein"]	["vegetarian"]	[]	t	\N	2026-03-13 22:16:25.731578	veg_side	t	\N	[]	\N	null	f	{"acid": true, "fiber_class": "high", "healthy_fat": true, "veg_density": "high", "recommended_timing": "before_meal"}
c3d7dabb-22b1-488c-bd0c-728a70953abb	Korean Sesame Cucumber Salad	Crunchy cucumbers in a gochugaru-sesame dressing — perfect alongside any Asian-inspired meal.	[{"name": "cucumber", "quantity": "2", "unit": "", "category": "produce"}, {"name": "sesame oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "rice vinegar", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "gochugaru", "quantity": "0.5", "unit": "tsp", "category": "spices"}, {"name": "toasted sesame seeds", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Slice cucumbers thinly. Toss with sesame oil, rice vinegar, gochugaru, and salt.", "Step 2: Garnish with sesame seeds. Serve chilled."]	5	0	5	2	{"calories": 40, "protein": 1.5, "carbs": 5.0, "fat": 2.0, "fiber": 2.5, "sugar": 2.5, "sodium_mg": 160}	easy	["side", "quick", "veg_side", "salad", "whole-food"]	["spicy", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	korean	["Hydrating", "Low calorie", "Rich in vitamin K"]	[]	[]	t	\N	2026-03-13 22:16:25.731578	veg_side	t	\N	[]	\N	null	f	null
18b6eeaf-36a8-4dc1-bfee-b26bba3c5769	Lentil Tabbouleh	A fiber-and-protein-rich twist on classic tabbouleh using green lentils instead of bulgur.	[{"name": "cooked green lentils", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "cucumber", "quantity": "1", "unit": "", "category": "produce"}, {"name": "cherry tomatoes", "quantity": "0.5", "unit": "cup", "category": "produce"}, {"name": "fresh parsley", "quantity": "0.5", "unit": "cup", "category": "produce"}, {"name": "fresh mint", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "lemon juice", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Dice cucumber and halve cherry tomatoes. Chop parsley and mint.", "Step 2: Combine lentils, vegetables, and herbs. Dress with olive oil and lemon juice. Season with salt."]	12	0	12	2	{"calories": 175, "protein": 10.0, "carbs": 22.0, "fat": 5.5, "fiber": 9.5, "sugar": 3.0, "sodium_mg": 170}	easy	["side", "quick", "veg_side", "salad", "whole-food"]	["tangy", "savory"]	["vegetarian", "dairy-free", "gluten-free"]	middle_eastern	["High fiber", "High iron", "Plant protein", "Rich in folate"]	["vegetarian"]	[]	t	\N	2026-03-13 22:16:25.731579	veg_side	t	\N	[]	\N	null	f	{"acid": true, "fiber_class": "high", "healthy_fat": true, "veg_density": "high", "recommended_timing": "before_meal"}
61c83e21-9b95-4433-b316-d5986043e8ad	Mediterranean Cucumber Tomato Salad	Crisp cucumber and ripe tomatoes with red onion, fresh herbs, and a bright olive oil dressing.	[{"name": "cucumber", "quantity": "2", "unit": "", "category": "produce"}, {"name": "roma tomatoes", "quantity": "3", "unit": "", "category": "produce"}, {"name": "red onion", "quantity": "0.5", "unit": "", "category": "produce"}, {"name": "fresh parsley", "quantity": "0.25", "unit": "cup", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "2", "unit": "tbsp", "category": "fats"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Dice cucumber, tomatoes, and red onion. Chop parsley.", "Step 2: Toss with olive oil, lemon juice, and salt. Chill 10 minutes before serving."]	10	0	10	2	{"calories": 95, "protein": 2.0, "carbs": 9.0, "fat": 7.0, "fiber": 3.5, "sugar": 4.0, "sodium_mg": 180}	easy	["side", "quick", "veg_side", "salad", "whole-food"]	["tangy", "savory"]	["vegetarian", "dairy-free", "gluten-free"]	mediterranean	["Rich in vitamin C", "Hydrating", "Antioxidant-rich"]	[]	[]	t	\N	2026-03-13 22:16:25.731579	veg_side	t	\N	[]	\N	null	f	{"acid": true, "fiber_class": "med", "healthy_fat": true, "veg_density": "high", "recommended_timing": "before_meal"}
10d032a1-4bdb-4747-b86d-847072059622	Mixed Green Salad with Avocado	Fresh mixed greens with creamy avocado, cherry tomatoes, and a simple olive oil vinaigrette.	[{"name": "mixed salad greens", "quantity": "4", "unit": "cups", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "", "category": "produce"}, {"name": "cherry tomatoes", "quantity": "0.5", "unit": "cup", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "apple cider vinegar", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Arrange greens on plates. Slice avocado and halve cherry tomatoes.", "Step 2: Top greens with avocado and tomatoes. Drizzle with olive oil and vinegar. Season with salt."]	5	0	5	2	{"calories": 130, "protein": 2.5, "carbs": 8.0, "fat": 11.0, "fiber": 6.0, "sugar": 2.0, "sodium_mg": 130}	easy	["side", "quick", "veg_side", "salad", "whole-food"]	["savory", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	global	["High fiber", "Heart-healthy fats", "Rich in potassium"]	[]	[]	t	\N	2026-03-13 22:16:25.731579	veg_side	t	\N	[]	\N	null	f	null
99eab198-a1ed-45e6-9819-7ab423c3c5a7	Pistachio Baklava Pastries	Baklawa meet croissant! Croissant meet Baklawa! This might quite possibly be the best dessert fusion you’ll ever have. Imagine a crispy flakey croissant filled with spiced pistachio filling and orange blossom syrup, and then finished off with crushed pistachios and rose petals! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps. Includes 2 whole-food ingredient swap(s).	[{"name": "8 croissants, 1 to 3 days old", "quantity": "6", "unit": "to", "category": "produce"}, {"name": "chopped pistachios", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "monk fruit powdered sweetener", "quantity": "", "unit": "", "category": "sweetener"}, {"name": "water", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "sugar", "quantity": "1/3", "unit": "cup", "category": "sweetener"}, {"name": "orange blossom water", "quantity": "1", "unit": "teaspoon", "category": "produce"}, {"name": "pistachio flour (see note below)", "quantity": "1 1/2", "unit": "cups", "category": "produce"}, {"name": "granulated monk fruit sweetener", "quantity": "3/4", "unit": "cup", "category": "sweetener"}, {"name": "cornstarch", "quantity": "1", "unit": "tablespoon", "category": "produce"}, {"name": "salt", "quantity": "1/4", "unit": "teaspoon", "category": "spices"}, {"name": "unsalted butter, room temperature", "quantity": "1/2", "unit": "cup", "category": "fats"}, {"name": "vanilla extract", "quantity": "2", "unit": "teaspoons", "category": "produce"}, {"name": "1 teaspoon cinnamon", "quantity": "1/2", "unit": "to", "category": "spices"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "heavy cream", "quantity": "2", "unit": "tablespoons", "category": "dairy"}]	["Step 1: To a pot over medium heat, add the water, sugar, and orange blossom water. Bring to a boil so all the sugar is dissolved and then reduce the heat to low and simmer for 10 minutes. Transfer to a bowl and allow to cool to room temperature so it thickens up.", "Step 2: To a bowl, add the pistachio flour, sugar, cornstarch, salt, unsalted butter, vanilla extract, eggs, and heavy cream.", "Step 3: Beat together until light and fluffy using a stand or hand mixer.", "Step 4: Preheat oven to 350\\u00b0F.", "Step 5: Slice the croissants in half to open them up like a book.", "Step 6: Soak both sides in the simple syrup. Be generous with it. You can brush the syrup on or just dunk it for a more efficient method.", "Step 7: Add the pistachio filling across the whole inside. Close the croissant. Add a line of pistachio filling across the top and sprinkle on chopped pistachios. Repeat with the rest of the croissants.", "Step 8: Bake in the oven for 12 to 15 minutes until crispy all around.", "Step 9: Allow to cool for 15 minutes, then dust with powdered sugar, and enjoy!."]	40	20	60	8	{"calories": 340, "protein": 6, "carbs": 38, "fat": 18, "fiber": 2}	medium	["snack", "sit-down"]	["sweet"]	[]	middle_eastern	["anti_inflammatory", "blood_sugar", "brain_health", "immune_support", "muscle_recovery", "skin_health"]	[]	[]	f	https://moribyan.com/wp-content/uploads/2023/03/IMG_9059.jpg	2026-03-13 22:16:25.73158	dessert	f	\N	[]	\N	null	f	null
6fa6c5e8-4577-4aa4-9abc-66bfaae1445e	Red Pepper Chicken	Meal-prep protein component with seasoned chicken in a silky red pepper finish.	[{"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "oregano", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}]	["Season the chicken with olive oil, salt, pepper, paprika, cumin, and oregano.", "Cook in a hot skillet with sliced onion until the chicken is cooked through and lightly browned.", "Slice and portion into meal-prep containers."]	10	15	25	2	{"calories": 240, "protein": 34.0, "carbs": 5.0, "fat": 8.0, "fiber": 1.0, "sugar": 2.0}	easy	["meal-prep", "whole-food", "protein_base", "protein_component", "red_pepper_bowl_group_v1"]	["savory", "smoky"]	["gluten-free", "dairy-free"]	mediterranean	["muscle_recovery"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.73158	protein_base	t	\N	[]	\N	null	f	null
89b3aecb-1bfd-4e77-9c01-8309a5f652b5	Roasted Asparagus with Garlic	Tender asparagus spears roasted with garlic and finished with a squeeze of lemon.	[{"name": "asparagus", "quantity": "1", "unit": "bunch", "category": "produce"}, {"name": "garlic cloves", "quantity": "3", "unit": "", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}, {"name": "black pepper", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Preheat oven to 400\\u00b0F. Trim asparagus and toss with olive oil, garlic, salt, and pepper.", "Step 2: Roast 12-15 minutes until tender with crisp edges."]	5	15	20	2	{"calories": 55, "protein": 3.5, "carbs": 6.0, "fat": 3.0, "fiber": 4.0, "sugar": 1.5, "sodium_mg": 120}	easy	["side", "quick", "veg_side", "whole-food"]	["savory"]	["vegetarian", "dairy-free", "gluten-free"]	mediterranean	["High fiber", "Rich in folate", "Anti-inflammatory"]	[]	[]	t	\N	2026-03-13 22:16:25.73158	veg_side	t	\N	[]	\N	null	f	null
9b571f3e-63a9-4a15-92a5-57ac52c8cbcc	Roasted Brussels Sprouts with Balsamic	Caramelized Brussels sprouts with a balsamic glaze — crispy edges, tender centers.	[{"name": "Brussels sprouts", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "balsamic vinegar", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}, {"name": "black pepper", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Preheat oven to 400\\u00b0F. Halve Brussels sprouts and toss with olive oil, salt, and pepper.", "Step 2: Roast 25 minutes until golden. Drizzle with balsamic vinegar and serve."]	5	25	30	2	{"calories": 90, "protein": 4.0, "carbs": 10.0, "fat": 5.0, "fiber": 5.0, "sugar": 3.0, "sodium_mg": 150}	easy	["side", "quick", "veg_side", "whole-food"]	["savory", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	american	["High fiber", "Rich in vitamin C", "Rich in vitamin K"]	[]	[]	t	\N	2026-03-13 22:16:25.731581	veg_side	t	\N	[]	\N	null	f	null
2bd8c92a-36e5-4513-957f-5b2c04fd1fe7	Roasted Cauliflower with Turmeric	Golden cauliflower florets roasted with turmeric and cumin for an anti-inflammatory side.	[{"name": "cauliflower florets", "quantity": "3", "unit": "cups", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "turmeric powder", "quantity": "0.5", "unit": "tsp", "category": "spices"}, {"name": "cumin powder", "quantity": "0.25", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}, {"name": "black pepper", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Preheat oven to 425\\u00b0F. Toss cauliflower with olive oil, turmeric, cumin, salt, and pepper.", "Step 2: Spread on a baking sheet and roast 25 minutes until golden and tender."]	5	25	30	2	{"calories": 85, "protein": 3.0, "carbs": 9.0, "fat": 5.0, "fiber": 4.5, "sugar": 3.0, "sodium_mg": 160}	easy	["side", "quick", "veg_side", "whole-food"]	["savory", "spicy"]	["vegetarian", "dairy-free", "gluten-free"]	indian	["Anti-inflammatory", "High fiber", "Rich in vitamin C"]	[]	[]	t	\N	2026-03-13 22:16:25.731581	veg_side	t	\N	[]	\N	null	f	null
790ebf9b-4a2a-4587-81ac-8612a7e5c6d6	Roasted Sweet Potato Wedges	Crispy-edged sweet potato wedges with smoked paprika — fiber-rich and naturally sweet.	[{"name": "sweet potatoes", "quantity": "2", "unit": "medium", "category": "produce"}, {"name": "avocado oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "smoked paprika", "quantity": "0.5", "unit": "tsp", "category": "spices"}, {"name": "garlic powder", "quantity": "0.25", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Preheat oven to 425\\u00b0F. Cut sweet potatoes into wedges and toss with oil and spices.", "Step 2: Spread on baking sheet and roast 30 minutes, flipping halfway, until crispy."]	5	30	35	2	{"calories": 160, "protein": 2.5, "carbs": 28.0, "fat": 5.0, "fiber": 5.5, "sugar": 6.0, "sodium_mg": 180}	easy	["side", "quick", "veg_side", "whole-food"]	["sweet", "savory"]	["vegetarian", "dairy-free", "gluten-free"]	american	["High fiber", "Rich in vitamin A", "Complex carbs"]	[]	["sweet_potato"]	t	\N	2026-03-13 22:16:25.731581	veg_side	t	\N	[]	\N	null	f	null
7981bb4f-29eb-4680-ad17-0a0e2055ee4c	Sardine and Avocado Breakfast Salad	Sardines, jammy eggs, avocado, cucumber, and greens with lemon and olive oil.	[{"name": "sardines in olive oil", "quantity": "1", "unit": "tin", "category": "protein"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "mixed greens", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "cucumber", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "pumpkin seeds", "quantity": "1", "unit": "tbsp", "category": "seeds"}, {"name": "lemon juice", "quantity": "2", "unit": "tsp", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}]	["Boil eggs for 7 minutes, then peel and halve them.", "Arrange greens, cucumber, avocado, sardines, and eggs in a bowl.", "Dress with lemon juice and olive oil, then finish with pumpkin seeds."]	10	7	17	1	{"calories": 450, "protein": 35, "carbs": 10, "fat": 28, "fiber": 7, "mes_score": 88.2, "mes_display_score": 88.2, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 84.6, "fs": 71.2, "fas": 90.4}}	easy	["breakfast", "quick"]	["savory", "umami"]	["gluten-free", "dairy-free"]	mediterranean	["anti_inflammatory", "bone_health", "brain_health", "detox_support", "heart_health", "hormone_support", "immune_support", "muscle_recovery", "skin_health"]	["eggs", "other_fish"]	[]	f	\N	2026-03-13 22:16:25.731582	full_meal	f	\N	[]	\N	null	t	null
c04ace8d-f816-4434-8274-4069b37cf56d	Sautéed Spinach with Garlic	Quick-wilted baby spinach with aromatic garlic in extra virgin olive oil.	[{"name": "baby spinach", "quantity": "6", "unit": "cups", "category": "produce"}, {"name": "garlic cloves", "quantity": "3", "unit": "", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}, {"name": "lemon juice", "quantity": "1", "unit": "tsp", "category": "produce"}]	["Step 1: Heat olive oil in a pan over medium heat. Saut\\u00e9 garlic 30 seconds.", "Step 2: Add spinach and cook 2-3 minutes until wilted. Season with salt and lemon juice."]	2	4	6	2	{"calories": 50, "protein": 3.5, "carbs": 4.0, "fat": 3.5, "fiber": 3.0, "sugar": 0.5, "sodium_mg": 200}	easy	["side", "quick", "veg_side", "whole-food"]	["savory"]	["vegetarian", "dairy-free", "gluten-free"]	mediterranean	["High iron", "Rich in folate", "Rich in vitamin K"]	[]	[]	t	\N	2026-03-13 22:16:25.731582	veg_side	t	\N	[]	\N	null	f	null
ed51416b-2b98-420f-b62e-0252c25802f0	Seasoned Rice	Meal prep rice component for shawarma bowls and plates.	[{"name": "brown rice (washed, uncooked)", "quantity": "1/2", "unit": "cup", "category": "grains"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "turmeric", "quantity": "1/4", "unit": "tsp", "category": "spices"}]	["Boil water or broth.", "Add rice, salt, and turmeric.", "Cover and simmer for 25 minutes until absorbed."]	3	25	28	5	{"calories": 160, "protein": 3.5, "carbs": 34, "fat": 1.2, "fiber": 2, "sugar": 0}	easy	["meal-prep", "whole-food", "shawarma_group_v1", "carb_base"]	["savory"]	["gluten-free", "dairy-free", "vegan"]	middle_eastern	["anti_inflammatory", "brain_health", "energy_boost", "immune_support"]	[]	["rice"]	f	\N	2026-03-13 22:16:25.731582	carb_base	t	\N	null	\N	null	f	null
0a501f01-6e98-402c-a2c8-4b98a7d457c2	Shawarma Chicken	Meal prep chicken shawarma protein component.	[{"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "black pepper", "quantity": "1", "unit": "pinch", "category": "spices"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cinnamon", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Cut chicken into chunks.", "Season with spices and oil.", "Cook in a hot pan with onions until done and lightly charred."]	8	12	20	5	{"calories": 220, "protein": 33, "carbs": 3, "fat": 8, "fiber": 0.5, "sugar": 1}	easy	["meal-prep", "whole-food", "shawarma_group_v1", "protein_base"]	["savory", "spicy", "umami"]	["gluten-free", "dairy-free"]	middle_eastern	["blood_sugar", "gut_health", "muscle_recovery", "skin_health"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.731583	protein_base	t	\N	null	\N	null	f	null
33af1e73-c242-40b9-808d-fa0853e61a05	Shawarma Chicken Thighs	Meal-prep protein component for shawarma bowls and plates.	[{"name": "chicken thighs", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "garlic, minced", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "cumin", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "cinnamon", "quantity": "pinch", "unit": "", "category": "spices"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}]	["Marinate chicken thighs with lemon juice, garlic, cumin, paprika, cinnamon, salt, and pepper.", "Cook chicken with sliced onion over medium-high heat until fully cooked and lightly charred.", "Slice and portion into meal-prep containers."]	10	20	30	2	{"calories": 300, "protein": 33.0, "carbs": 6.0, "fat": 15.0, "fiber": 1.2, "sugar": 1.5}	easy	["meal-prep", "whole-food", "protein_base", "protein_component", "shawarma_group_v2"]	["savory", "spicy", "umami"]	["gluten-free", "dairy-free"]	middle_eastern	["anti_inflammatory", "blood_sugar", "detox_support", "gut_health", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.731583	protein_base	t	\N	[]	\N	null	f	null
ee71fb47-a228-4281-a30f-af5dc20e70f7	Skillet Chicken Fajita Rice Bowl	A simple fajita-inspired bowl with seasoned chicken, brown rice, sauteed peppers and onion, finished with sour cream and hot sauce. Paired with cucumber tomato herb salad for a brighter, fresher plate.	[{"name": "brown rice, uncooked", "quantity": "1/2", "unit": "cup", "category": "grains"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "olive oil", "quantity": "1.5", "unit": "tsp", "category": "fats"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "garlic powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "red onion, chopped", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "red bell pepper, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "green bell pepper, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "fat-free sour cream", "quantity": "1/3", "unit": "cup", "category": "dairy"}, {"name": "hot sauce or sriracha", "quantity": "1", "unit": "tbsp", "category": "sauce"}]	["Start the rice first so everything finishes around the same time. Add the brown rice, water or broth, and a pinch of salt to a pot, bring it to a boil, then lower the heat, cover, and let it simmer until the rice is tender and the liquid is gone.", "While the rice cooks, slice the chicken into strips and season it with olive oil, salt, black pepper, paprika, chili powder, and garlic powder so every piece is well coated.", "Heat a skillet over medium-high heat. Add a little olive oil, then cook the onion and both bell peppers until they soften and pick up a little color but still keep some bite.", "Move the veggies out of the pan and add the chicken. Let it cook in a single layer for a few minutes on each side until it is cooked through and lightly browned around the edges.", "Return the peppers and onion to the pan, then stir in the sour cream and hot sauce just long enough to coat everything and make it creamy.", "Divide the rice into bowls, spoon the chicken fajita mixture over the top, and serve with the default cucumber tomato herb salad on the side. For the best metabolic response, eat the salad first."]	10	20	30	2	{"calories": 437, "protein": 39.5, "carbs": 48.0, "fat": 8.0, "fiber": 6.0, "sugar": 5.0, "mes_score": 64.7, "mes_display_score": 64.7, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 44.5, "pas": 98.0, "fs": 65.0, "fas": 45.0}, "mes_score_with_default_pairing": 67.7, "mes_default_pairing_delta": 6.9, "mes_default_pairing_adjusted_score": 71.6, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_id": "5fcd9514-aa74-4a39-9f7c-c5d21ab5a699", "mes_default_pairing_title": "Cucumber Tomato Herb Salad", "mes_default_pairing_role": "veg_side", "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"]}	easy	["dinner", "sit-down", "whole-food"]	["savory", "smoky", "spicy"]	["gluten-free"]	mexican	["blood_sugar", "energy_boost", "muscle_recovery"]	["chicken"]	["rice"]	f	\N	2026-03-13 22:16:25.731583	full_meal	f	\N	["5fcd9514-aa74-4a39-9f7c-c5d21ab5a699"]	t	null	t	null
c975e136-9360-44d5-b763-473b9713a2f0	Slow-Simmered Beef Bone Broth	There’s nothing like a cozy, warm bowl of beef bone broth, especially when the weather starts to cool down. This homemade version has all the flavor and goodness you’ll ever need, and it’s so much better than anything you’ll find on store shelves! Roasting the bones and veggies before simmering them adds layers of deep, rich flavor, and with warming spices like cinnamon and turmeric, this broth is perfect for sipping straight or using as a base for soups, stews, or even sauces. Let’s dive into how to make this cozy, nutrient-packed beef bone broth in the Instant Pot! Crafted with Real-Food standards: no seed oils, no refined sugar, gluten-smart swaps.	[{"name": "beef bones (marrow bones, knuckles, or oxtails)", "quantity": "6", "unit": "pounds", "category": "protein"}, {"name": "stalks, roughly chopped", "quantity": "5", "unit": "celery", "category": "produce"}, {"name": "roughly chopped", "quantity": "5", "unit": "carrots", "category": "produce"}, {"name": "onions, quartered", "quantity": "2", "unit": "large", "category": "produce"}, {"name": "cloves, smashed", "quantity": "12", "unit": "garlic", "category": "produce"}, {"name": "sprigs", "quantity": "5", "unit": "thyme", "category": "produce"}, {"name": "leaves", "quantity": "4", "unit": "bay", "category": "produce"}, {"name": "\\u00bd tablespoons apple cider vinegar", "quantity": "1", "unit": "", "category": "produce"}, {"name": "salt, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "white pepper, to taste", "quantity": "", "unit": "", "category": "spices"}, {"name": "cayenne powder, to taste", "quantity": "", "unit": "", "category": "produce"}, {"name": "12 cups water (enough to cover the bones)", "quantity": "10", "unit": "to", "category": "produce"}, {"name": "turmeric (or to taste)", "quantity": "1/2", "unit": "teaspoon", "category": "produce"}, {"name": "sticks", "quantity": "2", "unit": "cinnamon", "category": "produce"}, {"name": "black peppercorns", "quantity": "1", "unit": "tablespoon", "category": "spices"}]	["Step 1: Pre-Boil the Bones (Optional but Recommended): Place the beef bones in a large pot and cover them with water. Bring the water to a boil over high heat, and let the bones boil for 10-15 minutes. Drain and rinse the bones under cold water to remove impurities.", "Step 2: Roast the Bones and Vegetables: Preheat your oven to 425\\u00b0F (220\\u00b0C). On a large baking sheet, arrange the pre-boiled bones along with the chopped celery, carrots, and quartered onions. Roast everything for 45 to 55 minutes, until the bones and vegetables are deeply browned. This step enhances the flavor of your broth.", "Step 3: Prepare the Instant Pot: Transfer the roasted bones and vegetables to the Instant Pot. Add the garlic, thyme sprigs, bay leaves, peppercorns, cinnamon sticks, turmeric, salt, white pepper, and cayenne powder. Pour in the apple cider vinegar.", "Step 4: Add Water: Pour enough water into the Instant Pot to fully cover the bones and vegetables, making sure not to exceed the \\"Max Fill\\" line (about 10-12 cups of water).", "Step 5: Pressure Cook: Secure the Instant Pot lid and set the valve to \\"Sealing.\\" Cook on High Pressure for 2 hours (or up to 4 hours for a more intense broth).", "Step 6: Natural Release: After the cooking cycle is finished, allow the pressure to release naturally for about 20-30 minutes. Carefully open the lid once the pressure is fully released.", "Step 7: Strain the Broth: Using a fine-mesh strainer, strain the broth into a large pot or container, discarding the bones and vegetables (or saving any bits of meat if desired).", "Step 8: Cool and Store: Let the broth cool, then refrigerate overnight. Skim off any solidified fat that forms on top. Store the broth in jars or containers in the fridge for up to 5 days, or freeze for longer storage."]	60	180	180	8	{"calories": 45, "protein": 10, "carbs": 0, "fat": 1, "fiber": 0}	easy	["lunch", "bulk-cook"]	["savory", "umami"]	["dairy-free", "gluten-free"]	american	["anti_inflammatory", "blood_sugar", "bone_health", "brain_health", "detox_support", "gut_health", "immune_support", "muscle_recovery"]	["beef"]	[]	f	https://moribyan.com/wp-content/uploads/2024/10/IMG_3312.jpg	2026-03-13 22:16:25.731584	protein_base	t	\N	[]	\N	null	f	null
2df15af1-1461-4afe-a490-f8a65889a8df	Smoked Salmon Omelet with Avocado	A folded omelet with smoked salmon, spinach, herbs, and creamy avocado.	[{"name": "eggs", "quantity": "3", "unit": "large", "category": "protein"}, {"name": "egg whites", "quantity": "0.5", "unit": "cup", "category": "protein"}, {"name": "smoked salmon", "quantity": "3", "unit": "oz", "category": "protein"}, {"name": "fresh spinach", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "fresh dill", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "grass-fed butter", "quantity": "1", "unit": "tsp", "category": "dairy"}]	["Whisk eggs and egg whites. Melt butter in a nonstick skillet and wilt the spinach.", "Pour in eggs, cook until almost set, then add smoked salmon and dill to one side.", "Fold the omelet and serve with sliced avocado."]	6	8	14	1	{"calories": 460, "protein": 44, "carbs": 9, "fat": 28, "fiber": 7, "mes_score": 92.8, "mes_display_score": 92.8, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 100.0, "fs": 71.2, "fas": 90.4}}	easy	["breakfast", "quick"]	["savory", "umami"]	["gluten-free"]	mediterranean	["anti_inflammatory", "bone_health", "brain_health", "energy_boost", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["eggs", "salmon"]	[]	f	\N	2026-03-13 22:16:25.731584	full_meal	f	\N	[]	\N	null	t	null
c278c967-4fbb-4af0-b142-776798835b25	Smoky Burrito Chicken	Meal-prep protein component for burrito bowls.	[{"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "garlic powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}]	["Season the chicken well.", "Cook in a hot skillet until cooked through and lightly browned.", "Slice and portion into prep containers."]	10	15	25	2	{"calories": 250, "protein": 34.0, "carbs": 2.0, "fat": 8.0, "fiber": 0.0, "sugar": 0.0}	easy	["meal-prep", "whole-food", "protein_base", "protein_component", "burrito_bowl_group_v1"]	["savory", "smoky"]	["gluten-free", "dairy-free"]	mexican	[]	["chicken"]	[]	f	\N	2026-03-13 22:16:25.731584	protein_base	t	burrito_bowl_group_v1	[]	f	null	f	null
32e9985b-bae5-476e-9227-f38a154b782f	Smoky Chicken Potato Fiesta Bowl	A smoky, high-protein chicken and potato bowl with black beans, corn, and tomato for a hearty weeknight meal.	[{"name": "potatoes", "quantity": "2", "unit": "medium", "category": "produce"}, {"name": "olive oil", "quantity": "2", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "garlic powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "onion, sliced", "quantity": "1", "unit": "small", "category": "produce"}, {"name": "frozen corn", "quantity": "1/3", "unit": "cup", "category": "produce"}, {"name": "black beans", "quantity": "1/3", "unit": "cup", "category": "protein"}, {"name": "tomato, diced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "sour cream (optional)", "quantity": "1", "unit": "tbsp", "category": "dairy"}, {"name": "hot sauce", "quantity": "1", "unit": "tbsp", "category": "sauce"}]	["Start by preheating your oven to 450\\u00b0F so it is fully hot before the potatoes go in.", "Cut the potatoes into bite-size cubes, toss with olive oil, salt, pepper, garlic powder, paprika, and chili powder, then spread them on a tray and roast until golden and crisp on the edges, about 30 to 35 minutes.", "While the potatoes roast, cube the chicken and season it with olive oil, salt, pepper, paprika, and chili powder so every piece is evenly coated.", "Heat a large skillet, cook the chicken for a few minutes, then add onion and corn and keep cooking until the chicken is cooked through and the onion softens.", "Stir in black beans and diced tomato for the last minute just to warm everything through, then fold in the roasted potatoes.", "Serve hot in a bowl and finish with a spoon of sour cream and hot sauce if you want extra creaminess and heat."]	10	30	40	2	{"calories": 464, "protein": 44.0, "carbs": 49.5, "fat": 8.0, "fiber": 9.0, "sugar": 5.5, "mes_score": 69.9, "mes_display_score": 69.9, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 46.8, "pas": 100.0, "fs": 83.8, "fas": 45.0}, "mes_score_with_default_pairing": 73.4, "mes_default_pairing_delta": 7.5, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_explanation": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"], "mes_default_pairing_id": "0a823513-6446-45a3-b605-f9ba207ed52c", "mes_default_pairing_title": "Cilantro Lime Cabbage Slaw", "mes_default_pairing_role": "veg_side", "mes_default_pairing_adjusted_score": 77.4, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"]}	easy	["dinner", "fiesta_bowl_group_v1", "sit-down", "whole-food"]	["savory", "smoky", "spicy"]	["gluten-free"]	mexican	["anti_inflammatory", "blood_sugar", "energy_boost", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken"]	["potato"]	f	\N	2026-03-13 22:16:25.731585	full_meal	f	\N	["0a823513-6446-45a3-b605-f9ba207ed52c"]	t	null	t	null
0a6499aa-09ec-4552-a6ca-d10bf4c76506	Smoky Tomato Chicken Burrito Bowl	A hearty burrito bowl with tomato rice, seasoned chicken, peppers, corn, and black beans, paired with cilantro lime cabbage slaw.	[{"name": "brown rice", "quantity": "1/2", "unit": "cup uncooked", "category": "grains"}, {"name": "diced tomatoes", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"}, {"name": "olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "black pepper", "quantity": "to taste", "unit": "", "category": "spices"}, {"name": "garlic powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "paprika", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "chili powder", "quantity": "1/2", "unit": "tsp", "category": "spices"}, {"name": "small onion, sliced", "quantity": "1", "unit": "", "category": "produce"}, {"name": "green bell pepper, sliced", "quantity": "1", "unit": "medium", "category": "produce"}, {"name": "black beans", "quantity": "1/4", "unit": "cup", "category": "protein"}, {"name": "frozen corn", "quantity": "1/4", "unit": "cup", "category": "produce"}, {"name": "lettuce or spinach, chopped", "quantity": "1", "unit": "cup", "category": "produce"}, {"name": "sour cream", "quantity": "1", "unit": "tbsp", "category": "dairy"}, {"name": "hot sauce", "quantity": "1", "unit": "tbsp", "category": "sauce"}]	["Cook the tomato rice by simmering the brown rice with diced tomatoes, water or broth, and salt until tender.", "Season the chicken with olive oil, salt, pepper, garlic powder, paprika, and chili powder, then sear until cooked through and slice it up.", "Cook the onion and green bell pepper in the same pan until soft, then stir in the corn and black beans until warmed through.", "Build the bowl with tomato rice first, then chicken, peppers, onions, corn, beans, and greens.", "Serve it with the default Cilantro Lime Cabbage Slaw on the side for extra crunch and a better metabolic balance."]	10	25	35	2	{"calories": 457, "protein": 42.5, "carbs": 53.0, "fat": 6.0, "fiber": 9.0, "sugar": 6.0, "mes_score": 66.5, "mes_display_score": 66.5, "mes_tier": "moderate", "mes_display_tier": "moderate", "mes_sub_scores": {"gis": 41.5, "pas": 100.0, "fs": 83.8, "fas": 35.0}, "mes_score_with_default_pairing": 70.1, "mes_default_pairing_delta": 7.6, "mes_default_pairing_adjusted_score": 74.1, "mes_default_pairing_synergy_bonus": 1.5, "mes_default_pairing_id": "0a823513-6446-45a3-b605-f9ba207ed52c", "mes_default_pairing_title": "Cilantro Lime Cabbage Slaw", "mes_default_pairing_role": "veg_side", "mes_default_pairing_gis_bonus": 7.0, "mes_default_pairing_reasons": ["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"]}	easy	["dinner", "sit-down", "whole-food", "burrito_bowl_group_v1"]	["savory", "smoky", "spicy"]	["gluten-free"]	mexican	["blood_sugar", "energy_boost", "heart_health", "muscle_recovery"]	["chicken"]	["rice"]	f	\N	2026-03-13 22:16:25.731585	full_meal	f	\N	["0a823513-6446-45a3-b605-f9ba207ed52c"]	t	{"protein_component_title": "Smoky Burrito Chicken", "carb_component_title": "Tomato Brown Rice", "default_pairing_title": "Cilantro Lime Cabbage Slaw", "component_titles": ["Smoky Burrito Chicken", "Tomato Brown Rice"], "default_pairing_role": "veg_side"}	t	null
f589dd6b-c548-43a2-937f-62e43d67d1f9	Steak and Eggs with Chimichurri Greens	Sliced flank steak and eggs over arugula with herby chimichurri and avocado.	[{"name": "flank steak", "quantity": "5", "unit": "oz", "category": "protein"}, {"name": "eggs", "quantity": "2", "unit": "large", "category": "protein"}, {"name": "arugula", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "fresh parsley", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "fresh cilantro", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "garlic", "quantity": "1", "unit": "clove", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tbsp", "category": "fats"}, {"name": "red wine vinegar", "quantity": "2", "unit": "tsp", "category": "condiments"}]	["Blend parsley, cilantro, garlic, olive oil, and vinegar into a quick chimichurri.", "Sear steak to desired doneness and cook eggs in the same pan.", "Serve steak and eggs over arugula with avocado and spoon chimichurri over top."]	10	10	20	1	{"calories": 510, "protein": 42, "carbs": 8, "fat": 34, "fiber": 6, "mes_score": 92.3, "mes_display_score": 92.3, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 100.0, "fs": 65.0, "fas": 95.2}}	medium	["breakfast", "quick"]	["savory", "umami"]	["gluten-free", "dairy-free"]	american	["anti_inflammatory", "bone_health", "brain_health", "detox_support", "energy_boost", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["beef", "eggs"]	[]	f	\N	2026-03-13 22:16:25.731585	full_meal	f	\N	[]	\N	null	t	null
6af3da22-48c1-495a-925e-484f642a02cb	Steamed Broccoli with Lemon	Simple steamed broccoli finished with fresh lemon juice and a drizzle of extra virgin olive oil.	[{"name": "broccoli florets", "quantity": "3", "unit": "cups", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Steam broccoli for 4-5 minutes until bright green and tender-crisp.", "Step 2: Toss with lemon juice, olive oil, and salt. Serve warm."]	3	5	8	2	{"calories": 65, "protein": 4.5, "carbs": 8.0, "fat": 2.5, "fiber": 5.0, "sugar": 2.0, "sodium_mg": 150}	easy	["side", "quick", "veg_side", "whole-food"]	["savory", "tangy"]	["vegetarian", "dairy-free", "gluten-free"]	global	["High fiber", "Rich in vitamin C", "Anti-inflammatory"]	[]	[]	t	\N	2026-03-13 22:16:25.731586	veg_side	t	\N	[]	\N	null	f	null
3c37b6db-a489-4e92-b5c2-905c809be558	Steamed Green Beans with Almonds	Tender green beans topped with toasted sliced almonds and a touch of garlic butter.	[{"name": "green beans", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "sliced almonds", "quantity": "2", "unit": "tbsp", "category": "produce"}, {"name": "grass-fed butter", "quantity": "1", "unit": "tsp", "category": "dairy"}, {"name": "garlic clove", "quantity": "1", "unit": "", "category": "produce"}, {"name": "sea salt", "quantity": "", "unit": "pinch", "category": "spices"}]	["Step 1: Steam green beans for 5 minutes until bright green.", "Step 2: Melt butter in pan, toast almonds and garlic 2 minutes. Toss with beans and salt."]	3	7	10	2	{"calories": 80, "protein": 3.5, "carbs": 8.0, "fat": 4.5, "fiber": 4.0, "sugar": 2.0, "sodium_mg": 140}	easy	["side", "quick", "veg_side", "whole-food"]	["savory"]	["vegetarian", "gluten-free"]	american	["High fiber", "Rich in vitamin C", "Good source of vitamin E"]	[]	[]	t	\N	2026-03-13 22:16:25.731586	veg_side	t	\N	[]	\N	null	f	null
5a1cb990-eff7-483c-98ec-eba6b6b93074	Stir-Fried Bok Choy with Ginger	Quick-cooked baby bok choy with fresh ginger and a splash of coconut aminos.	[{"name": "baby bok choy", "quantity": "4", "unit": "heads", "category": "produce"}, {"name": "fresh ginger", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "garlic clove", "quantity": "1", "unit": "", "category": "produce"}, {"name": "sesame oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "coconut aminos", "quantity": "1", "unit": "tsp", "category": "produce"}]	["Step 1: Halve bok choy lengthwise. Mince ginger and garlic.", "Step 2: Heat sesame oil in wok. Stir-fry garlic and ginger 30 seconds, add bok choy, cook 3 minutes. Drizzle with coconut aminos."]	3	4	7	2	{"calories": 35, "protein": 2.5, "carbs": 3.5, "fat": 1.5, "fiber": 2.0, "sugar": 1.0, "sodium_mg": 140}	easy	["side", "quick", "veg_side", "whole-food"]	["savory", "umami"]	["vegetarian", "dairy-free", "gluten-free"]	chinese	["Low calorie", "Rich in vitamin A", "Rich in vitamin C"]	[]	[]	t	\N	2026-03-13 22:16:25.731586	veg_side	t	\N	[]	\N	null	f	null
819890cd-7a79-4299-80ed-ae2463a7d75a	Tomato Brown Rice	Meal-prep carb component for burrito bowls.	[{"name": "brown rice", "quantity": "1/2", "unit": "cup uncooked", "category": "grains"}, {"name": "diced tomatoes", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "water or broth", "quantity": "1", "unit": "cup", "category": "other"}, {"name": "sea salt", "quantity": "to taste", "unit": "", "category": "spices"}]	["Add rice, tomatoes, liquid, and salt to a pot.", "Simmer until tender and fluffy.", "Portion for meal prep."]	5	25	30	2	{"calories": 155, "protein": 3.5, "carbs": 31.0, "fat": 1.0, "fiber": 3.0, "sugar": 2.0}	easy	["meal-prep", "whole-food", "carb_base", "carb_component", "burrito_bowl_group_v1"]	["savory"]	["gluten-free", "dairy-free", "vegan"]	mexican	[]	[]	["rice"]	f	\N	2026-03-13 22:16:25.731587	carb_base	t	burrito_bowl_group_v1	[]	f	null	f	null
83ba9791-f3db-441d-9cd9-b29c0e6466c1	Tomato Cucumber Salad	Meal prep veggie salad component to pair with shawarma plates.	[{"name": "cucumber, chopped", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "tomatoes, chopped", "quantity": "1/2", "unit": "cup", "category": "produce"}, {"name": "lemon juice", "quantity": "1", "unit": "tsp", "category": "produce"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Combine chopped cucumber and tomatoes.", "Season with lemon juice and salt.", "Chill until ready to serve."]	8	0	8	5	{"calories": 45, "protein": 1.5, "carbs": 8, "fat": 0.5, "fiber": 2.5, "sugar": 4}	easy	["meal-prep", "whole-food", "shawarma_group_v1", "veg_side", "salad"]	["fresh", "savory"]	["gluten-free", "dairy-free", "vegan"]	mediterranean	["detox_support", "immune_support", "skin_health"]	[]	[]	f	\N	2026-03-13 22:16:25.731587	veg_side	t	\N	null	\N	null	f	null
b31cf8be-b884-4f87-a194-16a91ff6bd84	Turkey and Spinach Egg White Skillet	Lean ground turkey, egg whites, spinach, and avocado for a protein-heavy savory breakfast.	[{"name": "lean ground turkey", "quantity": "5", "unit": "oz", "category": "protein"}, {"name": "egg whites", "quantity": "0.75", "unit": "cup", "category": "protein"}, {"name": "fresh spinach", "quantity": "2", "unit": "cups", "category": "produce"}, {"name": "avocado", "quantity": "0.5", "unit": "whole", "category": "produce"}, {"name": "extra virgin olive oil", "quantity": "1", "unit": "tsp", "category": "fats"}, {"name": "red pepper flakes", "quantity": "0.25", "unit": "tsp", "category": "spices"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Heat olive oil in a skillet and cook turkey until browned and cooked through.", "Add spinach and cook until wilted, then pour in egg whites and gently scramble together.", "Plate with sliced avocado and finish with salt and red pepper flakes."]	8	10	18	1	{"calories": 430, "protein": 46, "carbs": 8, "fat": 22, "fiber": 7, "mes_score": 92.1, "mes_display_score": 92.1, "mes_tier": "optimal", "mes_display_tier": "optimal", "mes_sub_scores": {"gis": 100.0, "pas": 100.0, "fs": 71.2, "fas": 85.6}}	easy	["breakfast", "quick"]	["savory"]	["gluten-free", "dairy-free"]	american	["anti_inflammatory", "bone_health", "energy_boost", "heart_health", "immune_support", "muscle_recovery", "skin_health"]	["chicken", "eggs"]	[]	f	\N	2026-03-13 22:16:25.731587	full_meal	f	\N	[]	\N	null	t	null
edce49c5-21b3-4915-9e75-e9c381ed32fd	White Rice	Meal-prep carb base using fluffy white basmati rice.	[{"name": "white basmati rice", "quantity": "1", "unit": "cup", "category": "grains"}, {"name": "water", "quantity": "2", "unit": "cups", "category": "other"}, {"name": "sea salt", "quantity": "1", "unit": "pinch", "category": "spices"}]	["Rinse rice until water runs clear.", "Cook rice with water and salt until tender.", "Fluff and portion for meal prep."]	3	18	21	5	{"calories": 205, "protein": 4.2, "carbs": 45, "fat": 0.4, "fiber": 0.6, "sugar": 0.1}	easy	["meal-prep", "whole-food", "butter_chicken_group_v1", "carb_base", "carb_component"]	["mild"]	["gluten-free", "dairy-free", "vegan"]	indian	["skin_health"]	[]	["rice"]	f	\N	2026-03-13 22:16:25.731588	carb_base	t	\N	[]	\N	null	f	null
\.


--
-- Data for Name: saved_recipes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.saved_recipes (id, user_id, recipe_id, saved_at) FROM stdin;
\.


--
-- Data for Name: scanned_meal_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scanned_meal_logs (id, user_id, image_url, meal_label, scan_mode, meal_context, meal_type, portion_size, source_context, estimated_ingredients, normalized_ingredients, nutrition_estimate, whole_food_status, whole_food_flags, suggested_swaps, upgrade_suggestions, recovery_plan, mes_score, mes_tier, mes_sub_scores, pairing_opportunity, pairing_recommended_recipe_id, pairing_recommended_title, pairing_projected_mes, pairing_projected_delta, pairing_reasons, pairing_timing, confidence, confidence_breakdown, source_model, grounding_source, grounding_candidates, prompt_version, matched_recipe_id, matched_recipe_confidence, logged_food_log_id, logged_to_chronometer, created_at, updated_at) FROM stdin;
d3c1eb1a-62bb-4980-b5fe-9d8d98944c22	be56146c-bff6-44d6-9b17-6bc36227d00e	\N	Chicken and Rice with Mixed Salad	meal	full_meal	lunch	medium	home	["Chicken", "Rice", "Salad", "Cucumber", "Tomato", "Bell Pepper"]	["chicken", "rice", "salad", "cucumber", "tomato", "bell pepper", "Cooking Oil", "Salad Dressing", "Seasoning"]	{"calories": 296.2, "protein": 19.5, "carbs": 41.2, "fat": 5.8, "fiber": 3.8, "whole_food_summary": "This looks very close to a real-food product with minimal processing."}	pass	[]	{"seed_oils": [], "added_sugars": [], "refined_flours": [], "artificial_additives": [], "gums_or_emulsifiers": [], "protein_isolates": []}	["This looks like a reasonable estimate, but review ingredients and portion before logging.", "Pair this with Cucumber Tomato Herb Salad before the meal for about +10.4 MES.", "Add a more protein-forward base next time so the meal holds you longer."]	["Aim for about 40g protein at your next meal.", "Add at least 12g fiber with vegetables, beans, lentils, or chia.", "Use Cucumber Tomato Herb Salad before your next similar meal to soften the glycemic hit."]	37.2	low	{"gis": 51.4, "pas": 22.5, "fs": 40.2, "fas": 34.0}	t	5fcd9514-aa74-4a39-9f7c-c5d21ab5a699	Cucumber Tomato Herb Salad	47.6	10.4	["fiber-rich side", "acidic element", "healthy fat", "vegetable-forward side", "eat before meal"]	before_meal	0.71	{"extraction": 0.85, "portion": 0.75, "grounding": 0.38, "nutrition": 0.6, "estimate_mode": "medium", "review_required": false}	gemini-2.5-flash	heuristic_components	[{"recipe_id": "89b4e9ab-643b-49bc-9a12-eb41f00847c7", "title": "Creamy Red Pepper Chicken Rice Bowl", "score": 0.38, "lexical_score": 0.36, "vector_score": 0.0}, {"recipe_id": "0a6499aa-09ec-4552-a6ca-d10bf4c76506", "title": "Smoky Tomato Chicken Burrito Bowl", "score": 0.38, "lexical_score": 0.34, "vector_score": 0.0}, {"recipe_id": "331d6f6b-1128-466d-9f6d-1de9081b3794", "title": "Beef Chorizo and Chicken Pasta", "score": 0.37, "lexical_score": 0.33, "vector_score": 0.0}]	meal_scan_v2_grounded	89b4e9ab-643b-49bc-9a12-eb41f00847c7	0.38	3414d44a-1aa9-4cfb-a03c-1c1f682a331a	t	2026-03-13 23:55:26.806723	2026-03-13 23:55:37.464575
\.


--
-- Data for Name: user_achievements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_achievements (id, user_id, achievement_id, unlocked_at) FROM stdin;
\.


--
-- Data for Name: user_push_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_push_tokens (id, user_id, expo_push_token, device_id, platform, app_version, enabled, invalidated_at, last_seen_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, hashed_password, name, auth_provider, provider_subject, dietary_preferences, flavor_preferences, allergies, liked_ingredients, disliked_ingredients, protein_preferences, cooking_time_budget, household_size, budget_level, xp_points, current_streak, longest_streak, last_active_date, revenuecat_customer_id, subscription_product_id, subscription_store, subscription_status, subscription_trial_started_at, subscription_trial_ends_at, subscription_current_period_ends_at, subscription_will_renew, subscription_manage_url, subscription_last_synced_at, access_override_level, access_override_reason, access_override_expires_at, access_override_updated_at, created_at, updated_at) FROM stdin;
be56146c-bff6-44d6-9b17-6bc36227d00e	arahman.usa500@gmail.com	$2b$12$5JDkq5XLwNh5F04MyO7IG.rshBPrjOayNjl4ryaXEZZckN4XDZhoO	Araf Rahman	email	\N	["none"]	["spicy", "savory", "sweet", "tangy", "mild", "umami"]	["nuts", "sesame"]	[]	[]	{"liked": [], "disliked": []}	{}	1	medium	580	1	1	2026-03-13 22:16:06.748578	\N	\N	\N	inactive	\N	\N	\N	f	\N	\N	premium_lifetime	founder access	\N	2026-03-13 22:30:05.469254	2026-03-13 22:16:06.659217	2026-03-13 23:55:37.34934
\.


--
-- Data for Name: xp_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.xp_transactions (id, user_id, amount, reason, created_at) FROM stdin;
ebac39fc-d6d1-4949-8b46-5905cf015a76	be56146c-bff6-44d6-9b17-6bc36227d00e	5	browse_recipe	2026-03-13 22:41:19.081121
510c68ce-e077-49e9-bd65-bc634dbbf49f	be56146c-bff6-44d6-9b17-6bc36227d00e	500	weekly_meal_plan	2026-03-13 22:45:12.852408
e4e23d29-254a-4cf7-a640-9661a8d8c9c9	be56146c-bff6-44d6-9b17-6bc36227d00e	50	meal_log	2026-03-13 22:50:38.978661
0e567a3d-89dd-41dd-99e0-281b08124c0d	be56146c-bff6-44d6-9b17-6bc36227d00e	25	metabolic_tier:moderate	2026-03-13 23:55:37.347636
\.


--
-- Name: achievements achievements_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_name_key UNIQUE (name);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkey PRIMARY KEY (version_num);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: daily_nutrition_summary daily_nutrition_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_nutrition_summary
    ADD CONSTRAINT daily_nutrition_summary_pkey PRIMARY KEY (id);


--
-- Name: daily_quests daily_quests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quests
    ADD CONSTRAINT daily_quests_pkey PRIMARY KEY (id);


--
-- Name: food_logs food_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_logs
    ADD CONSTRAINT food_logs_pkey PRIMARY KEY (id);


--
-- Name: grocery_lists grocery_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grocery_lists
    ADD CONSTRAINT grocery_lists_pkey PRIMARY KEY (id);


--
-- Name: local_foods local_foods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_foods
    ADD CONSTRAINT local_foods_pkey PRIMARY KEY (id);


--
-- Name: meal_plan_items meal_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_plan_items
    ADD CONSTRAINT meal_plan_items_pkey PRIMARY KEY (id);


--
-- Name: meal_plans meal_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_pkey PRIMARY KEY (id);


--
-- Name: metabolic_budgets metabolic_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_budgets
    ADD CONSTRAINT metabolic_budgets_pkey PRIMARY KEY (id);


--
-- Name: metabolic_profiles metabolic_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_profiles
    ADD CONSTRAINT metabolic_profiles_pkey PRIMARY KEY (id);


--
-- Name: metabolic_scores metabolic_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_scores
    ADD CONSTRAINT metabolic_scores_pkey PRIMARY KEY (id);


--
-- Name: metabolic_streaks metabolic_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_streaks
    ADD CONSTRAINT metabolic_streaks_pkey PRIMARY KEY (id);


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- Name: notification_events notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: nutrition_streaks nutrition_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_streaks
    ADD CONSTRAINT nutrition_streaks_pkey PRIMARY KEY (id);


--
-- Name: nutrition_targets nutrition_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_targets
    ADD CONSTRAINT nutrition_targets_pkey PRIMARY KEY (id);


--
-- Name: recipe_embeddings recipe_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_embeddings
    ADD CONSTRAINT recipe_embeddings_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: saved_recipes saved_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_recipes
    ADD CONSTRAINT saved_recipes_pkey PRIMARY KEY (id);


--
-- Name: scanned_meal_logs scanned_meal_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scanned_meal_logs
    ADD CONSTRAINT scanned_meal_logs_pkey PRIMARY KEY (id);


--
-- Name: daily_nutrition_summary uq_daily_nutrition_user_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_nutrition_summary
    ADD CONSTRAINT uq_daily_nutrition_user_date UNIQUE (user_id, date);


--
-- Name: daily_quests uq_daily_quest_user_date_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quests
    ADD CONSTRAINT uq_daily_quest_user_date_type UNIQUE (user_id, date, quest_type);


--
-- Name: metabolic_scores uq_metabolic_score_user_date_scope_log; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_scores
    ADD CONSTRAINT uq_metabolic_score_user_date_scope_log UNIQUE (user_id, date, scope, food_log_id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_push_tokens user_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: xp_transactions xp_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id);


--
-- Name: ix_daily_nutrition_summary_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_nutrition_summary_date ON public.daily_nutrition_summary USING btree (date);


--
-- Name: ix_daily_nutrition_summary_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_nutrition_summary_user_id ON public.daily_nutrition_summary USING btree (user_id);


--
-- Name: ix_daily_quests_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_quests_date ON public.daily_quests USING btree (date);


--
-- Name: ix_daily_quests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_quests_user_id ON public.daily_quests USING btree (user_id);


--
-- Name: ix_food_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_food_logs_date ON public.food_logs USING btree (date);


--
-- Name: ix_food_logs_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_food_logs_group_id ON public.food_logs USING btree (group_id);


--
-- Name: ix_food_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_food_logs_user_id ON public.food_logs USING btree (user_id);


--
-- Name: ix_local_foods_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_local_foods_name ON public.local_foods USING btree (name);


--
-- Name: ix_metabolic_budgets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_metabolic_budgets_user_id ON public.metabolic_budgets USING btree (user_id);


--
-- Name: ix_metabolic_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_metabolic_profiles_user_id ON public.metabolic_profiles USING btree (user_id);


--
-- Name: ix_metabolic_scores_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_metabolic_scores_date ON public.metabolic_scores USING btree (date);


--
-- Name: ix_metabolic_scores_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_metabolic_scores_user_id ON public.metabolic_scores USING btree (user_id);


--
-- Name: ix_metabolic_streaks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_metabolic_streaks_user_id ON public.metabolic_streaks USING btree (user_id);


--
-- Name: ix_notification_deliveries_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_deliveries_category ON public.notification_deliveries USING btree (category);


--
-- Name: ix_notification_deliveries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_deliveries_created_at ON public.notification_deliveries USING btree (created_at);


--
-- Name: ix_notification_deliveries_push_token_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_deliveries_push_token_id ON public.notification_deliveries USING btree (push_token_id);


--
-- Name: ix_notification_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_deliveries_status ON public.notification_deliveries USING btree (status);


--
-- Name: ix_notification_deliveries_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_deliveries_user_id ON public.notification_deliveries USING btree (user_id);


--
-- Name: ix_notification_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_events_event_type ON public.notification_events USING btree (event_type);


--
-- Name: ix_notification_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_events_occurred_at ON public.notification_events USING btree (occurred_at);


--
-- Name: ix_notification_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_events_user_id ON public.notification_events USING btree (user_id);


--
-- Name: ix_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_notification_preferences_user_id ON public.notification_preferences USING btree (user_id);


--
-- Name: ix_nutrition_streaks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_nutrition_streaks_user_id ON public.nutrition_streaks USING btree (user_id);


--
-- Name: ix_nutrition_targets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_nutrition_targets_user_id ON public.nutrition_targets USING btree (user_id);


--
-- Name: ix_recipe_embeddings_recipe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_recipe_embeddings_recipe_id ON public.recipe_embeddings USING btree (recipe_id);


--
-- Name: ix_recipe_embeddings_text_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipe_embeddings_text_hash ON public.recipe_embeddings USING btree (text_hash);


--
-- Name: ix_recipes_cuisine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipes_cuisine ON public.recipes USING btree (cuisine);


--
-- Name: ix_recipes_meal_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipes_meal_group_id ON public.recipes USING btree (meal_group_id);


--
-- Name: ix_recipes_recipe_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipes_recipe_role ON public.recipes USING btree (recipe_role);


--
-- Name: ix_recipes_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recipes_title ON public.recipes USING btree (title);


--
-- Name: ix_saved_recipes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_saved_recipes_user_id ON public.saved_recipes USING btree (user_id);


--
-- Name: ix_scanned_meal_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_scanned_meal_logs_user_id ON public.scanned_meal_logs USING btree (user_id);


--
-- Name: ix_user_push_tokens_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_push_tokens_device_id ON public.user_push_tokens USING btree (device_id);


--
-- Name: ix_user_push_tokens_expo_push_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_push_tokens_expo_push_token ON public.user_push_tokens USING btree (expo_push_token);


--
-- Name: ix_user_push_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_push_tokens_user_id ON public.user_push_tokens USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_provider_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_provider_subject ON public.users USING btree (provider_subject);


--
-- Name: ix_users_revenuecat_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_revenuecat_customer_id ON public.users USING btree (revenuecat_customer_id);


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: daily_nutrition_summary daily_nutrition_summary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_nutrition_summary
    ADD CONSTRAINT daily_nutrition_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: daily_quests daily_quests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quests
    ADD CONSTRAINT daily_quests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: food_logs food_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_logs
    ADD CONSTRAINT food_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: grocery_lists grocery_lists_meal_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grocery_lists
    ADD CONSTRAINT grocery_lists_meal_plan_id_fkey FOREIGN KEY (meal_plan_id) REFERENCES public.meal_plans(id);


--
-- Name: grocery_lists grocery_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grocery_lists
    ADD CONSTRAINT grocery_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: meal_plan_items meal_plan_items_meal_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_plan_items
    ADD CONSTRAINT meal_plan_items_meal_plan_id_fkey FOREIGN KEY (meal_plan_id) REFERENCES public.meal_plans(id);


--
-- Name: meal_plan_items meal_plan_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_plan_items
    ADD CONSTRAINT meal_plan_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: meal_plans meal_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: metabolic_budgets metabolic_budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_budgets
    ADD CONSTRAINT metabolic_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: metabolic_profiles metabolic_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_profiles
    ADD CONSTRAINT metabolic_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: metabolic_scores metabolic_scores_food_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_scores
    ADD CONSTRAINT metabolic_scores_food_log_id_fkey FOREIGN KEY (food_log_id) REFERENCES public.food_logs(id);


--
-- Name: metabolic_scores metabolic_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_scores
    ADD CONSTRAINT metabolic_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: metabolic_streaks metabolic_streaks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metabolic_streaks
    ADD CONSTRAINT metabolic_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notification_deliveries notification_deliveries_push_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_push_token_id_fkey FOREIGN KEY (push_token_id) REFERENCES public.user_push_tokens(id);


--
-- Name: notification_deliveries notification_deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notification_events notification_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: nutrition_streaks nutrition_streaks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_streaks
    ADD CONSTRAINT nutrition_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: nutrition_targets nutrition_targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_targets
    ADD CONSTRAINT nutrition_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recipe_embeddings recipe_embeddings_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_embeddings
    ADD CONSTRAINT recipe_embeddings_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: saved_recipes saved_recipes_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_recipes
    ADD CONSTRAINT saved_recipes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: saved_recipes saved_recipes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_recipes
    ADD CONSTRAINT saved_recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: scanned_meal_logs scanned_meal_logs_logged_food_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scanned_meal_logs
    ADD CONSTRAINT scanned_meal_logs_logged_food_log_id_fkey FOREIGN KEY (logged_food_log_id) REFERENCES public.food_logs(id);


--
-- Name: scanned_meal_logs scanned_meal_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scanned_meal_logs
    ADD CONSTRAINT scanned_meal_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id);


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_push_tokens user_push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: xp_transactions xp_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict UhgQt6nCFI7T5YicQKnwoFyUqqFn2jIrwlCIUqkOKiB45yCKLqSXj6N555z3pEt

