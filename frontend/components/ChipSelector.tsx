import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import { useTheme } from '../hooks/useTheme';
import { usePressScale } from '../hooks/useAnimations';

function ChipButton({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style: any }) {
  const press = usePressScale(0.95);
  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

interface ChipOption {
  id: string;
  label: string;
  icon?: string;
}

interface ChipSelectorProps {
  options: ChipOption[];
  selected: string[];
  onToggle: (id: string) => void;
  multiSelect?: boolean;
  label?: string;
  scrollable?: boolean;
}

export function ChipSelector({
  options,
  selected,
  onToggle,
  multiSelect = true,
  label,
  scrollable = false,
}: ChipSelectorProps) {
  const theme = useTheme();

  const chips = options.map((option) => {
    const isSelected = selected.includes(option.id);
    return (
      <ChipButton
        key={option.id}
        onPress={() => onToggle(option.id)}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? theme.primaryMuted : theme.surfaceElevated,
            borderColor: isSelected ? theme.primary : theme.border,
          },
          ...(isSelected ? [{
            boxShadow: `0px 0px 8px ${theme.primary}33`,
            elevation: 2,
          }] : []),
        ]}
      >
        {option.icon && (
          <Ionicons
            name={option.icon as any}
            size={14}
            color={isSelected ? theme.primary : theme.textSecondary}
            style={{ marginRight: 4 }}
          />
        )}
        <Text
          style={[
            styles.chipText,
            { color: isSelected ? theme.primary : theme.textSecondary },
          ]}
        >
          {option.label}
        </Text>
      </ChipButton>
    );
  });

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      )}
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>{chips}</View>
        </ScrollView>
      ) : (
        <View style={styles.chipWrap}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
