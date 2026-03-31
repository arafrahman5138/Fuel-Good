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
import { LinearGradient } from 'expo-linear-gradient';
import { OnboardingProgress } from '../../components/onboarding-v2/OnboardingProgress';
import { useOnboardingAnalytics } from '../../hooks/onboarding-v2/useOnboardingAnalytics';
import { useOnboardingState } from '../../hooks/onboarding-v2/useOnboardingState';

type Objection = 'expensive' | 'unsure' | 'browsing' | null;

const OBJECTION_RESPONSES: Record<Exclude<Objection, null>, string> = {
  expensive:
    'We have a plan for every budget. And it pays for itself in groceries saved.',
  unsure:
    '12,400+ people saw results in week one. Give it 7 days free.',
  browsing:
    'No pressure. But your scanner result proves the app works. Why not try it free?',
};

export default function CommitmentScreen() {
  const router = useRouter();
  const analytics = useOnboardingAnalytics();
  const { setCommitted } = useOnboardingState();

  const [showRecovery, setShowRecovery] = useState(false);
  const [selectedObjection, setSelectedObjection] = useState<Objection>(null);
  const [responseText, setResponseText] = useState('');

  const headlineFade = useRef(new Animated.Value(0)).current;
  const headlineSlide = useRef(new Animated.Value(20)).current;
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const recoveryFade = useRef(new Animated.Value(0)).current;
  const responseFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    analytics.trackScreenView(11, 'commitment');

    Animated.sequence([
      Animated.parallel([
        Animated.timing(headlineFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(buttonsFade, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();

    return () => analytics.trackScreenExit(11);
  }, []);

  const handleCommit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCommitted(true);
    analytics.trackEvent('onboarding_committed', { committed: true });
    router.push('/onboarding-v2/generating-plan');
  };

  const handleNotYet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.trackEvent('onboarding_committed', { committed: false });
    setShowRecovery(true);

    Animated.timing(recoveryFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const handleObjection = (objection: Exclude<Objection, null>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedObjection(objection);
    setResponseText(OBJECTION_RESPONSES[objection]);

    responseFade.setValue(0);
    Animated.timing(responseFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    analytics.trackEvent('onboarding_objection', { objection });
  };

  const handleSeeOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding-v2/generating-plan');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {!showRecovery ? (
          <>
            <Animated.View
              style={{ opacity: headlineFade, transform: [{ translateY: headlineSlide }] }}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="flame-outline" size={40} color="#22C55E" />
              </View>
              <Text style={styles.headline}>
                Are you ready to start{'\n'}earning your cheat meals?
              </Text>
            </Animated.View>

            <Animated.View style={[styles.buttonsContainer, { opacity: buttonsFade }]}>
              <TouchableOpacity activeOpacity={0.85} onPress={handleCommit}>
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.commitButton}
                >
                  <Text style={styles.commitText}>Yes, let's go</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNotYet} activeOpacity={0.7} style={styles.notYetButton}>
                <Text style={styles.notYetText}>Not yet</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        ) : (
          <Animated.View style={[styles.recoveryContainer, { opacity: recoveryFade }]}>
            <Text style={styles.recoveryHeadline}>What's holding you back?</Text>

            <View style={styles.objectionsContainer}>
              <TouchableOpacity
                style={[
                  styles.objectionCard,
                  selectedObjection === 'expensive' && styles.objectionCardSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => handleObjection('expensive')}
                disabled={selectedObjection !== null}
              >
                <Ionicons name="wallet-outline" size={20} color={selectedObjection === 'expensive' ? '#22C55E' : '#9CA3AF'} />
                <Text style={styles.objectionText}>Too expensive</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.objectionCard,
                  selectedObjection === 'unsure' && styles.objectionCardSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => handleObjection('unsure')}
                disabled={selectedObjection !== null}
              >
                <Ionicons name="help-circle-outline" size={20} color={selectedObjection === 'unsure' ? '#22C55E' : '#9CA3AF'} />
                <Text style={styles.objectionText}>Not sure it works</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.objectionCard,
                  selectedObjection === 'browsing' && styles.objectionCardSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => handleObjection('browsing')}
                disabled={selectedObjection !== null}
              >
                <Ionicons name="eye-outline" size={20} color={selectedObjection === 'browsing' ? '#22C55E' : '#9CA3AF'} />
                <Text style={styles.objectionText}>Just browsing</Text>
              </TouchableOpacity>
            </View>

            {responseText !== '' && (
              <Animated.View style={[styles.responseCard, { opacity: responseFade }]}>
                <Ionicons name="sparkles" size={18} color="#22C55E" style={{ marginBottom: 8 }} />
                <Text style={styles.responseText}>{responseText}</Text>
              </Animated.View>
            )}

            {selectedObjection !== null && (
              <Animated.View style={{ opacity: responseFade, marginTop: 20, width: '100%' }}>
                <TouchableOpacity activeOpacity={0.85} onPress={handleSeeOptions}>
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.seeOptionsButton}
                  >
                    <Text style={styles.seeOptionsText}>See my options</Text>
                    <Ionicons name="arrow-forward" size={18} color="#000" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>

      <View style={styles.progressWrapper}>
        <OnboardingProgress total={12} current={10} />
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
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 40,
  },
  buttonsContainer: {
    gap: 16,
  },
  commitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 20,
    gap: 8,
  },
  commitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  notYetButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  notYetText: {
    fontSize: 15,
    color: '#6B7280',
  },

  // Recovery
  recoveryContainer: {
    alignItems: 'center',
  },
  recoveryHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 28,
  },
  objectionsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  objectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 18,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 16,
    gap: 12,
  },
  objectionCardSelected: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  objectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  responseCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  responseText: {
    fontSize: 15,
    color: '#E5E7EB',
    lineHeight: 22,
  },

  seeOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
  },
  seeOptionsText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },

  progressWrapper: {
    alignItems: 'center',
    paddingBottom: 20,
  },
});
