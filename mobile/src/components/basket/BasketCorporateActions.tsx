import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AssetMap, symbolOf } from '../../lib/basket';
import { formatDate, humanize } from '../../lib/format';
import type { CorporateAction, DtfDetail } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';
import { Badge, Card, Divider } from '../ui';

const TONE: Record<CorporateAction['status'], 'gold' | 'green' | 'neutral'> = {
  announced: 'gold',
  effective: 'green',
  cancelled: 'neutral',
};

/**
 * Basket detail: dividends, splits and other actions on the constituents.
 * Hidden while there are none (or the read model is still indexing).
 */
export function BasketCorporateActions({
  dtf,
  assets,
}: {
  dtf: DtfDetail;
  assets: AssetMap;
}) {
  if (dtf.corporateActions.length === 0) return null;
  return (
    <Card title="Corporate actions">
      {dtf.corporateActions.map((action, i) => (
        <View key={action.id} style={styles.item}>
          {i > 0 && <Divider />}
          <View style={styles.line}>
            <Text style={styles.title}>
              {symbolOf(action.assetId, assets)} · {humanize(action.actionType)}
            </Text>
            <Badge label={humanize(action.status)} tone={TONE[action.status]} />
          </View>
          <Text style={styles.date}>
            Effective {formatDate(action.effectiveAt)}
          </Text>
        </View>
      ))}
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
  title: { ...type.body, color: colors.text, flex: 1 },
  date: { ...type.small, color: colors.muted },
});
