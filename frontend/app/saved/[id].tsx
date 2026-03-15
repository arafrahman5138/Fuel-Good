import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSavedRecipesStore } from '../../stores/savedRecipesStore';
import { useTheme } from '../../hooks/useTheme';
import { ScreenContainer } from '../../components/ScreenContainer';
import LogoHeader from '../../components/LogoHeader';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { cleanRecipeDescription } from '../../utils/recipeDescription';
import { formatIngredientDisplayLine } from '../../utils/ingredientFormat';

export default function SavedRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const recipe = useSavedRecipesStore((s) => (id ? s.getRecipeById(id) : null));
  const removeRecipe = useSavedRecipesStore((s) => s.removeRecipe);

  if (!recipe) {
    return (
      <ScreenContainer safeArea={false} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.pageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.navBackBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
          <View style={styles.pageHeaderTitle}>
            <LogoHeader />
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={42} color={theme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Saved recipe not found</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>This saved item is no longer on this device.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const handleRemove = async () => {
    await removeRecipe(recipe.id);
    router.back();
  };

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.pageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.navBackBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.primary} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
        <View style={styles.pageHeaderTitle}>
          <LogoHeader />
        </View>
        <TouchableOpacity
          style={[styles.removeBtnHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{recipe.title}</Text>
          {!!cleanRecipeDescription(recipe.description) && (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {cleanRecipeDescription(recipe.description)}
            </Text>
          )}
          <View style={styles.metaRow}>
            {!!recipe.total_time_min && (
              <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
                <Text style={[styles.metaText, { color: theme.textTertiary }]}>{recipe.total_time_min} min</Text>
              </View>
            )}
            {!!recipe.servings && (
              <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="people-outline" size={14} color={theme.textTertiary} />
                <Text style={[styles.metaText, { color: theme.textTertiary }]}>{recipe.servings} servings</Text>
              </View>
            )}
            {!!recipe.difficulty && (
              <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
                <Text style={[styles.metaText, { color: theme.textTertiary }]}>{recipe.difficulty}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.savedMeta, { color: theme.textTertiary }]}>
            Saved on this device
          </Text>
        </View>

        {!!recipe.ingredients?.length && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <View key={`${recipe.id}-ingredient-${index}`} style={styles.listRow}>
                <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.listText, { color: theme.textSecondary }]}>
                  {formatIngredientDisplayLine(ingredient)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!!recipe.steps?.length && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Steps</Text>
            {recipe.steps.map((step, index) => (
              <View key={`${recipe.id}-step-${index}`} style={styles.stepRow}>
                <View style={[styles.stepIndex, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.stepIndexText, { color: theme.primary }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.listText, { color: theme.textSecondary }]}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  pageHeader: {
    paddingTop: 54,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBackBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeaderTitle: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  removeBtnHeader: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    lineHeight: 38,
  },
  description: {
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  savedMeta: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  section: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    marginTop: 7,
  },
  listText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIndexText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
