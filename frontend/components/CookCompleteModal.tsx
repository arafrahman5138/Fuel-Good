import React, { useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { useScaleReveal } from '../hooks/useAnimations';
import { Shadows } from '../constants/Shadows';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { Button } from './Button';

interface CookCompleteModalProps {
  visible: boolean;
  recipeTitle: string;
  stepCount: number;
  prepMin?: number;
  cookMin?: number;
  onLogAndFinish: () => void;
  onExitWithoutLogging: () => void;
}

export function CookCompleteModal({
  visible,
  recipeTitle,
  stepCount,
  prepMin,
  cookMin,
  onLogAndFinish,
  onExitWithoutLogging,
}: CookCompleteModalProps) {
  const theme = useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');

  // Slide-up card animation
  const slideAnim = useRef(new Animated.Value(320)).current;

  // Checkmark scale reveal
  const { animatedStyle: checkStyle } = useScaleReveal(visible, 0.4, { speed: 12, bounciness: 14 });

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(320);
    }
  }, [visible, slideAnim]);

  const totalMin = (prepMin ?? 0) + (cookMin ?? 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onExitWithoutLogging}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onExitWithoutLogging} />
        <Animated.View
          style={[
            styles.card,
            Shadows.overlay(isDark),
            { backgroundColor: theme.surface, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Hero gradient banner */}
          <LinearGradient colors={theme.gradient.primary} style={styles.hero}>
            <Animated.View style={[styles.checkCircle, checkStyle]}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </Animated.View>
            <Text style={styles.heroTitle}>You cooked it!</Text>
            <Text style={styles.heroSubtitle} numberOfLines={2}>{recipeTitle}</Text>
          </LinearGradient>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="list-outline" size={14} color={theme.primary} />
              <Text style={[styles.statText, { color: theme.text }]}>
                {stepCount} steps
              </Text>
            </View>
            {totalMin > 0 && (
              <View style={[styles.statPill, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="time-outline" size={14} color={theme.primary} />
                <Text style={[styles.statText, { color: theme.text }]}>
                  {totalMin} min
                </Text>
              </View>
            )}
          </View>

          {/* XP earned note */}
          <View style={[styles.xpRow, { backgroundColor: theme.primaryMuted }]}>
            <Ionicons name="flash" size={14} color={theme.primary} />
            <Text style={[styles.xpText, { color: theme.primary }]}>+50 XP earned</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Button
              title="Log & Finish"
              variant="primary"
              fullWidth
              onPress={onLogAndFinish}
            />
            <Button
              title="Exit Without Logging"
              variant="ghost"
              fullWidth
              onPress={onExitWithoutLogging}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    overflow: 'hidden',
    paddingBottom: Spacing.huge,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    color: '#fff',
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  statText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  xpText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.xs,
  },
});
