import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ScreenContainer } from '../../../components/ScreenContainer';
import { FuelScoreRing } from '../../../components/FuelScoreRing';
import { useTheme } from '../../../hooks/useTheme';
import { useFuelStore } from '../../../stores/fuelStore';
import { BorderRadius, FontSize, Spacing } from '../../../constants/Colors';

type Action = {
  title: string;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  route: string;
  accent: string;
};

function getBaselineCopy(score: number, mealCount: number, target: number) {
  if (mealCount === 0) {
    return {
      title: 'Week starts with your first log',
      body: 'Scan, log, or cook something tasty to begin your clean baseline.',
      label: 'Baseline begins',
    };
  }
  if (score >= 90) {
    return {
      title: 'Elite clean baseline',
      body: 'You are eating clean most of the time. Real life has room this week.',
      label: 'Elite',
    };
  }
  if (score >= target) {
    return {
      title: 'Strong clean baseline',
      body: 'Healthy is winning this week. Lunch out or dessert can still fit.',
      label: 'Strong',
    };
  }
  if (score >= 60) {
    return {
      title: 'Mixed but recoverable',
      body: 'One craveable whole-food meal can pull the week back up.',
      label: 'Mixed',
    };
  }
  return {
    title: 'Reset with something nourishing',
    body: 'No guilt. Just choose the next tasty clean meal and rebuild the baseline.',
    label: 'Reset',
  };
}

function getPrimaryAction(score: number, mealCount: number, target: number): Action {
  if (mealCount === 0) {
    return {
      title: 'Scan or log your first meal',
      body: 'Start the week with what you actually ate.',
      icon: 'scan-outline',
      route: '/scan',
      accent: '#22C55E',
    };
  }
  if (score < target) {
    return {
      title: 'Choose a tasty clean meal',
      body: 'Shawarma bowls, tacos, burgers, or pasta made Fuel Good.',
      icon: 'restaurant-outline',
      route: '/(tabs)/meals?tab=browse',
      accent: '#14B8A6',
    };
  }
  return {
    title: 'Keep the baseline strong',
    body: 'Pick something delicious and whole-food for your next meal.',
    icon: 'sparkles-outline',
    route: '/(tabs)/meals?tab=browse',
    accent: '#22C55E',
  };
}

export default function HomeScreen() {
  const theme = useTheme();
  const { weekly, settings, loading, fetchAll } = useFuelStore();

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const mealCount = weekly?.meal_count ?? 0;
  const target = settings?.fuel_target ?? 80;
  const expectedMeals = settings?.expected_meals_per_week ?? 21;
  const score = mealCount > 0 ? Math.round(weekly?.avg_fuel_score ?? 0) : 0;
  const baseline = getBaselineCopy(score, mealCount, target);
  const primaryAction = getPrimaryAction(score, mealCount, target);
  const progressPct = expectedMeals > 0 ? Math.min(100, Math.round((mealCount / expectedMeals) * 100)) : 0;

  const supportingActions: Action[] = [
    {
      title: 'Use my weekly plan',
      body: 'Decision relief when you want the week handled.',
      icon: 'calendar-outline',
      route: '/(tabs)/meals?tab=plan',
      accent: '#3B82F6',
    },
    {
      title: 'Ask Coach',
      body: 'Turn a craving into a whole-food version.',
      icon: 'chatbubbles-outline',
      route: '/(tabs)/chat',
      accent: '#8B5CF6',
    },
    {
      title: 'Scan real life',
      body: 'Restaurants, takeout, groceries, or lunch with friends.',
      icon: 'scan-outline',
      route: '/scan',
      accent: '#F59E0B',
    },
  ];

  return (
    <ScreenContainer padded={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>Fuel Good</Text>
          <Text style={[styles.title, { color: theme.text }]}>Eat clean most of the time.</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Track your weekly baseline, choose tasty whole-food meals, and let real life fit.
          </Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
          <View style={styles.heroTop}>
            <FuelScoreRing score={score} size={118} showLabel showIcon />
            <View style={styles.heroCopy}>
              <Text style={[styles.baselineLabel, { color: theme.primary }]}>{baseline.label}</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>{baseline.title}</Text>
              <Text style={[styles.heroBody, { color: theme.textSecondary }]}>{baseline.body}</Text>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceHighlight }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: theme.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.textTertiary }]}>
            {mealCount} of {expectedMeals} meals logged this week
          </Text>
        </View>

        <View style={[styles.permissionCard, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B40' }]}>
          <Ionicons name="ticket-outline" size={18} color="#F59E0B" />
          <Text style={[styles.permissionText, { color: theme.text }]}>
            {mealCount > 0
              ? 'Your weekly average tells the story. If healthy is winning, lunch out still fits.'
              : 'Start with one log. The app will show whether healthy is winning this week.'}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Best next healthy action</Text>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => router.push(primaryAction.route as any)}
          style={[styles.primaryAction, { backgroundColor: primaryAction.accent + '16', borderColor: primaryAction.accent + '40' }]}
        >
          <View style={[styles.actionIcon, { backgroundColor: primaryAction.accent + '22' }]}>
            <Ionicons name={primaryAction.icon} size={22} color={primaryAction.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>{primaryAction.title}</Text>
            <Text style={[styles.actionBody, { color: theme.textSecondary }]}>{primaryAction.body}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Other ways to keep it easy</Text>
        <View style={styles.actionGrid}>
          {supportingActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              activeOpacity={0.86}
              onPress={() => router.push(action.route as any)}
              style={[styles.smallAction, { backgroundColor: theme.card.background, borderColor: theme.border }]}
            >
              <View style={[styles.smallIcon, { backgroundColor: action.accent + '18' }]}>
                <Ionicons name={action.icon} size={18} color={action.accent} />
              </View>
              <Text style={[styles.smallTitle, { color: theme.text }]}>{action.title}</Text>
              <Text style={[styles.smallBody, { color: theme.textSecondary }]}>{action.body}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <Text style={[styles.loadingText, { color: theme.textTertiary }]}>Refreshing your baseline...</Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  header: {
    gap: 6,
    marginBottom: Spacing.xs,
  },
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 21,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  heroCopy: {
    flex: 1,
    gap: 5,
  },
  baselineLabel: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: FontSize.lg,
    lineHeight: 24,
    fontWeight: '900',
  },
  heroBody: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  permissionCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  permissionText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  primaryAction: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  actionBody: {
    marginTop: 2,
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionGrid: {
    gap: Spacing.sm,
  },
  smallAction: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
  },
  smallIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  smallTitle: {
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  smallBody: {
    marginTop: 3,
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
