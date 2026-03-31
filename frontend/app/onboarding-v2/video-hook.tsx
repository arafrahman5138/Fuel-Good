import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCENE_DURATION = 3000;

// ─── Animated Score Counter ────────────────────────────────────────────
function AnimatedScore({
  target,
  color,
  delay = 0,
}: {
  target: number;
  color: string;
  delay?: number;
}) {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listener = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: target, duration: 1200, useNativeDriver: false }),
      ]).start();
    }, delay);
    return () => {
      clearTimeout(timeout);
      anim.removeListener(listener);
    };
  }, [target, delay]);

  return (
    <Animated.View style={[styles.scoreBadge, { borderColor: color, opacity }]}>
      <Text style={[styles.scoreNumber, { color }]}>{display}</Text>
      <Text style={styles.scoreLabel}>Fuel Score</Text>
    </Animated.View>
  );
}

// ─── Ingredient Flag Pill ──────────────────────────────────────────────
function IngredientFlag({ label, delay }: { label: string; delay: number }) {
  const slideX = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View
      style={[styles.flagPill, { opacity, transform: [{ translateX: slideX }] }]}
    >
      <Ionicons name="warning" size={13} color="#F87171" style={{ marginRight: 5 }} />
      <Text style={styles.flagText}>{label}</Text>
    </Animated.View>
  );
}

// ─── Mini Bar Chart ────────────────────────────────────────────────────
function MiniBarChart() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const values = [100, 100, 100, 100, 100, 35, 45];
  const colors = ['#22C55E', '#22C55E', '#22C55E', '#22C55E', '#22C55E', '#F59E0B', '#F59E0B'];
  const barAnims = useRef(values.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: values[i],
        duration: 600,
        delay: i * 80,
        useNativeDriver: false,
      })
    );
    Animated.stagger(80, animations).start();
  }, []);

  return (
    <View style={styles.chartContainer}>
      {days.map((day, i) => (
        <View key={i} style={styles.chartColumn}>
          <View style={styles.chartBarTrack}>
            <Animated.View
              style={[
                styles.chartBar,
                {
                  backgroundColor: colors[i],
                  height: barAnims[i].interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.chartDayLabel}>{day}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Flex Ticket ───────────────────────────────────────────────────────
function FlexTicket({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.spring(scale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View style={[styles.flexTicket, { transform: [{ scale }] }]}>
      <Ionicons name="ticket" size={18} color="#F59E0B" />
    </Animated.View>
  );
}

// ─── Feature Pill ──────────────────────────────────────────────────────
function FeaturePill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.featurePill}>
      <Ionicons name={icon} size={16} color="#22C55E" style={{ marginRight: 6 }} />
      <Text style={styles.featurePillText}>{label}</Text>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Screen
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Background gradient colors per scene
const SCENE_GRADIENTS: [string, string][] = [
  ['#0A0A0A', '#1A0505'], // Scene 1: warm/red tint (danger)
  ['#0A0A0A', '#0A0F0A'], // Scene 2: neutral → green tint (swap)
  ['#0A0A0A', '#0A0F14'], // Scene 3: cool blue tint (system)
  ['#0A0A0A', '#051A0A'], // Scene 4: green tint (CTA)
];

export default function VideoHookScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useOnboardingAnalytics();
  const [currentScene, setCurrentScene] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  // One opacity per scene
  const sceneOpacities = useRef([
    new Animated.Value(1),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Background gradient interpolation
  const gradientProgress = useRef(new Animated.Value(0)).current;

  // Track analytics
  useEffect(() => {
    analytics.trackScreenView(1, 'video_hook');
    return () => analytics.trackScreenExit(1);
  }, []);

  // Scene auto-advance
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Show skip after 8 seconds
    timers.push(setTimeout(() => setShowSkip(true), 8000));

    // Transition scenes with cross-fade
    for (let i = 0; i < 3; i++) {
      timers.push(
        setTimeout(() => {
          // Cross-fade: fade out current + fade in next simultaneously
          setCurrentScene(i + 1);
          Animated.parallel([
            Animated.timing(sceneOpacities[i], {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(sceneOpacities[i + 1], {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            // Gradient shift
            Animated.timing(gradientProgress, {
              toValue: i + 1,
              duration: 600,
              useNativeDriver: false,
            }),
          ]).start();
        }, (i + 1) * SCENE_DURATION)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.trackEvent('onboarding_video_hook_completed', { scene_reached: currentScene + 1 });
    router.push('/onboarding-v2/energy-check');
  };

  // ── Scene 1: "You think this is healthy?" ──
  const renderScene1 = () => (
    <Animated.View style={[styles.sceneContainer, { opacity: sceneOpacities[0] }]}>
      <Text style={styles.scene1Headline}>YOU THINK THIS{'\n'}IS HEALTHY?</Text>

      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="nutrition" size={28} color="#9CA3AF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>Nature Valley Granola Bar</Text>
            <Text style={styles.productSub}>Oats 'N Honey</Text>
          </View>
        </View>

        <AnimatedScore target={25} color="#EF4444" delay={600} />

        <View style={styles.flagsContainer}>
          <IngredientFlag label="Seed Oils" delay={1200} />
          <IngredientFlag label="Added Sugar" delay={1500} />
          <IngredientFlag label="Refined Flour" delay={1800} />
        </View>
      </View>
    </Animated.View>
  );

  // ── Scene 2: Swap comparison ──
  const renderScene2 = () => (
    <Animated.View style={[styles.sceneContainer, { opacity: sceneOpacities[1] }]}>
      <Text style={styles.scene2Message}>Same craving. Real food.</Text>

      <View style={styles.swapRow}>
        {/* Bad */}
        <View style={[styles.swapCard, styles.swapCardBad]}>
          <Ionicons name="close-circle" size={20} color="#EF4444" />
          <Text style={styles.swapCardTitle} numberOfLines={2}>
            Nature Valley Bar
          </Text>
          <View style={[styles.swapScore, { borderColor: '#EF4444' }]}>
            <Text style={[styles.swapScoreText, { color: '#EF4444' }]}>25</Text>
          </View>
        </View>

        <Ionicons name="arrow-forward" size={24} color="#6B7280" />

        {/* Good */}
        <View style={[styles.swapCard, styles.swapCardGood]}>
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text style={styles.swapCardTitle} numberOfLines={2}>
            Homemade Maple Granola
          </Text>
          <View style={[styles.swapScore, { borderColor: '#22C55E' }]}>
            <Text style={[styles.swapScoreText, { color: '#22C55E' }]}>95</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // ── Scene 3: Flex system preview ──
  const renderScene3 = () => (
    <Animated.View style={[styles.sceneContainer, { opacity: sceneOpacities[2] }]}>
      <Text style={styles.scene3Headline}>Eat clean. Earn your cheat meals.</Text>

      <View style={styles.flexPreviewCard}>
        <MiniBarChart />

        <View style={styles.weeklyAvgRow}>
          <Text style={styles.weeklyAvgLabel}>Weekly Average</Text>
          <View style={styles.weeklyAvgBadge}>
            <Text style={styles.weeklyAvgValue}>87.6</Text>
          </View>
        </View>

        <View style={styles.flexTicketsRow}>
          <Text style={styles.flexTicketsLabel}>Flex Tickets Earned</Text>
          <View style={styles.flexTicketsIcons}>
            {[0, 1, 2, 3].map((i) => (
              <FlexTicket key={i} delay={400 + i * 200} />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // ── Scene 4: Problem statement + CTA ──
  const renderScene4 = () => (
    <Animated.View style={[styles.sceneContainer, styles.ctaScene, { opacity: sceneOpacities[3] }]}>
      <View style={styles.logoContainer}>
        <Ionicons name="leaf" size={40} color="#22C55E" />
        <Text style={styles.logoText}>Fuel Good</Text>
      </View>

      <Text style={styles.problemHeadline}>
        Healthy eating shouldn't feel like punishment.
      </Text>

      <Text style={styles.ctaTagline}>
        No calorie counting. No restriction.{'\n'}Just eat real food — and earn your cheat meals.
      </Text>

      <View style={styles.featurePillsRow}>
        <FeaturePill icon="scan" label="Scan any food" />
        <FeaturePill icon="ticket" label="Earn flex meals" />
        <FeaturePill icon="sparkles" label="AI-powered plans" />
      </View>
    </Animated.View>
  );

  const bgColor = gradientProgress.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['#0A0A0A', '#0D0A0A', '#0A0D0A', '#0A0F0A'],
  });

  return (
    <Animated.View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: bgColor }]}>
      <StatusBar barStyle="light-content" hidden />

      <View style={styles.scenesWrapper}>
        {renderScene1()}
        {renderScene2()}
        {renderScene3()}
        {renderScene4()}
      </View>

      {/* Bottom area */}
      <View style={styles.bottomArea}>
        {(showSkip || currentScene === 3) && (
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ marginTop: 20 }}>
          <OnboardingProgress total={12} current={0} />
        </View>
      </View>
    </Animated.View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scenesWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sceneContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // ── Scene 1 ──
  scene1Headline: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 32,
    lineHeight: 40,
  },
  productCard: {
    width: '100%',
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#252525',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  productImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  productSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  scoreBadge: {
    alignSelf: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 40,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  flagsContainer: {
    gap: 8,
  },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  flagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
  },

  // ── Scene 2 ──
  scene2Message: {
    fontSize: 22,
    fontWeight: '700',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 28,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  swapCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  swapCardBad: {
    borderColor: 'rgba(239,68,68,0.2)',
  },
  swapCardGood: {
    borderColor: 'rgba(34,197,94,0.2)',
  },
  swapCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 18,
  },
  swapScore: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  swapScoreText: {
    fontSize: 24,
    fontWeight: '800',
  },

  // ── Scene 3 ──
  scene3Headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 32,
  },
  flexPreviewCard: {
    width: '100%',
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#252525',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 90,
    marginBottom: 20,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarTrack: {
    flex: 1,
    width: 24,
    backgroundColor: '#1F1F1F',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
  },
  chartDayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
  },
  weeklyAvgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyAvgLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  weeklyAvgBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  weeklyAvgValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#22C55E',
  },
  flexTicketsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flexTicketsLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  flexTicketsIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  flexTicket: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scene 4 (CTA) ──
  ctaScene: {
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    alignSelf: 'center',
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  problemHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 12,
  },
  ctaTagline: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  featurePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.15)',
  },
  featurePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
  },

  // ── Bottom ──
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
