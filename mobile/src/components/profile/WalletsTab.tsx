import { usePrivy, type PrivyUser } from '@privy-io/expo';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { activeChain } from '../../config/chains';
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
import { useWallet } from '../../lib/wallet';
import { colors, fonts, space, type } from '../../theme/tokens';
import {
  Badge,
  Body,
  Button,
  Card,
  LinkText,
  Notice,
  Row,
  Skeleton,
  SkeletonBar,
} from '../ui';
import { useExternalWallet } from '../../wallets/externalWallet';
import { chooseWallet } from '../wallet/WalletPicker';
import { DepositSheet } from './DepositSheet';

/**
 * The signed-in wallet's stablecoin (what baskets are bought with) and gas
 * token balances, read on-chain. The stablecoin is the baskets' base asset.
 */
async function loadBalances(wallet: string) {
  const [dtfs, assets] = await Promise.all([api.listDtfs(), api.listAssets()]);
  const dtf = dtfs[0];
  const chainId = dtf?.chainId ?? activeChain.id;
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

/** "Email wallet · you@mail.com" / "Google wallet · …" for Privy sign-ins. */
function signInLabel(user: PrivyUser | null): string | null {
  for (const a of user?.linked_accounts ?? []) {
    if (a.type === 'email') return `Email wallet · ${a.address}`;
    if (a.type === 'google_oauth') return `Google wallet · ${a.email}`;
  }
  return null;
}

/**
 * Profile → Wallets. The account IS one wallet: the Privy embedded wallet for
 * email / Google, or the external wallet you signed in with. Its full address
 * is shown to copy, and Deposit shows it as a QR code to fund the wallet (an
 * email / Google wallet has no other way in). To use another wallet, sign out
 * and sign in with it.
 */
export function WalletsTab({ user }: { user: User }) {
  const { address, isExternal } = useWallet();
  const { user: privyUser } = usePrivy();
  const signedIn = primaryWallet(user);
  const {
    data: balances,
    loading: balancesLoading,
    error: balancesError,
    reload: reloadBalances,
  } = useLoad(
    async () => (signedIn ? loadBalances(signedIn) : null),
    `balances#${signedIn ?? 'none'}`,
  );
  const [copied, setCopied] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const mismatch =
    address !== undefined &&
    !user.wallets.some(w => w.address.toLowerCase() === address.toLowerCase());
  // An external wallet names itself through its connection (e.g. MetaMask).
  const { peer } = useExternalWallet();
  const kind = isExternal
    ? peer
      ? `Connected: ${peer.name}`
      : 'External wallet'
    : signInLabel(privyUser);

  const copy = async () => {
    if (!signedIn) return;
    await Clipboard.setStringAsync(signedIn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card title="Your wallet" banded>
      <Body muted>
        This wallet holds your basket shares and signs your transactions.
      </Body>
      {signedIn ? (
        <View style={styles.item}>
          <View style={styles.line}>
            <Text style={styles.muted} numberOfLines={1}>
              {kind ?? 'Wallet'}
            </Text>
            <Badge label={activeChain.name} tone="gold" />
          </View>
          <Text style={styles.address} selectable>
            {signedIn}
          </Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label={copied ? 'Copied' : 'Copy address'}
                variant="outline"
                onPress={copy}
              />
            </View>
            <View style={styles.action}>
              <Button label="Deposit" onPress={() => setDepositing(true)} />
            </View>
          </View>
          <LinkText
            label="View on explorer"
            url={explorerAddressUrl(activeChain.id, signedIn)}
          />
          <DepositSheet
            address={signedIn}
            visible={depositing}
            onClose={() => setDepositing(false)}
          />
        </View>
      ) : null}
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
      ) : balancesLoading && signedIn ? (
        <Skeleton style={styles.item}>
          {[0, 1].map(i => (
            <View key={i} style={styles.line}>
              <SkeletonBar width="35%" />
              <SkeletonBar width="20%" />
            </View>
          ))}
        </Skeleton>
      ) : balancesError ? (
        <Notice
          tone="error"
          title="Couldn’t load your balances"
          message={balancesError}
          actions={[{ label: 'Try again', onPress: reloadBalances }]}
        />
      ) : null}
      {mismatch && (
        <Body muted>
          The connected wallet ({shortAddress(address!)}) is not the one you
          signed in with. Switch back to it to trade, or sign out and sign in
          with the new one.
        </Body>
      )}
      {/* The wallet only disconnects on sign-out; reconnect if it dropped. */}
      {isExternal && !address ? (
        <Button
          label="Connect wallet"
          variant="ghost"
          onPress={() => void chooseWallet()}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.sm },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  muted: { ...type.small, color: colors.muted, flexShrink: 1 },
  address: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
