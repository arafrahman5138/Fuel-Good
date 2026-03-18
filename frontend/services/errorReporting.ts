import { API_URL, APP_ENV, APP_VERSION, CLIENT_ERROR_REPORTING_ENABLED, RELEASE_CHANNEL } from '../constants/Config';

type ClientErrorPayload = {
  message: string;
  source: 'global_js' | 'promise' | 'api' | 'ui' | 'securestore' | 'telemetry' | 'stream';
  isFatal?: boolean;
  stack?: string;
  context?: Record<string, unknown>;
};

let initialized = false;

function serializeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return {
    message: 'Unknown error',
    stack: JSON.stringify(error),
  };
}

export async function reportClientError(payload: ClientErrorPayload): Promise<void> {
  if (!CLIENT_ERROR_REPORTING_ENABLED) return;

  try {
    await fetch(`${API_URL}/telemetry/client-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        app_env: APP_ENV,
        app_version: APP_VERSION,
        release_channel: RELEASE_CHANNEL,
        occurred_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Avoid recursive failures from the error reporter itself.
  }
}

export function initializeErrorReporting(): void {
  if (initialized || !CLIENT_ERROR_REPORTING_ENABLED) return;
  initialized = true;

  const globalErrorUtils = (globalThis as any).ErrorUtils;
  if (!globalErrorUtils?.getGlobalHandler || !globalErrorUtils?.setGlobalHandler) {
    return;
  }

  const defaultHandler = globalErrorUtils.getGlobalHandler();
  globalErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const serialized = serializeError(error);
    void reportClientError({
      source: 'global_js',
      isFatal,
      message: serialized.message,
      stack: serialized.stack,
    });

    if (typeof defaultHandler === 'function') {
      defaultHandler(error, isFatal);
    }
  });
}

export function captureUiError(error: unknown, context?: Record<string, unknown>): void {
  const serialized = serializeError(error);
  void reportClientError({
    source: 'ui',
    message: serialized.message,
    stack: serialized.stack,
    context,
  });
}
