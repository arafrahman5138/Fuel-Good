import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  text: string;
  callout: string;
}

export function MirrorCard({ text, callout }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.borderAccent} />
      <View style={styles.content}>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.callout}>{callout}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    overflow: 'hidden',
  },
  borderAccent: {
    width: 4,
    backgroundColor: '#22C55E',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  text: {
    fontSize: 18,
    color: '#E5E7EB',
    lineHeight: 28,
    marginBottom: 16,
  },
  callout: {
    fontSize: 17,
    fontWeight: '700',
    color: '#22C55E',
    lineHeight: 24,
  },
});
