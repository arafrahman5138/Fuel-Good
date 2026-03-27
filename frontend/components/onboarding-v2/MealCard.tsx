import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUrl } from '../../utils/imageUrl';

interface Props {
  title: string;
  subtitle: string;
  fuelScore: number;
  imageUrl?: string | null;
  delay?: number;
}

export function MealCard({ title, subtitle, fuelScore, imageUrl, delay = 0 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, [delay]);

  const resolved = resolveImageUrl(imageUrl);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {resolved ? (
        <Image source={{ uri: resolved }} style={styles.image} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#1A2A1A', '#0F1A0F']} style={styles.image}>
          <Ionicons name="restaurant" size={28} color="rgba(34,197,94,0.3)" />
        </LinearGradient>
      )}
      <View style={styles.content}>
        <View style={styles.badge}>
          <Ionicons name="leaf" size={12} color="#22C55E" />
          <Text style={styles.badgeText}>Fuel {fuelScore}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    overflow: 'hidden',
    marginBottom: 14,
  },
  image: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
});
