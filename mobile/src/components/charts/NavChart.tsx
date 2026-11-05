import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { compare } from '../../lib/decimal';
import { formatDate, formatDecimal } from '../../lib/format';
import type { NavHistoryPoint } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';
import { Mono } from '../ui';

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
    return <Text style={styles.empty}>Not enough history yet.</Text>;
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
    <View style={styles.wrap}>
      <View onLayout={onLayout} style={styles.plot}>
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
        <Text style={styles.date}>{formatDate(first.observedAt)}</Text>
        <Text style={styles.date}>{formatDate(last.observedAt)}</Text>
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

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  plot: { height: CHART_HEIGHT },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { ...type.small, color: colors.muted },
  date: { ...type.small, color: colors.dim },
});
