import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fromRaw } from '../../lib/decimal';
import { formatDate, humanize } from '../../lib/format';
import { usd } from '../../lib/money';
import type { Dtf, WalletTransaction } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { Empty } from '../ui';
import { listStyles } from './listStyles';

/** The wallet's invests and redeems, newest first. */
export function ActivitiesTab({
  activity,
  dtfs,
}: {
  activity: WalletTransaction[];
  dtfs: Map<string, Dtf>;
}) {
  if (activity.length === 0) return <Empty title="No recent activity" />;
  return (
    <View>
      {activity.map((tx, i) => {
        const dtf = dtfs.get(tx.dtfId);
        const invest = tx.action === 'invest';
        return (
          <View
            key={tx.id}
            style={[
              listStyles.row,
              styles.item,
              i === activity.length - 1 && listStyles.last,
            ]}
          >
            <View style={styles.top}>
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
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  amount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
