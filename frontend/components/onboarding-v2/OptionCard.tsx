import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function OptionCard({ label, selected, onPress, icon }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selected) {
      // Scale pulse on selection
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 150,
          useNativeDriver: true,
        }),
      ]).start();

      // Check mark bounces in
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();

      // Glow border flash
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      checkScale.setValue(0);
      glowOpacity.setValue(0);
    }
  }, [selected]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
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
          <Animated.View style={[styles.check, { transform: [{ scale: checkScale }] }]}>
            <Ionicons name="checkmark" size={16} color="#22C55E" />
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
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
