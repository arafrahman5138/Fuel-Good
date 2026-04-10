import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportClientError } from './errorReporting';

const QUEUE_KEY = 'fuelgood.offline_queue.v1';
const MAX_RETRIES = 3;

interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  retries: number;
  createdAt: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedRequest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage write failed — queue will be lost on restart.
  }
}

export const offlineQueue = {
  /** Enqueue a failed mutation for later replay. */
  async enqueue(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: string | null,
  ): Promise<void> {
    const queue = await loadQueue();

    // Deduplicate: skip if an identical method+url+body is already queued
    const bodyHash = body || '';
    const isDuplicate = queue.some(
      (item) => item.method === method && item.url === url && (item.body || '') === bodyHash,
    );
    if (isDuplicate) return;

    queue.push({
      id: generateId(),
      method,
      url,
      headers,
      body,
      retries: 0,
      createdAt: new Date().toISOString(),
    });

    await saveQueue(queue);
  },

  /** Replay all queued requests. Call this when connectivity is restored. */
  async flush(): Promise<{ succeeded: number; failed: number }> {
    const queue = await loadQueue();
    if (queue.length === 0) return { succeeded: 0, failed: 0 };

    let succeeded = 0;
    const remaining: QueuedRequest[] = [];

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });

        if (response.ok || (response.status >= 400 && response.status < 500)) {
          // Success or permanent client error — remove from queue either way
          succeeded++;
        } else {
          // Server error — retry later if under max retries
          item.retries++;
          if (item.retries < MAX_RETRIES) {
            remaining.push(item);
          }
        }
      } catch {
        // Network still down or other transient error — keep in queue
        item.retries++;
        if (item.retries < MAX_RETRIES) {
          remaining.push(item);
        }
      }
    }

    await saveQueue(remaining);

    if (remaining.length > 0) {
      void reportClientError({
        source: 'api',
        message: `Offline queue: ${remaining.length} requests still pending after flush`,
      });
    }

    return { succeeded, failed: remaining.length };
  },

  /** Get the current queue size (for UI indicators). */
  async size(): Promise<number> {
    const queue = await loadQueue();
    return queue.length;
  },

  /** Clear all queued requests. */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },
};
