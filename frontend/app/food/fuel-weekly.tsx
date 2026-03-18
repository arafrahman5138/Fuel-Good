/**
 * fuel-weekly — Weekly Fuel Score breakdown screen.
 * Shows 7-day breakdown with expandable meal details per day.
 */
import React, { useState } from 'react';
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Tier config ──────────────────────────────────────────────────────────────
const TIER_CONFIGS = [
  { min: 90, label: 'Elite Fuel', color: '#22C55E' },
  { min: 75, label: 'Strong Fuel', color: '#4ADE80' },
  { min: 60, label: 'Decent', color: '#F59E0B' },
  { min: 40, label: 'Mixed', color: '#FB923C' },
  { min: 0, label: 'Flex Day', color: '#EF4444' },
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

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (!weekly) {
    return (
      <ScreenContainer>
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

  const toggleDay = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDay((prev) => (prev === date ? null : date));
  };

  return (
    <ScreenContainer>
      <AppScreenHeader title="Weekly Fuel" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Weekly Summary ── */}
        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.summaryBody}>
            <FuelScoreRing
              score={weekly.avg_fuel_score}
              size={80}
              showLabel
              showIcon
            />
            <View style={styles.summaryStats}>
              <View style={[styles.tierPill, { backgroundColor: tier.color + '18' }]}>
                <Text style={[styles.tierPillText, { color: tier.color }]}>{tier.label}</Text>
              </View>
              <Text style={[styles.summaryAvg, { color: textPrimary }]}>
                {Math.round(weekly.avg_fuel_score)}
                <Text style={[styles.summaryAvgLabel, { color: textTertiary }]}> avg score</Text>
              </Text>
              <View style={styles.summaryMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="restaurant-outline" size={12} color={textSecondary} />
                  <Text style={[styles.metaText, { color: textSecondary }]}>
                    {weekly.meal_count} meals
                  </Text>
                </View>
                {flexRemaining > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="pizza-outline" size={12} color="#4ADE80" />
                    <Text style={[styles.metaText, { color: '#4ADE80' }]}>
                      {flexRemaining} flex left
                    </Text>
                  </View>
                )}
                {(streak?.current_streak ?? 0) > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="flash" size={12} color="#FBBF24" />
                    <Text style={[styles.metaText, { color: '#FBBF24' }]}>
                      {streak!.current_streak} wk streak
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {weekly.target_met && (
            <View style={[styles.targetMetBanner, { backgroundColor: tier.color + '12' }]}>
              <Ionicons name="checkmark-circle" size={14} color={tier.color} />
              <Text style={[styles.targetMetText, { color: tier.color }]}>
                Weekly target of {settings?.fuel_target ?? 80}+ met
              </Text>
            </View>
          )}
        </View>

        {/* ── Day-by-Day Breakdown ── */}
        <Text style={[styles.sectionTitle, { color: textTertiary }]}>DAY BY DAY</Text>

        {breakdown.map((day) => {
          const dayTier = getTierCfg(day.avg_fuel_score);
          const dayLabel = formatDayLabel(day.date);
          const isExpanded = expandedDay === day.date;
          const hasMeals = day.meal_count > 0;

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
              {/* Day header */}
              <View style={styles.dayHeader}>
                <View style={styles.dayLeft}>
                  {hasMeals ? (
                    <FuelScoreRing
                      score={day.avg_fuel_score}
                      size={36}
                      showLabel={false}
                      showIcon={false}
                    />
                  ) : (
                    <View style={[styles.emptyRing, { borderColor: textTertiary + '30' }]}>
                      <Ionicons name="remove" size={14} color={textTertiary} />
                    </View>
                  )}
                  <View>
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
                    <>
                      <Text style={[styles.dayScore, { color: dayTier.color }]}>
                        {Math.round(day.avg_fuel_score)}
                      </Text>
                      <Text style={[styles.dayMeals, { color: textTertiary }]}>
                        {day.meal_count} meal{day.meal_count !== 1 ? 's' : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.restDay, { color: textTertiary }]}>Rest day</Text>
                  )}
                  {hasMeals && (
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={textTertiary}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </View>

              {/* Expanded meal list */}
              {isExpanded && hasMeals && (
                <View style={[styles.mealList, { borderTopColor: cardBorder }]}>
                  {day.meals.map((meal, idx) => {
                    const mealTier = getTierCfg(meal.fuel_score);
                    return (
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
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
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

  // Summary card
  summaryCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md + 2,
    marginBottom: Spacing.lg,
  },
  summaryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md + 2,
  },
  summaryStats: {
    flex: 1,
    gap: Spacing.xs,
  },
  tierPill: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tierPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  summaryAvg: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryAvgLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  summaryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  targetMetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  targetMetText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },

  // Day card
  dayCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  emptyRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  todayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayDate: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  dayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayScore: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dayMeals: {
    fontSize: 10,
    fontWeight: '500',
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
    paddingVertical: Spacing.sm,
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
