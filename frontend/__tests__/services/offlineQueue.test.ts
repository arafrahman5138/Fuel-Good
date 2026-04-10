import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineQueue } from '../../services/offlineQueue';

jest.mock('../../services/errorReporting', () => ({
  reportClientError: jest.fn(),
  initializeErrorReporting: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

const QUEUE_KEY = 'fuelgood.offline_queue.v1';
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(async () => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
});

describe('offlineQueue', () => {
  describe('enqueue', () => {
    it('stores a request in AsyncStorage', async () => {
      await offlineQueue.enqueue('POST', 'https://api.test/meals', { Authorization: 'Bearer x' }, '{"name":"test"}');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        QUEUE_KEY,
        expect.stringContaining('"method":"POST"'),
      );
    });

    it('deduplicates identical requests', async () => {
      // Simulate first enqueue saving to storage
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([{
          id: '1', method: 'POST', url: 'https://api.test/meals',
          headers: {}, body: '{"name":"test"}', retries: 0, createdAt: new Date().toISOString(),
        }]),
      );

      await offlineQueue.enqueue('POST', 'https://api.test/meals', {}, '{"name":"test"}');

      // setItem should NOT be called because it's a duplicate
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('allows different requests', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([{
          id: '1', method: 'POST', url: 'https://api.test/meals',
          headers: {}, body: '{"name":"test"}', retries: 0, createdAt: new Date().toISOString(),
        }]),
      );

      await offlineQueue.enqueue('PUT', 'https://api.test/meals/1', {}, '{"name":"updated"}');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('replays queued requests and clears on success', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([{
          id: '1', method: 'POST', url: 'https://api.test/meals',
          headers: { 'Content-Type': 'application/json' },
          body: '{"name":"test"}', retries: 0, createdAt: new Date().toISOString(),
        }]),
      );

      const result = await offlineQueue.flush();

      expect(mockFetch).toHaveBeenCalledWith('https://api.test/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      });
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('returns 0/0 when queue is empty', async () => {
      const result = await offlineQueue.flush();
      expect(result).toEqual({ succeeded: 0, failed: 0 });
    });

    it('keeps failed requests with retries under max', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([{
          id: '1', method: 'POST', url: 'https://api.test/meals',
          headers: {}, body: null, retries: 0, createdAt: new Date().toISOString(),
        }]),
      );

      const result = await offlineQueue.flush();
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);

      // Should save the remaining queue
      const savedQueue = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].retries).toBe(1);
    });

    it('drops requests after max retries', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([{
          id: '1', method: 'POST', url: 'https://api.test/meals',
          headers: {}, body: null, retries: 2, createdAt: new Date().toISOString(),
        }]),
      );

      const result = await offlineQueue.flush();
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0); // dropped, not "failed"
    });
  });

  describe('size', () => {
    it('returns 0 for empty queue', async () => {
      expect(await offlineQueue.size()).toBe(0);
    });

    it('returns count of queued items', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { id: '1', method: 'POST', url: 'u', headers: {}, body: null, retries: 0, createdAt: '' },
          { id: '2', method: 'PUT', url: 'u2', headers: {}, body: null, retries: 0, createdAt: '' },
        ]),
      );
      expect(await offlineQueue.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes the queue from storage', async () => {
      await offlineQueue.clear();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY);
    });
  });
});
