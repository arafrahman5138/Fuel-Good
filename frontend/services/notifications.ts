import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { APP_VERSION, EXPO_PROJECT_ID } from '../constants/Config';
import { notificationsApi } from './api';
import { reportClientError } from './errorReporting';
import { useAuthStore } from '../stores/authStore';

const PUSH_PROMPT_KEY = 'push_prompt_requested_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isNativePushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getProjectId(): string | undefined {
  return EXPO_PROJECT_ID || (Constants.expoConfig?.extra as any)?.eas?.projectId;
}

export async function syncPushTokenWithBackend(): Promise<void> {
  if (!isNativePushSupported() || !useAuthStore.getState().token) return;

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') return;

  const projectId = getProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await notificationsApi.registerPushToken({
    expo_push_token: tokenResponse.data,
    device_id: String(Constants.sessionId || Constants.installationId || 'device'),
    platform: Platform.OS,
    app_version: APP_VERSION,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
  });
}

export async function maybePromptForPush(trigger: 'meal_plan' | 'save_recipe' | 'streak'): Promise<boolean> {
  if (!isNativePushSupported() || !useAuthStore.getState().token) return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    await syncPushTokenWithBackend();
    return true;
  }
  if (existing.status === 'denied') {
    return false;
  }

  const requestedBefore = await AsyncStorage.getItem(PUSH_PROMPT_KEY);
  if (requestedBefore && trigger !== 'meal_plan') {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  await AsyncStorage.setItem(PUSH_PROMPT_KEY, '1');
  if (requested.status !== 'granted') {
    return false;
  }

  await syncPushTokenWithBackend();
  return true;
}

const ALLOWED_ROUTE_PREFIXES = [
  '/(tabs)/',
  '/food/',
  '/cook/',
  '/browse/',
  '/scan/',
  '/saved',
  '/subscribe',
  '/settings',
];

function routeFromNotification(data: Record<string, any>): string {
  const route = typeof data?.route === 'string' ? data.route.trim() : '';
  if (!route) return '/(tabs)/index';
  const isAllowed = ALLOWED_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix));
  return isAllowed ? route : '/(tabs)/index';
}

export function registerNotificationListeners(): () => void {
  if (!isNativePushSupported()) {
    return () => {};
  }

  const responseSub = Notifications.addNotificationResponseReceivedListener((response: NotificationResponse) => {
    const data = (response.notification.request.content.data || {}) as Record<string, any>;
    const route = routeFromNotification(data);
    const deliveryId = typeof data.delivery_id === 'string' ? data.delivery_id : undefined;

    notificationsApi.ingestEvent('notification_opened', {
      delivery_id: deliveryId,
      category: data.category,
      route,
    }).catch((err: any) => {
      void reportClientError({ source: 'telemetry', message: 'notification_opened event failed', context: { error: err?.message } });
    });

    router.push(route as any);

    notificationsApi.ingestEvent('notification_deep_linked', {
      delivery_id: deliveryId,
      category: data.category,
      route,
    }).catch((err: any) => {
      void reportClientError({ source: 'telemetry', message: 'notification_deep_linked event failed', context: { error: err?.message } });
    });
  });

  return () => {
    responseSub.remove();
  };
}

export function trackBehaviorEvent(eventType: string, properties: Record<string, any> = {}): void {
  const now = new Date();
  notificationsApi.ingestEvent(eventType, {
    ...properties,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    local_hour: now.getHours(),
  }).catch((err: any) => {
    void reportClientError({ source: 'telemetry', message: `${eventType} event failed`, context: { error: err?.message } });
  });
}
