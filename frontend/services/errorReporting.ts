import { API_URL, APP_ENV, APP_VERSION, CLIENT_ERROR_REPORTING_ENABLED, RELEASE_CHANNEL, SENTRY_DSN } from '../constants/Config';

type ClientErrorPayload = {
  message: string;
  source: 'global_js' | 'promise' | 'api' | 'ui' | 'securestore' | 'telemetry' | 'stream';
  isFatal?: boolean;
  stack?: string;
  context?: Record<string, unknown>;
};

let initialized = false;
let _Sentry: typeof import('@sentry/react-native') | null = null;

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

  // Report to Sentry if available
  if (_Sentry) {
    try {
      if (payload.isFatal || payload.source === 'global_js') {
        _Sentry.captureException(new Error(payload.message), {
          tags: { source: payload.source },
          extra: payload.context,
        });
      } else {
        _Sentry.captureMessage(payload.message, {
          level: 'error',
          tags: { source: payload.source },
          extra: payload.context,
        });
      }
    } catch {
      // Sentry reporting failed — fall through to backend telemetry.
    }
  }

  // Also report to backend telemetry endpoint (belt and suspenders)
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

/** Add a Sentry breadcrumb for crash context (e.g. from analytics events). */
export function addBreadcrumb(category: string, message: string, data?: Record<string, any>): void {
  if (!_Sentry) return;
  _Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

export function initializeErrorReporting(): void {
  if (initialized || !CLIENT_ERROR_REPORTING_ENABLED) return;
  initialized = true;

  // Initialize Sentry if DSN is configured
  if (SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/react-native');
      Sentry.init({
        dsn: SENTRY_DSN,
        release: APP_VERSION,
        environment: APP_ENV,
        tracesSampleRate: APP_ENV === 'production' ? 0.2 : 1.0,
        enableAutoSessionTracking: true,
        debug: APP_ENV === 'development',
      });
      _Sentry = Sentry;
    } catch {
      // Sentry SDK not available (e.g. Expo Go) — continue with backend-only reporting.
    }
  }

  // Keep the existing global JS error handler as a fallback
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

/** Wrap a React component tree with Sentry's error boundary for automatic crash capture. */
export function wrapWithSentry<P extends Record<string, any>>(component: React.ComponentType<P>): React.ComponentType<P> {
  if (!_Sentry?.wrap) return component;
  return _Sentry.wrap(component);
}
