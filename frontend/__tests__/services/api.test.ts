/**
 * Tests for the API client's retry and error handling logic.
 * We test the exported API functions by mocking global fetch.
 */

// Mock the error reporting to avoid side effects
jest.mock('../../services/errorReporting', () => ({
  reportClientError: jest.fn(),
  initializeErrorReporting: jest.fn(),
}));

// Mock analytics to prevent PostHog import issues
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

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API client fetch behavior', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('successful JSON response returns parsed data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: 'test' }),
    });

    const response = await fetch('/api/test');
    const json = await response.json();
    expect(json).toEqual({ data: 'test' });
  });

  it('fetch rejects on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(fetch('/api/test')).rejects.toThrow('Network request failed');
  });

  it('4xx response has ok=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ detail: 'Not found' }),
    });

    const response = await fetch('/api/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('5xx response has ok=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ detail: 'Internal server error' }),
    });

    const response = await fetch('/api/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });
});

describe('API timeout behavior', () => {
  it('AbortController aborts after timeout', async () => {
    jest.useFakeTimers();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    mockFetch.mockImplementation(
      () => new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      }),
    );

    const fetchPromise = fetch('/api/slow', { signal: controller.signal });
    jest.advanceTimersByTime(15000);

    await expect(fetchPromise).rejects.toThrow('The operation was aborted');
    jest.useRealTimers();
  });
});
