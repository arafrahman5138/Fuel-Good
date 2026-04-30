/**
 * TriStateProteinSelector — one chip row whose chips cycle through three
 * states instead of two separate like/avoid lists. Pass: on each tap a chip
 * moves neutral → liked → avoided → neutral.
 *
 * Keeps the wire format compatible with the backend: emits `liked` and
 * `avoided` string[]s so the upstream `saveChanges` path doesn't change.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';

export type ProteinState = 'neutral' | 'liked' | 'avoided';

export interface ProteinOption {
  id: string;
  label: string;
  icon?: string; // unicode icon prefix e.g. 🐔
}

interface Props {
  options: ProteinOption[];
  liked: string[];
  avoided: string[];
  onChange: (liked: string[], avoided: string[]) => void;
  label?: string;
  sublabel?: string;
}

function getState(id: string, liked: string[], avoided: string[]): ProteinState {
  if (liked.includes(id)) return 'liked';
  if (avoided.includes(id)) return 'avoided';
  return 'neutral';
}

function cycle(state: ProteinState): ProteinState {
  if (state === 'neutral') return 'liked';
  if (state === 'liked') return 'avoided';
  return 'neutral';
}

export function TriStateProteinSelector({
  options,
  liked,
  avoided,
  onChange,
  label = 'Protein preferences',
  sublabel = 'Tap once to like, again to avoid, a third time to reset.',
}: Props) {
  const theme = useTheme();

  const onTap = (id: string) => {
    const current = getState(id, liked, avoided);
    const next = cycle(current);
    const likedNext = liked.filter((x) => x !== id);
    const avoidedNext = avoided.filter((x) => x !== id);
    if (next === 'liked') likedNext.push(id);
    if (next === 'avoided') avoidedNext.push(id);
    onChange(likedNext, avoidedNext);
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.sublabel, { color: theme.textTertiary }]}>{sublabel}</Text>
      ) : null}

      {/* Legend */}
      <View style={styles.legendRow}>
        <LegendDot color={theme.primary} label="Liked" />
        <LegendDot color={theme.error} label="Avoided" />
      </View>

      <View style={styles.chipRow}>
        {options.map((opt) => {
          const state = getState(opt.id, liked, avoided);
          const isLiked = state === 'liked';
          const isAvoided = state === 'avoided';
          const bg = isLiked
            ? theme.primary + '22'
            : isAvoided
            ? theme.error + '22'
            : theme.surfaceElevated;
          const border = isLiked
            ? theme.primary
            : isAvoided
            ? theme.error
            : theme.border;
          const text = isLiked
            ? theme.primary
            : isAvoided
            ? theme.error
            : theme.text;
          const iconName: React.ComponentProps<typeof Ionicons>['name'] = isLiked
            ? 'heart'
            : isAvoided
            ? 'close-circle'
            : 'ellipse-outline';

          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.75}
              onPress={() => onTap(opt.id)}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label}, ${state}`}
              style={[
                styles.chip,
                {
                  backgroundColor: bg,
                  borderColor: border,
                },
              ]}
            >
              <Ionicons name={iconName} size={12} color={text} />
              <Text style={[styles.chipText, { color: text }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendPill}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  sublabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
