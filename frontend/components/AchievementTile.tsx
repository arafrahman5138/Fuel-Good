import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  xp_reward: number;
  category: string;
}

interface Props {
  achievement: Achievement;
  onPress: (achievement: Achievement) => void;
}

export function AchievementTile({ achievement, onPress }: Props) {
  const theme = useTheme();
  const unlocked = achievement.unlocked;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(achievement)}
      style={[
        styles.tile,
        {
          backgroundColor: theme.surface,
          borderColor: unlocked ? theme.primary + '30' : theme.border,
          opacity: unlocked ? 1 : 0.55,
        },
        unlocked && {
          boxShadow: `0px 0px 10px ${theme.primary}18`,
          elevation: 2,
        },
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: unlocked ? theme.primary + '15' : theme.surfaceHighlight,
          },
        ]}
      >
        <Ionicons
          name={achievement.icon as any}
          size={24}
          color={unlocked ? theme.primary : theme.textTertiary}
        />
        {unlocked && (
          <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={8} color="#fff" />
          </View>
        )}
      </View>

      {/* Name */}
      <Text
        style={[styles.name, { color: theme.text }]}
        numberOfLines={2}
      >
        {achievement.name}
      </Text>

      {/* XP pill */}
      <View style={[styles.xpPill, { backgroundColor: theme.accentMuted }]}>
        <Text style={[styles.xpText, { color: theme.accent }]}>
          +{achievement.xp_reward}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  xpPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  xpText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
