import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface DayData {
  label: string;
  score: number;
  isFlex?: boolean;
}

interface Props {
  days: DayData[];
  animated?: boolean;
}

export function WeeklyBarChart({ days, animated = true }: Props) {
  const barAnims = useRef(days.map(() => new Animated.Value(0))).current;
  const scoreAnims = useRef(days.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!animated) {
      barAnims.forEach((a) => a.setValue(1));
      scoreAnims.forEach((a) => a.setValue(1));
      return;
    }

    const barAnimations = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        delay: i * 120,
        useNativeDriver: false,
      })
    );
    const scoreAnimations = scoreAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: 800 + i * 120,
        useNativeDriver: true,
      })
    );

    Animated.parallel([...barAnimations, ...scoreAnimations]).start();
  }, [animated]);

  const maxHeight = 130;

  return (
    <View style={styles.container}>
      {days.map((day, i) => {
        const barHeight = barAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, (day.score / 100) * maxHeight],
        });

        return (
          <View key={day.label} style={styles.dayColumn}>
            <Animated.Text style={[styles.scoreText, { opacity: scoreAnims[i] }]}>
              {day.score}
            </Animated.Text>
            <View style={styles.barContainer}>
              <Animated.View style={{ height: barHeight, width: '100%' }}>
                <LinearGradient
                  colors={day.isFlex ? ['#F59E0B', '#D97706'] : ['#22C55E', '#16A34A']}
                  style={styles.barFill}
                />
              </Animated.View>
            </View>
            <Text style={styles.dayLabel}>{day.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    gap: 8,
    paddingHorizontal: 4,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barContainer: {
    width: '100%',
    justifyContent: 'flex-end',
    flex: 1,
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    flex: 1,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 6,
  },
});
