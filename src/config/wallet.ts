/**
 * Reown AppKit for EVM wallets via wagmi; the app trades on Robinhood Chain mainnet.
 * External wallets plus Reown email (embedded) wallets. Mirrors the tested
 * IMPACTMAX web setup: the network is served through the WalletConnect
 * Blockchain API RPC so embedded and external wallets can both reach it.
 * The WalletConnect polyfills are loaded first in src/app/_layout.tsx.
 */
import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';
import { mainnet } from 'viem/chains';

import { colors } from '../theme/tokens';
import { robinhood } from './chains';
import { appKitStorage } from './storage';

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error('Missing EXPO_PUBLIC_REOWN_PROJECT_ID');
}

const caipNetworkId = `eip155:${robinhood.id}` as const;
const walletConnectRpc = `https://rpc.walletconnect.org/v1/?chainId=${caipNetworkId}&projectId=${projectId}`;

const robinhoodNetwork = {
  ...robinhood,
  rpcUrls: { default: { http: [walletConnectRpc] } },
  chainNamespace: 'eip155' as const,
  caipNetworkId,
};

// Ethereum mainnet is the default network, as in IMPACTMAX: email (embedded)
// wallets connect on a network they support out of the box. Sign-in is a
// plain signature (no network switch); trades switch to Robinhood themselves.
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
    // Email = Reown embedded wallet; external wallets stay listed below it.
    socials: ['email'],
    showWallets: true,
  },
  themeMode: 'dark',
  themeVariables: {
    accent: colors.gold,
  },
});

export { wagmiAdapter };
