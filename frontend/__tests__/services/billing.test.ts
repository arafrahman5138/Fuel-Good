/**
 * Tests for billing service utility functions.
 * We test the exported billingService methods that don't require
 * actual RevenueCat SDK connectivity.
 */
import { Platform } from 'react-native';

// Mock analytics
jest.mock('../../services/analytics', () => ({
  analytics: {
    init: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    trackEvent: jest.fn(),
    trackScreen: jest.fn(),
    trackFunnel: jest.fn(),
    isActive: jest.fn(() => false),
  },
}));

import { billingService } from '../../services/billing';

describe('billingService', () => {
  describe('isSupported', () => {
    it('returns true on iOS', () => {
      // Platform is mocked as 'ios' by jest-expo default
      expect(billingService.isSupported()).toBe(Platform.OS === 'ios');
    });
  });

  describe('isConfiguredForBuild', () => {
    it('returns a boolean', () => {
      const result = billingService.isConfiguredForBuild();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isUserCancelledPurchase', () => {
    it('returns true for userCancelled errors', () => {
      expect(billingService.isUserCancelledPurchase({ userCancelled: true })).toBe(true);
    });

    it('returns false for non-cancelled errors', () => {
      expect(billingService.isUserCancelledPurchase(new Error('network'))).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(billingService.isUserCancelledPurchase(null)).toBe(false);
      expect(billingService.isUserCancelledPurchase(undefined)).toBe(false);
    });

    it('returns false for strings', () => {
      expect(billingService.isUserCancelledPurchase('error')).toBe(false);
    });
  });
});
