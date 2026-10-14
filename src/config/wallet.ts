/**
 * Wallets. Email / Google → Privy embedded wallet. External wallets → Reown
 * AppKit over WalletConnect. The app trades on Robinhood Chain mainnet.
 */
import type { PrivyProviderProps } from '@privy-io/expo';
import { createAppKit } from '@reown/appkit-react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';
import { mainnet } from 'viem/chains';

import { colors } from '../theme/tokens';
import { robinhood } from './chains';
import { appKitStorage } from './storage';

const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!appId) throw new Error('Missing EXPO_PUBLIC_PRIVY_APP_ID');
if (!clientId) throw new Error('Missing EXPO_PUBLIC_PRIVY_CLIENT_ID');

if (!projectId) {
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

// Reown AppKit (via wagmi) connects external wallets — MetaMask, Rainbow, … over
// WalletConnect. Privy's Expo SDK verifies a wallet's SIWE signature but has no
// EVM connector of its own, so AppKit connects and Privy signs the user in.
// Polyfills for both load first in /entrypoint.js.
const caipNetworkId = `eip155:${robinhood.id}` as const;
const walletConnectRpc = `https://rpc.walletconnect.org/v1/?chainId=${caipNetworkId}&projectId=${projectId}`;

const robinhoodNetwork = {
  ...robinhood,
  rpcUrls: { default: { http: [walletConnectRpc] } },
  chainNamespace: 'eip155' as const,
  caipNetworkId,
};

// External wallets sign in on Ethereum (a chain-agnostic signature every wallet
// knows) and switch to Robinhood Chain to trade (see lib/wallet.ts). Tested
// this way with MetaMask & co. before the move to Privy; kept as is.
const ethereumNetwork = {
  ...mainnet,
  chainNamespace: 'eip155' as const,
  caipNetworkId: `eip155:${mainnet.id}` as const,
};
const networks = [ethereumNetwork, robinhoodNetwork] as const;

const wagmiAdapter = new WagmiAdapter({ projectId, networks });

export const appKit = createAppKit({
  projectId,
  metadata: {
    name: 'Zeno',
    description: 'Zeno mobile investor app',
    // TODO: Zeno's public website; wallets show this as the dApp's origin.
    url: 'http://localhost:8081',
    icons: [],
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
  adapters: [wagmiAdapter],
  networks: [...networks],
  storage: appKitStorage,
  defaultNetwork: ethereumNetwork,
  features: {
    // External wallets only: email and Google go through Privy (privyProps).
    socials: false,
    showWallets: true,
  },
  themeMode: 'dark',
  themeVariables: {
    accent: colors.gold,
  },
});

export { wagmiAdapter };
