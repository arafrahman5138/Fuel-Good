/**
 * Regression test: /scan/smart must get the long AI timeout.
 * A 15s default timeout aborts label scans that legitimately take 9-14s+.
 */

jest.mock('../../services/errorReporting', () => ({
  reportClientError: jest.fn(),
  initializeErrorReporting: jest.fn(),
}));

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

import { api } from '../../services/api';

describe('scan endpoint timeouts', () => {
  const getTimeout = (endpoint: string): number => (api as any).getTimeout(endpoint);

  it('gives AI endpoints the 90s timeout', () => {
    expect(getTimeout('/scan/smart')).toBe(90000);
    expect(getTimeout('/scan/meal')).toBe(90000);
    expect(getTimeout('/scan/meal/stream')).toBe(90000);
    expect(getTimeout('/scan/product/image')).toBe(90000);
  });

  it('keeps the short default for non-AI endpoints', () => {
    expect(getTimeout('/scan/product/barcode/012345')).toBe(15000);
    expect(getTimeout('/fuel/settings')).toBe(15000);
  });
});
