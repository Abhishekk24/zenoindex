import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { sub } from '../../lib/decimal';
import { formatDecimal, formatSignedBps } from '../../lib/format';
import { signedUsd, usd } from '../../lib/money';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Sparkline } from '../charts/Sparkline';
import { Stripes } from '../ui';

/**
 * The striped summary card (design): cost basis and unrealized P&L, market
 * value with the holdings' 30-day line, the cash balance, and today's change
 * in a band at the bottom. Cost figures show "—" until the API has the
 * wallet's invest history.
 */
export function PortfolioSummary({
  marketValue,
  cost,
  hasCost,
  baskets,
  cash,
  trend,
  today,
}: {
  marketValue: string;
  cost: string;
  hasCost: boolean;
  baskets: number;
  /** Uninvested stablecoin in the wallet, when it could be read. */
  cash?: { amount: string; symbol: string } | null;
  /** The holdings' value over the last 30 days (lib/portfolio). */
  trend: number[];
  /** Today's change in the holdings' value (lib/portfolio). */
  today: { amount: number; bps: number } | null;
}) {
  const pnl = sub(marketValue, cost);
  const todayColor =
    !today || today.amount === 0
      ? colors.muted
      : today.amount > 0
        ? colors.green
        : colors.red;

  return (
    <View style={styles.card}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Stripes height={220} stripe={2} gap={7} opacity={0.07} />
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Cost Basis</Text>
            <Text style={styles.value}>{hasCost ? usd(cost) : '—'}</Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={styles.label}>Unrealized PNL</Text>
            <Text style={styles.value}>{hasCost ? signedUsd(pnl) : '—'}</Text>
          </View>
        </View>
        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.marketLabel}>MARKET VALUE</Text>
          <Text style={styles.label}>
            {baskets} Basket{baskets === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.valueRow}>
          <View style={styles.fill}>
            <Text style={styles.marketValue} numberOfLines={1}>
              {usd(marketValue)}
            </Text>
            {cash ? (
              <Text style={styles.cash}>
                Cash ({cash.symbol}) Balance:{' '}
                <Text style={styles.cashValue}>
                  ${formatDecimal(cash.amount, 2)}
                </Text>
              </Text>
            ) : null}
          </View>
          {trend.length > 1 ? (
            <Sparkline values={trend} height={44} style={styles.spark} />
          ) : null}
        </View>
      </View>
      {/* Today's change across the holdings. */}
      <View style={styles.today}>
        <Text style={styles.label}>Today</Text>
        <Text style={[styles.todayValue, { color: todayColor }]}>
          {today
            ? `${signedUsd(today.amount.toFixed(2))} · ${formatSignedBps(today.bps)}`
            : '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  body: { padding: space.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  alignEnd: { alignItems: 'flex-end' },
  fill: { flex: 1 },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  value: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
  },
  rule: {
    height: 1,
    backgroundColor: colors.line,
    marginTop: space.md,
    marginBottom: space.lg,
  },
  marketLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.lg,
    marginTop: space.xxl,
  },
  marketValue: { fontFamily: fonts.regular, fontSize: 30, color: colors.text },
  cash: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: space.sm,
  },
  cashValue: { color: colors.text },
  spark: { width: 72 },
  today: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface2,
  },
  todayValue: { fontFamily: fonts.regular, fontSize: 12 },
});
