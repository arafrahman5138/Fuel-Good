import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { FuelScoreRing } from '../../components/onboarding-v2/FuelScoreRing';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';

type Phase = 'intro' | 'scanning' | 'result';

const FLAGS = [
  'High Fructose Corn Syrup',
  'Caramel Color',
  'Phosphoric Acid',
];

export default function LiveScanScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { setScanCompleted, setReviewPromptShown } = useOnboardingState();

  const [phase, setPhase] = useState<Phase>('intro');
  const [showSwap, setShowSwap] = useState(false);
  const [visibleFlags, setVisibleFlags] = useState<number>(0);

  // Intro animations
  const introFade = useRef(new Animated.Value(0)).current;
  const introSlide = useRef(new Animated.Value(20)).current;

  // Scanning animations
  const scanPulse = useRef(new Animated.Value(1)).current;
  const scanBarY = useRef(new Animated.Value(0)).current;

  // Result animations
  const resultFade = useRef(new Animated.Value(0)).current;
  const resultSlide = useRef(new Animated.Value(40)).current;
  const verdictFade = useRef(new Animated.Value(0)).current;
  const swapSlide = useRef(new Animated.Value(60)).current;
  const swapFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    analytics.trackScreenView(9, 'live_scan');

    Animated.parallel([
      Animated.timing(introFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(introSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    return () => analytics.trackScreenExit(9);
  }, []);

  const startScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('scanning');

    // Pulse animation for the scanning indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanPulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Scanning bar moving
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanBarY, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanBarY, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // After 2s, show result
    setTimeout(() => showResult(), 2000);
  };

  const showResult = () => {
    setPhase('result');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setScanCompleted(true);
    analytics.trackEvent('onboarding_scan_completed');

    // Animate result in
    Animated.parallel([
      Animated.timing(resultFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(resultSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Show verdict
    setTimeout(() => {
      Animated.timing(verdictFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 400);

    // Stagger flags
    FLAGS.forEach((_, i) => {
      setTimeout(() => setVisibleFlags((prev) => prev + 1), 800 + i * 350);
    });

    // Slide up swap card
    setTimeout(() => {
      setShowSwap(true);
      Animated.parallel([
        Animated.timing(swapSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(swapFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 2000);

    // Show continue button
    setTimeout(() => {
      Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 2500);

    // Request store review after everything renders
    setTimeout(async () => {
      try {
        if (await StoreReview.hasAction()) {
          await StoreReview.requestReview();
          setReviewPromptShown(true);
          analytics.trackEvent('onboarding_review_prompted');
        }
      } catch {}
    }, 3000);
  };

  const handleContinue = () => {
    analytics.trackEvent('live_scan_continue');
    router.push('/onboarding-v2/social-proof');
  };

  // --- INTRO PHASE ---
  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Animated.View style={{ opacity: introFade, transform: [{ translateY: introSlide }] }}>
            <View style={styles.iconCircle}>
              <Ionicons name="scan-outline" size={48} color="#22C55E" />
            </View>
            <Text style={styles.headline}>Try it yourself.</Text>
            <Text style={styles.subtext}>
              Scan something in your kitchen — or we'll show you an example.
            </Text>
          </Animated.View>

          <View style={styles.introButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={startScan} activeOpacity={0.8}>
              <Ionicons name="barcode-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Open Scanner</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={showResult} activeOpacity={0.7}>
              <Text style={styles.linkText}>Show me an example</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <OnboardingProgress total={12} current={8} />
        </View>
      </SafeAreaView>
    );
  }

  // --- SCANNING PHASE ---
  if (phase === 'scanning') {
    const barTranslateY = scanBarY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 120],
    });

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.scanningContent}>
          <Animated.View style={[styles.scanBox, { transform: [{ scale: scanPulse }] }]}>
            <View style={styles.scanCorner} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
            <Animated.View style={[styles.scanBar, { transform: [{ translateY: barTranslateY }] }]} />
            <Ionicons name="barcode-outline" size={64} color="#666" style={styles.scanBarcode} />
          </Animated.View>
          <Text style={styles.scanningText}>Scanning...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- RESULT PHASE ---
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.resultScroll}>
        <Text style={styles.resultLabel}>Here's what we found</Text>

        <Animated.View
          style={[styles.resultCard, { opacity: resultFade, transform: [{ translateY: resultSlide }] }]}
        >
          {/* Product header */}
          <View style={styles.productHeader}>
            <View style={styles.productIcon}>
              <Ionicons name="wine-outline" size={28} color="#EF4444" />
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>Coca-Cola Classic</Text>
              <Text style={styles.productBrand}>The Coca-Cola Company</Text>
            </View>
          </View>

          {/* Score + Verdict row */}
          <View style={styles.scoreRow}>
            <FuelScoreRing score={8} size={80} animated />
            <Animated.View style={[styles.verdictContainer, { opacity: verdictFade }]}>
              <View style={styles.verdictBadge}>
                <Ionicons name="warning" size={14} color="#EF4444" />
                <Text style={styles.verdictText}>Ultra-Processed</Text>
              </View>
              <Text style={styles.verdictSubtext}>
                This product is heavily processed with multiple artificial ingredients.
              </Text>
            </Animated.View>
          </View>

          {/* Ingredient flags */}
          <View style={styles.flagsContainer}>
            <Text style={styles.flagsLabel}>Flagged Ingredients</Text>
            {FLAGS.map((flag, i) => (
              <Animated.View
                key={flag}
                style={[
                  styles.flagRow,
                  { opacity: i < visibleFlags ? 1 : 0, transform: [{ translateX: i < visibleFlags ? 0 : 20 }] },
                ]}
              >
                <View style={styles.flagDot} />
                <Text style={styles.flagText}>{flag}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Swap suggestion */}
        {showSwap && (
          <Animated.View
            style={[styles.swapCard, { opacity: swapFade, transform: [{ translateY: swapSlide }] }]}
          >
            <View style={styles.swapHeader}>
              <Ionicons name="swap-horizontal" size={18} color="#22C55E" />
              <Text style={styles.swapTitle}>Better Alternative</Text>
            </View>
            <View style={styles.swapContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapName}>Sparkling water with lime</Text>
                <Text style={styles.swapSub}>Zero processed ingredients</Text>
              </View>
              <View style={styles.swapScore}>
                <Text style={styles.swapScoreNumber}>98</Text>
                <Text style={styles.swapScoreLabel}>Score</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      <Animated.View style={[styles.bottomContainer, { opacity: buttonFade }]}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
        <View style={styles.progressWrapper}>
          <OnboardingProgress total={12} current={8} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtext: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  introButtons: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  linkText: {
    fontSize: 15,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
  progressContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },

  // Scanning
  scanningContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 200,
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#22C55E',
    borderTopLeftRadius: 8,
  },
  scanCornerTR: {
    left: undefined,
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
  },
  scanCornerBL: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 3,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 8,
  },
  scanCornerBR: {
    top: undefined,
    bottom: 0,
    left: undefined,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 8,
  },
  scanBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#22C55E',
    borderRadius: 1,
  },
  scanBarcode: {
    opacity: 0.3,
  },
  scanningText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 24,
  },

  // Result
  resultScroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#252525',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  productBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  verdictContainer: {
    flex: 1,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    marginBottom: 6,
  },
  verdictText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  verdictSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  flagsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingTop: 14,
  },
  flagsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  flagText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },

  // Swap card
  swapCard: {
    marginTop: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  swapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  swapTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swapContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swapName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  swapSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  swapScore: {
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  swapScoreNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#22C55E',
  },
  swapScoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#22C55E',
    textTransform: 'uppercase',
  },

  // Bottom
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  continueButton: {
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  progressWrapper: {
    alignItems: 'center',
    paddingBottom: 8,
  },
});
