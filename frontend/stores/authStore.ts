import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../constants/Config';
import { reportClientError } from '../services/errorReporting';

export type AccessLevel = 'none' | 'premium';
export type SubscriptionState = 'inactive' | 'trialing' | 'active' | 'grace_period' | 'billing_issue' | 'expired';

export interface UserEntitlement {
  access_level: AccessLevel;
  subscription_state: SubscriptionState;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  product_id: string | null;
  store: string | null;
  will_renew: boolean;
  manage_url: string | null;
  requires_paywall: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  auth_provider: string;
  dietary_preferences: string[];
  flavor_preferences: string[];
  allergies: string[];
  liked_ingredients: string[];
  disliked_ingredients: string[];
  protein_preferences: { liked?: string[]; disliked?: string[] };
  cooking_time_budget: Record<string, number>;
  household_size: number;
  budget_level: string;
  xp_points: number;
  current_streak: number;
  longest_streak: number;
  entitlement: UserEntitlement;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBillingLoading: boolean;
  hasPremiumAccess: boolean;
  setToken: (token: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  setEntitlement: (entitlement: UserEntitlement) => void;
  addXp: (xp: number) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setBillingLoading: (loading: boolean) => void;
  loadAuth: () => Promise<void>;
}

const AUTH_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'com.fuelgood.auth',
};

function secureSetItem(key: string, value: string) {
  if (Platform.OS === 'web') return Promise.resolve();
  return SecureStore.setItemAsync(key, value, AUTH_STORE_OPTIONS).catch((err) => {
    void reportClientError({ source: 'securestore', message: `SecureStore set failed: ${key}`, context: { error: err?.message } });
  });
}

function secureDeleteItem(key: string) {
  if (Platform.OS === 'web') return Promise.resolve();
  return SecureStore.deleteItemAsync(key, AUTH_STORE_OPTIONS).catch((err) => {
    void reportClientError({ source: 'securestore', message: `SecureStore delete failed: ${key}`, context: { error: err?.message } });
  });
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function getDefaultEntitlement(): UserEntitlement {
  return {
    access_level: 'none',
    subscription_state: 'inactive',
    trial_started_at: null,
    trial_ends_at: null,
    current_period_ends_at: null,
    product_id: null,
    store: null,
    will_renew: false,
    manage_url: null,
    requires_paywall: true,
  };
}

export function hasActivePremiumAccess(entitlement?: UserEntitlement | null): boolean {
  return entitlement?.access_level === 'premium'
    && ['trialing', 'active', 'grace_period'].includes(entitlement.subscription_state);
}

function shouldPreserveCurrentEntitlement(
  currentEntitlement?: UserEntitlement | null,
  nextEntitlement?: UserEntitlement | null,
): boolean {
  if (!currentEntitlement || !nextEntitlement) return false;
  return currentEntitlement.store === 'manual_override'
    && hasActivePremiumAccess(currentEntitlement)
    && !hasActivePremiumAccess(nextEntitlement);
}

function normalizeUser(profile: any): UserProfile {
  return {
    ...profile,
    dietary_preferences: profile?.dietary_preferences || [],
    flavor_preferences: profile?.flavor_preferences || [],
    allergies: profile?.allergies || [],
    liked_ingredients: profile?.liked_ingredients || [],
    disliked_ingredients: profile?.disliked_ingredients || [],
    protein_preferences: profile?.protein_preferences || { liked: [], disliked: [] },
    entitlement: {
      ...getDefaultEntitlement(),
      ...(profile?.entitlement || {}),
    },
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isBillingLoading: false,
  hasPremiumAccess: false,
  setToken: (token) => {
    secureSetItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },
  setRefreshToken: (refreshToken) => {
    secureSetItem('refresh_token', refreshToken);
    set({ refreshToken });
  },
  setTokens: (accessToken, refreshToken) => {
    secureSetItem('auth_token', accessToken);
    secureSetItem('refresh_token', refreshToken);
    set({ token: accessToken, refreshToken, isAuthenticated: true });
  },
  setUser: (user) => {
    const normalizedUser = normalizeUser(user);
    set({ user: normalizedUser, hasPremiumAccess: hasActivePremiumAccess(normalizedUser.entitlement) });
  },
  setEntitlement: (entitlement) =>
    set((state) => {
      if (!state.user) return { hasPremiumAccess: hasActivePremiumAccess(entitlement) };
      const nextEntitlement = { ...getDefaultEntitlement(), ...entitlement };
      const effectiveEntitlement = shouldPreserveCurrentEntitlement(state.user.entitlement, nextEntitlement)
        ? state.user.entitlement
        : nextEntitlement;
      const user = { ...state.user, entitlement: effectiveEntitlement };
      return { user, hasPremiumAccess: hasActivePremiumAccess(user.entitlement) };
    }),
  addXp: (xp) =>
    set((state) => {
      const updatedUser = state.user
        ? { ...state.user, xp_points: Math.max(0, (state.user.xp_points || 0) + xp) }
        : state.user;
      return { user: updatedUser };
    }),
  logout: () => {
    secureDeleteItem('auth_token');
    secureDeleteItem('refresh_token');
    secureDeleteItem('auth_user');
    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      hasPremiumAccess: false,
      isBillingLoading: false,
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setBillingLoading: (isBillingLoading) => set({ isBillingLoading }),
  loadAuth: async () => {
    try {
      const [token, refreshToken] = Platform.OS === 'web'
        ? [null, null]
        : await Promise.all([
            SecureStore.getItemAsync('auth_token', AUTH_STORE_OPTIONS),
            SecureStore.getItemAsync('refresh_token', AUTH_STORE_OPTIONS),
          ]);

      if (!token && !refreshToken) {
        set({ isLoading: false });
        return;
      }

      // Try the access token first
      let accessToken = token;
      let currentRefreshToken = refreshToken;

      if (accessToken) {
        const meResponse = await fetchWithTimeout(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (meResponse.ok) {
          const profile = await meResponse.json();
          const normalizedUser = normalizeUser(profile);

          set({
            token: accessToken,
            refreshToken: currentRefreshToken,
            user: normalizedUser,
            isAuthenticated: true,
            isLoading: false,
            hasPremiumAccess: hasActivePremiumAccess(normalizedUser.entitlement),
          });
          return;
        }
      }

      // Access token expired or missing — try refresh
      if (currentRefreshToken) {
        try {
          const refreshResponse = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: currentRefreshToken }),
          });

          if (refreshResponse.ok) {
            const tokens = await refreshResponse.json();
            accessToken = tokens.access_token;
            currentRefreshToken = tokens.refresh_token;

            // Save tokens and fetch profile in parallel
            const [, meResponse] = await Promise.all([
              Promise.all([
                secureSetItem('auth_token', accessToken!),
                secureSetItem('refresh_token', currentRefreshToken!),
              ]),
              fetchWithTimeout(`${API_URL}/auth/me`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }),
            ]);

            if (meResponse.ok) {
              const profile = await meResponse.json();
              const normalizedUser = normalizeUser(profile);

              set({
                token: accessToken,
                refreshToken: currentRefreshToken,
                user: normalizedUser,
                isAuthenticated: true,
                isLoading: false,
                hasPremiumAccess: hasActivePremiumAccess(normalizedUser.entitlement),
              });
              return;
            }
          }
        } catch {
        }
      }

      // Both tokens invalid — clean up
      await Promise.all([
        secureDeleteItem('auth_token'),
        secureDeleteItem('refresh_token'),
        secureDeleteItem('auth_user'),
      ]);
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false, hasPremiumAccess: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
