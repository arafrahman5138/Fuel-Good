/**
 * MealImage — Displays a food image with a gradient placeholder fallback.
 *
 * Shows a quiet, surface-adjacent gradient placeholder with a fork/knife
 * glyph when no image_url is available. Handles loading states smoothly.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveImageUrl } from '../utils/imageUrl';
import { useIsDark } from '../hooks/useTheme';
import { BorderRadius } from '../constants/Colors';

// Rotating gradient pairs for visual variety based on title hash.
// Polish pass: the original palette was saturated brand-color pairs
// (#FDE68A→#F59E0B gold, #FECDD3→#F43F5E rose, …) that read as loud
// unfinished art next to real photos. These are low-chroma, surface-adjacent
// tones — the per-title hash still varies the hue, but the family stays
// quiet so placeholders recede instead of competing with photography.
const GRADIENTS_LIGHT: [string, string][] = [
  ['#ECE9E4', '#DCD5CA'],  // warm stone
  ['#E7ECE6', '#D2DCD1'],  // muted sage
  ['#E6EAEF', '#D2DAE3'],  // mist blue
  ['#EAE8EF', '#D9D5E2'],  // lilac grey
  ['#EFE9E9', '#E2D6D6'],  // blush grey
  ['#E5ECEB', '#D0DDDB'],  // pale teal
];

const GRADIENTS_DARK: [string, string][] = [
  ['#211F1B', '#2B2822'],  // warm stone
  ['#1C221D', '#252D26'],  // muted sage
  ['#1C2026', '#242A33'],  // mist blue
  ['#201F27', '#2A2833'],  // lilac grey
  ['#241F20', '#2E2829'],  // blush grey
  ['#1B2323', '#242E2D'],  // pale teal
];

// Single monochrome glyph at modest opacity. The old outline glyph at
// 30-50% white read as an "✕" against the saturated gradients.
const GLYPH_LIGHT = 'rgba(60,60,67,0.26)';
const GLYPH_DARK = 'rgba(255,255,255,0.22)';

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
  const isDark = useIsDark();
  const [failed, setFailed] = useState(false);
  const resolvedUrl = resolveImageUrl(imageUrl);
  const showImage = resolvedUrl && !failed;

  const gradients = isDark ? GRADIENTS_DARK : GRADIENTS_LIGHT;
  const gradientColors = gradients[hashTitle(title) % gradients.length];
  const glyphColor = isDark ? GLYPH_DARK : GLYPH_LIGHT;

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
            name="restaurant"
            size={Math.min(width, height) * 0.28}
            color={glyphColor}
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
          name="restaurant"
          size={Math.min(width, height) * 0.28}
          color={glyphColor}
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
