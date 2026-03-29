import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';
import type { Achievement } from './AchievementTile';

interface Props {
  achievement: Achievement | null;
  onClose: () => void;
}

export function AchievementDetailSheet({ achievement, onClose }: Props) {
  const theme = useTheme();

  if (!achievement) return null;

  const unlocked = achievement.unlocked;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Icon */}
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: unlocked ? theme.primary + '15' : theme.surfaceHighlight,
              },
              unlocked && {
                boxShadow: `0px 0px 20px ${theme.primary}30`,
              },
            ]}
          >
            <Ionicons
              name={achievement.icon as any}
              size={36}
              color={unlocked ? theme.primary : theme.textTertiary}
            />
          </View>

          {/* Status pill */}
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: unlocked ? theme.primaryMuted : theme.surfaceHighlight,
              },
            ]}
          >
            <Ionicons
              name={unlocked ? 'checkmark-circle' : 'lock-closed'}
              size={14}
              color={unlocked ? theme.primary : theme.textTertiary}
            />
            <Text
              style={[
                styles.statusText,
                { color: unlocked ? theme.primary : theme.textTertiary },
              ]}
            >
              {unlocked ? 'Unlocked' : 'Locked'}
            </Text>
          </View>

          {/* Name */}
          <Text style={[styles.name, { color: theme.text }]}>
            {achievement.name}
          </Text>

          {/* Description */}
          <Text style={[styles.desc, { color: theme.textSecondary }]}>
            {achievement.description}
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: theme.accentMuted }]}>
              <Ionicons name="star" size={12} color={theme.accent} />
              <Text style={[styles.metaText, { color: theme.accent }]}>
                +{achievement.xp_reward} XP
              </Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: theme.surfaceHighlight }]}>
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {achievement.category.charAt(0).toUpperCase() + achievement.category.slice(1)}
              </Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl + Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 9999,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  desc: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 9999,
  },
  metaText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
