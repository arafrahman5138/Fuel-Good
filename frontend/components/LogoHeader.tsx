import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { APP_NAME } from '../constants/Config';

const iconDark = require('../assets/images/logo-header-dark.png');
const iconLight = require('../assets/images/logo-header-light.png');

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
    gap: 5,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  text: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
