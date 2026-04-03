import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Spacing } from '../constants/Colors';

/**
 * Displays a banner when the device appears to be offline.
 * Uses a lightweight fetch probe instead of requiring @react-native-community/netinfo.
 * Requires 2 consecutive failures before showing offline to avoid false positives.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const failCountRef = useRef(0);
  const isInitialRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mounted) {
          failCountRef.current = 0;
          setIsOffline(false);
        }
      } catch {
        if (mounted) {
          failCountRef.current += 1;
          // Skip showing offline on initial mount (grace period for app startup)
          // and require 2 consecutive failures to avoid false positives
          if (!isInitialRef.current && failCountRef.current >= 2) {
            setIsOffline(true);
          }
        }
      }
      if (mounted) {
        isInitialRef.current = false;
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
