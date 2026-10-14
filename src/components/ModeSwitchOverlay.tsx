/**
 * Full-screen "Switching to manager / investor mode" loader (design: profile
 * switch). Covers everything, tab bar included, while lib/appMode switches.
 * Mounted once at the root (src/app/_layout.tsx).
 */
import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useAppMode } from '../lib/appMode';
import { colors, fonts, space } from '../theme/tokens';

const SIZE = 58;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The gold part of the ring; the rest is the pale segment. */
const GOLD_SHARE = 0.78;

function Ring() {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));

  return (
    <Animated.View style={[styles.ring, spin]}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="rgba(255, 255, 255, 0.55)"
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.gold}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE * GOLD_SHARE} ${CIRCUMFERENCE}`}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

export function ModeSwitchOverlay() {
  const { switchingTo } = useAppMode();
  const target = switchingTo === 'manager' ? 'Manager mode' : 'Investor mode';

  return (
    <Modal
      visible={switchingTo !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      // Nothing to back out of mid-switch; it finishes on its own.
      onRequestClose={() => {}}
    >
      <View
        style={styles.root}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Switching to ${target}`}
      >
        <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
        <View style={styles.wash} />
        <Ring />
        <Text style={styles.eyebrow}>SWITCHING TO</Text>
        <Text style={styles.target}>{target.toUpperCase()}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Android shows no blur here (see TabBarBackground), so it gets a heavier
  // wash to keep the screen behind as dim as the design.
  wash: {
    ...StyleSheet.absoluteFill,
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(5, 7, 6, 0.88)' : 'rgba(5, 7, 6, 0.6)',
  },
  ring: { width: SIZE, height: SIZE, marginBottom: space.xl },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  target: {
    fontFamily: fonts.medium,
    fontSize: 16,
    letterSpacing: 0.4,
    color: colors.text,
    marginTop: space.sm,
  },
});
