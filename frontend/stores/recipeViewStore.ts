import { create } from 'zustand';

interface RecipeViewState {
  recipe: any | null;
  swaps: Array<{ original: string; replacement: string; reason: string }> | null;
  nutrition: any | null;
  mesScore: any | null;
  set: (data: Partial<Omit<RecipeViewState, 'set' | 'clear'>>) => void;
  clear: () => void;
}

export const useRecipeViewStore = create<RecipeViewState>((set) => ({
  recipe: null,
  swaps: null,
  nutrition: null,
  mesScore: null,
  set: (data) => set(data),
  clear: () => set({ recipe: null, swaps: null, nutrition: null, mesScore: null }),
}));
