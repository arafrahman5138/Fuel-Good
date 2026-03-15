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
  const isOnboardingRoute = isAuthRoute && segments[1] === 'onboarding';
  const isSubscribeRoute = pathname === '/subscribe';
  const canAccessWithoutPremium = isAuthRoute || isSubscribeRoute || pathname === '/';

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

  useEffect(() => {
    if (!token || !user?.id) return;

    let active = true;
    setBillingLoading(true);

    billingService.bootstrap(user.id, user.email, user.name)
      .then(async () => {
        const status = await billingApi.sync(false).catch(() => null);
        if (status?.entitlement && active) {
          setEntitlement(status.entitlement);
        }
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
    if (isLoading || isBillingLoading) return;

    const needsOnboarding = Boolean(
      isAuthenticated && (!user?.flavor_preferences?.length || !user?.dietary_preferences?.length)
    );

    if (!isAuthenticated) {
      if (!isAuthRoute) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (needsOnboarding) {
      if (!isOnboardingRoute) {
        router.replace('/(auth)/onboarding' as any);
      }
      return;
    }

    if (!hasPremiumAccess) {
      if (!canAccessWithoutPremium) {
        router.replace('/subscribe');
      }
      return;
    }

    if (isSubscribeRoute || isAuthRoute) {
      router.replace('/(tabs)' as any);
    }
  }, [isAuthenticated, isLoading, isBillingLoading, hasPremiumAccess, pathname, currentRootSegment, isOnboardingRoute, user?.flavor_preferences?.length, user?.dietary_preferences?.length]);

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
      {(isLoading || isBillingLoading) ? (
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
