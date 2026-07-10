/**
 * Weekly Recap — the Sunday proof moment.
 *
 * Shows how last week actually went: real-food meal count, weekly Fuel,
 * room-for-life meals enjoyed, and the weeks-at-goal streak. Celebratory
 * when the goal was met; warm and forward-looking when it wasn't. Deep-link
 * target of the weekly_recap push (route carries ?date=<week_start>).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { useTheme } from '../../../hooks/useTheme';
import { fuelApi } from '../../../services/api';
import { BorderRadius, FontSize, Spacing } from '../../../constants/Colors';

const GREEN = '#22C55E';
const AMBER = '#F59E0B';

interface WeeklyRecap {
  week_start: string;
  week_end: string;
  has_data: boolean;
  avg_fuel_score: number;
  tier_label: string;
  real_food_meals: number;
  real_food_goal: number;
  logged_meals: number;
  room_used: number;
  room_total: number;
  goal_met: boolean;
  weeks_at_goal_streak: number;
  headline: string;
  body: string;
}

export default function RecapScreen() {
  const theme = useTheme();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fuelApi
      .getRecap(typeof date === 'string' ? date : undefined)
      .then((data) => { if (active) setRecap(data); })
      .catch(() => { if (active) setRecap(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  const weekRange = recap
    ? `${new Date(recap.week_start + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(recap.week_end + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : '';

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))}
            style={[styles.backBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Close recap"
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Weekly Recap</Text>
          <View style={{ width: 34 }} />
        </View>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : !recap ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Couldn't load your recap right now. Pull down on Home to refresh and try again.
          </Text>
        ) : (
          <>
            <LinearGradient
              colors={recap.goal_met ? ['#052e16', '#14532d'] : [theme.surface, theme.surface]}
              style={[styles.heroCard, { borderColor: recap.goal_met ? GREEN + '50' : theme.border }]}
            >
              <Text style={[styles.weekRange, { color: recap.goal_met ? '#86EFAC' : theme.textTertiary }]}>{weekRange}</Text>
              <Text style={[styles.headline, { color: recap.goal_met ? '#FFFFFF' : theme.text }]}>{recap.headline}</Text>
              <Text style={[styles.bodyCopy, { color: recap.goal_met ? '#D1FAE5' : theme.textSecondary }]}>{recap.body}</Text>
              {recap.goal_met && (
                <View style={styles.trophyRow}>
                  <Ionicons name="trophy" size={16} color="#FBBF24" />
                  <Text style={styles.trophyText}>Goal met — week won</Text>
                </View>
              )}
            </LinearGradient>

            {recap.has_data && (
              <View style={styles.statGrid}>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="leaf" size={16} color={GREEN} />
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {recap.real_food_meals}<Text style={[styles.statGoal, { color: theme.textTertiary }]}> / {recap.real_food_goal}</Text>
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Real-food meals</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="speedometer" size={16} color={theme.primary} />
                  <Text style={[styles.statValue, { color: theme.text }]}>{Math.round(recap.avg_fuel_score)}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Weekly Fuel · {recap.tier_label}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="restaurant" size={16} color={AMBER} />
                  <Text style={[styles.statValue, { color: theme.text }]}>{recap.room_used}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Room-for-life meals</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="flame" size={16} color="#F97316" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{recap.weeks_at_goal_streak}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Weeks at goal</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.cta, { backgroundColor: theme.primary }]}
              onPress={() => router.replace('/(tabs)' as any)}
              accessibilityRole="button"
              accessibilityLabel="Start this week"
            >
              <Text style={styles.ctaText}>Start this week</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.lg,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  weekRange: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  bodyCopy: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  trophyText: {
    color: '#FBBF24',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  statGoal: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  cta: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
