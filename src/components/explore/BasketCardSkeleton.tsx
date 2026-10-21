import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../../theme/tokens';
import { Skeleton, Stripes } from '../ui';

/**
 * A BasketCard while baskets load (Explore, Search): the same card with grey
 * bars where the name, 30-day graph, constituents and stats will be,
 * pulsing (ui/Skeleton).
 */
export function BasketCardSkeleton() {
  return (
    <Skeleton style={styles.card}>
      <View style={styles.stripes} pointerEvents="none">
        <Stripes height={84} stripe={2} gap={7} opacity={0.12} />
      </View>
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.titles}>
            <View style={[styles.bar, styles.name]} />
            <View style={[styles.bar, styles.meta]} />
          </View>
          <View style={styles.pill} />
        </View>

        <View style={styles.trend}>
          <View style={styles.graph} />
          <View style={styles.figures}>
            <View style={[styles.bar, styles.figure]} />
            <View style={[styles.bar, styles.figureLabel]} />
          </View>
        </View>

        <View style={styles.constituents}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.avatar, i > 0 && styles.overlap]} />
          ))}
          <View style={[styles.bar, styles.count]} />
        </View>

        <View style={styles.rule} />

        <View style={styles.stats}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.stat}>
              <View style={[styles.bar, styles.statLabel]} />
              <View style={[styles.bar, styles.statValue]} />
            </View>
          ))}
        </View>
      </View>
    </Skeleton>
  );
}

// Sizes and spacing follow BasketCard so nothing jumps when the cards land.
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '62%',
    height: 84,
  },
  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surface3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  titles: { flex: 1, gap: 10 },
  name: { width: '60%', height: 16, borderRadius: 6 },
  meta: { width: '38%' },
  pill: {
    width: 64,
    height: 26,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 22,
  },
  graph: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.surface3,
    opacity: 0.6,
  },
  figures: { alignItems: 'flex-end', minWidth: 64, gap: 6 },
  figure: { width: 48, height: 10 },
  figureLabel: { width: 24 },
  constituents: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  overlap: { marginLeft: -9 },
  count: { width: 92, marginLeft: 12 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 18 },
  stats: { flexDirection: 'row', paddingHorizontal: 6 },
  stat: { flex: 1, gap: 8 },
  statLabel: { width: '50%' },
  statValue: { width: '70%', height: 10 },
});
