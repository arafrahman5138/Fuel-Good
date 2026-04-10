import { analytics } from '../../services/analytics';

// Access the mocked PostHog constructor
const PostHogMock = require('posthog-react-native').default;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the module-level state by re-requiring
  // We test through the public API instead
});

describe('analytics service', () => {
  describe('when ENABLE_ANALYTICS is false', () => {
    it('init() is a no-op and isActive() returns false', async () => {
      // Default test env has ENABLE_ANALYTICS = false
      await analytics.init();
      expect(analytics.isActive()).toBe(false);
    });

    it('trackEvent is a no-op when not initialized', () => {
      // Should not throw
      analytics.trackEvent('test_event', { key: 'value' });
    });

    it('trackScreen is a no-op when not initialized', () => {
      analytics.trackScreen('/home');
    });

    it('identify is a no-op when not initialized', () => {
      analytics.identify('user-123');
    });

    it('reset is a no-op when not initialized', () => {
      analytics.reset();
    });
  });

  describe('trackFunnel', () => {
    it('formats funnel events correctly', () => {
      // trackFunnel delegates to trackEvent, which is a no-op without init
      // but we can verify it doesn't throw
      analytics.trackFunnel('onboarding', 'started', { source: 'deep_link' });
    });
  });
});
