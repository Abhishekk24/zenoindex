import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { explorerTxUrl } from '../../lib/chain';
import { fromRaw } from '../../lib/decimal';
import { formatDate, formatRaw, humanize } from '../../lib/format';
import { usd } from '../../lib/money';
import type { Dtf, WalletTransaction } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { Chip, Empty, LinkText } from '../ui';
import { listStyles } from './listStyles';

type Filter = 'all' | 'invest' | 'redeem' | 'pending';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'invest', label: 'Invest' },
  { value: 'redeem', label: 'Redeem' },
  { value: 'pending', label: 'Pending' },
];

function matches(tx: WalletTransaction, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return tx.status === 'pending';
  return filter === 'invest' ? tx.action === 'invest' : tx.action !== 'invest';
}

/** The wallet's invests and redeems, newest first, with a type filter. */
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
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <Chip
            key={f.value}
            label={f.label}
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </View>
      {shown.length === 0 ? (
        <Empty title="Nothing here yet" />
      ) : (
        shown.map((tx, i) => {
          const dtf = dtfs.get(tx.dtfId);
          const invest = tx.action === 'invest';
          const url = tx.txHash
            ? explorerTxUrl(tx.chainId || dtf?.chainId || 0, tx.txHash)
            : null;
          return (
            <View
              key={tx.id}
              style={[
                listStyles.row,
                styles.item,
                i === shown.length - 1 && listStyles.last,
              ]}
            >
              <View style={styles.top}>
                <View style={styles.tags}>
                  <View
                    style={[
                      styles.tag,
                      invest ? styles.tagGreen : styles.tagNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        {
                          color: invest ? colors.green : colors.textSecondary,
                        },
                      ]}
                    >
                      {humanize(tx.action)}
                    </Text>
                  </View>
                  {tx.status !== 'confirmed' ? (
                    <Text
                      style={[
                        styles.status,
                        {
                          color:
                            tx.status === 'reverted' ? colors.red : colors.gold,
                        },
                      ]}
                    >
                      {tx.status === 'reverted' ? 'Failed' : 'Pending'}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.date}>{formatDate(tx.occurredAt)}</Text>
              </View>
              <View style={styles.bottom}>
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
              <View style={styles.bottom}>
                <Text style={[styles.date, listStyles.fill]}>
                  {tx.shareAmountRaw
                    ? `${invest ? '+' : '−'}${formatRaw(
                        tx.shareAmountRaw,
                        dtf?.shareDecimals ?? 18,
                        4,
                      )} ${dtf?.symbol ?? ''}`
                    : ''}
                </Text>
                {url ? <LinkText label="Explorer" size={12} url={url} /> : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  item: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tags: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
  status: { fontFamily: fonts.medium, fontSize: 11 },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  amount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
