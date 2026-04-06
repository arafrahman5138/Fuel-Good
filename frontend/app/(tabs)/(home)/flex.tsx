/**
 * Flex Budget Screen — Dedicated screen for flex/cheat meal management.
 * Shows budget hero, manual cheat meal logging, weekly breakdown, and education.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppScreenHeader } from '../../../components/AppScreenHeader';
import { FlexUnlockedToast } from '../../../components/FlexUnlockedToast';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { useTheme } from '../../../hooks/useTheme';
import { useFuelStore } from '../../../stores/fuelStore';
import { BorderRadius, FontSize, Spacing } from '../../../constants/Colors';

const GOLD = '#F59E0B';
const GOLD_DARK = '#D97706';
const GOLD_GLOW = '#FBBF24';
const GREEN = '#22C55E';
const RED = '#EF4444';

// ── Cheat meal tag options ───────────────────────────────────────────────────
const FLEX_TAGS = [
  { key: 'pizza', icon: 'pizza-outline' as const, label: 'Pizza' },
  { key: 'burger', icon: 'fast-food-outline' as const, label: 'Burger' },
  { key: 'takeout', icon: 'bag-handle-outline' as const, label: 'Takeout' },
  { key: 'dessert', icon: 'ice-cream-outline' as const, label: 'Dessert' },
  { key: 'drinks', icon: 'beer-outline' as const, label: 'Drinks' },
  { key: 'other', icon: 'ellipsis-horizontal' as const, label: 'Other' },
];

// ── Tier helpers ─────────────────────────────────────────────────────────────
function getTierLabel(avg: number): { label: string; color: string } {
  if (avg >= 90) return { label: 'Elite', color: '#22C55E' };
  if (avg >= 75) return { label: 'Strong', color: '#4ADE80' };
  if (avg >= 60) return { label: 'Decent', color: '#F59E0B' };
  if (avg >= 40) return { label: 'Mixed', color: '#FB923C' };
  return { label: 'Needs Work', color: '#EF4444' };
}

export default function FlexScreen() {
  const theme = useTheme();
  const {
    weekly,
    settings,
    fetchWeekly,
    fetchSettings,
    logManualFlex,
  } = useFuelStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ticket glow animation
  const glowAnim = React.useRef(new Animated.Value(0.6)).current;

  useFocusEffect(
    useCallback(() => {
      fetchWeekly();
      fetchSettings();
    }, []),
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWeekly(), fetchSettings()]);
    setRefreshing(false);
  };

  const budget = weekly?.flex_budget;
  const flexAvailable = budget?.flex_available ?? 0;
  const flexBudgetTotal = budget?.flex_budget ?? 4;
  const flexUsed = budget?.flex_used ?? 0;
  const cleanLogged = budget?.clean_meals_logged ?? 0;
  const cleanTarget = budget?.clean_meals_target ?? 17;
  const cleanPct = budget?.clean_pct ?? settings?.clean_eating_pct ?? 80;
  const projectedAvg = budget?.projected_weekly_avg ?? 0;
  const mealsLogged = budget?.meals_logged ?? 0;
  const expectedMeals = budget?.expected_meals ?? 21;
  const tier = getTierLabel(projectedAvg);

  // Meals from daily breakdown
  const allMeals = useMemo(() => {
    if (!weekly?.daily_breakdown) return [];
    const meals: Array<{ date: string; title: string; score: number; isClean: boolean; day: string }> = [];
    const fuelTarget = budget?.fuel_target ?? 80;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const day of weekly.daily_breakdown) {
      const d = new Date(day.date + 'T12:00:00');
      const dayLabel = dayNames[d.getDay()];
      for (const m of day.meals) {
        meals.push({
          date: day.date,
          title: m.title || 'Meal',
          score: m.fuel_score ?? 0,
          isClean: (m.fuel_score ?? 0) >= fuelTarget,
          day: dayLabel,
        });
      }
    }
    return meals;
  }, [weekly, budget?.fuel_target]);

  const handleLogFlex = async () => {
    if (flexAvailable <= 0) {
      Alert.alert('No Flex Meals', 'You\'ve used all your flex meals this week. Eat clean to maintain your score.');
      return;
    }
    setIsLogging(true);
    const result = await logManualFlex({ tag: selectedTag || 'other' });
    setIsLogging(false);
    if (result) {
      setShowLogSheet(false);
      setSelectedTag(null);
      setToastMessage(
        `${result.title} logged! ${result.flex_available} flex meal${result.flex_available !== 1 ? 's' : ''} remaining`,
      );
    } else {
      Alert.alert('Logging Failed', 'Something went wrong logging your flex meal. Please try again.');
    }
  };

  return (
    <ScreenContainer padded={false} safeArea={false}>
      <FlexUnlockedToast message={toastMessage} onDismissed={() => setToastMessage(null)} />
      <AppScreenHeader title="Flex Budget" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      >
        {/* ── Section 1: Budget Hero ── */}
        <View style={[styles.heroCard, { backgroundColor: theme.card.background, borderColor: GOLD + '30' }]}>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Your Flex Budget</Text>

          {/* Ticket Row */}
          <View style={styles.ticketRow}>
            {Array.from({ length: flexBudgetTotal }).map((_, idx) => {
              const isAvailable = idx < flexAvailable;
              const isUsed = idx >= flexBudgetTotal - flexUsed && idx >= flexAvailable;
              return (
                <Animated.View
                  key={idx}
                  style={[
                    styles.ticket,
                    isAvailable
                      ? {
                          backgroundColor: GOLD + '18',
                          borderColor: GOLD + '50',
                          boxShadow: `0px 0px 6px ${GOLD_GLOW}59`,
                        }
                      : isUsed
                        ? { backgroundColor: RED + '10', borderColor: RED + '30' }
                        : { backgroundColor: theme.surfaceHighlight + '60', borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name={isAvailable ? 'ticket' : isUsed ? 'close-circle' : 'ticket-outline'}
                    size={18}
                    color={isAvailable ? GOLD : isUsed ? RED + '60' : theme.textTertiary}
                  />
                </Animated.View>
              );
            })}
          </View>

          <Text style={[styles.heroCount, { color: GOLD }]}>
            {flexAvailable} available
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>{cleanPct}%</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Clean goal</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>{cleanLogged}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>of {cleanTarget} clean target</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: tier.color }]}>{Math.min(100, Math.round(projectedAvg))}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{tier.label}</Text>
            </View>
          </View>
        </View>

        {/* ── Section 2: Log a Cheat Meal CTA ── */}
        {!showLogSheet ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowLogSheet(true)}
            style={[styles.logCta, { borderColor: GOLD + '40' }]}
          >
            <LinearGradient
              colors={[GOLD + '12', GOLD + '06'] as any}
              style={styles.logCtaGradient}
            >
              <View style={styles.logCtaIcon}>
                <Ionicons name="pizza" size={22} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logCtaTitle, { color: theme.text }]}>Log a Cheat Meal</Text>
                <Text style={[styles.logCtaSub, { color: theme.textSecondary }]}>
                  Use 1 of your {flexAvailable} flex meal{flexAvailable !== 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={[styles.logSheet, { backgroundColor: theme.card.background, borderColor: GOLD + '30' }]}>
            <View style={styles.logSheetHeader}>
              <Text style={[styles.logSheetTitle, { color: theme.text }]}>What did you have?</Text>
              <TouchableOpacity onPress={() => { setShowLogSheet(false); setSelectedTag(null); }}>
                <Ionicons name="close-circle" size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.tagGrid}>
              {FLEX_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.key}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTag(selectedTag === tag.key ? null : tag.key)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selectedTag === tag.key ? GOLD + '20' : theme.surfaceHighlight + '60',
                      borderColor: selectedTag === tag.key ? GOLD + '50' : theme.border,
                    },
                  ]}
                >
                  <Ionicons name={tag.icon} size={18} color={selectedTag === tag.key ? GOLD : theme.textSecondary} />
                  <Text
                    style={[
                      styles.tagLabel,
                      { color: selectedTag === tag.key ? GOLD : theme.textSecondary },
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Impact Preview */}
            <View style={[styles.impactBox, { backgroundColor: theme.surfaceHighlight + '40' }]}>
              <Text style={[styles.impactText, { color: theme.textSecondary }]}>
                Flex budget: {flexAvailable} → {Math.max(0, flexAvailable - 1)} remaining
              </Text>
              <Text style={[styles.impactText, { color: theme.textSecondary }]}>
                Weekly avg stays around {Math.min(100, Math.round(projectedAvg > 0 ? projectedAvg - 3 : 85))} — {tier.label} tier
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLogFlex}
              disabled={isLogging || flexAvailable <= 0}
              style={[styles.logBtn, { opacity: isLogging || flexAvailable <= 0 ? 0.5 : 1 }]}
            >
              <LinearGradient colors={[GOLD, GOLD_DARK] as any} style={styles.logBtnGradient}>
                <Ionicons name="ticket" size={16} color="#fff" />
                <Text style={styles.logBtnText}>
                  {isLogging ? 'Logging...' : 'Use Flex Meal'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Section 3: This Week Breakdown ── */}
        <View style={[styles.section, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>This Week</Text>

          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownDot, { backgroundColor: GREEN }]} />
            <Text style={[styles.breakdownText, { color: theme.text }]}>
              {cleanLogged} clean meal{cleanLogged !== 1 ? 's' : ''} logged
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownDot, { backgroundColor: GOLD }]} />
            <Text style={[styles.breakdownText, { color: theme.text }]}>
              {flexUsed} flex meal{flexUsed !== 1 ? 's' : ''} used
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownDot, { backgroundColor: theme.textTertiary }]} />
            <Text style={[styles.breakdownText, { color: theme.text }]}>
              {Math.max(0, expectedMeals - mealsLogged)} meals remaining
            </Text>
          </View>

          {mealsLogged > 0 && (
            <View style={[styles.proofBox, { backgroundColor: GREEN + '10', borderColor: GREEN + '25' }]}>
              <Ionicons name="checkmark-circle" size={16} color={GREEN} />
              <Text style={[styles.proofText, { color: GREEN }]}>
                {flexUsed > 0
                  ? `Even with ${flexUsed} treat${flexUsed !== 1 ? 's' : ''}, your weekly avg is ${Math.min(100, Math.round(projectedAvg))} — ${tier.label} tier`
                  : `Weekly avg: ${Math.min(100, Math.round(projectedAvg))} — ${tier.label} tier`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Section 4: Meal Log ── */}
        {allMeals.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Meals This Week</Text>
            {allMeals.map((meal, idx) => (
              <View
                key={idx}
                style={[
                  styles.mealRow,
                  idx < allMeals.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.surfaceHighlight },
                ]}
              >
                <View style={[styles.mealDot, { backgroundColor: meal.isClean ? GREEN : GOLD }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mealTitle, { color: theme.text }]} numberOfLines={1}>
                    {meal.title}
                  </Text>
                  <Text style={[styles.mealMeta, { color: theme.textTertiary }]}>
                    {meal.day}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.mealScore,
                    { color: meal.isClean ? GREEN : GOLD },
                  ]}
                >
                  {meal.isClean ? `Fuel ${Math.min(100, Math.round(meal.score))}` : 'FLEX'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Section 5: How Flex Works ── */}
        <View style={[styles.section, { backgroundColor: theme.card.background, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>How Flex Works</Text>

          <Text style={[styles.explainerBody, { color: theme.textSecondary }]}>
            Your goal: <Text style={{ color: theme.text, fontWeight: '700' }}>{cleanPct}% clean eating</Text>
          </Text>
          <Text style={[styles.explainerBody, { color: theme.textSecondary }]}>
            = {cleanTarget} clean meals + {flexBudgetTotal} guilt-free treats per week
          </Text>

          <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
            {[
              { icon: 'leaf' as const, color: GREEN, text: `Eat clean — meals scoring ${budget?.fuel_target ?? 80}+ keep your budget full` },
              { icon: 'pizza' as const, color: GOLD, text: 'Use flex meals on anything — pizza, takeout, dessert' },
              { icon: 'analytics' as const, color: '#3B82F6', text: `${cleanTarget} clean + ${flexBudgetTotal} flex = avg ~${Math.round((cleanTarget * 95 + flexBudgetTotal * 35) / expectedMeals)} — ${getTierLabel(Math.round((cleanTarget * 95 + flexBudgetTotal * 35) / expectedMeals)).label} tier` },
              { icon: 'refresh' as const, color: '#8B5CF6', text: 'Fresh budget every Monday — use them or lose them' },
            ].map((item, idx) => (
              <View key={idx} style={styles.explainerRow}>
                <View style={[styles.explainerIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <Text style={[styles.explainerText, { color: theme.textSecondary }]}>{item.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/(home)/flex-onboarding' as any)}
            style={styles.changeGoalBtn}
          >
            <Ionicons name="settings-outline" size={14} color={GOLD} />
            <Text style={[styles.changeGoalText, { color: GOLD }]}>Change goal</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 0, paddingBottom: 80 },

  // Hero
  heroCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: Spacing.md,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  ticket: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCount: {
    fontSize: FontSize.md,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.md, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500' },
  statDivider: { width: 1, height: 28, opacity: 0.3 },

  // Log CTA
  logCta: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  logCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  logCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GOLD + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCtaTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  logCtaSub: { fontSize: FontSize.xs, fontWeight: '500', marginTop: 1 },

  // Log Sheet
  logSheet: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  logSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logSheetTitle: { fontSize: FontSize.md, fontWeight: '700' },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  impactBox: {
    borderRadius: 10,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 2,
  },
  impactText: { fontSize: 12, fontWeight: '500' },
  logBtn: { borderRadius: 12, overflow: 'hidden' },
  logBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  logBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // Section
  section: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownText: { fontSize: FontSize.sm, fontWeight: '500' },
  proofBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  proofText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Meal log
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
  },
  mealDot: { width: 6, height: 6, borderRadius: 3 },
  mealTitle: { fontSize: FontSize.sm, fontWeight: '500' },
  mealMeta: { fontSize: 11, fontWeight: '400', marginTop: 1 },
  mealScore: { fontSize: FontSize.xs, fontWeight: '700' },

  // Explainer
  explainerBody: { fontSize: FontSize.sm, fontWeight: '500', lineHeight: 20 },
  explainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  explainerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  explainerText: { fontSize: FontSize.xs, fontWeight: '500', lineHeight: 18, flex: 1, paddingTop: 6 },
  changeGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  changeGoalText: { fontSize: FontSize.xs, fontWeight: '600' },
});
