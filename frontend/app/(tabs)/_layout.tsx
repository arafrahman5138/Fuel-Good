import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { FontSize } from '../../constants/Colors';
import { useAuthStore } from '../../stores/authStore';
import { GlassTabBar } from '../../components/GlassTabBar';

export default function TabLayout() {
  const theme = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!user) {
    return null;
  }

  const needsOnboarding =
    !user.flavor_preferences?.length || !user.dietary_preferences?.length;

  if (needsOnboarding) {
    return <Redirect href={"/(auth)/onboarding" as any} />;
  }

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Pass-6 P0 #1: tab transitions need a motion cue (zero motion was the worst
        // single audit finding). Pass-8 P1 #1: under rapid navigation churn, 'shift'
        // (native scene translate/detach) intermittently left a scene detached/at
        // opacity 0 — tab bar alive, content permanently blank, no JS error for the
        // ErrorBoundary to catch. 'fade' keeps the pass-6 motion cue on the safer
        // opacity-only path; freezeOnBlur is pinned off so react-native-screens can
        // never hold a frozen scene at blank. Do NOT switch back to 'shift' without
        // re-running tasks/ui-audit-pass8/run_churn.sh (the wedge regression probe).
        animation: 'fade',
        freezeOnBlur: false,
        // Keep these for the custom bar to read
        tabBarActiveTintColor: theme.tabBar.active,
        tabBarInactiveTintColor: theme.tabBar.inactive,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chronometer"
        options={{
          title: 'Track',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
