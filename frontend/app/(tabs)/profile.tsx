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
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/GradientCard';
import { XPBar } from '../../components/XPBar';
import { StreakBadge } from '../../components/StreakBadge';
import { ProfileSegmentedControl, type ProfileSegment } from '../../components/ProfileSegmentedControl';
import { AchievementTile, type Achievement } from '../../components/AchievementTile';
import { AchievementDetailSheet } from '../../components/AchievementDetailSheet';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { gameApi } from '../../services/api';
import { BorderRadius, FontSize, Layout, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { XP_PER_LEVEL } from '../../constants/Config';
import { useEntranceAnimation, useStaggeredEntrance } from '../../hooks/useAnimations';

export default function ProfileScreen() {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const [activeSegment, setActiveSegment] = useState<ProfileSegment>('overview');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [achievementsError, setAchievementsError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [detailAchievement, setDetailAchievement] = useState<Achievement | null>(null);
  const xp = user?.xp_points || 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const headerEntrance = useEntranceAnimation(0);
  const contentEntrance = useEntranceAnimation(100);

  // Load saved avatar on mount
  useEffect(() => {
    AsyncStorage.getItem('user_avatar_uri').then((uri) => {
      if (uri) setAvatarUri(uri);
    });
  }, []);

  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      AsyncStorage.setItem('user_avatar_uri', uri);
    }
  }, []);

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
    if (achievements.length === 0) {
      loadAchievements();
    }
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const unlockedAchievements = achievements.filter((a) => a.unlocked);

  // Sort: unlocked first, then locked — both grouped by category
  const sortedAchievements = [...achievements].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return a.category.localeCompare(b.category);
  });

  const categories = Array.from(new Set(achievements.map((a) => a.category))).filter(Boolean);
  const filteredAchievements = selectedCategory
    ? sortedAchievements.filter((a) => a.category === selectedCategory)
    : sortedAchievements;
  const achieveStagger = useStaggeredEntrance(filteredAchievements.length, 30, (selectedCategory ?? 'all') + activeSegment);

  // Grid dimensions
  const gridGap = Spacing.sm;
  const tileWidth = (screenWidth - Spacing.xl * 2 - gridGap) / 2;

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
              style={{ transform: [{ translateX: -1 }] }}
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

        {/* ── Persistent Hero ────────────────────────────────── */}
        <Animated.View style={[styles.profileHeader, headerEntrance.style]}>
          <TouchableOpacity
            onPress={pickAvatar}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.avatarTouchable}
          >
            <View style={{ ...Shadows.interactive(false), borderRadius: BorderRadius.full }}>
              <LinearGradient colors={['#22C55E', '#059669', '#0891B2'] as const} style={[styles.avatar, { borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </LinearGradient>
            </View>
            <View style={[styles.avatarBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.levelBadge, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="star" size={14} color={theme.primary} />
              <Text style={[styles.levelText, { color: theme.primary }]}>Level {level}</Text>
            </View>
            <StreakBadge streak={user?.current_streak || 0} compact />
          </View>

          {/* Compact XP Bar */}
          <View style={{ width: '100%', marginTop: Spacing.lg }}>
            <XPBar xp={xp} compact />
          </View>
        </Animated.View>

        {/* ── Segmented Control ──────────────────────────────── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <ProfileSegmentedControl active={activeSegment} onChange={setActiveSegment} />
        </View>

        {/* ── Segment Content ────────────────────────────────── */}
        <Animated.View style={contentEntrance.style}>
          {activeSegment === 'overview' ? (
            /* ── OVERVIEW ──────────────────────────────────────── */
            <View style={{ gap: Spacing.md }}>
              {/* Stats card */}
              <Card padding={0}>
                <View style={styles.statRow}>
                  <View style={[styles.statIcon, { backgroundColor: theme.accentMuted }]}>
                    <Ionicons name="flame" size={18} color={theme.accent} />
                  </View>
                  <Text style={[styles.statRowLabel, { color: theme.textSecondary }]}>Day Streak</Text>
                  <Text style={[styles.statRowValue, { color: theme.text }]}>{user?.current_streak || 0}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.statRow}>
                  <View style={[styles.statIcon, { backgroundColor: theme.primaryMuted }]}>
                    <Ionicons name="star" size={18} color={theme.primary} />
                  </View>
                  <Text style={[styles.statRowLabel, { color: theme.textSecondary }]}>Total XP</Text>
                  <Text style={[styles.statRowValue, { color: theme.text }]}>{xp}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.statRow}>
                  <View style={[styles.statIcon, { backgroundColor: theme.infoMuted }]}>
                    <Ionicons name="ribbon" size={18} color={theme.info} />
                  </View>
                  <Text style={[styles.statRowLabel, { color: theme.textSecondary }]}>Achievements</Text>
                  <Text style={[styles.statRowValue, { color: theme.text }]}>{unlockedCount} / {achievements.length || '–'}</Text>
                </View>
              </Card>

              {/* Quests link */}
              <Card padding={0} onPress={() => router.push('/quests' as any)}>
                <View style={styles.statRow}>
                  <View style={[styles.statIcon, { backgroundColor: theme.accentMuted }]}>
                    <Ionicons name="flash" size={18} color={theme.accent} />
                  </View>
                  <Text style={[styles.statRowLabel, { color: theme.text, fontWeight: '600' }]}>Quests & Streaks</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
                </View>
              </Card>

              {/* Recent Unlocks */}
              {unlockedAchievements.length > 0 && (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>Recent Unlocks</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      {unlockedAchievements.slice(0, 5).map((a) => (
                        <TouchableOpacity
                          key={a.id}
                          activeOpacity={0.7}
                          onPress={() => setDetailAchievement(a)}
                          style={[styles.recentBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                        >
                          <View style={[styles.recentIcon, { backgroundColor: theme.surfaceHighlight }]}>
                            <Ionicons name={a.icon as any} size={20} color={theme.primary} />
                          </View>
                          <Text style={[styles.recentName, { color: theme.text }]} numberOfLines={1}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* View All Achievements shortcut */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setActiveSegment('achievements')}
                style={[styles.viewAllBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="trophy-outline" size={18} color={theme.primary} />
                <Text style={[styles.viewAllText, { color: theme.primary }]}>
                  View All Achievements ({achievements.length})
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            /* ── ACHIEVEMENTS ──────────────────────────────────── */
            <View style={{ gap: Spacing.sm }}>
              {loadingAchievements ? (
                <ActivityIndicator
                  size="large"
                  color={theme.primary}
                  style={{ marginTop: Spacing.huge }}
                />
              ) : achievements.length === 0 ? (
                <View style={styles.emptyState}>
                  <LinearGradient
                    colors={[theme.primary + '20', theme.primary + '08'] as any}
                    style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name={achievementsError ? 'cloud-offline-outline' : 'trophy-outline'} size={32} color={achievementsError ? theme.textTertiary : theme.primary} />
                  </LinearGradient>
                  <Text style={[{ fontSize: FontSize.lg, fontWeight: '700' }, { color: theme.text }]}>
                    {achievementsError ? 'Connection issue' : 'No achievements yet'}
                  </Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {achievementsError ? 'Unable to load achievements' : 'Keep fueling — your first badge is closer than you think'}
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
                <>
                  {/* Summary pill */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={[styles.achieveSummaryPill, { backgroundColor: theme.primaryMuted }]}>
                      <Ionicons name="trophy" size={12} color={theme.primary} />
                      <Text style={{ color: theme.primary, fontSize: FontSize.xs, fontWeight: '700' }}>{unlockedCount}/{achievements.length} Unlocked</Text>
                    </View>
                  </View>

                  {/* Category filter chips */}
                  {categories.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                          const catIcon = cat === 'metabolic' ? 'flash' : cat === 'nutrition' ? 'nutrition' : cat === 'progression' ? 'trending-up' : cat === 'fuel' ? 'leaf' : 'ribbon';
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

                  {/* 2-column grid */}
                  <View style={styles.grid}>
                    {filteredAchievements.map((achievement, achIdx) => (
                      <Animated.View
                        key={achievement.id}
                        style={[{ width: tileWidth }, achieveStagger[achIdx]]}
                      >
                        <AchievementTile
                          achievement={achievement}
                          onPress={setDetailAchievement}
                        />
                      </Animated.View>
                    ))}
                    {/* Spacer for odd count */}
                    {filteredAchievements.length % 2 !== 0 && (
                      <View style={{ width: tileWidth }} />
                    )}
                  </View>
                </>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Achievement Detail Sheet */}
      {detailAchievement && (
        <AchievementDetailSheet
          achievement={detailAchievement}
          onClose={() => setDetailAchievement(null)}
        />
      )}
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
    marginBottom: Spacing.lg,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: Spacing.md,
    minWidth: 88,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
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
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRowLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  statRowValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg + 34 + Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  recentBadge: {
    alignItems: 'center',
    width: 80,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentName: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  viewAllText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
    flexShrink: 0,
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
