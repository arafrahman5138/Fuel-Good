import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  useColorScheme,
  Modal,
  Pressable,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../stores/themeStore';
import { usePressScale } from '../hooks/useAnimations';
import { Shadows } from '../constants/Shadows';
import { BorderRadius, FontSize, Spacing } from '../constants/Colors';
import * as Haptics from 'expo-haptics';

/** Route names to exclude from the visible pill. */
const HIDDEN_ROUTES = new Set(['profile']);
const FLOATING_BAR_HEIGHT = 64;
const PLUS_BUTTON_SIZE = 62;
const CHARCOAL = '#26282B';
const BUBBLE_SLOT_INSET = 5;

/**
 * Glassmorphic floating tab bar inspired by Oura Ring.
 * Adapts to light/dark mode automatically.
 * Includes a separate circular "+" button for quick meal logging.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [tabRowWidth, setTabRowWidth] = useState(0);
  const themeMode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const plusPress = usePressScale(0.92);

  // + → X rotation animation
  const plusRotation = useRef(new Animated.Value(0)).current;
  const plusScale = useRef(new Animated.Value(1)).current;

  // Per-tab icon scale animations (max 10 tabs)
  const tabScales = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(1))
  ).current;
  const prevActiveIndex = useRef(-1);

  // Reduce motion check
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Filter out hidden routes (profile, etc.)
  const visibleRoutes = state.routes.filter((r) => {
    if (HIDDEN_ROUTES.has(r.name)) return false;
    const opts = descriptors[r.key]?.options;
    return (opts as any).href !== null;
  });

  // Theme-adaptive colours
  const blurTint = isDark ? 'dark' : 'light';
  const tintBg = isDark ? 'rgba(10, 10, 15, 0.42)' : 'rgba(248, 248, 248, 0.68)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.82)' : CHARCOAL;
  const pillShadow = Shadows.lg(isDark);
  const plusShadow = Shadows.md(isDark);
  const menuShadow = Shadows.overlay(isDark);
  const plusBg = isDark ? 'rgba(10,10,15,0.36)' : 'rgba(248, 248, 248, 0.68)';
  const plusBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const plusIconColor = showAddMenu ? theme.primary : inactiveColor;
  const menuBg = isDark ? 'rgba(20,20,26,0.94)' : 'rgba(255,255,255,0.96)';
  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => state.index === state.routes.indexOf(route))
  );
  const bubbleLeft = useRef(new Animated.Value(0)).current;

  const tabCount = Math.max(visibleRoutes.length, 1);
  const slotWidth = tabRowWidth > 0 ? tabRowWidth / tabCount : 0;
  const bubbleWidth = Math.max(0, slotWidth - BUBBLE_SLOT_INSET * 2);
  const compactTabs = slotWidth > 0 && slotWidth < 86;

  // Bubble slide + icon pop animation
  useEffect(() => {
    if (slotWidth <= 0) return;
    const toValue = activeVisibleIndex * slotWidth + BUBBLE_SLOT_INSET;

    if (reduceMotion) {
      bubbleLeft.setValue(toValue);
      return;
    }

    // Slide the bubble
    Animated.spring(bubbleLeft, {
      toValue,
      useNativeDriver: false,
      speed: 20,
      bounciness: 6,
    }).start();

    // Pop the active tab icon
    if (prevActiveIndex.current !== activeVisibleIndex) {
      // Reset previous tab
      if (prevActiveIndex.current >= 0 && prevActiveIndex.current < tabScales.length) {
        Animated.spring(tabScales[prevActiveIndex.current], {
          toValue: 1,
          useNativeDriver: true,
          speed: 28,
          bounciness: 4,
        }).start();
      }

      // Pop new active tab
      if (activeVisibleIndex < tabScales.length) {
        tabScales[activeVisibleIndex].setValue(0.85);
        Animated.spring(tabScales[activeVisibleIndex], {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 12,
        }).start();
      }

      prevActiveIndex.current = activeVisibleIndex;
    }
  }, [activeVisibleIndex, slotWidth, bubbleLeft, reduceMotion]);

  // + button toggle animation (rotate + scale bounce)
  const handlePlusPress = () => {
    const opening = !showAddMenu;
    setShowAddMenu(opening);

    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Rotate + to X (45deg)
      Animated.spring(plusRotation, {
        toValue: opening ? 1 : 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }).start();

      // Bounce scale
      plusScale.setValue(0.8);
      Animated.spring(plusScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 14,
      }).start();
    }
  };

  // Close menu helper (also animates back)
  const closeMenu = () => {
    setShowAddMenu(false);
    if (!reduceMotion) {
      Animated.spring(plusRotation, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }).start();
    }
  };

  const plusRotateDeg = plusRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom - 6, 0) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        {/* ── Main pill ── */}
        <View style={[styles.pillWrapper, pillShadow, { flex: 1 }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? (isDark ? 80 : 50) : 100}
            tint={blurTint}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.tintOverlay,
              { backgroundColor: tintBg, borderColor: borderCol },
            ]}
          />

          <View style={styles.tabRow} onLayout={(e) => setTabRowWidth(e.nativeEvent.layout.width)}>
            {slotWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.activeBubble,
                  {
                    width: bubbleWidth,
                    left: bubbleLeft,
                    backgroundColor: isDark ? theme.primary + '1C' : theme.primary + '16',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  },
                ]}
              />
            )}
            {visibleRoutes.map((route, visIdx) => {
              const realIndex = state.routes.indexOf(route);
              const { options } = descriptors[route.key];
              const isFocused = state.index === realIndex;

              const label = (options.title ?? route.name) as string;
              const displayLabel =
                compactTabs && label === 'Healthify'
                  ? 'Health'
                  : label;
              const iconColor = isFocused ? theme.primary : inactiveColor;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  if (!reduceMotion) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  activeOpacity={0.7}
                  style={[
                    styles.tabItem,
                    isFocused && styles.focusedTabItem,
                  ]}
                >
                  <Animated.View
                    style={{
                      alignItems: 'center',
                      transform: [{ scale: tabScales[visIdx] }],
                    }}
                  >
                    {options.tabBarIcon?.({
                      focused: isFocused,
                      color: iconColor,
                      size: compactTabs ? 22 : 24,
                    })}
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          color: iconColor,
                          fontWeight: '400',
                          fontSize: compactTabs ? 10 : FontSize.xs,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {displayLabel}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── "+" Log Meal button ── */}
        <Animated.View style={[plusPress.animatedStyle, { transform: [{ scale: plusScale }] }]}>
          <TouchableOpacity
            style={[
              styles.plusButton,
              plusShadow,
              {
                backgroundColor: plusBg,
                borderColor: plusBorder,
              },
            ]}
            activeOpacity={0.7}
            onPress={handlePlusPress}
            onPressIn={plusPress.onPressIn}
            onPressOut={plusPress.onPressOut}
            accessibilityLabel="Open quick actions"
          >
            <Animated.View style={{ transform: [{ rotate: plusRotateDeg }] }}>
              <Ionicons name="add" size={28} color={plusIconColor} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Modal transparent visible={showAddMenu} animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View
            style={[
              styles.addMenu,
              menuShadow,
              {
                bottom: Math.max(insets.bottom, 6) + PLUS_BUTTON_SIZE + 6,
                right: Spacing.lg,
                backgroundColor: menuBg,
                borderColor: borderCol,
              },
            ]}
          >
            {[
              {
                icon: 'restaurant-outline' as const,
                label: 'Log Meal',
                sub: 'Add from meals',
                onPress: () => {
                  closeMenu();
                  router.push('/(tabs)/meals?tab=browse' as any);
                },
              },
              {
                icon: 'scan-outline' as const,
                label: 'Scan',
                sub: 'Meal or product',
                onPress: () => {
                  closeMenu();
                  router.push('/scan' as any);
                },
              },
              {
                icon: 'calendar-outline' as const,
                label: 'Create New Plan',
                sub: 'Open planner',
                onPress: () => {
                  closeMenu();
                  router.push('/(tabs)/meals?tab=plan' as any);
                },
              },
              {
                icon: 'sparkles-outline' as const,
                label: 'New Chat with AI',
                sub: 'Open Healthify',
                onPress: () => {
                  closeMenu();
                  router.push('/(tabs)/chat' as any);
                },
              },
            ].map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={[
                  styles.addMenuItem,
                  idx < 3 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: borderCol,
                  },
                ]}
              >
                <View style={[styles.addMenuIcon, { backgroundColor: theme.primaryMuted }]}>
                  <Ionicons name={item.icon} size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addMenuLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.addMenuSub, { color: theme.textTertiary }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  pillWrapper: {
    height: FLOATING_BAR_HEIGHT,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    position: 'relative',
  },
  activeBubble: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    position: 'relative',
    zIndex: 1,
  },
  focusedTabItem: {
    borderRadius: BorderRadius.lg,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
    letterSpacing: 0.3,
  },
  plusButton: {
    width: PLUS_BUTTON_SIZE,
    height: PLUS_BUTTON_SIZE,
    borderRadius: PLUS_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  addMenu: {
    position: 'absolute',
    width: Math.min(260, Dimensions.get('window').width - 60),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  addMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMenuLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  addMenuSub: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
});
