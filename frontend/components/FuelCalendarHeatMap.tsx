/**
 * FuelCalendarHeatMap — Monthly grid of daily Fuel Score cells.
 * Green/amber/red coloring at a glance. Flex meals get a diamond icon.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

interface CalendarDay {
  date: string;
  avg_fuel_score: number;
  meal_count: number;
  tier: string;
  is_flex: boolean;
}

interface FuelCalendarHeatMapProps {
  month: string; // "YYYY-MM"
  fuelTarget: number;
  days: CalendarDay[];
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onDayPress?: (date: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  whole_food: '#22C55E',
  mostly_clean: '#3B82F6',
  mixed: '#F59E0B',
  processed: '#EF4444',
  ultra_processed: '#991B1B',
  unknown: 'transparent',
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function FuelCalendarHeatMap({
  month,
  fuelTarget,
  days,
  onPrevMonth,
  onNextMonth,
  onDayPress,
}: FuelCalendarHeatMapProps) {
  const theme = useTheme();

  const { grid, monthLabel } = useMemo(() => {
    const [year, mon] = month.split('-').map(Number);
    const firstDay = new Date(year, mon - 1, 1);
    // Monday = 0, Sunday = 6  (ISO weekday)
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, mon, 0).getDate();

    const dayMap = new Map<string, CalendarDay>();
    for (const d of days) {
      dayMap.set(d.date, d);
    }

    const cells: (CalendarDay | null)[] = [];
    // Pad with nulls for days before month starts
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(dayMap.get(dateStr) || { date: dateStr, avg_fuel_score: 0, meal_count: 0, tier: 'unknown', is_flex: false });
    }

    const label = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { grid: cells, monthLabel: label };
  }, [month, days]);

  // Split into rows of 7
  const rows: (CalendarDay | null)[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    rows.push(grid.slice(i, i + 7));
  }

  const today = new Date().toISOString().slice(0, 10);

  const todayPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(todayPulse, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(todayPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.navBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: theme.text }]}>{monthLabel}</Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.navBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Weekday row */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={[styles.weekdayLabel, { color: theme.textTertiary }]}>{label}</Text>
        ))}
      </View>

      {/* Grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((cell, ci) => {
            if (!cell) {
              return <View key={ci} style={styles.cell} />;
            }
            const dayNum = parseInt(cell.date.slice(-2), 10);
            const isToday = cell.date === today;
            const hasData = cell.meal_count > 0;
            const bgColor = hasData ? (TIER_COLORS[cell.tier] || TIER_COLORS.unknown) : 'transparent';
            const bgOpacity = hasData ? 0.25 : 0;

            const cellContent = (
              <TouchableOpacity
                key={ci}
                style={[
                  styles.cell,
                  { backgroundColor: bgColor + (hasData ? '40' : '00') },
                  isToday && { borderWidth: 1.5, borderColor: theme.primary },
                ]}
                activeOpacity={0.7}
                onPress={() => onDayPress?.(cell.date)}
              >
                <Text style={[
                  styles.dayNum,
                  { color: hasData ? theme.text : theme.textTertiary },
                  isToday && { fontWeight: '800', color: theme.primary },
                ]}>
                  {dayNum}
                </Text>
                {hasData && (
                  <View style={[styles.scoreDot, { backgroundColor: TIER_COLORS[cell.tier] || theme.textTertiary }]} />
                )}
                {cell.is_flex && hasData && (
                  <View style={styles.flexMarker}>
                    <Ionicons name="ticket" size={7} color="#F59E0B" />
                  </View>
                )}
              </TouchableOpacity>
            );

            if (isToday) {
              return (
                <Animated.View key={ci} style={{ transform: [{ scale: todayPulse }] }}>
                  {cellContent}
                </Animated.View>
              );
            }

            return cellContent;
          })}
          {/* Pad last row to 7 cells */}
          {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.cell} />
          ))}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { label: 'Whole Food', color: TIER_COLORS.whole_food },
          { label: 'Mostly Clean', color: TIER_COLORS.mostly_clean },
          { label: 'Mixed', color: TIER_COLORS.mixed },
          { label: 'Processed', color: TIER_COLORS.processed },
        ].map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: theme.textTertiary }]}>{item.label}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <Ionicons name="ticket" size={8} color="#F59E0B" />
          <Text style={[styles.legendText, { color: theme.textTertiary }]}>Flex</Text>
        </View>
      </View>
    </View>
  );
}

const CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  navBtn: {
    padding: 4,
  },
  monthLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
  flexMarker: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: '#F59E0B18',
    borderRadius: 4,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
