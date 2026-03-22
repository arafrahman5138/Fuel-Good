/**
 * fuel-weekly — Weekly Fuel Score breakdown screen.
 * Shows 7-day breakdown with expandable meal details per day.
 */
import React, { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppScreenHeader } from '../../components/AppScreenHeader';
import { ScreenContainer } from '../../components/ScreenContainer';
import { FuelScoreRing } from '../../components/FuelScoreRing';
import { FuelScoreBadge } from '../../components/FuelScoreBadge';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../stores/themeStore';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { useFuelStore } from '../../stores/fuelStore';
import { useMetabolicBudgetStore, getTierConfig, getTierFromScore } from '../../stores/metabolicBudgetStore';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Tier config ──────────────────────────────────────────────────────────────
const TIER_CONFIGS = [
  { min: 90, label: 'Elite Fuel', color: '#22C55E', darkGradient: ['#021a0e', '#0d3320', '#155227'] as const },
  { min: 75, label: 'Strong Fuel', color: '#4ADE80', darkGradient: ['#021a0e', '#0f3b20', '#166534'] as const },
  { min: 60, label: 'Decent', color: '#F59E0B', darkGradient: ['#160d02', '#3d2108', '#78350f'] as const },
  { min: 40, label: 'Mixed', color: '#FB923C', darkGradient: ['#160902', '#3d1408', '#9a3412'] as const },
  { min: 0, label: 'Flex Day', color: '#EF4444', darkGradient: ['#160606', '#3d0a0a', '#991b1b'] as const },
];

function getTierCfg(score: number) {
  return TIER_CONFIGS.find((t) => score >= t.min) ?? TIER_CONFIGS[TIER_CONFIGS.length - 1];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDayLabel(dateStr: string): { day: string; date: string; isToday: boolean } {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return {
    day: DAY_NAMES[d.getDay()],
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isToday,
  };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function FuelWeeklyScreen() {
  const theme = useTheme();
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.mode);
  const isDark = themeMode === 'system' ? (systemScheme ?? 'dark') === 'dark' : themeMode === 'dark';

  const weekly = useFuelStore((s) => s.weekly);
  const settings = useFuelStore((s) => s.settings);
  const streak = useFuelStore((s) => s.streak);
  const mesHistory = useMetabolicBudgetStore((s) => s.scoreHistory);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Build a date→MES lookup from history
  const mesByDate = useMemo(() => {
    const map: Record<string, { score: number; tier: string; color: string }> = {};
    for (const entry of mesHistory) {
      const score = entry.display_score ?? entry.total_score ?? 0;
      if (score > 0) {
        const tierKey = getTierFromScore(score);
        map[entry.date] = { score: Math.round(score), tier: tierKey, color: getTierConfig(tierKey).color };
      }
    }
    return map;
  }, [mesHistory]);

  // Weekly MES average
  const weeklyMes = useMemo(() => {
    if (!weekly) return null;
    const breakdown = weekly.daily_breakdown ?? [];
    const scores = breakdown
      .map((d: any) => mesByDate[d.date]?.score ?? 0)
      .filter((s: number) => s > 0);
    if (scores.length === 0) return null;
    const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    return { score: avg, color: getTierConfig(getTierFromScore(avg)).color };
  }, [weekly, mesByDate]);

  if (!weekly) {
    return (
      <ScreenContainer safeArea={false} padded={false}>
        <AppScreenHeader title="Weekly Fuel" />
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No weekly data yet</Text>
        </View>
      </ScreenContainer>
    );
  }

  const tier = getTierCfg(weekly.avg_fuel_score);
  const flexRemaining = weekly.flex_budget?.flex_meals_remaining ?? 0;
  const breakdown = weekly.daily_breakdown ?? [];

  const textPrimary = isDark ? 'rgba(255,255,255,0.90)' : theme.text;
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : theme.textSecondary;
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : theme.textTertiary;
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : theme.surface;
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : theme.border;
  const gradientColors = isDark
    ? (tier.darkGradient as unknown as string[])
    : [theme.surface, theme.surface];

  const toggleDay = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDay((prev) => (prev === date ? null : date));
  };

  // Progress
  const expectedMeals = settings?.expected_meals_per_week ?? 21;
  const mealProgressPct = expectedMeals > 0 ? Math.min(100, (weekly.meal_count / expectedMeals) * 100) : 0;

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <AppScreenHeader title="Weekly Fuel" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Summary Card ── */}
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.heroCard, { borderColor: isDark ? tier.color + '38' : cardBorder }]}
        >
          <View style={styles.heroBody}>
            <FuelScoreRing
              score={weekly.avg_fuel_score}
              size={110}
              showLabel
              showIcon
              trackColor={isDark ? 'rgba(255,255,255,0.10)' : theme.surfaceHighlight}
            />
            <View style={styles.heroStats}>
              <View style={[styles.tierPill, { backgroundColor: tier.color + '18' }]}>
                <Text style={[styles.tierPillText, { color: tier.color }]}>{tier.label}</Text>
              </View>
              {/* Weekly MES */}
              {weeklyMes && weeklyMes.score > 0 && (
                <View style={styles.mesRow}>
                  <Ionicons name="flash" size={13} color={weeklyMes.color} />
                  <Text style={[styles.mesNumber, { color: weeklyMes.color }]}>{weeklyMes.score}</Text>
                  <Text style={[styles.mesLabel, { color: textSecondary }]}>MES avg</Text>
                </View>
              )}
              <View style={styles.heroMeta}>
                <View style={styles.metaChip}>
                  <Ionicons name="restaurant-outline" size={12} color={textSecondary} />
                  <Text style={[styles.metaText, { color: textSecondary }]}>
                    {weekly.meal_count} meals
                  </Text>
                </View>
                {flexRemaining > 0 && (
                  <View style={styles.metaChip}>
                    <Ionicons name="pizza-outline" size={12} color="#4ADE80" />
                    <Text style={[styles.metaText, { color: '#4ADE80' }]}>
                      {flexRemaining} flex left
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : theme.border }]}>
              <LinearGradient
                colors={[tier.color, tier.color + '88'] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${mealProgressPct}%` }]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: textTertiary }]}>
              {weekly.meal_count} of {expectedMeals} meals logged this week
            </Text>
          </View>

          {/* Target met banner */}
          {weekly.target_met && (
            <View style={[styles.targetBanner, { backgroundColor: tier.color + '12' }]}>
              <Ionicons name="checkmark-circle" size={14} color={tier.color} />
              <Text style={[styles.targetText, { color: tier.color }]}>
                Weekly target of {settings?.fuel_target ?? 80}+ met
              </Text>
            </View>
          )}

          {/* Flex proof messaging */}
          {(() => {
            const flexUsed = weekly.flex_budget?.flex_used ?? 0;
            const cleanLogged = weekly.flex_budget?.clean_meals_logged ?? 0;
            const avg = weekly.avg_fuel_score;
            const tierName = avg >= 90 ? 'Elite' : avg >= 75 ? 'Strong' : avg >= 60 ? 'Decent' : 'Mixed';
            if (flexUsed > 0 && avg >= 75) {
              return (
                <View style={[styles.targetBanner, { backgroundColor: '#F59E0B10', marginTop: 6 }]}>
                  <Ionicons name="ticket" size={14} color="#F59E0B" />
                  <Text style={[styles.targetText, { color: '#D97706' }]}>
                    {cleanLogged} clean + {flexUsed} flex = avg {Math.round(avg)} — {tierName} tier. The math works.
                  </Text>
                </View>
              );
            }
            return null;
          })()}
        </LinearGradient>

        {/* ── Day-by-Day ── */}
        <Text style={[styles.sectionTitle, { color: textTertiary }]}>DAY BY DAY</Text>

        {breakdown.map((day: any) => {
          const dayTier = getTierCfg(day.avg_fuel_score);
          const dayLabel = formatDayLabel(day.date);
          const isExpanded = expandedDay === day.date;
          const hasMeals = day.meal_count > 0;
          const dayMes = mesByDate[day.date];

          return (
            <TouchableOpacity
              key={day.date}
              activeOpacity={hasMeals ? 0.7 : 1}
              onPress={() => hasMeals && toggleDay(day.date)}
              style={[
                styles.dayCard,
                {
                  backgroundColor: cardBg,
                  borderColor: dayLabel.isToday ? tier.color + '40' : cardBorder,
                  borderWidth: dayLabel.isToday ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.dayHeader}>
                <View style={styles.dayLeft}>
                  {hasMeals ? (
                    <View style={[styles.dayScoreDot, { backgroundColor: dayTier.color + '18' }]}>
                      <Text style={[styles.dayScoreDotText, { color: dayTier.color }]}>
                        {Math.round(day.avg_fuel_score)}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.dayScoreDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : theme.surfaceHighlight }]}>
                      <Text style={[styles.dayScoreDotText, { color: textTertiary }]}>—</Text>
                    </View>
                  )}
                  <View style={styles.dayInfo}>
                    <View style={styles.dayNameRow}>
                      <Text style={[styles.dayName, { color: textPrimary }]}>{dayLabel.day}</Text>
                      {dayLabel.isToday && (
                        <View style={[styles.todayBadge, { backgroundColor: tier.color + '20' }]}>
                          <Text style={[styles.todayBadgeText, { color: tier.color }]}>Today</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.dayDate, { color: textTertiary }]}>{dayLabel.date}</Text>
                  </View>
                </View>
                <View style={styles.dayRight}>
                  {hasMeals ? (
                    <View style={styles.dayScores}>
                      <Text style={[styles.dayMeals, { color: textSecondary }]}>
                        {day.meal_count} meal{day.meal_count !== 1 ? 's' : ''}
                      </Text>
                      {dayMes && (
                        <View style={styles.dayMesChip}>
                          <Ionicons name="flash" size={10} color={dayMes.color} />
                          <Text style={[styles.dayMesText, { color: dayMes.color }]}>{dayMes.score}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.restDay, { color: textTertiary }]}>Rest day</Text>
                  )}
                  {hasMeals && (
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={textTertiary}
                    />
                  )}
                </View>
              </View>

              {/* Expanded meal list */}
              {isExpanded && hasMeals && (
                <View style={[styles.mealList, { borderTopColor: cardBorder }]}>
                  {day.meals.map((meal: any, idx: number) => (
                    <View
                      key={meal.id || idx}
                      style={[
                        styles.mealRow,
                        idx < day.meals.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.mealInfo}>
                        <Ionicons
                          name={meal.source_type === 'scan' ? 'camera-outline' : 'restaurant-outline'}
                          size={13}
                          color={textSecondary}
                        />
                        <Text style={[styles.mealTitle, { color: textPrimary }]} numberOfLines={1}>
                          {meal.title}
                        </Text>
                      </View>
                      <FuelScoreBadge score={meal.fuel_score} fuelTarget={settings?.fuel_target} />
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 60,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Hero card
  heroCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.md + 2,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md + 4,
  },
  heroStats: {
    flex: 1,
    gap: Spacing.xs + 2,
  },
  tierPill: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
  },
  tierPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroAvg: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroAvgLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  mesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mesNumber: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  mesLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginLeft: 1,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    gap: 4,
    marginTop: Spacing.sm + 4,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
  },
  targetText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm + 2,
  },

  // Day card
  dayCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm + 2,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
  },
  dayScoreDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayScoreDotText: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dayInfo: {
    gap: 1,
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayName: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  todayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayScores: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dayMeals: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayMesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dayMesText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  restDay: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // Meal list
  mealList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: Spacing.sm,
  },
  mealTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
});
