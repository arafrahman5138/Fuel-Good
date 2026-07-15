/**
 * resetAllStores.ts — single place that wipes every user-data store.
 *
 * Called from authStore.logout() (which also covers the 401 auto-logout in
 * services/api.ts, since that path goes through the same logout action).
 * Without this, zustand stores keep the previous account's data in memory,
 * so switching accounts on one device leaked user A's macros/plans/chats
 * into user B's session.
 *
 * NOTE: authStore must NOT import this module statically — the data stores
 * import services/api, which imports authStore, so a static import here
 * would create a require cycle. authStore lazily require()s this module
 * inside logout() instead.
 *
 * themeStore is intentionally excluded: theme is a device preference, not
 * account data.
 */
import { useChatStore } from './chatStore';
import { useFuelStore } from './fuelStore';
import { useGamificationStore } from './gamificationStore';
import { useMealPlanStore } from './mealPlanStore';
import { useMetabolicBudgetStore } from './metabolicBudgetStore';
import { usePlateStore } from './plateStore';
import { useRecipeViewStore } from './recipeViewStore';
import { useSavedRecipesStore } from './savedRecipesStore';

export function resetAllUserStores(): void {
  useMetabolicBudgetStore.getState().reset();
  useFuelStore.getState().reset();
  useGamificationStore.getState().reset();
  useMealPlanStore.getState().reset();
  useChatStore.getState().reset();
  usePlateStore.getState().clearPlate();
  useRecipeViewStore.getState().clear();
  // Async (also removes the AsyncStorage payload) — fire-and-forget; the
  // in-memory state is cleared synchronously inside reset().
  void useSavedRecipesStore.getState().reset();
}
