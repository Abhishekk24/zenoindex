/**
 * Placeholders while something loads, instead of a spinner: grey shapes where
 * the content will be, pulsing together (still with reduced motion).
 *
 * - Skeleton: one pulsing group; put SkeletonBars (or SkeletonCards) inside.
 * - SkeletonBar: one grey shape.
 * - SkeletonCard: a Card-shaped block (same surface, border and padding) with
 *   a title line and label / value rows.
 */
import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, space } from '../../theme/tokens';

export function Skeleton({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.55, { duration: 900 }), -1, true));
  }, [opacity, reduceMotion]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[style, pulse]}
      accessibilityLabel="Loading"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Animated.View>
  );
}

export function SkeletonBar({
  width = '100%',
  height = 8,
  round = 4,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.bar, { width, height, borderRadius: round }, style]} />
  );
}

/** A Card while it loads: a title line and `rows` label / value rows. */
export function SkeletonCard({
  rows = 3,
  children,
}: {
  rows?: number;
  /** Extra shapes under the rows (a chart block, a button). */
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <SkeletonBar width="40%" height={12} round={6} />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBar width="30%" />
          <SkeletonBar width="22%" />
        </View>
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface3 },
  // Card's own surface, border and padding (ui/Card), so nothing jumps.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
