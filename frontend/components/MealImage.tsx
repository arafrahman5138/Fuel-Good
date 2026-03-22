/**
 * MealImage — Displays a food image with a gradient placeholder fallback.
 *
 * Shows a beautiful gradient placeholder with a fork/knife icon when no
 * image_url is available. Handles loading states smoothly.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveImageUrl } from '../utils/imageUrl';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius } from '../constants/Colors';

// Rotating gradient pairs for visual variety based on title hash
const GRADIENTS: [string, string][] = [
  ['#FDE68A', '#F59E0B'],  // warm gold
  ['#BBF7D0', '#22C55E'],  // fresh green
  ['#BFDBFE', '#3B82F6'],  // cool blue
  ['#DDD6FE', '#8B5CF6'],  // soft purple
  ['#FECDD3', '#F43F5E'],  // warm rose
  ['#FED7AA', '#EA580C'],  // vibrant orange
];

function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface MealImageProps {
  imageUrl?: string | null;
  title?: string;
  width: number;
  height: number;
  borderRadius?: number;
}

export function MealImage({
  imageUrl,
  title = '',
  width,
  height,
  borderRadius = BorderRadius.md,
}: MealImageProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const resolvedUrl = resolveImageUrl(imageUrl);
  const showImage = resolvedUrl && !failed;

  const gradientIndex = hashTitle(title) % GRADIENTS.length;
  const gradientColors = GRADIENTS[gradientIndex];

  if (showImage) {
    return (
      <View style={[styles.container, { width, height, borderRadius }]}>
        {/* Gradient placeholder visible while image loads */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { width, height, borderRadius, position: 'absolute' }]}
        >
          <Ionicons
            name="restaurant-outline"
            size={Math.min(width, height) * 0.28}
            color="rgba(255,255,255,0.3)"
          />
        </LinearGradient>
        <Image
          source={{ uri: resolvedUrl }}
          style={[styles.image, { width, height, borderRadius }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { width, height, borderRadius }]}
      >
        <Ionicons
          name="restaurant-outline"
          size={Math.min(width, height) * 0.28}
          color="rgba(255,255,255,0.5)"
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {},
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
