/**
 * useScanState — Consolidated state management for the Scan screen.
 *
 * Replaces 32+ individual useState declarations with a single
 * reducer-based store. Each scan mode (meal vs product) gets its own
 * sub-state slice to prevent cross-contamination.
 */
import { useReducer, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────

export type ScanMode = 'meal' | 'product';
export type ScanStep = 'capture' | 'review' | 'result';
export type PortionSize = 'small' | 'medium' | 'large';
export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type SourceContext = 'home' | 'restaurant';
export type ProductSource = 'label_image' | 'barcode' | 'label_manual';
export type ProductCaptureType = 'ingredients' | 'nutrition' | 'front_label';

export interface ScanImageMeta {
  fileName?: string | null;
  mimeType?: string | null;
}

interface MealState {
  imageUri: string | null;
  imageMeta: ScanImageMeta;
  mealType: MealKind;
  portionSize: PortionSize;
  sourceContext: SourceContext;
  result: any | null; // MealResult
  notFoodReason: string | null;
  labelDraft: string;
  ingredientDrafts: string[];
  addIngredientText: string;
}

interface ProductState {
  imageUri: string | null;
  imageMeta: ScanImageMeta;
  barcodeValue: string;
  productName: string;
  brand: string;
  ingredientsText: string;
  calories: string;
  protein: string;
  fiber: string;
  sugar: string;
  carbs: string;
  sodium: string;
  captureType: ProductCaptureType;
  result: any | null; // ProductResult
}

interface UIState {
  showBarcodeSheet: boolean;
  showProductEditSheet: boolean;
  showModesInfo: boolean;
  successModal: { visible: boolean; message: string };
  cameraGranted: boolean;
  permUndetermined: boolean;
  loggedChrono: boolean;
}

export interface ScanState {
  mode: ScanMode;
  step: ScanStep;
  isLoading: boolean;
  meal: MealState;
  product: ProductState;
  ui: UIState;
}

// ── Initial State ───────────────────────────────────────────────────

const INITIAL_MEAL: MealState = {
  imageUri: null,
  imageMeta: {},
  mealType: 'meal' as MealKind,
  portionSize: 'medium',
  sourceContext: 'home',
  result: null,
  notFoodReason: null,
  labelDraft: '',
  ingredientDrafts: [],
  addIngredientText: '',
};

const INITIAL_PRODUCT: ProductState = {
  imageUri: null,
  imageMeta: {},
  barcodeValue: '',
  productName: '',
  brand: '',
  ingredientsText: '',
  calories: '',
  protein: '',
  fiber: '',
  sugar: '',
  carbs: '',
  sodium: '',
  captureType: 'front_label',
  result: null,
};

const INITIAL_UI: UIState = {
  showBarcodeSheet: false,
  showProductEditSheet: false,
  showModesInfo: false,
  successModal: { visible: false, message: '' },
  cameraGranted: false,
  permUndetermined: false,
  loggedChrono: false,
};

export const INITIAL_STATE: ScanState = {
  mode: 'meal',
  step: 'capture',
  isLoading: false,
  meal: INITIAL_MEAL,
  product: INITIAL_PRODUCT,
  ui: INITIAL_UI,
};

// ── Actions ─────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_MODE'; payload: ScanMode }
  | { type: 'SET_STEP'; payload: ScanStep }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_MEAL'; payload: Partial<MealState> }
  | { type: 'UPDATE_PRODUCT'; payload: Partial<ProductState> }
  | { type: 'UPDATE_UI'; payload: Partial<UIState> }
  | { type: 'RESET_MEAL' }
  | { type: 'RESET_PRODUCT' }
  | { type: 'RESET_ALL' };

function scanReducer(state: ScanState, action: Action): ScanState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'UPDATE_MEAL':
      return { ...state, meal: { ...state.meal, ...action.payload } };
    case 'UPDATE_PRODUCT':
      return { ...state, product: { ...state.product, ...action.payload } };
    case 'UPDATE_UI':
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'RESET_MEAL':
      return { ...state, meal: INITIAL_MEAL };
    case 'RESET_PRODUCT':
      return { ...state, product: INITIAL_PRODUCT };
    case 'RESET_ALL':
      return { ...INITIAL_STATE, ui: { ...INITIAL_UI, cameraGranted: state.ui.cameraGranted } };
    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export function useScanState() {
  const [state, dispatch] = useReducer(scanReducer, INITIAL_STATE);

  const setMode = useCallback((mode: ScanMode) => dispatch({ type: 'SET_MODE', payload: mode }), []);
  const setStep = useCallback((step: ScanStep) => dispatch({ type: 'SET_STEP', payload: step }), []);
  const setLoading = useCallback((loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }), []);
  const updateMeal = useCallback((payload: Partial<MealState>) => dispatch({ type: 'UPDATE_MEAL', payload }), []);
  const updateProduct = useCallback((payload: Partial<ProductState>) => dispatch({ type: 'UPDATE_PRODUCT', payload }), []);
  const updateUI = useCallback((payload: Partial<UIState>) => dispatch({ type: 'UPDATE_UI', payload }), []);
  const resetMeal = useCallback(() => dispatch({ type: 'RESET_MEAL' }), []);
  const resetProduct = useCallback(() => dispatch({ type: 'RESET_PRODUCT' }), []);
  const resetAll = useCallback(() => dispatch({ type: 'RESET_ALL' }), []);

  return {
    state,
    setMode,
    setStep,
    setLoading,
    updateMeal,
    updateProduct,
    updateUI,
    resetMeal,
    resetProduct,
    resetAll,
  };
}
