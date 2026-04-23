from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.nutrition import FoodLog
from app.models.recipe import Recipe
from app.services.gemini_client import (
    GeminiCallFailed,
    call_gemini_with_fallback,
    extract_text_from_response,
)
from app.services.metabolic_engine import (
    build_glycemic_nutrition_input,
    classify_meal_context,
    compute_meal_mes,
    compute_meal_mes_with_pairing,
    load_budget_for_user,
    should_score_meal,
)
from app.services.whole_food_scoring import analyze_whole_food_product


settings = get_settings()
logger = logging.getLogger(__name__)
MEAL_SCAN_PROMPT_VERSION = "meal_scan_v4_consensus"

SNACK_CALORIE_CEILING = 250.0
SNACK_CARB_CEILING = 18.0
SNACK_SUGAR_CEILING = 10.0
SNACK_PROTEIN_FLOOR = 12.0
SNACK_FRUIT_CALORIE_CEILING = 400.0

# Fruit/produce keywords for snack detection
FRUIT_LABEL_KEYWORDS = {"fruit", "berries", "melon", "salad", "produce", "bowl"}
FRUIT_INGREDIENT_KEYWORDS = {
    "apple", "orange", "grape", "berry", "berries", "melon", "watermelon",
    "banana", "mango", "pineapple", "strawberry", "blueberry", "raspberry",
    "kiwi", "peach", "plum", "pear", "cherry", "fig", "papaya", "lychee",
    "pomegranate", "grapefruit", "tangerine", "clementine", "guava",
}

PORTION_MULTIPLIERS = {
    "small": 0.8,
    "medium": 1.0,
    "large": 1.25,
}

COMPONENT_MACROS: dict[str, dict[str, float]] = {
    # ── Proteins ──────────────────────────────────────────────────────────────
    "chicken": {"calories": 180, "protein": 30, "carbs": 0, "fat": 7, "fiber": 0},
    "chicken thigh": {"calories": 210, "protein": 24, "carbs": 0, "fat": 13, "fiber": 0},
    "beef": {"calories": 240, "protein": 24, "carbs": 0, "fat": 16, "fiber": 0},
    "ground beef": {"calories": 270, "protein": 24, "carbs": 0, "fat": 19, "fiber": 0},
    "lamb": {"calories": 260, "protein": 23, "carbs": 0, "fat": 18, "fiber": 0},
    "pork": {"calories": 230, "protein": 26, "carbs": 0, "fat": 14, "fiber": 0},
    "salmon": {"calories": 210, "protein": 22, "carbs": 0, "fat": 13, "fiber": 0},
    "tuna": {"calories": 150, "protein": 30, "carbs": 0, "fat": 3, "fiber": 0},
    "turkey": {"calories": 170, "protein": 28, "carbs": 0, "fat": 6, "fiber": 0},
    "shrimp": {"calories": 120, "protein": 23, "carbs": 1, "fat": 2, "fiber": 0},
    "tofu": {"calories": 140, "protein": 15, "carbs": 3, "fat": 8, "fiber": 1},
    "paneer": {"calories": 280, "protein": 18, "carbs": 3, "fat": 22, "fiber": 0},
    "eggs": {"calories": 160, "protein": 13, "carbs": 1, "fat": 11, "fiber": 0},
    "egg whites": {"calories": 80, "protein": 17, "carbs": 1, "fat": 0, "fiber": 0},
    "greek yogurt": {"calories": 150, "protein": 20, "carbs": 9, "fat": 5, "fiber": 0},
    "yogurt": {"calories": 120, "protein": 8, "carbs": 14, "fat": 4, "fiber": 0},
    # ── Grains & Carbs ────────────────────────────────────────────────────────
    "rice": {"calories": 205, "protein": 4, "carbs": 45, "fat": 0, "fiber": 1},
    "brown rice": {"calories": 215, "protein": 5, "carbs": 45, "fat": 2, "fiber": 3},
    "quinoa": {"calories": 220, "protein": 8, "carbs": 39, "fat": 4, "fiber": 5},
    "potatoes": {"calories": 160, "protein": 4, "carbs": 37, "fat": 0, "fiber": 4},
    "sweet potato": {"calories": 180, "protein": 4, "carbs": 41, "fat": 0, "fiber": 6},
    "pasta": {"calories": 220, "protein": 8, "carbs": 43, "fat": 2, "fiber": 3},
    "noodles": {"calories": 210, "protein": 7, "carbs": 42, "fat": 1, "fiber": 2},
    "oats": {"calories": 180, "protein": 7, "carbs": 32, "fat": 4, "fiber": 5},
    "granola": {"calories": 190, "protein": 4, "carbs": 30, "fat": 7, "fiber": 3},
    "bread": {"calories": 160, "protein": 6, "carbs": 30, "fat": 2, "fiber": 3},
    "bun": {"calories": 170, "protein": 6, "carbs": 31, "fat": 3, "fiber": 2},
    "tortilla": {"calories": 140, "protein": 4, "carbs": 24, "fat": 4, "fiber": 2},
    "roti": {"calories": 120, "protein": 4, "carbs": 20, "fat": 3, "fiber": 3},
    "naan": {"calories": 170, "protein": 6, "carbs": 30, "fat": 4, "fiber": 1},
    "pita": {"calories": 160, "protein": 6, "carbs": 31, "fat": 2, "fiber": 2},
    "crackers": {"calories": 130, "protein": 3, "carbs": 20, "fat": 5, "fiber": 1},
    # ── Legumes ───────────────────────────────────────────────────────────────
    "beans": {"calories": 140, "protein": 8, "carbs": 24, "fat": 1, "fiber": 8},
    "black beans": {"calories": 140, "protein": 8, "carbs": 24, "fat": 1, "fiber": 8},
    "chickpeas": {"calories": 160, "protein": 9, "carbs": 27, "fat": 3, "fiber": 8},
    "lentils": {"calories": 180, "protein": 12, "carbs": 31, "fat": 1, "fiber": 10},
    "hummus": {"calories": 70, "protein": 2, "carbs": 6, "fat": 5, "fiber": 2},
    "dal": {"calories": 170, "protein": 11, "carbs": 28, "fat": 2, "fiber": 9},
    # ── Dairy & Fats ──────────────────────────────────────────────────────────
    "cheese": {"calories": 110, "protein": 7, "carbs": 1, "fat": 9, "fiber": 0},
    "feta": {"calories": 80, "protein": 4, "carbs": 1, "fat": 6, "fiber": 0},
    "avocado": {"calories": 120, "protein": 2, "carbs": 6, "fat": 11, "fiber": 5},
    "olive oil": {"calories": 120, "protein": 0, "carbs": 0, "fat": 14, "fiber": 0},
    "ghee": {"calories": 130, "protein": 0, "carbs": 0, "fat": 15, "fiber": 0},
    "butter": {"calories": 102, "protein": 0, "carbs": 0, "fat": 12, "fiber": 0},
    "milk": {"calories": 100, "protein": 7, "carbs": 12, "fat": 4, "fiber": 0},
    "cream": {"calories": 200, "protein": 2, "carbs": 4, "fat": 20, "fiber": 0},
    # ── Nuts & Seeds ──────────────────────────────────────────────────────────
    "almonds": {"calories": 165, "protein": 6, "carbs": 6, "fat": 14, "fiber": 4},
    "cashews": {"calories": 160, "protein": 5, "carbs": 9, "fat": 13, "fiber": 1},
    "peanuts": {"calories": 165, "protein": 7, "carbs": 6, "fat": 14, "fiber": 2},
    "walnuts": {"calories": 185, "protein": 4, "carbs": 4, "fat": 18, "fiber": 2},
    "pistachios": {"calories": 160, "protein": 6, "carbs": 8, "fat": 13, "fiber": 3},
    "mixed nuts": {"calories": 170, "protein": 5, "carbs": 6, "fat": 15, "fiber": 2},
    "trail mix": {"calories": 190, "protein": 5, "carbs": 20, "fat": 11, "fiber": 2},
    "almond butter": {"calories": 100, "protein": 3, "carbs": 3, "fat": 9, "fiber": 2},
    "peanut butter": {"calories": 190, "protein": 8, "carbs": 7, "fat": 16, "fiber": 2},
    "chia": {"calories": 60, "protein": 2, "carbs": 5, "fat": 4, "fiber": 5},
    "flaxseed": {"calories": 55, "protein": 2, "carbs": 3, "fat": 4, "fiber": 3},
    # ── Vegetables ───────────────────────────────────────────────────────────
    "salad": {"calories": 70, "protein": 2, "carbs": 10, "fat": 3, "fiber": 4},
    "vegetables": {"calories": 60, "protein": 2, "carbs": 11, "fat": 1, "fiber": 4},
    "broccoli": {"calories": 55, "protein": 4, "carbs": 11, "fat": 1, "fiber": 5},
    "spinach": {"calories": 35, "protein": 4, "carbs": 4, "fat": 0, "fiber": 3},
    "kale": {"calories": 45, "protein": 3, "carbs": 8, "fat": 1, "fiber": 3},
    "tomato": {"calories": 30, "protein": 1, "carbs": 6, "fat": 0, "fiber": 2},
    "cucumber": {"calories": 20, "protein": 1, "carbs": 4, "fat": 0, "fiber": 1},
    "onion": {"calories": 45, "protein": 1, "carbs": 10, "fat": 0, "fiber": 2},
    "pepper": {"calories": 30, "protein": 1, "carbs": 6, "fat": 0, "fiber": 2},
    "mushroom": {"calories": 25, "protein": 4, "carbs": 4, "fat": 0, "fiber": 2},
    "corn": {"calories": 130, "protein": 5, "carbs": 27, "fat": 2, "fiber": 4},
    # ── Fruit (per medium piece / 1-cup serving) ─────────────────────────────
    "berries": {"calories": 45, "protein": 1, "carbs": 11, "fat": 0, "fiber": 3},
    "strawberries": {"calories": 45, "protein": 1, "carbs": 11, "fat": 0, "fiber": 3},
    "blueberries": {"calories": 85, "protein": 1, "carbs": 21, "fat": 0, "fiber": 4},
    "apple": {"calories": 95, "protein": 0, "carbs": 25, "fat": 0, "fiber": 4},
    "banana": {"calories": 105, "protein": 1, "carbs": 27, "fat": 0, "fiber": 3},
    "orange": {"calories": 62, "protein": 1, "carbs": 15, "fat": 0, "fiber": 3},
    "mango": {"calories": 100, "protein": 1, "carbs": 25, "fat": 0, "fiber": 3},
    "grapes": {"calories": 100, "protein": 1, "carbs": 27, "fat": 0, "fiber": 1},
    "pineapple": {"calories": 80, "protein": 1, "carbs": 20, "fat": 0, "fiber": 2},
    "watermelon": {"calories": 85, "protein": 2, "carbs": 21, "fat": 0, "fiber": 1},
    "peach": {"calories": 60, "protein": 1, "carbs": 14, "fat": 0, "fiber": 2},
    "pear": {"calories": 100, "protein": 1, "carbs": 27, "fat": 0, "fiber": 6},
    "pomegranate": {"calories": 83, "protein": 2, "carbs": 19, "fat": 1, "fiber": 4},
    "fruit": {"calories": 80, "protein": 1, "carbs": 20, "fat": 0, "fiber": 3},
    # ── Snack foods ───────────────────────────────────────────────────────────
    "chips": {"calories": 150, "protein": 2, "carbs": 16, "fat": 9, "fiber": 1},
    "popcorn": {"calories": 110, "protein": 3, "carbs": 22, "fat": 2, "fiber": 4},
    "protein bar": {"calories": 200, "protein": 20, "carbs": 22, "fat": 7, "fiber": 4},
    "granola bar": {"calories": 190, "protein": 4, "carbs": 30, "fat": 7, "fiber": 2},
    "rice cakes": {"calories": 70, "protein": 1, "carbs": 15, "fat": 0, "fiber": 0},
    "energy bar": {"calories": 220, "protein": 10, "carbs": 28, "fat": 8, "fiber": 3},
    # ── Sauces & Condiments ───────────────────────────────────────────────────
    "sauce": {"calories": 50, "protein": 1, "carbs": 7, "fat": 2, "fiber": 1},
    "dressing": {"calories": 80, "protein": 0, "carbs": 4, "fat": 7, "fiber": 0},
    "ketchup": {"calories": 20, "protein": 0, "carbs": 5, "fat": 0, "fiber": 0},
    "mayo": {"calories": 100, "protein": 0, "carbs": 1, "fat": 11, "fiber": 0},
    "tahini": {"calories": 90, "protein": 3, "carbs": 3, "fat": 8, "fiber": 1},
    # ── Indian dishes (per typical serving) ──────────────────────────────────
    "curry": {"calories": 280, "protein": 14, "carbs": 22, "fat": 16, "fiber": 4},
    "biryani": {"calories": 350, "protein": 20, "carbs": 45, "fat": 10, "fiber": 3},
    "samosa": {"calories": 260, "protein": 5, "carbs": 28, "fat": 15, "fiber": 3},
    "chaat": {"calories": 220, "protein": 6, "carbs": 35, "fat": 7, "fiber": 4},
    "idli": {"calories": 160, "protein": 5, "carbs": 32, "fat": 1, "fiber": 2},
    "dosa": {"calories": 220, "protein": 6, "carbs": 38, "fat": 5, "fiber": 2},
    "paratha": {"calories": 250, "protein": 6, "carbs": 36, "fat": 10, "fiber": 3},
    "palak": {"calories": 170, "protein": 10, "carbs": 15, "fat": 8, "fiber": 5},
    "tikka": {"calories": 240, "protein": 28, "carbs": 8, "fat": 12, "fiber": 2},
    "korma": {"calories": 300, "protein": 22, "carbs": 12, "fat": 20, "fiber": 2},
    "rajma": {"calories": 200, "protein": 12, "carbs": 32, "fat": 4, "fiber": 9},
    "raita": {"calories": 80, "protein": 4, "carbs": 8, "fat": 3, "fiber": 1},
    # ── Indian sweets (per 1-2 piece serving ~50-80 g) ───────────────────────
    # sugar_g is explicit because most of these carbs are added sugar / jaggery
    "ladoo": {"calories": 200, "protein": 4, "carbs": 28, "fat": 9, "fiber": 2, "sugar_g": 22},
    "laddu": {"calories": 200, "protein": 4, "carbs": 28, "fat": 9, "fiber": 2, "sugar_g": 22},
    "barfi": {"calories": 220, "protein": 5, "carbs": 30, "fat": 10, "fiber": 1, "sugar_g": 24},
    "burfi": {"calories": 220, "protein": 5, "carbs": 30, "fat": 10, "fiber": 1, "sugar_g": 24},
    "halwa": {"calories": 280, "protein": 5, "carbs": 38, "fat": 13, "fiber": 2, "sugar_g": 28},
    "halva": {"calories": 280, "protein": 5, "carbs": 38, "fat": 13, "fiber": 2, "sugar_g": 28},
    "gulab jamun": {"calories": 220, "protein": 4, "carbs": 38, "fat": 7, "fiber": 0, "sugar_g": 35},
    "jalebi": {"calories": 200, "protein": 2, "carbs": 40, "fat": 5, "fiber": 1, "sugar_g": 38},
    "kheer": {"calories": 220, "protein": 7, "carbs": 35, "fat": 7, "fiber": 0, "sugar_g": 28},
    "payasam": {"calories": 210, "protein": 6, "carbs": 34, "fat": 7, "fiber": 1, "sugar_g": 26},
    "rasgulla": {"calories": 130, "protein": 3, "carbs": 28, "fat": 1, "fiber": 0, "sugar_g": 26},
    "peda": {"calories": 200, "protein": 5, "carbs": 28, "fat": 9, "fiber": 0, "sugar_g": 22},
    "mysore pak": {"calories": 250, "protein": 5, "carbs": 27, "fat": 14, "fiber": 1, "sugar_g": 20},
    "kaju katli": {"calories": 210, "protein": 5, "carbs": 25, "fat": 11, "fiber": 1, "sugar_g": 20},
    "besan": {"calories": 190, "protein": 7, "carbs": 27, "fat": 7, "fiber": 3, "sugar_g": 10},
    "mithai": {"calories": 210, "protein": 4, "carbs": 30, "fat": 9, "fiber": 1, "sugar_g": 24},
    "sweet": {"calories": 200, "protein": 3, "carbs": 32, "fat": 8, "fiber": 1, "sugar_g": 26},
    "indian sweet": {"calories": 210, "protein": 4, "carbs": 30, "fat": 9, "fiber": 1, "sugar_g": 24},
    # ── Desserts ──────────────────────────────────────────────────────────────
    "chocolate": {"calories": 170, "protein": 2, "carbs": 20, "fat": 10, "fiber": 2, "sugar_g": 17},
    "ice cream": {"calories": 210, "protein": 4, "carbs": 28, "fat": 10, "fiber": 0, "sugar_g": 22},
    "cake": {"calories": 340, "protein": 4, "carbs": 52, "fat": 13, "fiber": 1, "sugar_g": 40},
    "cookie": {"calories": 180, "protein": 2, "carbs": 26, "fat": 8, "fiber": 1, "sugar_g": 15},
    "brownie": {"calories": 240, "protein": 3, "carbs": 33, "fat": 12, "fiber": 1, "sugar_g": 22},
    "donut": {"calories": 270, "protein": 4, "carbs": 33, "fat": 14, "fiber": 1, "sugar_g": 18},
    "muffin": {"calories": 280, "protein": 4, "carbs": 38, "fat": 13, "fiber": 1, "sugar_g": 22},
    # ── High-sugar fruits ─────────────────────────────────────────────────────
    "grapes": {"calories": 100, "protein": 1, "carbs": 27, "fat": 0, "fiber": 1, "sugar_g": 23},
    "mango": {"calories": 100, "protein": 1, "carbs": 25, "fat": 0, "fiber": 3, "sugar_g": 23},
    "banana": {"calories": 105, "protein": 1, "carbs": 27, "fat": 0, "fiber": 3, "sugar_g": 14},
    # ── Additional Proteins ─────────────────────────────────────────────────
    "duck": {"calories": 250, "protein": 20, "carbs": 0, "fat": 18, "fiber": 0},
    "bison": {"calories": 190, "protein": 28, "carbs": 0, "fat": 8, "fiber": 0},
    "venison": {"calories": 180, "protein": 30, "carbs": 0, "fat": 6, "fiber": 0},
    "tempeh": {"calories": 195, "protein": 20, "carbs": 8, "fat": 11, "fiber": 5},
    "seitan": {"calories": 130, "protein": 25, "carbs": 4, "fat": 2, "fiber": 1},
    "crab": {"calories": 100, "protein": 20, "carbs": 0, "fat": 2, "fiber": 0},
    "lobster": {"calories": 130, "protein": 27, "carbs": 0, "fat": 1, "fiber": 0},
    "scallops": {"calories": 110, "protein": 20, "carbs": 5, "fat": 1, "fiber": 0},
    "mussels": {"calories": 150, "protein": 20, "carbs": 6, "fat": 4, "fiber": 0},
    "clams": {"calories": 130, "protein": 22, "carbs": 4, "fat": 2, "fiber": 0},
    "sardines": {"calories": 210, "protein": 24, "carbs": 0, "fat": 12, "fiber": 0},
    "cod": {"calories": 120, "protein": 26, "carbs": 0, "fat": 1, "fiber": 0},
    "halibut": {"calories": 140, "protein": 27, "carbs": 0, "fat": 3, "fiber": 0},
    "trout": {"calories": 170, "protein": 24, "carbs": 0, "fat": 8, "fiber": 0},
    "swordfish": {"calories": 165, "protein": 27, "carbs": 0, "fat": 6, "fiber": 0},
    "mahi mahi": {"calories": 110, "protein": 24, "carbs": 0, "fat": 1, "fiber": 0},
    "lamb chop": {"calories": 280, "protein": 22, "carbs": 0, "fat": 21, "fiber": 0},
    "pork chop": {"calories": 230, "protein": 27, "carbs": 0, "fat": 13, "fiber": 0},
    # ── Additional Grains ───────────────────────────────────────────────────
    "farro": {"calories": 200, "protein": 7, "carbs": 37, "fat": 2, "fiber": 5},
    "freekeh": {"calories": 190, "protein": 8, "carbs": 33, "fat": 2, "fiber": 8},
    "spelt": {"calories": 210, "protein": 8, "carbs": 40, "fat": 2, "fiber": 5},
    "amaranth": {"calories": 250, "protein": 9, "carbs": 46, "fat": 4, "fiber": 5},
    "teff": {"calories": 255, "protein": 10, "carbs": 50, "fat": 2, "fiber": 7},
    "sorghum": {"calories": 220, "protein": 7, "carbs": 47, "fat": 2, "fiber": 6},
    "couscous": {"calories": 175, "protein": 6, "carbs": 36, "fat": 0, "fiber": 2},
    "bulgur": {"calories": 150, "protein": 6, "carbs": 34, "fat": 0, "fiber": 8},
    "polenta": {"calories": 145, "protein": 3, "carbs": 31, "fat": 1, "fiber": 2},
    "grits": {"calories": 150, "protein": 4, "carbs": 33, "fat": 1, "fiber": 1},
    # ── Additional Vegetables ───────────────────────────────────────────────
    "bok choy": {"calories": 20, "protein": 3, "carbs": 3, "fat": 0, "fiber": 2},
    "cabbage": {"calories": 25, "protein": 1, "carbs": 6, "fat": 0, "fiber": 2},
    "cauliflower": {"calories": 30, "protein": 2, "carbs": 5, "fat": 0, "fiber": 2},
    "zucchini": {"calories": 20, "protein": 1, "carbs": 4, "fat": 0, "fiber": 1},
    "eggplant": {"calories": 35, "protein": 1, "carbs": 9, "fat": 0, "fiber": 3},
    "asparagus": {"calories": 30, "protein": 3, "carbs": 5, "fat": 0, "fiber": 3},
    "green beans": {"calories": 35, "protein": 2, "carbs": 7, "fat": 0, "fiber": 3},
    "brussels sprouts": {"calories": 55, "protein": 4, "carbs": 11, "fat": 0, "fiber": 4},
    "artichoke": {"calories": 65, "protein": 4, "carbs": 14, "fat": 0, "fiber": 7},
    "beets": {"calories": 60, "protein": 2, "carbs": 13, "fat": 0, "fiber": 4},
    "turnip": {"calories": 35, "protein": 1, "carbs": 8, "fat": 0, "fiber": 2},
    "parsnip": {"calories": 100, "protein": 2, "carbs": 24, "fat": 0, "fiber": 6},
    "celery": {"calories": 15, "protein": 1, "carbs": 3, "fat": 0, "fiber": 2},
    "radish": {"calories": 20, "protein": 1, "carbs": 4, "fat": 0, "fiber": 2},
    "okra": {"calories": 35, "protein": 2, "carbs": 7, "fat": 0, "fiber": 3},
    "squash": {"calories": 40, "protein": 1, "carbs": 10, "fat": 0, "fiber": 2},
    "pumpkin": {"calories": 50, "protein": 2, "carbs": 12, "fat": 0, "fiber": 3},
    # ── International Dishes ────────────────────────────────────────────────
    "falafel": {"calories": 330, "protein": 13, "carbs": 32, "fat": 18, "fiber": 5},
    "kebab": {"calories": 260, "protein": 24, "carbs": 6, "fat": 16, "fiber": 1},
    "gyro": {"calories": 300, "protein": 20, "carbs": 28, "fat": 14, "fiber": 2},
    "sushi roll": {"calories": 250, "protein": 9, "carbs": 38, "fat": 7, "fiber": 2},
    "pad thai": {"calories": 380, "protein": 16, "carbs": 50, "fat": 14, "fiber": 2},
    "stir fry": {"calories": 280, "protein": 20, "carbs": 22, "fat": 14, "fiber": 4},
    "ramen noodles": {"calories": 380, "protein": 14, "carbs": 52, "fat": 14, "fiber": 2},
    "udon noodles": {"calories": 230, "protein": 7, "carbs": 48, "fat": 1, "fiber": 2},
    "soba noodles": {"calories": 200, "protein": 8, "carbs": 42, "fat": 1, "fiber": 3},
    "rice noodles": {"calories": 190, "protein": 3, "carbs": 44, "fat": 0, "fiber": 1},
}

ALIASES = {
    # Proteins
    "shawarma chicken": "chicken",
    "grilled chicken": "chicken",
    "roasted chicken": "chicken",
    "baked chicken": "chicken",
    "chicken breast": "chicken",
    "beef patty": "beef",
    "meat patty": "beef",
    "meat patties": "beef",
    "chicken patty": "chicken",
    "burger patty": "beef",
    "ground meat": "ground beef",
    "minced beef": "ground beef",
    "smoked salmon": "salmon",
    "grilled fish": "salmon",
    "fish fillet": "salmon",
    "shrimp prawns": "shrimp",
    "scrambled eggs": "eggs",
    "fried eggs": "eggs",
    "boiled eggs": "eggs",
    "hard boiled egg": "eggs",
    "poached eggs": "eggs",
    "cottage cheese": "greek yogurt",
    "plain greek yogurt": "greek yogurt",
    "yogurt sauce": "greek yogurt",
    "curd": "yogurt",
    "dahi": "yogurt",
    # Grains
    "burger bun": "bun",
    "white rice": "rice",
    "basmati rice": "rice",
    "jasmine rice": "rice",
    "steamed rice": "rice",
    "fried rice": "rice",
    "chapati": "roti",
    "flatbread": "roti",
    "whole wheat roti": "roti",
    "pita bread": "pita",
    "oatmeal": "oats",
    "rolled oats": "oats",
    # Vegetables & salads
    "kachumber": "salad",
    "mixed greens": "salad",
    "leafy greens": "salad",
    "green salad": "salad",
    "coleslaw": "salad",
    "mixed vegetables": "vegetables",
    "stir fry vegetables": "vegetables",
    "roasted vegetables": "vegetables",
    "bell pepper": "pepper",
    "capsicum": "pepper",
    # Nuts & seeds
    "chia seeds": "chia",
    "flax seeds": "flaxseed",
    "mixed almonds": "almonds",
    "roasted almonds": "almonds",
    "roasted cashews": "cashews",
    "roasted peanuts": "peanuts",
    "almond butter": "almond butter",
    "peanut butter": "peanut butter",
    # Fruit
    "fresh fruit": "fruit",
    "sliced fruit": "fruit",
    "fruit salad": "fruit",
    "apple slices": "apple",
    "banana slices": "banana",
    "mango slices": "mango",
    "mixed berries": "berries",
    "fresh berries": "berries",
    # Indian dishes
    "chicken tikka masala": "tikka",
    "butter chicken": "curry",
    "chicken curry": "curry",
    "vegetable curry": "curry",
    "paneer tikka": "tikka",
    "paneer butter masala": "korma",
    "palak paneer": "palak",
    "saag": "palak",
    "masoor dal": "dal",
    "toor dal": "dal",
    "chana masala": "chickpeas",
    "chole": "chickpeas",
    "aloo": "potatoes",
    "gobi": "broccoli",
    "vegetable biryani": "biryani",
    "chicken biryani": "biryani",
    # Indian sweets
    "besan ladoo": "ladoo",
    "motichoor ladoo": "ladoo",
    "boondi ladoo": "ladoo",
    "besan barfi": "barfi",
    "kaju barfi": "kaju katli",
    "cashew barfi": "kaju katli",
    "cashew fudge": "kaju katli",
    "besan halwa": "halwa",
    "sooji halwa": "halwa",
    "suji halwa": "halwa",
    "carrot halwa": "halwa",
    "gajar halwa": "halwa",
    "semolina halwa": "halwa",
    "milk fudge": "peda",
    "milk sweet": "peda",
    "milk cake": "peda",
    "rice kheer": "kheer",
    "vermicelli kheer": "kheer",
    "semiya payasam": "payasam",
    "assorted sweets": "mithai",
    "assorted indian sweets": "mithai",
    "indian sweets": "mithai",
    "desi sweets": "mithai",
    "mithai box": "mithai",
    "sweet box": "mithai",
    # Desserts
    "dark chocolate": "chocolate",
    "milk chocolate": "chocolate",
    "chocolate bar": "chocolate",
    "vanilla ice cream": "ice cream",
    "chocolate cake": "cake",
    "birthday cake": "cake",
    "cheesecake": "cake",
    "chocolate chip cookie": "cookie",
    "oatmeal cookie": "cookie",
    # Additional protein aliases
    "grilled salmon": "salmon",
    "baked salmon": "salmon",
    "roasted duck": "duck",
    "duck breast": "duck",
    "ground bison": "bison",
    "bison burger": "bison",
    "venison steak": "venison",
    "grilled shrimp": "shrimp",
    "prawns": "shrimp",
    "king prawns": "shrimp",
    "fried shrimp": "shrimp",
    "grilled lobster": "lobster",
    "lobster tail": "lobster",
    "pan seared scallops": "scallops",
    "grilled scallops": "scallops",
    "canned sardines": "sardines",
    "baked cod": "cod",
    "grilled cod": "cod",
    "fish": "cod",
    "grilled halibut": "halibut",
    "rainbow trout": "trout",
    "grilled swordfish": "swordfish",
    "grilled mahi mahi": "mahi mahi",
    "lamb chops": "lamb chop",
    "grilled lamb": "lamb",
    "pork chops": "pork chop",
    "grilled pork": "pork",
    "pork tenderloin": "pork",
    "pork loin": "pork",
    "turkey breast": "turkey",
    "ground turkey": "turkey",
    # Additional grain aliases
    "cooked farro": "farro",
    "cooked quinoa": "quinoa",
    "cooked bulgur": "bulgur",
    "whole wheat couscous": "couscous",
    "israeli couscous": "couscous",
    "corn grits": "grits",
    "corn polenta": "polenta",
    # Additional vegetable aliases
    "roasted cauliflower": "cauliflower",
    "grilled zucchini": "zucchini",
    "roasted eggplant": "eggplant",
    "grilled asparagus": "asparagus",
    "steamed broccoli": "broccoli",
    "roasted brussels sprouts": "brussels sprouts",
    "roasted beets": "beets",
    "butternut squash": "squash",
    "acorn squash": "squash",
    "spaghetti squash": "squash",
    "roasted pumpkin": "pumpkin",
    "napa cabbage": "cabbage",
    "red cabbage": "cabbage",
    # International dish aliases
    "chicken kebab": "kebab",
    "lamb kebab": "kebab",
    "seekh kebab": "kebab",
    "shish kebab": "kebab",
    "lamb gyro": "gyro",
    "chicken gyro": "gyro",
    "california roll": "sushi roll",
    "maki roll": "sushi roll",
    "sushi": "sushi roll",
    "chicken pad thai": "pad thai",
    "shrimp pad thai": "pad thai",
    "vegetable stir fry": "stir fry",
    "chicken stir fry": "stir fry",
    "beef stir fry": "stir fry",
    "ramen": "ramen noodles",
    "udon": "udon noodles",
    "soba": "soba noodles",
    "pho noodles": "rice noodles",
    "vermicelli": "rice noodles",
}

MEAL_SCAN_PROMPT = """You analyze a photo for a nutrition app that scores how "whole food" a meal is.
The user may photograph a prepared meal, a packaged-food label, a drink, or something else entirely.
Your FIRST job is to classify what kind of photo this is, then extract the appropriate data.

Return strict JSON only with this exact shape:
{
  "scan_type": "meal",
  "scan_type_confidence": 0.0,
  "not_food": false,
  "not_food_reason": "",
  "is_beverage": false,
  "multi_dish": false,
  "dishes": [
    {
      "meal_label": "short dish name",
      "components": [
        {
          "name": "component or ingredient",
          "role": "protein|carb|veg|fat|sauce|dessert|other|fruit",
          "portion_factor": 1.0,
          "mass_fraction": 0.0,
          "nova": 1,
          "methods": [],
          "visible": true,
          "confidence": 0.0
        }
      ],
      "possible_hidden_ingredients": [
        {
          "name": "ingredient",
          "reason": "short reason",
          "confidence": 0.0
        }
      ]
    }
  ],
  "meal_label": "short dish name (main or combined)",
  "meal_type_guess": "breakfast|lunch|dinner|snack",
  "source_context_guess": "home|restaurant",
  "portion_size": "small|medium|large",
  "preparation_style": "grilled|fried|baked|fresh|mixed|unknown",
  "confidence": 0.0,
  "confidence_breakdown": {
    "extraction": 0.0,
    "portion": 0.0
  },
  "components": [
    {
      "name": "component or ingredient",
      "role": "protein|carb|veg|fat|sauce|dessert|other|fruit",
      "portion_factor": 1.0,
      "mass_fraction": 0.0,
      "nova": 1,
      "methods": [],
      "visible": true,
      "confidence": 0.0
    }
  ],
  "possible_hidden_ingredients": [
    {
      "name": "ingredient",
      "reason": "short reason",
      "confidence": 0.0
    }
  ]
}

Rules:
- scan_type: classify the photo into one of four kinds. This is AUTHORITATIVE — the other fields follow from it.
    * "meal"     — a prepared meal, plate of food, bowl, sandwich, etc. ready to eat. This is the common case. Extract components as described below.
    * "label"    — a packaged food product. The dominant subject is branded packaging, a nutrition-facts panel, an ingredient list, or a UPC barcode. Boxes, bags, bottles, cans, wrappers. Return scan_type="label" and LEAVE components/nutrition empty — the server will re-analyze with a label extractor. You may still set meal_label to the product name you see.
    * "beverage" — ONLY a drink is visible (coffee, latte, smoothie, juice, cocktail, plain water). No solid food on the plate.
    * "not_food" — keys, phone, hands, scenery, a restaurant menu page, a receipt, an empty plate, a person, etc. Set not_food_reason to a short description.
- scan_type_confidence: 0-1, how sure you are of the classification. Drop below 0.7 only when the image is ambiguous (e.g. a meal kit box that shows some prepared food on the cover).
- Edge cases:
    * A HELD packaged snack bar still counts as "label" (the subject is the product).
    * A plated meal next to a water glass is still "meal" (water is incidental).
    * A protein shake in a branded bottle is "label" (the bottle is the subject) unless the image is clearly of the drink poured out, in which case "beverage".
    * A photo of a restaurant menu is "not_food".
- If scan_type is "not_food", set not_food=true. Leave all other fields at defaults.
- If scan_type is "beverage", set is_beverage=true and describe the drink as a single component. Do NOT set not_food for drinks.
- If scan_type is "label", you may skip the full components + nutrition extraction — the server will re-call a label-specific extractor. Setting meal_label to the visible product name (e.g. "Lay's Classic Potato Chips") is still helpful.
- For scan_type "meal" (the common case), extract components and nutrition as the rest of the rules describe.
- If multiple DISTINCT dishes are visible (e.g. a plate of pasta AND a separate bowl of salad, or meal prep containers with different items), set multi_dish to true and populate the dishes array with one entry per dish. Still fill the top-level components with ALL components combined.
- If it's a single dish (even with multiple components like rice + chicken + veggies), set multi_dish to false and leave dishes as an empty array.
- prefer concrete food names over vague labels (e.g. "grilled chicken breast" not "meat"; "pizza dough" not "crust"; "pepperoni" not "cured meat topping")
- use 0.25 to 1.5 for portion_factor
- mass_fraction: estimate each component's share of the meal by weight (0.0-1.0). The sum of mass_fractions across top-level components should be close to 1.0. If unsure, leave at 0.0 and the server will default to equal weighting.
- nova: assign a NOVA processing level per component:
    1 = unprocessed / minimally processed whole food (grilled chicken, broccoli, brown rice, plain yogurt, raw fruit)
    2 = processed culinary ingredient (olive oil, butter, honey, salt, table sugar, vinegar)
    3 = processed food (cheese, cured meat, canned fish in oil, bread, pasta, pizza dough, white rice, french fries, bacon, ham)
    4 = ultra-processed (chicken nuggets, pepperoni, hot dogs, sugary cereals, energy bars with isolates, soft drinks, flavored yogurt, american / processed cheese, margarine)
  Err HIGHER when in doubt — recognizable processing (breading, frying, curing, flaking, extruding) bumps NOVA to 3 or 4. A pizza slice should have: pizza_dough (nova 3, refined_flour), mozzarella (nova 3), pepperoni (nova 4, cured_meat).
- methods: list applicable cooking methods per component — e.g. ["grilled"], ["fried"], ["battered"], ["baked"], ["raw"], ["breaded"], ["deep-fried"], ["cured"].
- possible_hidden_ingredients: aggressively list processing signals the dish probably contains even if not directly visible. Use tags from: refined_flour, seed_oil, seed_oil_fried, added_sugar, cured_meat, processed_cheese, sodium_high. Examples:
    * Any pizza → refined_flour (dough), processed_cheese (mozz in US pizzas), and cured_meat if pepperoni/sausage/bacon visible.
    * Any carbonara / amatriciana → refined_flour (spaghetti), cured_meat (guanciale/pancetta/bacon).
    * Any cheeseburger → refined_flour (bun), processed_cheese (unless explicitly fresh/real), seed_oil_fried (if fries visible or patty griddle-fried in commercial oil).
    * Any french fries / tater tots / fried chicken / fried calamari → seed_oil_fried.
    * Any sandwich with deli meat → refined_flour (bread), cured_meat.
    * Any ramen / instant noodles → refined_flour, sodium_high.
    * Any breakfast pastry / donut / pancake with syrup → refined_flour, added_sugar.
- if uncertain, choose medium confidence and say unknown less often than inventing ingredients
- meal_label should be consumer friendly
- use role "fruit" for fruit components (apple, banana, grapes, berries, melon, etc.)
- keep the response compact and avoid extra explanation text
"""


def _normalize_name(name: str) -> str:
    value = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    value = re.sub(r"\s+", " ", value).strip()
    return ALIASES.get(value, value)


def _titleize_name(value: str) -> str:
    return " ".join(part.capitalize() for part in (value or "").split())


def _estimate_sugar_g(nutrition: dict[str, float]) -> float:
    return max(0.0, round(float(nutrition.get("carbs", 0) or 0) * 0.18, 1))


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


async def _call_gemini_meal_extractor(
    image_bytes: bytes,
    mime_type: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    prompt = MEAL_SCAN_PROMPT + "\n\nContext:\n" + json.dumps(context, indent=2)
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    try:
        result = await call_gemini_with_fallback(payload=payload)
    except GeminiCallFailed as exc:
        logger.warning("Gemini meal scan failed after retry+fallback: %s", exc)
        raise
    text_part = extract_text_from_response(result.json)
    parsed = _extract_json(text_part)
    # Stamp which model actually served the response so the router can
    # include it in confidence / scoring decisions.
    parsed.setdefault("_gemini_meta", {})
    parsed["_gemini_meta"]["model"] = result.model
    parsed["_gemini_meta"]["attempts"] = result.attempts
    return parsed


def _eligible_pairing_recipe(recipe: Recipe | None) -> bool:
    return bool(recipe and getattr(recipe, "pairing_synergy_profile", None))


def _pairing_rank_for_scan(recipe: Recipe, nutrition: dict[str, float]) -> float:
    profile = getattr(recipe, "pairing_synergy_profile", None) or {}
    fiber_class = str(profile.get("fiber_class", "none") or "none").lower()
    veg_density = str(profile.get("veg_density", "none") or "none").lower()
    score = {"none": 0.0, "low": 1.0, "med": 2.0, "high": 3.0}.get(fiber_class, 0.0)
    score += {"none": 0.0, "low": 0.0, "med": 1.0, "high": 2.0}.get(veg_density, 0.0)
    if bool(profile.get("acid")):
        score += 1.5
    if bool(profile.get("healthy_fat")):
        score += 1.0
    if str(profile.get("recommended_timing", "with_meal")).lower() == "before_meal":
        score += 0.5

    fiber = float(nutrition.get("fiber", 0) or 0)
    fat = float(nutrition.get("fat", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    net_carbs = max(0.0, carbs - fiber)
    if fiber < 8:
        score += 1.5
    if fat < 10:
        score += 0.5
    if net_carbs >= 30:
        score += 1.0
    return score


def _find_pairing_candidate(
    db: Session,
    nutrition: dict[str, float],
    matched_recipe: Recipe | None,
    budget: Any,
) -> dict[str, Any] | None:
    candidates: list[Recipe] = []
    if matched_recipe is not None:
        default_ids = [str(v) for v in (getattr(matched_recipe, "default_pairing_ids", None) or []) if v]
        if default_ids:
            defaults = db.query(Recipe).filter(Recipe.id.in_(default_ids)).all()
            candidates.extend([r for r in defaults if _eligible_pairing_recipe(r)])

    if not candidates:
        fallback = db.query(Recipe).filter(
            Recipe.recipe_role.in_(["veg_side", "sauce", "carb_base", "protein_base"])
        ).all()
        candidates.extend([r for r in fallback if _eligible_pairing_recipe(r)])

    if not candidates:
        return None

    ranked = sorted(
        candidates,
        key=lambda recipe: (
            -_pairing_rank_for_scan(recipe, nutrition),
            recipe.total_time_min or 0,
            recipe.title.lower(),
        ),
    )
    chosen = ranked[0]
    current_score = compute_meal_mes(nutrition, budget)
    paired = compute_meal_mes_with_pairing(
        nutrition,
        pairing_recipe=chosen,
        budget=budget,
        pairing_nutrition=build_glycemic_nutrition_input(chosen.nutrition_info or {}, source=chosen),
    )
    if not paired.get("pairing_applied"):
        return None

    projected = float(((paired.get("score") or {}).get("display_score", current_score["display_score"])) or current_score["display_score"])
    delta = round(projected - float(current_score.get("display_score", 0) or 0), 1)
    if delta < 1.0:
        return None

    return {
        "pairing_opportunity": True,
        "pairing_recommended_recipe_id": str(chosen.id),
        "pairing_recommended_title": chosen.title,
        "pairing_projected_mes": round(projected, 1),
        "pairing_projected_delta": delta,
        "pairing_reasons": paired.get("pairing_reasons") or [],
        "pairing_timing": paired.get("pairing_recommended_timing", "with_meal"),
    }


def _stable_visible_components(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stable: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for component in components:
        raw_name = str(component.get("name", "")).strip()
        normalized_name = _normalize_name(raw_name)
        if not normalized_name:
            continue
        confidence = float(component.get("confidence", 0) or 0)
        visible = bool(component.get("visible", True))
        if confidence < 0.4:
            continue
        if not visible and confidence < 0.6:
            continue
        role = str(component.get("role", "other") or "other")
        key = (normalized_name, role)
        if key in seen:
            continue
        seen.add(key)
        stable.append(
            {
                **component,
                "name": normalized_name,
                "role": role,
                "confidence": confidence,
                "visible": visible,
            }
        )
    return stable


def _derive_stable_meal_label(
    raw_label: str,
    components: list[dict[str, Any]],
    matched_recipe: Recipe | None,
    recipe_match_score: float,
) -> str:
    if matched_recipe and recipe_match_score >= 0.6:
        return matched_recipe.title

    cleaned = re.sub(r"\s+", " ", (raw_label or "").strip())
    cleaned = re.sub(r"\b(with|and|in|on|over|under|w)\s*$", "", cleaned, flags=re.I).strip(" ,:-")

    generic_terms = {
        "meal",
        "scanned meal",
        "meat patty",
        "meat patties",
        "patty",
        "patties",
    }
    if cleaned and cleaned.lower() not in generic_terms:
        return cleaned

    ordered_names = [_titleize_name(str(component.get("name", ""))) for component in components if component.get("name")]
    if not ordered_names:
        return "Detected meal"
    if len(ordered_names) == 1:
        return ordered_names[0]
    return f"{ordered_names[0]} with {ordered_names[1]}"


def _lookup_component_macros(name: str) -> dict[str, float] | None:
    normalized = _normalize_name(name)
    # Exact match first
    if normalized in COMPONENT_MACROS:
        return COMPONENT_MACROS[normalized]
    # Best (longest-key) substring match
    best_key: str | None = None
    best_len = 0
    for key in COMPONENT_MACROS:
        if key in normalized or normalized in key:
            if len(key) > best_len:
                best_key = key
                best_len = len(key)
    return COMPONENT_MACROS[best_key] if best_key else None


_ROLE_FALLBACK_MACROS: dict[str, dict[str, float]] = {
    "protein":  {"calories": 180, "protein": 25, "carbs": 2,  "fat": 8,  "fiber": 0},
    "carb":     {"calories": 200, "protein": 5,  "carbs": 40, "fat": 2,  "fiber": 3},
    "veg":      {"calories": 50,  "protein": 2,  "carbs": 9,  "fat": 1,  "fiber": 3},
    "fat":      {"calories": 120, "protein": 1,  "carbs": 2,  "fat": 12, "fiber": 1},
    "sauce":    {"calories": 50,  "protein": 1,  "carbs": 6,  "fat": 3,  "fiber": 0},
    "dessert":  {"calories": 200, "protein": 3,  "carbs": 30, "fat": 8,  "fiber": 1},
    "fruit":    {"calories": 80,  "protein": 1,  "carbs": 20, "fat": 0,  "fiber": 3},
    "other":    {"calories": 150, "protein": 5,  "carbs": 18, "fat": 6,  "fiber": 2},
}


def _estimate_from_components(components: list[dict[str, Any]], portion_size: str) -> tuple[dict[str, float], float]:
    # Include sugar_g so the fuel-score sugar penalty can fire correctly
    totals: dict[str, float] = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar_g": 0.0}
    matched = 0
    for component in components:
        macros = _lookup_component_macros(str(component.get("name", "")))
        if not macros:
            continue
        factor = float(component.get("portion_factor", 1.0) or 1.0)
        for key in totals:
            totals[key] += macros.get(key, 0.0) * factor
        matched += 1

    # Fallback: if no components matched, use per-role generic estimates so we
    # never return all-zeros for a logged food.
    if matched == 0 and components:
        for component in components:
            role = str(component.get("role", "other")).lower()
            fallback = _ROLE_FALLBACK_MACROS.get(role, _ROLE_FALLBACK_MACROS["other"])
            factor = float(component.get("portion_factor", 1.0) or 1.0)
            for key in totals:
                totals[key] += fallback.get(key, 0.0) * factor
        grounding_confidence = 0.25
    else:
        grounding_confidence = 0.35 + (0.5 * (matched / max(len(components), 1)))

    portion_multiplier = PORTION_MULTIPLIERS.get((portion_size or "medium").lower(), 1.0)
    for key in totals:
        totals[key] = round(totals[key] * portion_multiplier, 1)

    # If no explicit sugar_g came from COMPONENT_MACROS, fall back to the
    # carb-ratio estimate (18 % of carbs).  For whole foods this keeps sugar low;
    # for dessert items the explicit sugar_g values above dominate.
    if totals["sugar_g"] == 0.0:
        totals["sugar_g"] = _estimate_sugar_g(totals)

    return totals, min(0.9, grounding_confidence)


def _blend_nutrition(recipe_nutrition: dict[str, float], heuristic_nutrition: dict[str, float], recipe_confidence: float) -> dict[str, float]:
    recipe_weight = min(0.8, max(0.35, recipe_confidence))
    heuristic_weight = 1.0 - recipe_weight
    blended: dict[str, float] = {}
    for key in {"calories", "protein", "carbs", "fat", "fiber"}:
        blended[key] = round(
            float(recipe_nutrition.get(key, 0) or 0) * recipe_weight
            + float(heuristic_nutrition.get(key, 0) or 0) * heuristic_weight,
            1,
        )
    return blended


def _coerce_recipe_nutrition(nutrition_info: dict[str, Any], portion_size: str) -> dict[str, float]:
    portion_multiplier = PORTION_MULTIPLIERS.get((portion_size or "medium").lower(), 1.0)
    base = {
        "calories": float(nutrition_info.get("calories", 0) or 0),
        "protein": float(nutrition_info.get("protein", 0) or nutrition_info.get("protein_g", 0) or 0),
        "carbs": float(nutrition_info.get("carbs", 0) or nutrition_info.get("carbs_g", 0) or 0),
        "fat": float(nutrition_info.get("fat", 0) or nutrition_info.get("fat_g", 0) or 0),
        "fiber": float(nutrition_info.get("fiber", 0) or nutrition_info.get("fiber_g", 0) or 0),
    }
    return {key: round(value * portion_multiplier, 1) for key, value in base.items()}


def _build_flag_objects(product_result: dict[str, Any], source_context: str, preparation_style: str) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    processing_flags = product_result.get("processing_flags") or {}
    for reason, items in processing_flags.items():
        severity = "high" if reason in {"seed_oils", "artificial_additives", "added_sugars"} else "medium"
        label = reason.rstrip("s").replace("_", " ")
        for item in items or []:
            flags.append({"ingredient": item, "reason": label, "severity": severity, "inferred": False})

    if source_context == "restaurant" and preparation_style == "fried" and not processing_flags.get("seed_oils"):
        flags.append({
            "ingredient": "restaurant frying oil",
            "reason": "likely seed oil fry medium",
            "severity": "medium",
            "inferred": True,
        })
    return flags


def _whole_food_status(product_result: dict[str, Any], flags: list[dict[str, Any]]) -> str:
    tier = product_result.get("tier")
    if tier == "whole_food" and not flags:
        return "pass"
    if tier == "ultra_processed":
        return "fail"
    high_flags = sum(1 for flag in flags if flag.get("severity") == "high")
    if high_flags >= 2:
        return "fail"
    return "warn" if flags or tier in {"solid", "mixed"} else "pass"


def _is_fruit_or_produce_meal(
    meal_label: str,
    normalized_ingredients: list[str],
    components: list[dict[str, Any]],
) -> bool:
    """Return True if the meal is predominantly fruit/produce with no protein source."""
    label_lower = (meal_label or "").lower()
    if any(kw in label_lower for kw in FRUIT_LABEL_KEYWORDS):
        return True

    # Check component roles — if AI tagged items with "fruit" role and no protein
    has_protein_component = any(
        str(c.get("role", "")).lower() == "protein" for c in (components or [])
    )
    fruit_components = sum(
        1 for c in (components or []) if str(c.get("role", "")).lower() == "fruit"
    )
    if fruit_components >= 2 and not has_protein_component:
        return True

    # Check ingredient names
    fruit_ingredient_hits = sum(
        1 for ing in normalized_ingredients
        if any(fw in ing for fw in FRUIT_INGREDIENT_KEYWORDS)
    )
    if fruit_ingredient_hits >= 2 and not has_protein_component:
        return True

    return False


def _classify_scanned_meal_context(
    meal_label: str,
    meal_type: str,
    nutrition: dict[str, float],
    normalized_ingredients: list[str],
    components: list[dict[str, Any]] | None = None,
) -> str:
    calories = float(nutrition.get("calories", 0) or 0)
    protein = float(nutrition.get("protein", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    sugar = _estimate_sugar_g(nutrition)

    # Dessert components (sweets, cakes, Indian mithai, etc.) are always snacks
    # regardless of the user-selected meal_type
    if components and any((c.get("role") or "").lower() == "dessert" for c in components):
        return "snack"

    if (meal_type or "").lower() == "snack":
        return "snack"

    # Fruit plates and raw produce: high natural sugar passes here even though
    # it would fail the carb/sugar ceiling check below
    if (
        calories <= SNACK_FRUIT_CALORIE_CEILING
        and protein < SNACK_PROTEIN_FLOOR
        and _is_fruit_or_produce_meal(meal_label, normalized_ingredients, components or [])
    ):
        return "snack"

    if calories <= SNACK_CALORIE_CEILING:
        if protein >= SNACK_PROTEIN_FLOOR:
            return "snack"
        if carbs <= SNACK_CARB_CEILING and sugar <= SNACK_SUGAR_CEILING and len(normalized_ingredients) <= 4:
            return "snack"

    return classify_meal_context(meal_label, meal_type, nutrition)


def _snack_profile(
    meal_context: str,
    nutrition: dict[str, float],
    whole_food_status: str,
    flags: list[dict[str, Any]],
    meal_label: str = "",
    normalized_ingredients: list[str] | None = None,
    components: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    if meal_context != "snack":
        return None
    protein = float(nutrition.get("protein", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    sugar = _estimate_sugar_g(nutrition)
    high_flags = any(str(flag.get("severity", "")) == "high" for flag in flags)
    is_fruit = _is_fruit_or_produce_meal(meal_label, normalized_ingredients or [], components or [])
    healthy = (
        whole_food_status in ("pass", "warn")
        and not high_flags
        and (
            protein >= SNACK_PROTEIN_FLOOR
            or (carbs <= SNACK_CARB_CEILING and sugar <= SNACK_SUGAR_CEILING)
            or is_fruit  # whole fruit is inherently a healthy snack
        )
    )
    return {
        "is_snack": True,
        "is_healthy_snack": healthy,
        "label": "Healthy snack" if healthy else "Snack",
    }


def _upgrade_suggestions(
    flags: list[dict[str, Any]],
    nutrition: dict[str, float],
    preparation_style: str,
    mes_score: float | None = None,
    meal_context: str | None = None,
    pairing_recommendation: dict[str, Any] | None = None,
) -> list[str]:
    suggestions: list[str] = []
    reasons = {flag.get("reason", "") for flag in flags}
    protein = float(nutrition.get("protein", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or 0)
    fat = float(nutrition.get("fat", 0) or 0)
    fiber = float(nutrition.get("fiber", 0) or 0)
    net_carbs = max(0.0, carbs - fiber)

    if meal_context == "snack":
        if "likely seed oil fry medium" in reasons or "seed oil" in reasons or preparation_style == "fried":
            suggestions.append("Pick a less fried snack next time so it stays lighter and less processed.")
        if "added sugar" in reasons:
            suggestions.append("Choose a snack with less added sugar or pair the sweet item with protein.")
        if "refined flour" in reasons:
            suggestions.append("Swap refined snack carbs for fruit, yogurt, nuts, or a more whole-food option.")
        if net_carbs >= 20 and protein < 8:
            suggestions.append("Pair fruit or other quick carbs with yogurt, cottage cheese, eggs, or nuts so the snack lasts longer.")
        elif protein < 8:
            suggestions.append("If you want this snack to hold you longer, add a little protein like yogurt, cheese, or nuts.")
        if fiber < 3 and carbs >= 12:
            suggestions.append("Add a little fiber next time with berries, chia, nuts, or crunchy vegetables.")
        if not suggestions:
            suggestions.append("This works fine as a light snack. No major upgrade needed.")
        return suggestions[:3]

    if pairing_recommendation and meal_context == "full_meal":
        title = pairing_recommendation.get("pairing_recommended_title") or "a fiber-forward side"
        delta = pairing_recommendation.get("pairing_projected_delta")
        timing = pairing_recommendation.get("pairing_timing") or "with_meal"
        timing_copy = "before the meal" if timing == "before_meal" else "with the meal"
        if delta is not None:
            suggestions.append(f"Pair this with {title} {timing_copy} for about +{round(float(delta or 0), 1)} MES.")
        else:
            suggestions.append(f"Pair this with {title} {timing_copy} to improve the MES.")

    if "likely seed oil fry medium" in reasons or "seed oil" in reasons or preparation_style == "fried":
        suggestions.append("Ask for grilled, roasted, or olive-oil based prep instead of fryer oil.")
    if "added sugar" in reasons:
        suggestions.append("Skip sweet sauces or glazes and ask for sauces on the side.")
    if "refined flour" in reasons:
        suggestions.append("Swap refined starches for potatoes, rice, beans, or extra vegetables.")
    if protein < 25:
        suggestions.append("Add a more protein-forward base next time so the meal holds you longer.")
    if fiber < 8:
        suggestions.append("Add a bean, lentil, or vegetable side to raise fiber.")
    if net_carbs >= 30 and fiber < 10:
        suggestions.append("Start with a salad or vegetables before the starch so the meal hits more gently.")
    if mes_score is not None and mes_score < 65:
        if net_carbs >= 35:
            suggestions.append("Trim the starch portion slightly or swap part of it for vegetables if you want a higher MES.")
        if fiber < 10:
            suggestions.append("Add greens, beans, or chia to raise fiber before repeating this meal.")
        if protein >= 25 and fat < 10 and meal_context != "snack":
            suggestions.append("Pair this with avocado, olive oil, or a whole-food fat so the meal feels steadier.")
    return suggestions[:3]


def _today_totals(db: Session, user_id: str) -> dict[str, float]:
    today = datetime.now(UTC).date()
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    logs = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == today).all()
    for log in logs:
        snap = log.nutrition_snapshot or {}
        totals["calories"] += float(snap.get("calories", 0) or 0)
        totals["protein"] += float(snap.get("protein", 0) or snap.get("protein_g", 0) or 0)
        totals["carbs"] += float(snap.get("carbs", 0) or snap.get("carbs_g", 0) or 0)
        totals["fat"] += float(snap.get("fat", 0) or snap.get("fat_g", 0) or 0)
        totals["fiber"] += float(snap.get("fiber", 0) or snap.get("fiber_g", 0) or 0)
    return totals


def _recovery_plan(
    db: Session,
    user_id: str,
    nutrition: dict[str, float],
    whole_food_status: str,
    mes_score: float | None = None,
    meal_context: str | None = None,
    pairing_recommendation: dict[str, Any] | None = None,
) -> list[str]:
    budget = load_budget_for_user(db, user_id)
    today_totals = _today_totals(db, user_id)
    plan: list[str] = []

    protein_remaining = max(0.0, float(getattr(budget, "protein_target_g", 130.0)) - today_totals["protein"])
    fiber_remaining = max(0.0, float(getattr(budget, "fiber_floor_g", 30.0)) - today_totals["fiber"])
    carb_room = max(0.0, float(getattr(budget, "sugar_ceiling_g", 200.0)) - today_totals["carbs"])
    carbs = float(nutrition.get("carbs", 0) or 0)
    fiber = float(nutrition.get("fiber", 0) or 0)
    net_carbs = max(0.0, carbs - fiber)

    if meal_context == "snack":
        if protein_remaining > 20 and float(nutrition.get("protein", 0) or 0) < 10:
            plan.append("Let your next meal do the heavy lifting with a real protein anchor.")
        if fiber_remaining > 6 and fiber < 3:
            plan.append("Use your next meal to catch up on fiber with vegetables, beans, lentils, or chia.")
        if net_carbs >= 20 and float(nutrition.get("protein", 0) or 0) < 8:
            plan.append("If this snack was mostly carbs, keep your next meal steadier with protein, fiber, and slower carbs.")
        if whole_food_status != "pass":
            plan.append(f"Keep the rest of the day a little cleaner so you preserve your remaining {round(carb_room)}g carb room.")
        if not plan:
            plan.append("No real recovery needed. Just keep your next meal balanced.")
        return plan[:3]

    if protein_remaining > 20:
        plan.append(f"Aim for about {min(40, round(protein_remaining))}g protein at your next meal.")
    if fiber_remaining > 6:
        plan.append(f"Add at least {min(12, round(fiber_remaining))}g fiber with vegetables, beans, lentils, or chia.")
    if pairing_recommendation and meal_context == "full_meal":
        title = pairing_recommendation.get("pairing_recommended_title") or "a fiber-rich side"
        timing = pairing_recommendation.get("pairing_timing") or "with_meal"
        timing_copy = "before your next similar meal" if timing == "before_meal" else "with your next similar meal"
        plan.append(f"Use {title} {timing_copy} to soften the glycemic hit.")
    if mes_score is not None and mes_score < 65:
        if net_carbs >= 30:
            plan.append("A 10-minute walk after this meal can help flatten the glycemic hit.")
        if fiber < 8:
            plan.append("Have a salad or fibrous vegetables before your next carb-heavy meal.")
    if net_carbs > 35 or whole_food_status != "pass":
        plan.append(f"Keep your next meal lower-glycemic so you protect the remaining {round(carb_room)}g carb room.")
    elif carbs > 45:
        plan.append("A 10-minute walk after this meal can help smooth out the glucose hit.")
    if mes_score is not None and mes_score < 55 and meal_context != "snack":
        plan.append("Keep your next meal simple: lean protein, greens, and a slower carb if you still need one.")

    if not plan:
        plan.append("You still have room to stay balanced today, so keep the next meal protein- and fiber-forward.")
    return plan[:3]


def _calibrated_guidance(
    upgrade_suggestions: list[str],
    recovery_plan: list[str],
    estimate_mode: str,
) -> tuple[list[str], list[str]]:
    if estimate_mode == "low":
        return (
            [
                "Review the detected ingredients before relying on this estimate.",
                "Adjust the portion size if the scan under- or over-estimated the plate.",
            ],
            [
                "Treat this as a rough estimate until you confirm the ingredients and portion.",
                "After review, rescore so the MES reflects the corrected meal.",
            ],
        )
    if estimate_mode == "medium":
        return (
            ["This looks like a reasonable estimate, but review ingredients and portion before logging."] + upgrade_suggestions[:2],
            recovery_plan[:3],
        )
    return upgrade_suggestions[:3], recovery_plan[:3]


def _check_ingredient_cache(
    db: Session,
    user_id: str,
    normalized_ingredients: list[str],
    meal_label: str,
    portion_size: str,
    source_context: str,
    meal_type: str,
) -> dict[str, Any] | None:
    """Check if a recent scan from this user has >80% ingredient overlap.

    Returns a full result dict if cache hit, else None.
    Only matches scans from the last 30 days with at least 3 ingredients.
    """
    from datetime import timedelta
    from app.models.scanned_meal import ScannedMealLog

    if len(normalized_ingredients) < 3:
        return None

    ingredient_set = set(normalized_ingredients)
    cutoff = datetime.now(UTC) - timedelta(days=30)

    recent_scans = (
        db.query(ScannedMealLog)
        .filter(
            ScannedMealLog.user_id == user_id,
            ScannedMealLog.created_at >= cutoff,
            ScannedMealLog.fuel_score.isnot(None),
        )
        .order_by(ScannedMealLog.created_at.desc())
        .limit(20)
        .all()
    )

    for scan in recent_scans:
        cached_ingredients = set(scan.normalized_ingredients or [])
        if not cached_ingredients:
            continue

        # Jaccard-like overlap: intersection / union
        intersection = ingredient_set & cached_ingredients
        union = ingredient_set | cached_ingredients
        overlap = len(intersection) / max(len(union), 1)

        if overlap >= 0.80:
            # Rebuild result from stored scan data, applying current portion/context
            nutrition = dict(scan.nutrition_estimate or {})

            # Apply portion size adjustment if different
            cached_portion = scan.portion_size or "medium"
            requested_portion = portion_size or "medium"
            if cached_portion != requested_portion:
                cached_mult = PORTION_MULTIPLIERS.get(cached_portion, 1.0)
                requested_mult = PORTION_MULTIPLIERS.get(requested_portion, 1.0)
                ratio = requested_mult / cached_mult
                for key in ["calories", "protein", "carbs", "fat", "fiber", "sugar", "sugar_g"]:
                    if key in nutrition and nutrition[key]:
                        nutrition[key] = round(float(nutrition[key]) * ratio, 1)

            mes_data = None
            if scan.mes_score is not None:
                mes_data = {
                    "score": float(scan.mes_score),
                    "tier": scan.mes_tier,
                    "sub_scores": scan.mes_sub_scores or {},
                }

            return {
                "meal_label": meal_label or scan.meal_label,
                "meal_context": scan.meal_context,
                "meal_type": meal_type or scan.meal_type,
                "portion_size": requested_portion,
                "source_context": source_context or scan.source_context,
                "estimated_ingredients": scan.estimated_ingredients or [],
                "normalized_ingredients": scan.normalized_ingredients or [],
                "nutrition_estimate": nutrition,
                "whole_food_status": scan.whole_food_status,
                "whole_food_flags": scan.whole_food_flags or [],
                "suggested_swaps": scan.suggested_swaps or {},
                "upgrade_suggestions": scan.upgrade_suggestions or [],
                "recovery_plan": scan.recovery_plan or [],
                "mes": mes_data,
                "confidence": min(float(scan.confidence or 0) + 0.05, 1.0),
                "confidence_breakdown": {
                    **(scan.confidence_breakdown or {}),
                    "estimate_mode": "cached",
                    "cache_source_id": str(scan.id),
                },
                "source_model": (scan.source_model or "") + "+cached",
                "grounding_source": scan.grounding_source,
                "grounding_candidates": scan.grounding_candidates or [],
                "prompt_version": scan.prompt_version,
                "matched_recipe_id": scan.matched_recipe_id,
                "matched_recipe_confidence": scan.matched_recipe_confidence,
                "whole_food_summary": nutrition.get("whole_food_summary"),
                "pairing_opportunity": bool(scan.pairing_opportunity),
                "pairing_recommended_recipe_id": scan.pairing_recommended_recipe_id,
                "pairing_recommended_title": scan.pairing_recommended_title,
                "pairing_projected_mes": float(scan.pairing_projected_mes) if scan.pairing_projected_mes is not None else None,
                "pairing_projected_delta": float(scan.pairing_projected_delta) if scan.pairing_projected_delta is not None else None,
                "pairing_reasons": scan.pairing_reasons or [],
                "pairing_timing": scan.pairing_timing,
                "components": [],
            }

    return None


async def analyze_meal_scan(
    db: Session,
    user_id: str,
    image_bytes: bytes,
    mime_type: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    # Lazy imports to avoid circular dependencies
    from app.services.model_consensus import run_ensemble_reasoning
    from app.services.usda_client import lookup_usda_nutrition

    started = datetime.now(UTC)

    # ------------------------------------------------------------------
    # Stage 1: Gemini vision — food identification from image (~1.5s)
    # ------------------------------------------------------------------
    extracted = await _call_gemini_meal_extractor(image_bytes, mime_type, context)

    # Self-classification short-circuits. The upgraded prompt returns scan_type
    # as the authoritative classifier; the legacy not_food / is_beverage flags
    # are still populated for backwards compat.
    scan_type = str(extracted.get("scan_type") or "").strip().lower() or None

    # Reject non-food images immediately
    if scan_type == "not_food" or extracted.get("not_food"):
        return {
            "scan_type": "not_food",
            "is_not_food": True,
            "not_food_reason": str(extracted.get("not_food_reason") or "No food detected in image"),
            "meal_label": "Not a food item",
            "confidence": 0.0,
        }

    # Packaged-food label short-circuit: delegate to the label extractor on
    # the same image. Lazy import to avoid circular dependency — label scan
    # never imports meal scan back.
    # Exception: when the caller passes force_scan_type="meal" in context, the
    # user has explicitly overridden the classifier (deep-buried "was this a
    # prepared meal?" link on the product result card) — skip the label
    # delegation and run the full meal pipeline on the image.
    force_scan_type = str((context or {}).get("force_scan_type") or "").strip().lower()
    if scan_type == "label" and force_scan_type != "meal":
        from app.services.product_label_scan import analyze_product_label_image
        label_result = await analyze_product_label_image(image_bytes, mime_type)
        return {
            "scan_type": "label",
            "label": label_result,
            # Copy a few fields for legacy /meal endpoint callers that expect them.
            "meal_label": label_result.get("product_name") or "Packaged food",
            "confidence": float(label_result.get("confidence") or 0.0),
        }

    components = _stable_visible_components(extracted.get("components") or [])
    estimated_ingredients = [_titleize_name(str(component.get("name", "")).strip()) for component in components if component.get("name")]
    normalized_ingredients = [_normalize_name(name) for name in estimated_ingredients]
    # Phase 1 audit fix: the upgraded prompt asks Gemini to list processing
    # TAGS (refined_flour, seed_oil, etc.) in possible_hidden_ingredients.
    # Filter these tag-style names out of the ingredient list so they don't
    # double-count via the legacy flag detector. They're surfaced separately
    # through the dish classifier + NOVA tag pipeline.
    _PROCESSING_TAG_NAMES = {
        "refined_flour", "seed_oil", "seed_oil_fried", "added_sugar",
        "cured_meat", "processed_cheese", "sodium_high", "protein_isolate",
    }
    hidden_ingredients: list[str] = []
    hidden_processing_tags: list[str] = []
    for item in (extracted.get("possible_hidden_ingredients") or []):
        name = str(item.get("name", "")).strip()
        if not name or float(item.get("confidence", 0) or 0) < 0.55:
            continue
        key = name.lower().replace(" ", "_")
        if key in _PROCESSING_TAG_NAMES:
            hidden_processing_tags.append(key)
        else:
            hidden_ingredients.append(name)

    raw_meal_label = str(extracted.get("meal_label") or "Scanned meal").strip()
    source_context = str(
        context.get("source_context")
        or extracted.get("source_context_guess")
        or "home"
    ).strip().lower()
    meal_type = str(
        context.get("meal_type")
        or extracted.get("meal_type_guess")
        or "lunch"
    ).strip().lower()
    portion_size = str(
        context.get("portion_size")
        or extracted.get("portion_size")
        or "medium"
    ).strip().lower()
    preparation_style = str(extracted.get("preparation_style") or "unknown").strip().lower()

    # ------------------------------------------------------------------
    # Stage 1.5: Ingredient-hash cache — skip expensive pipeline if
    # a recent scan from this user has >80% ingredient overlap
    # ------------------------------------------------------------------
    cached_result = _check_ingredient_cache(
        db, user_id, normalized_ingredients, raw_meal_label, portion_size, source_context, meal_type,
    )
    if cached_result is not None:
        logger.info("Meal scan cache hit for user %s — reusing prior analysis", user_id)
        return cached_result

    # ------------------------------------------------------------------
    # Stage 2: USDA grounding + Claude ensemble reasoning (parallel)
    #
    # Architecture: each model does what it's BEST at, no redundant work.
    # - USDA: lab-verified nutrition data per component
    # - Claude: reasoning about hidden ingredients + nutrition cross-check
    # Both run in parallel — total added latency ~1-1.5s
    # ------------------------------------------------------------------
    usda_grounded_count = 0
    ensemble_result: dict[str, Any] | None = None

    parallel_tasks: list[Any] = []

    # USDA lookups (one per component, all parallel)
    if settings.usda_grounding_enabled:
        usda_coros = [
            lookup_usda_nutrition(str(c.get("name", "")), preparation_style)
            for c in components
        ]
        parallel_tasks.append(asyncio.gather(*usda_coros, return_exceptions=True))
    else:
        parallel_tasks.append(asyncio.sleep(0))

    # Claude ensemble reasoning (hidden ingredients + nutrition cross-check)
    if settings.hidden_ingredient_model_enabled:
        parallel_tasks.append(
            run_ensemble_reasoning(
                components, raw_meal_label, preparation_style,
                source_context, portion_size,
            )
        )
    else:
        parallel_tasks.append(asyncio.sleep(0))

    stage_results = await asyncio.gather(*parallel_tasks, return_exceptions=True)

    # Unpack USDA results
    usda_raw = stage_results[0] if settings.usda_grounding_enabled and not isinstance(stage_results[0], Exception) else None
    if isinstance(stage_results[0], Exception):
        logger.warning("USDA grounding batch failed: %s", stage_results[0])

    # Unpack Claude ensemble results
    if settings.hidden_ingredient_model_enabled and not isinstance(stage_results[1], Exception):
        ensemble_result = stage_results[1]
    if isinstance(stage_results[1], Exception):
        logger.warning("Claude ensemble reasoning failed: %s", stage_results[1])

    # ------------------------------------------------------------------
    # Nutrition estimation: USDA-grounded with COMPONENT_MACROS fallback
    # ------------------------------------------------------------------
    usda_results: list[dict[str, float] | None] = []
    if usda_raw and isinstance(usda_raw, (list, tuple)):
        for r in usda_raw:
            usda_results.append(r if isinstance(r, dict) else None)
    while len(usda_results) < len(components):
        usda_results.append(None)

    totals: dict[str, float] = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar_g": 0.0}
    matched = 0
    for component, usda_result in zip(components, usda_results):
        factor = float(component.get("portion_factor", 1.0) or 1.0)

        if usda_result:
            for key in totals:
                totals[key] += usda_result.get(key, 0.0) * factor
            usda_grounded_count += 1
            matched += 1
        else:
            macros = _lookup_component_macros(str(component.get("name", "")))
            if macros:
                for key in totals:
                    totals[key] += macros.get(key, 0.0) * factor
                matched += 1
            else:
                role = str(component.get("role", "other")).lower()
                fallback = _ROLE_FALLBACK_MACROS.get(role, _ROLE_FALLBACK_MACROS["other"])
                for key in totals:
                    totals[key] += fallback.get(key, 0.0) * factor

    # Apply portion multiplier
    portion_multiplier = PORTION_MULTIPLIERS.get((portion_size or "medium").lower(), 1.0)
    for key in totals:
        totals[key] = round(totals[key] * portion_multiplier, 1)

    # ------------------------------------------------------------------
    # Apply Claude ensemble adjustments (nutrition cross-check)
    # ------------------------------------------------------------------
    ensemble_used = ensemble_result is not None
    if ensemble_result:
        # Apply nutrition adjustments from Claude's reasoning
        for adj in (ensemble_result.get("nutrition_adjustments") or []):
            field = adj.get("field", "")
            factor = float(adj.get("factor", 1.0) or 1.0)
            if field in totals and 0.5 <= factor <= 2.0:
                totals[field] = round(totals[field] * factor, 1)

        # Apply portion assessment
        portion_assessment = ensemble_result.get("portion_assessment", "accurate")
        if portion_assessment == "under":
            for key in totals:
                totals[key] = round(totals[key] * 1.15, 1)  # bump up 15%
        elif portion_assessment == "over":
            for key in totals:
                totals[key] = round(totals[key] * 0.85, 1)  # trim 15%

    # Sugar fallback
    if totals["sugar_g"] == 0.0:
        totals["sugar_g"] = _estimate_sugar_g(totals)

    # Grounding confidence
    if matched == 0 and components:
        grounding_confidence = 0.25
    else:
        base_conf = 0.35 + (0.5 * (matched / max(len(components), 1)))
        usda_bonus = 0.1 * (usda_grounded_count / max(len(components), 1))
        ensemble_bonus = 0.05 if ensemble_used else 0.0
        grounding_confidence = min(0.95, base_conf + usda_bonus + ensemble_bonus)

    heuristic_nutrition = totals

    # ------------------------------------------------------------------
    # Merge Claude hidden ingredients with Gemini-extracted ones
    # ------------------------------------------------------------------
    if ensemble_result:
        existing_lower = {h.lower() for h in hidden_ingredients}
        for item in (ensemble_result.get("hidden_ingredients") or []):
            name = str(item.get("name", "")).strip()
            conf = float(item.get("confidence", 0) or 0)
            if name and conf >= 0.55 and name.lower() not in existing_lower:
                hidden_ingredients.append(name)
                existing_lower.add(name.lower())

    nutrition = build_glycemic_nutrition_input(
        heuristic_nutrition,
        ingredients=normalized_ingredients + hidden_ingredients,
    )
    meal_label = _derive_stable_meal_label(raw_meal_label, components, None, 0.0)

    ingredients_text = ", ".join(normalized_ingredients + hidden_ingredients)
    product_result = analyze_whole_food_product(
        {
            "ingredients_text": ingredients_text,
            "calories": nutrition.get("calories", 0),
            "protein_g": nutrition.get("protein", 0),
            "fiber_g": nutrition.get("fiber", 0),
            "carbs_g": nutrition.get("carbs", 0),
            "sugar_g": _estimate_sugar_g(nutrition),
            "sodium_mg": 420 if source_context == "restaurant" else 220,
        }
    )
    flags = _build_flag_objects(product_result, source_context, preparation_style)
    whole_food_status = _whole_food_status(product_result, flags)

    meal_context = _classify_scanned_meal_context(meal_label, meal_type, nutrition, normalized_ingredients, components)
    mes = None
    pairing_recommendation = None
    if should_score_meal(meal_context):
        budget = load_budget_for_user(db, user_id)
        result = compute_meal_mes(nutrition, budget)
        mes = {
            "score": result["display_score"],
            "tier": result["display_tier"],
            "sub_scores": result.get("sub_scores") or {},
            "ingredient_gis_adjustment": result.get("ingredient_gis_adjustment"),
            "ingredient_gis_reasons": result.get("ingredient_gis_reasons") or [],
        }
        pairing_recommendation = _find_pairing_candidate(db, nutrition, None, budget)

    snack_profile = _snack_profile(meal_context, nutrition, whole_food_status, flags, meal_label, normalized_ingredients, components)

    # ------------------------------------------------------------------
    # Confidence: 4-component formula (ensemble bonus baked into grounding)
    # ------------------------------------------------------------------
    estimate_mode = "high" if grounding_confidence >= 0.75 else ("medium" if grounding_confidence >= 0.5 else "low")
    confidence_breakdown = {
        "extraction": float((extracted.get("confidence_breakdown") or {}).get("extraction", extracted.get("confidence", 0.72)) or 0.72),
        "portion": float((extracted.get("confidence_breakdown") or {}).get("portion", 0.68) or 0.68),
        "grounding": round(grounding_confidence, 2),
        "nutrition": round(grounding_confidence, 2),
        "ensemble_applied": ensemble_used,
        "estimate_mode": estimate_mode,
        "review_required": estimate_mode == "low",
    }
    confidence = round(
        (
            confidence_breakdown["extraction"] * 0.35
            + confidence_breakdown["portion"] * 0.20
            + confidence_breakdown["nutrition"] * 0.25
            + confidence_breakdown["grounding"] * 0.20
        ),
        2,
    )

    upgrade_suggestions, recovery_plan = _calibrated_guidance(
        _upgrade_suggestions(
            flags,
            nutrition,
            preparation_style,
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        _recovery_plan(
            db,
            user_id,
            nutrition,
            whole_food_status,
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        estimate_mode,
    )

    # ------------------------------------------------------------------
    # Build result
    # ------------------------------------------------------------------
    # Use the actual model that served the response (it may have been the
    # fallback if the primary 503'd).
    primary_model = (
        (extracted.get("_gemini_meta") or {}).get("model")
        or settings.scan_model
        or settings.gemini_model
    )
    models_used = [primary_model]
    if ensemble_used:
        models_used.append("claude-sonnet")

    # Stamp the self-classification so downstream callers (router, smart
    # endpoint) can dispatch without having to re-read raw extractor fields.
    resolved_scan_type = scan_type if scan_type in ("meal", "beverage") else "meal"

    result = {
        "scan_type": resolved_scan_type,
        "is_beverage": bool(extracted.get("is_beverage") or resolved_scan_type == "beverage"),
        "meal_label": meal_label,
        "meal_type": meal_type,
        "meal_context": meal_context,
        "portion_size": portion_size,
        "source_context": source_context,
        "preparation_style": preparation_style,
        "components": components,
        "estimated_ingredients": estimated_ingredients,
        "normalized_ingredients": normalized_ingredients + hidden_ingredients,
        "nutrition_estimate": nutrition,
        "whole_food_status": whole_food_status,
        "whole_food_flags": flags,
        "suggested_swaps": product_result.get("processing_flags") or {},
        "mes": mes,
        "snack_profile": snack_profile,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "upgrade_suggestions": upgrade_suggestions,
        "recovery_plan": recovery_plan,
        "source_model": "+".join(models_used),
        "prompt_version": MEAL_SCAN_PROMPT_VERSION,
        "grounding_source": "usda" if usda_grounded_count > 0 else None,
        "grounding_candidates": [],
        "grounding_provider": "USDA FoodData Central" if usda_grounded_count > 0 else None,
        "matched_recipe_id": None,
        "matched_recipe_title": None,
        "matched_recipe_confidence": None,
        "whole_food_summary": product_result.get("summary"),
        "pairing_opportunity": bool((pairing_recommendation or {}).get("pairing_opportunity")),
        "pairing_recommended_recipe_id": (pairing_recommendation or {}).get("pairing_recommended_recipe_id"),
        "pairing_recommended_title": (pairing_recommendation or {}).get("pairing_recommended_title"),
        "pairing_projected_mes": (pairing_recommendation or {}).get("pairing_projected_mes"),
        "pairing_projected_delta": (pairing_recommendation or {}).get("pairing_projected_delta"),
        "pairing_reasons": (pairing_recommendation or {}).get("pairing_reasons") or [],
        "pairing_timing": (pairing_recommendation or {}).get("pairing_timing"),
        "ensemble_models": models_used,
        "usda_grounded_count": usda_grounded_count,
        "usda_grounded_total": len(components),
    }

    # ── Multi-dish support ──
    # If Gemini detected multiple distinct dishes, include per-dish breakdowns
    raw_dishes = extracted.get("dishes") or []
    if extracted.get("multi_dish") and len(raw_dishes) > 1:
        dish_breakdowns = []
        for dish in raw_dishes:
            dish_components = _stable_visible_components(dish.get("components") or [])
            dish_ingredients = [_titleize_name(str(c.get("name", "")).strip()) for c in dish_components if c.get("name")]
            dish_nutrition = _aggregate_nutrition(dish_components, {}, portion_multiplier=1.0)
            dish_wf = analyze_whole_food_product({"ingredients_text": ", ".join(dish_ingredients)})
            dish_breakdowns.append({
                "meal_label": dish.get("meal_label", "Dish"),
                "ingredients": dish_ingredients,
                "nutrition_estimate": dish_nutrition,
                "score": dish_wf.get("score"),
                "whole_food_status": "pass" if dish_wf.get("score", 0) >= 70 else "warn" if dish_wf.get("score", 0) >= 50 else "fail",
            })
        result["multi_dish"] = True
        result["dishes"] = dish_breakdowns
    else:
        result["multi_dish"] = False
        result["dishes"] = []

    logger.info(
        "meal_scan.completed bytes=%s models=%s usda=%s/%s ensemble=%s ms=%s",
        len(image_bytes),
        "+".join(models_used),
        usda_grounded_count,
        len(components),
        ensemble_used,
        int((datetime.now(UTC) - started).total_seconds() * 1000),
    )
    return result


def _apply_correction_heuristic(ingredients: list[str], correction_text: str) -> list[str]:
    """Apply text corrections to the ingredient list.

    Supports patterns like:
      - "the rice was actually brown rice" → swap "rice" for "brown rice"
      - "remove the bread" → drop "bread"
      - "add avocado" → append "avocado"
      - "the dressing is homemade" → qualify the dressing ingredient
      - "it's whole wheat pasta not regular" → swap pasta for whole wheat pasta
      - "made with olive oil not vegetable oil" → swap oil type
    """
    import re

    result = list(ingredients)
    lower = correction_text.lower().strip()

    # Pattern: "X was actually Y" / "X is actually Y" / "X was Y"
    swap_match = re.search(r"(?:the\s+)?(\w[\w\s]*?)\s+(?:was|is)\s+(?:actually\s+)?(.+)", lower)
    if swap_match:
        old_name = swap_match.group(1).strip()
        new_name = swap_match.group(2).strip().rstrip(".")
        result = [new_name if old_name in ing.lower() else ing for ing in result]
        return result

    # Pattern: "it's X not Y" / "used X not Y" / "made with X not Y"
    not_match = re.search(r"(?:it'?s|used|made with|cooked (?:in|with))\s+(.+?)\s+(?:not|instead of)\s+(.+)", lower)
    if not_match:
        new_name = not_match.group(1).strip().rstrip(".")
        old_name = not_match.group(2).strip().rstrip(".")
        result = [new_name if old_name in ing.lower() else ing for ing in result]
        return result

    # Pattern: "the X is homemade" / "X is whole food" / "X is fresh"
    qualify_match = re.search(r"(?:the\s+)?(\w[\w\s]*?)\s+(?:is|are|was)\s+(homemade|whole[- ]?food|fresh|organic|house[- ]?made|real|natural)", lower)
    if qualify_match:
        target = qualify_match.group(1).strip()
        qualifier = qualify_match.group(2).strip()
        result = [f"{qualifier} {ing}" if target in ing.lower() else ing for ing in result]
        return result

    # Pattern: "remove X" / "no X" / "without X"
    remove_match = re.search(r"(?:remove|no|without|skip|didn't have)\s+(?:the\s+)?(.+)", lower)
    if remove_match:
        remove_name = remove_match.group(1).strip().rstrip(".")
        result = [ing for ing in result if remove_name not in ing.lower()]
        return result

    # Pattern: "add X" / "also had X" / "there was also X"
    add_match = re.search(r"(?:add|include|plus|also had|there was also|i also had)\s+(?:the\s+)?(.+)", lower)
    if add_match:
        add_name = add_match.group(1).strip().rstrip(".")
        result.append(add_name)
        return result

    # Pattern: "swap X for Y" / "replace X with Y"
    replace_match = re.search(r"(?:swap|replace|change)\s+(?:the\s+)?(.+?)\s+(?:for|with|to)\s+(.+)", lower)
    if replace_match:
        old_name = replace_match.group(1).strip().rstrip(".")
        new_name = replace_match.group(2).strip().rstrip(".")
        result = [new_name if old_name in ing.lower() else ing for ing in result]
        return result

    return result


async def recompute_meal_scan(
    db: Session,
    user_id: str,
    meal_label: str,
    meal_type: str,
    portion_size: str,
    source_context: str,
    ingredients: list[str],
    existing_source_model: str | None = None,
    correction_text: str | None = None,
) -> dict[str, Any]:
    # If user provided a correction, prepend it as context for ingredient refinement
    if correction_text:
        ingredients = _apply_correction_heuristic(ingredients, correction_text)
    normalized_ingredients = [_normalize_name(x) for x in ingredients if x.strip()]
    synthetic_components = [{"name": ingredient, "portion_factor": 1.0} for ingredient in normalized_ingredients]
    heuristic_nutrition, heuristic_confidence = _estimate_from_components(synthetic_components, portion_size)
    nutrition = build_glycemic_nutrition_input(
        heuristic_nutrition,
        ingredients=normalized_ingredients,
    )
    grounding_confidence = heuristic_confidence
    meal_label = _derive_stable_meal_label(meal_label, synthetic_components, None, 0.0)

    product_result = analyze_whole_food_product(
        {
            "ingredients_text": ", ".join(normalized_ingredients),
            "calories": nutrition.get("calories", 0),
            "protein_g": nutrition.get("protein", 0),
            "fiber_g": nutrition.get("fiber", 0),
            "carbs_g": nutrition.get("carbs", 0),
            "sugar_g": _estimate_sugar_g(nutrition),
            "sodium_mg": 420 if source_context == "restaurant" else 220,
        }
    )
    flags = _build_flag_objects(product_result, source_context, "mixed")
    whole_food_status = _whole_food_status(product_result, flags)

    meal_context = _classify_scanned_meal_context(meal_label, meal_type, nutrition, normalized_ingredients, [])
    mes = None
    pairing_recommendation = None
    if should_score_meal(meal_context):
        budget = load_budget_for_user(db, user_id)
        result = compute_meal_mes(nutrition, budget)
        mes = {
            "score": result["display_score"],
            "tier": result["display_tier"],
            "sub_scores": result.get("sub_scores") or {},
            "ingredient_gis_adjustment": result.get("ingredient_gis_adjustment"),
            "ingredient_gis_reasons": result.get("ingredient_gis_reasons") or [],
        }
        pairing_recommendation = _find_pairing_candidate(db, nutrition, None, budget)

    snack_profile = _snack_profile(meal_context, nutrition, whole_food_status, flags, meal_label, normalized_ingredients, [])

    estimate_mode = "high" if grounding_confidence >= 0.75 else ("medium" if grounding_confidence >= 0.5 else "low")
    confidence_breakdown = {
        "extraction": 0.7,
        "portion": 0.75,
        "grounding": round(grounding_confidence, 2),
        "nutrition": round(grounding_confidence, 2),
        "estimate_mode": estimate_mode,
        "review_required": estimate_mode == "low",
    }
    confidence = round(
        confidence_breakdown["extraction"] * 0.3
        + confidence_breakdown["portion"] * 0.2
        + confidence_breakdown["nutrition"] * 0.4
        + confidence_breakdown["grounding"] * 0.1,
        2,
    )

    upgrade_suggestions, recovery_plan = _calibrated_guidance(
        _upgrade_suggestions(
            flags,
            nutrition,
            "mixed",
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        _recovery_plan(
            db,
            user_id,
            nutrition,
            whole_food_status,
            (mes or {}).get("score"),
            meal_context,
            pairing_recommendation,
        ),
        estimate_mode,
    )

    return {
        "meal_label": meal_label,
        "meal_type": meal_type,
        "meal_context": meal_context,
        "portion_size": portion_size,
        "source_context": source_context,
        "estimated_ingredients": ingredients,
        "normalized_ingredients": normalized_ingredients,
        "nutrition_estimate": nutrition,
        "whole_food_status": whole_food_status,
        "whole_food_flags": flags,
        "suggested_swaps": product_result.get("processing_flags") or {},
        "mes": mes,
        "snack_profile": snack_profile,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "upgrade_suggestions": upgrade_suggestions,
        "recovery_plan": recovery_plan,
        "source_model": existing_source_model or settings.scan_model or settings.gemini_model,
        "prompt_version": MEAL_SCAN_PROMPT_VERSION,
        "grounding_source": None,
        "grounding_candidates": [],
        "grounding_provider": None,
        "matched_recipe_id": None,
        "matched_recipe_title": None,
        "matched_recipe_confidence": None,
        "whole_food_summary": product_result.get("summary"),
        "pairing_opportunity": bool((pairing_recommendation or {}).get("pairing_opportunity")),
        "pairing_recommended_recipe_id": (pairing_recommendation or {}).get("pairing_recommended_recipe_id"),
        "pairing_recommended_title": (pairing_recommendation or {}).get("pairing_recommended_title"),
        "pairing_projected_mes": (pairing_recommendation or {}).get("pairing_projected_mes"),
        "pairing_projected_delta": (pairing_recommendation or {}).get("pairing_projected_delta"),
        "pairing_reasons": (pairing_recommendation or {}).get("pairing_reasons") or [],
        "pairing_timing": (pairing_recommendation or {}).get("pairing_timing"),
    }
