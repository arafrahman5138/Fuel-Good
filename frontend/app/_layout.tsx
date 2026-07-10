import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, InteractionManager, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Stack, router, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

// Keep splash visible while we load auth, billing, etc.
SplashScreen.preventAutoHideAsync();
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { initializeErrorReporting, wrapWithSentry } from '../services/errorReporting';
import { analytics } from '../services/analytics';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { preloadReduceMotion } from '../hooks/useAnimations';
import { billingApi } from '../services/api';
import { billingService, isEntitlementStale } from '../services/billing';
import { registerNotificationListeners, syncPushTokenWithBackend } from '../services/notifications';
import { subscribeToBillingChanges } from '../services/supabase';
import { OfflineBanner } from '../components/OfflineBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';

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

function RootLayout() {
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

  // Auto-track screen views on navigation change
  useScreenTracking();

  const currentRootSegment = segments[0];
  const isAuthRoute = currentRootSegment === '(auth)';
  const isOnboardingRoute = isAuthRoute && (segments as string[])[1] === 'onboarding';

  useEffect(() => {
    // Critical-path bootstrap: theme + auth must complete before any
    // route renders, since the router gates on isAuthenticated.
    preloadReduceMotion();
    useThemeStore.getState().loadSaved();
    useAuthStore.getState().loadAuth();

    // Defer non-critical initialization until after the first interaction
    // batch. Sentry, MixPanel, and gamification streak sync don't need to
    // block first paint — running them inside InteractionManager moves
    // them off the critical render path. ~200ms saved on cold start, plus
    // the user gets to a usable screen visibly faster.
    const handle = InteractionManager.runAfterInteractions(() => {
      initializeErrorReporting();
      analytics.init();
      useGamificationStore.getState().syncStreak();
    });
    return () => handle.cancel();
  }, []);

  useEffect(() => {
    const cleanup = registerNotificationListeners();
    return cleanup;
  }, []);

  // Handle deep links (fuelgood:// scheme and universal links)
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      if (!url) return;
      try {
        const parsed = new URL(url);
        const path = parsed.pathname || parsed.host || '';
        if (path.startsWith('/recipe/') || path.startsWith('recipe/')) {
          const id = path.replace(/^\/?recipe\//, '');
          if (id) router.push(`/cook/${id}` as any);
        } else if (path === '/scan' || path === 'scan') {
          router.push('/scan/' as any);
        } else if (path === '/subscribe' || path === 'subscribe') {
          router.push('/subscribe' as any);
        } else if (path === '/meal-plan' || path === 'meal-plan') {
          router.push('/(tabs)/(meals)' as any);
        }
        analytics.trackEvent('deep_link_opened', { url, path });
      } catch {
        // Malformed URL — ignore.
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    // Handle the URL that launched the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (token) {
      syncPushTokenWithBackend().catch(() => {});
    }
  }, [token]);

  // Identify user for analytics once profile is available
  useEffect(() => {
    if (user?.id) {
      analytics.identify(String(user.id), { email: user.email });
    }
  }, [user?.id]);

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

    // Freemium: the app is open to all authenticated users. The real-food
    // pillar (tracker, scanner, logging, curated meals) is free; premium
    // surfaces (Metabolic Score, Coach, meal plans) gate at the feature
    // level and the backend enforces with 402s.

    // Force re-sync if the entitlement period has expired (stale check)
    if (user?.entitlement && isEntitlementStale(user.entitlement)) {
      billingApi.sync(false).then((status) => {
        if (status?.entitlement) {
          useAuthStore.getState().setEntitlement(status.entitlement);
        }
      }).catch(() => {});
    }

    // Bounce away from auth screens once signed in. /subscribe stays
    // reachable for everyone — it's the upgrade surface, not a gate.
    if (isAuthRoute) {
      router.replace('/(tabs)' as any);
    }
  }, [isAuthenticated, isLoading, isBillingLoading, pathname, currentRootSegment, isOnboardingRoute, user?.flavor_preferences?.length, user?.dietary_preferences?.length]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — sync streak & track
        analytics.trackEvent('app_opened');
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

  // Hide splash screen once auth loading is complete
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <ErrorBoundary>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <OfflineBanner />
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
            headerShown: false,
            presentation: 'modal',
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
          name="meal-plan-builder"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </ErrorBoundary>
  );
}

export default wrapWithSentry(RootLayout);

const styles = StyleSheet.create({
  loadingScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
