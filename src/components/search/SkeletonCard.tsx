import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, space } from '../../theme/tokens';
import { Stripes } from '../ui';

/** A faint basket-card outline with a gentle pulse (still with reduced motion). */
export function SkeletonCard() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.55, { duration: 900 }), -1, true));
  }, [opacity, reduceMotion]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[styles.card, pulse]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.stripes} pointerEvents="none">
        <Stripes height={70} stripe={2} gap={7} opacity={0.12} />
      </View>
      <View style={styles.row}>
        <View style={styles.avatars}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.avatar, i > 0 && styles.overlap]} />
          ))}
        </View>
        <View style={[styles.bar, styles.barShort]} />
        <View style={styles.flex} />
        <View style={[styles.bar, styles.barPill]} />
      </View>
      <View style={styles.rule} />
      <View style={styles.stats}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.stat}>
            <View style={[styles.bar, styles.barStat]} />
            <View style={[styles.bar, styles.barStatSmall]} />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    paddingTop: 70,
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '62%',
    height: 70,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  overlap: { marginLeft: -8 },
  flex: { flex: 1 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surface3 },
  barShort: { width: 44, marginLeft: space.md },
  barPill: { width: 48, height: 16, borderRadius: 8 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: space.lg },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 6 },
  barStat: { width: '55%' },
  barStatSmall: { width: '30%' },
});
