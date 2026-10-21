import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { openInAppBrowser } from '../../lib/browser';
import { explorerTxUrl } from '../../lib/chain';
import { fromRaw } from '../../lib/decimal';
import { formatDate, formatRaw, humanize } from '../../lib/format';
import { usd } from '../../lib/money';
import type { Dtf, WalletTransaction } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { Empty, OptionBar } from '../ui';
import { listStyles } from './listStyles';

type Filter = 'all' | 'invest' | 'redeem' | 'pending';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'invest', label: 'Invest' },
  { value: 'redeem', label: 'Redeem' },
  { value: 'pending', label: 'Pending' },
] as const;

const STATUS: Record<
  WalletTransaction['status'],
  { label: string; color: string }
> = {
  confirmed: { label: 'Confirmed', color: colors.green },
  pending: { label: 'Pending', color: colors.gold },
  reverted: { label: 'Failed', color: colors.red },
};

function matches(tx: WalletTransaction, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return tx.status === 'pending';
  return filter === 'invest' ? tx.action === 'invest' : tx.action !== 'invest';
}

/**
 * The wallet's invests and redeems, newest first (design): a Status bar,
 * then per activity its type and date, basket and amount, shares and status.
 * Tapping one opens it on the block explorer.
 */
export function ActivitiesTab({
  activity,
  dtfs,
}: {
  activity: WalletTransaction[];
  dtfs: Map<string, Dtf>;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  if (activity.length === 0) return <Empty title="No recent activity" />;
  const shown = activity.filter(tx => matches(tx, filter));

  return (
    <View>
      <OptionBar
        label="Status"
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        style={styles.filters}
      />
      {shown.length === 0 ? (
        <Empty title="Nothing here yet" />
      ) : (
        shown.map((tx, i) => {
          const dtf = dtfs.get(tx.dtfId);
          const invest = tx.action === 'invest';
          const status = STATUS[tx.status];
          const url = tx.txHash
            ? explorerTxUrl(tx.chainId || dtf?.chainId || 0, tx.txHash)
            : null;
          return (
            <Pressable
              key={tx.id}
              onPress={url ? () => void openInAppBrowser(url) : undefined}
              disabled={!url}
              accessibilityRole={url ? 'link' : undefined}
              accessibilityHint={url ? 'Opens it on the explorer' : undefined}
              style={({ pressed }) => [
                listStyles.row,
                styles.item,
                i === shown.length - 1 && listStyles.last,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.line}>
                <View
                  style={[
                    styles.tag,
                    invest ? styles.tagGreen : styles.tagNeutral,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: invest ? colors.green : colors.textSecondary },
                    ]}
                  >
                    {humanize(tx.action)}
                  </Text>
                </View>
                <Text style={styles.date}>{formatDate(tx.occurredAt)}</Text>
              </View>
              <View style={styles.line}>
                <Text
                  style={[listStyles.title, listStyles.fill]}
                  numberOfLines={1}
                >
                  {dtf?.name ?? '—'}
                </Text>
                <Text style={styles.amount}>
                  {tx.amountRaw
                    ? usd(fromRaw(tx.amountRaw, dtf?.baseAssetDecimals ?? 6))
                    : '—'}
                </Text>
              </View>
              <View style={styles.line}>
                <Text style={[styles.date, listStyles.fill]}>
                  {tx.shareAmountRaw
                    ? `${invest ? '+' : '−'}${formatRaw(
                        tx.shareAmountRaw,
                        dtf?.shareDecimals ?? 18,
                        4,
                      )} ${dtf?.symbol ?? ''}`
                    : ''}
                </Text>
                <Text style={[styles.status, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { marginVertical: space.sm },
  item: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  pressed: { opacity: 0.75 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagGreen: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenLine,
  },
  tagNeutral: { borderColor: colors.lineStrong },
  tagText: { fontFamily: fonts.regular, fontSize: 11 },
  status: { fontFamily: fonts.medium, fontSize: 12 },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  amount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
