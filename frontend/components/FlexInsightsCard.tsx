/**
 * FlexInsightsCard — Merged flex tickets + fuel coach insights in one card.
 * Shows earned ticket dots at top, followed by contextual coach suggestions.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { FontSize, Spacing, BorderRadius } from '../constants/Colors';

const GOLD = '#F59E0B';
const GOLD_DARK = '#D97706';
const GOLD_GLOW = '#FBBF24';
const COACH_GREEN = '#22C55E';
const COACH_GREEN_DARK = '#16A34A';

// ── Copy logic ──────────────────────────────────────────────────────────────
function getFlexCopy(remaining: number, max: number): { headline: string; subtitle: string } {
  if (remaining <= 0) {
    return {
      headline: 'Flex meals loading...',
      subtitle: 'Every clean meal gets you closer to guilt-free treats',
    };
  }
  if (remaining === 1) {
    return {
      headline: '1 flex meal unlocked',
      subtitle: 'You earned it — go enjoy something you love',
    };
  }
  const ratio = remaining / max;
  if (ratio <= 0.25) {
    return {
      headline: `${remaining} flex meals left`,
      subtitle: 'Make them count — save for something you really want',
    };
  }
  if (ratio <= 0.6) {
    return {
      headline: `${remaining} flex meals unlocked`,
      subtitle: 'Clean eating is paying off — treat yourself guilt-free',
    };
  }
  return {
    headline: `${remaining} flex meals unlocked`,
    subtitle: "You're crushing it — your flex budget is fully stacked",
  };
}

// ── Explainer Modal ─────────────────────────────────────────────────────────
const HOW_ITEMS = [
  { icon: 'leaf' as const, color: '#22C55E', title: 'Eat clean, earn points', body: 'Every meal you score above your target earns flex points.' },
  { icon: 'ticket' as const, color: GOLD, title: 'Points convert to meals', body: 'Enough points = 1 flex meal. Eating well typically earns 5–7 flex meals per week.' },
  { icon: 'pizza' as const, color: '#FB923C', title: 'Spend them guilt-free', body: 'Pizza, takeout, dessert — flex meals are earned treats, not cheat days.' },
  { icon: 'refresh' as const, color: '#3B82F6', title: 'Budget resets each week', body: "Fresh start every Monday. Unused meals don't roll over." },
];

function FlexExplainerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const sheetAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      <Animated.View style={[modalStyles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <Animated.View style={[modalStyles.sheet, { backgroundColor: theme.card.background, transform: [{ translateY: sheetAnim }] }]}>
          <SafeAreaView>
            <View style={[modalStyles.handle, { backgroundColor: theme.border }]} />
            <LinearGradient colors={[GOLD + '18', GOLD + '05'] as any} style={modalStyles.hero}>
              <LinearGradient colors={[GOLD, GOLD_DARK] as any} style={modalStyles.heroIcon}>
                <Ionicons name="ticket" size={22} color="#fff" />
              </LinearGradient>
              <Text style={[modalStyles.title, { color: theme.text }]}>Flex Meals</Text>
              <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>Eat clean, earn cheat meals — that's the deal.</Text>
            </LinearGradient>
            <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent} showsVerticalScrollIndicator={false}>
              {HOW_ITEMS.map((item, idx) => (
                <View key={idx} style={[modalStyles.howRow, idx < HOW_ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.surfaceHighlight }]}>
                  <View style={[modalStyles.howIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={modalStyles.howText}>
                    <Text style={[modalStyles.howTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[modalStyles.howBody, { color: theme.textSecondary }]}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.85} style={modalStyles.closeRow}>
              <View style={[modalStyles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}>
                <Text style={[modalStyles.closeBtnText, { color: theme.text }]}>Got it</Text>
              </View>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface FlexSuggestion {
  icon: string;
  title: string;
  body: string;
  accent: string;
}

interface FlexInsightsCardProps {
  flexMealsRemaining: number;
  maxFlex?: number;
  /** Fuel coach suggestions — if provided, coach section renders below tickets */
  coachContext?: string;
  coachSuggestions?: FlexSuggestion[];
}

const CONTEXT_SUBTITLES: Record<string, string> = {
  post_flex: 'Recovery guidance',
  budget_low: 'Budget insights',
  on_track: 'Personalized insights',
  pre_flex: 'Planning ahead',
};

// ── Component ────────────────────────────────────────────────────────────────
export function FlexInsightsCard({
  flexMealsRemaining,
  maxFlex = 7,
  coachContext,
  coachSuggestions,
}: FlexInsightsCardProps) {
  const theme = useTheme();
  const [explainerVisible, setExplainerVisible] = useState(false);
  const ticketCount = Math.min(flexMealsRemaining, maxFlex);
  const flexCopy = getFlexCopy(flexMealsRemaining, maxFlex);
  const hasCoach = coachSuggestions && coachSuggestions.length > 0;
  const coachSubtitle = CONTEXT_SUBTITLES[coachContext ?? ''] || 'Personalized insights';

  // Ticket glow
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (ticketCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [ticketCount]);

  // Staggered coach entrance
  // Keep ref arrays in sync with current suggestion count synchronously during render
  // (useRef initializer only runs once, so arrays would be empty if data loads async)
  const fadeAnims = useRef<Animated.Value[]>([]);
  const slideAnims = useRef<Animated.Value[]>([]);
  const animCount = coachSuggestions?.length ?? 0;
  if (fadeAnims.current.length !== animCount) {
    fadeAnims.current = Array.from({ length: animCount }, () => new Animated.Value(0));
    slideAnims.current = Array.from({ length: animCount }, () => new Animated.Value(14));
  }

  useEffect(() => {
    if (!hasCoach) return;
    fadeAnims.current.forEach((a) => a.setValue(0));
    slideAnims.current.forEach((a) => a.setValue(14));
    const anims = fadeAnims.current.map((fade, idx) =>
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 300, delay: idx * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slideAnims.current[idx], { toValue: 0, duration: 300, delay: idx * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    );
    if (anims.length > 0) Animated.stagger(0, anims).start();
  }, [coachSuggestions?.length]);

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.card.background, borderColor: ticketCount > 0 ? GOLD + '30' : theme.border }]}>
        {/* ── Tickets Section ── */}
        <TouchableOpacity activeOpacity={0.78} onPress={() => setExplainerVisible(true)}>
          <View style={styles.ticketHeader}>
            <View style={styles.ticketRow}>
              {Array.from({ length: maxFlex }).map((_, idx) => {
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
                            shadowColor: GOLD_GLOW,
                            shadowOpacity: glowAnim as any,
                            shadowRadius: 5,
                            shadowOffset: { width: 0, height: 0 } as any,
                          }
                        : {
                            backgroundColor: theme.surfaceHighlight + '60',
                            borderColor: theme.border,
                          },
                    ]}
                  >
                    <Ionicons
                      name={isEarned ? 'ticket' : 'ticket-outline'}
                      size={14}
                      color={isEarned ? GOLD : theme.textTertiary}
                    />
                  </Animated.View>
                );
              })}
            </View>
            <Ionicons name="information-circle-outline" size={18} color={GOLD} />
          </View>
          <Text style={[styles.flexHeadline, { color: theme.text }]}>{flexCopy.headline}</Text>
          <Text style={[styles.flexSubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
            {flexCopy.subtitle}
          </Text>
        </TouchableOpacity>

        {/* ── Coach Section ── */}
        {hasCoach && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.surfaceHighlight }]} />

            <View style={styles.coachHeader}>
              <LinearGradient colors={[COACH_GREEN, COACH_GREEN_DARK] as any} style={styles.coachIcon}>
                <Ionicons name="leaf" size={14} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.coachTitle, { color: theme.text }]}>Fuel Coach</Text>
                <Text style={[styles.coachSub, { color: theme.textTertiary }]}>{coachSubtitle}</Text>
              </View>
              {flexMealsRemaining > 0 && (
                <View style={styles.coachBadge}>
                  <Ionicons name="ticket" size={10} color={GOLD} />
                  <Text style={styles.coachBadgeText}>{flexMealsRemaining}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} style={{ marginLeft: 4 }} />
            </View>

            <View style={styles.insightList}>
              {coachSuggestions!.map((s, idx) => {
                const isLast = idx === coachSuggestions!.length - 1;
                return (
                  <Animated.View
                    key={idx}
                    style={[
                      styles.insightRow,
                      !isLast && { borderBottomWidth: 1, borderBottomColor: theme.surfaceHighlight },
                      { opacity: fadeAnims.current[idx] ?? 1, transform: [{ translateY: slideAnims.current[idx] ?? new Animated.Value(0) }] },
                    ]}
                  >
                    <View style={[styles.insightBar, { backgroundColor: s.accent }]} />
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
          </>
        )}
      </View>

      <FlexExplainerModal visible={explainerVisible} onClose={() => setExplainerVisible(false)} />
    </>
  );
}

// ── Card styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
  },
  ticketRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ticket: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexHeadline: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  flexSubtitle: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 17,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm + 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.md,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
  },
  coachIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  coachSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  coachBadge: {
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
  coachBadgeText: {
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
  insightBar: {
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

// ── Modal styles ─────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  hero: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: FontSize.sm, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  scroll: { maxHeight: 400 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  howIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howText: { flex: 1, gap: 3 },
  howTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  howBody: { fontSize: FontSize.xs, lineHeight: 17, fontWeight: '400' },
  closeRow: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  closeBtn: { borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  closeBtnText: { fontSize: FontSize.md, fontWeight: '700' },
});
