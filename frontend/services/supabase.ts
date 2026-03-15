import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

import { IS_SUPABASE_REALTIME_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/Config';

const supabase = IS_SUPABASE_REALTIME_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function buildFilter(column: string, value: string) {
  return `${column}=eq.${value}`;
}

export function subscribeToChronometerChanges(
  userId: string,
  dayKey: string,
  onChange: () => void,
): (() => void) | null {
  if (!supabase) return null;

  const channel = supabase.channel(`chrono:${userId}:${dayKey}`);
  channel
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'food_logs',
      filter: buildFilter('user_id', userId),
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'daily_nutrition_summary',
      filter: buildFilter('user_id', userId),
    }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToBillingChanges(
  userId: string,
  onChange: () => void,
): (() => void) | null {
  if (!supabase) return null;

  const channel: RealtimeChannel = supabase.channel(`billing:${userId}`);
  channel
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: buildFilter('id', userId),
    }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
