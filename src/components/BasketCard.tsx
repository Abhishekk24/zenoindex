import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AssetMap,
  isComingSoon,
  isPermissioned,
  symbolOf,
} from '../lib/basket';
import { formatBps, formatDecimal, shortAddress } from '../lib/format';
import type { Dtf } from '../lib/types';
import { colors, space, type } from '../theme/tokens';
import { Badge, Card, Label, Mono } from './ui';

export function BasketCard({
  dtf,
  assets,
  onPress,
}: {
  dtf: Dtf;
  assets: AssetMap;
  onPress: () => void;
}) {
  const base = symbolOf(dtf.baseAssetId, assets);
  const constituents = dtf.weights
    .map(w => symbolOf(w.assetId, assets))
    .join(' · ');
  return (
    <Card banded onPress={onPress}>
      <View style={styles.badges}>
        {isComingSoon(dtf) ? (
          <Badge label="Coming soon" />
        ) : (
          <Badge label="Active" tone="green" />
        )}
        {isPermissioned(dtf, assets) ? (
          <Badge label="Permissioned" tone="gold" />
        ) : (
          <Badge label="Open" />
        )}
      </View>
      <View style={styles.title}>
        <Text style={[type.heading, { color: colors.text }]}>{dtf.name}</Text>
        <Mono color={colors.gold}>{dtf.symbol}</Mono>
      </View>
      <Text style={[type.small, { color: colors.muted }]} numberOfLines={1}>
        {constituents}
      </Text>
      <View style={styles.figures}>
        <Figure
          label="NAV / share"
          value={`${formatDecimal(dtf.sharePrice, 4)}`}
        />
        <Figure label={`AUM · ${base}`} value={formatDecimal(dtf.aum, 0)} />
        <Figure label="Mgmt fee" value={formatBps(dtf.fees.managementBps)} />
      </View>
      <View style={styles.manager}>
        <Label>Manager</Label>
        <Mono size={12} color={colors.textSecondary} numberOfLines={1}>
          {shortAddress(dtf.manager)}
        </Mono>
      </View>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Label>{label}</Label>
      <Mono size={15}>{value}</Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { gap: 2 },
  figure: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', gap: space.sm },
  figures: { flexDirection: 'row', gap: space.md },
  manager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
});
