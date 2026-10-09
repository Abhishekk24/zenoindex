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
};

/** A stacked bar of weights with a legend underneath. */
export function AllocationBar({ slices }: { slices: Slice[] }) {
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
          <Mono size={12}>{formatBps(slice.bps)}</Mono>
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
});
