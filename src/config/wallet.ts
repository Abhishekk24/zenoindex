/**
 * Reown AppKit (WalletConnect) for EVM wallets via wagmi, on Robinhood Chain
 * testnet. The WalletConnect polyfills are loaded first in src/app/_layout.tsx.
 */
import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';

import { colors } from '../theme/tokens';
import { robinhoodTestnet } from './chains';
import { appKitStorage } from './storage';

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error('Missing EXPO_PUBLIC_REOWN_PROJECT_ID');
}

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [robinhoodTestnet],
});

const robinhoodNetwork = {
  ...robinhoodTestnet,
  chainNamespace: 'eip155' as const,
  caipNetworkId: `eip155:${robinhoodTestnet.id}` as const,
  testnet: true,
};

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
      native: 'zeno://wc-return',
    },
  },
  adapters: [wagmiAdapter],
  networks: [robinhoodNetwork],
  storage: appKitStorage,
  defaultNetwork: robinhoodNetwork,
  features: {
    socials: false,
  },
  themeMode: 'dark',
  themeVariables: {
    accent: colors.gold,
  },
});

export { wagmiAdapter };
