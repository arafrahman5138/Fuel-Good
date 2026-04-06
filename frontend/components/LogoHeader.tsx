import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { APP_NAME } from '../constants/Config';

const iconDark = require('../assets/images/icon-white-transparent.png');
const iconLight = require('../assets/images/icon-transparent.png');

export default function LogoHeader() {
  const theme = useTheme();
  const isDark = theme.background === '#0A0A0F';
  return (
    <View style={styles.container}>
      <Image
        source={isDark ? iconDark : iconLight}
        style={styles.iconImage}
        resizeMode="contain"
      />
      <Text style={[styles.text, { color: theme.text }]}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconImage: {
    width: 24,
    height: 24,
  },
  text: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
