import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Keyboard,
  Platform,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/GradientCard';
import { Button } from '../../components/Button';
import { useTheme } from '../../hooks/useTheme';
import { useChatStore } from '../../stores/chatStore';
import { useSavedRecipesStore } from '../../stores/savedRecipesStore';
import { useGamificationStore } from '../../stores/gamificationStore';
import { chatApi } from '../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { useThemeStore } from '../../stores/themeStore';
import { TypingIndicator } from '../../components/TypingIndicator';
import { LoadingPhaseText } from '../../components/LoadingPhaseText';
import { ChatBubbleEntrance } from '../../components/ChatBubbleEntrance';
import { RecipeCardShimmer } from '../../components/RecipeCardShimmer';
import { MesBadgePopIn } from '../../components/MesBadgePopIn';
import { cleanRecipeDescription } from '../../utils/recipeDescription';
import { formatIngredientDisplayLine } from '../../utils/ingredientFormat';
import {
  type RecipeData,
  type RecipeDraft,
  normalizeAssistantPayload,
  parseIngredientLine,
  recipeKeyFor,
  toStringValue,
} from '../../utils/chatParser';
import { getTierConfig } from '../../stores/metabolicBudgetStore';
import { useRecipeViewStore } from '../../stores/recipeViewStore';
import { trackBehaviorEvent } from '../../services/notifications';

const FALLBACK_SUGGESTIONS = [
  'Mac and Cheese',
  'Pizza',
  'Fried Chicken',
  'Ice Cream',
  'Burger and Fries',
  'Chocolate Cake',
  'Ramen Noodles',
  'Pancakes',
];

const MAX_CHAT_WIDTH = 860;
const MAX_BUBBLE_WIDTH = 720;

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const { prefill, autoSend } = useLocalSearchParams<{ prefill?: string; autoSend?: string }>();
  const isCompact = width < 410;
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<any> | null>(null);
  const lastAutoSubmittedPrefillRef = useRef<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null);
  const [recipeOverrides, setRecipeOverrides] = useState<Record<string, RecipeData>>({});
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean[]>>({});
  const [showSavedRecipes, setShowSavedRecipes] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [questToast, setQuestToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const lastUserInputRef = useRef<string>('');
  const {
    messages,
    isLoading,
    streamingText,
    sessionId,
    addMessage,
    setSessionId,
    setLoading,
    setStreamingText,
    appendStreamingText,
  } = useChatStore();
  const clearChat = useChatStore((s) => s.clearChat);
  const loadLastSession = useChatStore((s) => s.loadLastSession);
  const savedRecipes = useSavedRecipesStore((s) => s.recipes);
  const awardXP = useGamificationStore((s) => s.awardXP);
  const saveRecipe = useSavedRecipesStore((s) => s.saveRecipe);
  const saveGeneratedRecipe = useSavedRecipesStore((s) => s.saveGeneratedRecipe);
  const removeRecipe = useSavedRecipesStore((s) => s.removeRecipe);
  const isSavedRecipe = useSavedRecipesStore((s) => s.isSaved);
  const fetchSaved = useSavedRecipesStore((s) => s.fetchSaved);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const composerBottomInset = Math.max(insets.bottom, 10);
  const floatingBarOffset = Math.max(tabBarHeight - insets.bottom, 74);
  const composerLift = Math.max(floatingBarOffset - 40, 26);
  const maxContentWidth = Math.min(MAX_CHAT_WIDTH, Math.max(width - Spacing.xl * 2, 0));
  const introWidth = Math.min(maxContentWidth, 620);
  const bubbleMaxWidth = Math.min(Math.max(width * 0.82, 280), MAX_BUBBLE_WIDTH);
  const deferredMessages = useDeferredValue(messages);

  useEffect(() => {
    fetchSaved();
    loadLastSession();
    chatApi.getSuggestions().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSuggestions(data.map((s) => s.label || s.query));
      }
    }).catch((err: any) => {
      console.warn('Failed to load chat suggestions:', err?.message);
    });
  }, [fetchSaved]);

  // Handle deep-link prefill from coach or other screens
  useEffect(() => {
    if (prefill && typeof prefill === 'string' && prefill.trim()) {
      setInput(prefill.trim());
    }
  }, [prefill]);

  useEffect(() => {
    const trimmedPrefill = typeof prefill === 'string' ? prefill.trim() : '';
    const shouldAutoSend = autoSend === '1' || autoSend === 'true';
    if (!shouldAutoSend || !trimmedPrefill || isLoading) return;
    if (lastAutoSubmittedPrefillRef.current === trimmedPrefill) return;

    lastAutoSubmittedPrefillRef.current = trimmedPrefill;
    setInput('');
    Keyboard.dismiss();
    void submitChatMessage(trimmedPrefill);
  }, [autoSend, prefill, isLoading]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardVisible(true);
      if (messages.length > 0) {
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [messages.length]);

  const shouldPreferStreaming = (message: string) => {
    const normalized = message.trim().toLowerCase();
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    return wordCount > 6 || /make|healthier|modify|swap|without|instead/.test(normalized);
  };

  const addAssistantPayload = (payload: any) => {
    const normalized = normalizeAssistantPayload({
      content: payload?.message?.content || payload?.message || '',
      recipe: payload?.healthified_recipe || payload?.recipe,
      swaps: payload?.ingredient_swaps || payload?.swaps,
      nutrition: payload?.nutrition_comparison || payload?.nutrition,
    });
    addMessage({
      role: 'assistant',
      content: normalized.message,
      recipe: normalized.recipe,
      swaps: normalized.swaps,
      nutrition: normalized.nutrition,
      mes_score: payload?.mes_score || null,
    });
  };

  const submitChatMessage = async (userMessage: string) => {
    lastUserInputRef.current = userMessage;
    addMessage({ role: 'user', content: userMessage });
    setLoading(true);
    setStreamingText('');
    try {
      if (shouldPreferStreaming(userMessage)) {
        await chatApi.streamHealthify(
          userMessage,
          sessionId || undefined,
          (chunk) => appendStreamingText(chunk),
          (done) => {
            if (done?.session_id) setSessionId(done.session_id);
            if (done?.payload) addAssistantPayload(done.payload);
          }
        );
      } else {
        const response = await chatApi.healthify(userMessage, sessionId || undefined);
        if (response.session_id) setSessionId(response.session_id);
        addAssistantPayload(response);
      }
      awardXP(25, 'healthify').then((res) => {
        if (res.xp_gained > 0) showQuestToast(`+${res.xp_gained} XP · Healthify`);
      }).catch(() => {});
    } catch (err: any) {
      const rawMessage = String(err?.message || '');
      const friendlyMessage =
        /quota|rate.?limit|resourceexhausted|429/i.test(rawMessage)
          ? "The AI provider quota is currently exceeded. Please try again later."
          : "Something went wrong. Tap below to try again.";
      addMessage({ role: 'assistant', content: friendlyMessage, isError: true } as any);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    Keyboard.dismiss();
    await submitChatMessage(userMessage);
  };

  const handleSuggestion = (suggestion: string) => {
    trackBehaviorEvent('healthify_suggestion_tapped', { suggestion });
    setInput(suggestion);
    // Auto-send after a microtask to let state update
    setTimeout(() => {
      const userMessage = suggestion.trim();
      if (!userMessage || isLoading) return;
      setInput('');
      void submitChatMessage(userMessage);
    }, 0);
  };

  const startRecipeEdit = (key: string, recipe: RecipeData) => {
    setEditingKey(key);
    setRecipeDraft({
      title: recipe.title || '',
      description: recipe.description || '',
      servings: recipe.servings ? String(recipe.servings) : '',
      prepTime: recipe.prep_time_min ? String(recipe.prep_time_min) : '',
      cookTime: recipe.cook_time_min ? String(recipe.cook_time_min) : '',
      ingredientsText: recipe.ingredients
        .map((ing) => `${toStringValue(ing.quantity)} ${toStringValue(ing.unit)} ${ing.name}`.trim())
        .join('\n'),
      stepsText: recipe.steps.join('\n'),
    });
  };

  const cancelRecipeEdit = () => {
    setEditingKey(null);
    setRecipeDraft(null);
  };

  const applyRecipeEdit = (key: string) => {
    if (!recipeDraft) return;
    const ingredients = recipeDraft.ingredientsText
      .split('\n')
      .map(parseIngredientLine)
      .filter((ing) => ing.name);
    const steps = recipeDraft.stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: RecipeData = {
      title: recipeDraft.title.trim() || 'Custom Recipe',
      description: recipeDraft.description.trim(),
      ingredients,
      steps,
      servings: recipeDraft.servings ? Number(recipeDraft.servings) : undefined,
      prep_time_min: recipeDraft.prepTime ? Number(recipeDraft.prepTime) : undefined,
      cook_time_min: recipeDraft.cookTime ? Number(recipeDraft.cookTime) : undefined,
    };

    setRecipeOverrides((prev) => ({ ...prev, [key]: updated }));
    setEditingKey(null);
    setRecipeDraft(null);
    Alert.alert('Recipe updated', 'Your custom version is ready.');
  };

  const toggleSaveRecipe = async (key: string, recipe: RecipeData) => {
    const recipeId = recipe.id;

    if (recipeId && isSavedRecipe(recipeId)) {
      await removeRecipe(recipeId);
      Alert.alert('Removed', 'Recipe removed from your saved list.');
      return;
    }

    if (recipeId) {
      await saveRecipe(recipeId);
      Alert.alert('Saved', 'Recipe added to your saved list.');
      return;
    }

    const createdId = await saveGeneratedRecipe({
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      servings: recipe.servings,
      prep_time_min: recipe.prep_time_min,
      cook_time_min: recipe.cook_time_min,
    });

    if (createdId) {
      setRecipeOverrides((prev) => ({
        ...prev,
        [key]: { ...recipe, id: createdId },
      }));
      Alert.alert('Saved', 'Recipe added to your saved list.');
      return;
    }

    Alert.alert('Save failed', 'Unable to save recipe right now. Please try again.');
  };

  const showQuestToast = (message: string) => {
    setQuestToast(message);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setQuestToast(null));
  };

  const normalizedMessages = useMemo(
    () =>
      deferredMessages.map((msg) =>
        msg.role === 'assistant'
          ? {
              ...msg,
              normalized: normalizeAssistantPayload({
                content: msg.content,
                recipe: msg.recipe,
                swaps: msg.swaps,
                nutrition: msg.nutrition,
              }),
            }
          : { ...msg, normalized: null }
      ),
    [deferredMessages]
  );

  const conversationData = useMemo(
    () => normalizedMessages.map((msg, index) => ({ ...msg, key: String(index), index })),
    [normalizedMessages]
  );

  useEffect(() => {
    if (!conversationData.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [conversationData.length, isLoading]);

  return (
    <ScreenContainer padded={false}>
      <View
        style={{ flex: 1, paddingBottom: keyboardVisible ? Math.max(0, keyboardHeight - insets.bottom) : 0 }}
      >
        <View
          pointerEvents="none"
          style={[
            styles.backgroundGlow,
            {
              backgroundColor: theme.primaryMuted,
              top: -40,
              left: -80,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.backgroundGlow,
            styles.backgroundGlowSecondary,
            {
              backgroundColor: theme.infoMuted,
              bottom: composerLift + 32,
              right: -100,
            },
          ]}
        />
        {/* Header */}
        <View style={[styles.headerShell, { borderBottomColor: theme.border + '99' }]}>
          <View style={[styles.header, { maxWidth: maxContentWidth }]}>
            <View style={styles.headerContent}>
              <LinearGradient
                colors={theme.gradient.primary}
                style={styles.headerIcon}
              >
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Healthify</Text>
                <Text
                  style={[
                    styles.headerSubtitle,
                    isCompact && styles.headerSubtitleCompact,
                    { color: theme.textTertiary },
                  ]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  Whole-food swaps, cleaner recipes, better macros
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.savedPill,
                isCompact && styles.savedPillCompact,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border, marginLeft: Spacing.xs },
              ]}
              onPress={() => router.push('/saved')}
              activeOpacity={0.75}
            >
              <Ionicons name="bookmark" size={14} color={theme.primary} />
              <Text style={[styles.savedPillText, { color: theme.text }]}>
                Saved {savedRecipes.length}
              </Text>
            </TouchableOpacity>
            {messages.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.savedPill,
                  isCompact && styles.savedPillCompact,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border, marginLeft: Spacing.xs },
                ]}
                onPress={clearChat}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={14} color={theme.primary} />
                <Text style={[styles.savedPillText, { color: theme.text }]}>New</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {questToast ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.questToast,
              {
                backgroundColor: theme.primary,
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="trophy" size={14} color="#fff" />
            <Text style={styles.questToastText}>{questToast}</Text>
          </Animated.View>
        ) : null}

        {/* Messages */}
        <FlatList
          ref={listRef}
          style={styles.messages}
          data={conversationData}
          keyExtractor={(item) => item.key}
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          removeClippedSubviews={Platform.OS === 'android'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingBottom: composerLift + 28,
            },
          ]}
          ListHeaderComponent={showSavedRecipes && savedRecipes.length > 0 ? (
            <Card style={[styles.savedListCard, styles.contentColumn, { maxWidth: maxContentWidth }]} padding={Spacing.md}>
              <Text style={[styles.savedListTitle, { color: theme.text }]}>Saved on this device</Text>
              {savedRecipes.map((saved) => (
                <View key={saved.id} style={[styles.savedListItem, { borderBottomColor: theme.border }]}>
                  <TouchableOpacity
                    onPress={() => router.push(`/saved/${encodeURIComponent(saved.id)}`)}
                    activeOpacity={0.7}
                    style={{ flex: 1 }}
                  >
                    <Text style={[styles.savedTitle, { color: theme.text }]}>{saved.title}</Text>
                    <Text style={[styles.savedMeta, { color: theme.textTertiary }]}>
                      {(saved.ingredients || []).length} ingredients
                      {saved.servings ? ` • ${saved.servings} servings` : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeRecipe(saved.id)}
                    style={[styles.iconBtn, { backgroundColor: theme.surfaceHighlight }]}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ) : null}
          ListEmptyComponent={
            <View style={[styles.emptyState, { maxWidth: introWidth, alignSelf: 'center' }]}>
              <LinearGradient
                colors={theme.gradient.hero}
                style={styles.emptyIcon}
              >
                <Ionicons name="nutrition" size={32} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.emptyEyebrow, { color: theme.primary }]}>Healthify AI</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                What are you craving?
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  isCompact && styles.emptySubtitleCompact,
                  { color: theme.textSecondary },
                ]}
              >
                Drop in any comfort food and get a cleaner whole-food version with smarter swaps, a full recipe, and clearer nutrition tradeoffs.
              </Text>

              <View style={[styles.emptyPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.suggestionsTitle, { color: theme.textTertiary }]}>
                  Quick starts
                </Text>
                <View style={styles.suggestionsGrid}>
                  {suggestions.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleSuggestion(s)}
                      activeOpacity={0.7}
                      style={[styles.suggestionChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                    >
                      <Text style={[styles.suggestionText, { color: theme.textSecondary }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => {
              const msg = item;
              const payload = msg.normalized;
              const key = recipeKeyFor(msg.index);
              const recipe = payload?.recipe ? recipeOverrides[key] || payload.recipe : null;
              const isEditing = editingKey === key;
              const isSaved = recipe?.id ? isSavedRecipe(recipe.id) : false;
              const ingredientState = checkedIngredients[key] || [];
              const isNewest = msg.index === conversationData.length - 1;
              const shouldAnimate = isNewest && msg.role === 'assistant';

              return (
                <ChatBubbleEntrance
                  enabled={shouldAnimate}
                  style={
                    msg.role === 'user'
                      ? [styles.messageBubble, styles.userBubble, { maxWidth: bubbleMaxWidth }]
                      : [styles.messageBubble, styles.assistantBubble]
                  }
                >
                {msg.role === 'assistant' && (
                  <View style={styles.assistantHeader}>
                    <LinearGradient colors={theme.gradient.primary} style={styles.miniIcon}>
                      <Ionicons name="sparkles" size={10} color="#FFF" />
                    </LinearGradient>
                    <Text style={[styles.assistantLabel, { color: theme.primary }]}>Healthify AI</Text>
                  </View>
                )}
                {msg.role === 'user' ? (
                  <LinearGradient
                    colors={['#22C55E', '#16A34A'] as const}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubbleContent, styles.userBubbleContent]}
                  >
                    <Text style={[styles.messageText, { color: '#FFFFFF' }]}>
                      {payload?.message || msg.content}
                    </Text>
                  </LinearGradient>
                ) : (msg as any).isError ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (lastUserInputRef.current && !isLoading) {
                        void submitChatMessage(lastUserInputRef.current);
                      }
                    }}
                    style={[
                      styles.bubbleContent,
                      styles.errorBubble,
                      { backgroundColor: theme.error + '14', borderWidth: 1, borderColor: theme.error + '40' },
                    ]}
                  >
                    <View style={styles.errorRow}>
                      <Ionicons name="warning-outline" size={16} color={theme.error} />
                      <Text style={[styles.messageText, { color: theme.error, flex: 1 }]}>
                        {payload?.message || msg.content}
                      </Text>
                    </View>
                    <View style={styles.retryRow}>
                      <Ionicons name="refresh" size={13} color={theme.textTertiary} />
                      <Text style={[styles.retryText, { color: theme.textTertiary }]}>Tap to retry</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.bubbleContent,
                      { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.messageText, { color: theme.text }]}>
                      {payload?.message || msg.content}
                    </Text>
                  </View>
                )}

                {/* Recipe Card */}
                {recipe && (
                  <RecipeCardShimmer enabled={shouldAnimate}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      useRecipeViewStore.getState().set({
                        recipe,
                        swaps: payload?.swaps || null,
                        nutrition: payload?.nutrition || null,
                        mesScore: msg.mes_score || null,
                      });
                      router.push('/chat-recipe');
                    }}
                  >
                    <Card style={styles.recipeCard} padding={Spacing.md}>
                      <View style={styles.recipeHeader}>
                        <View style={styles.recipeHeaderLeft}>
                          <Ionicons name="restaurant" size={16} color={theme.primary} style={{ marginTop: 3 }} />
                          <Text style={[styles.recipeName, { color: theme.text, flex: 1 }]}>
                            {recipe.title || 'Healthified Recipe'}
                          </Text>
                        </View>
                        <View style={styles.recipeActions}>
                          <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: theme.surfaceHighlight }]}
                            onPress={() => toggleSaveRecipe(key, recipe)}
                          >
                            <Ionicons
                              name={isSaved ? 'bookmark' : 'bookmark-outline'}
                              size={16}
                              color={isSaved ? theme.primary : theme.textSecondary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: theme.surfaceHighlight }]}
                            onPress={() =>
                              isEditing ? cancelRecipeEdit() : startRecipeEdit(key, recipe)
                            }
                          >
                            <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                    {!!cleanRecipeDescription(recipe.description) && (
                      <Text style={[styles.recipeDescription, { color: theme.textSecondary }]}>
                        {cleanRecipeDescription(recipe.description)}
                      </Text>
                    )}

                    <View style={styles.metaRow}>
                      {recipe.servings ? (
                        <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
                          <Ionicons name="people-outline" size={12} color={theme.textTertiary} />
                          <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>
                            {recipe.servings} servings
                          </Text>
                        </View>
                      ) : null}
                      {recipe.prep_time_min != null || recipe.cook_time_min != null ? (
                        <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
                          <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                          <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>
                            {(recipe.prep_time_min || 0) + (recipe.cook_time_min || 0)} min
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {msg.mes_score && msg.mes_score.meal_score != null && (
                      <View style={styles.mesBadgeRow}>
                        {(() => {
                          const tc = getTierConfig(msg.mes_score.meal_tier);
                          return (
                            <>
                              <MesBadgePopIn delay={shouldAnimate ? 400 : 0}>
                              <View style={[styles.mesPill, { backgroundColor: tc.color + '20' }]}>
                                <Ionicons name={tc.icon as any} size={11} color={tc.color} />
                                <Text style={[styles.mesPillText, { color: tc.color }]}>
                                  This meal: {Math.round(msg.mes_score.meal_score)} MES
                                </Text>
                              </View>
                              </MesBadgePopIn>
                              {msg.mes_score.projected_daily_score != null && (() => {
                                const dtc = getTierConfig(msg.mes_score.projected_daily_tier || msg.mes_score.meal_tier);
                                return (
                                  <MesBadgePopIn delay={shouldAnimate ? 550 : 0}>
                                  <View style={[styles.mesPill, { backgroundColor: dtc.color + '15' }]}>
                                    <Ionicons name="today-outline" size={11} color={dtc.color} />
                                    <Text style={[styles.mesPillText, { color: dtc.color }]}>
                                      Your day: {Math.round(msg.mes_score.projected_daily_score)} MES
                                    </Text>
                                  </View>
                                  </MesBadgePopIn>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </View>
                    )}

                    {isEditing && recipeDraft ? (
                      <View style={styles.editPanel}>
                        <Text style={[styles.recipeSectionTitle, { color: theme.textSecondary }]}>Customize recipe</Text>
                        <TextInput
                          style={[styles.editInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                          value={recipeDraft.title}
                          onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, title: value } : prev))}
                          placeholder="Recipe title"
                          placeholderTextColor={theme.textTertiary}
                        />
                        <TextInput
                          style={[styles.editInput, styles.editMultiline, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                          value={recipeDraft.description}
                          onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, description: value } : prev))}
                          placeholder="Description"
                          placeholderTextColor={theme.textTertiary}
                          multiline
                        />
                        <View style={styles.editRow}>
                          <TextInput
                            style={[styles.editInput, styles.smallEdit, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                            value={recipeDraft.servings}
                            onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, servings: value } : prev))}
                            placeholder="Servings"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                          />
                          <TextInput
                            style={[styles.editInput, styles.smallEdit, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                            value={recipeDraft.prepTime}
                            onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, prepTime: value } : prev))}
                            placeholder="Prep min"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                          />
                          <TextInput
                            style={[styles.editInput, styles.smallEdit, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                            value={recipeDraft.cookTime}
                            onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, cookTime: value } : prev))}
                            placeholder="Cook min"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                          />
                        </View>
                        <Text style={[styles.editHint, { color: theme.textTertiary }]}>
                          Ingredients: one item per line (example: 2 cups rolled oats)
                        </Text>
                        <TextInput
                          style={[styles.editInput, styles.editMultiline, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                          value={recipeDraft.ingredientsText}
                          onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, ingredientsText: value } : prev))}
                          multiline
                        />
                        <Text style={[styles.editHint, { color: theme.textTertiary }]}>
                          Steps: one step per line
                        </Text>
                        <TextInput
                          style={[styles.editInput, styles.editMultiline, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceElevated }]}
                          value={recipeDraft.stepsText}
                          onChangeText={(value) => setRecipeDraft((prev) => (prev ? { ...prev, stepsText: value } : prev))}
                          multiline
                        />
                        <View style={styles.editActions}>
                          <Button title="Cancel" size="sm" variant="ghost" onPress={cancelRecipeEdit} />
                          <Button title="Apply changes" size="sm" onPress={() => applyRecipeEdit(key)} />
                        </View>
                      </View>
                    ) : null}

                    {recipe.ingredients.length > 0 && (
                      <View style={styles.recipeSection}>
                        <Text style={[styles.recipeSectionTitle, { color: theme.textSecondary }]}>
                          Ingredients
                        </Text>
                        {recipe.ingredients.map((ing, i) => {
                          const checked = !!ingredientState[i];
                          return (
                            <TouchableOpacity
                              key={i}
                              style={styles.ingredientRow}
                              onPress={() =>
                                setCheckedIngredients((prev) => {
                                  const arr = [...(prev[key] || [])];
                                  arr[i] = !arr[i];
                                  return { ...prev, [key]: arr };
                                })
                              }
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.checkCircle,
                                  {
                                    borderColor: checked ? theme.primary : theme.borderLight,
                                    backgroundColor: checked ? theme.primary : 'transparent',
                                  },
                                ]}
                              >
                                {checked ? <Ionicons name="checkmark" size={11} color="#FFFFFF" /> : null}
                              </View>
                              <Text
                                style={[
                                  styles.ingredientItem,
                                  {
                                    color: checked ? theme.textTertiary : theme.textSecondary,
                                    textDecorationLine: checked ? 'line-through' : 'none',
                                  },
                                ]}
                              >
                                {formatIngredientDisplayLine(ing)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                    {recipe.steps.length > 0 && (
                      <View style={styles.recipeSection}>
                        <Text style={[styles.recipeSectionTitle, { color: theme.textSecondary }]}>
                          Steps
                        </Text>
                        {recipe.steps.map((step: string, i: number) => (
                          <Text key={i} style={[styles.stepItem, { color: theme.textSecondary }]}>
                            {i + 1}. {step}
                          </Text>
                        ))}
                      </View>
                    )}
                    </Card>
                  </TouchableOpacity>
                  </RecipeCardShimmer>
                )}

                {/* Swaps */}
                {payload?.swaps && payload.swaps.length > 0 && (
                  <Card style={styles.swapsCard} padding={Spacing.md}>
                    <View style={styles.swapsHeader}>
                      <Ionicons name="swap-horizontal" size={16} color={theme.accent} />
                      <Text style={[styles.recipeName, { color: theme.text }]}>
                        Ingredient Swaps
                      </Text>
                    </View>
                    {payload.swaps.map((swap: any, i: number) => (
                      <View key={i} style={[styles.swapItem, { borderBottomColor: theme.border }]}>
                        <View style={styles.swapNames}>
                          <Text style={[styles.swapLabel, { color: theme.textTertiary }]}>Instead of</Text>
                          <Text style={[styles.swapOld, { color: theme.error }]}>
                            {swap.original}
                          </Text>
                          <View style={styles.swapArrowRow}>
                            <View style={[styles.swapArrowLine, { backgroundColor: theme.border }]} />
                            <Ionicons name="arrow-down" size={14} color={theme.textTertiary} />
                            <View style={[styles.swapArrowLine, { backgroundColor: theme.border }]} />
                          </View>
                          <Text style={[styles.swapLabel, { color: theme.textTertiary }]}>Use</Text>
                          <Text style={[styles.swapNew, { color: theme.primary }]}>
                            {swap.replacement}
                          </Text>
                        </View>
                        <Text style={[styles.swapReason, { color: theme.textTertiary }]}>
                          {swap.reason}
                        </Text>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Nutrition Comparison */}
                {payload?.nutrition?.original_estimate && payload?.nutrition?.healthified_estimate && (
                  <Card style={styles.swapsCard} padding={Spacing.md}>
                    <View style={styles.swapsHeader}>
                      <Ionicons name="analytics-outline" size={16} color={theme.primary} />
                      <Text style={[styles.recipeName, { color: theme.text }]}>
                        Nutrition Impact
                      </Text>
                    </View>
                    <View style={styles.nutritionCompareRow}>
                      <View style={{ flex: 1 }} />
                      <Text style={[styles.nutritionColumnLabel, { color: theme.textTertiary }]}>Original</Text>
                      <Text style={[styles.nutritionColumnLabel, { color: theme.primary }]}>Healthified</Text>
                    </View>
                    {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((key) => {
                      const orig = Number(payload.nutrition.original_estimate[key] || 0);
                      const healthified = Number(payload.nutrition.healthified_estimate[key] || 0);
                      const diff = healthified - orig;
                      const unit = key === 'calories' ? '' : 'g';
                      const improved = key === 'protein' || key === 'fiber' ? diff > 0 : diff < 0;
                      return (
                        <View key={key} style={[styles.nutritionCompareRow, { borderTopWidth: 1, borderTopColor: theme.surfaceHighlight, paddingVertical: Spacing.xs + 2 }]}>
                          <Text style={[styles.nutritionMacroLabel, { color: theme.textSecondary }]}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </Text>
                          <Text style={[styles.nutritionValue, { color: theme.textTertiary }]}>
                            {Math.round(orig)}{unit}
                          </Text>
                          <Text style={[styles.nutritionValue, { color: theme.text, fontWeight: '700' }]}>
                            {Math.round(healthified)}{unit}
                            {diff !== 0 && (
                              <Text style={{ color: improved ? theme.primary : theme.error, fontSize: 11 }}>
                                {' '}{diff > 0 ? '+' : ''}{Math.round(diff)}
                              </Text>
                            )}
                          </Text>
                        </View>
                      );
                    })}
                  </Card>
                )}
              </ChatBubbleEntrance>
            );
          }}
          ListFooterComponent={isLoading ? (
            <Animated.View style={[styles.messageBubble, styles.assistantBubble, { width: '100%' }]}>
              <View style={styles.assistantHeader}>
                <LinearGradient colors={theme.gradient.primary} style={styles.miniIcon}>
                  <Ionicons name="sparkles" size={10} color="#FFF" />
                </LinearGradient>
                <Text style={[styles.assistantLabel, { color: theme.primary }]}>Healthify AI</Text>
              </View>
              <View style={[styles.bubbleContent, { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }]}>
                {streamingText ? (
                  <Text style={[styles.messageText, { color: theme.text }]}>
                    {streamingText}
                    <Text style={{ color: theme.primary }}>▍</Text>
                  </Text>
                ) : (
                  <View style={styles.loadingContent}>
                    <TypingIndicator color={theme.primary} iconColor={theme.primary} />
                    <LoadingPhaseText color={theme.textTertiary} />
                  </View>
                )}
              </View>
            </Animated.View>
          ) : null}
        />

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.background + 'F2',
              borderTopColor: 'transparent',
              marginBottom: keyboardVisible ? 0 : composerLift,
              paddingBottom: keyboardVisible ? Spacing.xs : composerBottomInset + 6,
            },
          ]}
        >
          <View
            style={[
              styles.inputCard,
              isCompact && styles.inputCardCompact,
              Shadows.md(isDark),
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                isCompact && styles.textInputCompact,
                {
                  color: theme.text,
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder={isCompact ? 'Describe a food...' : 'Describe a food you want to clean up...'}
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              allowFontScaling={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={input.trim() ? (['#16A34A', '#0D9488'] as const) : [theme.surfaceHighlight, theme.surfaceHighlight]}
                style={[styles.sendButton, isCompact && styles.sendButtonCompact]}
              >
                <Ionicons
                  name="arrow-up"
                  size={isCompact ? 18 : 20}
                  color={input.trim() ? '#FFFFFF' : theme.textTertiary}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backgroundGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    opacity: 0.35,
  },
  backgroundGlowSecondary: {
    width: 220,
    height: 220,
    opacity: 0.22,
  },
  headerShell: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  header: {
    width: '100%',
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    minWidth: 0,
    paddingRight: Spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    marginLeft: Spacing.sm,
  },
  savedPillCompact: {
    paddingHorizontal: Spacing.sm + 2,
  },
  savedPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  questToast: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
  },
  questToastText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
  },
  headerSubtitleCompact: {
    fontSize: 11,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Layout.scrollBottomPadding,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyEyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  emptySubtitleCompact: {
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  emptyPanel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  suggestionsTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  messageBubble: {
    marginBottom: Spacing.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    alignSelf: 'stretch',
    width: '100%',
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  miniIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bubbleContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
  },
  userBubbleContent: {
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  loadingContent: {
    gap: 6,
  },
  errorBubble: {
    gap: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  retryText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  recipeCard: {
    marginTop: Spacing.sm,
    maxWidth: '100%',
  },
  swapsCard: {
    marginTop: Spacing.sm,
    maxWidth: '100%',
  },
  swapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recipeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    flex: 1,
    paddingTop: 2,
  },
  recipeActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeName: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  recipeDescription: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  mesBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  mesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  mesPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  recipeSection: {
    marginTop: Spacing.sm,
  },
  recipeSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  ingredientItem: {
    fontSize: FontSize.sm,
    lineHeight: 22,
    flex: 1,
  },
  stepItem: {
    fontSize: FontSize.sm,
    lineHeight: 22,
    paddingLeft: Spacing.sm,
    marginBottom: 4,
  },
  swapItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  swapNames: {
    gap: 4,
    marginBottom: 6,
  },
  swapArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  swapArrowLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  swapLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  swapOld: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    lineHeight: 20,
  },
  swapNew: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  swapReason: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  nutritionCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nutritionColumnLabel: {
    width: 80,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  nutritionMacroLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  nutritionValue: {
    width: 80,
    fontSize: FontSize.sm,
    textAlign: 'right',
  },
  savedListCard: {
    marginBottom: Spacing.md,
  },
  savedListTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  savedListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    paddingVertical: Spacing.sm,
  },
  savedTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  savedMeta: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPanel: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  editMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  editRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  smallEdit: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  editHint: {
    fontSize: FontSize.xs,
  },
  inputBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  inputCard: {
    width: '100%',
    maxWidth: MAX_CHAT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  inputCardCompact: {
    paddingLeft: Spacing.sm + 2,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    fontSize: FontSize.md,
    textAlignVertical: 'center',
  },
  textInputCompact: {
    minHeight: 40,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
