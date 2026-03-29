import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Stack, router, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { initializeErrorReporting } from '../services/errorReporting';
import { preloadReduceMotion } from '../hooks/useAnimations';
import { billingApi } from '../services/api';
import { billingService } from '../services/billing';
import { registerNotificationListeners, syncPushTokenWithBackend } from '../services/notifications';
import { subscribeToBillingChanges } from '../services/supabase';
import { OfflineBanner } from '../components/OfflineBanner';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default function RootLayout() {
  const theme = useTheme();
  const mode = useThemeStore((s) => s.mode);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isBillingLoading = useAuthStore((s) => s.isBillingLoading);
  const hasPremiumAccess = useAuthStore((s) => s.hasPremiumAccess);
  const setEntitlement = useAuthStore((s) => s.setEntitlement);
  const setBillingLoading = useAuthStore((s) => s.setBillingLoading);
  const appState = useRef(AppState.currentState);
  const segments = useSegments();
  const pathname = usePathname();

  const currentRootSegment = segments[0];
  const isAuthRoute = currentRootSegment === '(auth)';
  const isOnboardingV2Route = currentRootSegment === 'onboarding-v2';
  const isOnboardingRoute = isOnboardingV2Route || (isAuthRoute && segments[1] === 'onboarding');
  const isSubscribeRoute = pathname === '/subscribe';
  const canAccessWithoutPremium = isAuthRoute || isOnboardingV2Route || isSubscribeRoute || pathname === '/';
  const skipBillingGate = __DEV__;

  // 7-day free trial: allow authenticated, onboarded users to explore the app
  const isWithinFreeTrial = (() => {
    if (!user || hasPremiumAccess) return false;
    const createdAt = (user as any).created_at;
    if (!createdAt) return false;
    const signupDate = new Date(createdAt);
    const now = new Date();
    const daysSinceSignup = (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceSignup <= 7;
  })();

  useEffect(() => {
    preloadReduceMotion();
    useThemeStore.getState().loadSaved();
    useAuthStore.getState().loadAuth();
    initializeErrorReporting();
    // Sync streak on initial launch
    useGamificationStore.getState().syncStreak();
  }, []);

  useEffect(() => {
    const cleanup = registerNotificationListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    if (token) {
      syncPushTokenWithBackend().catch(() => {});
    }
  }, [token]);

  const billingBootstrapped = useRef(false);
  useEffect(() => {
    if (!token || !user?.id) return;
    // Prevent re-bootstrapping on every render — only run once per user session
    if (billingBootstrapped.current) return;
    billingBootstrapped.current = true;

    let active = true;
    setBillingLoading(true);

    withTimeout(
      billingService.bootstrap(user.id, user.email, user.name),
      8000,
    )
      .then(async () => {
        const status = await withTimeout(
          billingApi.sync(false).catch(() => null),
          8000,
        ).catch(() => null);
        if (status?.entitlement && active) {
          setEntitlement(status.entitlement);
        }
      })
      .catch(() => {
        // Billing should never block the app indefinitely in local/dev flows.
      })
      .finally(() => {
        if (active) setBillingLoading(false);
      });

    const unsubscribe = billingService.addCustomerInfoListener((entitlement) => {
      if (active) {
        setEntitlement(entitlement);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToBillingChanges(user.id, () => {
      billingApi.sync(false).then((status) => {
        if (status?.entitlement) {
          useAuthStore.getState().setEntitlement(status.entitlement);
        }
      }).catch(() => {});
    });
    return () => {
      unsubscribe?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      if (!isAuthRoute) {
        router.replace('/(auth)/login');
      }
      return;
    }

    // A short gap exists after tokens are stored but before `/auth/me`
    // has populated the user profile. Avoid misrouting to onboarding/paywall.
    if (!user) {
      return;
    }

    const needsOnboarding = !user.flavor_preferences?.length || !user.dietary_preferences?.length;

    // Onboarding doesn't need billing — redirect immediately even while billing loads
    if (needsOnboarding) {
      if (!isOnboardingRoute) {
        router.replace('/(auth)/onboarding' as any);
      }
      return;
    }

    // Billing-dependent routes can only enter protected tabs when the user
    // has premium access or is inside the temporary free-trial window.
    if (!skipBillingGate && !hasPremiumAccess && !isWithinFreeTrial) {
      if (!canAccessWithoutPremium) {
        router.replace('/subscribe');
      }
      return;
    }

    if (isAuthRoute || isSubscribeRoute) {
      router.replace('/(tabs)' as any);
    }
  }, [isAuthenticated, isLoading, isBillingLoading, hasPremiumAccess, isWithinFreeTrial, pathname, currentRootSegment, isOnboardingRoute, user?.flavor_preferences?.length, user?.dietary_preferences?.length, skipBillingGate]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — sync streak
        const token = useAuthStore.getState().token;
        if (token) {
          useGamificationStore.getState().syncStreak();
          syncPushTokenWithBackend().catch(() => {});
          billingApi.sync(false).then((status) => {
            if (status?.entitlement) {
              useAuthStore.getState().setEntitlement(status.entitlement);
            }
          }).catch(() => {});
        }
      }
      appState.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <OfflineBanner />
      {isLoading ? (
        <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
      <Stack
        screenOptions={({ navigation }) => ({
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          headerLeft: ({ canGoBack, tintColor }) =>
            canGoBack ? (
              <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={tintColor || theme.text}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            ) : null,
        })}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding-v2" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerTitle: '' }} />
        <Stack.Screen
          name="subscribe"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="cook/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Cook Mode',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="food/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="food/meals"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="food/search"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="food/metabolic-coach"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="food/mes-breakdown"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="scan/index"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="browse/index"
          options={{
            headerShown: true,
            headerTitle: 'Browse Recipes',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
          }}
        />
        <Stack.Screen
          name="browse/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="saved/index"
          options={{
            headerShown: true,
            headerTitle: 'Saved Recipes',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
          }}
        />
        <Stack.Screen
          name="saved/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="chat-recipe"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            headerTitle: 'Settings',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
          }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{
            headerShown: true,
            headerTitle: 'Push Notifications',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
          }}
        />
        <Stack.Screen
          name="preferences"
          options={{
            headerShown: true,
            headerTitle: 'Preferences',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
          }}
        />
        <Stack.Screen
          name="meal-plan-builder"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
