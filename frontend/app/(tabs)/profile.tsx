import React, { useState, useEffect, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/GradientCard';
import { XPBar } from '../../components/XPBar';
import { StreakBadge } from '../../components/StreakBadge';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { gameApi } from '../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { XP_PER_LEVEL } from '../../constants/Config';
import { useEntranceAnimation, useStaggeredEntrance } from '../../hooks/useAnimations';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  xp_reward: number;
  category: string;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements'>('stats');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [achievementsError, setAchievementsError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const xp = user?.xp_points || 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const headerEntrance = useEntranceAnimation(0);
  const contentEntrance = useEntranceAnimation(100);

  const loadAchievements = async () => {
    setLoadingAchievements(true);
    setAchievementsError(false);
    try {
      const data = await gameApi.getAchievements();
      setAchievements(data || []);
    } catch {
      setAchievementsError(true);
    } finally {
      setLoadingAchievements(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'achievements' && achievements.length === 0) {
      loadAchievements();
    }
  }, [activeTab]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const categories = Array.from(new Set(achievements.map((a) => a.category))).filter(Boolean);
  const filteredAchievements = selectedCategory
    ? achievements.filter((a) => a.category === selectedCategory)
    : achievements;
  const achieveStagger = useStaggeredEntrance(filteredAchievements.length, 50, selectedCategory ?? 'all');

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* ── Top Bar ─────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.push('/(tabs)' as any)}
            activeOpacity={0.7}
            style={[styles.topBarBtn, { backgroundColor: theme.surfaceElevated }]}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.text}
              style={{ transform: [{ translateX: 1 }] }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.7}
            style={[styles.topBarBtn, { backgroundColor: theme.surfaceElevated }]}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <Animated.View style={[styles.profileHeader, headerEntrance.style]}>
          <View style={{ ...Shadows.interactive(false), borderRadius: BorderRadius.full }}>
            <LinearGradient colors={['#16A34A', '#0D9488', '#0891B2'] as const} style={[styles.avatar, { borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }]}>
              <Text style={styles.avatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.levelBadge, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="star" size={14} color={theme.primary} />
              <Text style={[styles.levelText, { color: theme.primary }]}>Level {level}</Text>
            </View>
            <StreakBadge streak={user?.current_streak || 0} compact />
          </View>
        </Animated.View>

        {/* XP Progress */}
        <Card style={{ marginBottom: Spacing.xl }}>
          <XPBar xp={xp} />
        </Card>

        {/* Tab Selector */}
        <Animated.View style={contentEntrance.style}>
        <View style={[styles.tabRow, { backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.md }]}>
          {(['stats', 'achievements'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
              style={[
                styles.tab,
                activeTab === tab && { backgroundColor: theme.primary + '18', borderWidth: 1, borderColor: theme.primary + '30' },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.text : theme.textTertiary },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'stats' ? (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.accent }]} padding={Spacing.lg}>
                <Ionicons name="flame" size={24} color={theme.accent} />
                <Text style={[styles.statValue, { color: theme.text }]}>{user?.current_streak || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Current Streak</Text>
              </Card>
              <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.accent }]} padding={Spacing.lg}>
                <Ionicons name="trophy" size={24} color={theme.accent} />
                <Text style={[styles.statValue, { color: theme.text }]}>{user?.longest_streak || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Best Streak</Text>
              </Card>
              <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.primary }]} padding={Spacing.lg}>
                <Ionicons name="star" size={24} color={theme.primary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{xp}</Text>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Total XP</Text>
              </Card>
              <Card style={[styles.statCard, { borderTopWidth: 3, borderTopColor: theme.info }]} padding={Spacing.lg}>
                <Ionicons name="ribbon" size={24} color={theme.info} />
                <Text style={[styles.statValue, { color: theme.text }]}>{unlockedCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Achievements</Text>
              </Card>
            </View>
          </>
        ) : (
          <>
            {loadingAchievements ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={{ marginTop: Spacing.huge }}
              />
            ) : achievements.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name={achievementsError ? 'cloud-offline-outline' : 'trophy-outline'} size={48} color={theme.textTertiary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {achievementsError ? 'Unable to load achievements' : 'No achievements yet. Keep exploring!'}
                </Text>
                {achievementsError && (
                  <TouchableOpacity
                    onPress={() => {
                      setAchievementsError(false);
                      setLoadingAchievements(true);
                      gameApi
                        .getAchievements()
                        .then((data) => setAchievements(data || []))
                        .catch(() => setAchievementsError(true))
                        .finally(() => setLoadingAchievements(false));
                    }}
                    style={{ backgroundColor: theme.primaryMuted, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full }}
                  >
                    <Text style={{ color: theme.primary, fontSize: FontSize.sm, fontWeight: '700' }}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {/* Summary pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs }}>
                  <View style={[styles.achieveSummaryPill, { backgroundColor: theme.primaryMuted }]}>
                    <Ionicons name="trophy" size={12} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontSize: FontSize.xs, fontWeight: '700' }}>{unlockedCount}/{achievements.length} Unlocked</Text>
                  </View>
                </View>

                {/* Category filter chips */}
                {categories.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                      <TouchableOpacity
                        onPress={() => setSelectedCategory(null)}
                        style={[
                          styles.categoryChip,
                          { backgroundColor: !selectedCategory ? theme.primary : theme.surfaceElevated },
                        ]}
                      >
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: !selectedCategory ? '#fff' : theme.textSecondary }}>All</Text>
                      </TouchableOpacity>
                      {categories.map((cat) => {
                        const isActive = selectedCategory === cat;
                        const catIcon = cat === 'metabolic' ? 'flash' : cat === 'nutrition' ? 'nutrition' : cat === 'progression' ? 'trending-up' : 'ribbon';
                        return (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => setSelectedCategory(isActive ? null : cat)}
                            style={[
                              styles.categoryChip,
                              { backgroundColor: isActive ? theme.primary : theme.surfaceElevated },
                            ]}
                          >
                            <Ionicons name={catIcon as any} size={12} color={isActive ? '#fff' : theme.textSecondary} />
                            <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: isActive ? '#fff' : theme.textSecondary }}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}

                {filteredAchievements.map((achievement, achIdx) => (
                  <Animated.View key={achievement.id} style={achieveStagger[achIdx]}>
                  <View
                    style={[
                      styles.achieveCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: achievement.unlocked ? theme.primary + '25' : theme.border,
                        opacity: achievement.unlocked ? 1 : 0.55,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                      {/* Icon */}
                      <View
                        style={[
                          styles.achieveIcon,
                          {
                            backgroundColor: achievement.unlocked
                              ? theme.primary + '15'
                              : theme.surfaceHighlight,
                          },
                        ]}
                      >
                        <Ionicons
                          name={achievement.icon as any}
                          size={22}
                          color={achievement.unlocked ? theme.primary : theme.textTertiary}
                        />
                        {achievement.unlocked && (
                          <View style={[styles.achieveCheck, { backgroundColor: theme.primary }]}>
                            <Ionicons name="checkmark" size={8} color="#fff" />
                          </View>
                        )}
                      </View>

                      {/* Text */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.achieveName, { color: theme.text }]}>
                          {achievement.name}
                        </Text>
                        <Text style={[styles.achieveDesc, { color: theme.textTertiary }]} numberOfLines={2}>
                          {achievement.description}
                        </Text>
                      </View>

                      {/* XP badge */}
                      <View style={[styles.achieveXP, { backgroundColor: theme.accentMuted }]}>
                        <Text style={[styles.achieveXPText, { color: theme.accent }]}>+{achievement.xp_reward} XP</Text>
                      </View>
                    </View>
                  </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        )}
        </Animated.View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: Spacing.sm,
    paddingBottom: Layout.scrollBottomPadding,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  topBarBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  name: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  email: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  levelText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    padding: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    width: '47%' as any,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },

  achieveCard: {
    flexDirection: 'column',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  achieveIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  achieveCheck: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  achieveName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  achieveDesc: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  achieveXP: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  achieveXPText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  achieveSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    paddingTop: Spacing.huge,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
  },
});
