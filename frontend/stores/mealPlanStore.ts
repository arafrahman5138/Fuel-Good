import { create } from 'zustand';
import { mealPlanApi } from '../services/api';

interface MealPlanItem {
  id: string;
  day_of_week: string;
  meal_type: string;
  meal_category: string;
  is_bulk_cook: boolean;
  servings: number;
  recipe_data: any;
}

interface MealPlan {
  id: string;
  week_start: string;
  items: MealPlanItem[];
  created_at: string;
  prep_timeline?: Array<{
    prep_group_id: string;
    recipe_id: string;
    recipe_title: string;
    meal_type: string;
    prep_day: string;
    covers_days: string[];
    servings_to_make: number;
    summary_text: string;
  }>;
  quality_summary?: {
    target_meal_display_mes: number;
    target_daily_average_display_mes: number;
    actual_weekly_average_daily_display_mes: number;
    qualifying_meal_count: number;
    total_meal_count: number;
    days_meeting_target: number;
    total_days: number;
  };
  warnings?: string[];
}

interface MealPlanState {
  currentPlan: MealPlan | null;
  isGenerating: boolean;
  isLoading: boolean;
  hasLoaded: boolean;
  loadError: boolean;
  selectedDay: string;
  setCurrentPlan: (plan: MealPlan) => void;
  setGenerating: (generating: boolean) => void;
  setSelectedDay: (day: string) => void;
  loadCurrentPlan: (forceReload?: boolean) => Promise<void>;
  updateMealServings: (itemId: string, servings: number) => Promise<void>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getTodayName() {
  const today = new Date().getDay();
  const dayIndex = today === 0 ? 6 : today - 1;
  return DAYS[dayIndex];
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  currentPlan: null,
  isGenerating: false,
  isLoading: false,
  hasLoaded: false,
  loadError: false,
  selectedDay: getTodayName(),
  setCurrentPlan: (currentPlan) => set({ currentPlan, hasLoaded: true, loadError: false }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  loadCurrentPlan: async (forceReload = false) => {
    if (get().isLoading) return;
    if (get().hasLoaded && !forceReload) return;
    set({ isLoading: true, loadError: false });
    try {
      const plan = await mealPlanApi.getCurrent();
      if (plan?.items?.length) {
        // Check if plan is stale (week_start is more than 2 weeks old)
        const weekStart = plan.week_start ? new Date(plan.week_start + 'T12:00:00') : null;
        const now = new Date();
        const twoWeeksAgo = new Date(now);
        twoWeeksAgo.setDate(now.getDate() - 14);

        if (weekStart && weekStart < twoWeeksAgo) {
          // Plan is stale — don't display it, let user generate a new one
          set({ currentPlan: null, hasLoaded: true, loadError: false });
        } else {
          set({ currentPlan: plan, hasLoaded: true, loadError: false });
        }
      } else {
        // No plan on server — treated as an empty state (not an error).
        set({ hasLoaded: true, loadError: false });
      }
    } catch {
      // Network / server error — surface so the UI can show a retry affordance.
      // Don't set hasLoaded so caller (or retry) can try again.
      set({ loadError: true });
    } finally {
      set({ isLoading: false });
    }
  },
  updateMealServings: async (itemId: string, servings: number) => {
    const plan = get().currentPlan;
    if (!plan) return;

    // Optimistic update
    const updatedItems = plan.items.map((item) =>
      item.id === itemId ? { ...item, servings } : item
    );
    set({ currentPlan: { ...plan, items: updatedItems } });

    try {
      await mealPlanApi.updateItemServings(itemId, servings);
    } catch {
      // Revert on failure
      set({ currentPlan: plan });
    }
  },
}));
