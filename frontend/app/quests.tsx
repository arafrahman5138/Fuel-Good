import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../components/ScreenContainer';
import { Card } from '../components/GradientCard';
import { XPBar } from '../components/XPBar';
import { useTheme, useIsDark } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { useGamificationStore } from '../stores/gamificationStore';
import { useFuelStore } from '../stores/fuelStore';
import { useMetabolicBudgetStore } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { XP_PER_LEVEL } from '../constants/Config';

export default function QuestsScreen() {
  const theme = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const quests = useGamificationStore((s) => s.quests);
  const completionPct = useGamificationStore((s) => s.completionPct);
  const fetchQuests = useGamificationStore((s) => s.fetchQuests);
  const fetchStats = useGamificationStore((s) => s.fetchStats);
  const stats = useGamificationStore((s) => s.stats);
  const fuelStreak = useFuelStore((s) => s.streak);
  const fetchFuelStreak = useFuelStore((s) => s.fetchStreak);
  const metabolicStreak = useMetabolicBudgetStore((s) => s.streak);
  const fetchMetabolicStreak = useMetabolicBudgetStore((s) => s.fetchStreak);
  const [refreshing, setRefreshing] = useState(false);

  const xp = stats?.xp_points ?? user?.xp_points ?? 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;

  useEffect(() => {
    fetchQuests();
    fetchStats();
    fetchFuelStreak();
    fetchMetabolicStreak();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchQuests(), fetchStats(), fetchFuelStreak(), fetchMetabolicStreak()]);
    setRefreshing(false);
  }, [fetchQuests, fetchStats, fetchFuelStreak, fetchMetabolicStreak]);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={[styles.backBtn, { backgroundColor: theme.surfaceElevated }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Quests & Streaks</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Streak Overview */}
        <Card style={{ marginBottom: Spacing.lg }}>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <View style={[styles.streakIcon, { backgroundColor: theme.accentMuted }]}>
                <Ionicons name="flame" size={24} color={theme.accent} />
              </View>
              <Text style={[styles.streakValue, { color: theme.text }]}>{fuelStreak?.current_streak ?? 0}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Fuel Streak</Text>
            </View>
            <View style={styles.streakItem}>
              <View style={[styles.streakIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="flash" size={24} color="#8B5CF6" />
              </View>
              <Text style={[styles.streakValue, { color: theme.text }]}>{metabolicStreak?.current_streak ?? 0}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Energy Streak</Text>
            </View>
            <View style={styles.streakItem}>
              <View style={[styles.streakIcon, { backgroundColor: theme.primaryMuted }]}>
                <Ionicons name="star" size={24} color={theme.primary} />
              </View>
              <Text style={[styles.streakValue, { color: theme.text }]}>Lv {level}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Level</Text>
            </View>
          </View>
        </Card>

        {/* XP Progress */}
        <Card style={{ marginBottom: Spacing.lg }}>
          <XPBar xp={xp} />
        </Card>

        {/* Daily Quests */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Quests</Text>
        <Card style={{ overflow: 'hidden', padding: 0, marginBottom: Spacing.lg }}>
          <View style={[styles.questHeader, { backgroundColor: theme.surface }]}>
            <View style={styles.questHeaderTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Ionicons name="flame" size={18} color={theme.accent} />
                <Text style={[styles.questHeaderTitle, { color: theme.text }]}>Daily Progress</Text>
              </View>
              <View style={[styles.questPctBadge, { backgroundColor: completionPct === 100 ? theme.primary : theme.accentMuted }]}>
                <Text style={[styles.questPctText, { color: completionPct === 100 ? '#fff' : theme.accent }]}>{completionPct}%</Text>
              </View>
            </View>
            <View style={[styles.questProgressTrack, { backgroundColor: theme.surfaceHighlight }]}>
              <LinearGradient
                colors={completionPct === 100 ? ['#22C55E', '#059669'] : ['#F59E0B', '#F97316']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.questProgressFill, { width: `${Math.max(completionPct, 2)}%` as any }]}
              />
            </View>
          </View>
          {quests.map((quest, idx) => {
            const isCeiling = quest.direction === 'ceiling';
            const progress = quest.target_value > 0
              ? (isCeiling
                  ? (quest.completed ? 1 : Math.min(quest.current_value / quest.target_value, 1))
                  : quest.current_value / quest.target_value)
              : 0;
            const ceilingOver = isCeiling && quest.current_value > quest.target_value;
            return (
              <View
                key={quest.id}
                style={[
                  styles.questItem,
                  { borderBottomColor: theme.border },
                  idx === quests.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[
                  styles.questIcon,
                  { backgroundColor: quest.completed ? theme.primaryMuted : theme.surfaceHighlight },
                ]}>
                  {quest.completed ? (
                    <Ionicons name="checkmark" size={16} color={theme.primary} />
                  ) : (
                    <Ionicons
                      name={
                        quest.quest_type === 'log_meal' ? 'restaurant-outline' :
                        quest.quest_type === 'logging' ? 'restaurant-outline' :
                        quest.quest_type === 'healthify' ? 'heart-outline' :
                        quest.quest_type === 'score' ? 'trophy-outline' :
                        quest.quest_type === 'cook' ? 'flame-outline' :
                        quest.quest_type === 'metabolic' ? 'flash-outline' :
                        quest.quest_type === 'fuel' ? 'leaf-outline' :
                        'star-outline'
                      }
                      size={16}
                      color={
                        quest.quest_type === 'metabolic' ? theme.accent :
                        quest.quest_type === 'fuel' ? theme.primary :
                        theme.textSecondary
                      }
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.questItemTitleRow}>
                    <Text
                      style={[
                        styles.questTitle,
                        { color: quest.completed ? theme.textTertiary : theme.text },
                        quest.completed && { textDecorationLine: 'line-through' },
                      ]}
                      numberOfLines={1}
                    >
                      {quest.title}
                    </Text>
                    <View style={[styles.questXpBadge, { backgroundColor: quest.completed ? theme.primaryMuted : theme.surfaceHighlight }]}>
                      <Text style={[styles.questXpText, { color: quest.completed ? theme.primary : theme.textSecondary }]}>+{quest.xp_reward} XP</Text>
                    </View>
                  </View>
                  <View style={[styles.questMiniTrack, { backgroundColor: theme.surfaceHighlight }]}>
                    <View
                      style={[
                        styles.questMiniFill,
                        {
                          width: `${Math.min(progress * 100, 100)}%` as any,
                          backgroundColor: isCeiling
                            ? (ceilingOver ? '#EF4444' : theme.primary)
                            : (quest.completed ? theme.primary : theme.accent),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.questMeta, { color: theme.textTertiary }]}>
                    {isCeiling
                      ? `${Math.round(quest.current_value)}g consumed (${Math.round(quest.target_value)}g limit)`
                      : (quest.quest_type === 'fuel' && quest.target_value >= 50
                        ? (quest.completed ? 'Target met' : `Score: ${Math.round(quest.current_value)} / ${Math.round(quest.target_value)} min`)
                        : `${quest.current_value}/${quest.target_value}`)}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>

        {/* View Achievements Link */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile' as any)}
          activeOpacity={0.85}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <View style={[styles.streakIcon, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="trophy" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: FontSize.md, fontWeight: '700' }, { color: theme.text }]}>Achievements</Text>
              <Text style={[{ fontSize: FontSize.sm }, { color: theme.textSecondary }]}>View all badges and milestones</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  streakItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  streakValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  questHeader: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  questHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  questHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  questPctBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  questPctText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  questProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  questProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  questItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  questIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  questItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  questTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  questXpBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  questXpText: {
    fontSize: 10,
    fontWeight: '700',
  },
  questMiniTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  questMiniFill: {
    height: '100%',
    borderRadius: 2,
  },
  questMeta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
});
