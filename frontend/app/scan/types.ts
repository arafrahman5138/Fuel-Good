export type ScanMode = 'meal' | 'product';
export type ScanStep = 'capture' | 'review' | 'result';
export type PortionSize = 'small' | 'medium' | 'large';
export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type SourceContext = 'home' | 'restaurant';
export type ProductSource = 'label_image' | 'barcode' | 'label_manual';
export type ProductCaptureType = 'ingredients' | 'nutrition' | 'front_label';
export type ScanImageMeta = {
  fileName?: string | null;
  mimeType?: string | null;
};

export interface ProductResult {
  product_name: string;
  brand?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  source: ProductSource;
  capture_type?: ProductCaptureType;
  score: number;
  tier: 'whole_food' | 'solid' | 'mixed' | 'ultra_processed';
  verdict: string;
  summary: string;
  recommended_action: string;
  highlights: string[];
  concerns: string[];
  reasoning?: string[];
  ingredient_count: number;
  ingredients_text: string;
  confidence: number;
  confidence_breakdown: {
    ocr?: number;
    ingredients?: number;
    nutrition?: number;
    metadata?: number;
  };
  recoverable?: boolean;
  notes?: string[];
  processing_flags?: {
    seed_oils?: string[];
    added_sugars?: string[];
    refined_flours?: string[];
    artificial_additives?: string[];
    gums_or_emulsifiers?: string[];
    protein_isolates?: string[];
  };
  nutrition_snapshot: {
    calories: number;
    protein_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    carbs_g: number;
    sodium_mg: number;
  };
  flag_explanations?: Array<{
    title: string;
    explanation: string;
    look_for: string;
    detected: string[];
  }>;
}

export interface MealResult {
  id: string;
  meal_label: string;
  meal_type: MealKind;
  meal_context: string;
  portion_size: PortionSize;
  source_context: SourceContext;
  estimated_ingredients: string[];
  normalized_ingredients: string[];
  nutrition_estimate: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  whole_food_status: 'pass' | 'warn' | 'fail';
  whole_food_flags: Array<{
    ingredient: string;
    reason: string;
    severity: string;
    inferred?: boolean;
  }>;
  fuel_score?: number | null;
  fuel_reasoning?: string[];
  mes?: {
    score: number;
    tier: string;
    sub_scores: Record<string, number>;
  } | null;
  snack_profile?: {
    is_snack: boolean;
    is_healthy_snack: boolean;
    label: string;
  } | null;
  confidence: number;
  confidence_breakdown: {
    extraction: number;
    portion: number;
    nutrition: number;
  };
  upgrade_suggestions: string[];
  recovery_plan: string[];
  logged_to_chronometer?: boolean;
  pairing_opportunity?: boolean;
  pairing_recommended_recipe_id?: string | null;
  pairing_recommended_title?: string | null;
  pairing_projected_mes?: number | null;
  pairing_projected_delta?: number | null;
  pairing_reasons?: string[];
  pairing_timing?: 'with_meal' | 'before_meal' | string | null;
}

export const PRODUCT_TIER_META: Record<ProductResult['tier'], { color: string; bg: string; label: string }> = {
  whole_food: { color: '#16A34A', bg: '#DCFCE7', label: 'Whole-Food Friendly' },
  solid: { color: '#2563EB', bg: '#DBEAFE', label: 'Solid Option' },
  mixed: { color: '#D97706', bg: '#FEF3C7', label: 'Mixed Bag' },
  ultra_processed: { color: '#DC2626', bg: '#FEE2E2', label: 'Heavily Processed' },
};

export const MEAL_STATUS_META: Record<MealResult['whole_food_status'], { color: string; bg: string; label: string }> = {
  pass: { color: '#16A34A', bg: '#DCFCE7', label: 'Whole-Food Pass' },
  warn: { color: '#D97706', bg: '#FEF3C7', label: 'Use Caution' },
  fail: { color: '#DC2626', bg: '#FEE2E2', label: 'Not a Great Fit' },
};

export const MEAL_IMAGE_QUALITY = 0.50;
export const PRODUCT_IMAGE_QUALITY = 0.65;

export function confidenceBand(value: number): string {
  if (value >= 0.8) return 'High confidence';
  if (value >= 0.6) return 'Medium confidence';
  return 'Low confidence';
}

export function formatNumericDraft(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}
