import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AssetMap, symbolOf } from '../../lib/basket';
import { formatBps, formatRaw } from '../../lib/format';
import type { DtfDetail } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';
import { Card, Divider, Empty, Mono } from '../ui';

/** Basket detail: each constituent's quantity and target vs actual weight. */
export function BasketHoldings({
  dtf,
  assets,
}: {
  dtf: DtfDetail;
  assets: AssetMap;
}) {
  return (
    <Card title="Holdings">
      {dtf.readModels.holdings === 'unavailable' ? (
        <Empty
          title="Holdings are still indexing"
          body="On-chain positions appear once the indexer catches up."
        />
      ) : dtf.holdings.length === 0 ? (
        <Empty title="No holdings yet" />
      ) : (
        dtf.holdings.map((h, i) => (
          <View key={h.assetId} style={styles.item}>
            {i > 0 && <Divider />}
            <View style={styles.line}>
              <Text style={styles.symbol}>{symbolOf(h.assetId, assets)}</Text>
              <Mono>
                {formatRaw(
                  h.quantityRaw,
                  assets.get(h.assetId)?.decimals ?? 18,
                  4,
                )}
              </Mono>
            </View>
            <View style={styles.line}>
              <Text style={styles.weight}>
                Target {formatBps(h.targetWeightBps)}
              </Text>
              <Text style={styles.weight}>
                Actual {formatBps(h.actualWeightBps)}
              </Text>
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
  symbol: { ...type.heading, color: colors.text },
  weight: { ...type.small, color: colors.muted },
});
