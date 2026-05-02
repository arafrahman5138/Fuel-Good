import { create } from 'zustand';
import { fuelApi } from '../services/api';

interface FuelSettings {
  fuel_target: number;
  expected_meals_per_week: number;
  clean_eating_pct: number;
}

interface DailyFuel {
  date: string;
  avg_fuel_score: number;
  meal_count: number;
  meals: Array<{ id: string; title: string; fuel_score: number; tier: string; source_type: string }>;
}

interface FlexBudget {
  fuel_target: number;
  expected_meals: number;
  meals_logged: number;
  total_score_points: number;
  avg_fuel_score: number;
  // Credit-based flex fields
  clean_pct: number;
  clean_meals_target: number;
  clean_meals_logged: number;
  flex_budget: number;
  flex_used: number;
  flex_available: number;
  // Legacy
  flex_points_total: number;
  flex_points_used: number;
  flex_points_remaining: number;
  flex_meals_remaining: number;
  target_met: boolean;
  projected_weekly_avg: number;
  week_start: string;
  week_end: string;
}

interface ManualFlexResult {
  id: string;
  date: string;
  title: string;
  fuel_score: number;
  flex_available: number;
  weekly_avg: number;
}

interface WeeklyFuel {
  week_start: string;
  week_end: string;
  avg_fuel_score: number;
  meal_count: number;
  target_met: boolean;
  flex_budget: FlexBudget;
  daily_breakdown: DailyFuel[];
}

interface FuelStreak {
  current_streak: number;
  longest_streak: number;
  fuel_target: number;
}

interface HealthPulseDimension {
  score: number;
  label: string;
  tier: string;
  available: boolean;
}

interface HealthPulse {
  date: string;
  score: number;
  tier: string;
  tier_label: string;
  fuel: HealthPulseDimension;
  metabolic: HealthPulseDimension;
  nutrition: HealthPulseDimension;
  meal_count: number;
}

interface CalendarDay {
  date: string;
  avg_fuel_score: number;
  meal_count: number;
  tier: string;
  is_flex: boolean;
}

interface FuelCalendar {
  month: string;
  fuel_target: number;
  days: CalendarDay[];
}

interface FlexSuggestion {
  icon: string;
  title: string;
  body: string;
  accent: string;
}

interface SmartFlex {
  context: string;
  flex_meals_remaining: number;
  suggestions: FlexSuggestion[];
}

interface FuelState {
  settings: FuelSettings | null;
  daily: DailyFuel | null;
  weekly: WeeklyFuel | null;
  streak: FuelStreak | null;
  healthPulse: HealthPulse | null;
  calendar: FuelCalendar | null;
  flexSuggestions: SmartFlex | null;
  loading: boolean;
  error: string | null;
  // Focus-cache: tracks the last fetchAll completion per dateKey so
  // useFocusEffect re-firing on tab return doesn't trigger an immediate
  // re-fetch when the data is fresh.
  _lastFetchedAt: Record<string, number>;

  fetchSettings: () => Promise<void>;
  updateSettings: (target: number, mealsPerWeek: number) => Promise<void>;
  fetchDaily: (date?: string) => Promise<void>;
  fetchWeekly: (date?: string) => Promise<void>;
  fetchStreak: () => Promise<void>;
  fetchHealthPulse: (date?: string) => Promise<void>;
  fetchCalendar: (month?: string) => Promise<void>;
  fetchFlexSuggestions: (date?: string) => Promise<void>;
  logManualFlex: (data: { meal_type?: string; tag?: string; date?: string }) => Promise<ManualFlexResult | null>;
  fetchAll: (date?: string, opts?: { force?: boolean }) => Promise<void>;
}

// Time window during which a repeat fetchAll for the same dateKey is
// considered fresh and skipped. Pull-to-refresh and meal logs bypass via
// `force: true`.
const FOCUS_CACHE_TTL_MS = 60_000;

export const useFuelStore = create<FuelState>((set, get) => ({
  settings: null,
  daily: null,
  weekly: null,
  streak: null,
  healthPulse: null,
  calendar: null,
  flexSuggestions: null,
  loading: false,
  error: null,
  _lastFetchedAt: {},

  fetchSettings: async () => {
    try {
      const data = await fuelApi.getSettings();
      set({ settings: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load fuel settings' });
    }
  },

  updateSettings: async (target, mealsPerWeek) => {
    try {
      const data = await fuelApi.updateSettings({
        fuel_target: target,
        expected_meals_per_week: mealsPerWeek,
      });
      set({ settings: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update fuel settings' });
    }
  },

  fetchDaily: async (date?: string) => {
    try {
      const data = await fuelApi.getDaily(date);
      set({ daily: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load daily fuel' });
    }
  },

  fetchWeekly: async (date?: string) => {
    try {
      const data = await fuelApi.getWeekly(date);
      set({ weekly: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load weekly fuel' });
    }
  },

  fetchStreak: async () => {
    try {
      const data = await fuelApi.getStreak();
      set({ streak: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load fuel streak' });
    }
  },

  fetchHealthPulse: async (date?: string) => {
    try {
      const data = await fuelApi.getHealthPulse(date);
      set({ healthPulse: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load health pulse' });
    }
  },

  fetchCalendar: async (month?: string) => {
    try {
      const data = await fuelApi.getCalendar(month);
      set({ calendar: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load fuel calendar' });
    }
  },

  fetchFlexSuggestions: async (date?: string) => {
    try {
      const data = await fuelApi.getFlexSuggestions(date);
      set({ flexSuggestions: data });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load flex suggestions' });
    }
  },

  logManualFlex: async (data) => {
    try {
      const result = await fuelApi.logManualFlex(data);
      // Refresh weekly data after logging
      get().fetchWeekly();
      return result;
    } catch (e: any) {
      set({ error: e?.message || 'Failed to log flex meal' });
      return null;
    }
  },

  fetchAll: async (date?: string, opts?: { force?: boolean }) => {
    const dateKey = date ?? '_default';
    // Focus-cache: if a previous fetchAll for this dateKey completed
    // within the TTL and we have data in the store, skip the network
    // round-trip entirely. Pull-to-refresh + change events pass force:true.
    if (!opts?.force) {
      const last = get()._lastFetchedAt[dateKey];
      const hasData = !!(get().settings && get().weekly);
      if (last && hasData && Date.now() - last < FOCUS_CACHE_TTL_MS) {
        return;
      }
    }
    set({ loading: true, error: null });
    try {
      const results = await Promise.allSettled([
        fuelApi.getSettings(),
        fuelApi.getDaily(date),
        fuelApi.getWeekly(date),
        fuelApi.getStreak(),
        fuelApi.getHealthPulse(date),
      ]);
      const val = <T,>(r: PromiseSettledResult<T>) => r.status === 'fulfilled' ? r.value : null;
      set({
        settings: val(results[0]) ?? get().settings,
        daily: val(results[1]) ?? get().daily,
        weekly: val(results[2]) ?? get().weekly,
        streak: val(results[3]) ?? get().streak,
        healthPulse: val(results[4]) ?? get().healthPulse,
        loading: false,
        _lastFetchedAt: { ...get()._lastFetchedAt, [dateKey]: Date.now() },
      });
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length === results.length) {
        set({ error: 'Failed to load fuel data' });
      }
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load fuel data', loading: false });
    }
  },
}));
