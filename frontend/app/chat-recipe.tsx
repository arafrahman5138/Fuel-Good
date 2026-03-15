import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/GradientCard';
import { useTheme } from '../hooks/useTheme';
import { useRecipeViewStore } from '../stores/recipeViewStore';
import { useSavedRecipesStore } from '../stores/savedRecipesStore';
import { getTierConfig } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { cleanRecipeDescription } from '../utils/recipeDescription';
import { formatIngredientDisplayLine } from '../utils/ingredientFormat';

export default function ChatRecipeDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const recipe = useRecipeViewStore((s) => s.recipe);
  const swaps = useRecipeViewStore((s) => s.swaps);
  const nutrition = useRecipeViewStore((s) => s.nutrition);
  const mesScore = useRecipeViewStore((s) => s.mesScore);
  const saveGeneratedRecipe = useSavedRecipesStore((s) => s.saveGeneratedRecipe);
  const saveRecipe = useSavedRecipesStore((s) => s.saveRecipe);
  const isSaved = useSavedRecipesStore((s) => recipe?.id ? s.isSaved(recipe.id) : false);

  if (!recipe) {
    return (
      <ScreenContainer safeArea={false} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter} />
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Recipe not available</Text>
        </View>
      </ScreenContainer>
    );
  }

  const handleSave = async () => {
    if (recipe.id) {
      await saveRecipe(recipe.id);
    } else {
      await saveGeneratedRecipe({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        servings: recipe.servings,
        prep_time_min: recipe.prep_time_min,
        cook_time_min: recipe.cook_time_min,
      });
    }
  };

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {recipe.title || 'Recipe'}
        </Text>
        {!isSaved ? (
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={handleSave} activeOpacity={0.7}>
            <Ionicons name="bookmark-outline" size={18} color={theme.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '30' }]} activeOpacity={1}>
            <Ionicons name="bookmark" size={18} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title & Description */}
        <Text style={[styles.title, { color: theme.text }]}>{recipe.title}</Text>
        {!!cleanRecipeDescription(recipe.description) && (
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {cleanRecipeDescription(recipe.description)}
          </Text>
        )}

        {/* Meta chips */}
        <View style={styles.metaRow}>
          {recipe.servings ? (
            <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="people-outline" size={13} color={theme.textTertiary} />
              <Text style={[styles.metaText, { color: theme.textTertiary }]}>{recipe.servings} servings</Text>
            </View>
          ) : null}
          {(recipe.prep_time_min || recipe.cook_time_min) ? (
            <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
              <Text style={[styles.metaText, { color: theme.textTertiary }]}>
                {(recipe.prep_time_min || 0) + (recipe.cook_time_min || 0)} min
              </Text>
            </View>
          ) : null}
        </View>

        {/* MES Score */}
        {mesScore && mesScore.meal_score != null && (() => {
          const tc = getTierConfig(mesScore.meal_tier);
          return (
            <View style={styles.mesRow}>
              <View style={[styles.mesPill, { backgroundColor: tc.color + '20' }]}>
                <Ionicons name={tc.icon as any} size={12} color={tc.color} />
                <Text style={[styles.mesPillText, { color: tc.color }]}>
                  {Math.round(mesScore.meal_score)} MES
                </Text>
              </View>
              {mesScore.projected_daily_score != null && (() => {
                const dtc = getTierConfig(mesScore.projected_daily_tier || mesScore.meal_tier);
                return (
                  <View style={[styles.mesPill, { backgroundColor: dtc.color + '15' }]}>
                    <Ionicons name="today-outline" size={12} color={dtc.color} />
                    <Text style={[styles.mesPillText, { color: dtc.color }]}>
                      Day: {Math.round(mesScore.projected_daily_score)} MES
                    </Text>
                  </View>
                );
              })()}
            </View>
          );
        })()}

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
            {recipe.ingredients.map((ing: any, i: number) => (
              <View key={i} style={styles.ingredientRow}>
                <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.ingredientText, { color: theme.textSecondary }]}>
                  {formatIngredientDisplayLine(ing)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Steps */}
        {recipe.steps?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Steps</Text>
            {recipe.steps.map((step: string, i: number) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepBadge, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.stepNum, { color: theme.primary }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Ingredient Swaps */}
        {swaps && swaps.length > 0 && (
          <View style={styles.section}>
            <View style={styles.swapsHeader}>
              <Ionicons name="swap-horizontal" size={16} color={theme.accent} />
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Ingredient Swaps</Text>
            </View>
            {swaps.map((swap, i) => (
              <View key={i} style={[styles.swapItem, { borderBottomColor: theme.border }]}>
                <Text style={[styles.swapLabel, { color: theme.textTertiary }]}>Instead of</Text>
                <Text style={[styles.swapOld, { color: theme.error }]}>{swap.original}</Text>
                <View style={styles.swapArrowRow}>
                  <View style={[styles.swapArrowLine, { backgroundColor: theme.border }]} />
                  <Ionicons name="arrow-down" size={14} color={theme.textTertiary} />
                  <View style={[styles.swapArrowLine, { backgroundColor: theme.border }]} />
                </View>
                <Text style={[styles.swapLabel, { color: theme.textTertiary }]}>Use</Text>
                <Text style={[styles.swapNew, { color: theme.primary }]}>{swap.replacement}</Text>
                {!!swap.reason && (
                  <Text style={[styles.swapReason, { color: theme.textTertiary }]}>{swap.reason}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Nutrition Comparison */}
        {nutrition?.original_estimate && nutrition?.healthified_estimate && (
          <Card style={styles.nutritionCard} padding={Spacing.md}>
            <View style={styles.swapsHeader}>
              <Ionicons name="analytics-outline" size={16} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Nutrition Impact</Text>
            </View>
            <View style={[styles.nutritionRow, { marginTop: Spacing.sm }]}>
              <View style={{ flex: 1 }} />
              <Text style={[styles.nutritionColLabel, { color: theme.textTertiary }]}>Original</Text>
              <Text style={[styles.nutritionColLabel, { color: theme.primary }]}>Healthified</Text>
            </View>
            {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((key) => {
              const orig = Number(nutrition.original_estimate[key] || 0);
              const healthified = Number(nutrition.healthified_estimate[key] || 0);
              const diff = healthified - orig;
              const unit = key === 'calories' ? '' : 'g';
              const improved = key === 'protein' || key === 'fiber' ? diff > 0 : diff < 0;
              return (
                <View key={key} style={[styles.nutritionRow, { borderTopWidth: 1, borderTopColor: theme.surfaceHighlight, paddingVertical: 6 }]}>
                  <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                  <Text style={[styles.nutritionVal, { color: theme.textTertiary }]}>{Math.round(orig)}{unit}</Text>
                  <Text style={[styles.nutritionVal, { color: theme.text, fontWeight: '700' }]}>
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
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 2,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  saveBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
  },
  description: {
    fontSize: FontSize.md,
    lineHeight: 24,
    marginTop: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  mesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  mesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  mesPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  ingredientText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  swapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  swapItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: 4,
  },
  swapLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  swapOld: {
    fontSize: FontSize.md,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    lineHeight: 22,
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
  swapNew: {
    fontSize: FontSize.md,
    fontWeight: '700',
    lineHeight: 22,
  },
  swapReason: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  nutritionCard: {
    marginTop: Spacing.xl,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nutritionColLabel: {
    width: 80,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  nutritionLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  nutritionVal: {
    width: 80,
    fontSize: FontSize.sm,
    textAlign: 'right',
  },
});
