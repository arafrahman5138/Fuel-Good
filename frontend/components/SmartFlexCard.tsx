/**
 * SmartFlexCard — Context-aware flex meal coach.
 * Styled as an AI coach card (matching MetabolicCoach).
 * Features staggered entrance animation and flex badge.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

interface FlexSuggestion {
  icon: string;
  title: string;
  body: string;
  accent: string;
}

interface SmartFlexCardProps {
  context: string;
  flexMealsRemaining: number;
  suggestions: FlexSuggestion[];
}

const COACH_GREEN = '#22C55E';
const COACH_GREEN_DARK = '#16A34A';
const FLEX_GOLD = '#F59E0B';

const CONTEXT_SUBTITLES: Record<string, string> = {
  post_flex: 'Recovery guidance',
  budget_low: 'Budget insights',
  on_track: 'Personalized insights',
  pre_flex: 'Planning ahead',
};

export function SmartFlexCard({ context, flexMealsRemaining, suggestions }: SmartFlexCardProps) {
  const theme = useTheme();
  const subtitle = CONTEXT_SUBTITLES[context] || 'Personalized insights';

  const fadeAnims = useRef(suggestions.map(() => new Animated.Value(0))).current;
  const slideAnims = useRef(suggestions.map(() => new Animated.Value(14))).current;

  useEffect(() => {
    fadeAnims.forEach((a) => a.setValue(0));
    slideAnims.forEach((a) => a.setValue(14));

    const anims = suggestions.map((_, idx) =>
      Animated.parallel([
        Animated.timing(fadeAnims[idx], {
          toValue: 1,
          duration: 300,
          delay: idx * 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[idx], {
          toValue: 0,
          duration: 300,
          delay: idx * 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.stagger(0, anims).start();
  }, [suggestions.length]);

  return (
    <View style={[styles.shell, { backgroundColor: theme.card.background, borderColor: theme.card.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={[COACH_GREEN, COACH_GREEN_DARK] as any}
          style={styles.headerIcon}
        >
          <Ionicons name="leaf" size={14} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Fuel Coach</Text>
          <Text style={[styles.headerSub, { color: theme.textTertiary }]}>{subtitle}</Text>
        </View>
        {flexMealsRemaining > 0 && (
          <View style={styles.flexBadge}>
            <Ionicons name="ticket" size={10} color={FLEX_GOLD} />
            <Text style={styles.flexBadgeText}>{flexMealsRemaining}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} style={{ marginLeft: 4 }} />
      </View>

      {/* Insight list with staggered entrance */}
      <View style={styles.insightList}>
        {suggestions.map((s, idx) => {
          const isLast = idx === suggestions.length - 1;
          return (
            <Animated.View
              key={idx}
              style={[
                styles.insightRow,
                !isLast && { borderBottomWidth: 1, borderBottomColor: theme.surfaceHighlight },
                {
                  opacity: fadeAnims[idx] || 1,
                  transform: [{ translateY: slideAnims[idx] || 0 }],
                },
              ]}
            >
              <View style={[styles.insightAccentBar, { backgroundColor: s.accent }]} />
              <View style={styles.insightContent}>
                <View style={styles.insightTitleRow}>
                  <Ionicons name={s.icon as any} size={14} color={s.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.insightTitle, { color: theme.text }]}>{s.title}</Text>
                </View>
                <Text style={[styles.insightBody, { color: theme.textSecondary }]}>{s.body}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 0,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  flexBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F59E0B14',
    borderColor: '#F59E0B30',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  flexBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  insightList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: Spacing.sm + 2,
  },
  insightAccentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  insightContent: {
    flex: 1,
    gap: 3,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  insightBody: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
});
