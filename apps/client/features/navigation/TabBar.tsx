import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useReduceMotion } from '../design';
import { useTheme } from '../theme';
import { activeTabFor, tabPressAction, TABS, type NavRole, type TabDef } from './tabs';

/** Height of the pill itself, without the gap to the screen edge. */
export const TAB_BAR_HEIGHT = 64;
const PAD = 6;
const MAX_WIDTH = 480;
/** Below this window width the labels drop to 10pt so "Requirements" fits. */
const COMPACT_WIDTH = 420;

interface TabBarProps {
  role: NavRole;
  /** Distance from the bottom of the window to the bottom of the pill. */
  bottom: number;
}

export function TabBar({ role, bottom }: TabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  const tabs = TABS[role];
  const activeKey = activeTabFor(role, pathname);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeKey),
  );

  const [tabWidth, setTabWidth] = useState(0);
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const placed = useRef<{ index: number; width: number } | null>(null);

  useEffect(() => {
    if (tabWidth === 0) return;
    const toLeft = activeIndex * tabWidth;
    const toRight = toLeft + tabWidth;
    const from = placed.current;
    placed.current = { index: activeIndex, width: tabWidth };
    if (!from || from.width !== tabWidth || reduceMotion) {
      left.setValue(toLeft);
      right.setValue(toRight);
      return;
    }
    if (from.index === activeIndex) return;
    // The edge facing the new tab leads and the far edge trails, so the
    // droplet stretches toward the target, then settles with a small overshoot.
    const movingRight = activeIndex > from.index;
    const lead = { stiffness: 480, damping: 26, mass: 1, useNativeDriver: false };
    const trail = { stiffness: 280, damping: 24, mass: 1, useNativeDriver: false };
    const animation = Animated.parallel([
      Animated.spring(left, { toValue: toLeft, ...(movingRight ? trail : lead) }),
      Animated.spring(right, { toValue: toRight, ...(movingRight ? lead : trail) }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeIndex, tabWidth, reduceMotion, left, right]);

  const glass = theme.glass;

  const onPress = (tab: TabDef) => {
    if (tabPressAction(pathname, tab) === 'none') return;
    // Pop back to the role stack's first screen, then swap it for the tab,
    // so the stack only ever holds the current tab and what was opened from it.
    if (router.canDismiss()) router.dismissAll();
    router.replace(tab.href as Href);
  };

  return (
    <View style={[styles.dock, { bottom, paddingHorizontal: theme.spacing.sm }]}>
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { borderColor: glass.border, maxWidth: MAX_WIDTH }]}
      >
        <BlurView
          intensity={40}
          tint={theme.dark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: glass.tint, opacity: glass.tintOpacity },
          ]}
        />
        <View
          style={styles.row}
          onLayout={(event) => setTabWidth(event.nativeEvent.layout.width / tabs.length)}
        >
          {tabWidth > 0 && (
            <Animated.View
              style={[
                styles.bubble,
                {
                  left,
                  width: Animated.subtract(right, left),
                  backgroundColor: glass.bubble,
                  opacity: glass.bubbleOpacity,
                },
              ]}
            />
          )}
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            const color = active ? glass.active : glass.inactive;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                aria-selected={active}
                accessibilityLabel={tab.label}
                onPress={() => onPress(tab)}
                style={[styles.tab, { minHeight: theme.size.touch }]}
              >
                <Ionicons
                  name={active ? tab.icon : `${tab.icon}-outline`}
                  size={22}
                  color={color}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    color,
                    fontSize: compact ? 10 : theme.fontSize.xs,
                    letterSpacing: compact ? -0.2 : 0,
                    fontWeight: active ? theme.fontWeight.semibold : theme.fontWeight.medium,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  pill: {
    width: '100%',
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    padding: PAD,
  },
  row: { flex: 1, flexDirection: 'row' },
  bubble: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: (TAB_BAR_HEIGHT - PAD * 2) / 2,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
