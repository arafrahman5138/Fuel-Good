import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  count: number;
  animated?: boolean;
}

export function FlexTicketRow({ count, animated = true }: Props) {
  const ticketAnims = useRef(
    Array.from({ length: count }).map(() => ({
      scale: new Animated.Value(animated ? 0.8 : 1),
      opacity: new Animated.Value(animated ? 0.3 : 1),
    }))
  ).current;

  useEffect(() => {
    if (!animated) return;

    const animations = ticketAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(1200 + i * 400),
        Animated.parallel([
          Animated.spring(anim.scale, { toValue: 1, friction: 5, useNativeDriver: true }),
          Animated.timing(anim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );

    Animated.parallel(animations).start();
  }, [animated]);

  return (
    <View style={styles.container}>
      {ticketAnims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ticket,
            {
              opacity: anim.opacity,
              transform: [{ scale: anim.scale }],
            },
          ]}
        >
          <Text style={styles.ticketEmoji}>🎟️</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  ticket: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketEmoji: {
    fontSize: 24,
  },
});
