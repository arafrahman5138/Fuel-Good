/**
 * RecipeCard — the browse-grid recipe card (extracted from BrowseView).
 *
 * Renders one recipe tile: image, title, description, time/difficulty
 * metadata, the two-pillar badges (Fuel 100 / Metabolic N) and the
 * calorie·protein line. Memoized — parents must pass stable `onPress`
 * (useCallback) and primitive/stable props so FlashList rows don't
 * re-render on unrelated state changes.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { BorderRadius, FontSize, MacroColors, Spacing } from '../../constants/Colors';
import { MealImage } from '../MealImage';
import { StatusPill } from '../ui/StatusPill';
import { getTierConfig } from '../../stores/metabolicBudgetStore';
import {
  classifyMealContext,
  type MealContext,
  MEAL_CONTEXT_FULL,
  MEAL_CONTEXT_COMPONENT_PROTEIN,
  MEAL_CONTEXT_COMPONENT_CARB,
  MEAL_CONTEXT_COMPONENT_VEG,
  MEAL_CONTEXT_SAUCE,
  MEAL_CONTEXT_DESSERT,
} from '../../utils/mealContext';

/** One recipe row from the browse API. */
export interface BrowseRecipe {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  cook_time_min: number;
  total_time_min: number;
  difficulty: string;
  flavor_profile: string[];
  dietary_tags: string[];
  health_benefits: string[];
  nutrition_info: Record<string, number>;
  servings: number;
  image_url?: string | null;
  // Composition fields
  recipe_role?: string;
  is_component?: boolean;
  meal_group_id?: string | null;
  default_pairing_ids?: string[];
  needs_default_pairing?: boolean | null;
  is_mes_scoreable?: boolean;
  composite_display_score?: number;
  composite_display_tier?: string;
}

/** Canonical taxonomy first, title/nutrition heuristic as fallback. */
export function getRecipeContext(item: BrowseRecipe): MealContext {
  // Prefer backend canonical taxonomy when available.
  if (item.recipe_role) {
    if (item.recipe_role === 'full_meal') return MEAL_CONTEXT_FULL;
    if (item.recipe_role === 'protein_base') return MEAL_CONTEXT_COMPONENT_PROTEIN;
    if (item.recipe_role === 'carb_base') return MEAL_CONTEXT_COMPONENT_CARB;
    if (item.recipe_role === 'veg_side') return MEAL_CONTEXT_COMPONENT_VEG;
    if (item.recipe_role === 'sauce') return MEAL_CONTEXT_SAUCE;
    if (item.recipe_role === 'dessert') return MEAL_CONTEXT_DESSERT;
  }

  // Safety fallback for older payloads.
  return classifyMealContext(item.title, null, item.nutrition_info);
}

export interface RecipeCardProps {
  recipe: BrowseRecipe;
  /** Column width computed by the parent grid. */
  cardWidth: number;
  /** Stable callback receiving the recipe id. */
  onPress: (id: string) => void;
}

export const RecipeCard = React.memo(function RecipeCard({
  recipe: item,
  cardWidth,
  onPress,
}: RecipeCardProps) {
  const theme = useTheme();

  const baseDisplayScore = Number(item.nutrition_info?.mes_display_score ?? item.nutrition_info?.mes_score ?? 0);
  const baseDisplayTier = typeof item.nutrition_info?.mes_display_tier === 'string'
    ? item.nutrition_info.mes_display_tier
    : 'critical';
  const shouldUseCompositeScore =
    item.needs_default_pairing === true && typeof item.composite_display_score === 'number';
  const displayScore = shouldUseCompositeScore ? item.composite_display_score! : (baseDisplayScore > 0 ? baseDisplayScore : null);
  const displayTier = shouldUseCompositeScore
    ? (item.composite_display_tier || baseDisplayTier || 'critical')
    : (baseDisplayTier || 'critical');

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, backgroundColor: theme.surface, borderColor: theme.border }]}
      activeOpacity={0.7}
      onPress={() => onPress(item.id)}
    >
      <MealImage
        imageUrl={item.image_url}
        title={item.title}
        width={cardWidth - Spacing.md * 2}
        height={(cardWidth - Spacing.md * 2) * 0.65}
        borderRadius={BorderRadius.md}
      />
      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
        {item.title}
      </Text>
      {item.description ? (
        <Text
          style={[styles.cardDescription, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardMeta}>
        <View style={styles.cardMetaItem}>
          <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
          <Text style={[styles.cardMetaText, { color: theme.textSecondary }]}>
            {item.total_time_min}m
          </Text>
        </View>
        <View style={styles.cardMetaItem}>
          <Ionicons name="speedometer-outline" size={12} color={theme.textSecondary} />
          <Text style={[styles.cardMetaText, { color: theme.textSecondary }]}>
            {item.difficulty}
          </Text>
        </View>
      </View>

      {/* Two-pillar proof: every curated meal is real food; Metabolic varies by composition */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
        <StatusPill label="Fuel 100" color="#22C55E" icon="leaf" size="sm" />
        {displayScore != null && displayScore > 0 && (
          <StatusPill
            label={`Metabolic ${Math.round(displayScore)}`}
            color={getTierConfig(displayTier).color}
            icon="pulse"
            size="sm"
          />
        )}
      </View>

      {/* Passive metadata — always neutral; budget-fit coloring here read as error states */}
      {item.nutrition_info?.calories ? (
        <View
          style={{
            backgroundColor: MacroColors.neutral + '14',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={[styles.cardCalories, { color: MacroColors.neutral }]}>
            {Math.round(item.nutrition_info.calories)} cal{item.nutrition_info.protein ? ` · ${Math.round(item.nutrition_info.protein)}g protein` : ''}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: -2,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardMetaText: {
    fontSize: FontSize.xs,
  },
  cardCalories: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
