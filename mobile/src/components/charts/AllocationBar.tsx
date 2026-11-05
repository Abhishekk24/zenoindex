import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatBps } from '../../lib/format';
import { colors, series, space, type } from '../../theme/tokens';
import { Mono } from '../ui';

export type Slice = {
  key: string;
  label: string;
  detail?: string;
  bps: number;
  /** Current on-chain weight, shown beside the target when known. */
  actualBps?: number | null;
};

/** A stacked bar of weights with a legend underneath. */
export function AllocationBar({ slices }: { slices: Slice[] }) {
  const showActual = slices.some(
    s => s.actualBps !== undefined && s.actualBps !== null,
  );
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {slices.map((slice, i) => (
          <View
            key={slice.key}
            style={{
              flex: Math.max(slice.bps, 1),
              backgroundColor: series[i % series.length],
            }}
          />
        ))}
      </View>
      {showActual ? (
        <View style={styles.legendRow}>
          <Text style={[styles.head, styles.fill]}>Asset</Text>
          <Text style={[styles.head, styles.col]}>Target</Text>
          <Text style={[styles.head, styles.col]}>Actual</Text>
        </View>
      ) : null}
      {slices.map((slice, i) => (
        <View key={slice.key} style={styles.legendRow}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: series[i % series.length] },
            ]}
          />
          <Text style={styles.legendLabel} numberOfLines={1}>
            {slice.label}
            {slice.detail ? (
              <Text style={styles.detail}> {slice.detail}</Text>
            ) : null}
          </Text>
          <View style={showActual && styles.col}>
            <Mono size={12}>{formatBps(slice.bps)}</Mono>
          </View>
          {showActual ? (
            <View style={styles.col}>
              <Mono size={12} color={colors.muted}>
                {formatBps(slice.actualBps)}
              </Mono>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendLabel: { ...type.small, color: colors.text, flex: 1 },
  detail: { color: colors.muted },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  head: { ...type.label, color: colors.dim },
  fill: { flex: 1 },
  col: { width: 58, alignItems: 'flex-end', textAlign: 'right' },
});
