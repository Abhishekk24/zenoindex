/**
 * Portfolio → Performance (design): a View bar (1W · 1M · 3M · ALL) and the
 * value of the current holdings over time — today's shares at each held
 * basket's share price from its NAV history (GET /dtfs/:id). The API has no
 * history of a wallet's own value, so buys and sells aren't reflected; the
 * caption says so.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { fromRaw } from '../../lib/decimal';
import type { Position } from '../../lib/portfolio';
import type { Dtf } from '../../lib/types';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Sparkline } from '../charts/Sparkline';
import { LoadState, OptionBar, Skeleton, SkeletonBar } from '../ui';

type Range = '1w' | '1m' | '3m' | 'all';

const RANGES = [
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: 'all', label: 'ALL' },
] as const;

const DAYS: Record<Range, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  all: Infinity,
};
const DAY_MS = 86_400_000;
const CHART_HEIGHT = 150;

type Line = { shares: number; points: { t: number; price: number }[] };

/** Each held basket's shares and its share-price history, oldest first. */
async function loadLines(
  positions: Position[],
  dtfs: Map<string, Dtf>,
): Promise<Line[]> {
  const details = await Promise.all(positions.map(p => api.getDtf(p.dtfId)));
  return positions.map((p, i) => ({
    shares: Number(fromRaw(p.shares, dtfs.get(p.dtfId)?.shareDecimals ?? 18)),
    points: details[i]!.performance.filter(
      pt => pt.valuationStatus !== 'unavailable',
    )
      .map(pt => ({
        t: Date.parse(pt.observedAt),
        price: Number(pt.sharePrice),
      }))
      .filter(pt => Number.isFinite(pt.t) && Number.isFinite(pt.price))
      .sort((a, b) => a.t - b.t),
  }));
}

/**
 * The holdings' value at every observed time within `range`, from when every
 * held basket has a price; each basket's latest known price carries forward.
 */
function valueSeries(lines: Line[], range: Range): number[] {
  const usable = lines.filter(l => l.points.length > 0);
  if (usable.length === 0) return [];
  const start = Math.max(...usable.map(l => l.points[0]!.t));
  const times = [...new Set(usable.flatMap(l => l.points.map(p => p.t)))]
    .filter(t => t >= start)
    .sort((a, b) => a - b);
  const end = times[times.length - 1] ?? start;
  const from = end - DAYS[range] * DAY_MS;
  return times
    .filter(t => t >= from)
    .map(t =>
      usable.reduce((total, l) => {
        let price = l.points[0]!.price;
        for (const p of l.points) {
          if (p.t > t) break;
          price = p.price;
        }
        return total + l.shares * price;
      }, 0),
    );
}

export function PerformanceTab({
  positions,
  dtfs,
  indexing,
}: {
  positions: Position[];
  dtfs: Map<string, Dtf>;
  /** Balances are live on-chain while account valuations index. */
  indexing: boolean;
}) {
  const [range, setRange] = useState<Range>('1w');
  const {
    data: lines,
    error,
    reload,
  } = useLoad(
    () => loadLines(positions, dtfs),
    `performance#${positions.map(p => `${p.dtfId}:${p.shares}`).join(',')}`,
  );
  const series = lines ? valueSeries(lines, range) : [];

  return (
    <View style={styles.root}>
      {indexing ? (
        <Text style={styles.note}>
          Live on-chain balances; account valuations are still indexing.
        </Text>
      ) : null}
      <OptionBar
        label="View"
        options={RANGES}
        value={range}
        onChange={setRange}
      />
      {!lines && error ? (
        <LoadState error={error} onRetry={reload} />
      ) : !lines ? (
        <Skeleton style={styles.chart}>
          <SkeletonBar height={CHART_HEIGHT - 32} round={8} />
        </Skeleton>
      ) : series.length < 2 ? (
        <View style={[styles.chart, styles.empty]}>
          <Text style={styles.caption}>Not enough price history yet.</Text>
        </View>
      ) : (
        <View style={styles.chart}>
          <Sparkline values={series} height={CHART_HEIGHT - 32} />
        </View>
      )}
      <Text style={styles.caption}>
        Your current holdings, valued at each basket’s price over time. Buys and
        sells aren’t reflected.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  chart: {
    height: CHART_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    padding: space.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empty: { alignItems: 'center' },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dim,
  },
});
