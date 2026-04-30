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
        // Pass-6 P0 #1 (worst single audit finding): tab transitions had ZERO motion.
        // 'shift' enables React Navigation 7's horizontal slide between tabs (~250ms,
        // outgoing slides toward inactive direction, incoming slides in from active).
        // RN 7.x BottomTabs respects iOS Reduce Motion automatically — no extra guard
        // needed. If 'shift' feels too aggressive, swap to 'fade' for a subtler cue.
        animation: 'shift',
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
