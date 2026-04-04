import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppScreenHeader } from '../../../components/AppScreenHeader';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { MetabolicRing } from '../../../components/MetabolicRing';
import { ScoreBreakdown } from '../../../components/ScoreBreakdown';
import { useTheme } from '../../../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../../../constants/Colors';
import { getTierConfig, getTierFromScore, useMetabolicBudgetStore } from '../../../stores/metabolicBudgetStore';
import { useThemeStore } from '../../../stores/themeStore';

const COMPONENT_GUIDE = [
  {
    key: 'pas',
    short: 'PAS',
    title: 'Protein Adequacy',
    description: 'Rewards meals and days that hit your protein target and support fullness, recovery, and steadier energy.',
    color: '#22C55E',
  },
  {
    key: 'fs',
    short: 'FS',
    title: 'Fiber Support',
    description: 'Rewards fiber coverage to support stable energy, digestion, and slower glucose swings.',
    color: '#3B82F6',
  },
  {
    key: 'gis',
    short: 'GIS',
    title: 'Glycemic Impact',
    description: 'Tracks how gently the meal fits your carb budget. Mixed meals can still score well here when the overall load is balanced.',
    color: '#F59E0B',
  },
  {
    key: 'fas',
    short: 'FAS',
    title: 'Fat Adequacy',
    description: 'Rewards balanced fat intake, especially when it supports satiety without crowding out protein.',
    color: '#A855F7',
  },
] as const;

export default function MESBreakdownScreen() {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const dailyMES = useMetabolicBudgetStore((s) => s.dailyScore);
  const budget = useMetabolicBudgetStore((s) => s.budget);
  const fetchAll = useMetabolicBudgetStore((s) => s.fetchAll);
  const loading = useMetabolicBudgetStore((s) => s.loading);
  const scoreHistory = useMetabolicBudgetStore((s) => s.scoreHistory);

  useEffect(() => {
    if (!dailyMES || !budget) {
      fetchAll().catch((err: any) => {
        console.warn('Failed to fetch MES breakdown data:', err?.message);
      });
    }
  }, [dailyMES, budget, fetchAll]);

  if (!dailyMES?.score || !budget) {
    return (
      <ScreenContainer safeArea={false} padded={false}>
        <AppScreenHeader title="MES Breakdown" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {loading ? 'Loading MES breakdown...' : 'MES breakdown unavailable.'}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const score = dailyMES.score;
  const displayTier = score.display_tier || score.tier || 'critical';
  const displayScore = score.display_score || score.total_score || 0;
  const tierCfg = getTierConfig(displayTier);
  const weights = score.weights_used;
  const subScores = score.sub_scores;
  const formulaChips = weights
    ? [
        `PAS ${Math.round(weights.protein * 100)}%`,
        `FS ${Math.round(weights.fiber * 100)}%`,
        `GIS ${Math.round(weights.gis * 100)}%`,
        `FAS ${Math.round(weights.fat * 100)}%`,
      ]
    : [];

  const weekDays = useMemo(() => {
    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    return DAY_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);
      const isFuture = dateStr > todayStr;
      const entry = scoreHistory.find((e) => e.date === dateStr);
      const rawScore = entry ? (entry.display_score ?? entry.total_score ?? 0) : 0;
      const sc = Math.round(rawScore);
      const tier = sc > 0 ? getTierFromScore(sc) : 'critical';
      const color = sc > 0 ? getTierConfig(tier).color : theme.textTertiary;
      return { label, dateStr, score: sc, color, isToday: dateStr === todayStr, isFuture };
    });
  }, [scoreHistory, theme.textTertiary]);

  const weekAvg = useMemo(() => {
    const scored = weekDays.filter((d) => d.score > 0);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, d) => sum + d.score, 0) / scored.length);
  }, [weekDays]);

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <AppScreenHeader title="MES Breakdown" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: tierCfg.color }]}>Metabolic Energy Score</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Today’s MES</Text>
              <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
                A weighted score built from protein, fiber, carb control, and fat adequacy.
              </Text>
            </View>
            <MetabolicRing score={displayScore} tier={displayTier} size={108} showLabel />
          </View>
          <View style={styles.heroBottom}>
            <View style={[styles.tierPill, { backgroundColor: tierCfg.color + '18' }]}>
              <Ionicons name={tierCfg.icon} size={14} color={tierCfg.color} />
              <Text style={[styles.tierPillText, { color: tierCfg.color }]}>{tierCfg.label}</Text>
            </View>
            <Text style={[styles.heroScoreText, { color: theme.textSecondary }]}>
              {displayScore.toFixed(1)} / 100 weighted MES
            </Text>
          </View>
        </View>

        {subScores && weights ? (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Today’s breakdown</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Each component is scored separately, then weighted into your final MES.
            </Text>
            <ScoreBreakdown
              subScores={subScores}
              weights={weights}
              totalMES={displayScore}
              expandable={false}
              initialExpanded
            />
          </View>
        ) : null}

        {/* ── This Week's MES ── */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.weekHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>This Week</Text>
            {weekAvg > 0 && (
              <View style={[styles.weekAvgPill, { backgroundColor: getTierConfig(getTierFromScore(weekAvg)).color + '18' }]}>
                <Text style={[styles.weekAvgText, { color: getTierConfig(getTierFromScore(weekAvg)).color }]}>
                  avg {weekAvg}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
            Daily MES scores for the current week
          </Text>

          <View style={styles.weekBarsWrap}>
            {weekDays.map((day) => (
              <View key={day.dateStr} style={styles.weekDayCol}>
                <Text style={[styles.weekDayScore, { color: day.score > 0 ? day.color : theme.textTertiary }]}>
                  {day.isFuture ? '' : day.score > 0 ? day.score : '–'}
                </Text>
                <View style={[styles.weekBarTrack, { backgroundColor: theme.surfaceHighlight }]}>
                  {day.score > 0 && (
                    <View
                      style={[
                        styles.weekBarFill,
                        {
                          height: `${Math.max(day.score, 4)}%`,
                          backgroundColor: day.color,
                        },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.weekDayLabel,
                    {
                      color: day.isToday ? theme.text : theme.textSecondary,
                      fontWeight: day.isToday ? '700' : '500',
                    },
                  ]}
                >
                  {day.label}
                </Text>
                {day.isToday && (
                  <View style={[styles.todayDot, { backgroundColor: theme.primary }]} />
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>How MES is calculated</Text>
          <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
            MES combines four sub-scores, each normalized to 0-100, then weights them into one total.
          </Text>

          {formulaChips.length > 0 ? (
            <View style={styles.formulaChipWrap}>
              {formulaChips.map((chip) => (
                <View key={chip} style={[styles.formulaChip, { backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.formulaChipText, { color: theme.text }]}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <LinearGradient
            colors={isDark ? [theme.surfaceElevated, theme.surface] : ['#FFFFFF', '#FBFAF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.formulaCard, { borderColor: theme.border }]}
          >
            <Text style={[styles.formulaTitle, { color: theme.text }]}>Formula</Text>
              <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              MES = weighted protein score + weighted fiber score + weighted glycemic score + weighted fat score
            </Text>
          </LinearGradient>

          <View style={styles.guideGrid}>
            {COMPONENT_GUIDE.map((item) => {
              const weightPct =
                item.key === 'pas'
                  ? weights?.protein
                  : item.key === 'fs'
                    ? weights?.fiber
                    : item.key === 'gis'
                      ? weights?.gis
                      : weights?.fat;
              return (
                <View
                  key={item.key}
                  style={[styles.guideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.guideBadge, { backgroundColor: item.color + '18' }]}>
                    <Text style={[styles.guideBadgeText, { color: item.color }]}>{item.short}</Text>
                  </View>
                  <Text style={[styles.guideTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.guideWeight, { color: item.color }]}>
                    {Math.round((weightPct ?? 0) * 100)}% weight
                  </Text>
                  <Text style={[styles.guideDesc, { color: theme.textSecondary }]}>{item.description}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 10,
    paddingTop: Spacing.sm,
    gap: 0,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: Spacing.lg,
    marginBottom: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    lineHeight: 21,
  },
  heroBottom: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  tierPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  heroScoreText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  section: {
    borderWidth: 1,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: FontSize.sm,
    lineHeight: 21,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  formulaChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  formulaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  formulaChipText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  formulaCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  formulaTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  formulaText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  guideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  guideCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.md,
  },
  guideBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  guideBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  guideTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  guideWeight: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  guideDesc: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekAvgPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  weekAvgText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  weekBarsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    gap: 4,
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  weekBarTrack: {
    width: '100%',
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weekBarFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  weekDayScore: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: 4,
    height: 16,
  },
  weekDayLabel: {
    fontSize: FontSize.xs,
    marginTop: 6,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
