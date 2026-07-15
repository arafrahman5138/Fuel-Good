/**
 * WeeklyRecapBanner — in-app fallback for the weekly recap push.
 *
 * On the first Home open of a new week, shows a one-line banner linking
 * to last week's recap. Guarantees the proof moment reaches users who
 * declined push. Seen/dismissed state is per-user, per-week.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { fuelApi } from '../services/api';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

function lastWeekMondayISO(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
  return monday.toISOString().slice(0, 10);
}

interface WeeklyRecapBannerProps {
  userId?: string | number | null;
}

function WeeklyRecapBannerImpl({ userId }: WeeklyRecapBannerProps) {
  const theme = useTheme();
  const [headline, setHeadline] = useState<string | null>(null);
  const [goalMet, setGoalMet] = useState(false);
  const weekStart = lastWeekMondayISO();
  const seenKey = `recap_seen_${userId ?? 'anon'}_${weekStart}`;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(seenKey);
        if (seen || !active) return;
        const recap = await fuelApi.getRecap(weekStart);
        if (active && recap?.has_data) {
          setHeadline(recap.headline);
          setGoalMet(Boolean(recap.goal_met));
        }
      } catch {
        // silent — the banner is a bonus surface, never an error state
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weekStart]);

  if (!headline) return null;

  const dismiss = () => {
    setHeadline(null);
    AsyncStorage.setItem(seenKey, '1').catch(() => {});
  };

  return (
    <View
      testID="weekly-recap-banner"
      style={[
        styles.banner,
        {
          // surfaceElevated (not card.background): the card surface is nearly
          // the same value as the dark page background (#141419 on #0A0A0F),
          // so the banner disappeared in dark mode. Elevated surface + the
          // subtle border separates it in dark and stays correct in light.
          backgroundColor: goalMet ? '#22C55E14' : theme.surfaceElevated,
          borderColor: goalMet ? '#22C55E40' : theme.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerBody}
        activeOpacity={0.8}
        onPress={() => {
          dismiss();
          router.push(`/(tabs)/(home)/recap?date=${weekStart}` as any);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Last week's recap: ${headline}`}
      >
        <Ionicons name={goalMet ? 'trophy' : 'newspaper-outline'} size={16} color={goalMet ? '#F59E0B' : theme.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: theme.textTertiary }]}>LAST WEEK'S RECAP</Text>
          <Text style={[styles.headline, { color: theme.text }]} numberOfLines={2}>{headline}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={dismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss recap banner"
      >
        <Ionicons name="close" size={16} color={theme.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  bannerBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});

export const WeeklyRecapBanner = React.memo(WeeklyRecapBannerImpl);
