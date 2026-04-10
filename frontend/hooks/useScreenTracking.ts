import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { analytics } from '../services/analytics';

/**
 * Tracks screen views automatically whenever the Expo Router pathname changes.
 * Place this hook once in the root layout.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === previous.current) return;
    previous.current = pathname;
    analytics.trackScreen(pathname);
  }, [pathname]);
}
