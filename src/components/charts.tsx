/** NAV line chart and allocation bar, drawn with react-native-svg and Views. */
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { compare } from '../lib/decimal';
import { formatBps, formatDate, formatDecimal } from '../lib/format';
import type { NavHistoryPoint } from '../lib/types';
import { colors, series, space, type } from '../theme/tokens';
import { Mono } from './ui';

const CHART_HEIGHT = 160;

/**
 * Share price over time. Prices stay decimal strings everywhere else; they
 * become numbers only here, as pixel positions on the screen.
 */
export function NavChart({ points }: { points: NavHistoryPoint[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <Text style={[type.small, { color: colors.muted }]}>
        Not enough history yet.
      </Text>
    );
  }

  const prices = points.map(p => p.sharePrice);
  const high = prices.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
  const low = prices.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const rising = compare(last.sharePrice, first.sharePrice) >= 0;
  const stroke = rising ? colors.green : colors.danger;

  let line = '';
  let area = '';
  if (width > 0) {
    const ys = prices.map(Number);
    const min = Math.min(...ys);
    const span = Math.max(...ys) - min || 1;
    const pad = 8;
    const coords = ys.map((y, i) => [
      (i / (ys.length - 1)) * width,
      pad + (1 - (y - min) / span) * (CHART_HEIGHT - pad * 2),
    ]);
    line = coords
      .map(
        ([x, y], i) =>
          `${i === 0 ? 'M' : 'L'}${x!.toFixed(1)},${y!.toFixed(1)}`,
      )
      .join(' ');
    area = `${line} L${width},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
  }

  return (
    <View style={{ gap: space.sm }}>
      <View onLayout={onLayout} style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.25} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#navFill)" />
            <Path
              d={line}
              stroke={stroke}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <Text style={[type.small, { color: colors.dim }]}>
          {formatDate(first.observedAt)}
        </Text>
        <Text style={[type.small, { color: colors.dim }]}>
          {formatDate(last.observedAt)}
        </Text>
      </View>
      <View style={styles.axis}>
        <Mono size={12} color={colors.muted}>
          Low {formatDecimal(low, 4)}
        </Mono>
        <Mono size={12} color={colors.muted}>
          High {formatDecimal(high, 4)}
        </Mono>
      </View>
    </View>
  );
}

export type Slice = {
  key: string;
  label: string;
  detail?: string;
  bps: number;
};

/** A stacked bar of weights with a legend underneath. */
export function AllocationBar({ slices }: { slices: Slice[] }) {
  return (
    <View style={{ gap: space.md }}>
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
          <Text style={[type.small, styles.legendLabel]} numberOfLines={1}>
            {slice.label}
            {slice.detail ? (
              <Text style={{ color: colors.muted }}> {slice.detail}</Text>
            ) : null}
          </Text>
          <Mono size={12}>{formatBps(slice.bps)}</Mono>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendLabel: { color: colors.text, flex: 1 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
