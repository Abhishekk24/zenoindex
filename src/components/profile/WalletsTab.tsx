import { useAppKit } from '@reown/appkit-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAccount, useSignMessage } from 'wagmi';

import { robinhoodTestnet } from '../../config/chains';
import { useLoad } from '../../hooks/useLoad';
import { useSession } from '../../hooks/useSession';
import * as api from '../../lib/api';
import { shortAddress } from '../../lib/format';
import type { User } from '../../lib/types';
import { withWalletOpen } from '../../lib/walletLink';
import { colors, fonts, space, type } from '../../theme/tokens';
import { Badge, Body, Button, Card, Divider, Mono } from '../ui';

/**
 * Profile → Wallets (not in the new design yet; unchanged).
 *
 * Connecting a wallet in AppKit does NOT link it — the backend must verify a
 * challenge signature first (`/auth/wallet/challenge` → personal_sign →
 * `/auth/wallet/verify`). Only verified wallets appear in the list.
 */
export function WalletsTab({ user }: { user: User }) {
  const { setUser } = useSession();
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  // The chain the linked wallet must be on: the API's first supported chain.
  const { data: chains } = useLoad(api.listChains, 'chains');
  const expectedChainId = chains?.[0]?.chainId || robinhoodTestnet.id;
  const expectedName =
    chains?.[0]?.name ?? robinhoodTestnet.name ?? `chain ${expectedChainId}`;

  const wrongNetwork =
    isConnected && chainId !== undefined && chainId !== expectedChainId;

  const link = async () => {
    if (!address) return;
    setBusy('link');
    setError(undefined);
    setNotice(undefined);
    try {
      if (chainId !== expectedChainId) {
        throw new Error(
          `Switch your wallet to ${expectedName} before linking.`,
        );
      }
      const challenge = await api.requestWalletChallenge(address);
      const signature = await withWalletOpen(() =>
        signMessageAsync({
          account: address as `0x${string}`,
          message: challenge.message,
        }),
      );
      setUser(
        await api.verifyWalletLink({
          message: challenge.message,
          signature,
          chainId: expectedChainId,
        }),
      );
      setNotice('Wallet verified and linked.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet verification failed.');
    } finally {
      setBusy(null);
    }
  };

  const makePrimary = async (wallet: string) => {
    setBusy(`primary:${wallet}`);
    setError(undefined);
    try {
      setUser(await api.setPrimaryWallet(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set primary.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (wallet: string) => {
    setBusy(`remove:${wallet}`);
    setError(undefined);
    try {
      setUser(await api.removeWallet(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the wallet.');
    } finally {
      setBusy(null);
    }
  };

  const connectedLinked = Boolean(
    address &&
    user.wallets.some(w => w.address.toLowerCase() === address.toLowerCase()),
  );

  return (
    <Card title="Linked wallets" banded>
      <Body muted>
        A linked wallet holds your basket shares and signs your transactions.
      </Body>

      {user.wallets.length === 0 ? (
        <Text style={styles.muted}>No wallets linked yet.</Text>
      ) : (
        user.wallets.map((wallet, i) => (
          <View key={wallet.address} style={styles.item}>
            {i > 0 && <Divider />}
            <View style={styles.line}>
              <Mono>{shortAddress(wallet.address)}</Mono>
              {wallet.primary ? <Badge label="Primary" tone="gold" /> : null}
            </View>
            <Text style={styles.muted}>Chain {wallet.chainId}</Text>
            <View style={styles.actions}>
              {!wallet.primary && (
                <Button
                  label="Make primary"
                  variant="outline"
                  style={styles.action}
                  loading={busy === `primary:${wallet.address}`}
                  disabled={busy !== null}
                  onPress={() => makePrimary(wallet.address)}
                />
              )}
              <Button
                label="Remove"
                variant="ghost"
                style={styles.action}
                loading={busy === `remove:${wallet.address}`}
                disabled={busy !== null}
                onPress={() => remove(wallet.address)}
              />
            </View>
          </View>
        ))
      )}

      {wrongNetwork && (
        <Body muted>
          Your wallet is on a different network. Switch to {expectedName} to
          link it.
        </Body>
      )}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={isConnected ? 'Choose another wallet' : 'Connect wallet'}
        variant="outline"
        onPress={open}
      />
      <Button
        label={
          isConnected && connectedLinked
            ? 'Connected wallet already linked'
            : 'Sign to link connected wallet'
        }
        variant="green"
        onPress={link}
        loading={busy === 'link'}
        disabled={!isConnected || !address || connectedLinked || busy !== null}
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
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, minHeight: 38 },
  muted: { ...type.small, color: colors.muted },
  notice: { ...type.small, color: colors.green },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
});
