import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
    if (scanMode === 'meal') {
      setScanStep('review');
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
      setMealImageUri(result.assets[0].uri);
      setMealResult(null);
      setScanStep('review');
    } catch (err: any) {
      Alert.alert('Unable to open camera', err?.message || 'Camera or photo permissions are missing.');
    }
  };

  const analyzeMeal = async () => {
    if (!mealImageUri) {
      Alert.alert('Meal photo required', 'Take a photo or choose one from your library first.');
      return;
    }
    setIsLoading(true);
    try {
      const next = normalizeMealResult(
        await wholeFoodScanApi.analyzeMeal({
          imageUri: mealImageUri,
          meal_type: mealType,
          portion_size: portionSize,
          source_context: sourceContext,
        })
      );
      setMealResult(next);
      setMealLabelDraft(next.meal_label);
      setIngredientDrafts(next.estimated_ingredients || []);
      setScanStep('result');
    } catch (err: any) {
      Alert.alert('Meal scan failed', err?.message || 'Unable to analyze that meal right now.');
    } finally {
      setIsLoading(false);
    }
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

  const renderModeRail = () => {
    const modes: Array<{ key: ScanMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
      { key: 'meal', label: 'Scan Food', icon: 'scan-outline' },
      { key: 'barcode', label: 'Barcode', icon: 'barcode-outline' },
      { key: 'label', label: 'Food Label', icon: 'reader-outline' },
    ];
    return (
      <View style={styles.captureBottomContent}>
        <View style={styles.captureInfoWrap}>
          <View style={styles.captureInfoPill}>
            <View style={styles.captureInfoDot} />
            <Text style={styles.captureInfoPillText}>WholeFoodLabs Scan</Text>
          </View>
          <Text style={styles.captureHeadline}>
            {scanMode === 'meal'
              ? 'Capture a meal'
              : scanMode === 'barcode'
                ? 'Check a barcode'
                : 'Read a food label'}
          </Text>
          <Text style={styles.captureSubhead}>
            {scanMode === 'meal'
              ? 'Frame the dish clearly. You can refine context before analysis.'
              : scanMode === 'barcode'
                ? 'Use the scan flow, then jump into a quick barcode check.'
                : 'Label mode lets you review packaged foods with ingredient context.'}
          </Text>
        </View>
        <View style={[styles.modeRail, { backgroundColor: 'rgba(11, 28, 21, 0.62)' }]}>
          {modes.map((item) => {
            const active = scanMode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => handleModeChange(item.key)}
                activeOpacity={0.85}
                style={[
                  styles.modePill,
                  { backgroundColor: active ? '#F4FBF7' : 'rgba(255,255,255,0.05)' },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={active ? '#0F8A43' : '#FFFFFF'} />
                <Text style={[styles.modePillText, { color: active ? '#111111' : '#FFFFFF' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.captureActionRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (scanMode === 'meal') {
                pickMealImage('library');
              } else {
                setScanStep('review');
              }
            }}
            style={[styles.captureSecondaryButton, { backgroundColor: 'rgba(30, 14, 18, 0.48)' }]}
          >
            <Ionicons
              name={scanMode === 'meal' ? 'images-outline' : scanMode === 'barcode' ? 'barcode-outline' : 'reader-outline'}
              size={22}
              color="#FFFFFF"
            />
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
            style={styles.capturePrimaryButton}
          >
            {isLoading ? <ActivityIndicator color="#111111" /> : <View style={styles.capturePrimaryDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowModesInfo(true)}
            style={[styles.captureSecondaryButton, { backgroundColor: 'rgba(30, 14, 18, 0.48)' }]}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCaptureStep = () => (
    <View style={[styles.captureRoot, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 18) }]}>
      {CameraView && cameraGranted ? (
        <CameraView style={styles.cameraPreview} facing="back" autofocus="on" />
      ) : (
        <LinearGradient
          colors={['#0A1914', '#0E241A', '#123021']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cameraPreview}
        />
      )}
      <LinearGradient
        colors={['rgba(2,12,9,0.62)', 'rgba(2,12,9,0.18)', 'rgba(2,12,9,0.72)']}
        locations={[0, 0.46, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.captureOverlay}
      />
      <View style={styles.captureTopRow}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.captureHeaderButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowModesInfo(true)}
          activeOpacity={0.85}
          style={styles.captureHeaderButton}
        >
          <Ionicons name="help" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.grabber} />

      <View style={styles.viewfinderWrap}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>

      {renderModeRail()}
    </View>
  );

  const renderReviewHeader = () => (
    <View style={[styles.reviewHeader, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity onPress={handleBack} activeOpacity={0.85} style={[styles.headerCircle, { borderColor: theme.border }]}>
        <Ionicons name="chevron-back" size={24} color={theme.primary} />
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
            <Ionicons name="camera-outline" size={22} color={theme.primary} />
            <Text style={[styles.reviewActionText, { color: theme.primary }]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => pickMealImage('library')}
            activeOpacity={0.85}
            style={[styles.reviewActionButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
          >
            <Ionicons name="images-outline" size={22} color={theme.textSecondary} />
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

  const renderMealResultStep = () => {
    if (!mealResult || !mealStatusMeta) return null;
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
          {renderReviewHeader()}
          {scanStep === 'review'
            ? scanMode === 'meal'
              ? renderMealReviewStep()
              : renderProductReviewStep()
            : scanMode === 'meal'
              ? renderMealResultStep()
              : renderProductResultStep()}
          {scanStep === 'result' && scanMode === 'meal' && (
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
    backgroundColor: '#0C1D16',
    position: 'relative',
    justifyContent: 'space-between',
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  captureTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 4,
    zIndex: 2,
  },
  captureHeaderButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 18, 14, 0.42)',
  },
  grabber: {
    width: 70,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.44)',
    alignSelf: 'center',
    marginTop: 6,
  },
  viewfinderWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    zIndex: 1,
  },
  viewfinder: {
    width: '88%',
    aspectRatio: 0.82,
    maxHeight: 360,
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  corner: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderColor: '#FFFFFF',
    shadowColor: '#34D399',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 7,
    borderLeftWidth: 7,
    borderTopLeftRadius: 28,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 7,
    borderRightWidth: 7,
    borderTopRightRadius: 28,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 7,
    borderLeftWidth: 7,
    borderBottomLeftRadius: 28,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 7,
    borderRightWidth: 7,
    borderBottomRightRadius: 28,
  },
  captureHeadline: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'left',
    letterSpacing: -0.7,
  },
  captureSubhead: {
    marginTop: Spacing.sm,
    color: 'rgba(235,255,244,0.78)',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'left',
    maxWidth: 340,
  },
  captureBottomContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    zIndex: 2,
  },
  captureInfoWrap: {
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  captureInfoPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8, 24, 18, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    marginBottom: 10,
  },
  captureInfoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  captureInfoPillText: {
    color: '#D9FBE8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modeRail: {
    borderRadius: 24,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
  },
  modePill: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  captureActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: 10,
  },
  capturePrimaryButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturePrimaryDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F4F7F5',
  },
  captureSecondaryButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCFCFA',
  },
  headerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  headerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  headerSpacer: {
    width: 64,
  },
  sheetCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  sheetTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  sheetSub: {
    marginTop: Spacing.sm,
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  previewShell: {
    marginTop: Spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
    minHeight: 320,
  },
  reviewImage: {
    width: '100%',
    height: 420,
    resizeMode: 'cover',
  },
  previewFallback: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFallbackText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
  reviewButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  reviewActionButton: {
    flex: 1,
    minHeight: 74,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  reviewActionText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  contextTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  choiceChip: {
    minHeight: 56,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  primaryButton: {
    minHeight: 86,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 24,
    minHeight: 140,
    textAlignVertical: 'top',
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
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
    borderRadius: 28,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  resultHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  resultTitleInput: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    padding: 0,
    margin: 0,
  },
  resultTitleText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  resultMeta: {
    marginTop: 6,
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  statusChipText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  resultRing: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRingValue: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '800',
    letterSpacing: -2,
  },
  resultRingLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  resultRingFallback: {
    fontSize: 20,
    fontWeight: '700',
  },
  resultSummary: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: Spacing.lg,
  },
  macroCard: {
    width: '48%',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 90,
  },
  macroCardValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  macroCardLabel: {
    marginTop: 4,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  resultSection: {
    borderRadius: 28,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionHeading: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ingredientsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: Spacing.md,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ingredientChipText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  ingredientInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  addIngredientInput: {
    flex: 1,
    marginBottom: 0,
  },
  squareButton: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
  },
  guidanceText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  emptyCopy: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  resultFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
  },
  footerButtonSecondary: {
    flex: 1,
    minHeight: 76,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  footerButtonPrimary: {
    flex: 1,
    minHeight: 76,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonSecondaryText: {
    fontSize: 18,
    fontWeight: '700',
  },
  footerButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});
