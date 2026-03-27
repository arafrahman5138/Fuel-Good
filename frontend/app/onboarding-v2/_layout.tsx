import { Stack } from 'expo-router';

export default function OnboardingV2Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        gestureEnabled: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    />
  );
}
