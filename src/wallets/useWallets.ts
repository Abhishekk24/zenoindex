/**
 * Every wallet the user has, with one interface — the React Native take on
 * Privy's web `useWallets()`: Privy's embedded wallet and an external wallet
 * (WalletConnect) both expose `address`, `switchChain` and `sendTransaction`,
 * so callers never branch on the wallet type.
 */
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { numberToHex, type Hex } from 'viem';

import * as external from './externalWallet';
import type { WalletTx } from './externalWallet';

export type { WalletTx };

export type ConnectedWallet = {
  type: 'embedded' | 'external';
  address: Hex;
  /** "Privy wallet", "MetaMask", … */
  name: string;
  /** Moves the wallet to `chainId` (an external wallet asks the user). */
  switchChain(chainId: number): Promise<void>;
  /** Switches to the transaction's network, then signs and sends it. */
  sendTransaction(tx: WalletTx): Promise<Hex>;
};

type EmbeddedWallet = ReturnType<
  typeof useEmbeddedEthereumWallet
>['wallets'][number];

async function switchEmbeddedChain(
  wallet: EmbeddedWallet,
  chainId: number,
): Promise<void> {
  const provider = await wallet.getProvider();
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: numberToHex(chainId) }],
  });
}

/**
 * Signs inside the app on any chain in config/wallet.ts: nothing to open, no
 * network to switch by hand.
 */
async function sendEmbeddedTransaction(
  wallet: EmbeddedWallet,
  tx: WalletTx,
): Promise<Hex> {
  await switchEmbeddedChain(wallet, tx.chainId);
  const provider = await wallet.getProvider();
  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: wallet.address,
        to: tx.to,
        data: tx.data,
        value: numberToHex(tx.value ?? 0n),
        ...(tx.gas ? { gas: numberToHex(tx.gas) } : {}),
      },
    ],
  })) as Hex;
}

export function useWallets(): ConnectedWallet[] {
  const embedded = useEmbeddedEthereumWallet().wallets[0];
  const ext = external.useExternalWallet();

  const list: ConnectedWallet[] = [];
  if (embedded) {
    list.push({
      type: 'embedded',
      address: embedded.address as Hex,
      name: 'Privy wallet',
      switchChain: chainId => switchEmbeddedChain(embedded, chainId),
      sendTransaction: tx => sendEmbeddedTransaction(embedded, tx),
    });
  }
  if (ext.status === 'connected' && ext.address) {
    list.push({
      type: 'external',
      address: ext.address,
      name: ext.app?.name ?? 'Wallet',
      switchChain: external.switchChain,
      sendTransaction: external.sendTransaction,
    });
  }
  return list;
}
