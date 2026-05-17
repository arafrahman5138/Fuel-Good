/**
 * FlexMealsEarned — Visual celebration of earned room-for-life moments.
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
    title: 'Baseline in progress',
    body: 'A tasty clean meal moves the week right back up',
  },
  low: {
    title: 'A little room for life',
    body: 'Use it intentionally for something you really want',
  },
  mid: {
    title: 'Clean baseline is working',
    body: 'Enjoy life without spiraling',
  },
  high: {
    title: 'Strong baseline built',
    body: 'Consistency is your superpower — real life fits',
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
    { icon: 'leaf' as const, color: '#22C55E', title: `Build a ${cleanPct}% clean baseline`, body: `Meals scoring ${fuelTarget}+ keep the week moving in the right direction. Aim for about ${cleanTarget} clean meals per week.` },
    { icon: 'restaurant' as const, color: '#14B8A6', title: 'Make clean food craveable', body: 'Curated meals and Coach help turn cravings into whole-food meals that still taste good.' },
    { icon: 'ticket' as const, color: GOLD, title: `${flexBudgetCount} life moments can fit`, body: 'Pizza, takeout, dessert, or lunch with friends can fit when your weekly baseline is strong.' },
    { icon: 'analytics' as const, color: '#3B82F6', title: `Week can stay ~${projectedAvg} (${tierLabel})`, body: `${cleanTarget} clean meals plus real-life meals still tells the story: healthy most of the time.` },
    { icon: 'refresh' as const, color: '#8B5CF6', title: 'New week, fresh baseline', body: 'Each week starts fresh. Build the baseline, enjoy life, repeat.' },
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
              <Text style={[styles.modalTitle, { color: theme.text }]}>Room For Life</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Your goal: eat clean most of the time, then let real life fit
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
                  The body responds to consistency. Build the baseline, then let life fit.
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
                ? `${flexMealsRemaining} real-life meal${flexMealsRemaining !== 1 ? 's' : ''} can fit`
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
