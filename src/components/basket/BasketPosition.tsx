import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLoad } from '../../hooks/useLoad';
import { erc20BalanceOf } from '../../lib/chain';
import { fromRaw, mul } from '../../lib/decimal';
import { formatRaw } from '../../lib/format';
import { usd } from '../../lib/money';
import type { Dtf } from '../../lib/types';
import { colors, fonts, space, type } from '../../theme/tokens';
import { Card, Label } from '../ui';

/**
 * Basket detail: the wallet's own shares in this basket, read on-chain. Shows
 * nothing until the wallet holds some; taps through to the position screen.
 */
export function BasketPosition({
  dtf,
  wallet,
  version,
}: {
  dtf: Dtf;
  wallet: string;
  /** Bumped by the parent to re-read the balance. */
  version: number;
}) {
  const { data: shares } = useLoad(
    async () =>
      dtf.contractAddress
        ? (
            await erc20BalanceOf(dtf.chainId, dtf.contractAddress, wallet)
          ).toString()
        : '0',
    `${dtf.id}#${wallet}#${version}`,
  );
  if (!shares || shares === '0') return null;
  const value = mul(fromRaw(shares, dtf.shareDecimals), dtf.sharePrice);

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/position/[id]', params: { id: dtf.id } })
      }
    >
      <View style={styles.line}>
        <Label>Your position</Label>
        <Text style={styles.link}>View ›</Text>
      </View>
      <Text style={styles.value}>{usd(value)}</Text>
      <Text style={styles.meta}>
        {formatRaw(shares, dtf.shareDecimals, 4)} {dtf.symbol}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { ...type.small, color: colors.gold },
  value: { fontFamily: fonts.regular, fontSize: 22, color: colors.text },
  meta: { ...type.small, color: colors.muted, marginTop: -space.sm },
});
