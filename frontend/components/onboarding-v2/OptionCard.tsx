import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function OptionCard({ label, selected, onPress, icon }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={22}
          color={selected ? '#22C55E' : '#9CA3AF'}
          style={{ marginRight: 12 }}
        />
      )}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {selected && (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={16} color="#22C55E" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 18,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 16,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: '#22C55E40',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  labelSelected: {
    color: '#fff',
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
