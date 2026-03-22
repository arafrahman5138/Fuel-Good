import { API_URL } from '../constants/Config';
import { useAuthStore } from '../stores/authStore';
import * as SecureStore from 'expo-secure-store';
import { reportClientError } from './errorReporting';

class ApiClient {
  private baseUrl: string;
  private defaultTimeout = 15000; // 15 seconds
  private aiTimeout = 60000; // 60 seconds for AI calls
  private maxRetries = 1;

  constructor() {
    this.baseUrl = API_URL;
  }

  private getHeaders(): Record<string, string> {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private getTimeout(endpoint: string): number {
    // AI endpoints get longer timeout
    if (
      endpoint.includes('/chat/')
      || endpoint.includes('/meal-plans/generate')
      || endpoint.includes('/healthify')
      || endpoint.includes('/scan/meal')
      || endpoint.includes('/scan/product/image')
    ) {
      return this.aiTimeout;
    }
    return this.defaultTimeout;
  }

  private getUploadHeaders(): Record<string, string> {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private isRetryable(status: number): boolean {
    return status >= 500 || status === 408 || status === 429;
  }

  private shouldTreat401AsSessionExpiry(endpoint: string): boolean {
    return !(
      endpoint === '/auth/login'
      || endpoint === '/auth/register'
      || endpoint === '/auth/social'
      || endpoint === '/auth/refresh'
    );
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    endpoint: string,
  ): Promise<Response> {
    const timeout = this.getTimeout(endpoint);
    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options, timeout);

        // Don't retry client errors (4xx) except retryable ones
        if (!response.ok && this.isRetryable(response.status) && attempt < this.maxRetries) {
          // Exponential backoff: 1s on first retry
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        return response;
      } catch (err: any) {
        lastError = err;
        if (attempt < this.maxRetries && !err?.message?.includes('session has expired')) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries.');
  }

  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Try to silently refresh tokens using the stored refresh_token.
   * Returns true if refresh succeeded, false otherwise.
   */
  private async tryRefresh(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const refreshToken = useAuthStore.getState().refreshToken
          || await SecureStore.getItemAsync('refresh_token', {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            keychainService: 'com.fuelgood.auth',
          });
        if (!refreshToken) return false;

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) return false;

        const tokens = await response.json();
        useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  private async parseAndThrow(response: Response, endpoint: string): Promise<never> {
    const error = await response.json().catch(() => ({}));
    const requestId = response.headers.get('x-request-id') || undefined;

    if (response.status === 401 && this.shouldTreat401AsSessionExpiry(endpoint)) {
      useAuthStore.getState().logout();
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (response.status === 429) {
      throw new Error('You\'re sending requests too quickly. Please wait a moment and try again.');
    }

    if (response.status === 503) {
      throw new Error('This feature is temporarily unavailable. Please try again in a few minutes.');
    }

    if (response.status >= 500) {
      void reportClientError({
        source: 'api',
        message: `Server error ${response.status}`,
        context: {
          detail: error.detail || null,
          status: response.status,
          requestId,
          endpoint,
        },
      });
      throw new Error('Something went wrong on our end. Please try again.');
    }

    // Client errors (4xx) - use the server's detail message if available
    const userMessage = error.detail && typeof error.detail === 'string' && !error.detail.includes('/')
      ? error.detail
      : 'This request could not be completed. Please check your input and try again.';
    throw new Error(userMessage);
  }

  /**
   * Wrapper that retries a request once after a silent token refresh on 401.
   */
  private async requestWithRefresh<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const doFetch = () =>
      this.fetchWithRetry(
        `${this.baseUrl}${endpoint}`,
        {
          method,
          headers: this.getHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        },
        endpoint,
      );

    let response = await doFetch();

    // On 401, try a silent refresh and retry once
    if (response.status === 401 && this.shouldTreat401AsSessionExpiry(endpoint)) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        response = await doFetch();
      }
    }

    if (!response.ok) await this.parseAndThrow(response, endpoint);
    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.requestWithRefresh<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.requestWithRefresh<T>('POST', endpoint, body);
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.requestWithRefresh<T>('PUT', endpoint, body);
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.requestWithRefresh<T>('PATCH', endpoint, body);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.requestWithRefresh<T>('DELETE', endpoint);
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const doFetch = () =>
      this.fetchWithRetry(
        `${this.baseUrl}${endpoint}`,
        {
          method: 'POST',
          headers: this.getUploadHeaders(),
          body: formData,
        },
        endpoint,
      );

    let response = await doFetch();
    if (response.status === 401 && this.shouldTreat401AsSessionExpiry(endpoint)) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        response = await doFetch();
      }
    }

    if (!response.ok) await this.parseAndThrow(response, endpoint);
    return response.json();
  }

  async stream(
    endpoint: string,
    body: unknown,
    onChunk: (text: string) => void,
    onDone?: (data: any) => void,
  ): Promise<void> {
    const timeout = this.aiTimeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      let response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // On 401, try silent refresh and retry
      if (response.status === 401) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Stream failed: ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                if (data.error) {
                  throw new Error(data.error);
                }
                onDone?.(data);
              } else if (data.content) {
                onChunk(data.content);
              }
            } catch (parseErr: any) {
              if (parseErr?.message && !parseErr.message.includes('JSON')) {
                throw parseErr;
              }
              void reportClientError({
                source: 'stream',
                message: 'SSE parse error',
                context: { line, error: parseErr?.message },
              });
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Streaming request timed out.');
      }
      void reportClientError({
        source: 'api',
        message: err?.message || 'Streaming request failed',
        stack: err?.stack,
        context: { endpoint },
      });
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const api = new ApiClient();

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ access_token: string; refresh_token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; refresh_token: string }>('/auth/login', data),
  requestPasswordReset: (data: { email: string }) =>
    api.post<{ message: string; reset_token?: string; expires_in_minutes?: number }>('/auth/forgot-password', data),
  resetPassword: (data: { token: string; new_password: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data),
  socialAuth: (data: { provider: string; token: string; name?: string; email?: string; provider_subject?: string }) =>
    api.post<{ access_token: string; refresh_token: string }>('/auth/social', data),
  refresh: (refreshToken: string) =>
    api.post<{ access_token: string; refresh_token: string }>('/auth/refresh', { refresh_token: refreshToken }),
  getProfile: () => api.get<any>('/auth/me'),
  updatePreferences: (data: any) => api.put('/auth/preferences', data),
  deleteAccount: () => api.delete<{ message: string }>('/auth/account'),
};

export const billingApi = {
  getConfig: () => api.get<any>('/billing/config'),
  getStatus: () => api.get<{ entitlement: any }>('/billing/status'),
  sync: (force = true) => api.post<{ entitlement: any }>('/billing/sync', { force }),
};

export interface ChatContext {
  source?: string; // "scan" | "recipe" | "home" | "flex" | "photo"
  scan_result?: {
    meal_label?: string;
    fuel_score?: number;
    whole_food_flags?: Array<{ ingredient: string; reason: string; severity: string }>;
  };
  recipe_id?: string;
  flex_status?: { earned: number; remaining: number; weekly_avg?: number };
  image_base64?: string; // base64-encoded image for photo-based chat
  image_type?: string; // "auto" | "fridge" | "meal" | "grocery" | "label"
}

export const chatApi = {
  healthify: (message: string, sessionId?: string, context?: ChatContext) =>
    api.post<any>('/chat/healthify', { message, session_id: sessionId, context: context ?? null }),
  streamHealthify: (
    message: string,
    sessionId: string | undefined,
    onChunk: (t: string) => void,
    onDone?: (d: any) => void,
    context?: ChatContext,
  ) =>
    api.stream('/chat/healthify/stream', { message, session_id: sessionId, context: context ?? null }, onChunk, onDone),
  getSessions: () => api.get<any[]>('/chat/sessions'),
  getSession: (id: string) => api.get<any>(`/chat/sessions/${id}`),
  deleteSession: (id: string) => api.delete(`/chat/sessions/${id}`),
  getSuggestions: () => api.get<{ label: string; query: string }[]>('/chat/suggestions'),
};

export const mealPlanApi = {
  generate: (data?: any) => api.post<any>('/meal-plans/generate', data || {}),
  shortlist: (data?: any) => api.post<any>('/meal-plans/shortlist', data || {}),
  getCurrent: () => api.get<any>('/meal-plans/current'),
  getHistory: () => api.get<any[]>('/meal-plans/history'),
  getAlternatives: (itemId: string) => api.get<any>(`/meal-plans/items/${itemId}/alternatives`),
  replaceMeal: (itemId: string, recipe_id: string) => api.post<any>(`/meal-plans/items/${itemId}/replace`, { recipe_id }),
  updateItemServings: (itemId: string, servings: number) => api.patch<any>(`/meal-plans/items/${itemId}`, { servings }),
};

export const groceryApi = {
  generate: (mealPlanId: string) =>
    api.post<any>('/grocery/generate', { meal_plan_id: mealPlanId }),
  getCurrent: () => api.get<any>('/grocery/current'),
};

export const foodApi = {
  search: (q: string, page?: number) =>
    api.get<any>(`/foods/search?q=${encodeURIComponent(q)}&page=${page || 1}`),
  getDetail: (id: string) => api.get<any>(`/foods/${id}`),
};

export const wholeFoodScanApi = {
  analyzeBarcode: (barcode: string) =>
    api.get<any>(`/scan/product/barcode/${encodeURIComponent(barcode)}`),
  analyzeProductImage: (data: {
    imageUri: string;
    capture_type?: 'ingredients' | 'nutrition' | 'front_label';
  }) => {
    const form = new FormData();
    form.append('image', {
      uri: data.imageUri,
      name: 'product-scan.jpg',
      type: 'image/jpeg',
    } as any);
    if (data.capture_type) form.append('capture_type', data.capture_type);
    return api.upload<any>('/scan/product/image', form);
  },
  analyzeLabel: (data: {
    product_name?: string;
    brand?: string;
    barcode?: string;
    ingredients_text: string;
    calories?: number;
    protein_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    carbs_g?: number;
    sodium_mg?: number;
    source?: string;
  }) => api.post<any>('/scan/product/analyze', data),
  analyzeMeal: (data: {
    imageUri: string;
    meal_type?: string;
    portion_size?: string;
    source_context?: string;
  }) => {
    const form = new FormData();
    form.append('image', {
      uri: data.imageUri,
      name: 'meal-scan.jpg',
      type: 'image/jpeg',
    } as any);
    if (data.meal_type) form.append('meal_type', data.meal_type);
    if (data.portion_size) form.append('portion_size', data.portion_size);
    if (data.source_context) form.append('source_context', data.source_context);
    return api.upload<any>('/scan/meal', form);
  },
  updateMeal: (scanId: string, data: {
    meal_label: string;
    meal_type: string;
    portion_size: string;
    source_context: string;
    ingredients: string[];
  }) => api.patch<any>(`/scan/meal/${scanId}`, data),
  logMeal: (scanId: string, data?: {
    date?: string;
    meal_type?: string;
    servings?: number;
    quantity?: number;
    include_recommended_pairing?: boolean;
  }) => {
    const d = new Date();
    const localDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return api.post<any>(`/scan/meal/${scanId}/log`, { date: localDate, ...(data || {}) });
  },
  correctMeal: (scanId: string, correctionText: string) =>
    api.patch<any>(`/scan/meal/${scanId}/correct`, { correction_text: correctionText }),
};

// ── Fuel Score API ──
export const fuelApi = {
  getSettings: () => api.get<any>('/fuel/settings'),
  updateSettings: (data: { fuel_target?: number; expected_meals_per_week?: number; clean_eating_pct?: number }) =>
    api.put<any>('/fuel/settings', data),
  getDaily: (date?: string) =>
    api.get<any>(`/fuel/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getWeekly: (date?: string) =>
    api.get<any>(`/fuel/weekly${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getStreak: () => api.get<any>('/fuel/streak'),
  getHealthPulse: (date?: string) =>
    api.get<any>(`/fuel/health-pulse${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getCalendar: (month?: string) =>
    api.get<any>(`/fuel/calendar${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  getFlexSuggestions: (date?: string) =>
    api.get<any>(`/fuel/flex-suggestions${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  logManualFlex: (data: { meal_type?: string; tag?: string; date?: string }) =>
    api.post<any>('/fuel/flex-log', data),
};

export const recipeApi = {
  browse: (params: Record<string, string | number | undefined>) => {
    const qs = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return api.get<any>(`/recipes/browse?${qs}`);
  },
  getFilters: () => api.get<any>('/recipes/filters'),
  getDetail: (id: string) => api.get<any>(`/recipes/${id}`),
  substitute: (
    id: string,
    data?: { use_allergies?: boolean; use_dislikes?: boolean; custom_excludes?: string[] }
  ) => api.post<any>(`/recipes/${id}/substitute`, {
    use_allergies: data?.use_allergies ?? true,
    use_dislikes: data?.use_dislikes ?? true,
    custom_excludes: data?.custom_excludes ?? [],
  }),
  getSaved: () => api.get<any>('/recipes/saved/list'),
  saveGenerated: (recipe: {
    title: string;
    description?: string;
    ingredients?: Array<{ name: string; quantity?: string | number; unit?: string }>;
    steps?: string[];
    prep_time_min?: number;
    cook_time_min?: number;
    servings?: number;
    difficulty?: string;
    tags?: string[];
    flavor_profile?: string[];
    dietary_tags?: string[];
    cuisine?: string;
    health_benefits?: string[];
    nutrition_info?: Record<string, number>;
  }) =>
    api.post<any>('/recipes/saved', recipe),
  save: (id: string) => api.post<any>(`/recipes/saved/${id}`),
  unsave: (id: string) => api.delete<any>(`/recipes/saved/${id}`),
  getCookHelp: (recipeId: string, stepNumber: number, question?: string) =>
    api.post<{ answer: string }>(`/recipes/${recipeId}/cook-help`, {
      step_number: stepNumber,
      question: question || '',
    }),
  // Pairing suggestions — sides/components to improve MES
  getPairingSuggestions: (recipeId: string, limit?: number, sideType?: string) => {
    const params: string[] = [`recipe_id=${encodeURIComponent(recipeId)}`];
    if (limit) params.push(`limit=${limit}`);
    if (sideType) params.push(`side_type=${encodeURIComponent(sideType)}`);
    return api.get<any[]>(`/metabolic/pairings/suggestions?${params.join('&')}`);
  },
};

export const nutritionApi = {
  getTargets: () => api.get<any>('/nutrition/targets'),
  updateTargets: (data: any) => api.put<any>('/nutrition/targets', data),
  getDaily: (date?: string) =>
    api.get<any>(`/nutrition/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getGaps: (date?: string) =>
    api.get<any>(`/nutrition/gaps${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getLogs: (date?: string) =>
    api.get<any[]>(`/nutrition/logs${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  createLog: (data: any) => {
    if (!data.date) {
      const d = new Date();
      data = { ...data, date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` };
    }
    return api.post<any>('/nutrition/logs', data);
  },
  updateLog: (id: string, data: any) => api.patch<any>(`/nutrition/logs/${id}`, data),
  deleteLog: (id: string) => api.delete<any>(`/nutrition/logs/${id}`),
  deleteGroupLogs: (groupId: string) => api.delete<any>(`/nutrition/logs/group/${groupId}`),
};

export const gameApi = {
  getStats: () => api.get<any>('/game/stats'),
  getAchievements: () => api.get<any[]>('/game/achievements'),
  getLeaderboard: () => api.get<any[]>('/game/leaderboard'),
  getWeeklyStats: () => api.get<any>('/game/weekly-stats'),
  checkAchievements: () => api.post<any>('/game/check-achievements'),
  updateStreak: () => api.post<any>('/game/streak'),
  awardXP: (amount: number, reason: string) =>
    api.post<any>(`/game/xp?amount=${amount}&reason=${encodeURIComponent(reason)}`),
  // New nutrition gamification endpoints
  getNutritionStreak: () => api.get<any>('/game/nutrition-streak'),
  getScoreHistory: (days?: number) =>
    api.get<any[]>(`/game/score-history${days ? `?days=${days}` : ''}`),
  getDailyQuests: () => api.get<any[]>('/game/daily-quests'),
  updateQuestProgress: (questId: string, amount?: number) =>
    api.post<any>(`/game/daily-quests/${questId}/progress${amount ? `?amount=${amount}` : ''}`),
};

export const notificationsApi = {
  registerPushToken: (data: { expo_push_token: string; device_id?: string; platform: string; app_version: string; timezone?: string }) =>
    api.post<any>('/notifications/push-token', data),
  removePushToken: (tokenId: string) =>
    api.delete<any>(`/notifications/push-token/${tokenId}`),
  getPreferences: () => api.get<any>('/notifications/preferences'),
  updatePreferences: (data: any) => api.patch<any>('/notifications/preferences', data),
  test: (data?: any) => api.post<any>('/notifications/test', data || {}),
  ingestEvent: (event_type: string, properties?: Record<string, any>, source = 'client') =>
    api.post<any>('/notifications/events', { event_type, properties: properties || {}, source }),
};

// ── Metabolic Budget API ──
export const metabolicApi = {
  // Budget
  getBudget: () => api.get<any>('/metabolic/budget'),
  updateBudget: (data: any) => api.put<any>('/metabolic/budget', data),

  // Profile / Onboarding
  getProfile: () => api.get<any>('/metabolic/profile'),
  saveProfile: (data: any) => api.post<any>('/metabolic/profile', data),
  patchProfile: (data: any) => api.patch<any>('/metabolic/profile', data),
  recalculateProfile: () => api.post<any>('/metabolic/profile/recalculate'),

  // Scores
  getDailyScore: (date?: string) =>
    api.get<any>(`/metabolic/score/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getMealScores: (date?: string) =>
    api.get<any[]>(`/metabolic/score/meals${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getScoreHistory: (days?: number) =>
    api.get<any[]>(`/metabolic/score/history${days ? `?days=${days}` : ''}`),
  previewMeal: (data: { protein_g: number; fiber_g: number; sugar_g?: number; carbs_g?: number; calories?: number }, date?: string) =>
    api.post<any>(`/metabolic/score/preview${date ? `?date=${encodeURIComponent(date)}` : ''}`, data),

  // Meal suggestions — recipes that fit remaining budget
  getMealSuggestions: (date?: string, limit?: number) => {
    const params: string[] = [];
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (limit) params.push(`limit=${limit}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return api.get<any[]>(`/metabolic/meal-suggestions${qs}`);
  },

  // Streak
  getStreak: () => api.get<any>('/metabolic/streak'),

  // Remaining budget
  getRemainingBudget: (date?: string) =>
    api.get<any>(`/metabolic/remaining-budget${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  // Composite MES — score multiple food logs as one meal
  getCompositeMES: (foodLogIds: string[]) =>
    api.post<any>('/metabolic/score/composite', { food_log_ids: foodLogIds }),

  // Composite MES preview — score multiple recipes before logging
  previewCompositeMES: (recipeIds: string[], servings?: number[]) =>
    api.post<any>('/metabolic/score/preview-composite', {
      recipe_ids: recipeIds,
      servings: servings || recipeIds.map(() => 1),
    }),

  // Coach insights — personalized insights + food suggestions
  getCoachInsights: (date?: string) =>
    api.get<any>(`/metabolic/coach-insights${date ? `?date=${encodeURIComponent(date)}` : ''}`),
};
