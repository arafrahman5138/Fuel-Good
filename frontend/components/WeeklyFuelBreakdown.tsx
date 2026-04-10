import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './GradientCard';
import { useTheme } from '../hooks/useTheme';
import { toDateKey } from '../utils/dateKey';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

interface DailyFuel {
  date: string;
  avg_fuel_score: number;
  meal_count: number;
}

interface WeeklyFuelBreakdownProps {
  dailyBreakdown: DailyFuel[];
  fuelTarget: number;
  weeklyAvg: number;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BAR_MAX_HEIGHT = 80;

function getBarColor(score: number, target: number): string {
  if (score >= target) return '#22C55E';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

export function WeeklyFuelBreakdown({ dailyBreakdown, fuelTarget, weeklyAvg }: WeeklyFuelBreakdownProps) {
  const theme = useTheme();

  const { bars, cleanDays, flexDays } = useMemo(() => {
    // Build a Mon–Sun map from daily_breakdown
    const dayMap = new Map<string, DailyFuel>();
    for (const d of dailyBreakdown) {
      dayMap.set(d.date, d);
    }

    // Find the Monday of the current week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);

    const result: Array<{ date: string; score: number; mealCount: number; isToday: boolean }> = [];
    let clean = 0;
    let flex = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = toDateKey(d);
      const entry = dayMap.get(key);
      const score = entry?.avg_fuel_score ?? 0;
      const mealCount = entry?.meal_count ?? 0;
      const isToday = key === toDateKey(now);

      if (mealCount > 0) {
        if (score >= fuelTarget) clean++;
        else flex++;
      }

      result.push({ date: key, score, mealCount, isToday });
    }

    return { bars: result, cleanDays: clean, flexDays: flex };
  }, [dailyBreakdown, fuelTarget]);

  const tierColor = weeklyAvg >= 90 ? '#22C55E' : weeklyAvg >= 75 ? '#4ADE80' : weeklyAvg >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <Card style={{ marginBottom: Spacing.md }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>This Week</Text>
        <View style={[styles.avgPill, { backgroundColor: tierColor + '18' }]}>
          <Text style={[styles.avgText, { color: tierColor }]}>avg {Math.round(weeklyAvg)}</Text>
        </View>
      </View>

      {/* Bar chart */}
      <View style={styles.chartRow}>
        {bars.map((bar, idx) => {
          const height = bar.mealCount > 0 ? Math.max(8, (bar.score / 100) * BAR_MAX_HEIGHT) : 0;
          const color = bar.mealCount > 0 ? getBarColor(bar.score, fuelTarget) : 'transparent';
          const isFlex = bar.mealCount > 0 && bar.score < fuelTarget;

          return (
            <View key={bar.date} style={styles.barCol}>
              <View style={styles.barContainer}>
                {bar.mealCount > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height,
                        backgroundColor: color,
                        borderWidth: bar.isToday ? 2 : 0,
                        borderColor: bar.isToday ? theme.text : 'transparent',
                      },
                    ]}
                  >
                    {isFlex && (
                      <Ionicons
                        name="ticket"
                        size={8}
                        color="#fff"
                        style={{ position: 'absolute', top: 2 }}
                      />
                    )}
                  </View>
                ) : (
                  <View style={[styles.emptyBar, { borderColor: theme.border }]} />
                )}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: bar.isToday ? theme.text : theme.textTertiary,
                    fontWeight: bar.isToday ? '800' : '600',
                  },
                ]}
              >
                {DAY_LABELS[idx]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: '#22C55E' }]} />
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            {cleanDays} clean day{cleanDays !== 1 ? 's' : ''}
          </Text>
        </View>
        {flexDays > 0 && (
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
              {flexDays} flex day{flexDays !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        <View style={styles.summaryItem}>
          <Ionicons name="restaurant-outline" size={10} color={theme.textTertiary} />
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            {bars.reduce((sum, b) => sum + b.mealCount, 0)} meals
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  avgPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  avgText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  bar: {
    width: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  emptyBar: {
    width: 20,
    height: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  dayLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
