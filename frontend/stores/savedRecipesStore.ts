import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { gameApi, recipeApi } from '../services/api';
import { maybePromptForPush } from '../services/notifications';

const SAVED_RECIPES_STORAGE_KEY = 'fuelgood.saved_recipes.v1';

export type SavedRecipeSourceType = 'catalog' | 'generated_local';

export interface SavedRecipeIngredient {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
}

export interface SavedRecipe {
  id: string;
  sourceType: SavedRecipeSourceType;
  sourceRecipeId?: string;
  savedAt: string;
  title: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  total_time_min?: number;
  health_benefits?: string[];
  nutrition_info?: Record<string, any>;
  ingredients?: SavedRecipeIngredient[];
  steps?: string[];
  servings?: number;
  prep_time_min?: number;
  cook_time_min?: number;
  tags?: string[];
  flavor_profile?: string[];
  dietary_tags?: string[];
  recipe_role?: string;
  is_component?: boolean;
  default_pairing_ids?: string[];
  needs_default_pairing?: boolean | null;
  is_mes_scoreable?: boolean;
  component_composition?: Record<string, any> | null;
  pairing_synergy_profile?: Record<string, any> | null;
  components?: Array<{
    id: string;
    title: string;
    recipe_role: string;
    steps: string[];
    ingredients: SavedRecipeIngredient[];
  }>;
}

interface PersistedSavedRecipes {
  items: SavedRecipe[];
}

interface SavedRecipesState {
  recipes: SavedRecipe[];
  savedIds: Set<string>;
  loading: boolean;
  fetchSaved: () => Promise<void>;
  saveRecipe: (id: string) => Promise<any>;
  saveGeneratedRecipe: (recipe: Omit<SavedRecipe, 'id' | 'savedAt' | 'sourceType'> & { id?: string }) => Promise<string | null>;
  removeRecipe: (id: string) => Promise<void>;
  isSaved: (id: string) => boolean;
  getRecipeById: (id: string) => SavedRecipe | null;
}

function buildSavedIds(recipes: SavedRecipe[]): Set<string> {
  const ids = new Set<string>();
  recipes.forEach((recipe) => {
    ids.add(recipe.id);
    if (recipe.sourceRecipeId) ids.add(recipe.sourceRecipeId);
  });
  return ids;
}

function sortRecipes(recipes: SavedRecipe[]): SavedRecipe[] {
  return [...recipes].sort((a, b) => {
    const aTime = new Date(a.savedAt || 0).getTime();
    const bTime = new Date(b.savedAt || 0).getTime();
    return bTime - aTime;
  });
}

function sanitizeIngredient(value: any): SavedRecipeIngredient | null {
  if (!value || typeof value !== 'object') return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) return null;
  return {
    name,
    quantity: value.quantity,
    unit: typeof value.unit === 'string' ? value.unit : value.unit == null ? undefined : String(value.unit),
    category: typeof value.category === 'string' ? value.category : undefined,
  };
}

function sanitizeSavedRecipe(value: any): SavedRecipe | null {
  if (!value || typeof value !== 'object') return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const id = typeof value.id === 'string' ? value.id : '';
  if (!id || !title) return null;

  const sourceType: SavedRecipeSourceType = value.sourceType === 'catalog' ? 'catalog' : 'generated_local';
  const savedAt = typeof value.savedAt === 'string' && value.savedAt ? value.savedAt : new Date().toISOString();
  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.map(sanitizeIngredient).filter(Boolean) as SavedRecipeIngredient[]
    : [];
  const components = Array.isArray(value.components)
    ? value.components
        .filter((component: any) => component && typeof component === 'object' && typeof component.id === 'string')
        .map((component: any) => ({
          id: component.id,
          title: typeof component.title === 'string' ? component.title : 'Component',
          recipe_role: typeof component.recipe_role === 'string' ? component.recipe_role : 'full_meal',
          steps: Array.isArray(component.steps) ? component.steps.filter((step: unknown) => typeof step === 'string') : [],
          ingredients: Array.isArray(component.ingredients)
            ? component.ingredients.map(sanitizeIngredient).filter(Boolean) as SavedRecipeIngredient[]
            : [],
        }))
    : undefined;

  return {
    id,
    sourceType,
    sourceRecipeId: typeof value.sourceRecipeId === 'string' ? value.sourceRecipeId : undefined,
    savedAt,
    title,
    description: typeof value.description === 'string' ? value.description : undefined,
    cuisine: typeof value.cuisine === 'string' ? value.cuisine : undefined,
    difficulty: typeof value.difficulty === 'string' ? value.difficulty : undefined,
    total_time_min: typeof value.total_time_min === 'number' ? value.total_time_min : undefined,
    health_benefits: Array.isArray(value.health_benefits) ? value.health_benefits.filter((item: unknown) => typeof item === 'string') : [],
    nutrition_info: value.nutrition_info && typeof value.nutrition_info === 'object' ? value.nutrition_info : {},
    ingredients,
    steps: Array.isArray(value.steps) ? value.steps.filter((item: unknown) => typeof item === 'string') : [],
    servings: typeof value.servings === 'number' ? value.servings : undefined,
    prep_time_min: typeof value.prep_time_min === 'number' ? value.prep_time_min : undefined,
    cook_time_min: typeof value.cook_time_min === 'number' ? value.cook_time_min : undefined,
    tags: Array.isArray(value.tags) ? value.tags.filter((item: unknown) => typeof item === 'string') : [],
    flavor_profile: Array.isArray(value.flavor_profile) ? value.flavor_profile.filter((item: unknown) => typeof item === 'string') : [],
    dietary_tags: Array.isArray(value.dietary_tags) ? value.dietary_tags.filter((item: unknown) => typeof item === 'string') : [],
    recipe_role: typeof value.recipe_role === 'string' ? value.recipe_role : undefined,
    is_component: typeof value.is_component === 'boolean' ? value.is_component : undefined,
    default_pairing_ids: Array.isArray(value.default_pairing_ids) ? value.default_pairing_ids.filter((item: unknown) => typeof item === 'string') : [],
    needs_default_pairing: typeof value.needs_default_pairing === 'boolean' ? value.needs_default_pairing : null,
    is_mes_scoreable: typeof value.is_mes_scoreable === 'boolean' ? value.is_mes_scoreable : undefined,
    component_composition: value.component_composition && typeof value.component_composition === 'object' ? value.component_composition : null,
    pairing_synergy_profile: value.pairing_synergy_profile && typeof value.pairing_synergy_profile === 'object' ? value.pairing_synergy_profile : null,
    components,
  };
}

async function readPersistedRecipes(): Promise<SavedRecipe[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_RECIPES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: PersistedSavedRecipes | SavedRecipe[] = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    return sortRecipes(items.map(sanitizeSavedRecipe).filter(Boolean) as SavedRecipe[]);
  } catch {
    return [];
  }
}

async function writePersistedRecipes(recipes: SavedRecipe[]): Promise<void> {
  const payload: PersistedSavedRecipes = { items: sortRecipes(recipes) };
  await AsyncStorage.setItem(SAVED_RECIPES_STORAGE_KEY, JSON.stringify(payload));
}

function createLocalRecipeId(): string {
  return `local:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function snapshotCatalogRecipe(recipe: any): SavedRecipe {
  return {
    id: createLocalRecipeId(),
    sourceType: 'catalog',
    sourceRecipeId: recipe.id,
    savedAt: new Date().toISOString(),
    title: recipe.title || 'Saved Recipe',
    description: recipe.description || '',
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    total_time_min: recipe.total_time_min,
    health_benefits: recipe.health_benefits || [],
    nutrition_info: recipe.nutrition_info || {},
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    servings: recipe.servings,
    prep_time_min: recipe.prep_time_min,
    cook_time_min: recipe.cook_time_min,
    tags: recipe.tags || [],
    flavor_profile: recipe.flavor_profile || [],
    dietary_tags: recipe.dietary_tags || [],
    recipe_role: recipe.recipe_role,
    is_component: recipe.is_component,
    default_pairing_ids: recipe.default_pairing_ids || [],
    needs_default_pairing: recipe.needs_default_pairing ?? null,
    is_mes_scoreable: recipe.is_mes_scoreable,
    component_composition: recipe.component_composition || null,
    pairing_synergy_profile: recipe.pairing_synergy_profile || null,
    components: recipe.components || [],
  };
}

function snapshotGeneratedRecipe(
  recipe: Omit<SavedRecipe, 'id' | 'savedAt' | 'sourceType'> & { id?: string },
): SavedRecipe {
  return {
    id: recipe.id && recipe.id.startsWith('local:') ? recipe.id : createLocalRecipeId(),
    sourceType: 'generated_local',
    savedAt: new Date().toISOString(),
    sourceRecipeId: undefined,
    title: recipe.title?.trim() || 'Custom Recipe',
    description: recipe.description || '',
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    total_time_min: recipe.total_time_min ?? (((recipe.prep_time_min || 0) + (recipe.cook_time_min || 0)) || undefined),
    health_benefits: recipe.health_benefits || [],
    nutrition_info: recipe.nutrition_info || {},
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    servings: recipe.servings,
    prep_time_min: recipe.prep_time_min,
    cook_time_min: recipe.cook_time_min,
    tags: recipe.tags || [],
    flavor_profile: recipe.flavor_profile || [],
    dietary_tags: recipe.dietary_tags || [],
    recipe_role: recipe.recipe_role,
    is_component: recipe.is_component,
    default_pairing_ids: recipe.default_pairing_ids || [],
    needs_default_pairing: recipe.needs_default_pairing ?? null,
    is_mes_scoreable: recipe.is_mes_scoreable,
    component_composition: recipe.component_composition || null,
    pairing_synergy_profile: recipe.pairing_synergy_profile || null,
    components: recipe.components,
  };
}

export const useSavedRecipesStore = create<SavedRecipesState>((set, get) => ({
  recipes: [],
  savedIds: new Set(),
  loading: false,

  fetchSaved: async () => {
    set({ loading: true });
    try {
      const recipes = await readPersistedRecipes();
      set({
        recipes,
        savedIds: buildSavedIds(recipes),
      });
    } finally {
      set({ loading: false });
    }
  },

  saveRecipe: async (id: string) => {
    if (get().savedIds.has(id)) {
      return { status: 'already_saved_local' };
    }

    try {
      const detail = await recipeApi.getDetail(id);
      const nextRecipe = snapshotCatalogRecipe(detail);
      const nextRecipes = sortRecipes([nextRecipe, ...get().recipes]);
      await writePersistedRecipes(nextRecipes);
      set({
        recipes: nextRecipes,
        savedIds: buildSavedIds(nextRecipes),
      });
      gameApi.awardXP(10, 'save_recipe').catch(() => {});
      maybePromptForPush('save_recipe').catch(() => {});
      return { status: 'saved_local', recipe_id: nextRecipe.id };
    } catch (error) {
      throw error;
    }
  },

  saveGeneratedRecipe: async (recipe) => {
    try {
      const nextRecipe = snapshotGeneratedRecipe(recipe);
      const nextRecipes = sortRecipes([
        nextRecipe,
        ...get().recipes.filter((item) => item.id !== nextRecipe.id),
      ]);
      await writePersistedRecipes(nextRecipes);
      set({
        recipes: nextRecipes,
        savedIds: buildSavedIds(nextRecipes),
      });
      gameApi.awardXP(10, 'save_recipe').catch(() => {});
      maybePromptForPush('save_recipe').catch(() => {});
      return nextRecipe.id;
    } catch {
      return null;
    }
  },

  removeRecipe: async (id: string) => {
    const nextRecipes = get().recipes.filter((recipe) => recipe.id !== id && recipe.sourceRecipeId !== id);
    await writePersistedRecipes(nextRecipes);
    set({
      recipes: nextRecipes,
      savedIds: buildSavedIds(nextRecipes),
    });
  },

  isSaved: (id: string) => get().savedIds.has(id),

  getRecipeById: (id: string) => get().recipes.find((recipe) => recipe.id === id || recipe.sourceRecipeId === id) || null,
}));
