import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';

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
    url: 'http://localhost:8081',
    icons: [],
    redirect: {
      native: 'zeno://',
    },
  },
  adapters: [wagmiAdapter],
  networks: [robinhoodNetwork],
  storage: appKitStorage,
  defaultNetwork: robinhoodNetwork,
  features: {
    socials: false,
  },
});

export { wagmiAdapter };
