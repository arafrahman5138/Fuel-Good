/**
 * FlexMealsEarned — Visual celebration of earned flex/cheat meals.
 * Shows a row of ticket icons (earned = glowing, unearned = outlined).
 * Includes a "?" button that opens an explainer modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

interface FlexMealsEarnedProps {
  flexMealsRemaining: number;
  maxFlex?: number;
  cleanPct?: number;
  cleanTarget?: number;
  flexBudget?: number;
  expectedMeals?: number;
  fuelTarget?: number;
}

const GOLD = '#F59E0B';
const GOLD_DARK = '#D97706';
const GOLD_GLOW = '#FBBF24';

const MOTIVATIONAL_COPY: Record<string, { title: string; body: string }> = {
  zero: {
    title: 'All flex meals used',
    body: 'Focus on clean eating to earn more next week',
  },
  low: {
    title: 'A few treats left',
    body: 'Save them for the weekend or use one now',
  },
  mid: {
    title: 'Your clean eating paid off',
    body: 'Enjoy guilt-free — you earned it',
  },
  high: {
    title: 'Flex budget stacked!',
    body: 'Consistency is your superpower — treat yourself',
  },
};

function getCopyKey(remaining: number, max: number): string {
  if (remaining <= 0) return 'zero';
  const ratio = remaining / max;
  if (ratio <= 0.25) return 'low';
  if (ratio <= 0.6) return 'mid';
  return 'high';
}

// ── Explainer modal ──────────────────────────────────────────────────────────

function buildHowItems(cleanPct: number, cleanTarget: number, flexBudgetCount: number, expectedMeals: number, fuelTarget: number) {
  const projectedAvg = Math.round((cleanTarget * 95 + flexBudgetCount * 35) / expectedMeals);
  const tierLabel = projectedAvg >= 90 ? 'Elite' : projectedAvg >= 75 ? 'Strong' : projectedAvg >= 60 ? 'Decent' : 'Mixed';
  return [
    { icon: 'leaf' as const, color: '#22C55E', title: `Eat clean (${cleanPct}% goal)`, body: `Meals scoring ${fuelTarget}+ count as clean. You need ${cleanTarget} clean meals per week to maintain your budget.` },
    { icon: 'ticket' as const, color: GOLD, title: `${flexBudgetCount} flex meals per week`, body: `Your ${cleanPct}% clean eating goal gives you ${flexBudgetCount} guilt-free treats. Available from day one.` },
    { icon: 'pizza' as const, color: '#FB923C', title: 'Spend them on anything', body: 'Pizza, takeout, dessert — whatever you want. Flex meals are earned treats, not cheat days. No guilt, no reset.' },
    { icon: 'analytics' as const, color: '#3B82F6', title: `Avg stays at ~${projectedAvg} (${tierLabel})`, body: `${cleanTarget} clean + ${flexBudgetCount} flex = weekly avg ${projectedAvg}. Your body absorbs the treats without impact.` },
    { icon: 'refresh' as const, color: '#8B5CF6', title: 'Fresh budget every Monday', body: "Your flex budget resets each week. Unused meals don't roll over, so use them!" },
  ];
}

interface FlexExplainerModalProps {
  visible: boolean;
  onClose: () => void;
  cleanPct?: number;
  cleanTarget?: number;
  flexBudgetCount?: number;
  expectedMeals?: number;
  fuelTarget?: number;
}

function FlexExplainerModal({ visible, onClose, cleanPct = 80, cleanTarget = 17, flexBudgetCount = 4, expectedMeals = 21, fuelTarget = 80 }: FlexExplainerModalProps) {
  const theme = useTheme();
  const sheetAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const howItems = buildHowItems(cleanPct, cleanTarget, flexBudgetCount, expectedMeals, fuelTarget);

  useEffect(() => {
    if (visible) {
      sheetAnim.setValue(60);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(sheetAnim, { toValue: 0, tension: 55, friction: 12, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 60, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <Animated.View
          style={[
            styles.modalSheet,
            { backgroundColor: theme.card.background, transform: [{ translateY: sheetAnim }] },
          ]}
        >
          <SafeAreaView>
            {/* Handle */}
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />

            {/* Hero header */}
            <LinearGradient
              colors={[GOLD + '18', GOLD + '05'] as any}
              style={styles.modalHero}
            >
              <LinearGradient
                colors={[GOLD, GOLD_DARK] as any}
                style={styles.modalHeroIcon}
              >
                <Ionicons name="ticket" size={22} color="#fff" />
              </LinearGradient>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Flex Meals</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Your goal: {cleanPct}% clean eating = {flexBudgetCount} guilt-free treats
              </Text>
            </LinearGradient>

            {/* Explainer rows */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {howItems.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.howRow,
                    idx < howItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.surfaceHighlight },
                  ]}
                >
                  <View style={[styles.howIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={styles.howText}>
                    <Text style={[styles.howTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.howBody, { color: theme.textSecondary }]}>{item.body}</Text>
                  </View>
                </View>
              ))}

              {/* Tagline */}
              <View style={[styles.taglineCard, { backgroundColor: theme.primaryMuted, borderColor: theme.primary + '25' }]}>
                <Ionicons name="sparkles" size={16} color={theme.primary} />
                <Text style={[styles.taglineText, { color: theme.primary }]}>
                  The body rewards consistency. Earn your treats.
                </Text>
              </View>
            </ScrollView>

            {/* Close button */}
            <TouchableOpacity onPress={handleClose} activeOpacity={0.85} style={styles.closeRow}>
              <View style={[styles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}>
                <Text style={[styles.closeBtnText, { color: theme.text }]}>Got it</Text>
              </View>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FlexMealsEarned({ flexMealsRemaining, maxFlex = 7, cleanPct = 80, cleanTarget = 17, flexBudget = 4, expectedMeals = 21, fuelTarget = 80 }: FlexMealsEarnedProps) {
  const theme = useTheme();
  const [explainerVisible, setExplainerVisible] = useState(false);
  const ticketCount = Math.min(flexMealsRemaining, maxFlex);
  const totalSlots = maxFlex;
  const copy = MOTIVATIONAL_COPY[getCopyKey(flexMealsRemaining, maxFlex)];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    if (ticketCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [ticketCount]);

  return (
    <>
      <Animated.View
        style={[
          styles.containerAnim,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setExplainerVisible(true)}
          style={[
            styles.container,
            {
              backgroundColor: theme.card.background,
              borderColor: ticketCount > 0 ? GOLD + '30' : theme.border,
            },
          ]}
        >
        {/* Ticket row */}
        <View style={styles.ticketRow}>
          {Array.from({ length: totalSlots }).map((_, idx) => {
            const isEarned = idx < ticketCount;
            return (
              <Animated.View
                key={idx}
                style={[
                  styles.ticket,
                  isEarned
                    ? {
                        backgroundColor: GOLD + '18',
                        borderColor: GOLD + '50',
                        boxShadow: `0px 0px 6px ${GOLD_GLOW}59`,
                      }
                    : {
                        backgroundColor: theme.surfaceHighlight + '60',
                        borderColor: theme.border,
                      },
                ]}
              >
                <Ionicons
                  name={isEarned ? 'ticket' : 'ticket-outline'}
                  size={16}
                  color={isEarned ? GOLD : theme.textTertiary}
                />
              </Animated.View>
            );
          })}
        </View>

        {/* Copy */}
        <View style={styles.copyWrap}>
          <View style={styles.copyHeader}>
            {ticketCount > 0 && (
              <LinearGradient
                colors={[GOLD, GOLD_DARK] as any}
                style={styles.countBadge}
              >
                <Text style={styles.countText}>{flexMealsRemaining}</Text>
              </LinearGradient>
            )}
            <Text style={[styles.copyTitle, { color: theme.text }]}>
              {ticketCount > 0
                ? `${flexMealsRemaining} flex meal${flexMealsRemaining !== 1 ? 's' : ''} earned`
                : copy.title}
            </Text>
          </View>
          <Text style={[styles.copyBody, { color: theme.textSecondary }]}>{copy.body}</Text>
        </View>

        {/* Info button — bottom right */}
        <Ionicons name="information-circle" size={20} color={GOLD} style={styles.helpBtn} />
        </TouchableOpacity>
      </Animated.View>

      <FlexExplainerModal
        visible={explainerVisible}
        onClose={() => setExplainerVisible(false)}
        cleanPct={cleanPct}
        cleanTarget={cleanTarget}
        flexBudgetCount={flexBudget}
        expectedMeals={expectedMeals}
        fuelTarget={fuelTarget}
      />
    </>
  );
}

const styles = StyleSheet.create({
  containerAnim: {
    marginBottom: Spacing.md,
  },
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
  },
  helpBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm + 2,
  },
  ticket: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    alignItems: 'center',
    gap: 3,
  },
  copyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  copyTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  copyBody: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalHero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  modalHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalScroll: {
    maxHeight: 480,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  howText: {
    flex: 1,
    gap: 3,
  },
  howTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  howBody: {
    fontSize: FontSize.xs,
    lineHeight: 17,
    fontWeight: '400',
  },
  taglineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  taglineText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  closeRow: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  closeBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
