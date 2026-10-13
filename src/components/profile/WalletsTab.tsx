import { useAccount, useAppKit } from '@reown/appkit-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { robinhood } from '../../config/chains';
import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { assetMap, symbolOf } from '../../lib/basket';
import {
  erc20BalanceOf,
  explorerAddressUrl,
  nativeBalance,
  nativeSymbol,
} from '../../lib/chain';
import { formatRaw, shortAddress } from '../../lib/format';
import type { User } from '../../lib/types';
import { primaryWallet } from '../../lib/user';
import { colors, space, type } from '../../theme/tokens';
import { Badge, Body, Button, Card, Divider, LinkText, Row } from '../ui';

/**
 * The signed-in wallet's stablecoin (what baskets are bought with) and gas
 * token balances, read on-chain. The stablecoin is the baskets' base asset.
 */
async function loadBalances(wallet: string) {
  const [dtfs, assets] = await Promise.all([api.listDtfs(), api.listAssets()]);
  const dtf = dtfs[0];
  const chainId = dtf?.chainId ?? robinhood.id;
  const [base, gas] = await Promise.all([
    dtf?.baseAssetId
      ? erc20BalanceOf(chainId, dtf.baseAssetId, wallet)
      : Promise.resolve(null),
    nativeBalance(chainId, wallet),
  ]);
  return {
    base:
      base !== null && dtf
        ? {
            raw: base.toString(),
            decimals: dtf.baseAssetDecimals,
            symbol: symbolOf(dtf.baseAssetId, assetMap(assets)),
          }
        : null,
    gas: { raw: gas.toString(), symbol: nativeSymbol(chainId) },
  };
}

/**
 * Profile → Wallets. You sign in with a wallet (SIWE), so the account IS that
 * wallet; to use another one, sign out and sign in with it.
 */
export function WalletsTab({ user }: { user: User }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const signedIn = primaryWallet(user);
  const { data: balances } = useLoad(
    async () => (signedIn ? loadBalances(signedIn) : null),
    `balances#${signedIn ?? 'none'}`,
  );
  const mismatch =
    isConnected &&
    address !== undefined &&
    !user.wallets.some(w => w.address.toLowerCase() === address.toLowerCase());

  return (
    <Card title="Your wallet" banded>
      <Body muted>
        This wallet holds your basket shares and signs your transactions.
      </Body>
      {user.wallets.map((wallet, i) => (
        <View key={wallet.address} style={styles.item}>
          {i > 0 && <Divider />}
          <View style={styles.line}>
            <LinkText
              mono
              label={shortAddress(wallet.address)}
              url={explorerAddressUrl(robinhood.id, wallet.address)}
            />
            {wallet.primary ? <Badge label="Signed in" tone="gold" /> : null}
          </View>
          <Text style={styles.muted}>{robinhood.name}</Text>
        </View>
      ))}
      {balances ? (
        <View style={styles.item}>
          {balances.base ? (
            <Row
              label={balances.base.symbol}
              value={formatRaw(balances.base.raw, balances.base.decimals)}
            />
          ) : null}
          <Row
            label={`${balances.gas.symbol} (for network fees)`}
            value={formatRaw(balances.gas.raw, 18, 6)}
          />
        </View>
      ) : null}
      {mismatch && (
        <Body muted>
          The connected wallet ({shortAddress(address!)}) is not the one you
          signed in with. Switch back to it to trade, or sign out and sign in
          with the new one.
        </Body>
      )}
      <Button
        label={isConnected ? 'Manage connected wallet' : 'Connect wallet'}
        variant="outline"
        onPress={open}
      />
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
  muted: { ...type.small, color: colors.muted },
});
