import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isComingSoon } from '../../lib/basket';
import { chainName } from '../../lib/chain';
import { formatAgo, shortAddress } from '../../lib/format';
import type { DtfDetail } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';
import { Badge, Display, Label, Mono, Stripes } from '../ui';

/** Basket detail top: status badges, name, symbol and manager. */
export function BasketHeader({
  dtf,
  permissioned,
}: {
  dtf: DtfDetail;
  permissioned: boolean;
}) {
  return (
    <View style={styles.header}>
      <Stripes height={132} fade="down" stripe={6} gap={16} opacity={0.18} />
      <View style={styles.badges}>
        {isComingSoon(dtf) ? (
          <Badge label="Coming soon" />
        ) : (
          <Badge label="Active" tone="green" />
        )}
        {permissioned ? (
          <Badge label="Permissioned" tone="gold" />
        ) : (
          <Badge label="Open" />
        )}
      </View>
      <Display>{dtf.name}</Display>
      <Mono color={colors.gold} size={15}>
        {dtf.symbol}
      </Mono>
      <View style={styles.manager}>
        <Label>Manager</Label>
        <Mono size={12} color={colors.textSecondary}>
          {shortAddress(dtf.manager)}
        </Mono>
      </View>
      {dtf.asOf ? (
        <Text style={styles.freshness}>
          Priced {formatAgo(dtf.asOf)}
          {dtf.priceSource ? ` · ${dtf.priceSource}` : ''} ·{' '}
          {chainName(dtf.chainId)}
        </Text>
      ) : null}
      {dtf.priceStale ? (
        <Badge label="Price may be out of date" tone="danger" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    overflow: 'hidden',
  },
  badges: { flexDirection: 'row', gap: space.sm },
  manager: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  freshness: { ...type.small, color: colors.dim },
});
