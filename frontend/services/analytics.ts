import { Platform } from 'react-native';
import { ENABLE_ANALYTICS, POSTHOG_API_KEY, POSTHOG_HOST } from '../constants/Config';
import { addBreadcrumb } from './errorReporting';

let _posthog: any | null = null;
let _initialized = false;

/**
 * Lightweight analytics service wrapping PostHog.
 * All calls are no-ops when ENABLE_ANALYTICS is false or POSTHOG_API_KEY is unset.
 */
export const analytics = {
  async init(): Promise<void> {
    if (_initialized || !ENABLE_ANALYTICS || !POSTHOG_API_KEY) return;
    _initialized = true;

    try {
      const PostHogModule = await import('posthog-react-native');
      const PostHog = PostHogModule.default || PostHogModule.PostHog;
      _posthog = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_HOST || 'https://us.i.posthog.com',
        flushAt: 20,
        flushInterval: 30_000,
      });
    } catch {
      // PostHog unavailable (e.g. missing native module in Expo Go) — degrade silently.
    }
  },

  identify(userId: string, properties?: Record<string, any>): void {
    if (!_posthog) return;
    _posthog.identify(userId, properties);
  },

  reset(): void {
    if (!_posthog) return;
    _posthog.reset();
  },

  trackEvent(event: string, properties?: Record<string, any>): void {
    addBreadcrumb('analytics', event, properties);
    if (!_posthog) return;
    _posthog.capture(event, {
      ...properties,
      platform: Platform.OS,
    });
  },

  trackScreen(screenName: string, properties?: Record<string, any>): void {
    addBreadcrumb('navigation', screenName, properties);
    if (!_posthog) return;
    _posthog.screen(screenName, {
      ...properties,
      platform: Platform.OS,
    });
  },

  /** Convenience: record a funnel step for named funnels. */
  trackFunnel(funnel: string, step: string, properties?: Record<string, any>): void {
    analytics.trackEvent(`${funnel}_${step}`, {
      funnel,
      step,
      ...properties,
    });
  },

  /** Returns whether the service has been initialised with a working PostHog client. */
  isActive(): boolean {
    return Boolean(_posthog);
  },
};
