/**
 * The wallet that signs for the signed-in user (the same one the backend made
 * the account, POST /auth/privy):
 *
 * - email / Google → the Privy embedded wallet. It signs inside the app on any
 *   chain in config/wallet.ts: nothing to open, no network to switch by hand.
 * - wallet sign-in → the external wallet connected through Reown AppKit.
 *   Requests travel over WalletConnect, so the wallet app is brought to the
 *   front for each one (lib/walletLink.ts) and the network is switched first.
 */
import {
  useEmbeddedEthereumWallet,
  usePrivy,
  type PrivyUser,
} from '@privy-io/expo';
import { useAccount } from '@reown/appkit-react-native';
import { numberToHex, type Hex } from 'viem';
import { useChainId, useSendTransaction, useSwitchChain } from 'wagmi';

import { withWalletOpen } from './walletLink';

export type WalletTx = {
  chainId: number;
  to: Hex;
  data: Hex;
  value?: bigint;
  gas?: bigint;
};

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
  const privySession = !signsWithExternalWallet(usePrivy().user);
  const { wallets } = useEmbeddedEthereumWallet();
  const embedded = wallets[0];
  // AppKit's account, not wagmi's (wagmi can report another account of the session).
  const external = useAccount();
  const walletChainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

  const externalAddress = external.isConnected ? external.address : undefined;

  return {
    /** undefined while the embedded wallet is being created or no external wallet is connected. */
    address: privySession ? embedded?.address : externalAddress,
    /** External wallets are connected and managed in AppKit's modal. */
    isExternal: !privySession,

    async sendTransaction(tx: WalletTx): Promise<Hex> {
      if (privySession) {
        if (!embedded) {
          throw new Error(
            'Your wallet is still being set up. Try again in a moment.',
          );
        }
        const provider = await embedded.getProvider();
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(tx.chainId) }],
        });
        return (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: embedded.address,
              to: tx.to,
              data: tx.data,
              value: numberToHex(tx.value ?? 0n),
              ...(tx.gas ? { gas: numberToHex(tx.gas) } : {}),
            },
          ],
        })) as Hex;
      }

      if (!externalAddress) {
        throw new Error('Connect your wallet first.');
      }
      if (walletChainId !== tx.chainId) {
        try {
          await switchChainAsync({ chainId: tx.chainId });
        } catch {
          throw new Error(
            'Your wallet couldn’t switch to Robinhood Chain. Add the network in your wallet, then try again.',
          );
        }
      }
      return withWalletOpen(() =>
        sendTransactionAsync({
          account: externalAddress as Hex,
          chainId: tx.chainId,
          to: tx.to,
          data: tx.data,
          value: tx.value ?? 0n,
          ...(tx.gas ? { gas: tx.gas } : {}),
        }),
      );
    },
  };
}
