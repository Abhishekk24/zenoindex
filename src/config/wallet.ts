/**
 * Wallets, the way Privy's web SDK does it:
 * - Privy signs everyone in. Email / Google → Privy's embedded wallet.
 * - External wallets (MetaMask, Rainbow, … any WalletConnect wallet) connect
 *   over WalletConnect's UniversalProvider (src/wallets/externalWallet.ts);
 *   Privy verifies their SIWE signature.
 * No Reown AppKit, no wagmi. The app trades on Robinhood Chain mainnet.
 */
import type { PrivyProviderProps } from '@privy-io/expo';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

import { robinhood } from './chains';

const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!appId) throw new Error('Missing EXPO_PUBLIC_PRIVY_APP_ID');
if (!clientId) throw new Error('Missing EXPO_PUBLIC_PRIVY_CLIENT_ID');
if (!projectId) {
  // The WalletConnect Cloud project id (Reown dashboard).
  throw new Error('Missing EXPO_PUBLIC_REOWN_PROJECT_ID');
}

// Privy signs everyone in: email / Google users get an embedded wallet on first
// login (it takes custom chains, so it trades on Robinhood directly); wallet
// users keep trading with their own wallet, so they get none.
export const privyProps: Omit<PrivyProviderProps, 'children'> = {
  appId,
  clientId,
  supportedChains: [robinhood],
  config: {
    embedded: { ethereum: { createOnLogin: 'users-without-wallets' } },
  },
};

/** The SIWE origin for wallet sign-in; must be in the Privy dashboard's allowed domains. */
export const SIWE_ORIGIN = {
  domain: 'zenoindex.com',
  uri: 'https://zenoindex.com',
};

/** WalletConnect: the project, and how wallets show and return to Zeno. */
export const WALLETCONNECT = {
  projectId,
  metadata: {
    name: 'Zeno',
    description: 'Zeno mobile investor app',
    // Wallets show this as the dApp's origin and check it against the
    // WalletConnect project's verified domains; same domain as SIWE_ORIGIN.
    url: SIWE_ORIGIN.uri,
    icons: [] as string[],
    redirect: {
      // Wallets deep-link back here after approving; src/app/wc-return.tsx
      // returns the user to the screen that started the wallet flow.
      // Expo Go can't receive zeno:// links; it gets exp://…/--/wc-return instead.
      native:
        Constants.appOwnership === 'expo'
          ? Linking.createURL('wc-return')
          : 'zeno://wc-return',
    },
  },
};
