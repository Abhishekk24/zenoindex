import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ratioBps } from '../../lib/decimal';
import { formatBps } from '../../lib/format';
import { usd } from '../../lib/money';
import type { Position } from '../../lib/portfolio';
import type { Dtf } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { listStyles } from './listStyles';

/** Allocation colours from the design, then extras for more baskets. */
const ALLOCATION_COLORS = [
  '#4e559c',
  '#3d8a62',
  colors.gold,
  '#8fb3d9',
  '#d98f8f',
  '#b39ddb',
];

/** Split bar of each basket's share of the market value, with a legend. */
export function AllocationTab({
  positions,
  marketValue,
  dtfs,
}: {
  positions: Position[];
  marketValue: string;
  dtfs: Map<string, Dtf>;
}) {
  const slices = positions.map((p, i) => ({
    position: p,
    bps: ratioBps(p.value, marketValue),
    color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]!,
  }));
  return (
    <View>
      <View style={styles.bar}>
        {slices.map(s => (
          <View
            key={s.position.dtfId}
            style={[
              styles.segment,
              { flex: Math.max(s.bps, 1), backgroundColor: s.color },
            ]}
          />
        ))}
      </View>
      {slices.map((s, i) => (
        <View
          key={s.position.dtfId}
          style={[listStyles.row, i === slices.length - 1 && listStyles.last]}
        >
          <View style={listStyles.fill}>
            <View style={styles.name}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={listStyles.title} numberOfLines={1}>
                {dtfs.get(s.position.dtfId)?.name ?? s.position.dtfId}
              </Text>
            </View>
            <Text style={listStyles.value}>{usd(s.position.value)}</Text>
          </View>
          <Text style={styles.percent}>{formatBps(s.bps, 1)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 4,
    height: 10,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  segment: { borderRadius: 5 },
  name: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  percent: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
