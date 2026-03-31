import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';

export default function NotificationPermissionScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();

  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;
  const previewFade = useRef(new Animated.Value(0)).current;
  const previewSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    analytics.trackScreenView(9, 'notification_permission');

    Animated.sequence([
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(previewFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(previewSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    return () => analytics.trackScreenExit(9);
  }, []);

  const handleEnable = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.trackEvent('onboarding_notifications_enabled');

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      analytics.trackEvent('onboarding_notification_result', { status });
    } catch {}

    router.push('/onboarding-v2/social-proof');
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.trackEvent('onboarding_notifications_skipped');
    router.push('/onboarding-v2/social-proof');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.card,
            { opacity: cardFade, transform: [{ translateY: cardSlide }] },
          ]}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="notifications-outline" size={36} color="#22C55E" />
          </View>

          <Text style={styles.headline}>Stay on track</Text>
          <Text style={styles.subtext}>
            Get daily meal suggestions and flex meal reminders to keep your score high.
          </Text>

          {/* Preview notification */}
          <Animated.View
            style={[
              styles.notificationPreview,
              { opacity: previewFade, transform: [{ translateY: previewSlide }] },
            ]}
          >
            <View style={styles.notifHeader}>
              <Ionicons name="leaf" size={16} color="#22C55E" />
              <Text style={styles.notifApp}>Fuel Good</Text>
              <Text style={styles.notifTime}>now</Text>
            </View>
            <Text style={styles.notifTitle}>Your dinner plan is ready</Text>
            <Text style={styles.notifBody}>
              Grilled chicken bowl — Fuel Score 96. Tap to see the recipe.
            </Text>
          </Animated.View>
        </Animated.View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity activeOpacity={0.85} onPress={handleEnable}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.enableButton}
            >
              <Ionicons name="notifications" size={18} color="#000" />
              <Text style={styles.enableText}>Enable Notifications</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton}>
            <Text style={styles.skipText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.progressWrapper}>
        <OnboardingProgress total={12} current={9} />
      </View>
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
  },
  card: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  // Notification preview
  notificationPreview: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252525',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  notifApp: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    flex: 1,
  },
  notifTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notifBody: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },

  buttonsContainer: {
    gap: 12,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
  },
  enableText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    color: '#6B7280',
  },

  progressWrapper: {
    alignItems: 'center',
    paddingBottom: 20,
  },
});
