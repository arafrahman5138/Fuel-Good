import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  loadSaved: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  setMode: (mode) => {
    set({ mode });
    if (Platform.OS !== 'web') {
      SecureStore.setItemAsync('theme_mode', mode).catch(() => {});
    }
  },
  loadSaved: async () => {
    if (Platform.OS === 'web') return;
    try {
      const saved = await SecureStore.getItemAsync('theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        set({ mode: saved });
      }
    } catch {}
  },
}));
