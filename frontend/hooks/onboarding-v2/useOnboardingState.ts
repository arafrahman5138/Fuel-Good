import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  // Screen 3
  energyFeeling: 'energized' | 'fine' | 'tired' | 'depends' | null;

  // Screen 4
  dietHistory: 'fall_off' | 'bored' | 'restricted' | 'lost' | null;

  // Screen 7
  primaryGoal: 'energy' | 'weight' | 'cleaner' | 'muscle' | null;
  ageRange: string;
  height: number; // inches total
  weight: number; // lbs
  sex: 'male' | 'female' | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;

  // Screen 11
  committed: boolean;

  // Screen 12-14
  paywallDismissCount: 0 | 1 | 2;

  // Analytics
  scanCompleted: boolean;
  reviewPromptShown: boolean;
  reviewLeft: boolean;
  startedAt: Date;
  completedAt: Date | null;

  // Actions
  setEnergyFeeling: (value: OnboardingState['energyFeeling']) => void;
  setDietHistory: (value: OnboardingState['dietHistory']) => void;
  setPrimaryGoal: (value: OnboardingState['primaryGoal']) => void;
  setAgeRange: (value: string) => void;
  setHeight: (value: number) => void;
  setWeight: (value: number) => void;
  setSex: (value: OnboardingState['sex']) => void;
  setActivityLevel: (value: OnboardingState['activityLevel']) => void;
  setCommitted: (value: boolean) => void;
  incrementPaywallDismiss: () => void;
  setScanCompleted: (value: boolean) => void;
  setReviewPromptShown: (value: boolean) => void;
  setReviewLeft: (value: boolean) => void;
  setCompletedAt: (value: Date | null) => void;
  reset: () => void;
}

const initialState = {
  energyFeeling: null as OnboardingState['energyFeeling'],
  dietHistory: null as OnboardingState['dietHistory'],
  primaryGoal: null as OnboardingState['primaryGoal'],
  ageRange: '',
  height: 0,
  weight: 0,
  sex: null as OnboardingState['sex'],
  activityLevel: null as OnboardingState['activityLevel'],
  committed: false,
  paywallDismissCount: 0 as 0 | 1 | 2,
  scanCompleted: false,
  reviewPromptShown: false,
  reviewLeft: false,
  startedAt: new Date(),
  completedAt: null as Date | null,
};

export const useOnboardingState = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setEnergyFeeling: (value) => set({ energyFeeling: value }),
      setDietHistory: (value) => set({ dietHistory: value }),
      setPrimaryGoal: (value) => set({ primaryGoal: value }),
      setAgeRange: (value) => set({ ageRange: value }),
      setHeight: (value) => set({ height: value }),
      setWeight: (value) => set({ weight: value }),
      setSex: (value) => set({ sex: value }),
      setActivityLevel: (value) => set({ activityLevel: value }),
      setCommitted: (value) => set({ committed: value }),
      incrementPaywallDismiss: () =>
        set((state) => ({
          paywallDismissCount: Math.min(state.paywallDismissCount + 1, 2) as 0 | 1 | 2,
        })),
      setScanCompleted: (value) => set({ scanCompleted: value }),
      setReviewPromptShown: (value) => set({ reviewPromptShown: value }),
      setReviewLeft: (value) => set({ reviewLeft: value }),
      setCompletedAt: (value) => set({ completedAt: value }),
      reset: () => set({ ...initialState, startedAt: new Date() }),
    }),
    {
      name: 'onboarding-v2-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        energyFeeling: state.energyFeeling,
        dietHistory: state.dietHistory,
        primaryGoal: state.primaryGoal,
        ageRange: state.ageRange,
        height: state.height,
        weight: state.weight,
        sex: state.sex,
        activityLevel: state.activityLevel,
        committed: state.committed,
        paywallDismissCount: state.paywallDismissCount,
        scanCompleted: state.scanCompleted,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      }),
    }
  )
);
