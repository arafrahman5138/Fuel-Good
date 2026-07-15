/**
 * TextLink — minimal inline text link.
 *
 * Prefer Button/SettingsRow. For genuine inline links only — "Learn more"
 * inside a sentence, legal links, a trailing "See all". If it needs padding,
 * an icon tile, or a background, it isn't a TextLink.
 */
import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { FontSize } from '../../constants/Colors';
import { useTheme } from '../../hooks/useTheme';

export interface TextLinkProps {
  children: React.ReactNode;
  onPress: () => void;
  /** Off by default — the house link style is color-only. */
  underline?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function TextLink({
  children,
  onPress,
  underline = false,
  style,
  testID,
}: TextLinkProps) {
  const theme = useTheme();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="link"
      testID={testID}
      suppressHighlighting
      style={[
        styles.link,
        { color: theme.primary },
        underline && styles.underline,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  underline: {
    textDecorationLine: 'underline',
  },
});
