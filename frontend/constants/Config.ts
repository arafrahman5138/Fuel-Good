import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeOptionalUrl(value?: string): string {
  return value?.trim() ? stripTrailingSlash(value.trim()) : '';
}

function getDevApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return stripTrailingSlash(envUrl);

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];

  if (host) {
    return stripTrailingSlash(`http://${host}:8000/api`);
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }

  return 'http://127.0.0.1:8000/api';
}

function getProdApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!envUrl) {
    return 'https://api.fuelgood.com/api';
  }
  if (!envUrl.startsWith('https://')) {
    throw new Error('Production API URL must use HTTPS.');
  }
  return stripTrailingSlash(envUrl);
}

export const API_URL = __DEV__
  ? getDevApiUrl()
  : getProdApiUrl();

export const APP_NAME = 'Fuel Good';
export const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV?.trim() || (__DEV__ ? 'development' : 'production')).toLowerCase();
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export const RELEASE_CHANNEL = process.env.EXPO_PUBLIC_RELEASE_CHANNEL?.trim() || APP_ENV;
export const EXPO_PROJECT_ID =
  process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim()
  || (Constants.expoConfig?.extra as any)?.eas?.projectId
  || '';
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@fuelgood.com';
export const PRIVACY_POLICY_URL = normalizeOptionalUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
export const TERMS_URL = normalizeOptionalUrl(process.env.EXPO_PUBLIC_TERMS_URL);
export const SUPPORT_URL = normalizeOptionalUrl(process.env.EXPO_PUBLIC_SUPPORT_URL);
export const CLIENT_ERROR_REPORTING_ENABLED = (process.env.EXPO_PUBLIC_ENABLE_ERROR_REPORTING?.trim() || 'true') !== 'false';
export const ENABLE_ANALYTICS = (process.env.EXPO_PUBLIC_ENABLE_ANALYTICS?.trim() || 'false') === 'true';
export const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || '';
export const APP_STORE_MANAGE_SUBSCRIPTIONS_URL =
  process.env.EXPO_PUBLIC_APP_STORE_MANAGE_SUBSCRIPTIONS_URL?.trim()
  || 'https://apps.apple.com/account/subscriptions';
export const PREMIUM_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID?.trim() || 'Fuel Good Premium';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
export const IS_SUPABASE_REALTIME_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// OAuth Configuration
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';
export const IS_GOOGLE_AUTH_CONFIGURED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_IOS_CLIENT_ID);

export const FLAVOR_OPTIONS = [
  { id: 'spicy', label: 'Spicy', icon: 'flame-outline' },
  { id: 'savory', label: 'Savory', icon: 'restaurant-outline' },
  { id: 'sweet', label: 'Sweet', icon: 'ice-cream-outline' },
  { id: 'umami', label: 'Umami', icon: 'fish-outline' },
  { id: 'mild', label: 'Mild', icon: 'leaf-outline' },
  { id: 'tangy', label: 'Tangy', icon: 'nutrition-outline' },
];

export const DIETARY_OPTIONS = [
  { id: 'none', label: 'No Restrictions' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'gluten-free', label: 'Gluten Free' },
  { id: 'dairy-free', label: 'Dairy Free' },
  { id: 'keto', label: 'Keto' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'whole30', label: 'Whole30' },
];

export const ALLERGY_OPTIONS = [
  { id: 'nuts', label: 'Tree Nuts' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'soy', label: 'Soy' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'wheat', label: 'Wheat' },
  { id: 'fish', label: 'Fish' },
  { id: 'sesame', label: 'Sesame' },
];

export const DISLIKED_INGREDIENT_OPTIONS = [
  { id: 'kale', label: 'Kale' },
  { id: 'cilantro', label: 'Cilantro' },
  { id: 'mushrooms', label: 'Mushrooms' },
  { id: 'olives', label: 'Olives' },
  { id: 'eggplant', label: 'Eggplant' },
  { id: 'beets', label: 'Beets' },
  { id: 'cauliflower', label: 'Cauliflower' },
  { id: 'brussels sprouts', label: 'Brussels Sprouts' },
];

export const PROTEIN_OPTIONS = [
  { id: 'chicken', label: 'Chicken' },
  { id: 'beef', label: 'Beef' },
  { id: 'lamb', label: 'Lamb' },
  { id: 'pork', label: 'Pork' },
  { id: 'salmon', label: 'Salmon' },
  { id: 'shrimp', label: 'Shrimp' },
  { id: 'other_fish', label: 'Other Fish' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'vegetarian', label: 'Vegetarian' },
];

export const CARB_OPTIONS = [
  { id: 'rice', label: 'Rice' },
  { id: 'sweet_potato', label: 'Sweet Potato' },
  { id: 'potato', label: 'Potato' },
  { id: 'sourdough_bread', label: 'Sourdough Bread' },
  { id: 'oats', label: 'Oats' },
  { id: 'quinoa', label: 'Quinoa' },
  { id: 'tortillas', label: 'Tortillas' },
  { id: 'noodles', label: 'Noodles' },
  { id: 'plantain', label: 'Plantain' },
];

export const CUISINE_OPTIONS = [
  { id: 'indian', label: 'Indian' },
  { id: 'thai', label: 'Thai' },
  { id: 'korean', label: 'Korean' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'ethiopian', label: 'Ethiopian' },
  { id: 'middle_eastern', label: 'Middle Eastern' },
  { id: 'west_african', label: 'West African' },
  { id: 'caribbean', label: 'Caribbean' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'vietnamese', label: 'Vietnamese' },
  { id: 'moroccan', label: 'Moroccan' },
  { id: 'indonesian', label: 'Indonesian' },
  { id: 'peruvian', label: 'Peruvian' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'turkish', label: 'Turkish' },
  { id: 'american', label: 'American' },
];

export const COOK_TIME_OPTIONS = [
  { id: 'quick', label: 'Quick (< 30 min)' },
  { id: 'medium', label: 'Medium (30-60 min)' },
  { id: 'long', label: 'Long (60+ min)' },
];

export const HEALTH_BENEFIT_OPTIONS = [
  { id: 'gut_health', label: 'Gut Health', icon: 'leaf', color: '#4CAF50' },
  { id: 'anti_inflammatory', label: 'Anti-Inflammatory', icon: 'shield-checkmark', color: '#FF7043' },
  { id: 'heart_health', label: 'Heart Health', icon: 'heart', color: '#EF5350' },
  { id: 'immune_support', label: 'Immune Support', icon: 'shield', color: '#42A5F5' },
  { id: 'brain_health', label: 'Brain Health', icon: 'bulb', color: '#AB47BC' },
  { id: 'bone_health', label: 'Bone & Joint', icon: 'body', color: '#8D6E63' },
  { id: 'muscle_recovery', label: 'Muscle Recovery', icon: 'barbell', color: '#26A69A' },
  { id: 'energy_boost', label: 'Energy Boost', icon: 'flash', color: '#FFA726' },
  { id: 'skin_health', label: 'Skin Health', icon: 'sunny', color: '#EC407A' },
  { id: 'blood_sugar', label: 'Blood Sugar', icon: 'pulse', color: '#5C6BC0' },
  { id: 'hormone_support', label: 'Hormone Support', icon: 'fitness', color: '#66BB6A' },
  { id: 'detox_support', label: 'Detox & Liver', icon: 'water', color: '#29B6F6' },
];

export const XP_VALUES = {
  MEAL_LOG: 50,          // Logging a meal in chronometer
  DAILY_STREAK: 100,     // Opening the app (daily login)
  HEALTHIFY_CHAT: 25,    // Using the healthify chatbot
  COMPLETE_WEEKLY_PLAN: 500, // Generating a weekly meal plan
  SAVE_RECIPE: 10,       // Saving a recipe
  BROWSE_RECIPE: 5,      // Viewing a recipe detail
  MEAL_COOKED: 50,       // Completing cook mode
  // Nutrition tier XP (awarded automatically by backend)
  NUTRITION_BRONZE: 50,  // Daily score ≥ 60
  NUTRITION_SILVER: 100, // Daily score ≥ 75
  NUTRITION_GOLD: 200,   // Daily score ≥ 90
};

export const XP_PER_LEVEL = 1000;

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Curious Cook',
  2: 'Kitchen Explorer',
  3: 'Whole Food Rookie',
  4: 'Nourishment Seeker',
  5: 'Whole Food Warrior',
  6: 'Nutrition Navigator',
  7: 'Clean Eating Champion',
  8: 'Macro Master',
  9: 'Micronutrient Maven',
  10: 'Nutrition Master',
  11: 'Culinary Virtuoso',
  12: 'Superfood Sage',
  13: 'Wellness Architect',
  14: 'Legendary Nourisher',
  15: 'Whole Food Grandmaster',
};

export const getLevelTitle = (level: number): string =>
  LEVEL_TITLES[level] || `Grandmaster (Lv.${level})`;

export const NUTRITION_TIERS = {
  BRONZE: { min: 60, label: 'Bronze', color: '#CD7F32', xp: 50 },
  SILVER: { min: 75, label: 'Silver', color: '#C0C0C0', xp: 100 },
  GOLD: { min: 90, label: 'Gold', color: '#FFD700', xp: 200 },
};
