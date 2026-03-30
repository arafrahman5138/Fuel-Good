import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenContainer } from '../../components/ScreenContainer';
import { FuelScoreRing } from '../../components/FuelScoreRing';
import { useTheme } from '../../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { useThemeStore } from '../../stores/themeStore';
import { useFuelStore } from '../../stores/fuelStore';
import { wholeFoodScanApi } from '../../services/api';
import { ChronometerSuccessModal } from '../../components/ChronometerSuccessModal';

const CameraModule: {
  CameraView?: React.ComponentType<any>;
} | null = (() => {
  try {
    return require('expo-camera');
  } catch {
    return null;
  }
})();

const CameraView = CameraModule?.CameraView;
const SCAN_IMAGE_QUALITY = 0.65;

type ScanMode = 'meal' | 'product';
type ScanStep = 'capture' | 'review' | 'result';
type PortionSize = 'small' | 'medium' | 'large';
type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type SourceContext = 'home' | 'restaurant';
type ProductSource = 'label_image' | 'barcode' | 'label_manual';
type ProductCaptureType = 'ingredients' | 'nutrition' | 'front_label';
type ScanImageMeta = {
  fileName?: string | null;
  mimeType?: string | null;
};

interface ProductResult {
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
}

interface MealResult {
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

const PRODUCT_TIER_META: Record<ProductResult['tier'], { color: string; bg: string; label: string }> = {
  whole_food: { color: '#16A34A', bg: '#DCFCE7', label: 'Whole-Food Friendly' },
  solid: { color: '#2563EB', bg: '#DBEAFE', label: 'Solid Option' },
  mixed: { color: '#D97706', bg: '#FEF3C7', label: 'Mixed Bag' },
  ultra_processed: { color: '#DC2626', bg: '#FEE2E2', label: 'Heavily Processed' },
};

const MEAL_STATUS_META: Record<MealResult['whole_food_status'], { color: string; bg: string; label: string }> = {
  pass: { color: '#16A34A', bg: '#DCFCE7', label: 'Whole-Food Pass' },
  warn: { color: '#D97706', bg: '#FEF3C7', label: 'Use Caution' },
  fail: { color: '#DC2626', bg: '#FEE2E2', label: 'Not a Great Fit' },
};

const MACRO_ACCENTS = {
  calories: { color: '#111111', bg: '#F8F6F1' },
  protein: { color: '#22C55E', bg: '#ECFDF3' },
  carbs: { color: '#F59E0B', bg: '#FFF7E8' },
  fat: { color: '#8B5CF6', bg: '#F4ECFF' },
  fiber: { color: '#3B82F6', bg: '#ECF4FF' },
};

function confidenceBand(value: number): string {
  if (value >= 0.8) return 'High confidence';
  if (value >= 0.6) return 'Medium confidence';
  return 'Low confidence';
}

function formatNumericDraft(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}

function cleanMealLabel(raw: string | undefined, ingredients: string[]): string {
  const source = (raw || '').replace(/\s+/g, ' ').trim();
  const stripped = source
    .replace(/\b(with|and|in|on|over|under|w)\s*$/i, '')
    .replace(/[-,:;]+$/g, '')
    .trim();

  if (stripped.length >= 4) return stripped;
  if (ingredients.length > 0) {
    return ingredients.slice(0, 2).join(' + ');
  }
  return 'Detected meal';
}

function normalizeMealResult(result: MealResult): MealResult {
  const estimatedIngredients = result.estimated_ingredients || [];
  const normalizedIngredients = result.normalized_ingredients || [];
  return {
    ...result,
    meal_label: cleanMealLabel(result.meal_label, estimatedIngredients.length ? estimatedIngredients : normalizedIngredients),
    estimated_ingredients: estimatedIngredients,
    normalized_ingredients: normalizedIngredients,
    whole_food_flags: result.whole_food_flags || [],
    upgrade_suggestions: result.upgrade_suggestions || [],
    recovery_plan: result.recovery_plan || [],
    fuel_score: result.fuel_score != null ? Number(result.fuel_score) : null,
    fuel_reasoning: result.fuel_reasoning || [],
    snack_profile: result.snack_profile || null,
    pairing_opportunity: Boolean(result.pairing_opportunity),
    pairing_recommended_recipe_id: result.pairing_recommended_recipe_id || null,
    pairing_recommended_title: result.pairing_recommended_title || null,
    pairing_projected_mes: result.pairing_projected_mes != null ? Number(result.pairing_projected_mes) : null,
    pairing_projected_delta: result.pairing_projected_delta != null ? Number(result.pairing_projected_delta) : null,
    pairing_reasons: result.pairing_reasons || [],
    pairing_timing: result.pairing_timing || null,
  };
}

function normalizeProductResult(result: ProductResult): ProductResult {
  return {
    ...result,
    brand: result.brand || null,
    barcode: result.barcode || null,
    source: result.source || 'label_manual',
    capture_type: result.capture_type || 'front_label',
    highlights: result.highlights || [],
    concerns: result.concerns || [],
    reasoning: result.reasoning || [],
    ingredients_text: result.ingredients_text || '',
    confidence: Number(result.confidence || 0),
    confidence_breakdown: result.confidence_breakdown || {},
    recoverable: Boolean(result.recoverable),
    notes: result.notes || [],
    processing_flags: result.processing_flags || {},
    nutrition_snapshot: {
      calories: Number(result.nutrition_snapshot?.calories || 0),
      protein_g: Number(result.nutrition_snapshot?.protein_g || 0),
      fat_g: Number(result.nutrition_snapshot?.fat_g || 0),
      fiber_g: Number(result.nutrition_snapshot?.fiber_g || 0),
      sugar_g: Number(result.nutrition_snapshot?.sugar_g || 0),
      carbs_g: Number(result.nutrition_snapshot?.carbs_g || 0),
      sodium_mg: Number(result.nutrition_snapshot?.sodium_mg || 0),
    },
  };
}

function inferImageMeta(uri: string, fileName?: string | null, mimeType?: string | null): ScanImageMeta {
  const fallbackMimeType = wholeFoodScanApi.inferImageMimeType(uri, mimeType);
  const extension = fallbackMimeType.split('/')[1] || 'jpg';
  const fallbackName = fileName || `scan-upload.${extension}`;
  return {
    fileName: fallbackName,
    mimeType: fallbackMimeType,
  };
}

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const fuelSettings = useFuelStore((s) => s.settings);
  const fuelWeekly = useFuelStore((s) => s.weekly);
  const cameraRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  // Scan result entrance animation
  const resultScale = useRef(new Animated.Value(0.88)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  const [scanMode, setScanMode] = useState<ScanMode>('meal');
  const [scanStep, setScanStep] = useState<ScanStep>('capture');
  const [isLoading, setIsLoading] = useState(false);

  const [barcodeValue, setBarcodeValue] = useState('');
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [carbs, setCarbs] = useState('');
  const [sodium, setSodium] = useState('');
  const [productImageUri, setProductImageUri] = useState<string | null>(null);
  const [productImageMeta, setProductImageMeta] = useState<ScanImageMeta>({});
  const [showBarcodeSheet, setShowBarcodeSheet] = useState(false);
  const [showProductEditSheet, setShowProductEditSheet] = useState(false);

  const [mealImageUri, setMealImageUri] = useState<string | null>(null);
  const [mealImageMeta, setMealImageMeta] = useState<ScanImageMeta>({});
  const [mealType, setMealType] = useState<MealKind>('lunch');
  const [portionSize, setPortionSize] = useState<PortionSize>('medium');
  const [sourceContext, setSourceContext] = useState<SourceContext>('home');
  const [mealResult, setMealResult] = useState<MealResult | null>(null);
  const [notFoodReason, setNotFoodReason] = useState<string | null>(null);
  const [mealLabelDraft, setMealLabelDraft] = useState('');
  const [ingredientDrafts, setIngredientDrafts] = useState<string[]>([]);
  const [addIngredientText, setAddIngredientText] = useState('');

  const [productResult, setProductResult] = useState<ProductResult | null>(null);
  const [successModal, setSuccessModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [showModesInfo, setShowModesInfo] = useState(false);

  const mealStatusMeta = mealResult ? MEAL_STATUS_META[mealResult.whole_food_status] : null;
  const productTierMeta = productResult ? PRODUCT_TIER_META[productResult.tier] : null;
  const isAnalyzingMeal = scanStep === 'result' && scanMode === 'meal' && isLoading && !mealResult;
  const isAnalyzingProduct = scanStep === 'result' && scanMode === 'product' && isLoading && !productResult;

  const nutritionRows = useMemo(() => {
    if (!mealResult) return [];
    const n = mealResult.nutrition_estimate || {};
    return [
      { key: 'calories', label: 'Calories', value: `${Math.round(Number(n.calories || 0))}`, accent: MACRO_ACCENTS.calories },
      { key: 'protein', label: 'Protein', value: `${Math.round(Number(n.protein || 0))}g`, accent: MACRO_ACCENTS.protein },
      { key: 'carbs', label: 'Carbs', value: `${Math.round(Number(n.carbs || 0))}g`, accent: MACRO_ACCENTS.carbs },
      { key: 'fat', label: 'Fat', value: `${Math.round(Number(n.fat || 0))}g`, accent: MACRO_ACCENTS.fat },
      { key: 'fiber', label: 'Fiber', value: `${Math.round(Number(n.fiber || 0))}g`, accent: MACRO_ACCENTS.fiber },
    ];
  }, [mealResult]);

  // Animate result entrance when scan result arrives
  useEffect(() => {
    if (mealResult || productResult) {
      resultScale.setValue(0.88);
      resultOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(resultScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 6,
        }),
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [mealResult, productResult, resultScale, resultOpacity]);

  const [permUndetermined, setPermUndetermined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (scanStep !== 'capture') return undefined;

    // Pre-check permission status without triggering system dialog
    ImagePicker.getCameraPermissionsAsync()
      .then(({ granted, status }) => {
        if (cancelled) return;
        if (granted) {
          setCameraGranted(true);
        } else if (status === 'undetermined') {
          setPermUndetermined(true);
        } else {
          setCameraGranted(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCameraGranted(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scanStep]);

  const handleGrantCamera = () => {
    setPermUndetermined(false);
    ImagePicker.requestCameraPermissionsAsync()
      .then(({ granted }) => setCameraGranted(granted))
      .catch(() => setCameraGranted(false));
  };

  useEffect(() => {
    if (!isAnalyzingMeal) {
      pulseAnim.stopAnimation();
      spinAnim.stopAnimation();
      dotAnim1.stopAnimation();
      dotAnim2.stopAnimation();
      dotAnim3.stopAnimation();
      pulseAnim.setValue(0.4);
      spinAnim.setValue(0);
      dotAnim1.setValue(0.3);
      dotAnim2.setValue(0.3);
      dotAnim3.setValue(0.3);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    const buildDotLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );

    const dotLoop1 = buildDotLoop(dotAnim1, 0);
    const dotLoop2 = buildDotLoop(dotAnim2, 200);
    const dotLoop3 = buildDotLoop(dotAnim3, 400);

    pulseLoop.start();
    spinLoop.start();
    dotLoop1.start();
    dotLoop2.start();
    dotLoop3.start();

    return () => {
      pulseLoop.stop();
      spinLoop.stop();
      dotLoop1.stop();
      dotLoop2.stop();
      dotLoop3.stop();
    };
  }, [dotAnim1, dotAnim2, dotAnim3, isAnalyzingMeal, pulseAnim, spinAnim]);

  const resetProductState = () => {
    setProductResult(null);
    setProductImageUri(null);
    setProductImageMeta({});
    setBarcodeValue('');
    setProductName('');
    setBrand('');
    setIngredientsText('');
    setCalories('');
    setProtein('');
    setFiber('');
    setSugar('');
    setCarbs('');
    setSodium('');
    setShowBarcodeSheet(false);
    setShowProductEditSheet(false);
  };

  const resetMealState = () => {
    setMealImageUri(null);
    setMealImageMeta({});
    setMealResult(null);
    setNotFoodReason(null);
    setMealLabelDraft('');
    setIngredientDrafts([]);
    setAddIngredientText('');
  };

  const handleModeChange = (nextMode: ScanMode) => {
    setScanMode(nextMode);
    setScanStep('capture');
    if (nextMode === 'meal') {
      resetProductState();
    } else {
      resetMealState();
    }
  };

  const handleBack = () => {
    if (scanStep === 'capture') {
      router.back();
      return;
    }
    if (scanStep === 'review') {
      setScanStep('capture');
      return;
    }
    if (scanMode === 'meal') {
      resetMealState();
    } else {
      resetProductState();
    }
    setScanStep('capture');
  };

  const handleExitToHome = () => {
    resetMealState();
    resetProductState();
    setScanMode('meal');
    setScanStep('capture');
    router.dismiss();
  };

  const syncProductDrafts = (result: ProductResult) => {
    setProductName(result.product_name || '');
    setBrand(result.brand || '');
    setIngredientsText(result.ingredients_text || '');
    setCalories(formatNumericDraft(result.nutrition_snapshot?.calories || 0));
    setProtein(formatNumericDraft(result.nutrition_snapshot?.protein_g || 0));
    setFiber(formatNumericDraft(result.nutrition_snapshot?.fiber_g || 0));
    setSugar(formatNumericDraft(result.nutrition_snapshot?.sugar_g || 0));
    setCarbs(formatNumericDraft(result.nutrition_snapshot?.carbs_g || 0));
    setSodium(formatNumericDraft(result.nutrition_snapshot?.sodium_mg || 0));
  };

  const pickMealImage = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!cameraPermission.granted || !mediaPermission.granted) {
          Alert.alert('Permission needed', 'Camera and photo permissions are required to capture a meal photo.');
          return;
        }
      } else {
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          Alert.alert('Permission needed', 'Photo library permission is required to choose a meal photo.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: SCAN_IMAGE_QUALITY, mediaTypes: ['images'] })
          : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: SCAN_IMAGE_QUALITY, mediaTypes: ['images'] });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const imageMeta = inferImageMeta(uri, asset.fileName, asset.mimeType);
      setMealImageUri(uri);
      setMealImageMeta(imageMeta);
      setMealResult(null);
      await analyzeMealWithUri({ uri, ...imageMeta });
    } catch (err: any) {
      Alert.alert('Unable to open camera', err?.message || 'Camera or photo permissions are missing.');
    }
  };

  const captureMealPhoto = async () => {
    if (!CameraView || !cameraGranted || !cameraRef.current?.takePictureAsync) {
      await pickMealImage('camera');
      return;
    }

    try {
      setIsLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: SCAN_IMAGE_QUALITY,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setIsLoading(false);
        return;
      }

      const uri = photo.uri;
      const imageMeta = inferImageMeta(uri);
      setMealImageUri(uri);
      setMealImageMeta(imageMeta);
      setMealResult(null);
      await analyzeMealWithUri({ uri, ...imageMeta });
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert('Unable to capture photo', err?.message || 'Could not take a photo right now.');
    }
  };

  const analyzeMealWithUri = async (image: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    setIsLoading(true);
    setScanStep('result');
    setNotFoodReason(null);
    try {
      const raw = await wholeFoodScanApi.analyzeMeal({
        imageUri: image.uri,
        imageName: image.fileName,
        imageType: image.mimeType,
        meal_type: mealType,
        portion_size: portionSize,
        source_context: sourceContext,
      });
      if (raw?.is_not_food) {
        setNotFoodReason(raw.not_food_reason || "That doesn't look like food.");
        return;
      }
      const next = normalizeMealResult(raw);
      setMealResult(next);
      setMealLabelDraft(next.meal_label);
      setIngredientDrafts(next.estimated_ingredients || []);
      // Sync meal type chip with the AI's classification (e.g. desserts → snack)
      if (next.meal_type && (['breakfast', 'lunch', 'dinner', 'snack'] as MealKind[]).includes(next.meal_type as MealKind)) {
        setMealType(next.meal_type as MealKind);
      }
    } catch (err: any) {
      Alert.alert('Meal scan failed', err?.message || 'Unable to analyze that meal right now.');
      setScanStep('capture');
    } finally {
      setIsLoading(false);
    }
  };

  const pickProductImage = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!cameraPermission.granted || !mediaPermission.granted) {
          Alert.alert('Permission needed', 'Camera and photo permissions are required to capture a label photo.');
          return;
        }
      } else {
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          Alert.alert('Permission needed', 'Photo library permission is required to choose a label photo.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: SCAN_IMAGE_QUALITY, mediaTypes: ['images'] })
          : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: SCAN_IMAGE_QUALITY, mediaTypes: ['images'] });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const imageMeta = inferImageMeta(uri, asset.fileName, asset.mimeType);
      setProductImageUri(uri);
      setProductImageMeta(imageMeta);
      setProductResult(null);
      await analyzeProductImageWithUri({ uri, ...imageMeta });
    } catch (err: any) {
      Alert.alert('Unable to open camera', err?.message || 'Camera or photo permissions are missing.');
    }
  };

  const captureProductPhoto = async () => {
    if (!CameraView || !cameraGranted || !cameraRef.current?.takePictureAsync) {
      await pickProductImage('camera');
      return;
    }

    try {
      setIsLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: SCAN_IMAGE_QUALITY,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setIsLoading(false);
        return;
      }

      const uri = photo.uri;
      const imageMeta = inferImageMeta(uri);
      setProductImageUri(uri);
      setProductImageMeta(imageMeta);
      setProductResult(null);
      await analyzeProductImageWithUri({ uri, ...imageMeta });
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert('Unable to capture photo', err?.message || 'Could not take a label photo right now.');
    }
  };

  const analyzeProductImageWithUri = async (image: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    setIsLoading(true);
    setScanStep('result');
    setNotFoodReason(null);
    try {
      const raw = await wholeFoodScanApi.analyzeProductImage({
        imageUri: image.uri,
        imageName: image.fileName,
        imageType: image.mimeType,
        capture_type: 'front_label',
      });
      if (raw?.is_not_food) {
        setNotFoodReason(raw.not_food_reason || "That doesn't look like a food product.");
        return;
      }
      const next = normalizeProductResult(raw);
      if (!next || !next.product_name) {
        setNotFoodReason("Couldn't identify a food product in this image. Try scanning the ingredient label or barcode instead.");
        return;
      }
      setProductResult(next);
      syncProductDrafts(next);
      setShowBarcodeSheet(false);
      setShowProductEditSheet(Boolean(next.recoverable || next.confidence < 0.6));
    } catch (err: any) {
      Alert.alert('Label scan failed', err?.message || 'Unable to analyze that label photo right now.');
      setScanStep('capture');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeMeal = async () => {
    if (!mealImageUri) {
      Alert.alert('Meal photo required', 'Take a photo or choose one from your library first.');
      return;
    }
    await analyzeMealWithUri({ uri: mealImageUri, ...mealImageMeta });
  };

  const recomputeMeal = async () => {
    if (!mealResult) return;
    setIsLoading(true);
    try {
      const next = normalizeMealResult(
        await wholeFoodScanApi.updateMeal(mealResult.id, {
          meal_label: cleanMealLabel(mealLabelDraft || mealResult.meal_label, ingredientDrafts),
          meal_type: mealType,
          portion_size: portionSize,
          source_context: sourceContext,
          ingredients: ingredientDrafts,
        })
      );
      setMealResult(next);
      setMealLabelDraft(next.meal_label);
      setIngredientDrafts(next.estimated_ingredients || []);
      if (next.meal_type && (['breakfast', 'lunch', 'dinner', 'snack'] as MealKind[]).includes(next.meal_type as MealKind)) {
        setMealType(next.meal_type as MealKind);
      }
    } catch (err: any) {
      Alert.alert('Recompute failed', err?.message || 'Unable to recompute this meal scan right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const logMeal = async () => {
    if (!mealResult || isLoading) return;
    setIsLoading(true);
    try {
      await wholeFoodScanApi.logMeal(mealResult.id, {
        meal_type: mealType,
        include_recommended_pairing: Boolean(mealResult.pairing_opportunity && mealResult.pairing_recommended_recipe_id),
      });
      const pairingLabel = mealResult.pairing_opportunity && mealResult.pairing_recommended_title
        ? ` + ${mealResult.pairing_recommended_title}`
        : '';
      setSuccessModal({
        visible: true,
        message: `"${mealResult.meal_label}"${pairingLabel} has been added to today's nutrition log.`,
      });
      setMealResult({ ...mealResult, logged_to_chronometer: true });
    } catch (err: any) {
      Alert.alert('Log failed', err?.message || 'Unable to log that meal right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeBarcode = async () => {
    if (!barcodeValue.trim()) {
      Alert.alert('Barcode required', 'Enter a barcode first.');
      return;
    }
    setIsLoading(true);
    setProductResult(null);
    setScanStep('result');
    try {
      const next = normalizeProductResult(await wholeFoodScanApi.analyzeBarcode(barcodeValue.trim()));
      setProductResult(next);
      syncProductDrafts(next);
      setShowBarcodeSheet(false);
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message || 'Unable to analyze that barcode right now.');
      setScanStep('capture');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeLabel = async () => {
    if (!ingredientsText.trim()) {
      Alert.alert('Ingredients required', 'Enter the ingredient list first.');
      return;
    }
    setIsLoading(true);
    setProductResult(null);
    setScanStep('result');
    try {
      const next = normalizeProductResult(await wholeFoodScanApi.analyzeLabel({
        product_name: productName || undefined,
        brand: brand || undefined,
        ingredients_text: ingredientsText,
        calories: calories ? Number(calories) : undefined,
        protein_g: protein ? Number(protein) : undefined,
        fiber_g: fiber ? Number(fiber) : undefined,
        sugar_g: sugar ? Number(sugar) : undefined,
        carbs_g: carbs ? Number(carbs) : undefined,
        sodium_mg: sodium ? Number(sodium) : undefined,
        source: 'label_manual',
      }));
      setProductResult(next);
      syncProductDrafts(next);
      setShowProductEditSheet(false);
      setShowBarcodeSheet(false);
    } catch (err: any) {
      Alert.alert('Analysis failed', err?.message || 'Unable to score this product right now.');
      setScanStep(productResult ? 'result' : 'capture');
    } finally {
      setIsLoading(false);
    }
  };

  const scanAnotherProduct = () => {
    resetProductState();
    setScanMode('product');
    setScanStep('capture');
  };

  const addIngredient = () => {
    const trimmed = addIngredientText.trim();
    if (!trimmed) return;
    setIngredientDrafts((current) => [...current, trimmed]);
    setAddIngredientText('');
  };

  const renderCaptureStep = () => {
    const modes: Array<{ key: ScanMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
      { key: 'meal', label: 'Scan Food', icon: 'scan-outline' },
      { key: 'product', label: 'Packaged Food', icon: 'reader-outline' },
    ];
    return (
      <View style={[styles.captureRoot, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {CameraView && cameraGranted ? (
          <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" autofocus="on" />
        ) : (
          <LinearGradient
            colors={['#0A1914', '#0D2018', '#132B1F']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cameraPreview}
          >
            {permUndetermined && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <Ionicons name="camera-outline" size={48} color="#22C55E" style={{ marginBottom: 16 }} />
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Camera Access Needed</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Scan food items and ingredient labels to get instant nutrition scores.</Text>
                <TouchableOpacity onPress={handleGrantCamera} style={{ backgroundColor: '#22C55E', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Grant Access</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.65)']}
          locations={[0, 0.35, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.captureOverlay}
        />

        {/* Top bar: close + branding pill */}
        <View style={styles.captureTopRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.captureCloseBtn}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.captureBrandPill}>
            <View style={styles.captureBrandDot} />
            <Text style={styles.captureBrandText}>Fuel Good</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Spacer — camera area fills the middle naturally */}
        <View style={{ flex: 1 }} />

          {/* Bottom controls */}
        <View style={styles.captureControls}>
          {/* Mode switcher */}
          <View style={styles.modeRail}>
            {modes.map((item) => {
              const active = scanMode === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => handleModeChange(item.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.modePill,
                    active && styles.modePillActive,
                  ]}
                >
                  <Ionicons name={item.icon} size={16} color={active ? '#16A34A' : 'rgba(255,255,255,0.7)'} />
                  <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {scanMode === 'product' && (
            <View style={styles.captureHintCard}>
              <View style={styles.captureHintHeader}>
                <Ionicons name="sparkles-outline" size={16} color="#34D399" />
                <Text style={styles.captureHintTitle}>Packaged food</Text>
              </View>
              <Text style={styles.captureHintCopy}>
                Snap the ingredients label for an instant verdict, or use barcode if the package is easy to scan.
              </Text>
              <View style={styles.captureHintActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowBarcodeSheet(true)}
                  style={styles.captureHintButton}
                >
                  <Ionicons name="barcode-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.captureHintButtonText}>Use barcode</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Shutter row */}
          <View style={styles.shutterRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (scanMode === 'meal') {
                  pickMealImage('library');
                } else {
                  pickProductImage('library');
                }
              }}
              style={styles.shutterSideBtn}
            >
              <Ionicons name="images-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (scanMode === 'meal') {
                  captureMealPhoto();
                } else {
                  captureProductPhoto();
                }
              }}
              style={styles.shutterBtn}
            >
              {isLoading ? (
                <ActivityIndicator color="#16A34A" />
              ) : (
                <View style={styles.shutterBtnInner} />
              )}
            </TouchableOpacity>
            {scanMode === 'product' ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowBarcodeSheet(true)} style={styles.shutterSideBtn}>
                <Ionicons name="barcode-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderReviewHeader = (showExit = false) => (
    <View style={[styles.reviewHeader, { paddingTop: insets.top + 6, backgroundColor: theme.surface }]}>
      <TouchableOpacity
        onPress={showExit ? handleExitToHome : handleBack}
        activeOpacity={0.85}
        style={[styles.headerCircle, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <Ionicons name={showExit ? 'close' : 'chevron-back'} size={showExit ? 18 : 20} color={showExit ? theme.textSecondary : theme.primary} style={showExit ? undefined : { transform: [{ translateX: -1 }] }} />
      </TouchableOpacity>
      <View style={[styles.headerCapsule, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={[styles.headerDot, { backgroundColor: theme.primary }]} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>Scan</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderMealReviewStep = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xxxl,
        paddingTop: Spacing.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.sheetCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>Scan a meal</Text>
        <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
          Review the image, add quick context, then analyze the meal.
        </Text>

        <View style={[styles.previewShell, { backgroundColor: theme.surfaceElevated }]}>
          {mealImageUri ? (
            <Image source={{ uri: mealImageUri }} style={styles.reviewImage} />
          ) : (
            <View style={styles.previewFallback}>
              <Ionicons name="image-outline" size={28} color={theme.textSecondary} />
              <Text style={[styles.previewFallbackText, { color: theme.textSecondary }]}>No photo selected yet</Text>
            </View>
          )}
        </View>

        <View style={styles.reviewButtonRow}>
          <TouchableOpacity
            onPress={() => pickMealImage('camera')}
            activeOpacity={0.85}
            style={[styles.reviewActionButton, { backgroundColor: theme.primaryMuted }]}
          >
            <Ionicons name="camera-outline" size={18} color={theme.primary} />
            <Text style={[styles.reviewActionText, { color: theme.primary }]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => pickMealImage('library')}
            activeOpacity={0.85}
            style={[styles.reviewActionButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
          >
            <Ionicons name="images-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.reviewActionText, { color: theme.textSecondary }]}>Library</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.contextTitle, { color: theme.text }]}>Quick context</Text>
        <View style={styles.choiceRow}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as MealKind[]).map((item) => {
            const active = mealType === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setMealType(item)}
                activeOpacity={0.85}
                style={[
                  styles.choiceChip,
                  { backgroundColor: active ? theme.primaryMuted : theme.surface, borderColor: active ? theme.primary : theme.border },
                ]}
              >
                <Text style={[styles.choiceText, { color: active ? theme.primary : theme.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.choiceRow}>
          {(['small', 'medium', 'large'] as PortionSize[]).map((item) => {
            const active = portionSize === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setPortionSize(item)}
                activeOpacity={0.85}
                style={[
                  styles.choiceChip,
                  { backgroundColor: active ? theme.primaryMuted : theme.surface, borderColor: active ? theme.primary : theme.border },
                ]}
              >
                <Text style={[styles.choiceText, { color: active ? theme.primary : theme.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.choiceRow}>
          {(['home', 'restaurant'] as SourceContext[]).map((item) => {
            const active = sourceContext === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setSourceContext(item)}
                activeOpacity={0.85}
                style={[
                  styles.choiceChip,
                  { backgroundColor: active ? theme.primaryMuted : theme.surface, borderColor: active ? theme.primary : theme.border },
                ]}
              >
                <Text style={[styles.choiceText, { color: active ? theme.primary : theme.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={analyzeMeal} activeOpacity={0.9} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Analyze Meal</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderAnalyzingScreen = () => {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const isDark = theme.text === '#FFFFFF';
    const isMealScan = scanMode === 'meal';
    const ui = isDark
      ? {
          background: '#0A0F0D',
          overlay: 'rgba(5, 12, 8, 0.75)',
          title: '#FFFFFF',
          subtitle: 'rgba(255,255,255,0.5)',
          stepBg: 'rgba(255,255,255,0.06)',
          stepBorder: 'rgba(255,255,255,0.06)',
          stepText: 'rgba(255,255,255,0.75)',
          brandBg: 'rgba(255,255,255,0.06)',
          brandText: 'rgba(255,255,255,0.45)',
          innerBg: 'rgba(34, 197, 94, 0.12)',
          innerBorder: 'rgba(34, 197, 94, 0.2)',
          pulseBorder: '#22C55E40',
        }
      : {
          background: '#F6FBF7',
          overlay: 'rgba(248, 252, 249, 0.86)',
          title: '#111827',
          subtitle: '#5F6B63',
          stepBg: 'rgba(255,255,255,0.84)',
          stepBorder: 'rgba(22, 163, 74, 0.10)',
          stepText: '#2F3A34',
          brandBg: 'rgba(22, 163, 74, 0.08)',
          brandText: '#527062',
          innerBg: 'rgba(34, 197, 94, 0.10)',
          innerBorder: 'rgba(34, 197, 94, 0.16)',
          pulseBorder: 'rgba(34, 197, 94, 0.26)',
        };

    const steps = [
      isMealScan
        ? { icon: 'eye-outline' as const, label: 'Identifying ingredients' }
        : { icon: 'reader-outline' as const, label: 'Reading label text' },
      isMealScan
        ? { icon: 'nutrition-outline' as const, label: 'Estimating nutrition' }
        : { icon: 'nutrition-outline' as const, label: 'Extracting nutrition facts' },
      isMealScan
        ? { icon: 'shield-checkmark-outline' as const, label: 'Scoring whole-food fit' }
        : { icon: 'shield-checkmark-outline' as const, label: 'Scoring whole-food fit' },
    ];

    return (
      <View style={[analyzeStyles.container, { backgroundColor: ui.background }]}>
        {/* Meal image background */}
        {(isMealScan ? mealImageUri : productImageUri) && (
          <>
            <Image source={{ uri: (isMealScan ? mealImageUri : productImageUri) || '' }} style={analyzeStyles.bgImage} blurRadius={20} />
            <View style={[analyzeStyles.bgOverlay, { backgroundColor: ui.overlay }]} />
          </>
        )}

        <View style={analyzeStyles.content}>
          {/* Pulsing ring around icon */}
          <View style={analyzeStyles.ringWrap}>
            <Animated.View style={[analyzeStyles.pulseRing, { borderColor: ui.pulseBorder, opacity: pulseAnim, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.85, 1.15] }) }] }]} />
            <Animated.View style={[analyzeStyles.spinRing, { transform: [{ rotate: spin }] }]}>
              <LinearGradient
                colors={['#22C55E', '#16A34A', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={analyzeStyles.spinGradient}
              />
            </Animated.View>
            <View style={[analyzeStyles.innerCircle, { backgroundColor: ui.innerBg, borderColor: ui.innerBorder }]}>
              <Ionicons name="scan-outline" size={32} color="#22C55E" />
            </View>
          </View>

          {/* Title + animated dots */}
          <View style={analyzeStyles.titleRow}>
            <Text style={[analyzeStyles.title, { color: ui.title }]}>
              {isMealScan ? 'Analyzing your meal' : 'Reading your label'}
            </Text>
            <View style={analyzeStyles.dotsRow}>
              {[dotAnim1, dotAnim2, dotAnim3].map((anim, i) => (
                <Animated.View key={i} style={[analyzeStyles.dot, { opacity: anim }]} />
              ))}
            </View>
          </View>
          <Text style={[analyzeStyles.subtitle, { color: ui.subtitle }]}>
            {isMealScan ? "Our AI is breaking down what's on your plate" : 'Fuel Good is extracting the label so you do not have to.'}
          </Text>

          {/* Step indicators */}
          <View style={analyzeStyles.stepsWrap}>
            {steps.map((step, i) => (
              <View key={i} style={[analyzeStyles.stepRow, { backgroundColor: ui.stepBg, borderColor: ui.stepBorder }]}>
                <View style={analyzeStyles.stepIcon}>
                  <Ionicons name={step.icon} size={16} color="#22C55E" />
                </View>
                <Text style={[analyzeStyles.stepLabel, { color: ui.stepText }]}>{step.label}</Text>
                <ActivityIndicator size="small" color="#22C55E" style={{ marginLeft: 'auto' }} />
              </View>
            ))}
          </View>

          {/* Brand pill */}
          <View style={[analyzeStyles.brandPill, { backgroundColor: ui.brandBg }]}>
            <View style={analyzeStyles.brandDot} />
            <Text style={[analyzeStyles.brandText, { color: ui.brandText }]}>Powered by Fuel Good AI</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMealResultStep = () => {
    if (!mealResult || !mealStatusMeta) {
      if (isLoading) return renderAnalyzingScreen();
      if (notFoodReason) {
        return (
          <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl }}>
            <View style={[styles.notFoodCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.notFoodIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="ban-outline" size={36} color="#D97706" />
              </View>
              <Text style={[styles.notFoodTitle, { color: theme.text }]}>That's not food</Text>
              <Text style={[styles.notFoodBody, { color: theme.textSecondary }]}>
                {notFoodReason}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { setNotFoodReason(null); setScanStep('capture'); }}
                style={[styles.notFoodRetakeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="camera-outline" size={18} color="#FFF" />
                <Text style={styles.notFoodRetakeBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      return null;
    }
    const displayBadgeText = mealResult.snack_profile?.label || mealStatusMeta.label;
    const displayBadgeColor = mealResult.snack_profile?.is_healthy_snack ? '#16A34A' : mealStatusMeta.color;
    const displayBadgeBg = mealResult.snack_profile ? '#DCFCE7' : mealStatusMeta.bg;
    const kindLabel =
      mealResult.meal_type === 'snack' || mealResult.snack_profile
        ? 'Snack'
        : mealResult.meal_context === 'full_meal'
        ? 'Full meal'
        : 'Meal';
    const mealContextCopy = `${confidenceBand(mealResult.confidence)} · ${kindLabel}`;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 132,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.resultHero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.resultHeroTop}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <TextInput
                value={mealLabelDraft}
                onChangeText={setMealLabelDraft}
                style={[styles.resultTitleInput, { color: theme.text }]}
                placeholderTextColor={theme.textTertiary}
              />
              <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>{mealContextCopy}</Text>
              <View style={[styles.statusChip, { backgroundColor: displayBadgeBg }]}>
                <Text style={[styles.statusChipText, { color: displayBadgeColor }]}>{displayBadgeText}</Text>
              </View>
            </View>
            {/* Fuel Score is always the primary score ring */}
            <View style={styles.scoreColumn}>
              <FuelScoreRing
                score={mealResult.fuel_score != null ? Math.round(mealResult.fuel_score) : 0}
                size={88}
                showLabel
                showIcon
              />
              {/* MES shown only as a secondary pill for full meals */}
              {mealResult.mes != null && mealResult.meal_context === 'full_meal' && (
                <View style={[styles.mesSecondaryPill, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                  <Text style={[styles.mesSecondaryValue, { color: theme.textSecondary }]}>
                    {Math.round(mealResult.mes.score)} MES
                  </Text>
                </View>
              )}
              {/* Flex impact messaging */}
              {mealResult.fuel_score != null && fuelSettings && (() => {
                const score = mealResult.fuel_score!;
                const target = fuelSettings.fuel_target;
                const flexAvail = fuelWeekly?.flex_budget?.flex_available ?? fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0;
                const cleanLogged = fuelWeekly?.flex_budget?.clean_meals_logged ?? 0;
                const cleanTarget = fuelWeekly?.flex_budget?.clean_meals_target ?? 17;
                if (score >= target) {
                  return (
                    <View style={[styles.flexImpactPill, { backgroundColor: '#22C55E14', borderColor: '#22C55E30' }]}>
                      <Ionicons name="trending-up" size={11} color="#22C55E" />
                      <Text style={[styles.flexImpactText, { color: '#16A34A' }]}>
                        Clean meal · {cleanLogged}/{cleanTarget}
                      </Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={[styles.flexImpactPill, { backgroundColor: '#F59E0B14', borderColor: '#F59E0B30' }]}>
                      <Ionicons name="ticket" size={11} color="#F59E0B" />
                      <Text style={[styles.flexImpactText, { color: '#D97706' }]}>
                        Flex meal · {flexAvail} left
                      </Text>
                    </View>
                  );
                }
              })()}
            </View>
          </View>
          {mealResult.confidence < 0.6 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { setMealResult(null); setScanStep('capture'); }}
              style={[styles.lowConfidenceBanner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
            >
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#92400E', fontSize: FontSize.sm, fontWeight: '600' }}>
                  Low confidence result
                </Text>
                <Text style={{ color: '#B45309', fontSize: FontSize.xs, marginTop: 1 }}>
                  Try retaking with better lighting or a closer angle
                </Text>
              </View>
              <Ionicons name="camera-outline" size={18} color="#D97706" />
            </TouchableOpacity>
          )}
          {mealImageUri ? (
            <View style={[styles.resultImageShell, { backgroundColor: theme.surfaceElevated }]}>
              <Image source={{ uri: mealImageUri }} style={styles.resultImage} />
            </View>
          ) : null}
          <View style={styles.macroGrid}>
            {nutritionRows.map((row) => (
              <View key={row.key} style={[styles.macroCard, { backgroundColor: row.accent.bg }]}>
                <Text style={[styles.macroCardValue, { color: row.accent.color }]}>{row.value}</Text>
                <Text style={[styles.macroCardLabel, { color: theme.textSecondary }]}>{row.label}</Text>
              </View>
            ))}
          </View>
          {/* Fuel Score Insight — explain low/processed scores */}
          {(mealResult.fuel_reasoning || []).length > 0 && mealResult.fuel_score != null && mealResult.fuel_score < 75 && (() => {
            const score = mealResult.fuel_score!;
            const isLow = score < 50;
            const bgColor = isLow ? '#FEF2F2' : '#FFFBEB';
            const borderColor = isLow ? '#FECACA' : '#FDE68A';
            const iconColor = isLow ? '#DC2626' : '#D97706';
            const headingColor = isLow ? '#991B1B' : '#92400E';
            const textColor = isLow ? '#B91C1C' : '#B45309';
            // Skip the first item (starting score context) — show the meaningful adjustments
            // Filter out the base-score context line — only show actionable insights
            const reasons = (mealResult.fuel_reasoning || []).slice(1);
            if (reasons.length === 0) return null;
            return (
              <View style={[styles.fuelInsightCard, { backgroundColor: bgColor, borderColor }]}>
                <View style={styles.fuelInsightHeader}>
                  <Ionicons name="flash" size={15} color={iconColor} />
                  <Text style={[styles.fuelInsightHeading, { color: headingColor }]}>Why this score</Text>
                </View>
                {reasons.map((reason, idx) => (
                  <View key={idx} style={styles.fuelInsightRow}>
                    <Ionicons name="remove-circle-outline" size={14} color={textColor} style={{ marginTop: 1 }} />
                    <Text style={[styles.fuelInsightText, { color: textColor }]}>{reason}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        {/* ── Flex Mode Prompt (low-score scans) ── */}
        {mealResult.fuel_score != null && fuelSettings && mealResult.fuel_score < fuelSettings.fuel_target && (() => {
          const flexAvail = fuelWeekly?.flex_budget?.flex_available ?? fuelWeekly?.flex_budget?.flex_meals_remaining ?? 0;
          const projAvg = fuelWeekly?.flex_budget?.projected_weekly_avg ?? 0;
          const tierLabel = projAvg >= 90 ? 'Elite' : projAvg >= 75 ? 'Strong' : projAvg >= 60 ? 'Decent' : 'Mixed';
          return (
            <View style={[styles.flexPromptCard, { backgroundColor: '#F59E0B08', borderColor: '#F59E0B30' }]}>
              <View style={styles.flexPromptHeader}>
                <View style={[styles.flexPromptIcon, { backgroundColor: '#F59E0B18' }]}>
                  <Ionicons name="ticket" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.flexPromptTitle, { color: theme.text }]}>This is a flex meal</Text>
                  <Text style={[styles.flexPromptSub, { color: theme.textSecondary }]}>
                    {flexAvail > 0
                      ? `Use 1 of your ${flexAvail} remaining`
                      : 'No flex meals left this week'}
                  </Text>
                </View>
              </View>
              {flexAvail > 0 && projAvg > 0 && (
                <View style={[styles.flexPromptProof, { backgroundColor: '#22C55E10' }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                  <Text style={[styles.flexPromptProofText, { color: '#16A34A' }]}>
                    Weekly avg stays at {Math.round(projAvg)} — {tierLabel} tier
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Detected ingredients</Text>
          <View style={styles.ingredientsWrap}>
            {ingredientDrafts.map((item, index) => (
              <TouchableOpacity
                key={`${item}-${index}`}
                onPress={() => setIngredientDrafts((current) => current.filter((_, idx) => idx !== index))}
                activeOpacity={0.85}
                style={[styles.ingredientChip, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.ingredientChipText, { color: theme.text }]}>{item}</Text>
                <Ionicons name="close" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.ingredientInputRow}>
            <TextInput
              value={addIngredientText}
              onChangeText={setAddIngredientText}
              placeholder="Add ingredient"
              placeholderTextColor={theme.textTertiary}
              style={[styles.formInput, styles.addIngredientInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <TouchableOpacity onPress={addIngredient} activeOpacity={0.85} style={[styles.squareButton, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="add" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {mealResult.pairing_opportunity && mealResult.pairing_recommended_title && mealResult.pairing_projected_mes != null && (
          <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Recommended pairing</Text>
            <View style={[styles.pairingPreviewCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.pairingPreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pairingPreviewTitle, { color: theme.text }]}>{mealResult.pairing_recommended_title}</Text>
                  <Text style={[styles.pairingPreviewCopy, { color: theme.textSecondary }]}>
                    {mealResult.pairing_timing === 'before_meal' ? 'Best before the meal' : 'Best with the meal'}
                  </Text>
                </View>
                <View style={[styles.pairingDeltaPill, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.pairingDeltaText, { color: theme.primary }]}>
                    +{Math.round(mealResult.pairing_projected_delta || 0)} MES
                  </Text>
                </View>
              </View>
              <Text style={[styles.pairingPreviewMes, { color: theme.text }]}>
                {mealResult.mes ? Math.round(mealResult.mes.score) : '--'} {'->'} {Math.round(mealResult.pairing_projected_mes)}
              </Text>
              {!!mealResult.pairing_reasons?.length && (
                <Text style={[styles.pairingPreviewCopy, { color: theme.textSecondary }]}>
                  {mealResult.pairing_reasons.join(' • ')}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Upgrade next time</Text>
          {(mealResult.upgrade_suggestions || []).length > 0 ? (
            (mealResult.upgrade_suggestions || []).map((item) => (
              <View key={item} style={styles.guidanceRow}>
                <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
                <Text style={[styles.guidanceText, { color: theme.text }]}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>No upgrades needed for this scan.</Text>
          )}
        </View>

        <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Recover today</Text>
          {(mealResult.recovery_plan || []).length > 0 ? (
            (mealResult.recovery_plan || []).map((item) => (
              <View key={item} style={styles.guidanceRow}>
                <Ionicons name="trending-up-outline" size={16} color={theme.primary} />
                <Text style={[styles.guidanceText, { color: theme.text }]}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>No recovery guidance needed.</Text>
          )}
        </View>

        {(mealResult.whole_food_flags || []).length > 0 && (
          <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Why this was flagged</Text>
            {(mealResult.whole_food_flags || []).slice(0, 4).map((flag, index) => (
              <View key={`${flag.ingredient}-${index}`} style={styles.guidanceRow}>
                <Ionicons name="alert-circle-outline" size={16} color={mealStatusMeta.color} />
                <Text style={[styles.guidanceText, { color: theme.text }]}>
                  {flag.ingredient} · {flag.reason}
                  {flag.inferred ? ' (inferred)' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderProductResultStep = () => {
    if (!productResult || !productTierMeta) {
      if (isLoading) return renderAnalyzingScreen();
      if (notFoodReason) {
        return (
          <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl }}>
            <View style={[styles.notFoodCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.notFoodIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="ban-outline" size={36} color="#D97706" />
              </View>
              <Text style={[styles.notFoodTitle, { color: theme.text }]}>Not a food product</Text>
              <Text style={[styles.notFoodBody, { color: theme.textSecondary }]}>
                {notFoodReason}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { setNotFoodReason(null); setScanStep('capture'); }}
                style={[styles.notFoodRetakeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="camera-outline" size={18} color="#FFF" />
                <Text style={styles.notFoodRetakeBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      return null;
    }
    const confidenceCopy = confidenceBand(productResult.confidence);
    const flagGroups = productResult.processing_flags || {};
    const flaggedRows = [
      { label: 'Seed oils', values: flagGroups.seed_oils || [] },
      { label: 'Added sugars', values: flagGroups.added_sugars || [] },
      { label: 'Refined flours', values: flagGroups.refined_flours || [] },
      { label: 'Artificial additives', values: flagGroups.artificial_additives || [] },
      { label: 'Gums and emulsifiers', values: flagGroups.gums_or_emulsifiers || [] },
      { label: 'Protein isolates', values: flagGroups.protein_isolates || [] },
    ].filter((item) => item.values.length > 0);
    const topReasons = (productResult.concerns.length ? productResult.concerns : productResult.highlights).slice(0, 4);

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.resultHero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.resultHeroTop}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={[styles.verdictEyebrow, { color: productTierMeta.color }]}>{productResult.verdict}</Text>
              <Text style={[styles.resultTitleText, { color: theme.text }]}>{productResult.product_name}</Text>
              {!!productResult.brand && <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>{productResult.brand}</Text>}
              <View style={[styles.statusChip, { backgroundColor: productTierMeta.bg }]}>
                <Text style={[styles.statusChipText, { color: productTierMeta.color }]}>{productTierMeta.label}</Text>
              </View>
            </View>
            <View style={[styles.resultRing, { borderColor: productTierMeta.color + '40' }, productResult.tier === 'whole_food' ? Shadows.interactive(theme.background === '#0A0A0F') : {}]}>
              <Text style={[styles.resultRingValue, { color: productTierMeta.color }]}>{Math.round(productResult.score)}</Text>
              <Text style={[styles.resultRingLabel, { color: theme.textSecondary }]}>Score</Text>
            </View>
          </View>
          {productImageUri ? (
            <View style={[styles.resultImageShell, { backgroundColor: theme.surfaceElevated }]}>
              <Image source={{ uri: productImageUri }} style={styles.resultImage} />
            </View>
          ) : null}
          <Text style={[styles.resultSummary, { color: theme.textSecondary }]}>{productResult.summary}</Text>
          <View style={[styles.productActionCard, { backgroundColor: productTierMeta.bg }]}>
            <Ionicons name="leaf-outline" size={18} color={productTierMeta.color} />
            <Text style={[styles.productActionCopy, { color: theme.text }]}>{productResult.recommended_action}</Text>
          </View>
          {(productResult.recoverable || productResult.confidence < 0.8) && (
            <View style={[styles.productConfidenceCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="scan-outline" size={16} color={theme.primary} />
              <Text style={[styles.productConfidenceText, { color: theme.textSecondary }]}>
                {confidenceCopy}. Review the extracted text if anything looks off.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Decision in a glance</Text>
          {topReasons.length > 0 ? (
            topReasons.map((item) => (
              <View key={item} style={styles.guidanceRow}>
                <Ionicons
                  name={productResult.concerns.length ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={productResult.concerns.length ? productTierMeta.color : theme.primary}
                />
                <Text style={[styles.guidanceText, { color: theme.text }]}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>No major flags surfaced from this scan.</Text>
          )}
        </View>

        <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Nutrition snapshot</Text>
          <View style={styles.macroGrid}>
            {[
              { label: 'Calories', value: `${productResult.nutrition_snapshot.calories}`, accent: MACRO_ACCENTS.calories },
              { label: 'Protein', value: `${productResult.nutrition_snapshot.protein_g}g`, accent: MACRO_ACCENTS.protein },
              { label: 'Carbs', value: `${productResult.nutrition_snapshot.carbs_g}g`, accent: MACRO_ACCENTS.carbs },
              { label: 'Fat', value: `${Math.round(productResult.nutrition_snapshot.fat_g)}g`, accent: MACRO_ACCENTS.fat },
              { label: 'Fiber', value: `${productResult.nutrition_snapshot.fiber_g}g`, accent: MACRO_ACCENTS.fiber },
              { label: 'Sugar', value: `${productResult.nutrition_snapshot.sugar_g}g`, accent: MACRO_ACCENTS.carbs },
            ].map((row) => (
              <View key={row.label} style={[styles.macroCard, { backgroundColor: row.accent.bg }]}>
                <Text style={[styles.macroCardValue, { color: row.accent.color }]}>{row.value}</Text>
                <Text style={[styles.macroCardLabel, { color: theme.textSecondary }]}>{row.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {flaggedRows.length > 0 && (
          <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Flagged ingredients</Text>
            {flaggedRows.map((row) => (
              <View key={row.label} style={styles.guidanceRow}>
                <Ionicons name="warning-outline" size={16} color={productTierMeta.color} />
                <Text style={[styles.guidanceText, { color: theme.text }]}>
                  {row.label}: {row.values.slice(0, 3).join(', ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.resultSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Extracted label</Text>
          <Text style={[styles.productLabelText, { color: theme.textSecondary }]}>
            {productResult.ingredients_text || 'No ingredient text was extracted from this scan yet.'}
          </Text>
          {(productResult.notes || []).length > 0 && (
            <View style={styles.productNotesWrap}>
              {(productResult.notes || []).map((item) => (
                <View key={item} style={styles.guidanceRow}>
                  <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
                  <Text style={[styles.guidanceText, { color: theme.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.productResultActions}>
          <TouchableOpacity onPress={handleExitToHome} activeOpacity={0.9} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
            <Text style={styles.primaryButtonText}>Looks good</Text>
          </TouchableOpacity>
          <View style={styles.productSecondaryActions}>
            <TouchableOpacity
              onPress={() => setShowProductEditSheet(true)}
              activeOpacity={0.85}
              style={[styles.footerButtonSecondary, styles.productSecondaryAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.footerButtonSecondaryText, { color: theme.textSecondary }]}>Fix details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={scanAnotherProduct}
              activeOpacity={0.85}
              style={[styles.footerButtonSecondary, styles.productSecondaryAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="camera-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.footerButtonSecondaryText, { color: theme.textSecondary }]}>Scan another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <ScreenContainer safeArea={false} padded={false}>
      {scanStep === 'capture' ? (
        renderCaptureStep()
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          {!(scanStep === 'result' && ((scanMode === 'meal' && isLoading && !mealResult) || (scanMode === 'product' && isLoading && !productResult))) &&
            renderReviewHeader(scanStep === 'result')}
          {scanStep === 'review'
            ? renderMealReviewStep()
            : (isLoading && (scanMode === 'meal' ? !mealResult : !productResult))
              ? renderAnalyzingScreen()
              : (
                <Animated.View style={{ flex: 1, opacity: resultOpacity, transform: [{ scale: resultScale }] }}>
                  {scanMode === 'meal'
                    ? renderMealResultStep()
                    : renderProductResultStep()}
                </Animated.View>
              )}
          {scanStep === 'result' && scanMode === 'meal' && mealResult && (
            <View style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.surface + 'F5', borderTopColor: theme.border, borderTopWidth: 1 }}>
              {/* Ask Coach CTA — always shown, more prominent on low scores */}
              {(mealResult.fuel_score == null || mealResult.fuel_score < 75) && (
                <TouchableOpacity
                  onPress={() => {
                    const ctx = JSON.stringify({
                      source: 'scan',
                      scan_result: {
                        meal_label: mealResult.meal_label,
                        fuel_score: mealResult.fuel_score,
                        whole_food_flags: (mealResult.whole_food_flags || []).slice(0, 6),
                      },
                    });
                    const msg = mealResult.fuel_score != null && mealResult.fuel_score < 50
                      ? `My ${mealResult.meal_label} scored ${Math.round(mealResult.fuel_score ?? 0)} — what's dragging it down and what's a better option?`
                      : `I scanned ${mealResult.meal_label} — any tips to make it cleaner?`;
                    // Dismiss the scan modal first, then navigate to chat tab
                    // Using dismiss + setTimeout ensures the modal is gone before navigating
                    router.dismiss();
                    setTimeout(() => {
                      router.navigate(`/(tabs)/chat?prefill=${encodeURIComponent(msg)}&autoSend=1&chatContext=${encodeURIComponent(ctx)}` as any);
                    }, 100);
                  }}
                  activeOpacity={0.85}
                  style={[styles.askCoachBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '40', marginHorizontal: 16, marginTop: 12, marginBottom: 4 }]}
                >
                  <Ionicons name="nutrition-outline" size={16} color={theme.primary} />
                  <Text style={[styles.askCoachText, { color: theme.primary }]}>
                    {mealResult.fuel_score != null && mealResult.fuel_score < 50
                      ? 'Ask Coach for a better option'
                      : 'Ask Coach for tips'}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.primary} />
                </TouchableOpacity>
              )}
              <View style={styles.resultFooterRow}>
                <TouchableOpacity
                  onPress={recomputeMeal}
                  activeOpacity={0.85}
                  style={[styles.footerButtonSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.footerButtonSecondaryText, { color: theme.textSecondary }]}>Recompute</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={logMeal} activeOpacity={0.9} disabled={isLoading} style={[styles.footerButtonPrimary, { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 }]}>
                  {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.footerButtonPrimaryText}>Log to Chronometer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      <ChronometerSuccessModal
        visible={successModal.visible}
        message={successModal.message}
        onPrimary={() => {
          setSuccessModal({ visible: false, message: '' });
          resetMealState();
          resetProductState();
          setScanMode('meal');
          setScanStep('capture');
          router.replace('/(tabs)/chronometer' as any);
        }}
        onSecondary={() => setSuccessModal({ visible: false, message: '' })}
      />

      <Modal visible={showBarcodeSheet} transparent animationType="slide" onRequestClose={() => setShowBarcodeSheet(false)}>
        <View style={styles.sheetModalBackdrop}>
          <TouchableOpacity style={styles.sheetModalScrim} activeOpacity={1} onPress={() => setShowBarcodeSheet(false)} />
          <View style={[styles.sheetModalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Use barcode</Text>
            <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
              Paste or type the barcode if the package is easier to scan that way.
            </Text>
            <TextInput
              value={barcodeValue}
              onChangeText={setBarcodeValue}
              placeholder="Enter barcode"
              placeholderTextColor={theme.textTertiary}
              keyboardType="number-pad"
              style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <TouchableOpacity onPress={analyzeBarcode} activeOpacity={0.9} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Analyze barcode</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showProductEditSheet} transparent animationType="slide" onRequestClose={() => setShowProductEditSheet(false)}>
        <View style={styles.sheetModalBackdrop}>
          <TouchableOpacity style={styles.sheetModalScrim} activeOpacity={1} onPress={() => setShowProductEditSheet(false)} />
          <ScrollView
            style={[styles.sheetModalCard, { backgroundColor: theme.surface }]}
            contentContainerStyle={styles.sheetModalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Fix label details</Text>
            <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
              Correct anything the scan missed, then rescore without leaving this result.
            </Text>
            <TextInput
              value={productName}
              onChangeText={setProductName}
              placeholder="Product name"
              placeholderTextColor={theme.textTertiary}
              style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <TextInput
              value={brand}
              onChangeText={setBrand}
              placeholder="Brand"
              placeholderTextColor={theme.textTertiary}
              style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <TextInput
              value={ingredientsText}
              onChangeText={setIngredientsText}
              placeholder="Ingredients"
              placeholderTextColor={theme.textTertiary}
              multiline
              style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <View style={styles.inputGrid}>
              {[
                { label: 'Calories', value: calories, setter: setCalories },
                { label: 'Protein (g)', value: protein, setter: setProtein },
                { label: 'Fiber (g)', value: fiber, setter: setFiber },
                { label: 'Sugar (g)', value: sugar, setter: setSugar },
                { label: 'Carbs (g)', value: carbs, setter: setCarbs },
                { label: 'Sodium (mg)', value: sodium, setter: setSodium },
              ].map((field) => (
                <TextInput
                  key={field.label}
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.label}
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  style={[styles.formInput, styles.gridField, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                />
              ))}
            </View>
            <View style={styles.productSecondaryActions}>
              <TouchableOpacity
                onPress={() => setShowProductEditSheet(false)}
                activeOpacity={0.85}
                style={[styles.footerButtonSecondary, styles.productSecondaryAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.footerButtonSecondaryText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={analyzeLabel}
                activeOpacity={0.9}
                style={[styles.footerButtonPrimary, styles.productSecondaryAction, { backgroundColor: theme.primary }]}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.footerButtonPrimaryText}>Re-score</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showModesInfo} transparent animationType="fade" onRequestClose={() => setShowModesInfo(false)}>
        <View style={styles.infoModalBackdrop}>
          <View style={styles.infoModalScrim} />
          <View style={[styles.infoModalCard, Shadows.lg(isDark)]}>
            <View style={styles.infoModalBadge}>
              <View style={styles.captureInfoDot} />
              <Text style={styles.infoModalBadgeText}>Scan modes</Text>
            </View>
            <Text style={styles.infoModalTitle}>Choose the right scan for the job.</Text>
            <Text style={styles.infoModalBody}>
              Scan Food estimates macros, whole-food fit, and MES. Packaged Food reads labels or barcodes for quick whole-food decisions.
            </Text>
            <View style={styles.infoModeList}>
              <View style={styles.infoModeRow}>
                <Ionicons name="scan-outline" size={18} color="#34D399" />
                <View style={styles.infoModeCopyWrap}>
                  <Text style={styles.infoModeTitle}>Scan Food</Text>
                  <Text style={styles.infoModeCopy}>Meal photo analysis with editable ingredients.</Text>
                </View>
              </View>
              <View style={styles.infoModeRow}>
                <Ionicons name="reader-outline" size={18} color="#34D399" />
                <View style={styles.infoModeCopyWrap}>
                  <Text style={styles.infoModeTitle}>Packaged Food</Text>
                  <Text style={styles.infoModeCopy}>Photo-first ingredient analysis with barcode fallback and quick fixes when needed.</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowModesInfo(false)} activeOpacity={0.85} style={styles.infoModalButton}>
              <Text style={styles.infoModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  captureRoot: {
    flex: 1,
    backgroundColor: '#0A1914',
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  captureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    zIndex: 2,
  },
  captureCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  captureBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  captureBrandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  captureBrandText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  captureControls: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.lg,
    zIndex: 2,
  },
  captureInfoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  captureHintCard: {
    backgroundColor: 'rgba(6, 18, 13, 0.72)',
    borderRadius: 18,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  captureHintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captureHintTitle: {
    color: '#ECFDF5',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  captureHintCopy: {
    color: 'rgba(236, 253, 245, 0.78)',
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  captureHintActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  captureHintButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(22, 163, 74, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  captureHintButtonMuted: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  captureHintButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modeRail: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  modePillActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  modePillText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  modePillTextActive: {
    color: '#15803D',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxxl,
  },
  shutterSideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  shutterBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E7E5E4',
  },
  infoModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  infoModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 10, 7, 0.56)',
  },
  infoModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(8, 18, 14, 0.94)',
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  infoModalBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(12, 43, 31, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  infoModalBadgeText: {
    color: '#DFF9EA',
    fontSize: 12,
    fontWeight: '700',
  },
  infoModalTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  infoModalBody: {
    color: 'rgba(233, 243, 237, 0.82)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: Spacing.sm,
  },
  infoModeList: {
    gap: 10,
    marginTop: Spacing.lg,
  },
  infoModeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  infoModeCopyWrap: {
    flex: 1,
  },
  infoModeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoModeCopy: {
    color: 'rgba(224, 236, 229, 0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  infoModalButton: {
    minHeight: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: '#F4FBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  infoModalButtonText: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  reviewHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCFCFA',
  },
  headerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
  },
  sheetCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sheetSub: {
    marginTop: 4,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  previewShell: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    minHeight: 200,
  },
  reviewImage: {
    width: '100%',
    height: 260,
    resizeMode: 'cover',
  },
  previewFallback: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFallbackText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
  reviewButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  reviewActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reviewActionText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  contextTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  choiceChip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridField: {
    width: '48%',
  },
  resultHero: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  resultHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  resultTitleInput: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    padding: 0,
    margin: 0,
  },
  resultTitleText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  verdictEyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resultMeta: {
    marginTop: 4,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  statusChipText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  scoreColumn: {
    alignItems: 'center',
    gap: 6,
  },
  flexImpactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  flexImpactText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Flex Mode prompt card
  flexPromptCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  flexPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  flexPromptIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexPromptTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  flexPromptSub: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  flexPromptProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  flexPromptProofText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  mesSecondaryPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  mesSecondaryValue: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  resultRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRingValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  resultRingLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  resultRingFallback: {
    fontSize: 13,
    fontWeight: '700',
  },
  snackSummaryCard: {
    minWidth: 104,
    minHeight: 80,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  snackSummaryTitle: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'center',
  },
  snackSummaryCopy: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultSummary: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  productActionCard: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  productActionCopy: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  productConfidenceCard: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productConfidenceText: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontWeight: '600',
  },
  lowConfidenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  notFoodCard: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  notFoodIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoodTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  notFoodBody: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  notFoodRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  notFoodRetakeBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  resultImageShell: {
    marginTop: Spacing.md,
    borderRadius: 18,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: 184,
    resizeMode: 'cover',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.md,
  },
  macroCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  macroCardValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  macroCardLabel: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  fuelInsightCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  fuelInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fuelInsightHeading: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fuelInsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  fuelInsightText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 18,
  },
  resultSection: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  ingredientsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.sm,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ingredientChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  ingredientInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  addIngredientInput: {
    flex: 1,
    marginBottom: 0,
  },
  squareButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingPreviewCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 8,
    marginTop: Spacing.sm,
  },
  pairingPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pairingPreviewTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  pairingPreviewCopy: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  pairingPreviewMes: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  pairingDeltaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  pairingDeltaText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  guidanceText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  emptyCopy: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  productLabelText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  productNotesWrap: {
    marginTop: Spacing.sm,
  },
  productResultActions: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  productSecondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  productSecondaryAction: {
    flex: 1,
  },
  resultFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
  },
  resultFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  askCoachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  askCoachText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  footerButtonSecondary: {
    flex: 0,
    minHeight: 50,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerButtonPrimary: {
    flex: 1,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  footerButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  sheetModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 10, 7, 0.42)',
  },
  sheetModalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    maxHeight: '82%',
  },
  sheetModalContent: {
    paddingBottom: Spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    marginBottom: Spacing.md,
  },
});

const analyzeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F0D',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 12, 8, 0.75)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  ringWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#22C55E40',
  },
  spinRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  spinGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  innerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginLeft: 2,
    paddingTop: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  stepsWrap: {
    width: '100%',
    marginTop: Spacing.xxxl,
    gap: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xxxl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  brandText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
