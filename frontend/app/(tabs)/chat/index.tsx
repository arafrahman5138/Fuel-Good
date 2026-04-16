import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Keyboard,
  Platform,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { Card } from '../../../components/GradientCard';
import { Button } from '../../../components/Button';
import { useTheme } from '../../../hooks/useTheme';
import { useChatStore } from '../../../stores/chatStore';
import { useSavedRecipesStore } from '../../../stores/savedRecipesStore';
import { useGamificationStore } from '../../../stores/gamificationStore';
import { chatApi, type ChatContext } from '../../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../../constants/Colors';
import { ChatHistoryDrawer } from '../../../components/ChatHistoryDrawer';
import { Shadows } from '../../../constants/Shadows';
import { useThemeStore } from '../../../stores/themeStore';
import { TypingIndicator } from '../../../components/TypingIndicator';
import { LoadingPhaseText, SCORE_PHASES, GENERAL_PHASES } from '../../../components/LoadingPhaseText';
import { ChatBubbleEntrance } from '../../../components/ChatBubbleEntrance';
import { RecipeCardShimmer } from '../../../components/RecipeCardShimmer';
import { MesBadgePopIn } from '../../../components/MesBadgePopIn';
import { cleanRecipeDescription } from '../../../utils/recipeDescription';
import { formatIngredientDisplayLine } from '../../../utils/ingredientFormat';
import {
  type RecipeData,
  type RecipeDraft,
  normalizeAssistantPayload,
  parseIngredientLine,
  recipeKeyFor,
  toStringValue,
} from '../../../utils/chatParser';
import { getTierConfig } from '../../../stores/metabolicBudgetStore';
import { useRecipeViewStore } from '../../../stores/recipeViewStore';
import { trackBehaviorEvent } from '../../../services/notifications';

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
  const { prefill, autoSend, chatContext: chatContextParam } = useLocalSearchParams<{ prefill?: string; autoSend?: string; chatContext?: string }>();
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
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [expandedSwaps, setExpandedSwaps] = useState<Record<string, boolean>>({});
  const [expandedNutrition, setExpandedNutrition] = useState<Record<string, boolean>>({});
  const pendingContextRef = useRef<ChatContext | null>(null);
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
  const loadSessions = useChatStore((s) => s.loadSessions);

  const handleNewChat = () => {
    clearChat();
    setInput('');
    setAttachedPhoto(null);
    setEditingKey(null);
    setRecipeDraft(null);
    setRecipeOverrides({});
    setCheckedIngredients({});
    // Scroll to top after state clears and ensure input is reset
    requestAnimationFrame(() => {
      setInput('');
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const sessions = useChatStore((s) => s.sessions);
  const savedRecipes = useSavedRecipesStore((s) => s.recipes);
  const awardXP = useGamificationStore((s) => s.awardXP);
  const saveRecipe = useSavedRecipesStore((s) => s.saveRecipe);
  const saveGeneratedRecipe = useSavedRecipesStore((s) => s.saveGeneratedRecipe);
  const removeRecipe = useSavedRecipesStore((s) => s.removeRecipe);
  const isSavedRecipe = useSavedRecipesStore((s) => s.isSaved);
  const fetchSaved = useSavedRecipesStore((s) => s.fetchSaved);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [attachedPhoto, setAttachedPhoto] = useState<{ uri: string; base64: string } | null>(null);
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
    loadSessions();
    chatApi.getSuggestions().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSuggestions(data.map((s) => s.label || s.query));
      }
    }).catch((err: any) => {
      console.warn('Failed to load chat suggestions:', err?.message);
    });

    // Float animation for empty state icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, [fetchSaved]);

  // Handle deep-link prefill from coach or other screens
  useEffect(() => {
    if (prefill && typeof prefill === 'string' && prefill.trim()) {
      setInput(prefill.trim());
    }
    // Parse and store rich context from deep-links (e.g., scan results)
    if (chatContextParam && typeof chatContextParam === 'string') {
      try {
        const parsed = JSON.parse(chatContextParam);
        pendingContextRef.current = parsed;
      } catch {
        // ignore malformed context
      }
    }
  }, [prefill, chatContextParam]);

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

  const shouldPreferStreaming = (_message: string) => {
    // React Native fetch on iOS does not expose a Web Streams reader, so
    // native builds should use the stable non-streaming path for now.
    return Platform.OS === 'web';
  };

  const addAssistantPayload = (payload: any) => {
    const rawRecipe = payload?.healthified_recipe || payload?.recipe;
    if (!rawRecipe) {
      console.warn('[Healthify] No recipe in payload:', JSON.stringify(payload)?.slice(0, 300));
    }
    const normalized = normalizeAssistantPayload({
      content: payload?.message?.content || payload?.message || '',
      recipe: rawRecipe,
      swaps: payload?.ingredient_swaps || payload?.swaps,
      nutrition: payload?.nutrition_comparison || payload?.nutrition,
    });
    if (!normalized.recipe) {
      console.warn('[Healthify] normalizeAssistantPayload returned no recipe. Content preview:', (payload?.message?.content || payload?.message || '').slice(0, 200));
    }
    addMessage({
      role: 'assistant',
      content: normalized.message,
      recipe: normalized.recipe,
      swaps: normalized.swaps,
      nutrition: normalized.nutrition,
      mes_score: payload?.mes_score || null,
    });
  };

  const submitChatMessage = async (userMessage: string, chatContext?: ChatContext) => {
    lastUserInputRef.current = userMessage;
    const ctx = chatContext ?? pendingContextRef.current ?? undefined;
    pendingContextRef.current = null;
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
            if (done?.payload) {
              // Fallback: if backend returned no recipe, try parsing from the raw streamed text
              const hasRecipe = done.payload.recipe || done.payload.healthified_recipe;
              if (!hasRecipe) {
                const rawText = useChatStore.getState().streamingText;
                if (rawText) {
                  const fallback = normalizeAssistantPayload({ content: rawText });
                  if (fallback.recipe) {
                    done.payload.recipe = fallback.recipe;
                    if (fallback.message) done.payload.message = fallback.message;
                    if (fallback.swaps?.length) done.payload.swaps = fallback.swaps;
                    if (fallback.nutrition) done.payload.nutrition = fallback.nutrition;
                  }
                }
              }
              addAssistantPayload(done.payload);
            }
          },
          ctx,
        );
      } else {
        const response = await chatApi.healthify(userMessage, sessionId || undefined, ctx);
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
          : "Something went wrong. Tap to try again.";
      addMessage({ role: 'assistant', content: friendlyMessage, isError: true } as any);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', `Please allow ${source} access to attach photos.`);
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.6, mediaTypes: ['images'], base64: true })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.6, mediaTypes: ['images'], base64: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.base64) {
        setAttachedPhoto({ uri: asset.uri, base64: asset.base64 });
      }
    } catch (err: any) {
      Alert.alert('Unable to access photos', err?.message || 'Photo permissions may be missing.');
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Attach Photo', 'Take a photo or choose from your library', [
      { text: 'Camera', onPress: () => pickPhoto('camera') },
      { text: 'Photo Library', onPress: () => pickPhoto('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedPhoto) || isLoading) return;
    const userMessage = input.trim() || (attachedPhoto ? 'What do you see in this photo?' : '');
    setInput('');
    Keyboard.dismiss();
    const photoCtx: ChatContext | undefined = attachedPhoto
      ? { source: 'photo', image_base64: attachedPhoto.base64, image_type: 'auto' }
      : undefined;
    setAttachedPhoto(null);
    await submitChatMessage(userMessage, photoCtx);
  };

  const handleSuggestion = (suggestion: string) => {
    trackBehaviorEvent('healthify_suggestion_tapped', { suggestion });
    Keyboard.dismiss();
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

  const handleSelectSession = async (sessionId: string) => {
    try {
      const detail = await chatApi.getSession(sessionId);
      useChatStore.getState().clearChat();
      useChatStore.getState().setSessionId(sessionId);
      if (detail?.messages?.length > 0) {
        detail.messages.forEach((m: any) => useChatStore.getState().addMessage(m));
      }
    } catch (err) {
      console.warn('Failed to load session:', err);
    }
  };

  const handleReportMessage = (messageContent: string) => {
    const submitReport = (reason: 'harmful' | 'inaccurate' | 'inappropriate' | 'other') => {
      chatApi
        .reportMessage({
          session_id: sessionId || null,
          message_content: messageContent,
          reason,
        })
        .then(() => {
          Alert.alert(
            'Report submitted',
            "Thanks for letting us know. We'll review this response.",
          );
        })
        .catch(() => {
          Alert.alert(
            'Report received',
            "Thanks — we've noted the issue. Please email support@fuelgood.app if this keeps happening.",
          );
        });
    };
    Alert.alert(
      'Report this response',
      'What went wrong?',
      [
        { text: 'Harmful or unsafe', onPress: () => submitReport('harmful') },
        { text: 'Inaccurate information', onPress: () => submitReport('inaccurate') },
        { text: 'Inappropriate content', onPress: () => submitReport('inappropriate') },
        { text: 'Something else', onPress: () => submitReport('other') },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const handleDeleteSession = (id: string) => {
    Alert.alert(
      'Delete Chat',
      'This will permanently remove this conversation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatApi.deleteSession(id);
              loadSessions();
              if (sessionId === id) {
                clearChat();
              }
            } catch (err) {
              console.warn('Failed to delete session:', err);
            }
          },
        },
      ],
    );
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
    // Find the last user message index so the response starts visible near the top
    const lastUserIdx = [...conversationData].reverse().findIndex((m) => m.role === 'user');
    const targetIdx = lastUserIdx >= 0 ? conversationData.length - 1 - lastUserIdx : conversationData.length - 1;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0 });
      } catch {
        listRef.current?.scrollToEnd({ animated: true });
      }
    });
  }, [conversationData.length, isLoading]);

  return (
    <ScreenContainer padded={false}>
      <View
        style={{ flex: 1, paddingBottom: keyboardVisible ? Math.max(0, keyboardHeight - insets.bottom) : 0 }}
      >
        {/* Header */}
        <View style={[styles.headerShell, { borderBottomColor: theme.border + '99' }]}>
          <View style={[styles.header, { maxWidth: maxContentWidth }]}>
            {/* History Button */}
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => { loadSessions(); setShowHistory(true); }}
              activeOpacity={0.75}
            >
              <Ionicons name="menu" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <LinearGradient
                colors={theme.gradient.hero}
                style={styles.headerIcon}
              >
                <Ionicons name="nutrition" size={18} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Fuel Coach</Text>
                <Text
                  style={[
                    styles.headerSubtitle,
                    isCompact && styles.headerSubtitleCompact,
                    { color: theme.textTertiary },
                  ]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                >
                  {isCompact ? 'Your AI nutrition coach' : 'Recipes, swaps, nutrition advice & more'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.savedPill,
                isCompact && styles.savedPillCompact,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}
              onPress={() => router.push('/(tabs)/meals/saved')}
              activeOpacity={0.75}
            >
              <Ionicons name="bookmark" size={14} color={theme.primary} />
              {!isCompact && (
                <Text style={[styles.savedPillText, { color: theme.text }]}>
                  {savedRecipes.length}
                </Text>
              )}
            </TouchableOpacity>
            {messages.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.savedPill,
                  isCompact && styles.savedPillCompact,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border, marginLeft: Spacing.xs },
                ]}
                onPress={handleNewChat}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={16} color={theme.primary} />
                {!isCompact && <Text style={[styles.savedPillText, { color: theme.text }]}>New</Text>}
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
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 });
            }, 200);
          }}
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
                    onPress={() => router.push(`/(tabs)/meals/saved-recipe/${encodeURIComponent(saved.id)}`)}
                    activeOpacity={0.7}
                    style={{ flex: 1 }}
                  >
                    <Text style={[styles.savedTitle, { color: theme.text }]}>{saved.title}</Text>
                    <Text style={[styles.savedMeta, { color: theme.textTertiary }]}>
                      {(saved.ingredients || []).length} ingredients
                      {saved.servings ? ` • ${saved.servings} ${saved.servings === 1 ? 'serving' : 'servings'}` : ''}
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
              <Animated.View
                style={{
                  transform: [
                    {
                      translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8],
                      }),
                    },
                  ],
                }}
              >
                <LinearGradient
                  colors={theme.gradient.hero}
                  style={styles.emptyIcon}
                >
                  <Ionicons name="nutrition" size={32} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>
              <Text style={[styles.emptyEyebrow, { color: theme.primary }]}>Fuel Coach</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Your kitchen assistant
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  isCompact && styles.emptySubtitleCompact,
                  { color: theme.textSecondary },
                ]}
              >
                Ask for a healthier version of any meal, get recipes from what's in your fridge, or ask me anything about nutrition.
              </Text>

              <View style={[styles.emptyPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.emptyPanelHeader}>
                  <Ionicons name="flash" size={13} color={theme.primary} />
                  <Text style={[styles.suggestionsTitle, { color: theme.textTertiary }]}>
                    Quick starts
                  </Text>
                </View>
                <View style={styles.suggestionsGrid}>
                  {suggestions.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleSuggestion(s)}
                      activeOpacity={0.7}
                      style={[styles.suggestionChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border + 'CC' }]}
                    >
                      <Ionicons name="sparkles" size={12} color={theme.primary} />
                      <Text style={[styles.suggestionText, { color: theme.text }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Utility chips */}
                <View style={[styles.utilitySeparator, { borderTopColor: theme.border }]} />
                <View style={styles.suggestionsGrid}>
                  {[
                    { label: "What's in my fridge?", icon: 'cube-outline' as const, query: "What can I make with what's in my fridge?" },
                    { label: 'Explain my score', icon: 'analytics-outline' as const, query: "Explain my fuel score today" },
                    { label: 'Quick 15-min meal', icon: 'time-outline' as const, query: `Give me a healthy 15 minute ${(() => { const h = new Date().getHours(); if (h >= 5 && h < 10) return 'breakfast'; if (h >= 10 && h < 15) return 'lunch'; if (h >= 15 && h < 18) return 'snack'; return 'dinner'; })()}` },
                  ].map((chip, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleSuggestion(chip.query)}
                      activeOpacity={0.7}
                      style={[styles.suggestionChip, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '30' }]}
                    >
                      <Ionicons name={chip.icon} size={12} color={theme.primary} />
                      <Text style={[styles.suggestionText, { color: theme.primary }]}>{chip.label}</Text>
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
                {/* Assistant avatar removed for cleaner look */}
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
                    <TouchableOpacity
                      onPress={() => handleReportMessage(payload?.message || msg.content || '')}
                      accessibilityRole="button"
                      accessibilityLabel="Report this response"
                      hitSlop={8}
                      style={styles.reportButton}
                    >
                      <Ionicons name="flag-outline" size={11} color={theme.textTertiary} />
                      <Text style={[styles.reportButtonText, { color: theme.textTertiary }]}>Report</Text>
                    </TouchableOpacity>
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
                      router.push('/(tabs)/chat/recipe');
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
                      <Text style={[styles.recipeDescription, { color: theme.textSecondary }]} numberOfLines={4}>
                        {cleanRecipeDescription(recipe.description)}
                      </Text>
                    )}

                    <View style={styles.metaRow}>
                      {recipe.servings ? (
                        <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
                          <Ionicons name="people-outline" size={12} color={theme.textTertiary} />
                          <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>
                            {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
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
                          const isLowMes = msg.mes_score.meal_score < 50;
                          const isSnackOrDessert = recipe && /brownie|cookie|cake|muffin|bar|treat|snack|dessert|sweet|chocolate/i.test(recipe.title || '');
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
                              {isLowMes && isSnackOrDessert && (
                                <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                                  Desserts naturally score lower — your main meals balance it out.
                                </Text>
                              )}
                              {msg.mes_score.projected_daily_score != null && !isSnackOrDessert && (() => {
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
                        <TouchableOpacity
                          onPress={() => setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }))}
                          activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <Text style={[styles.recipeSectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>
                            Steps
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs }}>{recipe.steps.length} steps</Text>
                            <Ionicons name={expandedSteps[key] ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textTertiary} />
                          </View>
                        </TouchableOpacity>
                        {expandedSteps[key] && recipe.steps.map((step: string, i: number) => (
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
                    <TouchableOpacity
                      onPress={() => setExpandedSwaps((prev) => ({ ...prev, [key]: !prev[key] }))}
                      activeOpacity={0.7}
                      style={styles.swapsHeader}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="swap-horizontal" size={16} color={theme.accent} />
                        <Text style={[styles.recipeName, { color: theme.text }]}>
                          Ingredient Swaps
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs }}>{payload.swaps.length}</Text>
                        <Ionicons name={expandedSwaps[key] ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textTertiary} />
                      </View>
                    </TouchableOpacity>
                    {expandedSwaps[key] && payload.swaps.map((swap: any, i: number) => (
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

                {/* Contextual Action Chips */}
                {recipe && isNewest && !isLoading && (
                  <View style={styles.contextChipsRow}>
                    {[
                      { label: 'Healthify', icon: 'leaf-outline' as const, query: `Make the ${recipe.title} healthier — swap any processed ingredients for whole-food alternatives and improve the MES score` },
                      { label: 'Higher protein', icon: 'barbell-outline' as const, query: `Make the ${recipe.title} higher protein while keeping it delicious` },
                      { label: 'Save recipe', icon: 'bookmark-outline' as const, onPress: () => toggleSaveRecipe(key, recipe) },
                    ].map((chip, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.contextChip, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '30' }]}
                        onPress={chip.onPress ?? (() => {
                          setInput(chip.query || '');
                          setTimeout(() => {
                            setInput('');
                            void submitChatMessage(chip.query || '');
                          }, 0);
                        })}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={chip.icon} size={12} color={theme.primary} />
                        <Text style={[styles.contextChipText, { color: theme.primary }]}>{chip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Nutrition Comparison */}
                {payload?.nutrition?.original_estimate && payload?.nutrition?.healthified_estimate && (
                  <Card style={styles.swapsCard} padding={Spacing.md}>
                    <TouchableOpacity
                      onPress={() => setExpandedNutrition((prev) => ({ ...prev, [key]: !prev[key] }))}
                      activeOpacity={0.7}
                      style={styles.swapsHeader}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="analytics-outline" size={16} color={theme.primary} />
                        <Text style={[styles.recipeName, { color: theme.text }]}>
                          Nutrition Impact
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {(() => {
                          const calDiff = Number(payload.nutrition.healthified_estimate.calories || 0) - Number(payload.nutrition.original_estimate.calories || 0);
                          const protDiff = Number(payload.nutrition.healthified_estimate.protein || 0) - Number(payload.nutrition.original_estimate.protein || 0);
                          return (
                            <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs }}>
                              {calDiff <= 0 ? calDiff : `+${calDiff}`} cal, {protDiff >= 0 ? `+${protDiff}` : protDiff}g protein
                            </Text>
                          );
                        })()}
                        <Ionicons name={expandedNutrition[key] ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textTertiary} />
                      </View>
                    </TouchableOpacity>
                    {expandedNutrition[key] && (
                      <>
                        <View style={styles.nutritionCompareRow}>
                          <View style={{ flex: 1 }} />
                          <Text style={[styles.nutritionColumnLabel, { color: theme.textTertiary }]}>Original</Text>
                          <Text style={[styles.nutritionColumnLabel, { color: theme.primary }]}>Healthified</Text>
                        </View>
                        {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((macroKey) => {
                          const orig = Number((payload.nutrition.original_estimate as any)[macroKey] || 0);
                          const healthified = Number((payload.nutrition.healthified_estimate as any)[macroKey] || 0);
                          const diff = healthified - orig;
                          const unit = macroKey === 'calories' ? '' : 'g';
                          const improved = macroKey === 'protein' || macroKey === 'fiber' ? diff > 0 : diff < 0;
                          return (
                            <View key={macroKey} style={[styles.nutritionCompareRow, { borderTopWidth: 1, borderTopColor: theme.surfaceHighlight, paddingVertical: Spacing.xs + 2 }]}>
                              <Text style={[styles.nutritionMacroLabel, { color: theme.textSecondary }]}>
                                {macroKey.charAt(0).toUpperCase() + macroKey.slice(1)}
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
                      </>
                    )}
                  </Card>
                )}
              </ChatBubbleEntrance>
            );
          }}
          ListFooterComponent={isLoading ? (
            <Animated.View style={[styles.messageBubble, styles.assistantBubble, { width: '100%' }]}>
              {/* Assistant avatar removed for cleaner look */}
              <View style={[styles.bubbleContent, { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }]}>
                {streamingText ? (
                  streamingText.trimStart().startsWith('{') || streamingText.trimStart().startsWith('```') ? (
                    <View style={styles.loadingContent}>
                      <TypingIndicator color={theme.primary} iconColor={theme.primary} />
                      <Text style={[styles.messageText, { color: theme.textTertiary, fontStyle: 'italic' }]}>
                        Crafting your recipe...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.messageText, { color: theme.text }]}>
                      {streamingText}
                      <Text style={{ color: theme.primary }}>▍</Text>
                    </Text>
                  )
                ) : (
                  <View style={styles.loadingContent}>
                    <TypingIndicator color={theme.primary} iconColor={theme.primary} />
                    <LoadingPhaseText
                      color={theme.textTertiary}
                      phases={
                        /\b(score|fuel|mes|explain)\b/i.test(lastUserInputRef.current)
                          ? SCORE_PHASES
                          : /\?/.test(lastUserInputRef.current) && !/\b(make|cook|recipe|meal|give me|healthy)\b/i.test(lastUserInputRef.current)
                            ? GENERAL_PHASES
                            : undefined
                      }
                    />
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
          {/* Photo Preview */}
          {attachedPhoto && (
            <View style={styles.photoPreviewRow}>
              <Image source={{ uri: attachedPhoto.uri }} style={styles.photoPreviewThumb} />
              <Text style={[styles.photoPreviewLabel, { color: theme.textSecondary }]} numberOfLines={1}>Photo attached</Text>
              <TouchableOpacity onPress={() => setAttachedPhoto(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            {keyboardVisible && (
              <TouchableOpacity
                onPress={() => Keyboard.dismiss()}
                activeOpacity={0.7}
                style={styles.keyboardDismissBtn}
              >
                <Ionicons name="chevron-down-outline" size={22} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          <View
            style={[
              styles.inputCard,
              isCompact && styles.inputCardCompact,
              Shadows.md(isDark),
              { backgroundColor: theme.surface, borderColor: theme.border, flex: 1 },
            ]}
          >
            <TouchableOpacity
              onPress={showPhotoOptions}
              disabled={isLoading}
              activeOpacity={0.7}
              style={styles.photoButton}
            >
              <Ionicons
                name="camera-outline"
                size={isCompact ? 20 : 22}
                color={attachedPhoto ? theme.primary : theme.textTertiary}
              />
            </TouchableOpacity>
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
              placeholder={attachedPhoto ? "Describe what's in the photo..." : "Ask about any food..."}
              placeholderTextColor={theme.textTertiary}
              multiline
              blurOnSubmit
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              maxFontSizeMultiplier={1.4}
            />
            <Pressable
              onPress={handleSend}
              disabled={(!input.trim() && !attachedPhoto) || isLoading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Send message"
              testID="send-button"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <LinearGradient
                colors={(input.trim() || attachedPhoto) ? (['#16A34A', '#0D9488'] as const) : [theme.surfaceHighlight, theme.surfaceHighlight]}
                style={[styles.sendButton, isCompact && styles.sendButtonCompact]}
                pointerEvents="none"
              >
                <Ionicons
                  name="arrow-up"
                  size={isCompact ? 18 : 20}
                  color={(input.trim() || attachedPhoto) ? '#FFFFFF' : theme.textTertiary}
                />
              </LinearGradient>
            </Pressable>
          </View>
          </View>
        </View>
      </View>

      {/* Session History Drawer */}
      <ChatHistoryDrawer
        visible={showHistory}
        sessions={sessions}
        currentSessionId={sessionId}
        onClose={() => setShowHistory(false)}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        onSelectPrompt={(prompt) => { handleNewChat(); setInput(prompt); }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backgroundGlow: {
    position: 'absolute',
    width: Math.min(260, Dimensions.get('window').width * 0.65),
    height: Math.min(260, Dimensions.get('window').width * 0.65),
    borderRadius: 999,
    opacity: 0.35,
  },
  backgroundGlowSecondary: {
    width: Math.min(220, Dimensions.get('window').width * 0.55),
    height: Math.min(220, Dimensions.get('window').width * 0.55),
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
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
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
  emptyPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: Spacing.sm,
  },
  utilitySeparator: {
    borderTopWidth: 1,
    marginVertical: Spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  contextChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  contextChipText: {
    fontSize: 12,
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
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 8,
    opacity: 0.6,
  },
  reportButtonText: {
    fontSize: 11,
    fontWeight: '500',
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
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
  },
  swapNames: {
    gap: 2,
    marginBottom: 4,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  keyboardDismissBtn: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputCard: {
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
  photoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  photoPreviewThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  photoPreviewLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
