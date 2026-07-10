/**
 * PremiumUpsellCard — contextual in-place upgrade prompt for premium
 * surfaces (Metabolic Score, Coach, meal plans). Replaces the old
 * whole-app paywall redirect: free users see what the feature does and
 * one tap to the upgrade screen, never a dead end.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { analytics } from '../services/analytics';

interface PremiumUpsellCardProps {
  /** Which premium surface this card is standing in for (analytics key) */
  feature: string;
  title: string;
  body: string;
  icon?: keyof typeof Ionicons.glyphMap;
  cta?: string;
}

function PremiumUpsellCardImpl({ feature, title, body, icon = 'pulse', cta = 'Start your free trial' }: PremiumUpsellCardProps) {
  const theme = useTheme();
  return (
    <View
      testID={`premium-upsell-${feature}`}
      style={[styles.card, { backgroundColor: theme.card.background, borderColor: theme.primary + '30' }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.primary + '14' }]}>
        <Ionicons name={icon} size={22} color={theme.primary} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.cta, { backgroundColor: theme.primary }]}
        onPress={() => {
          analytics.trackEvent('premium_upsell_tapped', { feature });
          router.push('/subscribe' as any);
        }}
        accessibilityRole="button"
        accessibilityLabel={cta}
      >
        <Text style={styles.ctaText}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
  cta: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});

export const PremiumUpsellCard = React.memo(PremiumUpsellCardImpl);
