import { useCallback, useRef } from 'react';
import { trackBehaviorEvent } from '../../services/notifications';

export function useOnboardingAnalytics() {
  const screenStartRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());

  const trackScreenView = useCallback((screenNumber: number, screenName: string) => {
    screenStartRef.current = Date.now();
    trackBehaviorEvent('onboarding_screen_viewed', {
      screen_number: screenNumber,
      screen_name: screenName,
    });
  }, []);

  const trackScreenExit = useCallback((screenNumber: number) => {
    const duration = Date.now() - screenStartRef.current;
    trackBehaviorEvent('onboarding_screen_time', {
      screen_number: screenNumber,
      duration_ms: duration,
    });
  }, []);

  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    trackBehaviorEvent(event, properties);
  }, []);

  const getSessionDuration = useCallback(() => {
    return Date.now() - sessionStartRef.current;
  }, []);

  return {
    trackScreenView,
    trackScreenExit,
    trackEvent,
    getSessionDuration,
  };
}
