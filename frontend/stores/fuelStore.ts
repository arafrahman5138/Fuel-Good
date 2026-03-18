import { create } from 'zustand';
import { fuelApi } from '../services/api';

interface FuelSettings {
  fuel_target: number;
  expected_meals_per_week: number;
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
  flex_points_total: number;
  flex_points_used: number;
  flex_points_remaining: number;
  flex_meals_remaining: number;
  target_met: boolean;
  projected_weekly_avg: number;
  week_start: string;
  week_end: string;
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

  fetchSettings: () => Promise<void>;
  updateSettings: (target: number, mealsPerWeek: number) => Promise<void>;
  fetchDaily: (date?: string) => Promise<void>;
  fetchWeekly: (date?: string) => Promise<void>;
  fetchStreak: () => Promise<void>;
  fetchHealthPulse: (date?: string) => Promise<void>;
  fetchCalendar: (month?: string) => Promise<void>;
  fetchFlexSuggestions: (date?: string) => Promise<void>;
  fetchAll: (date?: string) => Promise<void>;
}

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

  fetchAll: async (date?: string) => {
    set({ loading: true, error: null });
    try {
      const [settings, daily, weekly, streak, healthPulse] = await Promise.all([
        fuelApi.getSettings(),
        fuelApi.getDaily(date),
        fuelApi.getWeekly(date),
        fuelApi.getStreak(),
        fuelApi.getHealthPulse(date),
      ]);
      set({ settings, daily, weekly, streak, healthPulse, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load fuel data', loading: false });
    }
  },
}));
