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
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenContainer } from '../../components/ScreenContainer';
import { useTheme } from '../../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
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

type ScanMode = 'meal' | 'barcode' | 'label';
type ScanStep = 'capture' | 'review' | 'result';
type PortionSize = 'small' | 'medium' | 'large';
type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type SourceContext = 'home' | 'restaurant';

interface ProductResult {
  product_name: string;
  brand?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  source: string;
  score: number;
  tier: 'whole_food' | 'solid' | 'mixed' | 'ultra_processed';
  verdict: string;
  summary: string;
  recommended_action: string;
  highlights: string[];
  concerns: string[];
  ingredient_count: number;
  nutrition_snapshot: {
    calories: number;
    protein_g: number;
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
  mes?: {
    score: number;
    tier: string;
    sub_scores: Record<string, number>;
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
  };
}

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

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

  const [mealImageUri, setMealImageUri] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealKind>('lunch');
  const [portionSize, setPortionSize] = useState<PortionSize>('medium');
  const [sourceContext, setSourceContext] = useState<SourceContext>('home');
  const [mealResult, setMealResult] = useState<MealResult | null>(null);
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

  const analyzePulseAnim = useRef(new Animated.Value(0.4)).current;
  const analyzeSpinAnim = useRef(new Animated.Value(0)).current;
  const analyzeDotAnim1 = useRef(new Animated.Value(0.3)).current;
  const analyzeDotAnim2 = useRef(new Animated.Value(0.3)).current;
  const analyzeDotAnim3 = useRef(new Animated.Value(0.3)).current;

  const mealStatusMeta = mealResult ? MEAL_STATUS_META[mealResult.whole_food_status] : null;
  const productTierMeta = productResult ? PRODUCT_TIER_META[productResult.tier] : null;

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

  useEffect(() => {
    let cancelled = false;
    if (scanStep !== 'capture') return undefined;

    ImagePicker.requestCameraPermissionsAsync()
      .then(({ granted }) => {
        if (!cancelled) setCameraGranted(granted);
      })
      .catch(() => {
        if (!cancelled) setCameraGranted(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scanStep]);

  useEffect(() => {
    const shouldAnimate = scanStep === 'result' && scanMode === 'meal' && isLoading && !mealResult;
    if (!shouldAnimate) {
      analyzePulseAnim.stopAnimation();
      analyzeSpinAnim.stopAnimation();
      analyzeDotAnim1.stopAnimation();
      analyzeDotAnim2.stopAnimation();
      analyzeDotAnim3.stopAnimation();
      analyzePulseAnim.setValue(0.4);
      analyzeSpinAnim.setValue(0);
      analyzeDotAnim1.setValue(0.3);
      analyzeDotAnim2.setValue(0.3);
      analyzeDotAnim3.setValue(0.3);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(analyzePulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(analyzePulseAnim, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const spinLoop = Animated.loop(
      Animated.timing(analyzeSpinAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const makeDotLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const dotLoop1 = makeDotLoop(analyzeDotAnim1, 0);
    const dotLoop2 = makeDotLoop(analyzeDotAnim2, 200);
    const dotLoop3 = makeDotLoop(analyzeDotAnim3, 400);

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
  }, [
    analyzeDotAnim1,
    analyzeDotAnim2,
    analyzeDotAnim3,
    analyzePulseAnim,
    analyzeSpinAnim,
    isLoading,
    mealResult,
    scanMode,
    scanStep,
  ]);

  const resetProductState = () => {
    setProductResult(null);
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
  };

  const resetMealState = () => {
    setMealImageUri(null);
    setMealResult(null);
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
    // result step: meal goes back to capture (no review step), others go to review
    if (scanMode === 'meal') {
      resetMealState();
      setScanStep('capture');
    } else {
      setScanStep('review');
    }
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
          ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ['images'] })
          : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ['images'] });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      setMealImageUri(uri);
      setMealResult(null);
      await analyzeMealWithUri(uri);
    } catch (err: any) {
      Alert.alert('Unable to open camera', err?.message || 'Camera or photo permissions are missing.');
    }
  };

  const analyzeMealWithUri = async (uri: string) => {
    setIsLoading(true);
    setScanStep('result');
    try {
      const next = normalizeMealResult(
        await wholeFoodScanApi.analyzeMeal({
          imageUri: uri,
          meal_type: mealType,
          portion_size: portionSize,
          source_context: sourceContext,
        })
      );
      setMealResult(next);
      setMealLabelDraft(next.meal_label);
      setIngredientDrafts(next.estimated_ingredients || []);
    } catch (err: any) {
      Alert.alert('Meal scan failed', err?.message || 'Unable to analyze that meal right now.');
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
    await analyzeMealWithUri(mealImageUri);
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
    } catch (err: any) {
      Alert.alert('Recompute failed', err?.message || 'Unable to recompute this meal scan right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const logMeal = async () => {
    if (!mealResult) return;
    setIsLoading(true);
    try {
      await wholeFoodScanApi.logMeal(mealResult.id, { meal_type: mealType });
      setSuccessModal({
        visible: true,
        message: `"${mealResult.meal_label}" has been added to today's nutrition log.`,
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
    try {
      const next = await wholeFoodScanApi.analyzeBarcode(barcodeValue.trim());
      setProductResult(next);
      setScanStep('result');
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message || 'Unable to analyze that barcode right now.');
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
    try {
      const next = await wholeFoodScanApi.analyzeLabel({
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
      });
      setProductResult(next);
      setScanStep('result');
    } catch (err: any) {
      Alert.alert('Analysis failed', err?.message || 'Unable to score this product right now.');
    } finally {
      setIsLoading(false);
    }
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
      { key: 'barcode', label: 'Barcode', icon: 'barcode-outline' },
      { key: 'label', label: 'Food Label', icon: 'reader-outline' },
    ];
    return (
      <View style={[styles.captureRoot, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {CameraView && cameraGranted ? (
          <CameraView style={styles.cameraPreview} facing="back" autofocus="on" />
        ) : (
          <LinearGradient
            colors={['#0A1914', '#0D2018', '#132B1F']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cameraPreview}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.65)']}
          locations={[0, 0.35, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.captureOverlay}
        />

        <View style={styles.captureTopRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.captureCloseBtn}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.captureBrandPill}>
            <View style={styles.captureBrandDot} />
            <Text style={styles.captureBrandText}>Scan</Text>
          </View>
          <TouchableOpacity onPress={() => setShowModesInfo(true)} activeOpacity={0.8} style={styles.captureCloseBtn}>
            <Ionicons name="help" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.captureCenter}>
          <View style={styles.viewfinderWrap}>
            <View style={[styles.viewfinderCorner, styles.viewfinderTopLeft]} />
            <View style={[styles.viewfinderCorner, styles.viewfinderTopRight]} />
            <View style={[styles.viewfinderCorner, styles.viewfinderBottomLeft]} />
            <View style={[styles.viewfinderCorner, styles.viewfinderBottomRight]} />
            <View style={styles.viewfinderGuide} />
          </View>

          <View style={styles.captureInfoBlock}>
            <View style={styles.captureBadge}>
              <View style={styles.captureInfoDot} />
              <Text style={styles.captureBadgeText}>WholeFoodLabs Scan</Text>
            </View>
            <Text style={styles.captureHeadline}>
              {scanMode === 'meal' ? 'Capture a meal' : scanMode === 'barcode' ? 'Scan a barcode' : 'Capture a food label'}
            </Text>
            <Text style={styles.captureSubhead}>
              {scanMode === 'meal'
                ? 'Frame the dish clearly, then refine context before analysis.'
                : scanMode === 'barcode'
                  ? 'Center the product code or use manual entry in the next step.'
                  : 'Capture the label straight-on so ingredients stay readable.'}
            </Text>
          </View>
        </View>

        <View style={styles.captureControls}>
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
                  <Ionicons name={item.icon} size={15} color={active ? '#16A34A' : 'rgba(255,255,255,0.78)'} />
                  <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.shutterRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (scanMode === 'meal') {
                  pickMealImage('library');
                } else {
                  setScanStep('review');
                }
              }}
              style={styles.shutterSideBtn}
            >
              <Ionicons name="images-outline" size={18} color="rgba(255,255,255,0.86)" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (scanMode === 'meal') {
                  pickMealImage('camera');
                } else {
                  setScanStep('review');
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
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowModesInfo(true)}
              style={styles.shutterSideBtn}
            >
              <Ionicons name="options-outline" size={18} color="rgba(255,255,255,0.86)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderReviewHeader = () => (
    <View style={[styles.reviewHeader, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity onPress={handleBack} activeOpacity={0.85} style={[styles.headerCircle, { borderColor: theme.border }]}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
      </TouchableOpacity>
      <View style={[styles.headerCapsule, { borderColor: theme.border, backgroundColor: '#FFFFFF' }]}>
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
      <View style={[styles.sheetCard, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
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
                  { backgroundColor: active ? theme.primaryMuted : '#FFFFFF', borderColor: active ? theme.primary : theme.border },
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
                  { backgroundColor: active ? theme.primaryMuted : '#FFFFFF', borderColor: active ? theme.primary : theme.border },
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
                  { backgroundColor: active ? theme.primaryMuted : '#FFFFFF', borderColor: active ? theme.primary : theme.border },
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

  const renderProductReviewStep = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xxxl,
        paddingTop: Spacing.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.sheetCard, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>
          {scanMode === 'barcode' ? 'Scan a barcode' : 'Check a food label'}
        </Text>
        <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
          {scanMode === 'barcode'
            ? 'Enter a barcode manually to score a packaged food.'
            : 'Paste the ingredient list and optional nutrition facts.'}
        </Text>

        {scanMode === 'barcode' ? (
          <>
            <TextInput
              value={barcodeValue}
              onChangeText={setBarcodeValue}
              placeholder="Enter barcode"
              placeholderTextColor={theme.textTertiary}
              keyboardType="number-pad"
              style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <TouchableOpacity onPress={analyzeBarcode} activeOpacity={0.9} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Analyze Barcode</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
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
            <TouchableOpacity onPress={analyzeLabel} activeOpacity={0.9} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Score Product</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderAnalyzingScreen = () => {
    const spin = analyzeSpinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    const steps = [
      { icon: 'eye-outline' as const, label: 'Identifying ingredients' },
      { icon: 'nutrition-outline' as const, label: 'Estimating nutrition' },
      { icon: 'shield-checkmark-outline' as const, label: 'Scoring whole-food fit' },
    ];

    return (
      <View style={analyzeStyles.container}>
        {/* Meal image background */}
        {mealImageUri && (
          <>
            <Image source={{ uri: mealImageUri }} style={analyzeStyles.bgImage} blurRadius={20} />
            <View style={analyzeStyles.bgOverlay} />
          </>
        )}

        <View style={analyzeStyles.content}>
          <View style={analyzeStyles.ringWrap}>
            <Animated.View
              style={[
                analyzeStyles.pulseRing,
                {
                  opacity: analyzePulseAnim,
                  transform: [
                    {
                      scale: analyzePulseAnim.interpolate({
                        inputRange: [0.4, 1],
                        outputRange: [0.85, 1.15],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View style={[analyzeStyles.spinRing, { transform: [{ rotate: spin }] }]}>
              <LinearGradient
                colors={['#22C55E', '#16A34A', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={analyzeStyles.spinGradient}
              />
            </Animated.View>
            <View style={analyzeStyles.innerCircle}>
              <Ionicons name="scan-outline" size={32} color="#22C55E" />
            </View>
          </View>

          <View style={analyzeStyles.titleRow}>
            <Text style={analyzeStyles.title}>Analyzing your meal</Text>
            <View style={analyzeStyles.dotsRow}>
              {[analyzeDotAnim1, analyzeDotAnim2, analyzeDotAnim3].map((anim, i) => (
                <Animated.View key={i} style={[analyzeStyles.dot, { opacity: anim }]} />
              ))}
            </View>
          </View>
          <Text style={analyzeStyles.subtitle}>Our AI is breaking down what's on your plate</Text>

          <View style={analyzeStyles.stepsWrap}>
            {steps.map((step, i) => (
              <View key={i} style={analyzeStyles.stepRow}>
                <View style={analyzeStyles.stepIcon}>
                  <Ionicons name={step.icon} size={16} color="#22C55E" />
                </View>
                <Text style={analyzeStyles.stepLabel}>{step.label}</Text>
                <ActivityIndicator size="small" color="#22C55E80" style={{ marginLeft: 'auto' }} />
              </View>
            ))}
          </View>

          <View style={analyzeStyles.brandPill}>
            <View style={analyzeStyles.brandDot} />
            <Text style={analyzeStyles.brandText}>Powered by WholeFoodLabs AI</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMealResultStep = () => {
    if (!mealResult || !mealStatusMeta) {
      if (isLoading) return renderAnalyzingScreen();
      return null;
    }
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
        <View style={[styles.resultHero, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.resultHeroTop}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <TextInput
                value={mealLabelDraft}
                onChangeText={setMealLabelDraft}
                style={[styles.resultTitleInput, { color: theme.text }]}
                placeholderTextColor={theme.textTertiary}
              />
              <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>
                {confidenceBand(mealResult.confidence)} · {mealResult.meal_context === 'full_meal' ? 'Full meal' : 'Not scored as a full meal'}
              </Text>
              <View style={[styles.statusChip, { backgroundColor: mealStatusMeta.bg }]}>
                <Text style={[styles.statusChipText, { color: mealStatusMeta.color }]}>{mealStatusMeta.label}</Text>
              </View>
            </View>
            {mealResult.mes ? (
              <View style={[styles.resultRing, { borderColor: theme.primary + '40' }]}>
                <Text style={[styles.resultRingValue, { color: theme.primary }]}>{Math.round(mealResult.mes.score)}</Text>
                <Text style={[styles.resultRingLabel, { color: theme.textSecondary }]}>MES</Text>
              </View>
            ) : (
              <View style={[styles.resultRing, { borderColor: theme.border }]}>
                <Text style={[styles.resultRingFallback, { color: theme.textSecondary }]}>No MES</Text>
              </View>
            )}
          </View>
          <View style={styles.macroGrid}>
            {nutritionRows.map((row) => (
              <View key={row.key} style={[styles.macroCard, { backgroundColor: row.accent.bg }]}>
                <Text style={[styles.macroCardValue, { color: row.accent.color }]}>{row.value}</Text>
                <Text style={[styles.macroCardLabel, { color: theme.textSecondary }]}>{row.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.resultSection, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Detected ingredients</Text>
          <View style={styles.ingredientsWrap}>
            {ingredientDrafts.map((item, index) => (
              <TouchableOpacity
                key={`${item}-${index}`}
                onPress={() => setIngredientDrafts((current) => current.filter((_, idx) => idx !== index))}
                activeOpacity={0.85}
                style={[styles.ingredientChip, { borderColor: theme.border }]}
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

        <View style={[styles.resultSection, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
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

        <View style={[styles.resultSection, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
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
          <View style={[styles.resultSection, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
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
    if (!productResult || !productTierMeta) return null;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.resultHero, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.resultHeroTop}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={[styles.resultTitleText, { color: theme.text }]}>{productResult.product_name}</Text>
              {!!productResult.brand && <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>{productResult.brand}</Text>}
              <View style={[styles.statusChip, { backgroundColor: productTierMeta.bg }]}>
                <Text style={[styles.statusChipText, { color: productTierMeta.color }]}>{productTierMeta.label}</Text>
              </View>
            </View>
            <View style={[styles.resultRing, { borderColor: productTierMeta.color + '40' }]}>
              <Text style={[styles.resultRingValue, { color: productTierMeta.color }]}>{Math.round(productResult.score)}</Text>
              <Text style={[styles.resultRingLabel, { color: theme.textSecondary }]}>Score</Text>
            </View>
          </View>
          <Text style={[styles.resultSummary, { color: theme.textSecondary }]}>{productResult.summary}</Text>
          <View style={styles.macroGrid}>
            {[
              { label: 'Calories', value: `${productResult.nutrition_snapshot.calories}`, accent: MACRO_ACCENTS.calories },
              { label: 'Protein', value: `${productResult.nutrition_snapshot.protein_g}g`, accent: MACRO_ACCENTS.protein },
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
      </ScrollView>
    );
  };

  return (
    <ScreenContainer safeArea={false} padded={false}>
      {scanStep === 'capture' ? (
        renderCaptureStep()
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          {!(scanStep === 'result' && scanMode === 'meal' && isLoading && !mealResult) && renderReviewHeader()}
          {scanStep === 'review'
            ? scanMode === 'meal'
              ? renderMealReviewStep()
              : renderProductReviewStep()
            : scanMode === 'meal'
              ? renderMealResultStep()
              : renderProductResultStep()}
          {scanStep === 'result' && scanMode === 'meal' && mealResult && (
            <View style={[styles.resultFooter, { paddingBottom: insets.bottom + 12, backgroundColor: 'rgba(252, 252, 250, 0.96)', borderTopColor: theme.border }]}>
              <TouchableOpacity
                onPress={recomputeMeal}
                activeOpacity={0.85}
                style={[styles.footerButtonSecondary, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}
              >
                <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} />
                <Text style={[styles.footerButtonSecondaryText, { color: theme.textSecondary }]}>Recompute</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={logMeal} activeOpacity={0.9} style={[styles.footerButtonPrimary, { backgroundColor: theme.primary }]}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.footerButtonPrimaryText}>Log to Chronometer</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <ChronometerSuccessModal
        visible={successModal.visible}
        message={successModal.message}
        onPrimary={() => setSuccessModal({ visible: false, message: '' })}
        onSecondary={() => setSuccessModal({ visible: false, message: '' })}
      />

      <Modal visible={showModesInfo} transparent animationType="fade" onRequestClose={() => setShowModesInfo(false)}>
        <View style={styles.infoModalBackdrop}>
          <View style={styles.infoModalScrim} />
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalBadge}>
              <View style={styles.captureInfoDot} />
              <Text style={styles.infoModalBadgeText}>Scan modes</Text>
            </View>
            <Text style={styles.infoModalTitle}>Choose the right scan for the job.</Text>
            <Text style={styles.infoModalBody}>
              Scan Food estimates macros, whole-food fit, and MES. Barcode and Food Label are for packaged foods.
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
                <Ionicons name="barcode-outline" size={18} color="#34D399" />
                <View style={styles.infoModeCopyWrap}>
                  <Text style={styles.infoModeTitle}>Barcode</Text>
                  <Text style={styles.infoModeCopy}>Fast lookup for packaged food products.</Text>
                </View>
              </View>
              <View style={styles.infoModeRow}>
                <Ionicons name="reader-outline" size={18} color="#34D399" />
                <View style={styles.infoModeCopyWrap}>
                  <Text style={styles.infoModeTitle}>Food Label</Text>
                  <Text style={styles.infoModeCopy}>Ingredient and macro review for packaged foods.</Text>
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  captureBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(3, 20, 13, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  captureCenter: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  viewfinderWrap: {
    alignSelf: 'center',
    width: '84%',
    aspectRatio: 0.82,
    maxHeight: 360,
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  viewfinderCorner: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderColor: 'rgba(255,255,255,0.94)',
  },
  viewfinderTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 8,
    borderLeftWidth: 8,
    borderTopLeftRadius: 28,
  },
  viewfinderTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderTopRightRadius: 28,
  },
  viewfinderBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderBottomLeftRadius: 28,
  },
  viewfinderBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderBottomRightRadius: 28,
  },
  viewfinderGuide: {
    position: 'absolute',
    top: 34,
    left: '50%',
    marginLeft: -46,
    width: 92,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  captureInfoBlock: {
    gap: 10,
  },
  captureBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(2, 18, 12, 0.74)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  captureBadgeText: {
    color: '#E8FFF1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  captureHeadline: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  captureSubhead: {
    color: 'rgba(237, 247, 241, 0.82)',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 320,
  },
  captureControls: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
    zIndex: 2,
  },
  captureInfoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  modeRail: {
    flexDirection: 'row',
    backgroundColor: 'rgba(4, 18, 13, 0.74)',
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 72,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  modePillActive: {
    backgroundColor: '#F6FBF8',
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  modePillTextActive: {
    color: '#15803D',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  shutterSideBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 20, 15, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  shutterBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(22, 163, 74, 0.26)',
  },
  shutterBtnInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
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
    borderRadius: 28,
    backgroundColor: 'rgba(8, 18, 14, 0.94)',
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
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
    borderRadius: 20,
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
    borderRadius: 20,
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
    borderRadius: 20,
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
    borderRadius: 16,
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
    borderRadius: 20,
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
    borderRadius: 16,
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
    borderRadius: 20,
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
  resultSummary: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
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
  resultSection: {
    borderRadius: 20,
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
  footerButtonSecondary: {
    flex: 0,
    minHeight: 50,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerButtonPrimary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
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
