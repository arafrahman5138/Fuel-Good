/**
 * FlexSummaryCard — Compact room-for-life card for the home screen.
 * Shows earned tickets as a supporting detail, not the main Fuel Score story.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

const GOLD = '#F59E0B';
const GOLD_GLOW = '#FBBF24';
const GREEN = '#22C55E';
const MUTED = '#94A3B8';

interface FlexSummaryCardProps {
  flexAvailable: number;
  flexBudget: number;
  flexUsed: number;
}

function FlexSummaryCardImpl({
  flexAvailable,
  flexBudget,
  flexUsed,
}: FlexSummaryCardProps) {
  const theme = useTheme();
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (flexAvailable > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [flexAvailable]);

  const subtitle = flexAvailable > 0
    ? 'Your clean baseline gives you room for life'
    : 'Keep building your clean baseline this week';
  const headline = flexAvailable > 0
    ? `${flexAvailable} life meal${flexAvailable !== 1 ? 's' : ''} can fit`
    : 'Clean baseline in progress';

  return (
    <TouchableOpacity
      testID="home-flex-banner"
      activeOpacity={0.78}
      onPress={() => router.push('/(tabs)/(home)/flex')}
      style={[
        styles.card,
        {
          backgroundColor: theme.card.background,
          borderColor: flexAvailable > 0 ? GOLD + '30' : theme.border,
        },
      ]}
    >
      {/* Left: Ticket icons */}
      <View style={styles.ticketRow}>
        {Array.from({ length: flexBudget }).map((_, idx) => {
          const isAvailable = idx < flexAvailable;
          const isUsed = idx >= flexBudget - flexUsed && idx >= flexAvailable;
          return (
            <Animated.View
              key={idx}
              style={[
                styles.ticket,
                isAvailable
                  ? {
                      backgroundColor: GOLD + '18',
                      borderColor: GOLD + '50',
                      boxShadow: `0px 0px 4px ${GOLD_GLOW}59`,
                    }
                  : isUsed
                    ? { backgroundColor: MUTED + '08', borderColor: MUTED + '25' }
                    : { backgroundColor: theme.surfaceHighlight + '60', borderColor: theme.border },
              ]}
            >
              <Ionicons
                name={isAvailable ? 'ticket' : isUsed ? 'checkmark-circle-outline' : 'ticket-outline'}
                size={12}
                color={isAvailable ? GOLD : isUsed ? MUTED : theme.textTertiary}
              />
            </Animated.View>
          );
        })}
      </View>

      {/* Center: Copy */}
      <View style={styles.copy}>
        <Text style={[styles.headline, { color: theme.text }]}>
          {headline}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      </View>

      {/* Right: Chevron */}
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  ticketRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ticket: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  headline: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export const FlexSummaryCard = React.memo(FlexSummaryCardImpl);

