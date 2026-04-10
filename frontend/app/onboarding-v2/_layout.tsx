import { useEffect, useRef } from 'react';
import { Stack, usePathname } from 'expo-router';
import { analytics } from '../../services/analytics';

const ONBOARDING_STEPS = [
  'index', 'goal-context', 'meal-reveal', 'energy-check', 'video-hook',
  'attribution', 'social-proof', 'live-scan', 'diet-history', 'mirror',
  'generating-plan', 'commitment', 'plan-preview', 'notification-permission', 'paywall',
];

export default function OnboardingV2Layout() {
  const pathname = usePathname();
  const tracked = useRef(false);

  // Track onboarding_started once
  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      analytics.trackFunnel('onboarding', 'started');
    }
  }, []);

  // Track each step as user progresses
  useEffect(() => {
    const step = pathname.split('/').pop() || 'index';
    const stepIndex = ONBOARDING_STEPS.indexOf(step);
    analytics.trackFunnel('onboarding', `step_${step}`, {
      step_index: stepIndex >= 0 ? stepIndex : undefined,
    });
  }, [pathname]);

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
