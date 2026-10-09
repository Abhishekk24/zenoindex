import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AssetMap, symbolOf } from '../../lib/basket';
import {
  formatDate,
  formatRaw,
  humanize,
  shortAddress,
} from '../../lib/format';
import type { DtfDetail } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';
import { Badge, Card, Divider, Empty, Mono } from '../ui';

/** Basket detail: recent invests, redeems and rebalances. */
export function BasketActivity({
  dtf,
  assets,
}: {
  dtf: DtfDetail;
  assets: AssetMap;
}) {
  return (
    <Card title="Recent activity">
      {dtf.readModels.recentTransactions === 'unavailable' ? (
        <Empty
          title="Activity is still indexing"
          body="Deposits, redeems and rebalances appear once indexed."
        />
      ) : dtf.recentTransactions.length === 0 ? (
        <Empty title="No activity yet" />
      ) : (
        dtf.recentTransactions.map((tx, i) => (
          <View key={tx.id} style={styles.item}>
            {i > 0 && <Divider />}
            <View style={styles.line}>
              <Badge
                label={humanize(tx.action)}
                tone={tx.action === 'invest' ? 'green' : 'neutral'}
              />
              <Text style={styles.date}>{formatDate(tx.occurredAt)}</Text>
            </View>
            <View style={styles.line}>
              <Mono size={12} color={colors.textSecondary}>
                {tx.walletAddress ? shortAddress(tx.walletAddress) : '—'}
              </Mono>
              <Mono size={12}>
                {tx.amountRaw
                  ? `${formatRaw(
                      tx.amountRaw,
                      dtf.baseAssetDecimals,
                    )} ${symbolOf(tx.assetId, assets)}`
                  : '—'}
              </Mono>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.xs },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  date: { ...type.small, color: colors.muted },
});
