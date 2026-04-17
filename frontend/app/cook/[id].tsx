import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  UIManager,
  LayoutAnimation,
  PanResponder,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/GradientCard';
import { Button } from '../../components/Button';
import { CookCompleteModal } from '../../components/CookCompleteModal';
import { useTheme } from '../../hooks/useTheme';
import { nutritionApi, recipeApi, gameApi } from '../../services/api';
import { trackBehaviorEvent } from '../../services/notifications';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { formatIngredientDisplayLine } from '../../utils/ingredientFormat';

// ─── Types ────────────────────────────────────────────────────────────────────

type Ingredient = {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
};

type ComponentDetail = {
  id: string;
  title: string;
  recipe_role: string;
  steps: string[];
  ingredients: Ingredient[];
};

type RecipeDetail = {
  id: string;
  title: string;
  steps: string[];
  ingredients: Ingredient[];
  prep_time_min?: number;
  cook_time_min?: number;
  servings?: number;
  components?: ComponentDetail[];
  // R19: `tags` carries meal_type (breakfast/lunch/dinner/snack/dessert). We
  // check for "dessert" to flip the header copy into a celebration mode —
  // desserts are the flex-reward moment and the whole brand is "earn it, then
  // enjoy it". The data already comes down from /recipes/{id} — we just didn't
  // surface it in the RecipeDetail type before.
  tags?: string[];
  meal_type?: string;
};

// R19 helper: determine whether a recipe is a dessert/treat to flip the
// cook-mode header copy into a celebratory tone instead of a neutral utility
// tone. Cheap detection — prefer explicit tag/meal_type first, fall back to
// a title keyword sniff for old records that don't have clean metadata.
function isDessertRecipe(recipe: RecipeDetail | null): boolean {
  if (!recipe) return false;
  const tags = (recipe.tags || []).map((t) => String(t).toLowerCase());
  if (tags.includes('dessert')) return true;
  if ((recipe.meal_type || '').toLowerCase() === 'dessert') return true;
  const title = (recipe.title || '').toLowerCase();
  return /\b(dessert|brownie|cookie|cake|mousse|pudding|ice cream|cheesecake|truffle)\b/.test(title);
}

type CookProgressPayload = {
  currentStep: number;
  completedSteps: number[];
  ingredientsChecked: number[];
  isMergedMode: boolean;
  servingsMultiplier: number;
  savedAt: number;
};

type ActiveTimer = {
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INGREDIENT_CATEGORIES: Record<string, { label: string; icon: string; color: string; order: number }> = {
  protein:   { label: 'Protein',            icon: 'fish-outline',       color: '#EF4444', order: 0 },
  produce:   { label: 'Produce',            icon: 'leaf-outline',       color: '#22C55E', order: 1 },
  dairy:     { label: 'Dairy',              icon: 'water-outline',      color: '#3B82F6', order: 2 },
  grains:    { label: 'Grains',             icon: 'nutrition-outline',  color: '#F59E0B', order: 3 },
  fats:      { label: 'Fats & Oils',        icon: 'flask-outline',      color: '#A855F7', order: 4 },
  spices:    { label: 'Spices & Seasonings',icon: 'flame-outline',      color: '#F97316', order: 5 },
  sweetener: { label: 'Sweeteners',         icon: 'cafe-outline',       color: '#EC4899', order: 6 },
  other:     { label: 'Other',              icon: 'cube-outline',       color: '#6B7280', order: 7 },
};

const STICKY_NAV_HEIGHT = 72;

// Regex to find time references in step text
const TIME_RANGE_RE  = /(\d+)\s*[-–]\s*(\d+)\s*(min(?:ute)?s?|hours?|secs?|seconds?)/gi;
const TIME_SINGLE_RE = /\b(\d+)\s*(min(?:ute)?s?|hours?|secs?|seconds?)\b/gi;
// Regex for text highlighting (temps + times) — NO capturing group so split() doesn't double-include
const HIGHLIGHT_RE   = /\d+(?:\.\d+)?°[FC]|\d+\s*[-–]\s*\d+\s*(?:min(?:ute)?s?|hours?|secs?|seconds?)|\d+\s*(?:min(?:ute)?s?|hours?|secs?|seconds?)/gi;

const STORAGE_PREFIX = 'cook_progress_v1_';
const PROGRESS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLabelStep(step: string): boolean {
  return step.trim().startsWith('---');
}

function parseTimerChips(stepText: string): Array<{ label: string; seconds: number }> {
  const chips: Array<{ label: string; seconds: number }> = [];
  const seen = new Set<string>();

  // Range matches first (e.g. "2-3 minutes" → 2.5 * 60 = 150s)
  let m: RegExpExecArray | null;
  TIME_RANGE_RE.lastIndex = 0;
  while ((m = TIME_RANGE_RE.exec(stepText)) !== null) {
    const lo = parseInt(m[1]);
    const hi = parseInt(m[2]);
    const unit = m[3].toLowerCase();
    const key = m[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const mid = (lo + hi) / 2;
    const secs = unit.startsWith('h') ? mid * 3600 : unit.startsWith('s') ? mid : mid * 60;
    chips.push({ label: `${m[1]}-${m[2]} ${m[3]}`, seconds: Math.round(secs) });
  }

  // Single value matches — skip if already covered by a range
  TIME_SINGLE_RE.lastIndex = 0;
  while ((m = TIME_SINGLE_RE.exec(stepText)) !== null) {
    const val = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const key = m[0];
    // Skip if this text is part of a range already captured
    if (seen.has(key) || [...seen].some(s => s.includes(m![0]))) continue;
    seen.add(key);
    const secs = unit.startsWith('h') ? val * 3600 : unit.startsWith('s') ? val : val * 60;
    chips.push({ label: `${m[1]} ${m[2]}`, seconds: secs });
  }

  return chips.slice(0, 3);
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function buildMergedRecipe(base: RecipeDetail): RecipeDetail {
  const components = base.components ?? [];
  const ROLE_ORDER = ['base', 'protein_main', 'grain_base', 'sauce', 'topping', 'veg_side', 'garnish'];
  const sorted = [...components].sort(
    (a, b) => (ROLE_ORDER.indexOf(a.recipe_role) - ROLE_ORDER.indexOf(b.recipe_role))
  );

  const mergedSteps: string[] = [`--- ${base.title} ---`, ...base.steps];
  const mergedIngredients: Ingredient[] = [...base.ingredients];

  for (const comp of sorted) {
    mergedSteps.push(`--- ${comp.title} ---`);
    mergedSteps.push(...comp.steps);
    for (const ing of comp.ingredients) {
      if (!mergedIngredients.some(i => i.name.toLowerCase() === ing.name.toLowerCase())) {
        mergedIngredients.push(ing);
      }
    }
  }
  return { ...base, steps: mergedSteps, ingredients: mergedIngredients };
}

function scaleQuantity(quantity: string | number | undefined, multiplier: number): string | number | undefined {
  if (quantity == null) return quantity;
  const n = parseFloat(String(quantity));
  if (isNaN(n)) return quantity;
  const scaled = n * multiplier;
  // Format: whole numbers as ints, fractions to 1 decimal
  return scaled % 1 === 0 ? scaled : parseFloat(scaled.toFixed(1));
}

// ─── Step text renderer with highlighted temps/times/ingredients ─────────────

function renderStepText(
  text: string,
  ingredientNames: string[],
  highlightColor: string,
  ingredientColor: string,
  baseStyle: object,
) {
  // Build combined regex: HIGHLIGHT_RE | ingredient names
  const escaped = ingredientNames
    .filter(n => n.length > 2)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const fullRe = escaped
    ? new RegExp(`(${HIGHLIGHT_RE.source}|${escaped})`, 'gi')
    : new RegExp(`(${HIGHLIGHT_RE.source})`, 'gi');

  const parts = text.split(fullRe).filter(Boolean);
  HIGHLIGHT_RE.lastIndex = 0;

  return parts.map((part, i) => {
    HIGHLIGHT_RE.lastIndex = 0;
    const isHighlight = HIGHLIGHT_RE.test(part);
    HIGHLIGHT_RE.lastIndex = 0;
    const isIngredient = !isHighlight && ingredientNames.some(
      n => n.length > 2 && part.toLowerCase().includes(n.toLowerCase())
    );

    if (isHighlight) {
      return (
        <Text key={i} style={[baseStyle, { color: highlightColor, fontWeight: '700' }]}>
          {part}
        </Text>
      );
    }
    if (isIngredient) {
      return (
        <Text key={i} style={[baseStyle, { color: ingredientColor, textDecorationLine: 'underline' }]}>
          {part}
        </Text>
      );
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CookModeScreen() {
  useKeepAwake();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ── Core recipe state
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [ingredientsChecked, setIngredientsChecked] = useState<Set<number>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isMergedMode, setIsMergedMode] = useState(false);
  const [servingsMultiplier, setServingsMultiplier] = useState(1);
  const [loggedCook, setLoggedCook] = useState(false);

  // ── Modals
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);

  // ── Step animations
  const progressAnim    = useRef(new Animated.Value(0)).current;
  const stepFadeAnim    = useRef(new Animated.Value(1)).current;
  const stepCheckScale  = useRef(new Animated.Value(0)).current;
  const [showStepCheck, setShowStepCheck] = useState(false);


  // ── AI assistant state
  const aiCacheRef     = useRef<Map<number, string>>(new Map());
  const [showAssistant, setShowAssistant] = useState(false);
  const [aiLoading, setAiLoading]         = useState(false);
  const [userQuestion, setUserQuestion]   = useState('');

  // ── Timer state
  const [activeTimer, setActiveTimer]     = useState<ActiveTimer | null>(null);
  const timerIntervalRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── AsyncStorage save debounce
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Derived values
  const realSteps   = recipe?.steps?.filter(s => !isLabelStep(s)) ?? [];
  const totalSteps  = realSteps.length || 1;
  const allSteps    = recipe?.steps ?? [];
  const currentStepText = allSteps[currentStep] ?? '';
  const isCurrentLabel  = isLabelStep(currentStepText);
  const ingredientNames = (recipe?.ingredients ?? []).map(i => i.name).filter(Boolean);
  const timerChips      = !isCurrentLabel ? parseTimerChips(currentStepText) : [];
  const navBarHeight    = Spacing.sm * 2 + 44 + insets.bottom;

  // ─── Load recipe + restore progress ────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    recipeApi
      .getDetail(id)
      .then(async (r) => {
        const base: RecipeDetail = {
          id: r.id,
          title: r.title,
          steps: r.steps || [],
          ingredients: r.ingredients || [],
          prep_time_min: r.prep_time_min,
          cook_time_min: r.cook_time_min,
          servings: r.servings,
          components: r.components,
        };

        // Try to restore saved progress
        const savedRaw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${r.id}`).catch(() => null);
        if (savedRaw) {
          try {
            const saved: CookProgressPayload = JSON.parse(savedRaw);
            if (Date.now() - saved.savedAt < PROGRESS_EXPIRY_MS) {
              const restored = saved.isMergedMode ? buildMergedRecipe(base) : base;
              setRecipe(restored);
              setCurrentStep(saved.currentStep);
              setCompletedSteps(new Set(saved.completedSteps));
              setIngredientsChecked(new Set(saved.ingredientsChecked));
              setIsMergedMode(saved.isMergedMode);
              setServingsMultiplier(saved.servingsMultiplier ?? 1);
              return;
            } else {
              await AsyncStorage.removeItem(`${STORAGE_PREFIX}${r.id}`).catch(() => {});
            }
          } catch { /* ignore corrupt data */ }
        }

        setRecipe(base);
        // Offer merge if there are components and no saved session
        if (base.components && base.components.length > 0) {
          setMergeModalVisible(true);
        }
      })
      .catch(() => setRecipe(null))
      .finally(() => setLoading(false));
  }, [id]);

  // ─── Save progress to AsyncStorage (debounced) ─────────────────────────────
  useEffect(() => {
    if (!recipe?.id || loading) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      const payload: CookProgressPayload = {
        currentStep,
        completedSteps: [...completedSteps],
        ingredientsChecked: [...ingredientsChecked],
        isMergedMode,
        servingsMultiplier,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${recipe.id}`, JSON.stringify(payload)).catch(() => {});
    }, 800);
    return () => { if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current); };
  }, [currentStep, completedSteps, ingredientsChecked, isMergedMode, servingsMultiplier, recipe?.id, loading]);

  // ─── Progress bar animation ─────────────────────────────────────────────────
  useEffect(() => {
    const realIndex = allSteps.slice(0, currentStep + 1).filter(s => !isLabelStep(s)).length;
    Animated.timing(progressAnim, {
      toValue: totalSteps > 0 ? realIndex / totalSteps : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [currentStep, totalSteps, allSteps, progressAnim]);

  // ─── Timer interval ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTimer?.running) {
      timerIntervalRef.current = setInterval(() => {
        setActiveTimer(prev => {
          if (!prev) return null;
          const next = prev.remainingSeconds - 1;
          if (next <= 0) {
            clearInterval(timerIntervalRef.current!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Fire local notification
            import('expo-notifications').then(N => {
              N.scheduleNotificationAsync({
                content: {
                  title: 'Timer done!',
                  body: `${prev.label} timer for "${recipe?.title}" is up.`,
                  sound: true,
                },
                trigger: null,
              }).catch(() => {});
            }).catch(() => {});
            return { ...prev, remainingSeconds: 0, running: false };
          }
          return { ...prev, remainingSeconds: next };
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [activeTimer?.running, recipe?.title]);

  // ─── Swipe gesture ──────────────────────────────────────────────────────────
  // Use a ref so PanResponder always calls the latest onStepChange without stale closure
  const swipeCallbackRef = useRef<(step: number) => void>(() => {});
  const allStepsLenRef   = useRef(0);

  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        setCurrentStep(prev => {
          if (gs.dx < -60 && prev < allStepsLenRef.current - 1) {
            swipeCallbackRef.current(prev + 1);
          } else if (gs.dx > 60 && prev > 0) {
            swipeCallbackRef.current(prev - 1);
          }
          return prev;
        });
      },
    })
  ).current;

  // ─── AI assistant ────────────────────────────────────────────────────────────
  const askAssistant = useCallback(async (question?: string) => {
    if (!recipe?.id) return;
    if (!question && aiCacheRef.current.has(currentStep)) {
      setShowAssistant(true);
      return;
    }
    setAiLoading(true);
    setShowAssistant(true);
    try {
      const res = await recipeApi.getCookHelp(recipe.id, currentStep, question);
      aiCacheRef.current.set(currentStep, res.answer);
    } catch {
      aiCacheRef.current.set(currentStep, 'Unable to connect to the cooking assistant. Try again in a moment.');
    } finally {
      setAiLoading(false);
      setUserQuestion('');
    }
  }, [recipe?.id, currentStep]);

  // ─── Step navigation ─────────────────────────────────────────────────────────
  const onStepChange = useCallback((newStep: number) => {
    const isAdvancing = newStep > currentStep;
    if (isAdvancing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!isLabelStep(currentStepText)) {
        setCompletedSteps(prev => new Set(prev).add(currentStep));
      }
      setShowStepCheck(true);
      stepCheckScale.setValue(0);
      Animated.spring(stepCheckScale, {
        toValue: 1, tension: 120, friction: 6, useNativeDriver: true,
      }).start();
      setTimeout(() => { setShowStepCheck(false); doTransition(newStep); }, 400);
    } else {
      doTransition(newStep);
    }
    // Clear timer on step change
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setActiveTimer(null);
  }, [currentStep, currentStepText, stepCheckScale]);

  // Keep swipe refs up to date with latest values every render
  swipeCallbackRef.current = (step: number) => onStepChange(step);
  allStepsLenRef.current   = allSteps.length || 1;

  const doTransition = useCallback((newStep: number) => {
    Animated.timing(stepFadeAnim, {
      toValue: 0, duration: 120, useNativeDriver: true,
    }).start(() => {
      setCurrentStep(newStep);
      setShowAssistant(false);
      Animated.timing(stepFadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  }, [stepFadeAnim]);

  // ─── Ingredient toggling ─────────────────────────────────────────────────────
  const toggleIngredient = useCallback((index: number, categoryKey: string, groupIndices: number[]) => {
    setIngredientsChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      if (groupIndices.every(i => next.has(i))) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedCategories(p => new Set(p).add(categoryKey));
      }
      return next;
    });
    try { require('expo-haptics')?.selectionAsync?.(); } catch {}
  }, []);

  const toggleCategory = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ─── Completion handlers ─────────────────────────────────────────────────────
  const handleLogAndFinish = useCallback(async () => {
    if (!loggedCook && recipe) {
      try {
        await nutritionApi.createLog({
          source_type: 'cook_mode',
          source_id: recipe.id,
          meal_type: 'meal',
          servings: servingsMultiplier,
          quantity: 1,
        });
        trackBehaviorEvent('cook_completed', { recipe_id: recipe.id });
        setLoggedCook(true);
        gameApi.awardXP(50, 'cook_complete').catch(() => {});
      } catch { /* silent */ }
    }
    if (recipe?.id) {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${recipe.id}`).catch(() => {});
    }
    router.back();
  }, [loggedCook, recipe, servingsMultiplier]);

  const handleExitWithoutLogging = useCallback(async () => {
    if (recipe?.id) {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${recipe.id}`).catch(() => {});
    }
    router.back();
  }, [recipe?.id]);

  // ─── Render guards ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!recipe || !allSteps.length) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={44} color={theme.textTertiary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No cook steps found for this recipe.
        </Text>
      </View>
    );
  }

  // Compute real step index for display (skip label steps)
  const realStepIndex = allSteps.slice(0, currentStep).filter(s => !isLabelStep(s)).length;
  const isDoneStep    = currentStep === allSteps.length - 1;
  const aiAnswer      = aiCacheRef.current.get(currentStep) ?? '';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={navBarHeight}
    >
      {/* R19: celebration banner for desserts. The brand framing is "eat
          clean, earn your cheat meals" — when a user opens cook mode on a
          dessert, we explicitly celebrate the moment instead of rendering a
          neutral cook view. This is the flex-feature's emotional payoff. */}
      {isDessertRecipe(recipe) && (
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dessertBanner}
        >
          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          <Text style={styles.dessertBannerText}>
            Flex treat time — you earned this.
          </Text>
        </LinearGradient>
      )}

      {/* ── Sticky Header ── */}
      <View style={[styles.stickyHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={2}>
            {recipe.title}
          </Text>
          <View style={[styles.stepBadge, { backgroundColor: theme.surfaceHighlight }]}>
            <Text style={[styles.stepBadgeText, { color: theme.textSecondary }]}>
              {realStepIndex + (isCurrentLabel ? 0 : 1)}/{totalSteps}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressBarWrap, { backgroundColor: theme.surfaceElevated }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          >
            <LinearGradient colors={theme.gradient.primary} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step card */}
        {isCurrentLabel ? (
          // Section divider for composed meals
          <View style={[styles.sectionDivider, { backgroundColor: theme.primaryMuted, borderColor: theme.border }]}>
            <Ionicons name="layers-outline" size={16} color={theme.primary} />
            <Text style={[styles.sectionDividerText, { color: theme.primary }]}>
              {currentStepText.replace(/---/g, '').trim()}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ position: 'relative' }}>
              <Animated.View
                style={{ opacity: stepFadeAnim, transform: [{ translateY: stepFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}
                {...swipeResponder.panHandlers}
              >
                <LinearGradient colors={theme.gradient.primary} style={styles.stepCard}>
                  <Text style={styles.stepNumber}>Step {realStepIndex + 1}</Text>
                  <Text style={styles.stepText}>
                    {renderStepText(
                      currentStepText.replace(/^Step\s*\d+\s*:\s*/i, ''),
                      ingredientNames,
                      '#FCD34D',
                      'rgba(255,255,255,0.85)',
                      styles.stepText,
                    )}
                  </Text>
                </LinearGradient>
              </Animated.View>

              {showStepCheck && (
                <Animated.View style={[styles.stepCheckOverlay, { transform: [{ scale: stepCheckScale }] }]}>
                  <View style={styles.stepCheckCircle}>
                    <Ionicons name="checkmark" size={32} color="#fff" />
                  </View>
                </Animated.View>
              )}
            </View>

            {/* Timer chips */}
            {timerChips.length > 0 && (
              <View style={styles.timerChipsRow}>
                {timerChips.map((chip, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTimer({
                        label: chip.label,
                        totalSeconds: chip.seconds,
                        remainingSeconds: chip.seconds,
                        running: true,
                      });
                    }}
                    style={[styles.timerChip, { backgroundColor: theme.accentMuted }]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="timer-outline" size={14} color={theme.accent} />
                    <Text style={[styles.timerChipText, { color: theme.accent }]}>{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* AI Help button */}
            <TouchableOpacity
              onPress={() => askAssistant()}
              style={[styles.helpButton, { backgroundColor: theme.accentMuted }]}
              activeOpacity={0.7}
            >
              <Ionicons name="bulb" size={18} color={theme.accent} />
              <Text style={[styles.helpButtonText, { color: theme.accent }]}>
                Get tips for this step
              </Text>
            </TouchableOpacity>

            {/* AI Answer */}
            {showAssistant && (
              <Card style={styles.aiCard}>
                {aiLoading ? (
                  <View style={styles.aiLoading}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.aiLoadingText, { color: theme.textSecondary }]}>Thinking...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.aiHeader}>
                      <Ionicons name="sparkles" size={16} color={theme.primary} />
                      <Text style={[styles.aiHeaderText, { color: theme.primary }]}>Cooking Assistant</Text>
                      <TouchableOpacity
                        onPress={() => setShowAssistant(false)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close" size={18} color={theme.textTertiary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.aiText, { color: theme.text }]}>{aiAnswer}</Text>
                    <View style={[styles.questionRow, { borderTopColor: theme.border }]}>
                      <TextInput
                        style={[styles.questionInput, { color: theme.text, backgroundColor: theme.surfaceHighlight }]}
                        placeholder="Ask a follow-up..."
                        placeholderTextColor={theme.textTertiary}
                        value={userQuestion}
                        onChangeText={setUserQuestion}
                        onSubmitEditing={() => { if (userQuestion.trim()) askAssistant(userQuestion); }}
                        returnKeyType="send"
                      />
                      <TouchableOpacity
                        onPress={() => { if (userQuestion.trim()) askAssistant(userQuestion); }}
                        style={[styles.sendBtn, { backgroundColor: theme.primary }]}
                      >
                        <Ionicons name="send" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Card>
            )}
          </>
        )}

        {/* ── Ingredients section ── */}
        <View style={styles.ingredientsHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
          <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, fontWeight: '600' }}>
            {ingredientsChecked.size}/{recipe.ingredients.length}
          </Text>
        </View>

        {/* Servings multiplier */}
        <View style={[styles.servingsRow, { backgroundColor: theme.surfaceHighlight, borderRadius: BorderRadius.md }]}>
          <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.servingsLabel, { color: theme.textSecondary }]}>Servings</Text>
          <View style={styles.servingsStepper}>
            <TouchableOpacity
              onPress={() => setServingsMultiplier(m => Math.max(0.5, parseFloat((m - 0.5).toFixed(1))))}
              style={[styles.stepperBtn, { backgroundColor: theme.border }]}
            >
              <Ionicons name="remove" size={14} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.servingsValue, { color: theme.text }]}>
              {servingsMultiplier === 1 ? '1x' : `${servingsMultiplier}x`}
            </Text>
            <TouchableOpacity
              onPress={() => setServingsMultiplier(m => Math.min(8, parseFloat((m + 0.5).toFixed(1))))}
              style={[styles.stepperBtn, { backgroundColor: theme.border }]}
            >
              <Ionicons name="add" size={14} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Ingredient list */}
        {(() => {
          const groups: Record<string, { ing: Ingredient; idx: number }[]> = {};
          recipe.ingredients.forEach((ing, idx) => {
            const cat = ing.category && INGREDIENT_CATEGORIES[ing.category] ? ing.category : 'other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push({ ing, idx });
          });
          const sortedKeys = Object.keys(groups).sort(
            (a, b) => (INGREDIENT_CATEGORIES[a]?.order ?? 99) - (INGREDIENT_CATEGORIES[b]?.order ?? 99)
          );
          return sortedKeys.map(catKey => {
            const catInfo    = INGREDIENT_CATEGORIES[catKey] || INGREDIENT_CATEGORIES.other;
            const items      = groups[catKey];
            const groupIdxs  = items.map(i => i.idx);
            const checkedCnt = groupIdxs.filter(i => ingredientsChecked.has(i)).length;
            const allDone    = checkedCnt === items.length;
            const isCollapsed = collapsedCategories.has(catKey);
            return (
              <View key={catKey} style={styles.ingredientGroup}>
                <TouchableOpacity
                  style={styles.categoryHeader}
                  onPress={() => toggleCategory(catKey)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryPill, { backgroundColor: catInfo.color + '18' }]}>
                    <Ionicons name={catInfo.icon as any} size={14} color={catInfo.color} />
                    <Text style={[styles.categoryLabel, { color: catInfo.color }]}>{catInfo.label}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={[styles.categoryCount, { color: allDone ? theme.primary : theme.textTertiary }]}>
                      {checkedCnt}/{items.length}
                    </Text>
                    {allDone && <Ionicons name="checkmark-circle" size={16} color={theme.primary} />}
                    <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={theme.textTertiary} />
                  </View>
                </TouchableOpacity>
                {!isCollapsed && items.map(({ ing, idx }) => {
                  const checked = ingredientsChecked.has(idx);
                  const scaledIng = { ...ing, quantity: scaleQuantity(ing.quantity, servingsMultiplier) };
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.ingredientRow}
                      onPress={() => toggleIngredient(idx, catKey, groupIdxs)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.checkCircle,
                        { borderColor: checked ? theme.primary : theme.borderLight, backgroundColor: checked ? theme.primary : 'transparent' },
                      ]}>
                        {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={[
                        styles.ingredientName,
                        { color: checked ? theme.textTertiary : theme.text, textDecorationLine: checked ? 'line-through' : 'none' },
                      ]}>
                        {formatIngredientDisplayLine(scaledIng)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          });
        })()}
      </ScrollView>

      {/* ── Active Timer bar (above nav) ── */}
      {activeTimer && (
        <View style={[
          styles.timerBar,
          { bottom: navBarHeight, backgroundColor: theme.accentMuted, borderTopColor: theme.accent + '40' },
        ]}>
          <Ionicons name="timer" size={16} color={theme.accent} />
          <Text style={[styles.timerBarLabel, { color: theme.accent }]}>{activeTimer.label}</Text>
          <Text style={[styles.timerBarCountdown, { color: theme.accent }]}>
            {formatCountdown(activeTimer.remainingSeconds)}
          </Text>
          <TouchableOpacity
            onPress={() => setActiveTimer(prev => prev ? { ...prev, running: !prev.running } : null)}
            style={[styles.timerBarBtn, { backgroundColor: theme.accent + '30' }]}
          >
            <Ionicons name={activeTimer.running ? 'pause' : 'play'} size={14} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); setActiveTimer(null); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close" size={16} color={theme.accent} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Sticky Nav Bar ── */}
      <View style={[
        styles.stickyNav,
        { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}>
        <Button
          title="Previous"
          variant="outline"
          size="md"
          onPress={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        />
        <Button
          title={isDoneStep ? 'Done' : 'Next'}
          size="md"
          onPress={() => {
            if (!isDoneStep) {
              onStepChange(Math.min(allSteps.length - 1, currentStep + 1));
            } else {
              setShowCompleteModal(true);
            }
          }}
        />
      </View>

      {/* ── Cook Complete Modal ── */}
      <CookCompleteModal
        visible={showCompleteModal}
        recipeTitle={recipe.title}
        stepCount={totalSteps}
        prepMin={recipe.prep_time_min}
        cookMin={recipe.cook_time_min}
        onLogAndFinish={handleLogAndFinish}
        onExitWithoutLogging={handleExitWithoutLogging}
      />

      {/* ── Merge Modal (composed meals) ── */}
      <Modal visible={mergeModalVisible} transparent animationType="fade" onRequestClose={() => setMergeModalVisible(false)}>
        <View style={styles.mergeOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMergeModalVisible(false)} />
          <View style={[styles.mergeCard, { backgroundColor: theme.surface }]}>
            <View style={[styles.mergeIconWrap, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="layers-outline" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.mergeTitle, { color: theme.text }]}>Cook Everything Together?</Text>
            <Text style={[styles.mergeBody, { color: theme.textSecondary }]}>
              This meal has {recipe?.components?.length ?? 0} components. Cook them all in one unified flow, or just the base recipe.
            </Text>
            {recipe?.components?.map((c, i) => (
              <View key={i} style={[styles.mergeComponentRow, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="checkmark-circle-outline" size={14} color={theme.primary} />
                <Text style={[styles.mergeComponentText, { color: theme.textSecondary }]}>{c.title}</Text>
              </View>
            ))}
            <View style={styles.mergeActions}>
              <Button
                title="Unified Cook"
                variant="primary"
                fullWidth
                onPress={() => {
                  if (recipe) setRecipe(buildMergedRecipe(recipe));
                  setIsMergedMode(true);
                  setMergeModalVisible(false);
                }}
              />
              <Button
                title="Base Only"
                variant="outline"
                fullWidth
                onPress={() => setMergeModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText:   { fontSize: FontSize.md },

  // R19: celebration banner above the sticky header for dessert recipes.
  dessertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
  },
  dessertBannerText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Sticky header
  stickyHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.1,
  },
  stepBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  stepBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress bar
  progressBarWrap: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', position: 'absolute', left: 0, top: 0, bottom: 0 },

  // Scrollable content
  content: { padding: Spacing.xl },

  // Step card
  stepCard:    { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.md },
  stepNumber:  { color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginBottom: Spacing.xs, fontSize: FontSize.sm },
  stepText:    { color: '#fff', fontSize: FontSize.md, lineHeight: 24, fontWeight: '600' },

  stepCheckOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: BorderRadius.xl,
  },
  stepCheckCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section divider (composed meal labels)
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionDividerText: { fontSize: FontSize.sm, fontWeight: '700' },

  // Timer chips
  timerChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  timerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  timerChipText: { fontSize: FontSize.xs, fontWeight: '700' },

  // AI help
  helpButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md, marginBottom: Spacing.md,
  },
  helpButtonText: { fontSize: FontSize.sm, fontWeight: '700' },

  aiCard:       { marginBottom: Spacing.md },
  aiLoading:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  aiLoadingText: { fontSize: FontSize.sm },
  aiHeader:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  aiHeaderText: { fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  aiText:       { fontSize: FontSize.sm, lineHeight: 22 },
  questionRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1 },
  questionInput: { flex: 1, fontSize: FontSize.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  sendBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Ingredients
  ingredientsHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm, marginTop: Spacing.xl,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: 0 },

  // Servings adjuster
  servingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  servingsLabel: { fontSize: FontSize.xs, fontWeight: '600', flex: 1 },
  servingsStepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperBtn: { width: 28, height: 28, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  servingsValue: { fontSize: FontSize.sm, fontWeight: '700', minWidth: 32, textAlign: 'center' },

  // Ingredient groups
  ingredientGroup: { marginBottom: Spacing.sm },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, marginBottom: 2 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: BorderRadius.full },
  categoryLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.3 },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryCount: { fontSize: FontSize.xs, fontWeight: '600' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingLeft: Spacing.sm, gap: Spacing.sm },
  checkCircle: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ingredientName: { flex: 1, fontSize: FontSize.sm },

  // Timer bar
  timerBar: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.sm, borderTopWidth: 1,
  },
  timerBarLabel:     { fontSize: FontSize.xs, fontWeight: '600', flex: 1 },
  timerBarCountdown: { fontSize: FontSize.lg, fontWeight: '800', letterSpacing: 1 },
  timerBarBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Sticky nav bar
  stickyNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // Merge modal
  mergeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  mergeCard: {
    width: '100%', maxWidth: 380,
    borderRadius: BorderRadius.xxl, overflow: 'hidden',
    padding: Spacing.xl, gap: Spacing.sm,
  },
  mergeIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.xs },
  mergeTitle: { fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 },
  mergeBody:  { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', paddingHorizontal: Spacing.sm },
  mergeComponentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  mergeComponentText: { fontSize: FontSize.sm, flex: 1 },
  mergeActions: { gap: Spacing.sm, marginTop: Spacing.sm },
});
