/**
 * The wallet that signs for the signed-in user (the same one the backend made
 * the account, POST /auth/privy):
 *
 * - email / Google → the Privy embedded wallet. It signs inside the app on any
 *   chain in config/wallet.ts: nothing to open, no network to switch by hand.
 * - wallet sign-in → the external wallet connected over WalletConnect
 *   (src/wallets/externalWallet.ts). Each request opens the wallet app, and the
 *   wallet is asked to switch network first.
 *
 * Both come from useWallets(), one interface for every wallet type.
 */
import { usePrivy, type PrivyUser } from '@privy-io/expo';
import type { Hex } from 'viem';

import { useWallets, type WalletTx } from '../wallets/useWallets';

export type { WalletTx };

/**
 * True when the account is an external wallet: a Privy user who signed in with
 * a wallet and has no embedded one (the backend prefers embedded), or no Privy
 * user at all (a session from the backend's own SIWE, e.g. before Privy).
 */
export function signsWithExternalWallet(user: PrivyUser | null): boolean {
  if (!user) return true;
  const wallets = user.linked_accounts.filter(
    a => a.type === 'wallet' && a.chain_type === 'ethereum',
  );
  const embedded = wallets.some(
    a => 'connector_type' in a && a.connector_type === 'embedded',
  );
  return !embedded && wallets.length > 0;
}

export function useWallet() {
  const isExternal = signsWithExternalWallet(usePrivy().user);
  const wallets = useWallets();
  const wallet = wallets.find(w =>
    isExternal ? w.type === 'external' : w.type === 'embedded',
  );

  return {
    /** undefined while the embedded wallet is being created or no external wallet is connected. */
    address: wallet?.address,
    /** External wallets are connected from the wallet picker (Profile → Wallets). */
    isExternal,

    sendTransaction(tx: WalletTx): Promise<Hex> {
      if (!wallet) {
        throw new Error(
          isExternal
            ? 'Connect your wallet first.'
            : 'Your wallet is still being set up. Try again in a moment.',
        );
      }
      return wallet.sendTransaction(tx);
    },
  };
}
