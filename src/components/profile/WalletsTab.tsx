import { useAppKit } from '@reown/appkit-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAccount } from 'wagmi';

import { robinhood } from '../../config/chains';
import { shortAddress } from '../../lib/format';
import type { User } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';
import { Badge, Body, Button, Card, Divider, Mono } from '../ui';

/**
 * Profile → Wallets. You sign in with a wallet (SIWE), so the account IS that
 * wallet; to use another one, sign out and sign in with it.
 */
export function WalletsTab({ user }: { user: User }) {
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();

  const mismatch =
    isConnected &&
    address !== undefined &&
    !user.wallets.some(w => w.address.toLowerCase() === address.toLowerCase());
  const wrongNetwork =
    isConnected && chainId !== undefined && chainId !== robinhood.id;

  return (
    <Card title="Your wallet" banded>
      <Body muted>
        This wallet holds your basket shares and signs your transactions.
      </Body>

      {user.wallets.map((wallet, i) => (
        <View key={wallet.address} style={styles.item}>
          {i > 0 && <Divider />}
          <View style={styles.line}>
            <Mono>{shortAddress(wallet.address)}</Mono>
            {wallet.primary ? <Badge label="Signed in" tone="gold" /> : null}
          </View>
          <Text style={styles.muted}>{robinhood.name}</Text>
        </View>
      ))}

      {mismatch && (
        <Body muted>
          The connected wallet ({shortAddress(address!)}) is not the one you
          signed in with. Switch back to it to trade, or sign out and sign in
          with the new one.
        </Body>
      )}
      {wrongNetwork && (
        <Body muted>
          Your wallet is on a different network. Switch to {robinhood.name}.
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
